# =============================================================================
# server.ps1 — Controller: listener HTTP local do SPARK
#
# PowerShell puro (HttpListener do .NET), sem módulos de terceiros — mesma
# filosofia do ImportadorShapefileRede.ps1 que já veio no pacote anterior.
# Cada usuário roda este script localmente (via iniciar.bat), lendo/gravando
# nos JSONs em model/ que ficam na pasta compartilhada de rede (FTP interno).
#
# Uso:
#   .\controller\server.ps1                  # sobe em http://localhost:8787
#   .\controller\server.ps1 -Porta 9000       # porta customizada
# =============================================================================

param(
    [int]$Porta = 8787
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "lib\JsonStore.ps1")
. (Join-Path $PSScriptRoot "lib\Auth.ps1")
. (Join-Path $PSScriptRoot "lib\Validacao.ps1")
. (Join-Path $PSScriptRoot "lib\ShapefileImporter.ps1")
. (Join-Path $PSScriptRoot "lib\KmzImporter.ps1")
. (Join-Path $PSScriptRoot "lib\XlsxReader.ps1")
. (Join-Path $PSScriptRoot "lib\PodasImporter.ps1")
. (Join-Path $PSScriptRoot "lib\PodasHistorico.ps1")
. (Join-Path $PSScriptRoot "lib\AppRl.ps1")
. (Join-Path $PSScriptRoot "lib\Postes.ps1")
. (Join-Path $PSScriptRoot "lib\Equip.ps1")
. (Join-Path $PSScriptRoot "lib\Geografia.ps1")
. (Join-Path $PSScriptRoot "routes\equipes.ps1")
. (Join-Path $PSScriptRoot "routes\manutencao.ps1")
. (Join-Path $PSScriptRoot "routes\produtividade.ps1")
. (Join-Path $PSScriptRoot "routes\programacao.ps1")
. (Join-Path $PSScriptRoot "routes\logistica.ps1")
. (Join-Path $PSScriptRoot "routes\prefeituras.ps1")
. (Join-Path $PSScriptRoot "routes\alertas.ps1")
. (Join-Path $PSScriptRoot "routes\indisponibilidades.ps1")
. (Join-Path $PSScriptRoot "routes\postes.ps1")
. (Join-Path $PSScriptRoot "routes\equip.ps1")
. (Join-Path $PSScriptRoot "routes\importacao.ps1")
. (Join-Path $PSScriptRoot "routes\cadastros.ps1")
. (Join-Path $PSScriptRoot "routes\listas.ps1")
. (Join-Path $PSScriptRoot "routes\ajuda.ps1")
. (Join-Path $PSScriptRoot "routes\usuarios.ps1")
. (Join-Path $PSScriptRoot "routes\feriados.ps1")
. (Join-Path $PSScriptRoot "routes\ajustes.ps1")
. (Join-Path $PSScriptRoot "routes\rank.ps1")
. (Join-Path $PSScriptRoot "routes\nix.ps1")
. (Join-Path $PSScriptRoot "routes\historico.ps1")
. (Join-Path $PSScriptRoot "routes\apprl.ps1")
. (Join-Path $PSScriptRoot "routes\medicao.ps1")
. (Join-Path $PSScriptRoot "routes\regras.ps1")
. (Join-Path $PSScriptRoot "lib\Regras.ps1")

# Resolve o usuário logado a partir do token de sessão (header
# "Authorization: Bearer <token>", criado em POST /api/auth/login). Sem
# login de verdade agora (v2.0.9) - ver Auth.ps1 pro esquema de senha
# ofuscada. Uma requisição sem token válido vira "anonimo", e o loop
# principal abaixo barra com 401 qualquer chamada de API que não esteja na
# lista de rotas públicas (login, health, cadastro) - é isso que faz o
# login valer alguma coisa de verdade, em vez de só decorativo.
function Resolve-UsuarioDaRequisicao {
    param($Request)
    $authHeader = $Request.Headers["Authorization"]
    if ($authHeader -and $authHeader.StartsWith("Bearer ")) {
        $token = $authHeader.Substring(7)
        $sessao = Get-SessionUser -Token $token
        if ($sessao) { return $sessao }
    }
    return @{ usuarioId = "anonimo"; nome = "Anônimo" }
}

function Test-RotaPublica {
    <# Rotas de API que funcionam sem sessão válida. #>
    param([string]$Modulo, [string[]]$Resto)
    if ($Modulo -eq "auth" -and $Resto.Count -ge 1 -and $Resto[0] -eq "login") { return $true }
    if ($Modulo -eq "usuarios" -and $Resto.Count -ge 1 -and $Resto[0] -eq "cadastro") { return $true }
    # v2.13.0 - "Solicitar cadastro" da tela de login (so o e-mail)
    if ($Modulo -eq "usuarios" -and $Resto.Count -ge 1 -and $Resto[0] -eq "solicitar-cadastro") { return $true }
    return $false
}

function Send-JsonResponseBytes {
    # v2.13.15 - envia um corpo JSON ja serializado (cache), sem converter de novo.
    # v2.14.5 - -Gzip: os bytes ja estao comprimidos (Content-Encoding: gzip).
    param($Response, [int]$Status, [byte[]]$Bytes, [bool]$Gzip = $false)
    $Response.StatusCode = $Status
    if ($Gzip) { $Response.Headers.Add("Content-Encoding", "gzip") }
    $Response.ContentType = "application/json; charset=utf-8"
    $Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    $Response.ContentLength64 = $Bytes.Length
    $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    $Response.OutputStream.Close()
}

