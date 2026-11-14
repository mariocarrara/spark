# =============================================================================
# routes/medicao.ps1 - Medicao de terceiros (v3.24.0)
#   GET /api/medicao/mo   linhas de MO executadas (model/mo_linhas_executada.json) - JSON cru
# Administrador sempre; os demais so com a caixa "Medicao de terceiros (menu)" marcada na matriz (v3.26.0). A juncao OS x equipe terceira x linhas e feita no navegador.
# Precos, codigo SIAGO e auditoria NAO existem no SPARK (LGPD) - vem de outro sistema.
# =============================================================================

function Invoke-MedicaoRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "medicao" -Acao "visualizar")) {
        return @{ status = 403; body = @{ erro = "Sem permissão para a Medição de terceiros." } }
    }
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "mo") {
        $p = Get-EntityPath -Entity "mo_linhas_executada"
        if (-not (Test-Path $p)) {
            return @{ status = 200; body = @{ origem = ""; geradoEm = $null; colunas = @(); linhas = @() } }
        }
        $bytes = [System.IO.File]::ReadAllBytes($p)
        return @{ status = 200; rawBytes = $bytes; gzip = $false }
    }
    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/medicao." } }
}
