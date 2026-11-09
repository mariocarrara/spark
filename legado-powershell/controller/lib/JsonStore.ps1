# =============================================================================
# JsonStore.ps1
# Funções genéricas de leitura/gravação dos arquivos JSON em model/, com
# controle de concorrência via arquivo de lock (model/_locks/<entidade>.lock).
#
# Por que lock de arquivo em vez de Mutex nomeado:
# o sistema roda como um processo PowerShell por usuário (15-20 simultâneos),
# cada um em uma máquina Windows diferente, todos apontando para a mesma
# pasta compartilhada em FTP/rede interna. Um Mutex nomeado só sincroniza
# processos na MESMA máquina; entre máquinas diferentes só um mecanismo que
# passe pelo próprio sistema de arquivos de rede funciona - por isso usamos
# criação exclusiva de arquivo de lock (retry com backoff) como no
# Detalhamento Técnico (seção 1.2: "arquivo de lock por entidade em
# model/_locks/").
# =============================================================================

# v3.14.1 - cria a pasta model se ela nao existir (pacote novo extraido do zero, sem os dados): antes o Controller parava aqui
New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot "..\..\model") | Out-Null
$Script:ModelRoot = Join-Path $PSScriptRoot "..\..\model" | Resolve-Path | Select-Object -ExpandProperty ProviderPath
$Script:LocksRoot  = Join-Path $Script:ModelRoot "_locks"

# O Windows PowerShell 5.1 (edição "Desktop", o que o iniciar.bat realmente
# usa em produção) NUNCA converte string de data em [datetime] no
# ConvertFrom-Json — só o PowerShell 7+ ("Core") faz isso. Ou seja,
# ConvertTo-IsoDatesDeep (abaixo) é trabalho puro perdido na 5.1: varrer
# ~21 mil OS de Podas properties por properties só pra confirmar "não é
# datetime" custava vários segundos por requisição à toa. Calculado uma vez
# aqui e usado em Read-JsonModel pra pular a varredura inteira quando não
# faz diferença nenhuma no resultado.
$Script:PrecisaNormalizarDatas = ($PSVersionTable.PSEdition -eq 'Core')

# v2.15.13 - locks "reentrantes": o mesmo processo pode pedir de novo um lock
# que ele mesmo ja segura (ex.: a rota segura o lock da programacao do inicio
# da leitura ate a gravacao e o Write-JsonModel pede o mesmo lock por dentro).
# O Controller atende um pedido por vez, entao um contador simples basta.
$Script:LocksHeld = @{}

if (-not (Test-Path $Script:LocksRoot)) {
    New-Item -ItemType Directory -Path $Script:LocksRoot -Force | Out-Null
}

function Get-EntityPath {
    param([Parameter(Mandatory)][string]$Entity)
    return Join-Path $Script:ModelRoot "$Entity.json"
}

function Lock-Entity {
    <#
        Cria um arquivo de lock exclusivo para a entidade. Tenta por até
        $TimeoutMs, com pequenas pausas entre tentativas. Se o lock existente
        for mais velho que $StaleMs, assume que pertence a um processo que
        travou e o remove (evita deadlock permanente por queda do PowerShell
        de outro usuário no meio de uma escrita).
    #>
    param(
        [Parameter(Mandatory)][string]$Entity,
        [int]$TimeoutMs = 5000,
        [int]$StaleMs = 15000
    )
    $lockPath = Join-Path $Script:LocksRoot "$Entity.lock"
    if ($Script:LocksHeld.ContainsKey($Entity)) { $Script:LocksHeld[$Entity]++; return $lockPath }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($true) {
        try {
            $fs = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            $writer = New-Object System.IO.StreamWriter($fs)
            $writer.WriteLine((Get-Date).ToString("o"))
            $writer.WriteLine($PID)
            $writer.Flush()
            $writer.Close()
            $fs.Close()
            $Script:LocksHeld[$Entity] = 1
            return $lockPath
        } catch [System.IO.IOException] {
            if (Test-Path $lockPath) {
                $age = (Get-Date) - (Get-Item $lockPath).CreationTime
                if ($age.TotalMilliseconds -gt $StaleMs) {
                    try { Remove-Item $lockPath -Force -ErrorAction Stop } catch { }
                    continue
                }
            }
            if ($sw.ElapsedMilliseconds -gt $TimeoutMs) {
                throw "Timeout aguardando lock de '$Entity' (outro usuário está gravando). Tente novamente em instantes."
            }
            Start-Sleep -Milliseconds (50 + (Get-Random -Minimum 0 -Maximum 150))
        }
    }
}