function Send-JsonResponse {
    param($Response, [int]$Status, $Body)
    $Response.StatusCode = $Status
    $Response.ContentType = "application/json; charset=utf-8"
    $Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    # "$Body | ConvertTo-Json" (com PIPE) é uma pegadinha clássica do
    # PowerShell: quando $Body é uma coleção VAZIA (ex.: uma lista que acabou
    # de ser zerada - "Apagar tudo" - ou uma busca sem resultado), o pipeline
    # chama ConvertTo-Json ZERO vezes (nenhum item passa por ele) e a
    # variável fica $null - não "[]". Aí GetBytes($null) explode com "Matriz
    # não pode ser nula" e RESPOSTA NENHUMA é enviada - o navegador trata
    # como erro 500/conexão caída. Isso ficou escondido até agora porque
    # nenhuma lista tinha ficado vazia de verdade em produção; o botão
    # "Apagar tudo" (v2.8.0) esvazia várias de uma vez e expôs o bug em
    # cascata assim que a tela tentava recarregar os dados. Corrigido
    # passando $Body como -InputObject (sem pipe): ConvertTo-Json -InputObject
    # trata a coleção como um ÚNICO argumento, então uma lista vazia vira
    # corretamente "[]", igual qualquer outra lista.
    $json = if ($null -eq $Body) { "null" } else { ConvertTo-Json -InputObject $Body -Depth 12 -Compress }
    if ($null -eq $json) { $json = "null" }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
}

function Get-QueryHashtable {
    param([System.Collections.Specialized.NameValueCollection]$Query)
    $h = @{}
    foreach ($key in $Query.AllKeys) {
        if ($key) { $h[$key] = $Query[$key] }
    }
    return $h
}

function Find-ByteSequence {
    <# Procura a primeira ocorrência de $Needle dentro de $Haystack a partir
       de $Start. Busca ingênua (não Boyer-Moore) mas, como o boundary só
       aparece poucas vezes por requisição (uma por parte do multipart —
       tipicamente menos de 10) e cada busca começa de onde a anterior
       parou (nunca reinicia do zero), o custo total é O(tamanho do corpo),
       não O(tamanho²). #>
    param([byte[]]$Haystack, [byte[]]$Needle, [int]$Start = 0)
    # v2.13.6 - a busca byte a byte em PowerShell levava ~50 s num upload de
    # ~100 MB (GRID_EXECUTADO). Com o helper em C# (XlsxReader.ps1) cai pra
    # fracao de segundo; se o Add-Type nao estiver disponivel, usa o laco antigo.
    if (Initialize-SparkXlsx) { return [SparkBytes]::IndexOf($Haystack, $Needle, $Start) }
    $hLen = $Haystack.Length
    $nLen = $Needle.Length
    if ($nLen -eq 0 -or $Start -ge $hLen) { return -1 }
    $first = $Needle[0]
    $limite = $hLen - $nLen
    for ($i = $Start; $i -le $limite; $i++) {
        if ($Haystack[$i] -ne $first) { continue }
        $bateu = $true
        for ($j = 1; $j -lt $nLen; $j++) {
            if ($Haystack[$i + $j] -ne $Needle[$j]) { $bateu = $false; break }
        }
        if ($bateu) { return $i }
    }
    return -1
}

