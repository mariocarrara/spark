# =============================================================================
# routes/rank.ps1 - "Rank de prioridade da programacao" (v3.6.0)
# A engenharia manda listas de elementos (protecoes) em ordem de prioridade. Cada
# lista enviada fica GUARDADA (nunca sobrescreve a anterior) com data/hora do upload,
# quem enviou, arquivo/aba, origem e metadados do Excel. O mapa mostra a lista mais
# recente; o menu "Prioridade da programacao" compara as listas entre si.
#   GET    /api/rank            metadados de todas as listas (prioridade/visualizar)
#   GET    /api/rank/atual      a lista mais recente + itens (prioridade/visualizar)
#   GET    /api/rank/{id}       uma lista + itens (prioridade/visualizar)
#   POST   /api/rank            guarda uma lista nova (prioridade/importar)
#   DELETE /api/rank/{id}       apaga uma lista (prioridade/excluirStatus)
# Arquivos: model/rank_listas.json (metadados), model/rank_itens_<id>.json (itens),
# model/rank_log.jsonl (quem enviou/apagou o que, so acrescenta).
# =============================================================================

function Write-RankLog {
    param([string]$UsuarioId, [string]$Acao, $Dados)
    try {
        $path = Join-Path (Split-Path (Get-EntityPath -Entity "rank_listas") -Parent) "rank_log.jsonl"
        $reg = [ordered]@{ t = (Get-IsoNow); u = $UsuarioId; a = $Acao; d = $Dados }
        $linha = (ConvertTo-Json -InputObject $reg -Compress -Depth 5) + "`n"
        $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($linha)
        $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
        try { $fs.Write($bytes, 0, $bytes.Length) } finally { $fs.Dispose() }
    } catch { }
}

function Get-RankTexto {
    param($Obj, [string]$Campo, [int]$Max = 120)
    $v = $null
    if ($Obj -is [System.Collections.IDictionary]) { if ($Obj.Contains($Campo)) { $v = $Obj[$Campo] } }
    elseif ($null -ne $Obj -and $Obj.PSObject.Properties[$Campo]) { $v = $Obj.PSObject.Properties[$Campo].Value }
    $t = if ($null -eq $v) { "" } else { ("$v").Trim() }
    if ($t.Length -gt $Max) { $t = $t.Substring(0, $Max) }
    return $t
}

function Get-RankDataIso {
    # aceita "yyyy-MM-dd" (com ou sem hora); qualquer outra coisa vira vazio
    param([string]$Texto)
    if ($Texto -match '^(\d{4})-(\d{2})-(\d{2})') { return "$($Matches[1])-$($Matches[2])-$($Matches[3])" }
    return ""
}

function Get-RankListaOrdenada {
    # mais recente primeiro (enviadoEm e ISO com fuso; ordenar como texto basta
    # dentro do mesmo fuso, e o id carrega o instante de criacao como desempate)
    $todas = @(Read-JsonModel -Entity "rank_listas")
    return @($todas | Sort-Object -Property @{ Expression = { "$($_.enviadoEm)" }; Descending = $true }, @{ Expression = { "$($_.id)" }; Descending = $true })
}

