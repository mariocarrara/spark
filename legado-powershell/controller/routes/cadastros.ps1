# =============================================================================
# routes/cadastros.ps1 — Telas de Gestão de Bases (listar + editar)
#
# Vão, Proteção e VERA (árvores) só existiam via Importação de Bases - dava
# pra subir um Excel, mas não tinha nenhuma tela pra ver/corrigir um
# registro específico depois. Esta rota serve a listagem paginada e a
# edição campo a campo que a tela nova de Gestão de Bases usa no
# front-end. Equipes já tinha sua própria rota (routes/equipes.ps1,
# GET/POST/PUT sem paginação) - não mexemos nela, só reaproveitamos o
# padrão de PUT por chave aqui pras três bases que não tinham nada.
#
# Paginação no SERVIDOR (Skip/First), não no navegador: a VERA real chega a
# 140 mil+ linhas (ver v2.4.4, mesmo arquivo que estourou a importação) -
# mandar a base inteira pro front-end só pra montar uma grid de 50 travaria
# a aba do mesmo jeito que a importação travava antes da correção. A busca
# (campo "busca" da querystring) também roda aqui, sobre o conjunto inteiro
# ANTES de paginar, senão o resultado da busca ficaria preso só à página
# atual.
# =============================================================================

$Script:CadastrosConfig = @{
    "vao" = @{
        entityFile = "vao"
        keyField   = "protecaoId"
        busca      = @("protecaoId", "polo", "regional")
    }
    "protecao" = @{
        entityFile = "protecao"
        keyField   = "protecaoId"
        busca      = @("protecaoId", "protecao2", "alimentador", "trecho")
    }
    "vera" = @{
        entityFile = "vera"
        keyField   = "idVera"
        busca      = @("idVera", "especie", "alimentador", "cidade")
    }
    # v2.13.0 - Equipes e Metas entram aqui so pra ter "Excluir" (flag) e
    # restaurar; as telas delas continuam usando /equipes e /metas.
    "equipes" = @{
        entityFile = "equipes"
        keyField   = "id"
        busca      = @("id", "polo", "regional", "departamento")
    }
    # v2.13.22 - de-para Prioridade EW (importado pela base "Prioridade EW").
    "prioridade_ew" = @{
        entityFile = "prioridade_ew"
        keyField   = "chave"
        busca      = @("chave", "prioridade", "grupoRecurso", "prioridadeEW", "regional", "tensao")
    }
    # v2.15.20 - esquemas do SGM que nao podem ser ignorados (codigo, descricao, tipo).
    "esquemas" = @{
        entityFile = "esquemas"
        keyField   = "codigo"
        busca      = @("codigo", "descricao", "tipo")
    }
    # v2.15.21 - codigo IBGE do municipio (MUN do PONNOT) -> nome; vale por cima da semente do Controller.
    "municipios" = @{
        entityFile = "municipios"
        keyField   = "codigo"
        busca      = @("codigo", "nome")
    }
    # v3.2.1 - de-para Alimentador -> Conjunto (importado pela base "Conjuntos"; a OS busca o conjunto pelo alimentador).
    "conjuntos" = @{
        entityFile = "conjuntos"
        keyField   = "alimentador"
        busca      = @("alimentador", "nomeConjunto", "codConjunto", "regional", "sigla")
    }
    "metas" = @{
        entityFile = "metas"
        keyField   = "id"
        busca      = @("equipeId", "anoMes")
    }
}

# v2.13.0 - EXCLUSAO LOGICA ("Excluir" na Gestao de Bases). Nada e apagado
# do arquivo da base: a chave do registro vai pra model/exclusoes.json
# { base, chave, em, por } e as listagens passam a esconder esses registros.
# Fica numa entidade separada (e nao num campo "excluido" no registro) pra
# uma reimportacao, que reescreve a base inteira, nao "ressuscitar" o que
# foi excluido. O administrador pode restaurar.
function Get-ChavesExcluidas {
    param([Parameter(Mandatory)][string]$Base)
    $set = @{}
    foreach ($e in @(Read-JsonModel -Entity "exclusoes")) {
        if ($e.base -eq $Base) { $set["$($e.chave)"] = $true }
    }
    return $set
}
function Remove-RegistrosExcluidos {
    <# Devolve a lista sem os registros excluidos da base ($Campo = campo-chave). #>
    param([Parameter(Mandatory)][string]$Base, [Parameter(Mandatory)][string]$Campo, $Registros)
    $set = Get-ChavesExcluidas -Base $Base
    if ($set.Count -eq 0) { return @($Registros) }
    $saida = New-Object System.Collections.Generic.List[object]
    foreach ($r in @($Registros)) { if (-not $set.ContainsKey("$($r.$Campo)")) { $saida.Add($r) } }
    return $saida.ToArray()
}


