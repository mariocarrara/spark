# =============================================================================
# routes/manutencao.ps1 — Módulo 1: Mapa de Manutenção (Escopo, seção 3)
# =============================================================================

# Cache em memória do resumo de Km de rede (v2.11.3 — ver comentário
# detalhado em Get-ResumoKmDeRede/Clear-KmRedeResumoCache, abaixo, sobre o
# bug que isso corrige: "signal is aborted without reason" na Rede MT/BT e
# na aba VERA da Gestão de Bases). $Script: (não $Global:) porque este
# arquivo é dot-sourced uma única vez por server.ps1 no início do processo
# — a mesma garantia que já vale pros outros caches/estado do Controller.
$Script:KmRedeResumoCache = $null
$Script:KmRedeResumoDigital = $null
# v2.13.15 - cache da resposta de GET /manutencao/os (ver a rota)
$Script:OsRespostaBytes = $null
$Script:OsRespostaChave = ""


function Get-OsRespostaCache {
    <# v2.14.5 - bytes do manutencao_os.json (raw + gzip), recarregados so quando o arquivo muda #>
    $arq = Get-EntityPath -Entity "manutencao_os"
    $info = Get-Item -Path $arq -ErrorAction SilentlyContinue
    $chave = "0"; if ($info) { $chave = "$($info.LastWriteTimeUtc.Ticks)-$($info.Length)" }
    if ($Script:OsRespostaBytes -and $Script:OsRespostaChave -eq $chave) { return $Script:OsRespostaBytes }
    $cronA = [System.Diagnostics.Stopwatch]::StartNew()
    $raw = $null
    if ($info) { $raw = [System.IO.File]::ReadAllBytes($arq) }
    $tLeitura = $cronA.Elapsed.TotalSeconds; $cronA.Restart()
    if (-not $raw -or ([System.Text.Encoding]::UTF8.GetString($raw, 0, [math]::Min(64, $raw.Length))).Trim([char]0xFEFF, ' ', "`r", "`n").Length -eq 0) {
        $raw = [System.Text.Encoding]::UTF8.GetBytes("[]")
    }
    $ms = New-Object System.IO.MemoryStream
    $gz = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionLevel]::Fastest)
    $gz.Write($raw, 0, $raw.Length); $gz.Close()
    $pacote = @{ raw = $raw; gzip = $ms.ToArray() }
    Write-Host ("  [lista de OS] arquivo {0:N1} MB (leitura {1:N1} s) -> compactado {2:N1} MB ({3:N1} s)" -f ($raw.Length/1MB), $tLeitura, ($pacote.gzip.Length/1MB), $cronA.Elapsed.TotalSeconds) -ForegroundColor DarkCyan
    $Script:OsRespostaBytes = $pacote
    $Script:OsRespostaChave = $chave
    return $pacote
}

