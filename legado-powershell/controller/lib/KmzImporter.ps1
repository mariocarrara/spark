# =============================================================================
# lib/KmzImporter.ps1 — leitura de KMZ (Reserva Legal / APP, um arquivo por
# alimentador) e gravação como GeoJSON particionado, do mesmo jeito que a
# Rede MT já é gravada (ver Get-CamadaConfig em ShapefileImporter.ps1).
#
# Pedido do Mario (teste real, arquivos de exemplo "Trecho_AL1C01_APP.kmz" e
# "Trecho_AL1C01_RL.kmz"): essas duas camadas também são por alimentador, em
# vários arquivos .kmz — um por alimentador — e a base precisa ser
# incremental (subir o .kmz de um alimentador novo não pode apagar os
# outros já carregados). A solução reaproveita a MESMA infraestrutura
# particionada da Rede MT (pasta com um .geojson por chave + _index.json),
# só trocando o leitor: em vez de .shp/.dbf binário, aqui é um .kmz (zip
# com um .kml dentro) por alimentador.
#
# Formato real do .kmz (os dois exemplos enviados, Trecho_AL1C01_APP.kmz e
# Trecho_AL1C01_RL.kmz): um .kml (normalmente "doc.kml") com várias
# <Placemark>, cada uma com um <Polygon> (ou <MultiGeometry><Polygon>...)
# e uma <description> em CDATA com uma tabelinha HTML de atributos
# (MUNICIPIO/APP_M/AREA_HA na APP; cod_tema/nom_tema/num_area/ind_status na
# RL) — os atributos variam entre as duas camadas, então são lidos de forma
# genérica (qualquer <td>chave</td><td>valor</td> da tabela), sem fixar uma
# lista de campos esperados.
# =============================================================================

Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue

