# =============================================================================
# routes/produtividade.ps1 — Módulo 2: Produtividade das Equipes
# Inclui Metas (4.5.1) e Justificativas (4.5.2), conforme agrupado na tabela
# de endpoints do Detalhamento Técnico (seção 3.2).
# =============================================================================

function Invoke-ProdutividadeRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # GET /api/produtividade/resumo
    # Devolve os dados brutos (OS + equipes + metas) já cruzados o mínimo
    # necessário; o agrupamento Departamento > Regional > Polo > Equipe e o
    # cálculo de % Geral continuam no front-end (mesma lógica já testada no
    # protótipo), pra não duplicar regra de negócio dos dois lados.
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "resumo") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "produtividade" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Produtividade." } }
        }
        return @{ status = 200; body = @{
            equipes = @(Remove-RegistrosExcluidos -Base "equipes" -Campo "id" -Registros @(Read-JsonModel -Entity "equipes"))
            manutencaoOS = @(Read-JsonModel -Entity "manutencao_os")
            metas = @(Remove-RegistrosExcluidos -Base "metas" -Campo "id" -Registros @(Read-JsonModel -Entity "metas"))
            feriados = @(Read-JsonModel -Entity "feriados")
        } }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/produtividade." } }
}

function Invoke-MetasRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # GET /api/metas
    if ($Method -eq "GET" -and $Segments.Count -eq 0) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "metas" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Metas." } }
        }
        return @{ status = 200; body = @(Remove-RegistrosExcluidos -Base "metas" -Campo "id" -Registros @(Read-JsonModel -Entity "metas")) }
    }

    # POST /api/metas
    if ($Method -eq "POST" -and $Segments.Count -eq 0) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "metas" -Acao "criar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para criar Metas." } }
        }
        $feriados = @(Read-JsonModel -Entity "feriados")
        $diasUteis = Get-DiasUteisNoMes -AnoMes $Body.anoMes -Feriados $feriados
        $novo = @{
            id = New-EntityId
            equipeId = $Body.equipeId
            tipo = (ConvertTo-TipoMeta $Body.tipo)
            anoMes = $Body.anoMes
            metaMensal = [double]$Body.metaMensal
            diasUteis = $diasUteis
            metaDiaria = if ($diasUteis -gt 0) { [math]::Round([double]$Body.metaMensal / $diasUteis, 2) } else { 0 }
            origem = "Manual"
            atualizadoPor = $Usuario.nome
            atualizadoEm = Get-IsoNow
        }
        $metas = @(Read-JsonModel -Entity "metas") + $novo
        Write-JsonModel -Entity "metas" -Data $metas
        return @{ status = 201; body = $novo }
    }

    # PUT /api/metas/{id}
    if ($Method -eq "PUT" -and $Segments.Count -eq 1) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "metas" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para editar Metas." } }
        }
        $id = $Segments[0]
        $metas = @(Read-JsonModel -Entity "metas")
        $idx = 0..($metas.Count - 1) | Where-Object { $metas[$_].id -eq $id } | Select-Object -First 1
        if ($null -eq $idx) { return @{ status = 404; body = @{ erro = "Meta não encontrada." } } }

        $feriados = @(Read-JsonModel -Entity "feriados")
        $anoMes = if ($Body.anoMes) { $Body.anoMes } else { $metas[$idx].anoMes }
        $diasUteis = Get-DiasUteisNoMes -AnoMes $anoMes -Feriados $feriados
        $metaMensal = if ($null -ne $Body.metaMensal) { [double]$Body.metaMensal } else { $metas[$idx].metaMensal }

        $metas[$idx].metaMensal = $metaMensal
        $metas[$idx].anoMes = $anoMes
        $metas[$idx].diasUteis = $diasUteis
        $metas[$idx].metaDiaria = if ($diasUteis -gt 0) { [math]::Round($metaMensal / $diasUteis, 2) } else { 0 }
        Set-PropValor $metas[$idx] "atualizadoPor" $Usuario.nome
        Set-PropValor $metas[$idx] "atualizadoEm" (Get-IsoNow)

        Write-JsonModel -Entity "metas" -Data $metas
        return @{ status = 200; body = $metas[$idx] }
    }

    # POST /api/metas/importar
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "importar") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "metas" -Acao "importar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para importar Metas." } }
        }
        return Invoke-ImportacaoGenerica -Base "Metas" -Body $Body -Usuario $Usuario -EntityFile "metas" -KeyField "id" -PosProcessar {
            param($row)
            $feriados = @(Read-JsonModel -Entity "feriados")
            $diasUteis = Get-DiasUteisNoMes -AnoMes $row.AnoMes -Feriados $feriados
            return @{
                id = New-EntityId
                equipeId = $row.CodigoEquipe
                tipo = (ConvertTo-TipoMeta (Get-CampoDoRow -Row $row -Campo "Servico"))
                anoMes = $row.AnoMes
                metaMensal = [double]$row.MetaMensal
                diasUteis = $diasUteis
                metaDiaria = if ($diasUteis -gt 0) { [math]::Round([double]$row.MetaMensal / $diasUteis, 2) } else { 0 }
                origem = "Importado"
                atualizadoPor = $Usuario.nome
                atualizadoEm = Get-IsoNow
            }
        }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/metas." } }
}