function Unlock-Entity {
    param([Parameter(Mandatory)][string]$LockPath)
    $ent = [System.IO.Path]::GetFileNameWithoutExtension($LockPath)
    if ($Script:LocksHeld.ContainsKey($ent)) {
        $Script:LocksHeld[$ent]--
        if ($Script:LocksHeld[$ent] -gt 0) { return }
        $Script:LocksHeld.Remove($ent)
    }
    if (Test-Path $LockPath) {
        Remove-Item $LockPath -Force -ErrorAction SilentlyContinue
    }
}

function ConvertTo-IsoDatesDeep {
    <#
        ConvertFrom-Json (PowerShell 7+) converte automaticamente qualquer
        string no formato ISO 8601 com hora (ex.: "2026-09-26T00:00:00-03:00")
        em um objeto [datetime] real - mas NÃO faz isso com datas "puras"
        (ex.: "2026-09-26"), que continuam string. Isso criava uma
        inconsistência séria: registros antigos (com hora) viravam DateTime
        ao serem lidos, enquanto registros novos gravados pela própria API
        (que grava só a data, sem hora) continuavam string - duas
        representações diferentes pro "mesmo tipo de campo", quebrando
        comparação de texto (ex.: detecção de conflito de programação) e
        arriscando formatar a data de um jeito diferente (cultura en-US) na
        próxima gravação. Esta função varre a árvore lida e converte todo
        [datetime] de volta pra string ISO 8601, sempre no mesmo formato.
    #>
    param($Value)
    if ($null -eq $Value) { return $null }
    if ($Value -is [datetime]) {
        return $Value.ToString("yyyy-MM-ddTHH:mm:sszzz")
    }
    if ($Value -is [string]) { return $Value }
    if ($Value -is [System.Collections.IEnumerable]) {
        # Lista .NET em vez de "$result += item" — com $result como array
        # comum, cada "+=" recria o array inteiro do zero (custo O(n) por
        # item, O(n²) no total). Pra uma base de ~21 mil OS (Podas) isso
        # sozinho levava mais de 20s por requisição — a lista resolve isso
        # (Add é O(1) amortizado).
        $result = New-Object System.Collections.Generic.List[object]
        foreach ($item in $Value) { $result.Add((ConvertTo-IsoDatesDeep -Value $item)) }
        return , $result.ToArray()
    }
    if ($Value -is [System.Management.Automation.PSCustomObject]) {
        foreach ($prop in @($Value.PSObject.Properties)) {
            $v = $prop.Value
            # Só recursa (chamada de função de verdade, cara em PowerShell)
            # quando o valor PODE precisar de conversão — datetime, objeto
            # aninhado (ex.: localizacao) ou lista. Pra string/bool/número/
            # null (a grande maioria dos campos) pula direto: sem isso, uma
            # base de ~21 mil OS (~15 campos cada) fazia ~300 mil chamadas
            # recursivas só pra confirmar "não é data" em campos que nunca
            # seriam - é a diferença entre a rota /manutencao/os responder
            # em ~13s ou em bem menos de 1s.
            if ($null -eq $v -or $v -is [datetime] -or $v -is [System.Management.Automation.PSCustomObject] -or ($v -is [System.Collections.IEnumerable] -and $v -isnot [string])) {
                $prop.Value = ConvertTo-IsoDatesDeep -Value $v
            }
        }
        return $Value
    }
    return $Value
}

function Read-ArquivoTextoCompartilhado {
    <# v2.15.14 - le o arquivo SEM impedir que outro usuario o substitua.
       Get-Content abre com FileShare.Read: enquanto um Controller le o
       programacao.json, o Move-Item de outro Controller (que troca o arquivo
       pelo novo) falha com "Acesso negado ao caminho". Aqui abrimos com
       FileShare ReadWrite+Delete (o leitor continua vendo a versao antiga
       inteira) e tentamos de novo se o arquivo estiver no meio da troca. #>
    param([Parameter(Mandatory)][string]$Path)
    $ultimo = $null
    for ($i = 0; $i -lt 8; $i++) {
        try {
            $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete))
            try {
                $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8, $true)
                return $sr.ReadToEnd()
            } finally { $fs.Dispose() }
        } catch [System.IO.FileNotFoundException] { return "" }
          catch [System.IO.DirectoryNotFoundException] { return "" }
          catch { $ultimo = $_; Start-Sleep -Milliseconds (80 + (Get-Random -Minimum 0 -Maximum 120)) }
    }
    throw $ultimo
}