function Read-KmzPlacemarks {
    <# Lê um .kmz (zip com um .kml dentro) e devolve os polígonos de cada
       Placemark, já convertidos pro mesmo formato interno [lat,lng] usado
       pelos trechos de rede (Write-FeatureCollectionRede), mais o
       alimentador identificado a partir do NOME DO ARQUIVO (prioridade,
       porque é isso que o usuário controla ao nomear o .kmz) ou, se o nome
       não bater o padrão esperado, do id/nome do <Document> dentro do
       próprio KML — ambos seguem "...Trecho_<ALIMENTADOR>_APP" ou
       "..._RL" nos exemplos reais. #>
    param(
        [Parameter(Mandatory)][byte[]]$KmzBytes,
        [Parameter(Mandatory)][string]$FileName
    )

    $ms = New-Object System.IO.MemoryStream(,$KmzBytes)
    $kmlTexto = $null
    try {
        $zip = [System.IO.Compression.ZipArchive]::new($ms, [System.IO.Compression.ZipArchiveMode]::Read)
        try {
            $entry = $zip.Entries | Where-Object { $_.Name.ToLower().EndsWith(".kml") } | Select-Object -First 1
            if (-not $entry) { throw "Não encontrei nenhum .kml dentro do .kmz '$FileName'." }
            $s = $entry.Open()
            try {
                $sr = New-Object System.IO.StreamReader($s, [System.Text.Encoding]::UTF8)
                $kmlTexto = $sr.ReadToEnd()
                $sr.Close()
            } finally { $s.Close() }
        } finally { $zip.Dispose() }
    } finally { $ms.Dispose() }

    [xml]$doc = $kmlTexto
    # v2.13.16 - XPath por local-name(): funciona com qualquer versao/namespace
    # de KML (2.0, 2.1, 2.2, 2.3, "earth.google.com/kml/2.2"...). Antes so
    # "http://www.opengis.net/kml/2.2" era reconhecido e um .kmz de outra
    # origem virava "Nenhum poligono valido" sem explicacao.

    # 1) alimentador + tipo (APP/RL): primeiro tenta o nome do arquivo
    #    ("Trecho_AL1C01_APP.kmz" -> alimentador "AL1C01", tipo "APP"); se
    #    não bater, cai pro id/nome do <Document> dentro do KML (mesmo
    #    padrão, "lyr_Trecho_AL1C01_APP" nos exemplos reais).
    $alimentador = $null
    $tipoArquivo = $null
    if ($FileName -match '(?i)Trecho[_-](?<alim>.+?)[_-](?<tipo>APP|RL)\.kmz$') {
        $alimentador = $Matches['alim']
        $tipoArquivo = $Matches['tipo'].ToUpper()
    } else {
        $docNode = $doc.SelectSingleNode("//*[local-name()='Document']")
        $docId = $null; $docNome = $null
        if ($docNode) {
            $docId = $docNode.GetAttribute("id")
            $nomeNode = $docNode.SelectSingleNode("*[local-name()='name']")
            if ($nomeNode) { $docNome = $nomeNode.InnerText }
        }
        $candidato = $(if (-not [string]::IsNullOrWhiteSpace($docId)) { $docId } else { $docNome })
        if ($candidato -and $candidato -match '(?i)Trecho[_-](?<alim>.+?)[_-](?<tipo>APP|RL)$') {
            $alimentador = $Matches['alim']
            $tipoArquivo = $Matches['tipo'].ToUpper()
        }
    }
    if ([string]::IsNullOrWhiteSpace($alimentador)) {
        throw "Não consegui identificar o alimentador no arquivo '$FileName' — nomeie o .kmz como 'Trecho_<ALIMENTADOR>_APP.kmz' ou '..._RL.kmz' (mesmo padrão dos arquivos de exemplo)."
    }

    # 2) cada Placemark -> 0+ polígonos (MultiGeometry pode ter mais de um)
    $poligonos = New-Object System.Collections.Generic.List[object]
    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $placemarks = $doc.SelectNodes("//*[local-name()='Placemark']")
    foreach ($pm in $placemarks) {
        $nome = $null
        $nomeNode = $pm.SelectSingleNode("*[local-name()='name']")
        if ($nomeNode) { $nome = $nomeNode.InnerText }

        # Atributos: a <description> traz uma tabela HTML dentro de CDATA
        # (ver cabeçalho do arquivo) — lida de forma genérica (qualquer
        # par <td>chave</td><td>valor</td>), sem fixar os campos, porque
        # APP e RL trazem atributos bem diferentes entre si.
        $propriedades = [ordered]@{}
        $descNode = $pm.SelectSingleNode("*[local-name()='description']")
        if ($descNode -and -not [string]::IsNullOrWhiteSpace($descNode.InnerText)) {
            $pares = [regex]::Matches($descNode.InnerText, '<td>\s*([^<]*?)\s*</td>\s*<td[^>]*>\s*([^<]*?)\s*</td>')
            foreach ($par in $pares) {
                $chave = $par.Groups[1].Value.Trim()
                $valor = $par.Groups[2].Value.Trim()
                if ($chave -and -not $propriedades.Contains($chave)) { $propriedades[$chave] = $valor }
            }
        }

        $polyNodes = $pm.SelectNodes(".//*[local-name()='Polygon']")
        foreach ($poly in $polyNodes) {
            $coordNode = $poly.SelectSingleNode("*[local-name()='outerBoundaryIs']/*[local-name()='LinearRing']/*[local-name()='coordinates']")
            if (-not $coordNode -or [string]::IsNullOrWhiteSpace($coordNode.InnerText)) { continue }
            # coordinates do KML vêm "lon,lat,alt lon,lat,alt ..." separados
            # por espaço/quebra de linha — convertido aqui pro par [lat,lng]
            # interno (mesma convenção dos trechos de rede), a troca pra
            # GeoJSON [lng,lat] só acontece na hora de escrever (ver
            # Write-FeatureCollectionPoligono).
            $anel = New-Object System.Collections.Generic.List[object]
            $tokens = $coordNode.InnerText.Trim() -split '\s+'
            foreach ($tok in $tokens) {
                if ([string]::IsNullOrWhiteSpace($tok)) { continue }
                $partes = $tok.Split(',')
                if ($partes.Count -lt 2) { continue }
                $lng = 0.0; $lat = 0.0
                if (-not [double]::TryParse($partes[0], [System.Globalization.NumberStyles]::Float, $inv, [ref]$lng)) { continue }
                if (-not [double]::TryParse($partes[1], [System.Globalization.NumberStyles]::Float, $inv, [ref]$lat)) { continue }
                $anel.Add(@($lat, $lng))
            }
            if ($anel.Count -ge 3) {
                $poligonos.Add(@{ nome = $nome; propriedades = $propriedades; anel = $anel })
            }
        }
    }

    # contagem do que o arquivo realmente tem (so pra explicar a rejeicao)
    $contagens = "Placemark: $($placemarks.Count); Polygon: $($doc.SelectNodes("//*[local-name()='Polygon']").Count); LineString: $($doc.SelectNodes("//*[local-name()='LineString']").Count); Point: $($doc.SelectNodes("//*[local-name()='Point']").Count)"
    return @{ alimentador = $alimentador; tipo = $tipoArquivo; poligonos = $poligonos; contagens = $contagens }
}