function Invoke-ManutencaoRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # GET /api/manutencao/os?status=&equipe=&prioridadeEW=&dataInicio=&dataFim=&departamento=
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "os") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Manutenção." } }
        }
        # v2.13.15 - cache da resposta SEM filtros (a que o sistema pede ao
        # entrar). Ler + converter ~50 mil OS a cada pedido levava dezenas de
        # segundos, e como o Controller atende um pedido por vez isso deixava
        # os outros pedidos do login na fila ate estourar o timeout do
        # navegador ("Login ok, mas nao consegui carregar o sistema"). A chave
        # muda sozinha quando manutencao_os.json ou programacao.json mudam
        # (importacao, programar/cancelar etc.), entao nunca devolve dado velho.
        $semFiltros = -not ($Query["status"] -or $Query["equipe"] -or $Query["prioridadeEW"] -or $Query["dataInicio"] -or $Query["dataFim"])
        if ($semFiltros) {
            # v2.14.5 - resposta SEM filtros = o proprio arquivo manutencao_os.json (sem
            # ConvertFrom/To-Json, que levava MINUTOS com ~100 mil OS e travava o login
            # de todo mundo, ja que o Controller atende um pedido por vez), comprimido
            # em gzip e guardado em memoria. O "Programada" (overlay das programacoes)
            # ja e recalculado no navegador (recalcularStatusOS, a partir das programacoes).
            $dadosOs = Get-OsRespostaCache
            if ($Script:ClienteAceitaGzip) { return @{ status = 200; rawBytes = $dadosOs.gzip; gzip = $true } }
            return @{ status = 200; rawBytes = $dadosOs.raw }
        }

        $os = @(Read-JsonModel -Entity "manutencao_os")

        # v2.13.0 - OS vinculada a uma Programacao ATIVA aparece como
        # "Programada" (se estava Pendente / A reprogramar); o status de
        # origem vai em statusBase. Cancelar a programacao simplesmente
        # deixa de aplicar o overlay - a OS volta ao status de origem sem
        # reescrever as dezenas de milhares de OS no disco.
        $osProgramadas = @{}
        foreach ($prog in @(Read-JsonModel -Entity "programacao")) {
            if ($prog.status -eq "Cancelada" -or $prog.status -eq "Concluída") { continue }
            foreach ($oid in @($prog.osIds)) { if ($oid) { $osProgramadas["$oid"] = $true } }
        }
        if ($osProgramadas.Count -gt 0) {
            foreach ($o in $os) {
                if ($osProgramadas.ContainsKey("$($o.id)") -and ($o.statusOS -eq "Pendente" -or $o.statusOS -eq "A reprogramar")) {
                    $o | Add-Member -NotePropertyName statusBase -NotePropertyValue $o.statusOS -Force
                    $o.statusOS = "Programada"
                }
            }
        }

        if ($Query["status"])       { $os = $os | Where-Object { $_.statusOS -eq $Query["status"] } }
        if ($Query["equipe"])       { $os = $os | Where-Object { $_.equipeId -eq $Query["equipe"] } }
        if ($Query["prioridadeEW"]) { $os = $os | Where-Object { "$($_.prioridadeEW)" -eq $Query["prioridadeEW"] } }
        if ($Query["dataInicio"])   { $os = $os | Where-Object { "$($_.dataAbertura)".Substring(0,10) -ge $Query["dataInicio"] } }
        if ($Query["dataFim"])      { $os = $os | Where-Object { "$($_.dataAbertura)".Substring(0,10) -le $Query["dataFim"] } }

        return @{ status = 200; body = @($os) }
    }

    # GET /api/manutencao/camadas
    # Retorna os GeoJSON de reserva legal, APP e rede BT/MT/AT (Escopo, 3.5).
    # TODAS particionadas por alimentador (CTMT) - MT, Reserva Legal, APP e,
    # desde a v2.11.3, também BT e AT (ver Get-CamadaConfig). O cliente pede
    # o CTMT específico de cada camada via ?ctmt=/?rl=/?app=/?bt=/?at=, e só
    # carrega todos os alimentadores de uma vez (?ctmt=__todos__, etc.)
    # através da rota separada em streaming Invoke-CamadaTodosStream
    # (chamada direto pelo server.ps1, não passa por aqui) — centenas de
    # milhares de trechos de uma vez é pesado pro navegador de qualquer
    # jeito, mas pelo menos não derruba mais o Controller como antes (ver
    # comentário de Invoke-CamadaTodosStream).
    #
    # IMPORTANTE (bug corrigido na v2.11.3): até aqui, BT e AT eram um
    # arquivo único inteiro (geo/rede_bt.geojson/rede_at.geojson),
    # carregado e devolvido na ÍNTEGRA a cada chamada desta rota — mesmo
    # quando o pedido era só de um alimentador de MT, ou de Reserva
    # Legal/APP. Assim que a BT real foi importada (100MB+), isso sozinho
    # travava o Controller tempo suficiente pra estourar o timeout do
    # navegador em QUALQUER outro pedido concorrente ("signal is aborted
    # without reason" na Rede MT/BT e na aba VERA de Gestão de Bases,
    # reportado pelo Mario). Agora BT/AT seguem o MESMO esquema por
    # alimentador que MT/Reserva Legal/APP já usavam — nenhum arquivo
    # grande é lido à toa.
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "camadas") {
        # v2.12.0 - esta rota agora so devolve as LISTAS de alimentadores
        # disponiveis (ctmt/nome) de cada camada, pra montar os combos. O
        # GeoJSON de UM alimentador (?ctmt=/?rl=/?app=/?bt=/?at=) e atendido
        # direto pelo server.ps1 via Invoke-CamadaAlimentadorRaw (arquivo
        # entregue como esta, sem ConvertFrom-Json/ConvertTo-Json no meio) -
        # antes, cada pedido de um alimentador ainda recalculava as outras 4
        # listas e passava o GeoJSON por parse + serializacao, o que
        # multiplicado por centenas de alimentadores (pre-carga em segundo
        # plano do mapa) seria lento demais.
        $geoRoot = Join-Path $PSScriptRoot "..\..\geo" | Resolve-Path | Select-Object -ExpandProperty ProviderPath
        return @{ status = 200; body = @{
            rede_mt_disponiveis       = @(Get-AlimentadoresDisponiveisResumo -Camada "rede_media_tensao" -GeoRoot $geoRoot -Pasta "rede_mt")
            reserva_legal_disponiveis = @(Get-AlimentadoresDisponiveisResumo -Camada "reserva_legal" -GeoRoot $geoRoot -Pasta "reserva_legal")
            app_disponiveis           = @(Get-AlimentadoresDisponiveisResumo -Camada "app" -GeoRoot $geoRoot -Pasta "app")
            rede_bt_disponiveis       = @(Get-AlimentadoresDisponiveisResumo -Camada "rede_baixa_tensao" -GeoRoot $geoRoot -Pasta "rede_bt")
            rede_at_disponiveis       = @(Get-AlimentadoresDisponiveisResumo -Camada "rede_alta_tensao" -GeoRoot $geoRoot -Pasta "rede_at")
        } }
    }

    # GET /api/manutencao/localidades-mapa — cruzamento alimentador -> município
    # -> polo/regional, pro filtro "Polo"/"Regional" do Mapa de Manutenção
    # (pedido do Mario: "no mapa de manutenção se você conseguir cruzar a
    # localidade e o polo é bom aparecer os filtros do lado"). O front-end
    # usa isso pra descobrir o município/regional de cada OS a partir do seu
    # alimentador (OS não tem município gravado direto - ver model/manutencao_os.json).
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "localidades-mapa") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Manutenção." } }
        }
        # v2.13.0 - Polo/Regional vem do cruzamento Protecao (PROT. ELEMENTO 2
        # -> alimentador) x Vao (protecao -> polo/regional); ver
        # Update-MapaAlimentadorPolo (Geografia.ps1). "porAlimentadorRegional"
        # evita depender do D_Localidade so pra achar a regional.
        $poloRegional = Get-MapaAlimentadorPolo
        $regionalPorAlim = @{}
        foreach ($k in $poloRegional.Keys) { if ($poloRegional[$k].regional) { $regionalPorAlim[$k] = $poloRegional[$k].regional } }
        return @{ status = 200; body = @{
            porAlimentador = Get-MapaAlimentadorMunicipio
            porMunicipio = Get-MapaMunicipioLocalidade
            regionalPorAlimentador = $regionalPorAlim
        } }
    }

    # GET /api/manutencao/km-rede-resumo — totais de Km de rede (MT/AT/BT) e
    # por cidade, pros gráficos da Visão Geral (pedido do Mario: "os KM de
    # rede, bt/mt/at por cidade essas coisas pode colocar uns gráficos na
    # visão geral"). Não é streaming — é só um resumo agregado (poucos
    # números), diferente de /camadas (que devolve o GeoJSON inteiro).
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "km-rede-resumo") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Manutenção." } }
        }
        $geoRoot = Join-Path $PSScriptRoot "..\..\geo" | Resolve-Path | Select-Object -ExpandProperty ProviderPath
        return @{ status = 200; body = (Get-ResumoKmDeRede -GeoRoot $geoRoot) }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/manutencao." } }
}

