# =============================================================================
# routes/alertas.ps1 - Menu "Alertas" (v2.14.0)
#   OS Proximas / Outliers / Recurso ZERO / Configuracoes
# O calculo dos alertas roda no navegador sobre as OS ja carregadas (mesma base
# do Mapa de Manutencao); aqui ficam so os PARAMETROS editaveis e o
# TRATAMENTO de cada alerta (Em analise / Resolvido / Falso positivo), pra um
# alerta ja tratado nao voltar a aparecer a cada reimportacao.
# Permissao: usa o modulo "manutencao" (visualizar = ver; editar = tratar e
# alterar parametros).
# =============================================================================

function Invoke-AlertasRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    if ($Segments.Count -lt 1) { return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/alertas." } } }

    # GET /api/alertas/config
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "config") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para ver os alertas." } }
        }
        $reg = @(Read-JsonModel -Entity "alertas_config") | Select-Object -First 1
        if (-not $reg) { return @{ status = 200; body = @{ valores = $null } } }
        return @{ status = 200; body = $reg }
    }

    # PUT /api/alertas/config  (corpo = objeto com os parametros)
    if ($Method -eq "PUT" -and $Segments.Count -eq 1 -and $Segments[0] -eq "config") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para alterar os parâmetros dos alertas." } }
        }
        $reg = @{ valores = $Body; atualizadoEm = (Get-IsoNow); atualizadoPor = $Usuario.nome }
        Write-JsonModel -Entity "alertas_config" -Data @($reg)
        return @{ status = 200; body = $reg }
    }

    # DELETE /api/alertas/config - volta ao padrao
    if ($Method -eq "DELETE" -and $Segments.Count -eq 1 -and $Segments[0] -eq "config") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para alterar os parâmetros dos alertas." } }
        }
        Write-JsonModel -Entity "alertas_config" -Data @()
        return @{ status = 200; body = @{ valores = $null } }
    }

    # GET /api/alertas/tratados
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "tratados") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para ver os alertas." } }
        }
        return @{ status = 200; body = @(Read-JsonModel -Entity "alertas_tratados") }
    }

    # PUT /api/alertas/tratados { tipo, chave, status }   (status "" = limpa o tratamento)
    if ($Method -eq "PUT" -and $Segments.Count -eq 1 -and $Segments[0] -eq "tratados") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para tratar alertas." } }
        }
        $tipo = "$($Body.tipo)"; $chave = "$($Body.chave)"; $status = "$($Body.status)"
        if (@("proximas", "outliers", "zero") -notcontains $tipo -or -not $chave) {
            return @{ status = 400; body = @{ erro = "Alerta inválido." } }
        }
        if ($status -and @("Em análise", "Resolvido", "Falso positivo") -notcontains $status) {
            return @{ status = 400; body = @{ erro = "Status inválido." } }
        }
        $todos = @(Read-JsonModel -Entity "alertas_tratados" | Where-Object { -not ($_.tipo -eq $tipo -and "$($_.chave)" -eq $chave) })
        if ($status) {
            $todos += @{ tipo = $tipo; chave = $chave; status = $status; por = $Usuario.nome; em = (Get-IsoNow) }
        }
        Write-JsonModel -Entity "alertas_tratados" -Data $todos
        return @{ status = 200; body = @{ tipo = $tipo; chave = $chave; status = $status } }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/alertas." } }
}