function Invoke-RankRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # ---------- leitura ----------
    if ($Method -eq "GET") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "prioridade" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para ver o rank de prioridade." } }
        }
        $ordenadas = Get-RankListaOrdenada
        if ($Segments.Count -eq 0) { return @{ status = 200; body = @($ordenadas) } }
        if ($Segments.Count -eq 1) {
            $chave = [System.Uri]::UnescapeDataString([string]$Segments[0])
            $lista = $null
            if ($chave -eq "atual") { $lista = $ordenadas | Select-Object -First 1 }
            else { $lista = $ordenadas | Where-Object { "$($_.id)" -eq $chave } | Select-Object -First 1 }
            if (-not $lista) {
                if ($chave -eq "atual") { return @{ status = 200; body = @{ lista = $null; itens = @() } } }
                return @{ status = 404; body = @{ erro = "Lista não encontrada." } }
            }
            $itens = @(Read-JsonModel -Entity ("rank_itens_" + $lista.id))
            return @{ status = 200; body = @{ lista = $lista; itens = $itens } }
        }
        return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/rank." } }
    }

    # ---------- guardar lista nova ----------
    if ($Method -eq "POST" -and $Segments.Count -eq 0) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "prioridade" -Acao "importar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para enviar listas de prioridade." } }
        }
        $brutos = @($Body.itens)
        if ($brutos.Count -eq 0) { return @{ status = 400; body = @{ erro = "A lista veio vazia." } } }
        if ($brutos.Count -gt 20000) { return @{ status = 400; body = @{ erro = "Lista grande demais (máximo 20.000 linhas)." } } }

        $itens = New-Object System.Collections.ArrayList
        $vistos = @{}
        $motivos = New-Object System.Collections.ArrayList
        $rejeitadas = 0
        $comData = 0
        $n = 0
        foreach ($b in $brutos) {
            $n++
            $elem = Get-RankTexto -Obj $b -Campo "e" -Max 60
            $rk = 0
            $rkTxt = Get-RankTexto -Obj $b -Campo "r" -Max 12
            [void][int]::TryParse($rkTxt, [ref]$rk)
            $motivo = $null
            if (-not $elem) { $motivo = "elemento em branco" }
            elseif ($rk -lt 1) { $motivo = "prioridade inválida ($rkTxt)" }
            elseif ($vistos.ContainsKey($elem.ToUpper())) { $motivo = "elemento repetido ($elem)" }
            if ($motivo) {
                $rejeitadas++
                if ($motivos.Count -lt 20) { [void]$motivos.Add("linha ${n}: $motivo") }
                continue
            }
            $vistos[$elem.ToUpper()] = $true
            $dec = $null
            $decTxt = Get-RankTexto -Obj $b -Campo "dec" -Max 40
            if ($decTxt) {
                $d = 0.0
                if ([double]::TryParse($decTxt, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$d)) { $dec = $d }
            }
            $di = Get-RankDataIso -Texto (Get-RankTexto -Obj $b -Campo "di" -Max 20)
            $df = Get-RankDataIso -Texto (Get-RankTexto -Obj $b -Campo "df" -Max 20)
            if ($di) { $comData++ }
            [void]$itens.Add([ordered]@{
                e = $elem; r = $rk; dec = $dec
                trecho = (Get-RankTexto -Obj $b -Campo "trecho" -Max 20)
                alim = (Get-RankTexto -Obj $b -Campo "alim" -Max 60)
                reg = (Get-RankTexto -Obj $b -Campo "reg" -Max 40)
                polo = (Get-RankTexto -Obj $b -Campo "polo" -Max 60)
                conj = (Get-RankTexto -Obj $b -Campo "conj" -Max 80)
                plano = (Get-RankTexto -Obj $b -Campo "plano" -Max 60)
                di = $di; df = $df
            })
        }
        if ($itens.Count -eq 0) {
            return @{ status = 400; body = @{ erro = "Nenhuma linha válida na lista."; motivos = @($motivos) } }
        }
        $ordenados = @($itens | Sort-Object -Property @{ Expression = { [int]$_.r } })

        $agora = Get-IsoNow
        $id = "L" + (Get-Date).ToString("yyyyMMddHHmmssfff")
        $nome = "$($Usuario.nome)"
        $meta = [ordered]@{
            id = $id
            enviadoEm = $agora
            enviadoPor = $Usuario.usuarioId
            enviadoPorNome = $nome
            arquivo = (Get-RankTexto -Obj $Body -Campo "arquivo" -Max 200)
            aba = (Get-RankTexto -Obj $Body -Campo "aba" -Max 80)
            referencia = (Get-RankTexto -Obj $Body -Campo "referencia" -Max 120)
            origem = (Get-RankTexto -Obj $Body -Campo "origem" -Max 300)
            autorArquivo = (Get-RankTexto -Obj $Body -Campo "autor" -Max 120)
            criadoArquivoEm = (Get-RankTexto -Obj $Body -Campo "criadoArquivoEm" -Max 40)
            modificadoArquivoEm = (Get-RankTexto -Obj $Body -Campo "modificadoArquivoEm" -Max 40)
            hash = (Get-RankTexto -Obj $Body -Campo "hash" -Max 80)
            linhas = $ordenados.Count
            comData = $comData
            rejeitadas = $rejeitadas
        }
        Write-JsonModel -Entity ("rank_itens_" + $id) -Data @($ordenados)
        $todas = @(Read-JsonModel -Entity "rank_listas")
        Write-JsonModel -Entity "rank_listas" -Data @(@($todas) + @($meta))
        Write-RankLog -UsuarioId $Usuario.usuarioId -Acao "enviar" -Dados ([ordered]@{ id = $id; arquivo = $meta.arquivo; aba = $meta.aba; linhas = $meta.linhas; rejeitadas = $rejeitadas })
        return @{ status = 200; body = @{ ok = $true; lista = $meta; recebidas = $brutos.Count; validas = $ordenados.Count; rejeitadas = $rejeitadas; motivos = @($motivos) } }
    }

    # ---------- apagar lista ----------
    if ($Method -eq "DELETE" -and $Segments.Count -eq 1) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "prioridade" -Acao "excluirStatus")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para apagar listas de prioridade." } }
        }
        $id = [System.Uri]::UnescapeDataString([string]$Segments[0])
        if ($id -notmatch '^L\d{10,20}$') { return @{ status = 400; body = @{ erro = "Identificador de lista inválido." } } }
        $todas = @(Read-JsonModel -Entity "rank_listas")
        $alvo = $todas | Where-Object { "$($_.id)" -eq $id } | Select-Object -First 1
        if (-not $alvo) { return @{ status = 404; body = @{ erro = "Lista não encontrada." } } }
        Write-JsonModel -Entity "rank_listas" -Data @($todas | Where-Object { "$($_.id)" -ne $id })
        try {
            $arq = Get-EntityPath -Entity ("rank_itens_" + $id)
            if (Test-Path $arq) { Remove-Item -LiteralPath $arq -Force }
        } catch { }
        Write-RankLog -UsuarioId $Usuario.usuarioId -Acao "apagar" -Dados ([ordered]@{ id = $id; arquivo = "$($alvo.arquivo)"; aba = "$($alvo.aba)"; enviadoEm = "$($alvo.enviadoEm)"; linhas = $alvo.linhas })
        return @{ status = 200; body = @{ ok = $true; id = $id } }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/rank." } }
}
