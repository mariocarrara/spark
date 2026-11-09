# =============================================================================
# Geografia.ps1 — cruzamento alimentador -> município -> polo/regional
#
# Esse arquivo existe por causa do pedido do Mario: "se tiver um alimentador
# que está em mais de um município ele fica atrelado ao município que está
# a subestação" + "cruza [o D_Localidade] com os dados que você puder".
#
# A base de Proteção (model/protecao.json) já tem, ponto a ponto, o par
# alimentador/municipio (confirmado nos dados de exemplo: C5887-5 -> V-A2 ->
# Cândido Mota) — como os dispositivos de proteção de um alimentador ficam
# todos perto da mesma subestação (não espalhados pela área toda que o
# alimentador atende), o município MAIS COMUM entre os pontos de Proteção de
# um alimentador É, na prática, o município da subestação dele. Não
# importamos nenhuma camada nova de subestação pra isso - não existe uma no
# sistema, e os dados de exemplo do shapefile trazem o campo SUB vazio -
# mas o Mario confirmou que o SHAPEFILE REAL da BDGD tem SUB preenchido;
# ainda assim, sem um cadastro de "qual subestação fica em qual município"
# separado, o SUB sozinho não bastaria - por isso usamos o que a Proteção já
# nos dá de graça, com dado real, em vez de inventar uma segunda fonte.
#
# Se um alimentador não tiver NENHUM ponto de Proteção importado ainda,
# Get-MapaAlimentadorMunicipio simplesmente não tem uma entrada pra ele - os
# totais de Km de rede desse alimentador caem em "Não identificado" até a
# Proteção dele ser importada (ou um ponto de Proteção ser cadastrado em
# Gestão de Bases). Isso é visível pro usuário (não mascarado como 0) de
# propósito - ver Get-KmDeRedePorCidade (routes/manutencao.ps1).
# =============================================================================

function Update-MapaAlimentadorPolo {
    <# v2.13.0 - cruza Protecao (PROT. ELEMENTO 2 -> ALIMENTADOR, gravado em
       protecao_alim.json no import da Protecao) com Vao (Protecao -> Polo/
       Regional, vao.json) e grava alimentador_polo.json:
       [{alimentador, polo, regional}] - o polo/regional mais frequente
       (pesado pelo numero de postes) entre as protecoes de cada alimentador.
       E o que permite filtrar OS por Polo/Regional (a OS so conhece o
       alimentador). Devolve quantos alimentadores ficaram com polo. #>
    $pares = @(Read-JsonModel -Entity "protecao_alim")
    $vao = @(Read-JsonModel -Entity "vao")
    if ($pares.Count -eq 0 -or $vao.Count -eq 0) {
        Write-JsonModel -Entity "alimentador_polo" -Data @()
        return 0
    }
    $vaoPorProt = @{}
    foreach ($v in $vao) { if ($v.protecaoId) { $vaoPorProt["$($v.protecaoId)"] = $v } }
    $pesos = @{}
    foreach ($p in $pares) {
        $v = $vaoPorProt["$($p.p)"]
        if (-not $v -or [string]::IsNullOrWhiteSpace($v.polo)) { continue }
        $alim = "$($p.a)"
        if (-not $pesos.ContainsKey($alim)) { $pesos[$alim] = @{} }
        $chave = "$($v.polo)|$($v.regional)"
        $peso = [Math]::Max(1, [int]$v.postes)
        if ($pesos[$alim].ContainsKey($chave)) { $pesos[$alim][$chave] = $pesos[$alim][$chave] + $peso }
        else { $pesos[$alim][$chave] = $peso }
    }
    $saida = New-Object System.Collections.Generic.List[object]
    foreach ($alim in $pesos.Keys) {
        $melhor = $pesos[$alim].GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 1
        $partes = $melhor.Name.Split("|")
        $saida.Add(@{ alimentador = $alim; polo = $partes[0]; regional = $(if ($partes.Count -gt 1) { $partes[1] } else { $null }) })
    }
    Write-JsonModel -Entity "alimentador_polo" -Data @($saida.ToArray())
    return $saida.Count
}

function Get-MapaAlimentadorPolo {
    <# alimentador -> @{ polo; regional } (de alimentador_polo.json). #>
    $mapa = @{}
    foreach ($x in @(Read-JsonModel -Entity "alimentador_polo")) {
        if ($x.alimentador) { $mapa["$($x.alimentador)"] = @{ polo = $x.polo; regional = $x.regional } }
    }
    return $mapa
}

function Get-MapaAlimentadorMunicipio {
    <# Devolve uma hashtable alimentador -> município (ex.: "V-A2" vira
       "Cândido Mota") - o município mais frequente entre os pontos de
       Proteção de cada alimentador. #>
    # v2.13.0 - a Protecao real nao traz municipio; o agrupamento "por cidade"
    # passa a usar o POLO do alimentador (alimentador_polo.json). O codigo
    # antigo (municipio da Protecao) fica como fallback pra bases legadas.
    $mapaPolo = Get-MapaAlimentadorPolo
    if ($mapaPolo.Count -gt 0) {
        $m = @{}
        foreach ($k in $mapaPolo.Keys) { if ($mapaPolo[$k].polo) { $m[$k] = $mapaPolo[$k].polo } }
        return $m
    }
    $pontos = @(Read-JsonModel -Entity "protecao")
    $porAlimentador = @{}
    foreach ($p in $pontos) {
        if ([string]::IsNullOrWhiteSpace($p.alimentador) -or [string]::IsNullOrWhiteSpace($p.municipio)) { continue }
        if (-not $porAlimentador.ContainsKey($p.alimentador)) { $porAlimentador[$p.alimentador] = @{} }
        $contagem = $porAlimentador[$p.alimentador]
        if (-not $contagem.ContainsKey($p.municipio)) { $contagem[$p.municipio] = 0 }
        $contagem[$p.municipio] = $contagem[$p.municipio] + 1
    }
    $mapa = @{}
    foreach ($alimentador in $porAlimentador.Keys) {
        $contagem = $porAlimentador[$alimentador]
        $maisComum = $contagem.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 1
        $mapa[$alimentador] = $maisComum.Name
    }
    return $mapa
}

function Get-MapaMunicipioLocalidade {
    <# Devolve uma hashtable município -> dados da localidade (regional,
       coordenador/supervisor/ponto focal responsável). Cruza pelo campo
       POLO do D_Localidade (é o que bate com "municipio" em Vão/Proteção/
       Prefeituras - LOCALIDADE é mais fino e não tem equivalente hoje).
       Testa POLO e POLO2 (o arquivo real tem os dois, nem sempre iguais)
       antes de desistir de uma localidade. #>
    $localidades = @(Read-JsonModel -Entity "localidades")
    $mapa = @{}
    foreach ($loc in $localidades) {
        foreach ($chave in @($loc.polo, $loc.polo2)) {
            if ([string]::IsNullOrWhiteSpace($chave)) { continue }
            if ($mapa.ContainsKey($chave)) { continue }
            $mapa[$chave] = @{
                regional = $loc.regional
                coordenadorResponsavel = $loc.coordenadorResponsavel
                supervisorResponsavel = $loc.supervisorResponsavel
                pontoFocalResponsavel = $loc.pontoFocalResponsavel
            }
        }
    }
    return $mapa
}