function Write-FeatureCollectionPoligono {
    <# Mesmo princípio de Write-FeatureCollectionRede (ShapefileImporter.ps1):
       grava o GeoJSON direto em texto via StreamWriter, com progresso a
       cada 400ms, em vez de ConvertTo-Json -Depth N (lento e silencioso em
       coleções grandes — é a causa raiz do "signal is aborted without
       reason" já visto na importação da VERA e da Rede MT/BT/AT). Só a
       geometria muda (Polygon em vez de LineString) e as propriedades são
       dinâmicas (cada polígono carrega seu próprio dicionário, em vez de
       colunas fixas tipo CTMT/COD_ID). #>
    param(
        [Parameter(Mandatory)][string]$Caminho,
        [Parameter(Mandatory)]$Poligonos,
        [Parameter(Mandatory)][string]$NomeCamada,
        [scriptblock]$ProgressCallback,
        [string]$ProgressFase = "gravando"
    )
    $total = $Poligonos.Count
    $sw = New-Object System.IO.StreamWriter($Caminho, $false, (New-Object System.Text.UTF8Encoding($false)))
    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    try {
        $sw.Write('{"type":"FeatureCollection","name":"')
        $sw.Write((ConvertTo-JsonTextoEscapado $NomeCamada))
        $sw.Write('","crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3:CRS84"}},"features":[')

        $escritos = 0
        $primeiro = $true
        $ultimoProgresso = [DateTime]::MinValue
        foreach ($p in $Poligonos) {
            if (-not $primeiro) { $sw.Write(',') }
            $primeiro = $false

            $sw.Write('{"type":"Feature","properties":{')
            $primeiraProp = $true
            if (-not [string]::IsNullOrWhiteSpace($p.nome)) {
                $sw.Write('"NOME":"'); $sw.Write((ConvertTo-JsonTextoEscapado ([string]$p.nome))); $sw.Write('"')
                $primeiraProp = $false
            }
            foreach ($chave in $p.propriedades.Keys) {
                if (-not $primeiraProp) { $sw.Write(',') }
                $primeiraProp = $false
                $sw.Write('"'); $sw.Write((ConvertTo-JsonTextoEscapado $chave)); $sw.Write('":"')
                $sw.Write((ConvertTo-JsonTextoEscapado ([string]$p.propriedades[$chave])))
                $sw.Write('"')
            }
            $sw.Write('},"geometry":{"type":"Polygon","coordinates":[[')

            $primeiroPonto = $true
            foreach ($pt in $p.anel) {
                if (-not $primeiroPonto) { $sw.Write(',') }
                $primeiroPonto = $false
                $sw.Write('['); $sw.Write($pt[1].ToString($inv)); $sw.Write(','); $sw.Write($pt[0].ToString($inv)); $sw.Write(']')
            }
            $sw.Write(']]}}')

            $escritos++
            if ($ProgressCallback -and $total -gt 0) {
                $agora = [DateTime]::UtcNow
                if (($agora - $ultimoProgresso).TotalMilliseconds -ge 400 -or $escritos -eq $total) {
                    $ultimoProgresso = $agora
                    $pct = [Math]::Min(99, [Math]::Round(100.0 * $escritos / $total, 1))
                    & $ProgressCallback @{ fase = $ProgressFase; linha = $escritos; total = $total; percentual = $pct }
                }
            }
        }
        $sw.Write(']}')
    } finally {
        $sw.Flush()
        $sw.Close()
    }
    return $total
}

function Import-KmzUpload {
    <# Recebe os .kmz enviados no multipart (um arquivo por alimentador) e
       grava um .geojson por alimentador na pasta particionada de
       reserva_legal/app (Get-CamadaConfig), exatamente como a Rede MT.
       "Base incremental" (pedido do Mario) sai de graça dessa escolha: cada
       arquivo do lote só regrava a PRÓPRIA partição (o alimentador que ele
       representa) — os alimentadores já carregados antes, de um envio
       anterior, nunca são tocados. Pode vir mais de um .kmz na mesma
       chamada (um por alimentador, selecionados juntos no navegador). #>
    param(
        [Parameter(Mandatory)][array]$Arquivos,
        [Parameter(Mandatory)][string]$Camada,
        [Parameter(Mandatory)][string]$GeoRoot,
        [scriptblock]$ProgressCallback
    )
    $config = Get-CamadaConfig -Camada $Camada -GeoRoot $GeoRoot
    if (-not $config.Particionado) { throw "Camada '$Camada' não é particionada por alimentador." }
    New-Item -ItemType Directory -Force -Path $config.Pasta | Out-Null

    $kmzArquivos = @($Arquivos | Where-Object { $_.FileName -and $_.FileName.ToLower().EndsWith(".kmz") })
    if ($kmzArquivos.Count -eq 0) {
        throw "Nenhum arquivo .kmz recebido. Envie um ou mais arquivos '.kmz' (um por alimentador)."
    }

    $indice = Read-IndiceAlimentadores -Pasta $config.Pasta
    $totalArquivos = $kmzArquivos.Count
    $totalPoligonos = 0
    $alimentadoresGravados = 0
    $rejeitados = 0
    $errosDetalhe = New-Object System.Collections.Generic.List[object]
    $i = 0
    # TUDO dentro deste foreach está protegido por um try/catch por arquivo
    # (pedido do Mario, depois de um .kmz real travar o Controller inteiro):
    # um .kmz com nome fora do padrão, XML malformado, caminho de saída
    # inválido (alimentador com caractere que o Windows não aceita em nome
    # de arquivo) ou qualquer outro erro específico DAQUELE arquivo não pode
    # derrubar o lote inteiro nem, pior, travar o processo do Controller —
    # só conta como rejeitado e segue pro próximo. Antes só a LEITURA
    # (Read-KmzPlacemarks) tinha essa proteção; a GRAVAÇÃO (Write-
    # FeatureCollectionPoligono) e a atualização do índice ficavam de fora,
    # então um erro ali (ex.: nome de arquivo inválido) subia sem ser pego
    # aqui dentro — ainda seria pego lá em cima por Invoke-
    # ShapefileStreamingUpload, mas só DEPOIS de já ter processado 0
    # arquivos do lote (o erro do primeiro arquivo ruim cancelava os 299
    # restantes do upload).
    foreach ($arq in $kmzArquivos) {
        $i++
        if ($ProgressCallback) {
            & $ProgressCallback @{ fase = "lendo-kmz"; arquivo = $i; total = $totalArquivos; percentual = [Math]::Min(99, [Math]::Round(100.0 * $i / $totalArquivos, 1)) }
        }
        try {
            $leitura = Read-KmzPlacemarks -KmzBytes $arq.Bytes -FileName $arq.FileName
            if (-not $leitura.poligonos -or $leitura.poligonos.Count -eq 0) {
                $rejeitados++
                $motivoVazio = "Nenhum polígono válido encontrado ($($leitura.contagens))."
                Write-Host ("  [kmz] REJEITADO {0}: {1}" -f $arq.FileName, $motivoVazio) -ForegroundColor Red
                $errosDetalhe.Add(@{ arquivo = $arq.FileName; motivo = $motivoVazio })
                continue
            }

            # Sanitiza o código do alimentador antes de usá-lo como nome de
            # arquivo — ele vem do nome do .kmz (controlado pelo usuário) ou
            # do <Document> do KML, então pode trazer espaço, barra ou outro
            # caractere que o Windows não aceita em nome de arquivo
            # (NTFS/FAT: \ / : * ? " < > |). Sem isso, um alimentador com
            # esses caracteres fazia o StreamWriter abaixo lançar uma
            # exceção de "caminho inválido" fora do try/catch que já existia
            # só pra leitura.
            $alimentadorSanitizado = Get-NomeArquivoSeguro ([string]$leitura.alimentador)
            if ([string]::IsNullOrWhiteSpace($alimentadorSanitizado)) {
                $rejeitados++
                Write-Host ("  [kmz] REJEITADO {0}: codigo do alimentador ficou vazio depois de limpar caracteres invalidos." -f $arq.FileName) -ForegroundColor Red
                $errosDetalhe.Add(@{ arquivo = $arq.FileName; motivo = "Código do alimentador ficou vazio depois de limpar caracteres inválidos." })
                continue
            }

            $caminhoSaida = Join-Path $config.Pasta "$alimentadorSanitizado.geojson"
            Write-FeatureCollectionPoligono -Caminho $caminhoSaida -Poligonos $leitura.poligonos -NomeCamada $Camada -ProgressCallback $ProgressCallback -ProgressFase "gravando-$alimentadorSanitizado" | Out-Null

            $indice[$alimentadorSanitizado] = @{ nome = $alimentadorSanitizado; trechos = $leitura.poligonos.Count }
            $totalPoligonos += $leitura.poligonos.Count
            $alimentadoresGravados++
        } catch {
            $rejeitados++
            Write-Host ("  [kmz] REJEITADO {0}: {1} ({2})" -f $arq.FileName, $_.Exception.Message, $_.Exception.GetType().FullName) -ForegroundColor Red
            $errosDetalhe.Add(@{ arquivo = $arq.FileName; motivo = $_.Exception.Message })
            continue
        }

        # Grava o índice a cada arquivo (não só no final do lote inteiro):
        # com 300+ .kmz selecionados de uma vez, se a conexão cair no meio
        # (navegador fechado, rede caiu, etc.) os alimentadores já
        # processados até ali ficam salvos de verdade — sem isso, um lote
        # grande interrompido no meio perdia TUDO, mesmo o que já tinha sido
        # gravado em disco (o .geojson ficava órfão, sem entrada no índice,
        # e Get-AlimentadoresDisponiveisResumo lê o índice pra montar a
        # lista do combo).
        try { Write-IndiceAlimentadores -Pasta $config.Pasta -Indice $indice } catch { }
    }

    # v2.13.17 - o "return @{ ... errosDetalhe = @($errosDetalhe) ... }" de uma
    # vez so derrubava TODO upload de KMZ no fim, DEPOIS de gravar os arquivos,
    # com "System.ArgumentException: Os tipos de argumento nao correspondem"
    # (Windows PowerShell 5.1). A tela via isso como falha, reenviava arquivo
    # por arquivo e desistia apos 5. Agora: array pronto por ToArray() e a
    # resposta montada chave a chave, sem @() sobre a lista de hashtables.
    $detalheArr = $errosDetalhe.ToArray()
    $resultadoKmz = @{}
    $resultadoKmz['alimentadores'] = $alimentadoresGravados
    $resultadoKmz['trechos'] = $totalPoligonos
    $resultadoKmz['rejeitados'] = $rejeitados
    $resultadoKmz['errosDetalhe'] = $detalheArr
    $resultadoKmz['avisoProjecao'] = $null
    $resultadoKmz['particionado'] = $true
    return $resultadoKmz
}
