# =============================================================================
# lib/ShapefileImporter.ps1 — leitura de shapefile BDGD/ANEEL (.shp + .dbf) e
# gravação como GeoJSON, compartilhada entre:
#   - a rota HTTP POST /api/importacao/shapefile (upload pela tela de
#     Importação de Bases, o caminho fácil pra quem não mexe com terminal)
#   - controller/tools/ImportadorShapefileRede.ps1 (linha de comando, pra
#     shapefiles muito grandes ou automação, sem passar pelo navegador)
#
# Parser binário nativo (sem módulos de terceiros). Mudanças em relação ao
# protótipo original por causa do volume real de dados (SSDMT enviado tem
# 427.910 registros):
#   1) usa List<object> em vez de "$array += item" (o += em array do
#      PowerShell recria o array inteiro a cada item).
#   2) a Rede MT é particionada por CTMT (alimentador) na gravação — o mapa
#      nunca carrega a rede inteira de uma vez.
# =============================================================================
#
# Add-Type explícito pro System.IO.Compression: no PowerShell 7+ (pwsh) já
# vem carregado, mas no Windows PowerShell 5.1 (usado pelo iniciar.bat) não
# vem — sem isso, o upload de um shapefile empacotado em .zip falha com
# "Não é possível localizar o tipo [System.IO.Compression.ZipArchiveMode]".
Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue

function Read-DbfBuffer {
    <# -ProgressCallback/-ProgressFase (opcionais): scriptblock chamado
       periodicamente (throttle de 400ms, igual ao Read-XlsxColunas em
       XlsxReader.ps1) com o progresso da leitura — pro upload de shapefile
       poder mostrar a mesma barra de progresso em tempo real que o upload
       de Podas já mostra. #>
    param([byte[]]$Buffer, [scriptblock]$ProgressCallback, [string]$ProgressFase = "lendo-dbf")
    $encoding = [System.Text.Encoding]::GetEncoding(28591)  # ISO-8859-1/Latin-1 — padrão BDGD/ANEEL
    $numRegistros = [System.BitConverter]::ToInt32($Buffer, 4)
    $tamanhoCabecalho = [System.BitConverter]::ToInt16($Buffer, 8)
    $tamanhoRegistro = [System.BitConverter]::ToInt16($Buffer, 10)

    $campos = New-Object System.Collections.Generic.List[object]
    $pos = 32
    while ($Buffer[$pos] -ne 0x0D) {
        $nome = $encoding.GetString($Buffer, $pos, 11).Split([char]0)[0]
        $tamanho = $Buffer[$pos + 16]
        $campos.Add(@{ nome = $nome; tamanho = $tamanho })
        $pos += 32
    }

    $registros = New-Object System.Collections.Generic.List[object]
    $offset = $tamanhoCabecalho
    $ultimoProgresso = [DateTime]::MinValue
    for ($i = 0; $i -lt $numRegistros; $i++) {
        if ($offset + $tamanhoRegistro -gt $Buffer.Length) { break }
        $excluido = ([char]$Buffer[$offset]) -eq '*'
        $campoOffset = $offset + 1
        $valores = @{ __excluido = $excluido }
        foreach ($campo in $campos) {
            $valores[$campo.nome] = $encoding.GetString($Buffer, $campoOffset, $campo.tamanho).Trim()
            $campoOffset += $campo.tamanho
        }
        $registros.Add($valores)
        $offset += $tamanhoRegistro

        if ($ProgressCallback -and $numRegistros -gt 0) {
            $agora = [DateTime]::UtcNow
            if (($agora - $ultimoProgresso).TotalMilliseconds -ge 400) {
                $ultimoProgresso = $agora
                $pct = [Math]::Min(99, [Math]::Round(100.0 * ($i + 1) / $numRegistros, 1))
                & $ProgressCallback @{ fase = $ProgressFase; linha = ($i + 1); total = $numRegistros; percentual = $pct }
            }
        }
    }
    return $registros
}

