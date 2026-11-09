# =============================================================================
# Postes (v2.14.3)
# GET  /api/postes/resumo   -> { total, porTipo, atualizadoEm, atualizadoPor, arquivo } da base PONNOT
# GET  /api/postes/area?sul&oeste&norte&leste&tipos&limite -> pontos para a camada Ativos
# GET  /api/postes/lista?busca&tipo&pagina -> lista paginada (Gestao de Bases > Ativos)
# DELETE /api/postes?confirmar=sim -> apaga a base de postes
# POST /api/postes/aplicar  -> reaplica VERA > XY > Poste > cidade nas OS ja gravadas
# A importacao do PONNOT em si usa POST /api/importacao/shapefile (camada "postes").
# =============================================================================
function Invoke-PostesRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "resumo") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para ver a base de Postes." } }
        }
        $meta = @(Read-JsonModel -Entity "postes_meta") | Select-Object -First 1
        if (-not $meta) { return @{ status = 200; body = @{ total = 0 } } }
        return @{ status = 200; body = $meta }
    }

    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "area") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para ver a base de Postes." } }
        }
        $inv = [System.Globalization.CultureInfo]::InvariantCulture
        try {
            $sul = [double]::Parse("$($Query['sul'])", $inv); $oeste = [double]::Parse("$($Query['oeste'])", $inv)
            $norte = [double]::Parse("$($Query['norte'])", $inv); $leste = [double]::Parse("$($Query['leste'])", $inv)
        } catch { return @{ status = 400; body = @{ erro = "Parâmetros sul, oeste, norte e leste são obrigatórios." } } }
        $lim = 4000
        if ($Query["limite"]) { $lim = [math]::Max(1, [math]::Min(8000, [int]$Query["limite"])) }
        $res = Get-PostesArea -Sul $sul -Oeste $oeste -Norte $norte -Leste $leste -Tipos "$($Query['tipos'])" -Limite $lim
        return @{ status = 200; body = $res }
    }

    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "lista") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para ver a base de Postes." } }
        }
        $pg = 1; if ($Query["pagina"]) { $pg = [math]::Max(1, [int]$Query["pagina"]) }
        $res = Get-PostesLista -Busca "$($Query['busca'])".Trim() -Tipo "$($Query['tipo'])".Trim() -Pagina $pg -Tamanho 50
        return @{ status = 200; body = $res }
    }

    if ($Method -eq "DELETE" -and $Segments.Count -eq 0) {
        if (-not ((Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "importar") -and
                  (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar"))) {
            return @{ status = 403; body = @{ erro = "Sem permissão para apagar a base de Postes." } }
        }
        if ("$($Query['confirmar'])" -ne "sim") { return @{ status = 400; body = @{ erro = "Falta a confirmação (confirmar=sim)." } } }
        Remove-PostesBase
        return @{ status = 200; body = @{ ok = $true } }
    }

    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "aplicar") {
        if (-not ((Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "importar") -and
                  (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar"))) {
            return @{ status = 403; body = @{ erro = "Sem permissão para reaplicar a posição das OS." } }
        }
        $st = Invoke-AplicarPosicaoPostesVera
        return @{ status = 200; body = $st }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/postes." } }
}
