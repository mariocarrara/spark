# =============================================================================
# routes/ajuda.ps1 - perguntas e respostas da Ajuda (chat do canto da tela) - v3.1.1
# model/ajuda_faq.json: { id, categoria, pergunta, resposta, palavras, ordem, ativo, excluido }
# Primeira leitura (arquivo vazio) grava as perguntas padrao de lib/ajuda_padrao.json.
# Leitura: qualquer usuario logado. Gravacao: quem pode editar (modulo manutencao).
# "excluido" = flag (some da tela, nada e apagado). "ativo=false" = fica so na Gestao de Bases.
# =============================================================================

function Get-AjudaFaq {
    $itens = @(Read-JsonModel -Entity "ajuda_faq")
    if ($itens.Count -gt 0) { return $itens }
    $arq = Join-Path $PSScriptRoot "..\lib\ajuda_padrao.json"
    if (-not (Test-Path -LiteralPath $arq)) { return @() }
    $padrao = [System.IO.File]::ReadAllText($arq, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
    $semente = New-Object System.Collections.Generic.List[object]
    $ordem = 0
    foreach ($p in @($padrao)) {
        $ordem++
        $semente.Add(@{ id = (New-EntityId); categoria = "$($p.categoria)"; pergunta = "$($p.pergunta)"; resposta = "$($p.resposta)"; palavras = "$($p.palavras)"; ordem = $ordem; ativo = $true; excluido = $false })
    }
    Write-JsonModel -Entity "ajuda_faq" -Data @($semente.ToArray())
    return @(Read-JsonModel -Entity "ajuda_faq")
}

function Invoke-AjudaRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # GET /api/ajuda -> lista (sem as excluidas), ordenada
    if ($Method -eq "GET" -and $Segments.Count -eq 0) {
        $itens = @(Get-AjudaFaq | Where-Object { -not $_.excluido } | Sort-Object -Property ordem)
        return @{ status = 200; body = @($itens) }
    }

    if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar")) {
        return @{ status = 403; body = @{ erro = "Sem permissão para editar a Ajuda." } }
    }

    # POST /api/ajuda { categoria, pergunta, resposta, palavras }
    if ($Method -eq "POST" -and $Segments.Count -eq 0) {
        $pergunta = "$($Body.pergunta)".Trim(); $resposta = "$($Body.resposta)".Trim()
        if (-not $pergunta -or -not $resposta) { return @{ status = 400; body = @{ erro = "Informe a pergunta e a resposta." } } }
        $itens = @(Get-AjudaFaq)
        $maxOrdem = 0
        foreach ($i in $itens) { if ([int]$i.ordem -gt $maxOrdem) { $maxOrdem = [int]$i.ordem } }
        $categoria = "$($Body.categoria)".Trim(); if (-not $categoria) { $categoria = "Geral" }
        $novo = @{ id = (New-EntityId); categoria = $categoria; pergunta = $pergunta; resposta = $resposta; palavras = "$($Body.palavras)".Trim(); ordem = ($maxOrdem + 1); ativo = $true; excluido = $false }
        $itens += $novo
        Write-JsonModel -Entity "ajuda_faq" -Data $itens
        return @{ status = 201; body = $novo }
    }

    # PUT /api/ajuda/{id} { categoria?, pergunta?, resposta?, palavras?, ativo?, excluido?, ordem? }
    if ($Method -eq "PUT" -and $Segments.Count -eq 1) {
        $itens = @(Get-AjudaFaq)
        $alvo = $itens | Where-Object { $_.id -eq $Segments[0] } | Select-Object -First 1
        if (-not $alvo) { return @{ status = 404; body = @{ erro = "Pergunta não encontrada." } } }
        foreach ($campo in @("categoria", "pergunta", "resposta", "palavras")) {
            if ($Body.PSObject.Properties.Name -contains $campo) {
                $v = "$($Body.$campo)".Trim()
                if (($campo -eq "pergunta" -or $campo -eq "resposta") -and -not $v) { return @{ status = 400; body = @{ erro = "A pergunta e a resposta não podem ficar vazias." } } }
                Set-PropValor $alvo $campo $v
            }
        }
        if ($null -ne $Body.ativo)    { Set-PropValor $alvo "ativo" ([bool]$Body.ativo) }
        if ($null -ne $Body.excluido) { Set-PropValor $alvo "excluido" ([bool]$Body.excluido) }
        if ($null -ne $Body.ordem)    { Set-PropValor $alvo "ordem" ([int]$Body.ordem) }
        Write-JsonModel -Entity "ajuda_faq" -Data $itens
        return @{ status = 200; body = $alvo }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/ajuda." } }
}
