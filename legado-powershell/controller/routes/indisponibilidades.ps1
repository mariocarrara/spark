# =============================================================================
# Indisponibilidade de equipes (v2.14.1)
# GET    /api/indisponibilidades          lista (nao excluidas)
# POST   /api/indisponibilidades          { equipeId, dataInicio, dataFim, tipo, texto }
# DELETE /api/indisponibilidades/{id}     exclusao logica (flag)
# Entidade: "indisponibilidades". A tela fica na Gestao de Bases; o front usa
# os periodos para (1) avisar o programador ao escolher a equipe e (2) tirar a
# meta da equipe nos dias indisponiveis (Produtividade).
# =============================================================================
function Invoke-IndisponibilidadesRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    if ($Method -eq "GET" -and $Segments.Count -eq 0) {
        $pode = (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "produtividade" -Acao "visualizar") -or
                (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "programacao" -Acao "visualizar") -or
                (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")
        if (-not $pode) { return @{ status = 403; body = @{ erro = "Sem permissão para ver Indisponibilidades." } } }
        $lista = @(Read-JsonModel -Entity "indisponibilidades") | Where-Object { -not $_.excluido }
        return @{ status = 200; body = @($lista) }
    }

    if ($Method -eq "POST" -and $Segments.Count -eq 0) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "produtividade" -Acao "criar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para registrar Indisponibilidades." } }
        }
        $equipeId = "$($Body.equipeId)".Trim()
        $ini = "$($Body.dataInicio)".Trim(); $fim = "$($Body.dataFim)".Trim()
        $tipo = "$($Body.tipo)".Trim()
        if (-not $equipeId) { return @{ status = 400; body = @{ erro = "Informe a equipe." } } }
        if ($ini -notmatch '^\d{4}-\d{2}-\d{2}$' -or $fim -notmatch '^\d{4}-\d{2}-\d{2}$') { return @{ status = 400; body = @{ erro = "Informe as datas no formato AAAA-MM-DD." } } }
        if ($fim -lt $ini) { return @{ status = 400; body = @{ erro = "A data final não pode ser antes da inicial." } } }
        if (-not $tipo) { return @{ status = 400; body = @{ erro = "Informe o motivo (tipo)." } } }
        $novo = @{
            id = New-EntityId
            equipeId = $equipeId
            dataInicio = $ini
            dataFim = $fim
            tipo = $tipo
            texto = "$($Body.texto)".Trim()
            autorId = $Usuario.usuarioId
            criadoEm = Get-IsoNow
        }
        $todas = @(Read-JsonModel -Entity "indisponibilidades") + $novo
        Write-JsonModel -Entity "indisponibilidades" -Data $todas
        return @{ status = 201; body = $novo }
    }

    if ($Method -eq "DELETE" -and $Segments.Count -eq 1) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "gestaoBases" -Acao "excluirStatus")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para excluir Indisponibilidades." } }
        }
        $idAlvo = [string]$Segments[0]
        $todas = @(Read-JsonModel -Entity "indisponibilidades")
        $achou = $false
        foreach ($j in $todas) {
            if ([string]$j.id -eq $idAlvo -and -not $j.excluido) {
                Set-PropValor -Objeto $j -Nome "excluido" -Valor $true
                Set-PropValor -Objeto $j -Nome "excluidoPor" -Valor $Usuario.usuarioId
                Set-PropValor -Objeto $j -Nome "excluidoEm" -Valor (Get-IsoNow)
                $achou = $true
                break
            }
        }
        if (-not $achou) { return @{ status = 404; body = @{ erro = "Indisponibilidade não encontrada." } } }
        Write-JsonModel -Entity "indisponibilidades" -Data $todas
        return @{ status = 200; body = @{ ok = $true; id = $idAlvo } }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/indisponibilidades." } }
}