function Get-MultipartFormData {
    <# Parser manual de multipart/form-data (upload de arquivo pelo
       navegador — usado pela tela de Importação de Bases: Rede MT/BT/AT e
       Podas). Trabalha direto em cima do byte[] do corpo, sem nunca
       converter o corpo inteiro pra string.

       A versão anterior fazia $latin1.GetString($allBytes) pra poder usar
       -split/regex no boundary, e depois $latin1.GetBytes(...) de volta pra
       extrair cada arquivo — pra um shapefile grande de verdade (o SSDMT
       tem 427.910 registros, o .shp+.dbf juntos passam de dezenas de MB)
       isso significa: (1) uma string .NET (2 bytes por char) do tamanho do
       corpo inteiro, (2) o array de partes do -split duplicando esse
       conteúdo de novo, (3) mais uma cópia por arquivo na hora de
       reconverter pra bytes — várias vezes o tamanho original em memória, e
       -split/regex processando uma "linha" única gigante. Em produção
       (Windows 5.1, máquina de usuário comum) isso é lento o bastante, ou
       consome memória o bastante, pra matar o processo do Controller no
       meio da leitura — a conexão cai sem nenhuma resposta HTTP chegar a
       ser escrita, e o navegador reporta exatamente "Failed to fetch" (erro
       de rede, não um status HTTP de erro). Buscar o boundary direto nos
       bytes (Find-ByteSequence acima) e copiar cada arquivo com
       [Array]::Copy evita todas essas cópias extras.

       -ProgressCallback (opcional): o GRID_EXECUTADO real chega a uns 60MB
       — receber esse corpo inteiro (InputStream.CopyTo, sem nenhum aviso)
       podia ficar em silêncio tempo suficiente pra estourar o timeout de
       trava do navegador ANTES de qualquer linha de progresso da leitura
       do próprio Excel ter chance de sair (o cliente reporta isso como
       "Erro ao importar: BodyStreamBuffer was aborted" — o fetch() foi
       abortado pelo AbortController do lado de cá, não um erro do
       Controller). Por isso o corpo agora é lido aos poucos, num laço
       manual (em vez de CopyTo, que não dá nenhum gancho de progresso),
       avisando a cada 400ms com base no Content-Length declarado. #>
    param($Request, [scriptblock]$ProgressCallback)
    $contentType = $Request.ContentType
    if (-not $contentType -or $contentType -notmatch '(?i)multipart/form-data') { return $null }
    if ($contentType -notmatch 'boundary=("?)([^";]+)\1') { throw "Requisição multipart sem 'boundary' no Content-Type." }
    $boundaryText = $Matches[2]

    $ms = New-Object System.IO.MemoryStream
    $buffer = New-Object byte[] 65536
    $totalLido = 0
    $contentLength = $Request.ContentLength64
    $ultimoProgressoRecebendo = [DateTime]::MinValue
    if ($ProgressCallback) { & $ProgressCallback @{ fase = 'recebendo'; bytesRecebidos = 0; bytesTotal = $contentLength; percentual = 0 } }
    while ($true) {
        $lidos = $Request.InputStream.Read($buffer, 0, $buffer.Length)
        if ($lidos -le 0) { break }
        $ms.Write($buffer, 0, $lidos)
        $totalLido += $lidos
        if ($ProgressCallback -and $contentLength -gt 0) {
            $agora = [DateTime]::UtcNow
            if (($agora - $ultimoProgressoRecebendo).TotalMilliseconds -ge 400) {
                $ultimoProgressoRecebendo = $agora
                $pct = [Math]::Min(99, [Math]::Round(100.0 * $totalLido / $contentLength, 1))
                & $ProgressCallback @{ fase = 'recebendo'; bytesRecebidos = $totalLido; bytesTotal = $contentLength; percentual = $pct }
            }
        }
    }
    $allBytes = $ms.ToArray()
    $ms.Close()
    if ($ProgressCallback) { & $ProgressCallback @{ fase = 'recebido'; bytesRecebidos = $totalLido; bytesTotal = $contentLength; percentual = 99 } }

    $latin1 = [System.Text.Encoding]::GetEncoding(28591)
    $boundaryBytes = $latin1.GetBytes("--$boundaryText")
    $crlfcrlf = [byte[]](13, 10, 13, 10)

    $files = New-Object System.Collections.Generic.List[object]
    $fields = @{}

    $pos = Find-ByteSequence -Haystack $allBytes -Needle $boundaryBytes -Start 0
    while ($pos -ge 0) {
        $partStart = $pos + $boundaryBytes.Length

        # logo depois do boundary vem "--" no boundary final da requisição
        if ($partStart + 1 -lt $allBytes.Length -and $allBytes[$partStart] -eq 45 -and $allBytes[$partStart + 1] -eq 45) { break }
        # pula o CRLF que separa o boundary do cabeçalho da parte
        if ($partStart + 1 -lt $allBytes.Length -and $allBytes[$partStart] -eq 13 -and $allBytes[$partStart + 1] -eq 10) { $partStart += 2 }

        $nextBoundary = Find-ByteSequence -Haystack $allBytes -Needle $boundaryBytes -Start $partStart
        if ($nextBoundary -lt 0) { break }
        # a parte termina 2 bytes antes do próximo boundary (o CRLF que o precede)
        $partEnd = $nextBoundary - 2
        if ($partEnd -lt $partStart) { $partEnd = $partStart }

        $headerEnd = Find-ByteSequence -Haystack $allBytes -Needle $crlfcrlf -Start $partStart
        if ($headerEnd -ge 0 -and $headerEnd -lt $partEnd) {
            $headerText = $latin1.GetString($allBytes, $partStart, $headerEnd - $partStart)
            $valueStart = $headerEnd + 4
            $valueLen = $partEnd - $valueStart
            if ($valueLen -lt 0) { $valueLen = 0 }

            $nameMatch = [regex]::Match($headerText, 'name="([^"]*)"')
            $fileNameMatch = [regex]::Match($headerText, 'filename="([^"]*)"')
            $name = if ($nameMatch.Success) { $nameMatch.Groups[1].Value } else { "" }

            if ($fileNameMatch.Success -and $fileNameMatch.Groups[1].Value) {
                $fileBytes = New-Object byte[] $valueLen
                if ($valueLen -gt 0) { [Array]::Copy($allBytes, $valueStart, $fileBytes, 0, $valueLen) }
                # v2.13.0 - o cabecalho foi lido como Latin-1 (1 byte = 1 char),
                # mas o navegador manda o nome do arquivo em UTF-8: refaz os
                # bytes e decodifica certo ("ÁrvoresFiltradas" em vez de
                # "Ã?rvoresFiltradas").
                $nomeArquivoBruto = $fileNameMatch.Groups[1].Value
                try { $nomeArquivoBruto = [System.Text.Encoding]::UTF8.GetString($latin1.GetBytes($nomeArquivoBruto)) } catch { }
                $files.Add(@{ Name = $name; FileName = $nomeArquivoBruto; Bytes = $fileBytes })
            } else {
                # campos de texto (camada, base...) tambem vem em UTF-8
                $fields[$name] = [System.Text.Encoding]::UTF8.GetString($allBytes, $valueStart, $valueLen)
            }
        }

        $pos = $nextBoundary
    }

    return @{ Files = $files; Fields = $fields }
}

