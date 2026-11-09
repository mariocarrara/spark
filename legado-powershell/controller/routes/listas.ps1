# =============================================================================
# routes/listas.ps1 - listas de apoio cadastraveis (v2.13.0)
#
# Tres listas pequenas que o usuario precisa manter sem mexer em codigo:
#   plano             - "Plano" da programacao (Conjunto ESS, ARSESP, SOMA...)
#   equipeNecessaria  - tipo de equipe necessaria (LM - LIVRE, LINHA VIVA...)
#   justificativaTipo - motivos de justificativa de produtividade < 90%
# Todas guardadas em model/listas_cadastro.json:
#   { id, lista, nome, ativo, excluido, ordem }
# "ativo=false" = nao aparece pra escolher em registros NOVOS, mas continua
# valendo nos antigos. "excluido=true" = flag de exclusao logica (some da tela,
# o registro e o historico que aponta pra ele continuam no arquivo).
# Na primeira leitura (arquivo vazio) grava os valores padrao do pedido do Mario.
# =============================================================================

$Script:ListasPadrao = @{
    plano = @(
        "Alimentadores Sensíveis", "ARSESP", "Conjunto ESS", "Fora Plano",
        "LD (34Kv E 40Kv)", "Linha do Basta", "Não Efetivo", "Reclamações",
        "Repasse", "Repetibilidade", "SOMA", "T1 & T2", "TOP AL ESS LT",
        "T3 ""U"" Maior 200 UC"
    )
    equipeNecessaria = @(
        "LM - LIVRE", "LM - DESLIGAMENTO", "LINHA VIVA", "LINHA VIVA 18mts", "RECOLHA"
    )
    justificativaTipo = @(
        "Serviços Comerciais", "Férias", "Sem Informação", "Treinamento",
        "Déficit de efetivo Próprio (aguardando contratação)",
        "Veículo Quebrado/Manutenção", "Atuando em manutenção/estrutura",
        "Apoio na Recolha", "Chuva", "Déficit de efetivo Terceiro",
        "Colaborador Afastado", "Serviços Baroneza", "Trabalhando no corte",
        "Contingência", "Outros", "Colaborador de férias"
    )
}

function Get-ListasCadastro {
    $itens = @(Read-JsonModel -Entity "listas_cadastro")
    if ($itens.Count -gt 0) { return $itens }
    $semente = New-Object System.Collections.Generic.List[object]
    foreach ($lista in @("plano", "equipeNecessaria", "justificativaTipo")) {
        $ordem = 0
        foreach ($nome in $Script:ListasPadrao[$lista]) {
            $ordem++
            $semente.Add(@{ id = (New-EntityId); lista = $lista; nome = $nome; ativo = $true; excluido = $false; ordem = $ordem })
        }
    }
    Write-JsonModel -Entity "listas_cadastro" -Data @($semente.ToArray())
    return @(Read-JsonModel -Entity "listas_cadastro")
}

function Invoke-ListasRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)
    $listasValidas = @("plano", "equipeNecessaria", "justificativaTipo")

    # GET /api/listas -> { plano:[...], equipeNecessaria:[...], justificativaTipo:[...] }
    if ($Method -eq "GET" -and $Segments.Count -eq 0) {
        $itens = Get-ListasCadastro
        $saida = @{}
        foreach ($l in $listasValidas) {
            $saida[$l] = @($itens | Where-Object { $_.lista -eq $l -and -not $_.excluido } | Sort-Object -Property ordem)
        }
        return @{ status = 200; body = $saida }
    }

    # POST /api/listas { lista, nome }
    if ($Method -eq "POST" -and $Segments.Count -eq 0) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para editar as listas." } }
        }
        if ($listasValidas -notcontains $Body.lista) { return @{ status = 400; body = @{ erro = "Lista desconhecida: $($Body.lista)" } } }
        $nome = "$($Body.nome)".Trim()
        if (-not $nome) { return @{ status = 400; body = @{ erro = "Informe o nome." } } }
        $itens = @(Get-ListasCadastro)
        $mesma = @($itens | Where-Object { $_.lista -eq $Body.lista -and -not $_.excluido -and "$($_.nome)".ToLower() -eq $nome.ToLower() })
        if ($mesma.Count -gt 0) { return @{ status = 409; body = @{ erro = "Já existe um item com esse nome nessa lista." } } }
        $maxOrdem = 0
        foreach ($i in $itens) { if ($i.lista -eq $Body.lista -and [int]$i.ordem -gt $maxOrdem) { $maxOrdem = [int]$i.ordem } }
        $novo = @{ id = (New-EntityId); lista = $Body.lista; nome = $nome; ativo = $true; excluido = $false; ordem = ($maxOrdem + 1) }
        $itens += $novo
        Write-JsonModel -Entity "listas_cadastro" -Data $itens
        return @{ status = 201; body = $novo }
    }

    # DELETE /api/listas?lista=plano&confirmar=sim - "Apagar tudo" (v2.13.30): esconde todos os itens da lista (flag)
    if ($Method -eq "DELETE" -and $Segments.Count -eq 0) {
        if (-not ((Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "importar") -and (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar"))) {
            return @{ status = 403; body = @{ erro = "Sem permissão para apagar a lista (precisa poder importar e editar)." } }
        }
        $lista = "$($Query['lista'])"
        if ($listasValidas -notcontains $lista) { return @{ status = 400; body = @{ erro = "Lista desconhecida: $lista" } } }
        if ("$($Query['confirmar'])" -ne "sim") { return @{ status = 400; body = @{ erro = "Falta a confirmação (confirmar=sim)." } } }
        $itens = @(Get-ListasCadastro)
        $qtd = 0
        foreach ($i in $itens) {
            if ($i.lista -eq $lista -and -not $i.excluido) { $i | Add-Member -NotePropertyName excluido -NotePropertyValue $true -Force; $qtd++ }
        }
        Write-JsonModel -Entity "listas_cadastro" -Data $itens
        return @{ status = 200; body = @{ lista = $lista; apagados = $qtd } }
    }

    # PUT /api/listas/{id} { nome?, ativo?, excluido?, ordem? }
    if ($Method -eq "PUT" -and $Segments.Count -eq 1) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para editar as listas." } }
        }
        $itens = @(Get-ListasCadastro)
        $alvo = $itens | Where-Object { $_.id -eq $Segments[0] } | Select-Object -First 1
        if (-not $alvo) { return @{ status = 404; body = @{ erro = "Item não encontrado." } } }
        if ($null -ne $Body.nome) {
            $nome = "$($Body.nome)".Trim()
            if (-not $nome) { return @{ status = 400; body = @{ erro = "O nome não pode ficar vazio." } } }
            $alvo | Add-Member -NotePropertyName nome -NotePropertyValue $nome -Force
        }
        if ($null -ne $Body.ativo)    { $alvo | Add-Member -NotePropertyName ativo -NotePropertyValue ([bool]$Body.ativo) -Force }
        if ($null -ne $Body.excluido) { $alvo | Add-Member -NotePropertyName excluido -NotePropertyValue ([bool]$Body.excluido) -Force }
        if ($null -ne $Body.ordem)    { $alvo | Add-Member -NotePropertyName ordem -NotePropertyValue ([int]$Body.ordem) -Force }
        Write-JsonModel -Entity "listas_cadastro" -Data $itens
        return @{ status = 200; body = $alvo }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/listas." } }
}