function Read-JsonModel {
    <# Lê e desserializa um arquivo model/<Entity>.json. Retorna @() se o
       arquivo não existir ou estiver vazio. #>
    param([Parameter(Mandatory)][string]$Entity)
    $path = Get-EntityPath -Entity $Entity
    if (-not (Test-Path $path)) { return @() }
    $raw = Read-ArquivoTextoCompartilhado -Path $path
    if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
    $data = $raw | ConvertFrom-Json
    # Pegadinha própria do Windows PowerShell 5.1 (edição "Desktop", a que o
    # iniciar.bat usa em produção - PowerShell 7+/Core não tem esse
    # problema): ConvertFrom-Json num JSON de array vazio ("[]") devolve
    # $null, não uma lista vazia de verdade. Isso ficou escondido até agora
    # porque nenhum model/*.json tinha ficado vazio em produção - só apareceu
    # depois do botão "Apagar tudo" (v2.8.0), e só quebrou de verdade em
    # rotas que devolvem o retorno de Read-JsonModel direto, sem envolver
    # em "@(...)" (ex.: GET /logistica/vinculos) - aí o front-end recebia
    # "null" em vez de "[]"/"{}" e quebrava tentando ler uma propriedade de
    # null. Normalizado aqui, na origem, pra ninguém mais precisar lembrar
    # dessa pegadinha em cada rota que usa Read-JsonModel.
    if ($null -eq $data -and $raw.TrimStart().StartsWith('[')) { $data = @() }
    if ($Script:PrecisaNormalizarDatas) { $data = ConvertTo-IsoDatesDeep -Value $data }
    # ConvertFrom-Json devolve um único objeto (não array) quando o JSON raiz
    # é um objeto e não uma lista - normalizamos pro chamador não precisar
    # tratar os dois casos.
    return $data
}

function Save-BackupRotativo {
    <# v3.0.7 - copia de seguranca automatica ANTES de sobrescrever um model/*.json importante.
       Guarda em model/<Pasta>/<Prefixo>_AAAAMMDD-HHMMSS.json, no maximo uma por intervalo, e
       mantem so as ultimas $Manter. Qualquer falha aqui e ignorada (nao pode travar a gravacao). #>
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Pasta,
        [Parameter(Mandatory)][string]$Prefixo,
        [int]$Manter = 40,
        [int]$IntervaloSeg = 60
    )
    try {
        if (-not (Test-Path -LiteralPath $Path)) { return }
        if ((Get-Item -LiteralPath $Path).Length -lt 3) { return }
        $dir = Join-Path (Split-Path $Path -Parent) $Pasta
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        $arqs = @(Get-ChildItem -LiteralPath $dir -Filter "$Prefixo`_*.json" -File | Sort-Object Name -Descending)
        if ($arqs.Count -gt 0) {
            $ts = $arqs[0].BaseName.Substring($Prefixo.Length + 1)
            $ult = [datetime]::MinValue
            if ([datetime]::TryParseExact($ts, 'yyyyMMdd-HHmmss', [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::None, [ref]$ult)) {
                if (((Get-Date) - $ult).TotalSeconds -lt $IntervaloSeg) { return }
            }
        }
        $dest = Join-Path $dir ("{0}_{1}.json" -f $Prefixo, (Get-Date -Format 'yyyyMMdd-HHmmss'))
        Copy-Item -LiteralPath $Path -Destination $dest -Force
        $arqs = @(Get-ChildItem -LiteralPath $dir -Filter "$Prefixo`_*.json" -File | Sort-Object Name -Descending)
        if ($arqs.Count -gt $Manter) { $arqs | Select-Object -Skip $Manter | Remove-Item -Force -ErrorAction SilentlyContinue }
    } catch { }
}