function Test-PodeEscreverBase {
    <# v2.13.30 - "Novo registro" e "Apagar tudo" da Gestao de Bases: so quem
       pode SUBIR (importar) E EDITAR a base. Metas usa o modulo "metas";
       as demais, "manutencao". Administrador passa sempre (Test-Permissao). #>
    param([Parameter(Mandatory)][string]$UsuarioId, [Parameter(Mandatory)][string]$Base)
    $modulo = "manutencao"
    if ($Base -eq "metas") { $modulo = "metas" }
    return ((Test-Permissao -UsuarioId $UsuarioId -Modulo $modulo -Acao "importar") -and
            (Test-Permissao -UsuarioId $UsuarioId -Modulo $modulo -Acao "editar"))
}

function Invoke-CadastrosRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    if ($Segments.Count -lt 1) {
        return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/cadastros." } }
    }
    $base = $Segments[0]
    $config = $Script:CadastrosConfig[$base]
    if (-not $config) {
        return @{ status = 400; body = @{ erro = "Base de cadastro desconhecida: $base" } }
    }

    # GET /api/cadastros/conjuntos/mapa - v3.2.1: lista enxuta (sem excluidos) que a tela usa pra
    # ligar cada OS ao conjunto pelo alimentador. ~600 linhas, carregada uma vez no login.
    if ($Method -eq "GET" -and $base -eq "conjuntos" -and $Segments.Count -eq 2 -and $Segments[1] -eq "mapa") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar conjuntos." } }
        }
        $regs = @(Remove-RegistrosExcluidos -Base "conjuntos" -Campo "alimentador" -Registros @(Read-JsonModel -Entity "conjuntos"))
        $saida = New-Object System.Collections.Generic.List[object]
        foreach ($r in $regs) {
            $saida.Add(@{ a = "$($r.alimentador)"; n = "$($r.nomeConjunto)"; c = "$($r.codConjunto)"; r = "$($r.regional)"; s = "$($r.sigla)" })
        }
        return @{ status = 200; body = @($saida.ToArray()) }
    }

    # GET /api/cadastros/<base>?pagina=1&tamanhoPagina=50&busca=texto
    if ($Method -eq "GET" -and $Segments.Count -eq 1) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar $base." } }
        }

        $pagina = 1
        if ($Query["pagina"]) { $pagina = [math]::Max(1, [int]$Query["pagina"]) }
        $tamanhoPagina = 50
        if ($Query["tamanhoPagina"]) { $tamanhoPagina = [math]::Max(1, [math]::Min(200, [int]$Query["tamanhoPagina"])) }
        $busca = "$($Query['busca'])".Trim().ToLower()

        $todos = @(Read-JsonModel -Entity $config.entityFile)

        # v2.13.0 - registros excluidos (flag) ficam fora da lista; so o
        # administrador pode ver a lista dos excluidos (?excluidos=1) pra restaurar.
        $setExcl = Get-ChavesExcluidas -Base $base
        if ($Query["excluidos"] -eq "1") {
            if (-not (Test-Administrador -UsuarioId $Usuario.usuarioId)) {
                return @{ status = 403; body = @{ erro = "Somente administrador vê os registros excluídos." } }
            }
            $todos = @($todos | Where-Object { $setExcl.ContainsKey("$($_.($config.keyField))") })
        } elseif ($setExcl.Count -gt 0) {
            $semExcl = New-Object System.Collections.Generic.List[object]
            foreach ($r in $todos) { if (-not $setExcl.ContainsKey("$($r.($config.keyField))")) { $semExcl.Add($r) } }
            $todos = $semExcl.ToArray()
        }

        if ($busca) {
            # Loop simples em vez de Where-Object encadeado: pra 140 mil
            # linhas (VERA), cada invocação de scriptblock do pipeline tem
            # um custo real somado - o mesmo motivo que já nos mordeu em
            # Test-ImportRows (v2.4.4) e em ConvertTo-IsoDatesDeep antes
            # dela. Um foreach puro com List[object].Add é O(n) sem essa
            # sobrecarga.
            $filtrados = New-Object System.Collections.Generic.List[object]
            foreach ($registro in $todos) {
                $bate = $false
                foreach ($campo in $config.busca) {
                    if ("$($registro.$campo)".ToLower().Contains($busca)) { $bate = $true; break }
                }
                if ($bate) { $filtrados.Add($registro) }
            }
            $todos = $filtrados.ToArray()
        }

        $total = $todos.Count
        # Sort-Object -Property (nome da propriedade como string) em vez de
        # -Property { $_.Campo } (scriptblock): bem mais rápido pra listas
        # grandes, porque evita invocar um scriptblock por comparação.
        # v2.13.33 - ordenacao pedida pelo cabecalho da coluna (campo precisa ser
        # um dos campos conhecidos da base; qualquer outro valor cai na chave).
        $campoOrd = $config.keyField
        $pedido = "$($Query['ordenar'])"
        if ($pedido -and $pedido -match '^[A-Za-z0-9_]+$') { $campoOrd = $pedido }
        if ($Query['dir'] -eq 'desc') {
            $ordenados = @($todos | Sort-Object -Property $campoOrd -Descending)
        } else {
            $ordenados = @($todos | Sort-Object -Property $campoOrd)
        }
        $inicio = ($pagina - 1) * $tamanhoPagina
        $paginaDados = @($ordenados | Select-Object -Skip $inicio -First $tamanhoPagina)

        return @{ status = 200; body = @{
            base = $base
            total = $total
            pagina = $pagina
            tamanhoPagina = $tamanhoPagina
            registros = $paginaDados
        } }
    }

    # POST /api/cadastros/<base> - "Novo registro": grava 1 linha sem reimportar.
    if ($Method -eq "POST" -and $Segments.Count -eq 1) {
        if (-not (Test-PodeEscreverBase -UsuarioId $Usuario.usuarioId -Base $base)) {
            return @{ status = 403; body = @{ erro = "Sem permissão para incluir registros em $base (precisa poder importar e editar)." } }
        }
        if ($base -eq "metas") { return @{ status = 400; body = @{ erro = "Metas são criadas pela tela de Metas." } } }
        $kf = $config.keyField
        $chave = "$($Body.$kf)".Trim()
        if (-not $chave -and $base -eq "prioridade_ew") {
            $chave = "$($Body.tensao)-$($Body.prioridade)-$($Body.grupoRecurso)-$($Body.regional)"
        }
        if (-not $chave) { return @{ status = 400; body = @{ erro = "Informe o campo-chave ($kf)." } } }
        $registros = @(Read-JsonModel -Entity $config.entityFile)
        foreach ($r in $registros) {
            if ("$($r.$kf)" -eq $chave) { return @{ status = 409; body = @{ erro = "Já existe um registro com $kf = $chave em $base." } } }
        }
        $novo = [ordered]@{}
        foreach ($prop in $Body.PSObject.Properties) { $novo[$prop.Name] = $prop.Value }
        $novo[$kf] = $chave
        if ($base -eq "equipes" -and -not $novo.Contains("ativo")) { $novo["ativo"] = $true }
        $registros += [pscustomobject]$novo
        Write-JsonModel -Entity $config.entityFile -Data $registros
        # se a chave estava na lista de excluidos, o registro novo nao pode nascer escondido
        $restantes = @(Read-JsonModel -Entity "exclusoes" | Where-Object { -not ($_.base -eq $base -and "$($_.chave)" -eq $chave) })
        Write-JsonModel -Entity "exclusoes" -Data $restantes
        return @{ status = 201; body = [pscustomobject]$novo }
    }

    # DELETE /api/cadastros/<base>?confirmar=sim - "Apagar tudo": zera a tabela.
    if ($Method -eq "DELETE" -and $Segments.Count -eq 1) {
        if (-not (Test-PodeEscreverBase -UsuarioId $Usuario.usuarioId -Base $base)) {
            return @{ status = 403; body = @{ erro = "Sem permissão para apagar $base (precisa poder importar e editar)." } }
        }
        if ("$($Query['confirmar'])" -ne "sim") { return @{ status = 400; body = @{ erro = "Falta a confirmação (confirmar=sim)." } } }
        $qtd = @(Read-JsonModel -Entity $config.entityFile).Count
        Write-JsonModel -Entity $config.entityFile -Data @()
        $restantes = @(Read-JsonModel -Entity "exclusoes" | Where-Object { $_.base -ne $base })
        Write-JsonModel -Entity "exclusoes" -Data $restantes
        return @{ status = 200; body = @{ base = $base; apagados = $qtd } }
    }

    # PUT /api/cadastros/<base>/<chave> — edita os campos enviados no corpo,
    # sem mexer na chave (ativoId/protecaoId/idVera não são editáveis por
    # aqui; são o que liga esse registro a outras telas, ex.: Proteção é
    # referenciada por protecaoId em programacao.json).
    if ($Method -eq "PUT" -and $Segments.Count -eq 2) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para editar $base." } }
        }
        $chave = [System.Uri]::UnescapeDataString($Segments[1])
        $registros = @(Read-JsonModel -Entity $config.entityFile)
        $idx = 0..($registros.Count - 1) | Where-Object { "$($registros[$_].($config.keyField))" -eq $chave } | Select-Object -First 1
        if ($null -eq $idx) { return @{ status = 404; body = @{ erro = "Registro não encontrado em $base." } } }
        foreach ($prop in $Body.PSObject.Properties) {
            if ($prop.Name -eq $config.keyField) { continue }
            $registros[$idx] | Add-Member -NotePropertyName $prop.Name -NotePropertyValue $prop.Value -Force
        }
        Write-JsonModel -Entity $config.entityFile -Data $registros
        return @{ status = 200; body = $registros[$idx] }
    }

    # DELETE /api/cadastros/<base>/<chave> - "Excluir" = so marca a flag (exclusao logica)
    if ($Method -eq "DELETE" -and $Segments.Count -eq 2) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para excluir em $base." } }
        }
        $chave = [System.Uri]::UnescapeDataString($Segments[1])
        $existe = $false
        foreach ($r in @(Read-JsonModel -Entity $config.entityFile)) { if ("$($r.($config.keyField))" -eq $chave) { $existe = $true; break } }
        if (-not $existe) { return @{ status = 404; body = @{ erro = "Registro não encontrado em $base." } } }
        $exclusoes = @(Read-JsonModel -Entity "exclusoes")
        $ja = @($exclusoes | Where-Object { $_.base -eq $base -and "$($_.chave)" -eq $chave })
        if ($ja.Count -eq 0) {
            $exclusoes += @{ base = $base; chave = $chave; em = (Get-IsoNow); por = $Usuario.nome }
            Write-JsonModel -Entity "exclusoes" -Data $exclusoes
        }
        return @{ status = 200; body = @{ base = $base; chave = $chave; excluido = $true } }
    }

    # POST /api/cadastros/<base>/<chave>/restaurar - so administrador
    if ($Method -eq "POST" -and $Segments.Count -eq 3 -and $Segments[2] -eq "restaurar") {
        if (-not (Test-Administrador -UsuarioId $Usuario.usuarioId)) {
            return @{ status = 403; body = @{ erro = "Somente administrador pode restaurar registros excluídos." } }
        }
        $chave = [System.Uri]::UnescapeDataString($Segments[1])
        $restantes = @(Read-JsonModel -Entity "exclusoes" | Where-Object { -not ($_.base -eq $base -and "$($_.chave)" -eq $chave) })
        Write-JsonModel -Entity "exclusoes" -Data $restantes
        return @{ status = 200; body = @{ base = $base; chave = $chave; excluido = $false } }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/cadastros." } }
}
