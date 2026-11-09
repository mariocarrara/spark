# =============================================================================
# routes/feriados.ps1 — usado pelo cálculo de dias úteis em Produtividade
# (Detalhamento Técnico, seção 2.9). Sem seção de endpoints própria no
# documento original de escopo, mas listado explicitamente na tabela de
# endpoints do Detalhamento Técnico (seção 3.7).
# =============================================================================

function Invoke-FeriadosRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # GET /api/feriados
    if ($Method -eq "GET" -and $Segments.Count -eq 0) {
        return @{ status = 200; body = @(Read-JsonModel -Entity "feriados") }
    }

    # POST /api/feriados
    if ($Method -eq "POST" -and $Segments.Count -eq 0) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "usuarios" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para cadastrar feriados." } }
        }
        $feriados = @(Read-JsonModel -Entity "feriados")
        $novo = @{ data = $Body.data; descricao = $Body.descricao; abrangencia = $Body.abrangencia }
        $feriados += $novo
        Write-JsonModel -Entity "feriados" -Data $feriados
        return @{ status = 201; body = $novo }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/feriados." } }
}