function Invoke-JustificativasRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # GET /api/justificativas
    if ($Method -eq "GET" -and $Segments.Count -eq 0) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "produtividade" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Justificativas." } }
        }
        # v2.13.13: justificativas excluidas (flag) nao aparecem mais
        $justificativas = @(Read-JsonModel -Entity "justificativas") | Where-Object { -not $_.excluido }
        if ($Query["equipe"]) { $justificativas = $justificativas | Where-Object { $_.equipeId -eq $Query["equipe"] } }
        return @{ status = 200; body = @($justificativas) }
    }

    # DELETE /api/justificativas/{id} (v2.13.13) - exclusao LOGICA (flag), igual
    # aos cadastros da Gestao de Bases: nada e apagado do arquivo, fica marcado
    # com quem excluiu e quando. Exige gestaoBases/excluirStatus (Administrador
    # sempre pode).
    if ($Method -eq "DELETE" -and $Segments.Count -eq 1) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "gestaoBases" -Acao "excluirStatus")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para excluir Justificativas." } }
        }
        $idAlvo = [string]$Segments[0]
        $todas = @(Read-JsonModel -Entity "justificativas")
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
        if (-not $achou) { return @{ status = 404; body = @{ erro = "Justificativa não encontrada." } } }
        Write-JsonModel -Entity "justificativas" -Data $todas
        return @{ status = 200; body = @{ ok = $true; id = $idAlvo } }
    }

    # POST /api/justificativas (imutável após criação — Escopo 4.5.2 / regra transversal 9)
    if ($Method -eq "POST" -and $Segments.Count -eq 0) {
        # v2.15.33: "Nova" pela Gestao de Bases (origem = gestao) exige gestaoBases/criar;
        # o "Justificar" da Produtividade continua exigindo produtividade/criar
        $modPerm = if ([string]$Body.origem -eq "gestao") { "gestaoBases" } else { "produtividade" }
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo $modPerm -Acao "criar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para registrar Justificativas." } }
        }
        $dia = ([string]$Body.data).Substring(0, [Math]::Min(10, ([string]$Body.data).Length))
        $jaExiste = @(Read-JsonModel -Entity "justificativas") | Where-Object {
            -not $_.excluido -and [string]$_.equipeId -eq [string]$Body.equipeId -and ([string]$_.data).StartsWith($dia)
        }
        if (@($jaExiste).Count -gt 0) {
            return @{ status = 409; body = @{ erro = "Essa equipe já tem justificativa nesse dia." } }
        }
        $novo = @{
            id = New-EntityId
            equipeId = $Body.equipeId
            data = $Body.data
            tipo = $Body.tipo
            texto = $Body.texto
            autorId = $Usuario.usuarioId
            criadoEm = Get-IsoNow
        }
        $justificativas = @(Read-JsonModel -Entity "justificativas") + $novo
        Write-JsonModel -Entity "justificativas" -Data $justificativas
        return @{ status = 201; body = $novo }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/justificativas." } }
}

function Get-DiasUteisNoMes {
    <# metaDiaria = metaMensal / diasUteis, descontando sábados, domingos e
       feriados nacionais/SP cadastrados (Escopo 4.3, Detalhamento 2.9).
       Feriados municipais por polo ficam fora do escopo inicial. #>
    param([Parameter(Mandatory)][string]$AnoMes, [array]$Feriados)
    $partes = $AnoMes.Split("-")
    $ano = [int]$partes[0]; $mes = [int]$partes[1]
    $diasNoMes = [DateTime]::DaysInMonth($ano, $mes)
    $feriadosSet = @{}
    foreach ($f in $Feriados) { $feriadosSet[$f.data] = $true }

    $uteis = 0
    for ($d = 1; $d -le $diasNoMes; $d++) {
        $data = Get-Date -Year $ano -Month $mes -Day $d
        $iso = $data.ToString("yyyy-MM-dd")
        $ehFimDeSemana = $data.DayOfWeek -eq "Saturday" -or $data.DayOfWeek -eq "Sunday"
        if (-not $ehFimDeSemana -and -not $feriadosSet.ContainsKey($iso)) { $uteis++ }
    }
    return $uteis
}