# v2.11.3 - migração de arranque: se existir um geo/rede_bt.geojson ou
# geo/rede_at.geojson do formato antigo (arquivo único, de antes dessas
# camadas virarem particionadas por alimentador igual a MT), converte pra
# pasta particionada antes de abrir a porta pro navegador - ver comentário
# detalhado em Invoke-MigrarCamadaArquivoUnicoParaParticionada
# (lib/ShapefileImporter.ps1) sobre o bug real que essa migração evita (um
# arquivo de 100MB+ sendo lido inteiro a cada GET /manutencao/camadas).
# Roda só nessa janela, antes do listener começar a atender pedidos - não
# tem concorrência pra se preocupar aqui, é a mesma leitura pesada de
# sempre, só que UMA VEZ, na subida, em vez de a cada requisição.
$geoRootInicial = Join-Path $PSScriptRoot "..\geo"
New-Item -ItemType Directory -Force -Path $geoRootInicial | Out-Null
$geoRootInicial = Resolve-Path $geoRootInicial | Select-Object -ExpandProperty ProviderPath
foreach ($camadaAntiga in @("rede_baixa_tensao", "rede_alta_tensao")) {
    Invoke-MigrarCamadaArquivoUnicoParaParticionada -Camada $camadaAntiga -GeoRoot $geoRootInicial
}

# v2.12.0 - garante o resumo de Km de rede pronto na subida. Agora isto é
# BARATO: Get-ResumoKmDeRede lê geo/_resumo_km_rede.json (gravado no upload) e
# só recalcula - somando os _index.json, sem abrir nenhum .geojson - se a
# impressão digital dos dados mudou. A única parte mais demorada é a
# MIGRAÇÃO de uma base importada antes da v2.12.0 (alimentadores cujo
# _index.json ainda não tem "metros": cada .geojson é aberto UMA vez, o total
# é gravado no índice e nunca mais é preciso abrir). Roda antes do listener
# abrir, então ninguém fica esperando. Erro aqui não impede o Controller de
# subir (a rota recalcula na primeira visita à Visão Geral).
try {
    Get-ResumoKmDeRede -GeoRoot $geoRootInicial | Out-Null
} catch {
    Write-Host "Não consegui preparar o resumo de Km de rede na subida (sem problema, recalcula sozinho na primeira visita à Visão Geral). Detalhe: $($_.Exception.Message)" -ForegroundColor Yellow
}

