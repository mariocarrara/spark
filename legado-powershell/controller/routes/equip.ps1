# =============================================================================
# Equipamentos da rede ligados ao poste (v2.15.0)
# GET  /api/equip/resumo                      -> { trafos:{total,comPoste,...}, protecoes:{...}, ... }
# GET  /api/equip/area?camada&sul&oeste&norte&leste&tipos&limite -> itens da camada no retangulo (mapa)
# GET  /api/equip/poste?id=<COD_ID do poste>  -> tudo que esta no poste (popup da OS)
# GET  /api/equip/lista?camada&busca&tipo&pagina -> lista paginada (Gestao de Bases > Equipamentos)
# DELETE /api/equip?camada=<c>&confirmar=sim  -> apaga a base daquela camada
# A importacao em si usa POST /api/importacao/shapefile (camada "equipamentos").
# Item = [codId, posteId, lat, lng, ctmt, conj, v0, v1, v2, v3, v4] (v0..v4 dependem da camada).
# =============================================================================
function Invoke-EquipRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    $ver = Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar"

    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "resumo") {
        if (-not $ver) { return @{ status = 403; body = @{ erro = "Sem permissão para ver os equipamentos." } } }
        return @{ status = 200; body = (Get-EquipResumo) }
    }

    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "area") {
        if (-not $ver) { return @{ status = 403; body = @{ erro = "Sem permissão para ver os equipamentos." } } }
        $camada = "$($Query['camada'])"
        if (-not (Test-EquipCamada $camada)) { return @{ status = 400; body = @{ erro = "Camada inválida." } } }
        $inv = [System.Globalization.CultureInfo]::InvariantCulture
        try {
            $sul = [double]::Parse("$($Query['sul'])", $inv); $oeste = [double]::Parse("$($Query['oeste'])", $inv)
            $norte = [double]::Parse("$($Query['norte'])", $inv); $leste = [double]::Parse("$($Query['leste'])", $inv)
        } catch { return @{ status = 400; body = @{ erro = "Parâmetros sul, oeste, norte e leste são obrigatórios." } } }
        $lim = 4000
        if ($Query["limite"]) { $lim = [math]::Max(1, [math]::Min(8000, [int]$Query["limite"])) }
        return @{ status = 200; body = (Get-EquipArea -Camada $camada -Sul $sul -Oeste $oeste -Norte $norte -Leste $leste -Tipos "$($Query['tipos'])" -Limite $lim) }
    }

    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "poste") {
        if (-not $ver) { return @{ status = 403; body = @{ erro = "Sem permissão para ver os equipamentos." } } }
        $id = "$($Query['id'])".Trim()
        if (-not $id) { return @{ status = 400; body = @{ erro = "Informe o id do poste." } } }
        return @{ status = 200; body = (Get-EquipPoste -Poste $id) }
    }

    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "lista") {
        if (-not $ver) { return @{ status = 403; body = @{ erro = "Sem permissão para ver os equipamentos." } } }
        $camada = "$($Query['camada'])"
        if (-not (Test-EquipCamada $camada)) { return @{ status = 400; body = @{ erro = "Camada inválida." } } }
        $pg = 1; if ($Query["pagina"]) { $pg = [math]::Max(1, [int]$Query["pagina"]) }
        return @{ status = 200; body = (Get-EquipLista -Camada $camada -Busca "$($Query['busca'])".Trim() -Tipo "$($Query['tipo'])".Trim() -Pagina $pg -Tamanho 50) }
    }

    # v2.15.25 - GET /api/equip/cadastro?nome=C7420-3 : disjuntor/trecho/alimentador do cadastro de Protecao
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "cadastro") {
        if (-not $ver) { return @{ status = 403; body = @{ erro = "Sem permissão para ver os equipamentos." } } }
        $nm = "$($Query['nome'])".Trim()
        if (-not $nm) { return @{ status = 400; body = @{ erro = "Informe o nome." } } }
        try { return @{ status = 200; body = (Get-EquipCadastro -Nome $nm) } }
        catch { return @{ status = 200; body = @{ achou = $false; erro = $_.Exception.Message } } }
    }

    # v2.15.25 - GET /api/equip/conferencia?metros=200&limite=500 : posicao do cadastro de Protecao x BDGD
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "conferencia") {
        if (-not $ver) { return @{ status = 403; body = @{ erro = "Sem permissão para ver os equipamentos." } } }
        $m = 200.0; if ($Query["metros"]) { $m = [math]::Max(10, [math]::Min(5000, [double]::Parse("$($Query['metros'])", [System.Globalization.CultureInfo]::InvariantCulture))) }
        $lim = 500; if ($Query["limite"]) { $lim = [math]::Max(1, [math]::Min(2000, [int]$Query["limite"])) }
        try { return @{ status = 200; body = (Get-EquipConferencia -Metros $m -Limite $lim) } }
        catch { return @{ status = 400; body = @{ erro = $_.Exception.Message } } }
    }

    if ($Method -eq "DELETE" -and $Segments.Count -eq 0) {
        if (-not ((Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "importar") -and
                  (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar"))) {
            return @{ status = 403; body = @{ erro = "Sem permissão para apagar a base de equipamentos." } }
        }
        $camada = "$($Query['camada'])"
        if (-not (Test-EquipCamada $camada)) { return @{ status = 400; body = @{ erro = "Camada inválida." } } }
        if ("$($Query['confirmar'])" -ne "sim") { return @{ status = 400; body = @{ erro = "Falta a confirmação (confirmar=sim)." } } }
        Remove-EquipBase -Camada $camada
        return @{ status = 200; body = @{ ok = $true } }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/equip." } }
}
