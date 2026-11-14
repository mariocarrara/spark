# =============================================================================
# routes/regras.ps1 - Regras de importacao editaveis (v3.33.0)
#   GET    /api/regras                lista + catalogo de campos/funcoes + se o Vao ja foi importado
#   POST   /api/regras                cria
#   PUT    /api/regras/<id>           altera (inclusive ativar/desativar)
#   DELETE /api/regras/<id>           apaga
#   POST   /api/regras/validar        { formula } -> { ok, erro, campos }
#   POST   /api/regras/simular        { regra, amostra } -> valores antes/depois
#   GET    /api/regras/historico      alteracoes (usuario, data, antes e depois)
# Acesso: administrador; os demais so com a caixa "Regras de importacao (menu)" marcada.
# =============================================================================

function ConvertTo-RegraHash {
    param($B, $IdFixo)
    $conds = @(); foreach ($c in @($B.condicoes)) { $conds += [ordered]@{ campo = [string]$c.campo; op = [string]$c.op; valor = [string]$c.valor } }
    $acoes = @(); foreach ($a in @($B.acoes)) { $acoes += [ordered]@{ campo = [string]$a.campo; valor = [string]$a.valor } }
    return [ordered]@{
        id = $IdFixo; nome = ([string]$B.nome).Trim(); descricao = ([string]$B.descricao).Trim()
        ativa = [bool]$B.ativa; ordem = [int]$B.ordem; aplicaEm = @(@($B.aplicaEm) | ForEach-Object { [string]$_ })
        condicoes = $conds; acoes = $acoes
    }
}

function Invoke-RegrasRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "regras" -Acao "visualizar")) {
        return @{ status = 403; body = @{ erro = "Sem permissão para as Regras de importação." } }
    }
    $agora = (Get-Date).ToString('s')

    if ($Method -eq "GET" -and $Segments.Count -eq 0) {
        $vao = (Test-Path -LiteralPath (Join-Path $Script:ModelRoot 'vao_postes.tsv'))
        return @{ status = 200; body = @{ regras = @(Get-RegrasTodas); campos = @(Get-RegrasCampos); funcoes = @(Get-RegrasFuncoes); vaoImportado = $vao } }
    }
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "historico") {
        $h = @(Read-JsonModel -Entity 'regras_historico')
        [array]::Reverse($h)
        return @{ status = 200; body = @($h | Select-Object -First 200) }
    }
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "validar") {
        return @{ status = 200; body = (Test-RegraFormula -Formula ([string]$Body.formula)) }
    }
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "simular") {
        $r = ConvertTo-RegraHash -B $Body.regra -IdFixo 'simulacao'
        $erros = @(Test-RegraValida -R $r)
        if ($erros.Count -gt 0) { return @{ status = 400; body = @{ erro = ($erros -join ' '); erros = $erros } } }
        $am = $Body.amostra
        $num = { param($v) $x = 0.0; if ($null -ne $v -and [double]::TryParse(([string]$v).Replace(',', '.'), [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$x)) { return $x } else { return 0.0 } }
        $ctx = @{
            esquema = [string]$am.esquema; tipoServico = [string]$am.tipoServico
            previstoPoda = (& $num $am.previstoPoda); previstoLimpeza = (& $num $am.previstoLimpeza); previstoEstrutura = (& $num $am.previstoEstrutura)
            realizadoPoda = (& $num $am.realizadoPoda); realizadoLimpeza = (& $num $am.realizadoLimpeza); realizadoEstrutura = (& $num $am.realizadoEstrutura)
            vaoKm = (& $num $am.vaoKm); soPrevisto = (& $num $am.soPrevisto)
        }
        Update-RegraCtxTotais $ctx
        $antes = @{}; foreach ($k in $ctx.Keys) { $antes[$k] = $ctx[$k] }
        $res = Invoke-RegrasNoCtx -Regras @([pscustomobject]$r) -Ctx $ctx
        return @{ status = 200; body = @{ antes = $antes; depois = $ctx; aplicou = ($res.aplicadas.Count -gt 0); erro = $(if ($res.ignoradas.Count -gt 0) { $res.ignoradas[0].motivo } else { $null }) } }
    }

    $todas = @(Get-RegrasTodas)
    if ($Method -eq "POST" -and $Segments.Count -eq 0) {
        $id = 'r' + [guid]::NewGuid().ToString('N').Substring(0, 10)
        $r = ConvertTo-RegraHash -B $Body -IdFixo $id
        if ($r.ordem -le 0) { $r.ordem = ($todas.Count + 1) }
        $erros = @(Test-RegraValida -R $r)
        if ($erros.Count -gt 0) { return @{ status = 400; body = @{ erro = ($erros -join ' '); erros = $erros } } }
        $r.atualizadoPor = [string]$Usuario.nome; $r.atualizadoEm = $agora
        Write-JsonModel -Entity 'regras' -Data @($todas + $r)
        Add-RegraHistorico -RegraId $id -Nome $r.nome -Acao 'criada' -Antes $null -Depois $r -Usuario $Usuario.nome
        return @{ status = 201; body = $r }
    }
    if ($Method -eq "PUT" -and $Segments.Count -eq 1) {
        $id = [string]$Segments[0]
        $ant = $todas | Where-Object { $_.id -eq $id } | Select-Object -First 1
        if (-not $ant) { return @{ status = 404; body = @{ erro = "Regra não encontrada." } } }
        $r = ConvertTo-RegraHash -B $Body -IdFixo $id
        $erros = @(Test-RegraValida -R $r)
        if ($erros.Count -gt 0) { return @{ status = 400; body = @{ erro = ($erros -join ' '); erros = $erros } } }
        $r.atualizadoPor = [string]$Usuario.nome; $r.atualizadoEm = $agora
        $nova = @(); foreach ($x in $todas) { if ($x.id -eq $id) { $nova += $r } else { $nova += $x } }
        Write-JsonModel -Entity 'regras' -Data $nova
        $acao = 'alterada'; if ([bool]$ant.ativa -ne [bool]$r.ativa) { $acao = $(if ($r.ativa) { 'ativada' } else { 'desativada' }) }
        Add-RegraHistorico -RegraId $id -Nome $r.nome -Acao $acao -Antes $ant -Depois $r -Usuario $Usuario.nome
        return @{ status = 200; body = $r }
    }
    if ($Method -eq "DELETE" -and $Segments.Count -eq 1) {
        $id = [string]$Segments[0]
        $ant = $todas | Where-Object { $_.id -eq $id } | Select-Object -First 1
        if (-not $ant) { return @{ status = 404; body = @{ erro = "Regra não encontrada." } } }
        Write-JsonModel -Entity 'regras' -Data @($todas | Where-Object { $_.id -ne $id })
        Add-RegraHistorico -RegraId $id -Nome $ant.nome -Acao 'apagada' -Antes $ant -Depois $null -Usuario $Usuario.nome
        return @{ status = 200; body = @{ ok = $true } }
    }
    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/regras." } }
}