# v2.13.0 - reparo UNICO de textos gravados com a codificacao errada (antes
# desta versao o Controller lia JSON/nomes de arquivo como Windows-1252:
# "Plantão" ficou "PlantÃ£o" nas metas, equipes, histórico...). Para cada texto
# que parece "UTF-8 lido como cp1252", refaz os bytes e decodifica certo; se o
# resultado tiver caractere de substituicao (irrecuperavel), deixa como esta.
# Roda uma vez (marcador model/_utf8_reparado.flag) e nunca impede a subida.
function Repair-TextoMojibake {
    param([string]$Texto)
    if ([string]::IsNullOrEmpty($Texto)) { return $Texto }
    # so ASCII aqui: aspas curvas dentro do regex fecham a string no PowerShell
    if ($Texto -notmatch '[\u00C2\u00C3][\u0080-\u00BF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018-\u201E\u2020-\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]') { return $Texto }
    try {
        $reparado = [System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::GetEncoding(1252).GetBytes($Texto))
        if ($reparado.Contains([string][char]0xFFFD)) { return $Texto }
        return $reparado
    } catch { return $Texto }
}
function Repair-ObjetoMojibake {
    param($Objeto)
    $mudou = $false
    if ($null -eq $Objeto) { return $false }
    foreach ($prop in @($Objeto.PSObject.Properties)) {
        $v = $prop.Value
        if ($v -is [string]) {
            $novo = Repair-TextoMojibake -Texto $v
            if ($novo -ne $v) { $prop.Value = $novo; $mudou = $true }
        } elseif ($v -is [System.Management.Automation.PSCustomObject]) {
            if (Repair-ObjetoMojibake -Objeto $v) { $mudou = $true }
        } elseif ($v -is [System.Collections.IEnumerable] -and $v -isnot [string]) {
            $lista = @($v); $idx = 0
            foreach ($item in $lista) {
                if ($item -is [string]) {
                    $novo = Repair-TextoMojibake -Texto $item
                    if ($novo -ne $item) { $lista[$idx] = $novo; $mudou = $true }
                } elseif ($item -is [System.Management.Automation.PSCustomObject]) {
                    if (Repair-ObjetoMojibake -Objeto $item) { $mudou = $true }
                }
                $idx++
            }
            if ($mudou) { $prop.Value = $lista }
        }
    }
    return $mudou
}
try {
    $marcadorUtf8 = Join-Path $PSScriptRoot "..\model\_utf8_reparado.flag"
    if (-not (Test-Path $marcadorUtf8)) {
        foreach ($entidadeReparo in @("metas", "equipes", "importacoes_log", "justificativas", "programacao", "logistica_equipes", "prefeituras")) {
            try {
                $dadosReparo = @(Read-JsonModel -Entity $entidadeReparo)
                $alterou = $false
                foreach ($registroReparo in $dadosReparo) { if (Repair-ObjetoMojibake -Objeto $registroReparo) { $alterou = $true } }
                if ($alterou) { Write-JsonModel -Entity $entidadeReparo -Data $dadosReparo; Write-Host "Acentos reparados em $entidadeReparo." -ForegroundColor DarkGray }
            } catch { }
        }
        Set-Content -Path $marcadorUtf8 -Value (Get-IsoNow) -Encoding UTF8
    }
} catch {
    Write-Host "Reparo de acentos ignorado: $($_.Exception.Message)" -ForegroundColor Yellow
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Porta/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Não foi possível abrir a porta $Porta. Ela já pode estar em uso por outra instância do SPARK." -ForegroundColor Red
    Write-Host "Detalhe: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "==============================================================" -ForegroundColor DarkCyan
Write-Host " SPARK - Controller no ar em $prefix" -ForegroundColor Cyan
Write-Host " API em ${prefix}api/... | Front-end (view/index.html) servido na raiz: $prefix" -ForegroundColor Cyan
Write-Host " Deixe esta janela aberta. Feche-a para encerrar o sistema." -ForegroundColor DarkGray
Write-Host "==============================================================" -ForegroundColor DarkCyan

# v2.14.5 - deixa a lista de OS pronta ANTES de aceitar pedidos (o primeiro login nao espera)
try {
    Write-Host "Preparando a lista de OS na memoria..." -ForegroundColor DarkGray
    $cronOs = [System.Diagnostics.Stopwatch]::StartNew()
    $null = Get-OsRespostaCache
    Write-Host ("Lista de OS pronta em {0:N1} s." -f $cronOs.Elapsed.TotalSeconds) -ForegroundColor DarkGray
} catch {
    Write-Host "Nao consegui pre-carregar a lista de OS: $($_.Exception.Message)" -ForegroundColor Yellow
}

# v2.15.0 - idem para os equipamentos (trafos/protecoes...): o primeiro popup de OS nao espera ler os TSV
try {
    $cronEq = [System.Diagnostics.Stopwatch]::StartNew()
    $nEq = Initialize-EquipPrewarm
    if ($nEq -gt 0) { Write-Host ("Equipamentos prontos na memoria ({0} camada(s)) em {1:N1} s." -f $nEq, $cronEq.Elapsed.TotalSeconds) -ForegroundColor DarkGray }
} catch {
    Write-Host "Nao consegui pre-carregar os equipamentos: $($_.Exception.Message)" -ForegroundColor Yellow
}

# v3.1.12 - so abre a tela DEPOIS de tudo pronto (antes a janela abria enquanto o Controller ainda
# preparava a lista de OS e o primeiro login estourava: "Nao consegui entrar - tente de novo").
# Abre primeiro o APLICATIVO instalado (atalho do Chrome/Edge "SPARK" com --app-id, achado no Menu Iniciar);
# se nao achar, abre no navegador padrao.
$abriuApp = $false
try {
    $pastas = @(
        (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"),
        (Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs")
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
    $wsh = New-Object -ComObject WScript.Shell
    $atalhos = @()
    foreach ($pasta in $pastas) {
        $atalhos += @(Get-ChildItem -LiteralPath $pasta -Filter "SPARK*.lnk" -Recurse -ErrorAction SilentlyContinue)
    }
    foreach ($lnk in $atalhos) {
        try {
            $sc = $wsh.CreateShortcut($lnk.FullName)
            $alvo = [System.IO.Path]::GetFileName([string]$sc.TargetPath).ToLower()
            if (($alvo -in @('chrome.exe','chrome_proxy.exe','msedge.exe','msedge_proxy.exe')) -and ([string]$sc.Arguments -match '--app-id=')) {
                Start-Process -FilePath $lnk.FullName | Out-Null
                Write-Host " Aberto como aplicativo instalado ($($lnk.BaseName))." -ForegroundColor DarkGray
                $abriuApp = $true
                break
            }
        } catch { }
    }
} catch { $abriuApp = $false }
if (-not $abriuApp) {
    try { Start-Process $prefix | Out-Null } catch { Write-Host "Não consegui abrir o navegador sozinho. Abra o endereço acima manualmente." -ForegroundColor Yellow }
}

$viewRoot = Join-Path $PSScriptRoot "..\view" | Resolve-Path | Select-Object -ExpandProperty ProviderPath

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
    } catch {
        # Antes, QUALQUER exceção aqui (até uma passageira - um cliente que
        # fechou a conexão no meio, por exemplo) derrubava o loop inteiro
        # com "break", encerrando o Controller sem nenhum aviso de erro na
        # tela (só o prompt do PowerShell de volta) - visto depois de um
        # upload de KMZ real: o navegador reportava "Failed to fetch" em
        # tudo daí pra frente porque o processo já tinha fechado sozinho.
        # Só derruba de verdade o loop se o listener realmente não estiver
        # mais escutando (ex.: Stop() chamado por outro lugar) - uma
        # exceção isolada de GetContext() com o listener ainda ativo só é
        # registrada e o loop tenta de novo, sem matar o Controller à toa.
        if (-not $listener.IsListening) { break }
        Write-Host "Aviso: GetContext() falhou, mas o Controller continua no ar: $($_.Exception.Message)" -ForegroundColor Yellow
        continue
    }
    $request = $context.Request
    $response = $context.Response

    try {
        if ($request.HttpMethod -eq "OPTIONS") {
            Send-JsonResponse -Response $response -Status 204 -Body $null
            continue
        }

        # v3.7.4 - os segmentos saem da URL CRUA (RawUrl) e so depois sao decodificados um a um.
        # Antes usava Url.AbsolutePath, que ja troca %2F por "/" e quebrava o id da OS no caminho
        # (ex.: PUT /api/ajustes/AUDTUP1%20%20000304%2F2026 virava 2 segmentos e dava 404).
        $caminhoCru = "$($request.RawUrl)"
        $qpos = $caminhoCru.IndexOf("?")
        if ($qpos -ge 0) { $caminhoCru = $caminhoCru.Substring(0, $qpos) }
        if ($caminhoCru -match '^[a-zA-Z][a-zA-Z0-9+.-]*://') { $caminhoCru = $request.Url.AbsolutePath }   # URL absoluta (proxy): cai no jeito antigo
        $segments = @($caminhoCru.Trim("/") -split "/" | Where-Object { $_ -ne "" } | ForEach-Object {
            try { [System.Uri]::UnescapeDataString($_) } catch { $_ }
        })

        # ---- serve os arquivos estáticos do front-end (view/) ----
        if ($segments.Count -eq 0 -or $segments[0] -ne "api") {
            $relativo = if ($segments.Count -eq 0) { "index.html" } else { ($segments -join "\") }
            $filePath = Join-Path $viewRoot $relativo
            # com RawUrl os pontos ".." nao sao mais normalizados pelo Uri: confere que o arquivo continua dentro de view/
            $dentroDaView = $false
            try { $dentroDaView = [System.IO.Path]::GetFullPath($filePath).StartsWith([System.IO.Path]::GetFullPath($viewRoot), [System.StringComparison]::OrdinalIgnoreCase) } catch { $dentroDaView = $false }
            if ($dentroDaView -and (Test-Path $filePath -PathType Leaf)) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".css"  { "text/css; charset=utf-8" }
                    ".js"   { "application/javascript; charset=utf-8" }
                    ".json" { "application/json; charset=utf-8" }
                    ".png"  { "image/png" }
                    ".svg"  { "image/svg+xml" }
                    ".ico"  { "image/x-icon" }
                    ".jpg"  { "image/jpeg" }
                    ".jpeg" { "image/jpeg" }
                    ".woff2"{ "font/woff2" }
                    default { "application/octet-stream" }
                }
                $response.ContentType = $mime
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.OutputStream.Close()
            } else {
                Send-JsonResponse -Response $response -Status 404 -Body @{ erro = "Arquivo não encontrado: $relativo" }
            }
            continue
        }

        # ---- roteamento da API ----
        $apiSegments = @(if ($segments.Count -gt 1) { $segments[1..($segments.Count - 1)] } else { @() })
        $modulo = if ($apiSegments.Count -gt 0) { $apiSegments[0] } else { "" }
        $resto = @(if ($apiSegments.Count -gt 1) { $apiSegments[1..($apiSegments.Count - 1)] } else { @() })
        $Script:ClienteAceitaGzip = ("$($request.Headers["Accept-Encoding"])" -match "gzip")
        $query = Get-QueryHashtable -Query $request.QueryString

        # Uploads grandes (Podas Executado/Pendente, shapefile de rede) NÃO
        # passam pelo parser de multipart genérico aqui embaixo — eles
        # mesmos chamam Get-MultipartFormData, DEPOIS de já terem deixado a
        # resposta em modo chunked/streaming e mandado o primeiro aviso de
        # progresso. Ler o corpo inteiro (até uns 60MB no GRID_EXECUTADO
        # real) ainda como $body "normal" aqui deixava esse recebimento
        # inteiro em silêncio total pro navegador - tempo de sobra pra
        # estourar o timeout de trava ("BodyStreamBuffer was aborted") antes
        # mesmo da primeira linha de progresso da leitura do Excel sair.
        # "vera" entrou aqui pelo mesmo motivo do shapefile/podas (pedido do
        # Mario: "quebra as etapas igual você fez com o shapefile") — ver
        # Invoke-VeraStreamingUpload em routes/importacao.ps1.
        $ehUploadStreaming = ($request.HttpMethod -eq "POST" -and $modulo -eq "importacao" -and $resto.Count -eq 1 -and (
            $resto[0] -eq "podas-executado" -or $resto[0] -eq "podas-historico" -or $resto[0] -eq "podas-pendente" -or $resto[0] -eq "podas-sigod" -or $resto[0] -eq "podas-sigod-pendente" -or $resto[0] -eq "shapefile" -or $resto[0] -eq "vera" -or $resto[0] -eq "vao" -or $resto[0] -eq "protecao"
        ))

        $body = $null
        if ($request.HasEntityBody -and -not $ehUploadStreaming) {
            if ($request.ContentType -and $request.ContentType -match '(?i)multipart/form-data') {
                $multipart = Get-MultipartFormData -Request $request
                $body = @{}
                foreach ($k in $multipart.Fields.Keys) { $body[$k] = $multipart.Fields[$k] }
                $body["_arquivos"] = $multipart.Files
            } else {
                # v2.13.0 - $request.ContentEncoding cai no padrao do Windows
                # (Windows-1252) quando o Content-Type nao traz charset, e o
                # navegador manda JSON em UTF-8: "Plantão" virava "PlantÃ£o".
                # Agora e UTF-8, salvo charset explicito no cabecalho.
                $codificacaoCorpo = [System.Text.Encoding]::UTF8
                if ($request.ContentType -and $request.ContentType -match '(?i)charset=([\w-]+)') {
                    try { $codificacaoCorpo = [System.Text.Encoding]::GetEncoding($Matches[1]) } catch { }
                }
                $reader = New-Object System.IO.StreamReader($request.InputStream, $codificacaoCorpo)
                $raw = $reader.ReadToEnd()
                $reader.Close()
                if (-not [string]::IsNullOrWhiteSpace($raw)) {
                    $body = $raw | ConvertFrom-Json
                }
            }
        }

        $usuario = Resolve-UsuarioDaRequisicao -Request $request

        if ($modulo -eq "health") {
            Send-JsonResponse -Response $response -Status 200 -Body @{ status = "ok"; hora = Get-IsoNow; usuario = $usuario.nome }
            continue
        }

        if ($usuario.usuarioId -eq "anonimo" -and -not (Test-RotaPublica -Modulo $modulo -Resto $resto)) {
            Send-JsonResponse -Response $response -Status 401 -Body @{ erro = "Não autenticado. Faça login novamente." }
            continue
        }

        # Upload de Podas (GRID_EXECUTADO/PENDENTE) é tratado à parte, fora
        # do padrão @{status;body} + Send-JsonResponse: o Controller atende
        # UM pedido por vez (este loop é single-threaded), então uma rota
        # separada de "consultar progresso" nunca seria atendida enquanto o
        # import (que pode levar minutos num arquivo de 178 mil linhas)
        # estivesse rodando — o GET ficaria na fila do SO até o POST acabar.
        # Em vez disso, a própria resposta desse POST vai sendo escrita aos
        # poucos (chunked/streaming) com uma linha JSON por atualização de
        # progresso, terminando com uma linha final com o resultado — ver
        # Invoke-PodasStreamingUpload em routes/importacao.ps1.
        if ($request.HttpMethod -eq "POST" -and $modulo -eq "importacao" -and $resto.Count -eq 1 -and ($resto[0] -eq "podas-executado" -or $resto[0] -eq "podas-historico" -or $resto[0] -eq "podas-pendente" -or $resto[0] -eq "podas-sigod" -or $resto[0] -eq "podas-sigod-pendente")) {
            Invoke-PodasStreamingUpload -Response $response -Segmento $resto[0] -Request $request -Usuario $usuario
            continue
        }

        # Upload de shapefile de rede (Rede MT/BT/AT) — mesmo raciocínio do
        # Podas acima: pode levar minutos num arquivo real (SSDMT tem
        # 427.910 registros), então a resposta vai em streaming/NDJSON — ver
        # Invoke-ShapefileStreamingUpload em routes/importacao.ps1.
        if ($request.HttpMethod -eq "POST" -and $modulo -eq "importacao" -and $resto.Count -eq 1 -and $resto[0] -eq "shapefile") {
            Invoke-ShapefileStreamingUpload -Response $response -Request $request -Usuario $usuario
            continue
        }

        # Upload da VERA (árvores) — mesmo raciocínio do shapefile/Podas:
        # arquivo real pode passar de 140 mil linhas, então o Controller lê
        # o .xlsx cru direto (Read-XlsxColunas) e a resposta vai em
        # streaming/NDJSON — ver Invoke-VeraStreamingUpload em
        # routes/importacao.ps1. Isso troca o caminho antigo (navegador
        # parseava tudo com XLSX.js e mandava um JSON gigante pro
        # /importacao/validar genérico), que era o que de fato quebrava com
        # o arquivo real — não o Controller em si.
        if ($request.HttpMethod -eq "POST" -and $modulo -eq "importacao" -and $resto.Count -eq 1 -and $resto[0] -eq "vera") {
            Invoke-VeraStreamingUpload -Response $response -Request $request -Usuario $usuario
            continue
        }

        # v2.13.0 - Vão (~793 mil linhas) e Proteção (~214 mil) também sobem
        # o .xlsx cru em streaming — ver Invoke-BaseGrandeStreamingUpload.
        if ($request.HttpMethod -eq "POST" -and $modulo -eq "importacao" -and $resto.Count -eq 1 -and ($resto[0] -eq "vao" -or $resto[0] -eq "protecao")) {
            Invoke-BaseGrandeStreamingUpload -Response $response -Request $request -Usuario $usuario -Base $(if ($resto[0] -eq "vao") { "Vao" } else { "Protecao" })
            continue
        }

        # GET /api/manutencao/camadas?ctmt=__todos__ (ou ?rl=__todos__ /
        # ?app=__todos__, Reserva Legal e APP — mesmo esquema particionado
        # por alimentador da Rede MT) — carregar "Todos os alimentadores" de
        # uma camada no mapa. Antes disso o front-end fazia UM GET por
        # alimentador em paralelo (até 335 de uma vez, num caso real) — o
        # Controller, sendo single-threaded, enfileirava a maioria deles,
        # cada um com seu próprio timeout de 30s no navegador; quando o
        # Controller finalmente chegava num pedido antigo, o navegador já
        # tinha desistido e fechado a conexão, e o Write() na resposta
        # quebrava com "O nome da rede especificado não está mais
        # disponível" (ERROR_NETNAME_DELETED) — um pedido de cada vez, em
        # cascata. Uma única resposta em streaming/NDJSON evita o fan-out
        # inteiro: 1 conexão, 1 fila, progresso real — ver
        # Invoke-CamadaTodosStream em routes/manutencao.ps1.
        if ($request.HttpMethod -eq "GET" -and $modulo -eq "manutencao" -and $resto.Count -eq 1 -and $resto[0] -eq "camadas" -and
            ($query["ctmt"] -eq "__todos__" -or $query["rl"] -eq "__todos__" -or $query["app"] -eq "__todos__" -or $query["bt"] -eq "__todos__" -or $query["at"] -eq "__todos__")) {
            $geoRoot = Join-Path $PSScriptRoot "..\geo" | Resolve-Path | Select-Object -ExpandProperty ProviderPath
            # bt/at entraram aqui na v2.11.3, quando passaram a ser
            # particionadas por alimentador igual a MT/Reserva Legal/APP
            # (ver Get-CamadaConfig) - antes disso "Todos" na BT/AT nem
            # existia, era sempre o arquivo único inteiro.
            $pastaCamada = if ($query["rl"] -eq "__todos__") { "reserva_legal" }
                elseif ($query["app"] -eq "__todos__") { "app" }
                elseif ($query["bt"] -eq "__todos__") { "rede_bt" }
                elseif ($query["at"] -eq "__todos__") { "rede_at" }
                else { "rede_mt" }
            Invoke-CamadaTodosStream -Response $response -GeoRoot $geoRoot -Pasta $pastaCamada
            continue
        }

        # GET /api/manutencao/camadas?ctmt=<X> (ou ?rl=/?app=/?bt=/?at=) — o
        # GeoJSON de UM alimentador, entregue direto do disco (v2.12.0 - ver
        # Invoke-CamadaAlimentadorRaw em routes/manutencao.ps1). Os pedidos
        # "__todos__" já foram atendidos acima; sem nenhum desses parâmetros a
        # rota normal devolve só as listas de alimentadores disponíveis.
        if ($request.HttpMethod -eq "GET" -and $modulo -eq "manutencao" -and $resto.Count -eq 1 -and $resto[0] -eq "camadas" -and
            ($query["ctmt"] -or $query["rl"] -or $query["app"] -or $query["bt"] -or $query["at"])) {
            $geoRoot = Join-Path $PSScriptRoot "..\geo" | Resolve-Path | Select-Object -ExpandProperty ProviderPath
            Invoke-CamadaAlimentadorRaw -Response $response -GeoRoot $geoRoot -Query $query
            continue
        }

        # GET /api/manutencao/vera-mapa — pontos da VERA (árvores) pro Mapa
        # de Manutenção, em streaming (mesma lógica/motivo do bloco acima -
        # ver Invoke-VeraMapaStream em routes/manutencao.ps1).
        if ($request.HttpMethod -eq "GET" -and $modulo -eq "manutencao" -and $resto.Count -eq 1 -and $resto[0] -eq "vera-mapa") {
            Invoke-VeraMapaStream -Response $response -Usuario $usuario
            continue
        }

        # v2.15.13 - CONCORRENCIA: cada usuario roda o proprio Controller, todos
        # na mesma pasta de rede; "ler o JSON -> alterar -> gravar" de dois
        # usuarios ao mesmo tempo se atropelava (o ultimo a gravar apagava a
        # alteracao do outro). Toda gravacao (POST/PUT/PATCH/DELETE) de um modulo
        # agora segura um lock por modulo (model/_locks/rota_<modulo>.lock) do
        # inicio ao fim do pedido; os outros esperam a vez (ate 6 s por tentativa; o navegador repete sozinho). Importacoes ficam de
        # fora (demoram e ja tem fila propria); leituras (GET) nao travam.
        $lockRota = $null
        if (@("POST","PUT","PATCH","DELETE") -contains $request.HttpMethod -and @("importacao","postes","equip","auth") -notcontains $modulo) {
            $lockRota = Lock-Entity -Entity "rota_$modulo" -TimeoutMs 6000 -StaleMs 90000
        }
        try {
        $resultado = switch ($modulo) {
            "equipes"      { Invoke-EquipesRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "manutencao"   { Invoke-ManutencaoRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "produtividade"{ Invoke-ProdutividadeRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "metas"        { Invoke-MetasRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "justificativas" { Invoke-JustificativasRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "programacao"  { Invoke-ProgramacaoRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "logistica"    { Invoke-LogisticaRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "postes" { Invoke-PostesRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "equip" { Invoke-EquipRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "indisponibilidades" { Invoke-IndisponibilidadesRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "alertas"      { Invoke-AlertasRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "prefeituras"  { Invoke-PrefeiturasRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "importacao"   { Invoke-ImportacaoRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "ajuda"        { Invoke-AjudaRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "listas"       { Invoke-ListasRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "cadastros"    { Invoke-CadastrosRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "usuarios"     { Invoke-UsuariosRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "permissoes"   { Invoke-PermissoesRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "auth"         { Invoke-AuthRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "ajustes"      { Invoke-AjustesRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "rank"         { Invoke-RankRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "nix"          { Invoke-NixRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "regras"       { Invoke-RegrasRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "medicao"      { Invoke-MedicaoRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "apprl"        { Invoke-AppRlRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "historico"    { Invoke-HistoricoRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            "feriados"     { Invoke-FeriadosRoute -Method $request.HttpMethod -Segments $resto -Query $query -Body $body -Usuario $usuario }
            default        { @{ status = 404; body = @{ erro = "Módulo de API desconhecido: $modulo" } } }
        }
        } finally {
            if ($lockRota) { Unlock-Entity -LockPath $lockRota }
        }

        if ($resultado.rawBytes) {
            Send-JsonResponseBytes -Response $response -Status $resultado.status -Bytes $resultado.rawBytes -Gzip ([bool]$resultado.gzip)
        } else {
            Send-JsonResponse -Response $response -Status $resultado.status -Body $resultado.body
        }

    } catch {
        Write-Host "Erro ao processar requisição: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host $_.ScriptStackTrace -ForegroundColor DarkRed
        try {
            Send-JsonResponse -Response $response -Status 500 -Body @{ erro = "Erro interno no Controller: $($_.Exception.Message)" }
        } catch { }
    }
}

$listener.Stop()
$listener.Close()