function Read-ShpBuffer {
    param([byte[]]$Buffer, [scriptblock]$ProgressCallback, [string]$ProgressFase = "lendo-shp")
    $tamanhoArquivoBytes = ([System.BitConverter]::ToInt32(@($Buffer[27], $Buffer[26], $Buffer[25], $Buffer[24]), 0)) * 2
    $pos = 100
    $registros = New-Object System.Collections.Generic.List[object]
    $ultimoProgresso = [DateTime]::MinValue

    while ($pos -lt $tamanhoArquivoBytes -and $pos -lt $Buffer.Length) {
        $conteudoWords = [System.BitConverter]::ToInt32(@($Buffer[$pos+7], $Buffer[$pos+6], $Buffer[$pos+5], $Buffer[$pos+4]), 0)
        $conteudoBytes = $conteudoWords * 2
        $posInicio = $pos + 8
        $tipoShape = [System.BitConverter]::ToInt32($Buffer, $posInicio)
        $geo = $null

        if ($tipoShape -eq 3 -or $tipoShape -eq 5) {
            # Polyline (3) ou Polygon (5) — SIMPLIFICAÇÃO: assume 1 "part" por
            # registro (confirmado nos 427.910 registros do SSDMT enviado).
            $p = $posInicio + 4 + 32
            $numParts  = [System.BitConverter]::ToInt32($Buffer, $p); $p += 4
            $numPoints = [System.BitConverter]::ToInt32($Buffer, $p); $p += 4
            $p += 4 * $numParts
            $pontos = New-Object System.Collections.Generic.List[object]
            for ($i = 0; $i -lt $numPoints; $i++) {
                $x = [System.BitConverter]::ToDouble($Buffer, $p); $p += 8
                $y = [System.BitConverter]::ToDouble($Buffer, $p); $p += 8
                $pontos.Add(@([Math]::Round($y,6), [Math]::Round($x,6)))  # [lat, lng]
            }
            $geo = $pontos
        } elseif ($tipoShape -eq 1) {
            $x = [System.BitConverter]::ToDouble($Buffer, $posInicio + 4)
            $y = [System.BitConverter]::ToDouble($Buffer, $posInicio + 12)
            $geo = @([Math]::Round($y,6), [Math]::Round($x,6))
        }

        $registros.Add($geo)
        $pos = $posInicio + $conteudoBytes

        if ($ProgressCallback -and $tamanhoArquivoBytes -gt 0) {
            $agora = [DateTime]::UtcNow
            if (($agora - $ultimoProgresso).TotalMilliseconds -ge 400) {
                $ultimoProgresso = $agora
                $pct = [Math]::Min(99, [Math]::Round(100.0 * $pos / $tamanhoArquivoBytes, 1))
                & $ProgressCallback @{ fase = $ProgressFase; linha = $registros.Count; percentual = $pct }
            }
        }
    }
    return $registros
}

function Test-AvisoProjecao {
    param([string]$PrjTexto)
    if ([string]::IsNullOrWhiteSpace($PrjTexto)) { return $null }
    if ($PrjTexto -match 'PROJCS' -and $PrjTexto -notmatch 'GEOGCS') {
        return "O .prj indica um sistema de coordenadas PROJETADO (metros), não geográfico (graus). As coordenadas precisam ser convertidas antes de plotar no Leaflet."
    }
    return $null
}