function Write-JsonModel {
    <# Serializa e grava $Data em model/<Entity>.json, sob lock exclusivo.
       Escreve primeiro em um arquivo temporário e só então substitui o
       arquivo final (rename atômico), pra nunca deixar o JSON pela metade
       caso o processo seja interrompido no meio da gravação. #>
    param(
        [Parameter(Mandatory)][string]$Entity,
        [Parameter(Mandatory)]$Data
    )
    $path = Get-EntityPath -Entity $Entity
    $lock = Lock-Entity -Entity $Entity
    try {
        # v3.0.7 - programacao e dado que NAO pode se perder: copia de seguranca antes de cada gravacao
        if ($Entity -eq 'programacao') { Save-BackupRotativo -Path $path -Pasta 'backup_programacao' -Prefixo 'programacao' -Manter 40 -IntervaloSeg 60 }
        $tmpPath = "$path.tmp"
        # "$Data | ConvertTo-Json" (com PIPE) devolve $null quando $Data é uma
        # coleção VAZIA (o pipeline chama ConvertTo-Json zero vezes - nenhum
        # item passa por ele) - não "[]". Gravar isso dava um arquivo em
        # branco (0 bytes) em vez de uma lista vazia de verdade; Read-JsonModel
        # disfarçava isso (trata arquivo em branco como @()), mas era frágil
        # e foi o que descobrimos logo depois de usar o botão "Apagar tudo"
        # pela primeira vez (toda base zerada virava arquivo em branco, e
        # Send-JsonResponse - mesma pegadinha de pipe - quebrava ao tentar
        # devolver essas listas vazias pro navegador). Usando -InputObject em
        # vez de pipe, ConvertTo-Json trata a coleção como um ÚNICO
        # argumento e serializa "[]" corretamente mesmo vazia.
        # REGRA (v3.1.14): todo JSON do sistema e gravado COMPACTO (-Compress), sem indentacao. Arquivo nao precisa
        # ser legivel por humano: fica bem menor e le/comprime/envia mais rapido (o conteudo e o mesmo JSON).
        $json = ConvertTo-Json -InputObject $Data -Depth 12 -Compress
        if ($null -eq $json) { $json = "[]" }
        # ConvertTo-Json com um único item na lista devolve um objeto, não
        # array - forçamos o formato de array quando necessário.
        if ($Data -is [System.Collections.IEnumerable] -and -not ($Data -is [string]) -and $Data.Count -eq 1 -and $json.TrimStart()[0] -ne '[') {
            $json = "[$json]"
        }
        Set-Content -Path $tmpPath -Value $json -Encoding UTF8 -NoNewline
        # v2.15.14 - trocar o arquivo pode falhar na hora ("Acesso negado ao
        # caminho") se outro usuario/antivirus/indexador estiver com ele aberto
        # naquele instante: tenta de novo por ~6 s antes de desistir.
        $trocou = $false; $erroTroca = $null
        for ($tent = 0; $tent -lt 30; $tent++) {
            try { Move-Item -Path $tmpPath -Destination $path -Force -ErrorAction Stop; $trocou = $true; break }
            catch { $erroTroca = $_; Start-Sleep -Milliseconds (100 + (Get-Random -Minimum 0 -Maximum 200)) }
        }
        if (-not $trocou) { throw $erroTroca }
    } finally {
        Unlock-Entity -LockPath $lock
    }
}

function New-EntityId {
    param([string]$Prefix)
    $guid = [guid]::NewGuid().ToString()
    if ($Prefix) { return "$Prefix-$guid" }
    return $guid
}

function Get-IsoNow {
    return (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
}

function Set-PropValor {
    # Objetos lidos do JSON (PSCustomObject) nao aceitam atribuir propriedade
    # que ainda nao existe - Add-Member -Force cobre os dois casos.
    param($Objeto, [string]$Nome, $Valor)
    # v2.15.22 - atalho: se a propriedade ja existe, so troca o valor (Add-Member -Force e
    # MUITO lento no PS 5.1 e e chamado centenas de milhares de vezes ao reaplicar os postes).
    $prop = $Objeto.PSObject.Properties[$Nome]
    if ($prop) { $prop.Value = $Valor; return }
    $Objeto | Add-Member -NotePropertyName $Nome -NotePropertyValue $Valor -Force
}