function Clear-KmRedeResumoCache {
    <# Zera so a copia em memoria do resumo de Km de rede. Desde a v2.12.0
       isso e so um "esquece o que sabe" - quem decide se o resumo gravado em
       disco (geo/_resumo_km_rede.json) ainda vale e a impressao digital
       (ver Get-ImpressaoDigitalResumoKm), entao chamar isto a mais nunca
       causa resultado errado, so um recalculo desnecessario. #>
    $Script:KmRedeResumoCache = $null
    $Script:KmRedeResumoDigital = $null
}

function Update-ResumoKmDeRedeAposImportacao {
    <# v2.12.0 - chamada ao FIM de cada import/exclusao que muda o resumo
       (shapefile de rede, Protecao, "Apagar tudo", apagar alimentador):
       esquece o cache e ja REGRAVA geo/_resumo_km_rede.json na hora, pra
       que ninguem pague essa conta depois (pedido do Mario: "escreve esse
       arquivo no upload"). Nunca derruba o import por causa disso - se
       falhar, o proximo GET /manutencao/km-rede-resumo recalcula sozinho. #>
    Clear-KmRedeResumoCache
    try {
        $geoRoot = Join-Path $PSScriptRoot "..\..\geo"
        if (Test-Path $geoRoot) {
            Update-ResumoKmDeRede -GeoRoot (Resolve-Path $geoRoot | Select-Object -ExpandProperty ProviderPath) | Out-Null
        }
    } catch {
        Write-Host "Aviso: nao consegui regravar o resumo de Km de rede agora (recalcula sozinho na proxima visita a Visao Geral). Detalhe: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

function Get-ImpressaoDigitalResumoKm {
    <# Texto curto que muda sempre que QUALQUER coisa que entra na conta do
       resumo muda: os 3 _index.json de rede (MT/BT/AT - tamanho + data de
       cada um) e o proprio protecao.json (que decide o municipio de cada
       alimentador). O resumo gravado em disco leva essa impressao junto; ao
       ler, se a impressao atual for diferente da gravada, o arquivo esta
       velho e e recalculado. Assim o arquivo nunca fica desatualizado nem
       quando alguem mexe nos dados por fora (apagar alimentador, editar a
       Protecao pela Gestao de Bases...) - sem depender de lembrar de
       invalidar em cada ponto do sistema. #>
    param([Parameter(Mandatory)][string]$GeoRoot)
    $partes = New-Object System.Collections.Generic.List[string]
    foreach ($pasta in @('rede_mt', 'rede_bt', 'rede_at')) {
        $f = Join-Path (Join-Path $GeoRoot $pasta) "_index.json"
        if (Test-Path $f) {
            $i = Get-Item $f
            $partes.Add("${pasta}:$($i.Length):$($i.LastWriteTimeUtc.Ticks)")
        } else {
            $partes.Add("${pasta}:-")
        }
    }
    $prot = Get-EntityPath -Entity "protecao"
    if (Test-Path $prot) {
        $i = Get-Item $prot
        $partes.Add("protecao:$($i.Length):$($i.LastWriteTimeUtc.Ticks)")
    } else {
        $partes.Add("protecao:-")
    }
    return ($partes -join "|")
}

function Get-MetrosDoGeojson {
    <# Soma o COMP (metros) de todos os trechos de UM .geojson de alimentador.
       So usado como plano B, pra alimentadores cujo _index.json ainda nao
       traz "metros" (importados antes da v2.12.0) - o resultado e gravado de
       volta no indice (ver Update-ResumoKmDeRede), entao cada arquivo e
       aberto no maximo UMA vez na vida. #>
    param([Parameter(Mandatory)][string]$Caminho)
    $soma = 0.0
    try {
        $dados = Get-Content $Caminho -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch { return $soma }
    foreach ($feature in @($dados.features)) {
        $props = $feature.properties
        if (-not $props) { continue }
        $comp = ConvertTo-DoubleSeguro -Texto "$(Get-CampoDoRow -Row $props -Campo 'COMP')"
        if ($null -ne $comp) { $soma += $comp }
    }
    return $soma
}

function Update-ResumoKmDeRede {
    <# Calcula o resumo de Km de rede (MT/BT/AT + por cidade) SOMANDO os
       "metros" que cada _index.json ja guarda por alimentador (gravados na
       hora do import - ver Import-ShapefileRede), sem abrir nenhum
       .geojson. Grava o resultado em geo/_resumo_km_rede.json (junto com a
       impressao digital dos dados de origem) e na memoria, e devolve.

       Por que isso existe (pedido do Mario: "criar um arquivo de indice com
       os dados principais, e mais rapido ler o json do que todos os GEO e
       recalcular os dados, escreve esse arquivo no upload"): ate a v2.12.0
       o resumo era recalculado varrendo e fazendo ConvertFrom-Json de TODOS
       os .geojson de MT + BT + AT (centenas de MB) - com o Controller
       single-threaded, isso travava os outros pedidos por dezenas de
       segundos e estourava o timeout do navegador ("signal is aborted
       without reason"). Agora a conta so le arquivos de indice minusculos.

       Alimentador cujo indice nao tem "metros" (base importada antes da
       v2.12.0) e somado UMA vez a partir do proprio .geojson e o total e
       gravado no indice (migracao automatica, feita na subida do
       Controller). Por cidade: so MT, pelo nome do alimentador (CT_COD_OP)
       cruzado com o municipio mais comum da Protecao (Get-MapaAlimentador
       Municipio, Geografia.ps1); alimentador sem Protecao importada cai em
       "naoIdentificadoKm" em vez de ser descartado. #>
    param([Parameter(Mandatory)][string]$GeoRoot)

    $metrosPorCamada = @{ mt = 0.0; bt = 0.0; at = 0.0 }
    $metrosPorCidade = @{}
    $semMunicipioMetros = 0.0
    $temBtAtReal = $false
    $mapaAlimentadorMunicipio = Get-MapaAlimentadorMunicipio

    foreach ($par in @(
        @{ chave = 'mt'; pasta = 'rede_mt' },
        @{ chave = 'bt'; pasta = 'rede_bt' },
        @{ chave = 'at'; pasta = 'rede_at' }
    )) {
        $pasta = Join-Path $GeoRoot $par.pasta
        if (-not (Test-Path $pasta)) { continue }
        $indice = Read-IndiceAlimentadores -Pasta $pasta
        $indiceMudou = $false

        foreach ($arquivo in @(Get-ChildItem $pasta -Filter "*.geojson" -File -ErrorAction SilentlyContinue)) {
            $chave = $arquivo.BaseName
            $entrada = if ($indice.ContainsKey($chave)) { $indice[$chave] } else { $null }
            $nome = $chave
            $trechos = $null
            $metros = $null
            if ($entrada -is [string]) {
                $nome = $entrada
            } elseif ($entrada) {
                if ($entrada.nome) { $nome = $entrada.nome }
                if ($null -ne $entrada.trechos) { $trechos = $entrada.trechos }
                if ($null -ne $entrada.metros) { $metros = [double]$entrada.metros }
            }
            if ($null -eq $metros) {
                $metros = [math]::Round((Get-MetrosDoGeojson -Caminho $arquivo.FullName), 1)
                $indice[$chave] = @{ nome = $nome; trechos = $trechos; metros = $metros }
                $indiceMudou = $true
            }

            $metrosPorCamada[$par.chave] += $metros
            if ($par.chave -ne 'mt') { $temBtAtReal = $true }
            if ($par.chave -eq 'mt') {
                $municipio = if ($nome -and $mapaAlimentadorMunicipio.ContainsKey($nome)) { $mapaAlimentadorMunicipio[$nome] } else { $null }
                if ($municipio) {
                    if (-not $metrosPorCidade.ContainsKey($municipio)) { $metrosPorCidade[$municipio] = 0.0 }
                    $metrosPorCidade[$municipio] = $metrosPorCidade[$municipio] + $metros
                } else {
                    $semMunicipioMetros += $metros
                }
            }
        }
        if ($indiceMudou) { Write-IndiceAlimentadores -Pasta $pasta -Indice $indice }
    }

    $porCidade = @(
        $metrosPorCidade.GetEnumerator() |
            ForEach-Object { [ordered]@{ municipio = $_.Key; km = [math]::Round($_.Value / 1000, 2) } } |
            Sort-Object -Property km -Descending
    )
    $resumo = [ordered]@{
        porCamadaKm = [ordered]@{
            mt = [math]::Round($metrosPorCamada.mt / 1000, 2)
            bt = [math]::Round($metrosPorCamada.bt / 1000, 2)
            at = [math]::Round($metrosPorCamada.at / 1000, 2)
        }
        btAtIlustrativo = -not $temBtAtReal
        porCidadeKm = $porCidade
        naoIdentificadoKm = [math]::Round($semMunicipioMetros / 1000, 2)
    }

    # a impressao digital e calculada DEPOIS, porque o passo acima pode ter
    # reescrito um _index.json (migracao de "metros") - tem que refletir o
    # estado final dos arquivos, senao o resumo nasceria "velho".
    $digital = Get-ImpressaoDigitalResumoKm -GeoRoot $GeoRoot
    try {
        $arquivoResumo = Join-Path $GeoRoot "_resumo_km_rede.json"
        $pacote = [ordered]@{ impressaoDigital = $digital; geradoEm = (Get-IsoNow); resumo = $resumo }
        ConvertTo-Json -InputObject $pacote -Depth 6 -Compress | Set-Content -Path $arquivoResumo -Encoding UTF8
    } catch {
        Write-Host "Aviso: nao consegui gravar geo/_resumo_km_rede.json (o resumo segue valendo em memoria). Detalhe: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    $Script:KmRedeResumoCache = $resumo
    $Script:KmRedeResumoDigital = $digital
    return $resumo
}

function Get-ResumoKmDeRede {
    <# Resumo de Km de rede (MT/BT/AT e por cidade) pra Visao Geral. Ordem:
         1) copia em memoria, se a impressao digital dos dados nao mudou;
         2) geo/_resumo_km_rede.json (gravado no upload), se a impressao
            digital gravada ainda bate - leitura de um arquivo de poucos KB;
         3) so se nenhum dos dois servir, recalcula (Update-ResumoKmDeRede -
            que soma os indices, sem abrir os .geojson).
       Historico do bug que isso resolve (v2.11.3/v2.12.0, "signal is aborted
       without reason"): antes, esta funcao varria todos os .geojson de rede
       a cada partida/mudanca - ver comentario em Update-ResumoKmDeRede.

       "btAtIlustrativo" (true = nenhuma particao real de BT/AT importada
       ainda) avisa o front-end a nao tratar 0 km de BT/AT como "a rede nao
       tem BT/AT", e sim como "ainda nao foi importado". #>
    param([Parameter(Mandatory)][string]$GeoRoot)

    $digital = Get-ImpressaoDigitalResumoKm -GeoRoot $GeoRoot
    if ($null -ne $Script:KmRedeResumoCache -and $Script:KmRedeResumoDigital -eq $digital) {
        return $Script:KmRedeResumoCache
    }

    $arquivoResumo = Join-Path $GeoRoot "_resumo_km_rede.json"
    if (Test-Path $arquivoResumo) {
        try {
            $pacote = Get-Content $arquivoResumo -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($pacote -and $pacote.impressaoDigital -eq $digital -and $pacote.resumo) {
                $Script:KmRedeResumoCache = $pacote.resumo
                $Script:KmRedeResumoDigital = $digital
                return $Script:KmRedeResumoCache
            }
        } catch { }
    }

    return (Update-ResumoKmDeRede -GeoRoot $GeoRoot)
}

$Script:VeraMapaPontosCache = $null
$Script:VeraMapaPontosDigital = $null
function Get-PontosVeraMapa {
    <# v2.12.0 - lista [lat, lng, idVera, especie] de cada arvore da VERA com
       coordenada, pronta pra mandar ao mapa. Fica em memoria enquanto o
       model/vera.json nao mudar (impressao digital = tamanho + data do
       arquivo; qualquer import, edicao ou exclusao da VERA muda isso e a
       lista e remontada sozinha - sem depender de invalidar em cada ponto
       do sistema). Antes, CADA vez que o mapa ligava a camada VERA o
       Controller relia e desserializava as 141 mil arvores do zero,
       travando os outros pedidos (single-threaded) durante essa leitura. #>
    $caminho = Get-EntityPath -Entity "vera"
    $digital = "-"
    if (Test-Path $caminho) { $i = Get-Item $caminho; $digital = "$($i.Length):$($i.LastWriteTimeUtc.Ticks)" }
    if ($null -ne $Script:VeraMapaPontosCache -and $Script:VeraMapaPontosDigital -eq $digital) {
        return ,$Script:VeraMapaPontosCache
    }
    $pontos = New-Object System.Collections.Generic.List[object]
    foreach ($a in @(Read-JsonModel -Entity "vera")) {
        if ($null -eq $a.lat -or $null -eq $a.lng) { continue }
        $pontos.Add(@($a.lat, $a.lng, $a.idVera, $a.especie))
    }
    $Script:VeraMapaPontosCache = $pontos
    $Script:VeraMapaPontosDigital = $digital
    return ,$pontos
}

function Invoke-VeraMapaStream {
    <# GET /api/manutencao/vera-mapa — pontos da VERA (árvores) pro Mapa de
       Manutenção (pedido do Mario: "se conseguir exibir as árvores do VERA
       também no mapa é bom, são importantes pra nós"). Streaming/NDJSON em
       vez de um Read-JsonModel + ConvertTo-Json de uma vez só, pelo mesmo
       motivo de sempre: a base real passa de 141 mil árvores, e
       ConvertTo-Json numa coleção desse tamanho é lento e silencioso o
       bastante pra estourar o stall timeout do navegador (a mesma causa raiz
       já corrigida pra Rede MT/BT/AT e pra importação da própria VERA - ver
       Write-FeatureCollectionRede e Invoke-VeraStreamingUpload).

       Manda só [lat, lng, idVera, especie] por árvore (array, não objeto -
       mais leve pra 141 mil linhas) em lotes de 5000, com progresso real
       entre lotes. #>
    param($Response, $Usuario)

    if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
        Send-JsonResponse -Response $Response -Status 403 -Body @{ erro = "Sem permissão para visualizar Manutenção." }
        return
    }

    $Response.StatusCode = 200
    $Response.ContentType = "application/x-ndjson; charset=utf-8"
    $Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    $Response.SendChunked = $true

    $streamWriter = New-Object System.IO.StreamWriter($Response.OutputStream, (New-Object System.Text.UTF8Encoding($false)))
    $streamWriter.AutoFlush = $true
    $enviarLinha = {
        param($Dados)
        try {
            $json = $Dados | ConvertTo-Json -Depth 4 -Compress
            $streamWriter.Write($json + "`n")
        } catch { }
    }.GetNewClosure()

    try {
        # v2.12.0 - os pontos montados ficam em memoria (ver Get-PontosVeraMapa):
        # so a PRIMEIRA chamada (ou a primeira depois de a VERA mudar) paga o
        # Read-JsonModel de 141 mil arvores; as seguintes so fatiam a lista.
        $pontos = Get-PontosVeraMapa
        $total = $pontos.Count
        $tamanhoLote = 5000
        $enviadas = 0
        for ($inicio = 0; $inicio -lt $total; $inicio += $tamanhoLote) {
            $qtd = [Math]::Min($tamanhoLote, $total - $inicio)
            $lote = $pontos.GetRange($inicio, $qtd).ToArray()
            $enviadas += $qtd
            & $enviarLinha @{ tipo = 'lote'; pontos = $lote; enviadas = $enviadas; total = $total }
        }
        & $enviarLinha @{ tipo = 'final'; total = $enviadas }
    } catch {
        try { & $enviarLinha @{ tipo = 'erro'; mensagem = $_.Exception.Message } } catch { }
    } finally {
        try { $streamWriter.Flush() } catch { }
        try { $streamWriter.Close() } catch { }
        try { $Response.OutputStream.Close() } catch { }
    }
}

function Get-AlimentadoresDisponiveisResumo {
    <# Lista resumida (ctmt/nome) de alimentadores já carregados de uma
       camada particionada, pra popular o combo multi-seleção do mapa
       (mesma forma {ctmt,nome} que o front-end já espera pra MT/BT/AT —
       reaproveitada aqui pra Reserva Legal e APP, que passaram a seguir o
       mesmo esquema particionado). Fininha de propósito: só ctmt+nome, sem
       o GeoJSON inteiro — isso só é buscado quando o alimentador é
       efetivamente selecionado (?rl=/?app=/?ctmt=). #>
    param([Parameter(Mandatory)][string]$Camada, [Parameter(Mandatory)][string]$GeoRoot, [Parameter(Mandatory)][string]$Pasta)
    $pastaCompleta = Join-Path $GeoRoot $Pasta
    if (-not (Test-Path $pastaCompleta)) { return @() }
    $indiceNomes = Read-IndiceAlimentadores -Pasta $pastaCompleta
    # v2.13.0 - BT/AT nao trazem CT_COD_OP (o nome curto tipo "V-A1" so existe
    # no SSDMT), entao o indice delas guardava o proprio codigo CTMT
    # ("1382783"). O CTMT e o mesmo codigo da MT: o nome vem do indice da
    # MT quando a camada nao e a MT.
    $indiceMt = @{}
    if ($Pasta -ne "rede_mt") {
        $pastaMt = Join-Path $GeoRoot "rede_mt"
        if (Test-Path $pastaMt) { $indiceMt = Read-IndiceAlimentadores -Pasta $pastaMt }
    }
    return @(
        Get-ChildItem $pastaCompleta -Filter "*.geojson" -ErrorAction SilentlyContinue | ForEach-Object {
            $codigo = $_.BaseName
            $entrada = if ($indiceNomes.ContainsKey($codigo)) { $indiceNomes[$codigo] } else { $null }
            # o índice guarda @{nome; trechos} (não só o nome em texto) —
            # sem desembrulhar aqui, "nome" virava o objeto inteiro e a tela
            # mostrava "[object Object]" no lugar do nome.
            $nome = if ($entrada -is [string]) { $entrada } elseif ($entrada -and $entrada.nome) { $entrada.nome } else { $null }
            # v2.13.27 - CTMT com mais de um nome: mostra todos ("BBRAND34 / TO-A1")
            if ($entrada -and $entrada -isnot [string] -and $entrada.nomes -and @($entrada.nomes).Count -gt 1) {
                $nome = (@($entrada.nomes) -join ' / ')
            }
            if ([string]::IsNullOrWhiteSpace($nome) -or $nome -eq $codigo) {
                $eMt = if ($indiceMt.ContainsKey($codigo)) { $indiceMt[$codigo] } else { $null }
                $nomeMt = if ($eMt -is [string]) { $eMt } elseif ($eMt -and $eMt.nome) { $eMt.nome } else { $null }
                if ($nomeMt) { $nome = $nomeMt }
            }
            if ($codigo -eq "_sem_alimentador") { $nome = "(sem alimentador)" }
            [ordered]@{ ctmt = $codigo; nome = $nome }
        }
    )
}

function Invoke-CamadaTodosStream {
    <# GET /api/manutencao/camadas?ctmt=__todos__ (Rede MT) ou ?rl=__todos__
       (Reserva Legal) ou ?app=__todos__ (APP) — carrega TODOS os
       alimentadores de uma camada particionada de uma vez só. Generalizada
       a partir da antiga Invoke-RedeMtTodosStream (que só servia a Rede
       MT): a lógica é idêntica pra qualquer camada particionada, só muda a
       pasta — Reserva Legal/APP passaram a usar o mesmo esquema (pedido do
       Mario) e herdam o mesmo cuidado de origem: antes disso o front-end
       disparava um GET por alimentador em PARALELO — 335 pedidos de uma
       vez num caso real da Rede MT. O Controller atende um pedido por vez
       (single-threaded); a maioria ficava na fila, cada um com seu próprio
       timeout de 30s contando desde o clique. Quando o Controller
       finalmente processava um pedido antigo, o navegador já tinha
       desistido e fechado a conexão — e escrever a resposta numa conexão
       fechada estoura "O nome da rede especificado não está mais
       disponível" (ERROR_NETNAME_DELETED do Windows), um erro atrás do
       outro no console, um por pedido que chegava tarde demais.

       Em vez disso: UMA conexão só, streaming/NDJSON (mesmo padrão do
       Podas e do shapefile) — uma linha por alimentador lido, com um
       timeout "de trava" (reinicia a cada linha) em vez de um por pedido.
       Ainda é pesado pro navegador render um volume grande de uma vez (por
       isso o aviso na tela), mas não derruba mais o Controller. #>
    param($Response, [string]$GeoRoot, [string]$Pasta = "rede_mt")

    $Response.StatusCode = 200
    $Response.ContentType = "application/x-ndjson; charset=utf-8"
    $Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    $Response.SendChunked = $true

    $streamWriter = New-Object System.IO.StreamWriter($Response.OutputStream, (New-Object System.Text.UTF8Encoding($false)))
    $streamWriter.AutoFlush = $true
    $enviarLinha = {
        param($Dados)
        try {
            $json = $Dados | ConvertTo-Json -Depth 8 -Compress
            $streamWriter.Write($json + "`n")
        } catch { }
    }.GetNewClosure()

    try {
        $pastaRedeMt = Join-Path $GeoRoot $Pasta
        $arquivos = @(Get-ChildItem -Path $pastaRedeMt -Filter "*.geojson" -File -ErrorAction SilentlyContinue)
        $total = $arquivos.Count
        if ($total -eq 0) {
            & $enviarLinha @{ tipo = 'final'; totalAlimentadores = 0; totalTrechos = 0 }
            return
        }

        $totalTrechos = 0
        $i = 0
        foreach ($arquivo in $arquivos) {
            $i++
            $ctmt = [System.IO.Path]::GetFileNameWithoutExtension($arquivo.Name)
            try {
                $geo = Get-Content $arquivo.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
                $features = @($geo.features)
                $totalTrechos += $features.Count
                & $enviarLinha @{ tipo = 'alimentador'; ctmt = $ctmt; features = $features; arquivo = $i; total = $total; percentual = [Math]::Round(100.0 * $i / $total, 1) }
            } catch {
                # um .geojson corrompido/parcial não derruba o carregamento
                # dos outros 334 — só pula e segue.
                & $enviarLinha @{ tipo = 'progresso'; arquivo = $i; total = $total; percentual = [Math]::Round(100.0 * $i / $total, 1) }
            }
        }
        & $enviarLinha @{ tipo = 'final'; totalAlimentadores = $total; totalTrechos = $totalTrechos }
    } catch {
        try { & $enviarLinha @{ tipo = 'erro'; mensagem = $_.Exception.Message } } catch { }
    } finally {
        try { $streamWriter.Flush() } catch { }
        try { $streamWriter.Close() } catch { }
        try { $Response.OutputStream.Close() } catch { }
    }
}

function Invoke-CamadaAlimentadorRaw {
    <# GET /api/manutencao/camadas?ctmt=<X> (Rede MT), ?rl=<X> (Reserva Legal),
       ?app=<X> (APP), ?bt=<X> (Rede BT) ou ?at=<X> (Rede AT) - o GeoJSON de
       UM alimentador, entregue como esta no disco, embrulhado em
       {"<chave>": <arquivo>}. Sem ConvertFrom-Json + ConvertTo-Json no meio
       (antes cada pedido lia, desserializava e reserializava o arquivo
       inteiro no PowerShell - lento em alimentadores grandes e proibitivo
       quando o mapa pre-carrega centenas deles em segundo plano). Arquivo
       inexistente devolve {"<chave>": null}, igual antes.

       O nome vem da URL, entao e validado: so um nome de arquivo simples
       (nada de "..", barras etc.) - impede ler um arquivo fora de geo/. #>
    param($Response, [string]$GeoRoot, $Query)

    $alvos = @(
        @{ param = 'ctmt'; pasta = 'rede_mt';       chave = 'rede_mt' },
        @{ param = 'rl';   pasta = 'reserva_legal'; chave = 'reserva_legal' },
        @{ param = 'app';  pasta = 'app';           chave = 'app' },
        @{ param = 'bt';   pasta = 'rede_bt';       chave = 'rede_bt' },
        @{ param = 'at';   pasta = 'rede_at';       chave = 'rede_at' }
    )
    $alvo = $alvos | Where-Object { $Query[$_.param] } | Select-Object -First 1
    $nome = [string]$Query[$alvo.param]
    if ([System.IO.Path]::GetFileName($nome) -ne $nome -or $nome.Contains('..') -or $nome.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -ge 0) {
        Send-JsonResponse -Response $Response -Status 400 -Body @{ erro = "Nome de alimentador invalido." }
        return
    }

    $caminho = Join-Path (Join-Path $GeoRoot $alvo.pasta) "$nome.geojson"
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $prefixo = $utf8.GetBytes('{"' + $alvo.chave + '":')
    $sufixo = $utf8.GetBytes('}')
    if (Test-Path $caminho) {
        $arquivo = [System.IO.File]::ReadAllBytes($caminho)
        # arquivos gravados por Set-Content -Encoding UTF8 (Windows
        # PowerShell 5.1) podem ter BOM - dentro de um JSON embrulhado ele
        # quebraria o parse no navegador.
        $desloc = if ($arquivo.Length -ge 3 -and $arquivo[0] -eq 0xEF -and $arquivo[1] -eq 0xBB -and $arquivo[2] -eq 0xBF) { 3 } else { 0 }
    } else {
        $arquivo = $utf8.GetBytes('null')
        $desloc = 0
    }
    $tamanhoArquivo = $arquivo.Length - $desloc

    $Response.StatusCode = 200
    $Response.ContentType = "application/json; charset=utf-8"
    $Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    $Response.ContentLength64 = $prefixo.Length + $tamanhoArquivo + $sufixo.Length
    try {
        $Response.OutputStream.Write($prefixo, 0, $prefixo.Length)
        $Response.OutputStream.Write($arquivo, $desloc, $tamanhoArquivo)
        $Response.OutputStream.Write($sufixo, 0, $sufixo.Length)
    } catch {
        # v2.15.13 - o navegador desistiu/fechou a conexao no meio (trocou de tela,
        # F5, timeout): nao e erro do Controller, so ignora (antes enchia o prompt
        # de "Erro ao processar requisicao ... O nome da rede ... nao esta mais
        # disponivel").
    } finally {
        try { $Response.OutputStream.Close() } catch { }
    }
}