function Get-CamadaConfig {
    <# Decide onde e como gravar cada camada de rede.

       v2.11.3 - BT e AT viraram particionadas por alimentador (CTMT), igual
       a MT, reserva_legal e app: até aqui elas eram tratadas como
       "ilustrativas" (gravadas num arquivo único, geo/rede_bt.geojson /
       geo/rede_at.geojson) porque ninguém tinha subido o shapefile real
       ainda. Assim que o Mario importou a BT de verdade, o arquivo único
       passou de 100MB+ - e GET /manutencao/camadas lia (Get-Content +
       ConvertFrom-Json) e devolvia esse arquivo INTEIRO a cada chamada,
       mesmo quando o pedido era só de outra coisa (um alimentador de MT,
       Reserva Legal, APP) - ver o comentário em "camadas" (manutencao.ps1).
       Isso sozinho já travava o Controller (single-threaded) tempo
       suficiente pra estourar o timeout do navegador em QUALQUER outro
       pedido concorrente ("signal is aborted without reason" na Rede MT/BT
       e na aba VERA de Gestão de Bases, reportado pelo Mario: "tu não
       separou a bt igual a mt, tem 1 arquivo de mais de 100mb pra carregar
       de uma só vez"). Particionando BT/AT do mesmo jeito que MT, cada
       alimentador vira seu próprio arquivo pequeno, carregado só quando
       selecionado (ou via streaming no "Todos") - nunca mais um GET comum
       lendo uma centena de MB de uma vez só.

       reserva_legal/app (polígonos de KMZ — Reserva Legal e Área de
       Preservação Permanente, um .kmz por alimentador: "Trecho_<ALIM>_RL.kmz"
       / "..._APP.kmz") seguem o mesmo esquema particionado — cada upload só
       grava/atualiza o(s) alimentador(es) enviado(s) (base incremental —
       subir um novo .kmz nunca apaga os outros já carregados), e
       Get-AlimentadoresCarregados/Remove-AlimentadorCarregado (abaixo) já
       são genéricas o bastante pra funcionar com todas elas sem nenhuma
       mudança, só por estarem aqui. #>
    param([string]$Camada, [string]$GeoRoot)
    switch ($Camada) {
        "rede_media_tensao" { return @{ Particionado = $true; Pasta = (Join-Path $GeoRoot "rede_mt") } }
        "rede_baixa_tensao" { return @{ Particionado = $true; Pasta = (Join-Path $GeoRoot "rede_bt") } }
        "rede_alta_tensao"  { return @{ Particionado = $true; Pasta = (Join-Path $GeoRoot "rede_at") } }
        "reserva_legal"     { return @{ Particionado = $true; Pasta = (Join-Path $GeoRoot "reserva_legal") } }
        "app"               { return @{ Particionado = $true; Pasta = (Join-Path $GeoRoot "app") } }
        default { throw "Camada de rede desconhecida: $Camada" }
    }
}

function Read-IndiceAlimentadores {
    <# _index.json em geo/rede_mt/: mapa simples { "<CTMT>": "<nome do
       alimentador>" }, pra popular o seletor da tela sem precisar abrir
       cada .geojson (alguns têm dezenas de milhares de trechos). #>
    param([string]$Pasta)
    $caminho = Join-Path $Pasta "_index.json"
    if (-not (Test-Path $caminho)) { return @{} }
    try {
        $obj = Get-Content $caminho -Raw -Encoding UTF8 | ConvertFrom-Json
        $indice = @{}
        foreach ($prop in $obj.PSObject.Properties) { $indice[$prop.Name] = $prop.Value }
        return $indice
    } catch { return @{} }
}
function Write-IndiceAlimentadores {
    param([string]$Pasta, [hashtable]$Indice)
    $caminho = Join-Path $Pasta "_index.json"
    $Indice | ConvertTo-Json -Depth 3 -Compress | Set-Content -Path $caminho -Encoding utf8
}

function Get-MetrosTotaisDeTrechos {
    <# v2.12.0 - soma do COMP (metros) de uma lista de trechos ja em memoria
       (os mesmos [ordered]@{ comp = ... } que Write-FeatureCollectionRede
       recebe). Chamada na hora do import, quando os trechos de cada
       alimentador ja estao na mao - gravar esse total no _index.json custa
       quase nada ali e poupa reabrir todos os .geojson depois. #>
    param($Trechos)
    $soma = 0.0
    foreach ($t in $Trechos) { $soma += [double]$t.comp }
    return [math]::Round($soma, 1)
}

function ConvertTo-JsonTextoEscapado {
    <# Escape manual de string pra JSON — usado só dentro de
       Write-FeatureCollectionRede (ver abaixo), que não passa mais por
       ConvertTo-Json pra evitar o custo dela em coleções grandes. #>
    param([string]$Texto)
    if ([string]::IsNullOrEmpty($Texto)) { return "" }
    $sb = [System.Text.StringBuilder]::new($Texto.Length + 8)
    foreach ($ch in $Texto.ToCharArray()) {
        switch ($ch) {
            '"'  { [void]$sb.Append('\"') }
            '\'  { [void]$sb.Append('\\') }
            "`n" { [void]$sb.Append('\n') }
            "`r" { [void]$sb.Append('\r') }
            "`t" { [void]$sb.Append('\t') }
            default {
                if ([int][char]$ch -lt 0x20) { [void]$sb.Append([string]::Format("\u{0:x4}", [int][char]$ch)) }
                else { [void]$sb.Append($ch) }
            }
        }
    }
    return $sb.ToString()
}

function Write-FeatureCollectionRede {
    <# Serializa e grava um FeatureCollection de trechos de rede direto em
       texto, via StreamWriter, SEM passar pelo ConvertTo-Json -Depth 8 que
       o código usava antes.

       Motivo da troca - é a causa raiz do "signal is aborted without
       reason"/"estourar o buffer" que voltou a acontecer na Rede MT (e que
       ia acontecer também na BT/AT, do mesmo tamanho, assim que alguém
       tentasse importar as de verdade): ConvertTo-Json em coleções com
       dezenas/centenas de milhares de objetos aninhados é visivelmente
       lento no PowerShell (percorre tudo via reflection antes de devolver
       qualquer coisa), e enquanto ele roda NENHUM progresso é reportado -
       cada gravação de um alimentador grande (MT) ou da camada inteira
       (BT/AT, que não era particionada) podia sozinha passar dos 120s de
       silêncio que o navegador aguenta (stallMs em apiUploadFormDataStream),
       mesmo com toda a throttling de progresso já existente nas fases de
       LEITURA. Escrever o texto JSON manualmente, feature por feature, com
       progresso a cada 400ms durante a própria gravação, tira esse silêncio
       do meio - não interessa o tamanho do alimentador ou da camada, sempre
       tem alguma linha de progresso saindo.

       -PorAlimentador: dicionário ctmt -> List[trecho]. Pode conter UM
       alimentador (uso particionado, MT - um arquivo por chave) ou VÁRIOS
       de uma vez (uso arquivo único, BT/AT - todos os grupos indo pro
       mesmo arquivo, como sempre foi, só que agora com progresso real). #>
    param(
        [Parameter(Mandatory)][string]$Caminho,
        [Parameter(Mandatory)]$PorAlimentador,
        [Parameter(Mandatory)][string]$NomeCamada,
        [scriptblock]$ProgressCallback,
        [string]$ProgressFase = "gravando"
    )
    $total = 0
    foreach ($ctmt in $PorAlimentador.Keys) { $total += $PorAlimentador[$ctmt].Count }

    $sw = New-Object System.IO.StreamWriter($Caminho, $false, (New-Object System.Text.UTF8Encoding($false)))
    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    try {
        $sw.Write('{"type":"FeatureCollection","name":"')
        $sw.Write((ConvertTo-JsonTextoEscapado $NomeCamada))
        $sw.Write('","crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3:CRS84"}},"features":[')

        $escritos = 0
        $primeiro = $true
        $ultimoProgresso = [DateTime]::MinValue
        foreach ($ctmt in $PorAlimentador.Keys) {
            $ctmtEscapado = ConvertTo-JsonTextoEscapado $ctmt
            $nomeAlimEscapadoCache = @{}
            foreach ($t in $PorAlimentador[$ctmt]) {
                if (-not $primeiro) { $sw.Write(',') }
                $primeiro = $false

                $sw.Write('{"type":"Feature","properties":{"COD_ID":"')
                $sw.Write((ConvertTo-JsonTextoEscapado ([string]$t.id)))
                $sw.Write('","CTMT":"')
                $sw.Write($ctmtEscapado)
                $sw.Write('",')
                if ([string]::IsNullOrWhiteSpace($t.nomeAlimentador)) {
                    $sw.Write('"NOM_ALIM":null,"CT_COD_OP":null,')
                } else {
                    if (-not $nomeAlimEscapadoCache.ContainsKey($t.nomeAlimentador)) {
                        $nomeAlimEscapadoCache[$t.nomeAlimentador] = ConvertTo-JsonTextoEscapado $t.nomeAlimentador
                    }
                    $nomeEsc = $nomeAlimEscapadoCache[$t.nomeAlimentador]
                    $sw.Write('"NOM_ALIM":"'); $sw.Write($nomeEsc); $sw.Write('","CT_COD_OP":"'); $sw.Write($nomeEsc); $sw.Write('",')
                }
                $sw.Write('"SUB":"'); $sw.Write((ConvertTo-JsonTextoEscapado ([string]$t.sub))); $sw.Write('",')
                $sw.Write('"FAS_CON":"'); $sw.Write((ConvertTo-JsonTextoEscapado ([string]$t.fases))); $sw.Write('",')
                $sw.Write('"TIP_CND":"'); $sw.Write((ConvertTo-JsonTextoEscapado ([string]$t.cond))); $sw.Write('",')
                $sw.Write('"COMP":'); $sw.Write($t.comp.ToString($inv))
                $sw.Write('},"geometry":{"type":"LineString","coordinates":[')

                $primeiroPonto = $true
                foreach ($pt in $t.pts) {
                    if (-not $primeiroPonto) { $sw.Write(',') }
                    $primeiroPonto = $false
                    $sw.Write('['); $sw.Write($pt[1].ToString($inv)); $sw.Write(','); $sw.Write($pt[0].ToString($inv)); $sw.Write(']')
                }
                $sw.Write(']}}')

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
        }
        $sw.Write(']}')
    } finally {
        $sw.Flush()
        $sw.Close()
    }
    return $total
}

function Get-NomeAlimentadorAttr {
    <# O nome curto do alimentador (ex.: "V-A1", "P1-A1") vem, na BDGD real,
       do campo CT_COD_OP ("código operacional do circuito"). NOM_ALIM/NOME
       são mantidos como fallback caso apareçam em bases mais antigas ou
       customizadas — na prática, para os arquivos reais testados, é sempre
       o CT_COD_OP que traz esse código. #>
    param($Attr)
    foreach ($campo in @('CT_COD_OP', 'NOM_ALIM', 'NOME')) {
        $valor = $Attr[$campo]
        if (-not [string]::IsNullOrWhiteSpace($valor)) { return $valor }
    }
    return $null
}

function Import-ShapefileRede {
    <# Núcleo do importador: recebe os bytes do .shp/.dbf/.prj já em memória
       (vieram de um upload HTTP ou foram lidos de disco pelo script de
       linha de comando — não importa a origem) e grava o(s) GeoJSON de
       saída. Devolve um resumo (alimentadores, trechos, rejeitados, aviso
       de projeção) pra API/CLI mostrarem pro usuário o que aconteceu. #>
    param(
        [Parameter(Mandatory)][byte[]]$ShpBytes,
        [Parameter(Mandatory)][byte[]]$DbfBytes,
        [string]$PrjTexto,
        [Parameter(Mandatory)][string]$Camada,
        [Parameter(Mandatory)][string]$GeoRoot,
        [scriptblock]$ProgressCallback
    )

    $avisoProjecao = Test-AvisoProjecao -PrjTexto $PrjTexto
    $config = Get-CamadaConfig -Camada $Camada -GeoRoot $GeoRoot

    $geometrias = Read-ShpBuffer -Buffer $ShpBytes -ProgressCallback $ProgressCallback -ProgressFase "lendo-shp"
    $atributos  = Read-DbfBuffer -Buffer $DbfBytes -ProgressCallback $ProgressCallback -ProgressFase "lendo-dbf"

    $porAlimentador = @{}
    $rejeitados = 0
    $ultimoProgresso = [DateTime]::MinValue
    for ($i = 0; $i -lt $atributos.Count; $i++) {
        $attr = $atributos[$i]
        $geo = if ($i -lt $geometrias.Count) { $geometrias[$i] } else { $null }
        if (-not $geo -or $attr.__excluido) { $rejeitados++; continue }

        $ctmt = Get-NomeArquivoSeguro ([string]$attr['CTMT'])
        if ([string]::IsNullOrWhiteSpace($ctmt)) { $ctmt = '_sem_alimentador' }
        if (-not $porAlimentador.ContainsKey($ctmt)) { $porAlimentador[$ctmt] = New-Object System.Collections.Generic.List[object] }

        $compTexto = $attr['COMP']
        $compValor = 0.0
        [double]::TryParse($compTexto, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$compValor) | Out-Null

        $porAlimentador[$ctmt].Add([ordered]@{
            id = $attr['COD_ID']; sub = $attr['SUB']; fases = $attr['FAS_CON']
            cond = $attr['TIP_CND']; comp = $compValor; nomeAlimentador = (Get-NomeAlimentadorAttr -Attr $attr); pts = $geo
        })

        # Sem isto, num arquivo real (SSDMT: 427.910 registros) este laço
        # sozinho podia rodar minutos em silêncio — o navegador desiste
        # depois de 60s sem nenhuma linha de progresso (stall timeout em
        # apiUploadFormDataStream), mesmo com o Controller trabalhando
        # normalmente. Mesmo throttle de 400ms das outras fases.
        if ($ProgressCallback -and $atributos.Count -gt 0) {
            $agora = [DateTime]::UtcNow
            if (($agora - $ultimoProgresso).TotalMilliseconds -ge 400) {
                $ultimoProgresso = $agora
                $pct = [Math]::Min(99, [Math]::Round(100.0 * ($i + 1) / $atributos.Count, 1))
                & $ProgressCallback @{ fase = "cruzando"; linha = ($i + 1); total = $atributos.Count; percentual = $pct }
            }
        }
    }

    $totalTrechos = $atributos.Count - $rejeitados

    if ($config.Particionado) {
        New-Item -ItemType Directory -Force -Path $config.Pasta | Out-Null
        $totalArquivos = 0
        $totalAlimentadores = $porAlimentador.Keys.Count
        $indice = Read-IndiceAlimentadores -Pasta $config.Pasta
        $ultimoProgressoArquivo = [DateTime]::MinValue
        foreach ($ctmt in $porAlimentador.Keys) {
            $caminhoSaida = Join-Path $config.Pasta "$ctmt.geojson"
            # Write-FeatureCollectionRede escreve o JSON direto (StreamWriter),
            # sem passar por ConvertTo-Json -Depth 8 — ver o comentário dela
            # pra causa raiz do "signal is aborted without reason"/"buffer"
            # que essa troca resolve. O progresso aqui é DUPLO: o dela por
            # trecho escrito (dentro de um alimentador grande) e este por
            # arquivo concluído (entre alimentadores) — junto, nunca fica
            # mais de 400ms em silêncio, não importa o tamanho.
            $qtdTrechos = Write-FeatureCollectionRede -Caminho $caminhoSaida -PorAlimentador @{ $ctmt = $porAlimentador[$ctmt] } `
                -NomeCamada "${Camada}_$ctmt" -ProgressCallback $ProgressCallback -ProgressFase "gravando"
            $totalArquivos++

            if ($ProgressCallback -and $totalAlimentadores -gt 0) {
                $agora = [DateTime]::UtcNow
                if (($agora - $ultimoProgressoArquivo).TotalMilliseconds -ge 400 -or $totalArquivos -eq $totalAlimentadores) {
                    $ultimoProgressoArquivo = $agora
                    $pct = [Math]::Min(99, [Math]::Round(100.0 * $totalArquivos / $totalAlimentadores, 1))
                    & $ProgressCallback @{ fase = "gravando"; arquivo = "$totalArquivos de $totalAlimentadores alimentadores"; linha = $totalArquivos; total = $totalAlimentadores; percentual = $pct }
                }
            }

            # nome/código do alimentador (campo CT_COD_OP do .dbf, com fallback
            # para NOM_ALIM/NOME) e o total de trechos guardados à parte, num
            # índice pequeno — assim listar os alimentadores disponíveis (tela
            # de Gerenciar Camadas) não exige reabrir cada .geojson (alguns têm
            # dezenas de milhares de trechos) só pra descobrir o nome/contagem.
            $primeiroComNome = $porAlimentador[$ctmt] | Where-Object { -not [string]::IsNullOrWhiteSpace($_.nomeAlimentador) } | Select-Object -First 1
            $nomeIndice = if ($primeiroComNome) { $primeiroComNome.nomeAlimentador } else { $ctmt }
            # v2.12.0 - "metros" (soma do COMP de todos os trechos desse
            # alimentador) tambem vai pro indice, pra que o resumo de Km de
            # rede (Visao Geral) seja somado a partir dos _index.json
            # pequenos, sem reabrir nenhum .geojson - ver Get-ResumoKmDeRede.
            # v2.13.27 - um mesmo CTMT pode trazer trechos com CT_COD_OP diferentes
            # (ex.: BBRAND34 e TO-A1 no CTMT 408076). O indice guarda TODOS os
            # nomes distintos pra o combo e a busca acharem qualquer um deles.
            $setNomes = New-Object 'System.Collections.Generic.SortedSet[string]'
            foreach ($tr in $porAlimentador[$ctmt]) { $nm = [string]$tr.nomeAlimentador; if (-not [string]::IsNullOrWhiteSpace($nm)) { [void]$setNomes.Add($nm.Trim()) } }
            $nomesDistintos = @($setNomes)
            $indice[$ctmt] = @{ nome = $nomeIndice; nomes = $nomesDistintos; trechos = $qtdTrechos; metros = (Get-MetrosTotaisDeTrechos -Trechos $porAlimentador[$ctmt]) }
        }
        Write-IndiceAlimentadores -Pasta $config.Pasta -Indice $indice
        return @{ alimentadores = $totalArquivos; trechos = $totalTrechos; rejeitados = $rejeitados; avisoProjecao = $avisoProjecao; particionado = $true }
    } else {
        $pastaPai = Split-Path $config.ArquivoUnico -Parent
        New-Item -ItemType Directory -Force -Path $pastaPai | Out-Null
        # BT/AT eram gravadas com ConvertTo-Json -Depth 8 numa coleção ÚNICA
        # com TODOS os alimentadores juntos, sem nenhum progresso durante a
        # gravação em si (só um "99%" antes de começar) - pra uma base real
        # do tamanho da MT (a BT pode ser desse tamanho ou maior), esse
        # silêncio sozinho já estourava o stall timeout do navegador. Agora
        # usa o mesmo escritor rápido da MT, com progresso a cada trecho.
        Write-FeatureCollectionRede -Caminho $config.ArquivoUnico -PorAlimentador $porAlimentador `
            -NomeCamada $Camada -ProgressCallback $ProgressCallback -ProgressFase "gravando" | Out-Null
        return @{ alimentadores = $porAlimentador.Keys.Count; trechos = $totalTrechos; rejeitados = $rejeitados; avisoProjecao = $avisoProjecao; particionado = $false }
    }
}

function Get-NomeArquivoSeguro {
    <# v2.13.8 - transforma um codigo de alimentador (CTMT, nome de .kmz...) em
       algo que o Windows aceita como nome de arquivo. O CTMT do SSDBT real traz
       valores com caracteres que NTFS nao aceita (\ / : * ? " < > |) ou de
       controle (ex.: NUL do preenchimento do .dbf), e o StreamWriter lancava
       "Caracteres invalidos no caminho". A chave do alimentador, o arquivo e o
       indice passam todos a usar este mesmo valor limpo. #>
    param([string]$Texto)
    if ($null -eq $Texto) { return "" }
    $t = [regex]::Replace($Texto, '[\x00-\x1F\x7F]', '')
    $t = [regex]::Replace($t, '[\\/:*?"<>|]', '_')
    $t = $t.Trim().TrimEnd('.')
    if ($t -match '^(?i)(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$') { $t = "_$t" }
    return $t
}

function Get-ChaveAlimentadorFeature {
    <# Mesmo critério usado na hora de importar (CTMT, com '_sem_alimentador'
       de fallback) — aplicado aqui em cima de uma feature já gravada no
       GeoJSON (usado só pelas camadas de arquivo único, BT/AT, que não têm
       um índice separado por alimentador como a MT particionada tem). #>
    param($Properties)
    $chave = Get-NomeArquivoSeguro ([string]$Properties.CTMT)
    if ([string]::IsNullOrWhiteSpace($chave)) { $chave = '_sem_alimentador' }
    return $chave
}

function Get-AlimentadoresCarregados {
    <# Lista os alimentadores já carregados de uma camada, pra tela de
       "Gerenciar Camadas" (deletar um alimentador importado por engano ou
       pela metade, sem precisar mexer em arquivo). Pra MT (particionada) lê
       o índice pequeno gravado na hora do import; pra AT/BT (arquivo único)
       agrupa as features do próprio GeoJSON pelo mesmo critério (CTMT). #>
    param([Parameter(Mandatory)][string]$Camada, [Parameter(Mandatory)][string]$GeoRoot)
    $config = Get-CamadaConfig -Camada $Camada -GeoRoot $GeoRoot
    $lista = New-Object System.Collections.Generic.List[object]

    if ($config.Particionado) {
        if (-not (Test-Path $config.Pasta)) { return @() }
        $indice = Read-IndiceAlimentadores -Pasta $config.Pasta
        $chavesVistas = New-Object System.Collections.Generic.HashSet[string]
        foreach ($chave in @($indice.Keys)) {
            $caminho = Join-Path $config.Pasta "$chave.geojson"
            if (-not (Test-Path $caminho)) { continue }
            $entrada = $indice[$chave]
            # formato antigo do índice guardava só o nome (string); o atual
            # guarda @{nome; trechos} — os dois são aceitos na leitura.
            $nome = if ($entrada -is [string]) { $entrada } elseif ($entrada.nome) { $entrada.nome } else { $chave }
            $trechos = if ($entrada -isnot [string] -and $entrada.trechos) { $entrada.trechos } else {
                try { @((Get-Content $caminho -Raw -Encoding UTF8 | ConvertFrom-Json).features).Count } catch { $null }
            }
            $lista.Add(@{ chave = $chave; nome = $nome; trechos = $trechos })
            [void]$chavesVistas.Add($chave)
        }
        # Auto-cura: um .geojson gravado antes desta tela existir (ou por um
        # import de linha de comando, que também usa esta mesma pasta) pode
        # não estar no índice — sem isso ficaria escondido, importado mas
        # impossível de apagar pela tela. Cobre qualquer arquivo órfão.
        foreach ($arquivo in @(Get-ChildItem -Path $config.Pasta -Filter "*.geojson" -File -ErrorAction SilentlyContinue)) {
            $chaveArquivo = [System.IO.Path]::GetFileNameWithoutExtension($arquivo.Name)
            if ($chavesVistas.Contains($chaveArquivo)) { continue }
            $trechos = $null
            try { $trechos = @((Get-Content $arquivo.FullName -Raw -Encoding UTF8 | ConvertFrom-Json).features).Count } catch { }
            $lista.Add(@{ chave = $chaveArquivo; nome = $chaveArquivo; trechos = $trechos })
        }
    } else {
        if (-not (Test-Path $config.ArquivoUnico)) { return @() }
        try { $geo = Get-Content $config.ArquivoUnico -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return @() }
        $grupos = @{}
        foreach ($f in @($geo.features)) {
            $props = $f.properties
            $chave = Get-ChaveAlimentadorFeature -Properties $props
            if (-not $grupos.ContainsKey($chave)) {
                $nome = $null
                foreach ($campo in @('CT_COD_OP', 'NOM_ALIM', 'NOME')) {
                    $valor = $props.$campo
                    if (-not [string]::IsNullOrWhiteSpace($valor)) { $nome = $valor; break }
                }
                $grupos[$chave] = @{ chave = $chave; nome = $(if ($nome) { $nome } else { $chave }); trechos = 0 }
            }
            $grupos[$chave].trechos++
        }
        foreach ($g in $grupos.Values) { $lista.Add($g) }
    }
    return @($lista | Sort-Object nome)
}

function Remove-AlimentadorCarregado {
    <# Remove um alimentador já carregado de uma camada (botão "X" da tela
       Gerenciar Camadas). Pra MT: apaga o .geojson do alimentador e tira a
       entrada do índice. Pra AT/BT (arquivo único): filtra as features
       daquele alimentador de dentro do arquivo e regrava só com o resto — e
       se não sobrar nenhuma feature, apaga o arquivo (a tela volta a mostrar
       "nenhuma camada carregada" pra essa base, igual a antes de importar
       qualquer coisa). #>
    param([Parameter(Mandatory)][string]$Camada, [Parameter(Mandatory)][string]$Chave, [Parameter(Mandatory)][string]$GeoRoot)
    $config = Get-CamadaConfig -Camada $Camada -GeoRoot $GeoRoot

    if ($config.Particionado) {
        $caminho = Join-Path $config.Pasta "$Chave.geojson"
        $existia = Test-Path $caminho
        if ($existia) { Remove-Item $caminho -Force }
        $indice = Read-IndiceAlimentadores -Pasta $config.Pasta
        if ($indice.ContainsKey($Chave)) { $indice.Remove($Chave); $existia = $true }
        Write-IndiceAlimentadores -Pasta $config.Pasta -Indice $indice
        if (-not $existia) { throw "Alimentador '$Chave' não encontrado em $Camada." }
        return
    }

    if (-not (Test-Path $config.ArquivoUnico)) { throw "Nenhuma camada carregada para $Camada." }
    $geo = Get-Content $config.ArquivoUnico -Raw -Encoding UTF8 | ConvertFrom-Json
    $restantes = New-Object System.Collections.Generic.List[object]
    $removidos = 0
    foreach ($f in @($geo.features)) {
        $chaveFeature = Get-ChaveAlimentadorFeature -Properties $f.properties
        if ($chaveFeature -eq $Chave) { $removidos++ } else { $restantes.Add($f) }
    }
    if ($removidos -eq 0) { throw "Alimentador '$Chave' não encontrado em $Camada." }
    if ($restantes.Count -eq 0) {
        Remove-Item $config.ArquivoUnico -Force
    } else {
        $saida = [ordered]@{
            type = "FeatureCollection"; name = $Camada
            crs = @{ type = "name"; properties = @{ name = "urn:ogc:def:crs:OGC:1.3:CRS84" } }
            features = $restantes
        }
        $saida | ConvertTo-Json -Depth 8 -Compress | Set-Content -Path $config.ArquivoUnico -Encoding utf8
    }
}

function Invoke-MigrarCamadaArquivoUnicoParaParticionada {
    <# v2.11.3 - migração de arranque, de uma vez só: converte um
       geo/rede_bt.geojson ou geo/rede_at.geojson antigo (formato
       "arquivo único", de antes da BT/AT virarem particionadas por
       alimentador, igual a MT/Reserva Legal/APP - ver Get-CamadaConfig)
       pra pasta particionada (geo/rede_bt/, geo/rede_at/).

       Chamada 1x na subida do Controller (server.ps1), antes do listener
       abrir pra valer - ver comentário lá. Se o arquivo antigo não existir
       (já migrado antes, ou a camada nunca foi importada nesse formato),
       não faz nada. Depois de migrar com sucesso, apaga o arquivo antigo:
       a pasta nova passa a ser a única fonte de verdade, e assim esta
       função não tenta migrar de novo a cada partida. #>
    param([Parameter(Mandatory)][string]$Camada, [Parameter(Mandatory)][string]$GeoRoot)

    $arquivoAntigo = switch ($Camada) {
        "rede_baixa_tensao" { Join-Path $GeoRoot "rede_bt.geojson" }
        "rede_alta_tensao"  { Join-Path $GeoRoot "rede_at.geojson" }
        default { return }
    }
    if (-not (Test-Path $arquivoAntigo)) { return }

    Write-Host "Migrando $arquivoAntigo (formato antigo, arquivo único) para pasta particionada por alimentador - isso roda só uma vez e pode demorar um pouco num arquivo grande..." -ForegroundColor Yellow

    try {
        $geo = Get-Content $arquivoAntigo -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        Write-Host "Não consegui ler $arquivoAntigo pra migrar (arquivo corrompido?) - deixei como estava, sem apagar nada. Detalhe: $($_.Exception.Message)" -ForegroundColor Red
        return
    }

    $config = Get-CamadaConfig -Camada $Camada -GeoRoot $GeoRoot
    New-Item -ItemType Directory -Force -Path $config.Pasta | Out-Null

    $porAlimentador = @{}
    foreach ($f in @($geo.features)) {
        $props = $f.properties
        if (-not $props) { continue }
        $ctmt = Get-ChaveAlimentadorFeature -Properties $props
        if (-not $porAlimentador.ContainsKey($ctmt)) { $porAlimentador[$ctmt] = New-Object System.Collections.Generic.List[object] }

        $pts = New-Object System.Collections.Generic.List[object]
        if ($f.geometry -and $f.geometry.coordinates) {
            foreach ($coord in @($f.geometry.coordinates)) {
                # GeoJSON grava [lng, lat] - Write-FeatureCollectionRede espera
                # pts como [lat, lng] (mesmo formato que Read-ShpBuffer produz).
                $pts.Add(@([double]$coord[1], [double]$coord[0]))
            }
        }
        $porAlimentador[$ctmt].Add([ordered]@{
            id = $props.COD_ID; sub = $props.SUB; fases = $props.FAS_CON; cond = $props.TIP_CND
            comp = $(if ($null -ne $props.COMP) { [double]$props.COMP } else { 0.0 })
            nomeAlimentador = (Get-NomeAlimentadorAttr -Attr $props); pts = $pts
        })
    }

    $indice = @{}
    foreach ($ctmt in $porAlimentador.Keys) {
        $caminhoSaida = Join-Path $config.Pasta "$ctmt.geojson"
        $qtdTrechos = Write-FeatureCollectionRede -Caminho $caminhoSaida -PorAlimentador @{ $ctmt = $porAlimentador[$ctmt] } -NomeCamada "${Camada}_$ctmt"
        $primeiroComNome = $porAlimentador[$ctmt] | Where-Object { -not [string]::IsNullOrWhiteSpace($_.nomeAlimentador) } | Select-Object -First 1
        $nomeIndice = if ($primeiroComNome) { $primeiroComNome.nomeAlimentador } else { $ctmt }
        $indice[$ctmt] = @{ nome = $nomeIndice; trechos = $qtdTrechos; metros = (Get-MetrosTotaisDeTrechos -Trechos $porAlimentador[$ctmt]) }
    }
    Write-IndiceAlimentadores -Pasta $config.Pasta -Indice $indice

    Remove-Item $arquivoAntigo -Force
    Write-Host "Migração concluída: $($porAlimentador.Keys.Count) alimentador(es) de $Camada agora em $($config.Pasta)." -ForegroundColor Green
}

function Find-ArquivoPorExtensao {
    param([array]$Arquivos, [string]$Extensao)
    return @($Arquivos | Where-Object { $_.FileName -and $_.FileName.ToLower().EndsWith($Extensao) } | Select-Object -First 1)[0]
}

function Import-ShapefileUpload {
    <# Recebe a lista de arquivos que chegaram no POST multipart da tela de
       Importação de Bases — soltos (.shp/.shx/.dbf/.prj) ou dentro de um
       único .zip — e delega para Import-ShapefileRede. #>
    param([Parameter(Mandatory)][array]$Arquivos, [Parameter(Mandatory)][string]$Camada, [Parameter(Mandatory)][string]$GeoRoot, [scriptblock]$ProgressCallback)

    $zipArquivo = Find-ArquivoPorExtensao -Arquivos $Arquivos -Extensao ".zip"
    $shpBytes = $null; $dbfBytes = $null; $prjTexto = $null

    if ($zipArquivo) {
        if ($ProgressCallback) { & $ProgressCallback @{ fase = "descompactando"; percentual = 1 } }
        $ms = New-Object System.IO.MemoryStream(,$zipArquivo.Bytes)
        $zip = [System.IO.Compression.ZipArchive]::new($ms, [System.IO.Compression.ZipArchiveMode]::Read)
        try {
            foreach ($entry in $zip.Entries) {
                $nomeMin = $entry.Name.ToLower()
                if ($nomeMin.EndsWith(".shp")) {
                    $s = $entry.Open(); $buf = New-Object System.IO.MemoryStream; $s.CopyTo($buf); $shpBytes = $buf.ToArray(); $s.Close()
                } elseif ($nomeMin.EndsWith(".dbf")) {
                    $s = $entry.Open(); $buf = New-Object System.IO.MemoryStream; $s.CopyTo($buf); $dbfBytes = $buf.ToArray(); $s.Close()
                } elseif ($nomeMin.EndsWith(".prj")) {
                    $s = $entry.Open(); $sr = New-Object System.IO.StreamReader($s); $prjTexto = $sr.ReadToEnd(); $sr.Close()
                }
            }
        } finally { $zip.Dispose(); $ms.Dispose() }
    } else {
        $shpArquivo = Find-ArquivoPorExtensao -Arquivos $Arquivos -Extensao ".shp"
        $dbfArquivo = Find-ArquivoPorExtensao -Arquivos $Arquivos -Extensao ".dbf"
        $prjArquivo = Find-ArquivoPorExtensao -Arquivos $Arquivos -Extensao ".prj"
        if ($shpArquivo) { $shpBytes = $shpArquivo.Bytes }
        if ($dbfArquivo) { $dbfBytes = $dbfArquivo.Bytes }
        if ($prjArquivo) { $prjTexto = [System.Text.Encoding]::GetEncoding(28591).GetString($prjArquivo.Bytes) }
    }

    if (-not $shpBytes -or -not $dbfBytes) {
        throw "Não encontrei os arquivos .shp e .dbf no que foi enviado. Envie os dois juntos (soltos ou dentro de um .zip)."
    }

    return Import-ShapefileRede -ShpBytes $shpBytes -DbfBytes $dbfBytes -PrjTexto $prjTexto -Camada $Camada -GeoRoot $GeoRoot -ProgressCallback $ProgressCallback
}
