# PodasImporter.ps1 — cruza as bases de podas (GRID x MO) pelo número da OS,
# converte as coordenadas UTM (zona 22, hemisfério sul) pra lat/lng, e grava
# o resultado em model/manutencao_os.json — a mesma lista que o Mapa de
# Manutenção usa pra plotar os pontos por status.
#
# Cruzamento: inner join (só entram OS que aparecem nos dois arquivos do par
# Executado/Pendente), conforme pedido — assim a base de MO garante que só
# entram OS que realmente têm mão de obra apontada.
#
# Executado e Pendente são importados SEPARADAMENTE (Import-PodasExecutado /
# Import-PodasPendente, cada um com seus 2 arquivos), não mais como uma
# única leitura das 4 planilhas de uma vez: o GRID_EXECUTADO é um arquivo
# muito maior (~60MB/178 mil linhas) que o GRID_PENDENTE, e forçar quem só
# quer atualizar as OS pendentes a esperar o executado inteiro ler de novo
# deixava a tela pesada à toa. Cada import MESCLA com o que já está gravado
# em vez de sobrescrever tudo: ao importar só o Executado, os registros
# "GRID_PENDENTE" que já estavam lá continuam intactos (e vice-versa) - só o
# lote do próprio tipo é substituído pelo resultado novo. Os 8 registros de
# exemplo do protótipo (fonte VERA/VAO/PROTECAO/SGM/SIGOD) somem assim que
# a primeira importação real (de qualquer um dos dois tipos) acontecer.


function Get-PosteIdDoComplemento {
    <# v2.14.2 - "Complemento de Localizacao" das grids SGM traz o ID do poste com
       o prefixo "218-" (ex.: 218-5264100). Guarda so o ID (5264100), que e o
       COD_ID do shapefile PONNOT. Vazio -> $null. #>
    param($Texto)
    $t = ([string]$Texto).Trim()
    if ([string]::IsNullOrWhiteSpace($t)) { return $null }
    if ($t.StartsWith('218-')) { $t = $t.Substring(4).Trim() }
    if ([string]::IsNullOrWhiteSpace($t)) { return $null }
    return $t
}

function ConvertTo-TextoCorrigido {
    <# v3.10.5 - texto da celula (Observacao da grid) sem espacos nas pontas; vazio / #N/A -> $null.
       Se o texto veio com a acentuacao quebrada (UTF-8 lido como Windows-1252: "inspeÃ§Ã£o"), tenta
       desfazer. A conversao e ESTRITA: se os bytes nao formarem UTF-8 valido (texto ja corrompido de
       outro jeito), mantem o original em vez de inventar caracteres. #>
    param($Valor)
    $t = ([string]$Valor).Trim()
    if ($t -eq '' -or $t -eq '#N/A') { return $null }
    if ($t -cmatch '[\u00C2\u00C3]') {
        try {
            $enc1252 = [System.Text.Encoding]::GetEncoding(1252, (New-Object System.Text.EncoderExceptionFallback), (New-Object System.Text.DecoderExceptionFallback))
            $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
            $t = $utf8.GetString($enc1252.GetBytes($t))
        } catch { }
    }
    return $t
}
function Get-PrioridadeSgm {
    <# v3.21.0 - criticidade da OS no SGM (Prioridade / CodPrioridade da grid: ALTA, URGENTE, EMERGENCIAL...): texto em
       MAIÚSCULAS sem espaços nas pontas; vazio / #N/A -> $null. Guarda o valor original (o "Prioridade EW" Sim/Não continua à parte). #>
    param($Valor)
    $t = ([string]$Valor).Trim().ToUpper()
    if ($t -eq '' -or $t -eq '#N/A') { return $null }
    return $t
}

function Get-TextoOuNulo {
    <# v2.15.7 - texto da celula da grid; vazio / #N/A -> $null #>
    param($Valor)
    $t = ([string]$Valor).Trim()
    if ($t -eq '' -or $t -eq '#N/A') { return $null }
    return $t
}

function Get-TrechoDaGrid {
    <# v2.15.7 - coluna "Trecho" das grids SGM (T1, T2, T3, T4...). Guarda em maiusculas. #>
    param($Valor)
    $t = Get-TextoOuNulo $Valor
    if ($null -eq $t) { return $null }
    return $t.ToUpper()
}

function Get-VaoPostesKm {
    <# v2.15.4 - poste -> Rota (km) do d.Vao (model/vao_postes.tsv, gravado na
       importacao do Vao). Usado so pela regra de PODA LINEAR. Sem o arquivo
       devolve $null (a regra nao se aplica e os numeros ficam como estavam). #>
    $arq = Join-Path $Script:ModelRoot 'vao_postes.tsv'
    if (-not (Test-Path -LiteralPath $arq)) { return $null }
    $tab = @{}
    foreach ($ln in [System.IO.File]::ReadAllLines($arq)) {
        $t = $ln.IndexOf("`t")
        if ($t -le 0) { continue }
        $v = 0.0
        if ([double]::TryParse($ln.Substring($t + 1), [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$v)) {
            $tab[$ln.Substring(0, $t)] = $v
        }
    }
    return $tab
}

function Test-EsquemaPodaLinear {
    param($DescEsquema)
    $t = ([string]$DescEsquema).ToUpper()
    return ($t.Contains('PODA LINEAR'))
}

function Get-LimpezaPodaLinearM2 {
    <# Limpeza de faixa de uma OS de PODA LINEAR = Rota (km) do vao do poste da OS
       x 15.000 m2 (km x 1000 m x 15 m de faixa) - a mesma conta do BI.
       Poste sem vao (ou tabela ausente) -> 0. #>
    param($TabelaVao, [string]$PosteId)
    if (-not $TabelaVao -or [string]::IsNullOrWhiteSpace($PosteId)) { return 0.0 }
    $k = $PosteId.Trim()
    if ($TabelaVao.ContainsKey($k)) { return [double]($TabelaVao[$k] * 15000.0) }
    return 0.0
}

function ConvertTo-StatusExecutado {
    param([string]$OsFechada)
    if ($OsFechada -and $OsFechada.Trim().ToUpper() -eq 'SIM') { return 'Executada' }
    return 'Despachada'   # OSFechada = NÃO: já foi a campo mas ainda não fechou
}

function ConvertTo-StatusPendente {
    param([string]$CodEstado)
    if ($null -eq $CodEstado) { $CodEstado = '' }
    switch ($CodEstado.Trim().ToUpper()) {
        'CRIADA'         { return 'Pendente' }
        'A REPROGRAMAR'  { return 'A reprogramar' }   # v2.13.0 - antes virava Pendente e a informacao se perdia
        'REPROGRAMADA'   { return 'Programada' }
        'PROGRAMADA'     { return 'Programada' }
        'DESPACHADA'     { return 'Despachada' }
        default          { return 'Pendente' }
    }
}

function Get-EquipeExecutoraDoNumeroOS {
    <# O número da OS nas planilhas reais vem como "<equipe> <número>", ex.:
       "COEC-GRLV1 000123456" ou "ESS-LVRS01 000098765" — a equipe executora
       é tudo antes do primeiro espaço (confirmado com o usuário). Sem
       espaço nenhum no valor (base mais antiga, ou formato diferente),
       devolve $null — o filtro de equipe simplesmente não aparece pra essa
       OS, sem quebrar o cruzamento (que continua usando o valor ORIGINAL,
       com o espaço e tudo, como chave — ver $osChave nas funções abaixo). #>
    param([string]$OsChave)
    if ([string]::IsNullOrWhiteSpace($OsChave)) { return $null }
    if ($OsChave -match '^(\S+)\s') { return $Matches[1] }
    return $null
}

function ConvertTo-ChaveEsquema {
    <# v2.15.20 - normaliza descricao/codigo de esquema pra comparar: maiusculas,
       sem acento, travessoes viram "-", espacos repetidos viram 1. #>
    param([string]$Texto)
    if ([string]::IsNullOrWhiteSpace($Texto)) { return '' }
    $t = $Texto.Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($c in $t.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($c) }
    }
    $t = $sb.ToString().ToUpper()
    $t = $t -replace "[\u2010-\u2015\u2212]", '-'
    $t = $t -replace '\s+', ' '
    return $t.Trim()
}

function ConvertTo-TipoEsquema {
    <# Poda / Limpeza / Estrutura (aceita variacoes: "Limpeza de Faixa", "Faixa"...). Vazio/desconhecido = '' (esquema sem tipo nao gera previsto). #>
    param([string]$Tipo)
    $t = (ConvertTo-ChaveEsquema $Tipo)
    if (-not $t) { return '' }
    if ($t -like '*ESTRUT*') { return 'estrutura' }
    if ($t -like '*LIMP*' -or $t -like '*FAIXA*') { return 'limpeza' }
    if ($t -like '*PODA*') { return 'poda' }
    return ''
}

function Get-TabelaEsquemas {
    <# v2.15.20 - base "Esquemas" (model/esquemas.json): esquemas do SGM que nao
       podem ser ignorados. Devolve @{ porDescricao = @{}; porCodigo = @{} } ->
       'poda' | 'limpeza' | 'estrutura'. Registros excluidos (exclusao logica na
       Gestao de Bases) e esquemas sem TIPO valido ficam de fora. #>
    $porDesc = @{}; $porCod = @{}
    $regs = @(Read-JsonModel -Entity "esquemas")
    try { $regs = @(Remove-RegistrosExcluidos -Base "esquemas" -Campo "codigo" -Registros $regs) } catch { }
    foreach ($r in $regs) {
        $tipo = ConvertTo-TipoEsquema -Tipo ([string]$r.tipo)
        if (-not $tipo) { continue }
        $d = ConvertTo-ChaveEsquema ([string]$r.descricao)
        $c = ConvertTo-ChaveEsquema ([string]$r.codigo)
        if ($d) { $porDesc[$d] = $tipo }
        if ($c) { $porCod[$c] = $tipo }
    }
    return @{ porDescricao = $porDesc; porCodigo = $porCod }
}

function Get-TipoDoEsquemaDaOS {
    <# Procura o tipo pela DESCRICAO do esquema da OS (DescEsquema da grid); se nao achar, tenta pelo CODIGO (CodEsquema). '' = esquema fora da base. #>
    param($Tabela, [string]$DescEsquema, [string]$CodEsquema)
    if (-not $Tabela) { return '' }
    $d = ConvertTo-ChaveEsquema $DescEsquema
    if ($d -and $Tabela.porDescricao.ContainsKey($d)) { return $Tabela.porDescricao[$d] }
    $c = ConvertTo-ChaveEsquema $CodEsquema
    if ($c -and $Tabela.porCodigo.ContainsKey($c)) { return $Tabela.porCodigo[$c] }
    return ''
}

function Get-TabelaPrioridadeEW {
    <# v2.13.22 - de-para da base "Prioridade EW" (model/prioridade_ew.json,
       importada pela tela de Importação). O resultado só depende de
       Prioridade x Grupo Recurso (Tensão/Regional não mudam a resposta nos
       dados reais), então a tabela vira um mapa "PRIORIDADE|GRUPO" -> $true/$false
       (Sim em qualquer linha = Sim). Sem base importada, usa a regra padrão
       que veio da planilha: URGENTE/EMERGENCIAL = Sim; ALTA = Sim exceto
       Estrutura; BAIXA/PROGRAMAVEL/outras = Não. #>
    $mapa = @{}
    foreach ($r in @(Read-JsonModel -Entity "prioridade_ew")) {
        $pri = ([string]$r.prioridade).Trim().ToUpper()
        $grp = ([string]$r.grupoRecurso).Trim().ToUpper()
        if (-not $pri -or -not $grp) { continue }
        $sim = (([string]$r.prioridadeEW).Trim().ToUpper() -in @('SIM','S','TRUE','1'))
        $k = "$pri|$grp"
        if (-not $mapa.ContainsKey($k) -or $sim) { $mapa[$k] = $sim }
    }
    return $mapa
}

function ConvertTo-PrioridadeEW {
    param([string]$CodPrioridade, $QtdPoda = 0, $QtdLimpeza = 0, $QtdEstrutura = 0, [string]$TipoServico = '', $Tabela = $null)
    if ($null -eq $CodPrioridade) { $CodPrioridade = '' }
    $p = $CodPrioridade.Trim().ToUpper()
    $grupos = @()
    if ([double]$QtdPoda -gt 0)      { $grupos += 'PODA' }
    if ([double]$QtdLimpeza -gt 0)   { $grupos += 'LIMPEZA DE FAIXA' }
    if ([double]$QtdEstrutura -gt 0) { $grupos += 'ESTRUTURA' }
    if ($grupos.Count -eq 0) {
        $t = $TipoServico.ToLower()
        if ($t -like '*faixa*' -or $t -like '*limpeza*') { $grupos = @('LIMPEZA DE FAIXA') }
        elseif ($t -like '*estrutura*') { $grupos = @('ESTRUTURA') }
        else { $grupos = @('PODA') }
    }
    foreach ($g in $grupos) {
        if ($Tabela -and $Tabela.Count -gt 0) {
            if ($Tabela["$p|$g"] -eq $true) { return $true }
        } else {
            if ($p -eq 'URGENTE' -or $p -eq 'EMERGENCIAL') { return $true }
            if ($p -eq 'ALTA' -and $g -ne 'ESTRUTURA') { return $true }
        }
    }
    return $false
}

function Get-DicionarioMO {
    <# Um registro por OS (tipoServico/detalhe do primeiro apontamento
       encontrado) — usado pra decidir o tipo de serviço e, historicamente,
       pra filtrar o "inner join" (só entra OS que aparece na MO). #>
    param([System.Collections.Generic.List[object]]$LinhasMO, [string]$CampoOS)
    $dic = @{}
    foreach ($linha in $LinhasMO) {
        $os = $linha[$CampoOS]
        if ([string]::IsNullOrWhiteSpace($os)) { continue }
        $osChave = $os.Trim()
        if (-not $dic.ContainsKey($osChave)) {
            $tipo = $linha['DE-PARA RECURSOS.MO 2']
            if ([string]::IsNullOrWhiteSpace($tipo)) { $tipo = $linha['DE-PARA RECURSOS.MO 1'] }
            $dic[$osChave] = @{ tipoServico = $tipo; detalhe = $linha['DE-PARA RECURSOS.MO 1'] }
        }
    }
    return $dic
}

function Get-ContagemMO {
    <# Previsto/Realizado = quantidade de linhas de MO apontadas pra cada OS
       (confirmado com os arquivos reais: cada linha da MO_PENDENTE/MO_
       EXECUTADA é 1 unidade de recurso/serviço apontado pra aquela OS -
       contar linhas por chave dá a mesma quantidade que o mapa de
       manutenção de referência mostra em "Poda_Prev"/"Poda_Realiz."). #>
    param([System.Collections.Generic.List[object]]$LinhasMO, [string]$CampoOS)
    $dic = @{}
    foreach ($linha in $LinhasMO) {
        $os = $linha[$CampoOS]
        if ([string]::IsNullOrWhiteSpace($os)) { continue }
        $osChave = $os.Trim()
        if ($dic.ContainsKey($osChave)) { $dic[$osChave]++ } else { $dic[$osChave] = 1 }
    }
    return $dic
}

function Save-MoLinhas {
    <# v3.23.0 - guarda as LINHAS da MO (uma por recurso apontado na OS), cada uma com as quantidades que vieram na linha, em
       model/mo_linhas_<origem>.json (origem = 'executada' ou 'pendente'). Arquivo SEPARADO da lista de OS (que o navegador
       baixa inteira): só a futura página de medição de terceiros vai ler. Cada importação da MO SUBSTITUI o arquivo da sua origem.
       Formato compacto por colunas: {"origem","geradoEm","colunas":[...],"linhas":[[os,grupo,tipo,qtdPoda,qtdLimpeza,qtdEstrutura],...]}
       Escrito à mão (StringBuilder) porque ConvertTo-Json do PS 5.1 é lento para centenas de milhares de linhas.
       Nunca lança erro (a importação das OS não pode falhar por causa disso). Devolve @{ origem; linhas } ou $null. #>
    param([System.Collections.Generic.List[object]]$LinhasMO, [string]$Origem)
    try {
        $inv = [System.Globalization.CultureInfo]::InvariantCulture
        $esc = { param($t) $x = ([string]$t).Trim(); if ($x -eq '#N/A') { $x = '' }; return '"' + (($x.Replace('\', '\\').Replace('"', '\"') -replace '[\x00-\x1F]', ' ')) + '"' }
        $num = { param($t) $v = ConvertTo-DoubleSeguro -Texto ([string]$t); if ($null -eq $v) { return '0' }; return ([double]$v).ToString('0.####', $inv) }
        $sb = New-Object System.Text.StringBuilder
        [void]$sb.Append('{"origem":"' + $Origem + '","geradoEm":"' + (Get-IsoNow) + '","colunas":["os","grupo","tipo","qtdPoda","qtdLimpeza","qtdEstrutura"],"linhas":[')
        $n = 0
        foreach ($l in $LinhasMO) {
            $os = ([string]$l['Número OS']).Trim()
            if ($os -eq '') { continue }
            if ($n -gt 0) { [void]$sb.Append(',') }
            [void]$sb.Append('[' + (& $esc $os) + ',' + (& $esc $l['DE-PARA RECURSOS.MO 1']) + ',' + (& $esc $l['DE-PARA RECURSOS.MO 2']) + ',' +
                (& $num $l['Qtd Poda']) + ',' + (& $num $l['Qtd Limpeza (M²)']) + ',' + (& $num $l['Qtd Estrutura']) + ']')
            $n++
        }
        [void]$sb.Append(']}')
        $path = Get-EntityPath -Entity ("mo_linhas_" + $Origem)
        $tmp = "$path.tmp"
        [System.IO.File]::WriteAllText($tmp, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
        Move-Item -LiteralPath $tmp -Destination $path -Force
        return @{ origem = $Origem; linhas = $n }
    } catch {
        Write-Host "[mo_linhas] aviso: nao consegui gravar as linhas da MO ($Origem): $($_.Exception.Message)"
        return $null
    }
}

function Get-RecursosMO {
    <# v3.22.0 - "DE-PARA RECURSOS.MO 1" de TODAS as linhas da OS na MO (valores distintos, ordenados, juntos por " | "),
       ex.: "Limpeza de Faixa | Poda com Recolha". osChave -> texto. #>
    param([System.Collections.Generic.List[object]]$LinhasMO, [string]$CampoOS)
    $acum = @{}
    foreach ($linha in $LinhasMO) {
        $os = $linha[$CampoOS]
        if ([string]::IsNullOrWhiteSpace($os)) { continue }
        $rec = ([string]$linha['DE-PARA RECURSOS.MO 1']).Trim()
        if ($rec -eq '' -or $rec -eq '#N/A') { continue }
        $osChave = $os.Trim()
        if (-not $acum.ContainsKey($osChave)) { $acum[$osChave] = New-Object 'System.Collections.Generic.SortedSet[string]' }
        [void]$acum[$osChave].Add($rec)
    }
    $dic = @{}
    foreach ($k in $acum.Keys) { $dic[$k] = ($acum[$k] -join ' | ') }
    return $dic
}

function Get-QuantidadesMO {
    <# v2.13.5 - Previsto/Realizado = SOMA das quantidades de TODAS as linhas
       da OS na MO, separadas por tipo (colunas "Qtd Poda", "Qtd Limpeza (M²)"
       e "Qtd Estrutura"), exatamente como o BI de referencia. Conferido contra
       o export do BI (Plano 2026, Executada): o Realizado bate em 97-99,8%
       das OS x recurso somando as quantidades, e em so 14-40% contando linhas
       (limpeza de faixa vem em m2: uma linha de 50 m2 vale 50, nao 1).
       Devolve  osChave -> @{ poda; limpeza; estrutura }. #>
    param([System.Collections.Generic.List[object]]$LinhasMO, [string]$CampoOS)
    $dic = @{}
    foreach ($linha in $LinhasMO) {
        $os = $linha[$CampoOS]
        if ([string]::IsNullOrWhiteSpace($os)) { continue }
        $osChave = $os.Trim()
        if (-not $dic.ContainsKey($osChave)) { $dic[$osChave] = @{ poda = 0.0; limpeza = 0.0; estrutura = 0.0 } }
        $q = $dic[$osChave]
        $v = ConvertTo-DoubleSeguro -Texto ([string]$linha['Qtd Poda'])
        if ($null -ne $v) { $q.poda = $q.poda + $v }
        $v = ConvertTo-DoubleSeguro -Texto ([string]$linha['Qtd Limpeza (M²)'])
        if ($null -ne $v) { $q.limpeza = $q.limpeza + $v }
        $v = ConvertTo-DoubleSeguro -Texto ([string]$linha['Qtd Estrutura'])
        if ($null -ne $v) { $q.estrutura = $q.estrutura + $v }
    }
    return $dic
}

function Get-NomeLocalidadeSemCodigo {
    <# v2.13.19 - "GUARAPUAVA 6001-218" -> "GUARAPUAVA" (tira o codigo interno
       depois do nome). Usado pra achar o centro da cidade das OS sem
       coordenada. Devolve $null se nao houver nome. #>
    param($Texto)
    if ($null -eq $Texto) { return $null }
    $t = ([string]$Texto).Trim().ToUpper()
    if ([string]::IsNullOrWhiteSpace($t)) { return $null }
    $n = [regex]::Replace($t, '\s+[0-9].*$', '')
    if ([string]::IsNullOrWhiteSpace($n)) { return $null }
    return $n
}

function Add-PontoAcumulado {
    param($AcLat, $AcLng, [string]$Chave, [double]$Lat, [double]$Lng)
    if (-not $AcLat.ContainsKey($Chave)) {
        $AcLat[$Chave] = New-Object 'System.Collections.Generic.List[double]'
        $AcLng[$Chave] = New-Object 'System.Collections.Generic.List[double]'
    }
    $AcLat[$Chave].Add($Lat)
    $AcLng[$Chave].Add($Lng)
}

function Get-MedianaLista {
    param([System.Collections.Generic.List[double]]$Lista)
    $a = $Lista.ToArray()
    [Array]::Sort($a)
    $n = $a.Length
    if ($n % 2 -eq 1) { return $a[[int](($n - 1) / 2)] }
    return (($a[[int]($n / 2) - 1] + $a[[int]($n / 2)]) / 2.0)
}

function Set-PosicaoAproximada {
    <# v2.13.19 - OS que veio SEM coordenada no GRID continua no sistema (entra
       nos totais, como no BI) e ganha uma posicao APROXIMADA: a mediana das
       coordenadas das outras OS da mesma cidade (ou do mesmo setor, no GRID
       pendente). Fica marcada com localizacao.aproximada = true (a tela mostra
       "*" no numero da OS). Sem nenhuma referencia, lat/lng ficam nulos: a OS
       conta nos totais mas nao aparece no mapa. #>
    param($Pendentes, $AcLat, $AcLng)
    $cacheLat = @{}
    $cacheLng = @{}
    $aprox = 0
    $semPos = 0
    foreach ($item in $Pendentes) {
        $chave = $item['chave']
        if ($chave -and $AcLat.ContainsKey($chave)) {
            if (-not $cacheLat.ContainsKey($chave)) {
                $cacheLat[$chave] = Get-MedianaLista -Lista $AcLat[$chave]
                $cacheLng[$chave] = Get-MedianaLista -Lista $AcLng[$chave]
            }
            $loc = $item['reg']['localizacao']
            $loc['lat'] = [Math]::Round([double]$cacheLat[$chave], 6)
            $loc['lng'] = [Math]::Round([double]$cacheLng[$chave], 6)
            $loc['aproximada'] = $true
            $aprox++
        } else {
            $semPos++
        }
    }
    $r = @{}
    $r['aproximadas'] = $aprox
    $r['semPosicao'] = $semPos
    return $r
}

function Get-QtdOuZero {
    param($Dic, [string]$Chave)
    if ($Dic.ContainsKey($Chave)) { return $Dic[$Chave] }
    return @{ poda = 0.0; limpeza = 0.0; estrutura = 0.0 }
}

function Get-ChavePrevisto {
    <# Confirmado com dados reais (GRID_EXECUTADO x MO_PENDENTE x MO_
       EXECUTADA, ver changelog): quando a OS tem "OSPrimária(int)"
       preenchida, o Previsto vem da OS-MÃE (a que originou o atendimento) -
       é ela que está apontada na MO_PENDENTE, não a OS-filha (executada).
       Sem OSPrimária, a própria OS é a chave dos dois lados. #>
    param([string]$OsChave, [string]$OsPrimaria)
    if (-not [string]::IsNullOrWhiteSpace($OsPrimaria)) { return $OsPrimaria.Trim() }
    return $OsChave
}

function Merge-PodasNoModelo {
    <# Substitui, dentro de model/manutencao_os.json, só o lote identificado
       por $FonteSubstituida (GRID_EXECUTADO ou GRID_PENDENTE) pelos $Novos
       registros - preserva o lote do outro tipo intacto. Qualquer registro
       "de fora" desses dois tipos (os 8 de exemplo do protótipo) é
       descartado, porque este arquivo só é escrito por este importador -
       eles são só um placeholder até a primeira importação real chegar.

       Reconciliação dia-seguinte (pedido do Mario: "o que foi executado
       tira da programação, o que não foi tem que permanecer e ficar em
       alerta"): quando o lote importado é o GRID_EXECUTADO, qualquer OS que
       chegou executada e ainda estava no lote GRID_PENDENTE (porque o
       programador não re-subiu o pendente nessa mesma rodada, ou porque ela
       tinha acabado de ser Programada) é removida de lá - ela não é mais
       "pendente", virou um fato consumado. O inverso não acontece: reimportar
       o PENDENTE nunca apaga uma OS que já está no lote EXECUTADO. O "ficar
       em alerta" em si não precisa de nenhum flag gravado aqui - o Mapa de
       Manutenção e a tela de Programação recalculam isso sozinhos toda vez
       que renderizam (dataFim no passado + ainda não Executada = Atrasada),
       então a OS que permanece Pendente/Programada já aparece em alerta
       automaticamente assim que a data passar, sem precisar de outro import. #>
    param(
        [Parameter(Mandatory)][string]$FonteSubstituida,   # GRID_EXECUTADO | GRID_PENDENTE | SIGOD
        [Parameter(Mandatory)][System.Collections.Generic.List[object]]$Novos,
        $ProgressCallback = $null
    )
    # v3.1.10 - etapas da gravacao mandam sinal ao navegador (ele desiste se ficar 120 s sem ouvir nada)
    # e imprimem o tempo de cada uma no prompt, para ver onde a carga demora.
    $cronMerge = [System.Diagnostics.Stopwatch]::StartNew()
    $sinal = { param($txt) if ($ProgressCallback) { try { & $ProgressCallback @{ fase='gravando'; arquivo=$txt; percentual=99 } } catch { } } }
    $marca = { param($txt) Write-Host ("  [importacao] gravacao - {0}: {1:N1}s" -f $txt, $cronMerge.Elapsed.TotalSeconds) -ForegroundColor DarkCyan; $cronMerge.Restart() }
    & $sinal 'lendo a base atual'
    $existentes = @(Read-JsonModel -Entity "manutencao_os")
    & $marca 'leu a base atual'
    $idsNovosLote = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($n in $Novos) { [void]$idsNovosLote.Add([string]$n.id) }

    # v2.12.0 - SIGOD entrou como terceiro lote real (planilha basePoda).
    # Cada import substitui so o proprio lote e preserva os outros dois.
    $fontesReais = @('GRID_EXECUTADO', 'GRID_PENDENTE', 'SIGOD', 'SIGOD_PENDENTE')
    $mantidos = @($existentes | Where-Object {
        $_.localizacao -and $_.localizacao.fonte -and $_.localizacao.fonte -ne $FonteSubstituida -and
        ($fontesReais -contains $_.localizacao.fonte) -and
        -not ($FonteSubstituida -eq 'GRID_EXECUTADO' -and $_.localizacao.fonte -eq 'GRID_PENDENTE' -and $idsNovosLote.Contains([string]$_.id)) -and
        -not ($FonteSubstituida -eq 'SIGOD' -and $_.localizacao.fonte -eq 'SIGOD_PENDENTE' -and $idsNovosLote.Contains([string]$_.id))
    })
    $final = @($mantidos) + @($Novos)
    & $marca 'montou o lote novo'
    & $sinal 'gravando as OS'
    Write-JsonModel -Entity "manutencao_os" -Data $final
    & $marca 'gravou as OS'
    & $sinal 'guardando as OS nas programacoes'

    # v3.0.7 - copia das OS (e das executadas filhas) para dentro de cada programacao, a cada carga
    try { Sync-SnapshotsProgramacoes -Final $final }
    catch { Write-Warning "Nao foi possivel guardar as OS nas programacoes: $($_.Exception.Message)" }
    & $marca 'copias nas programacoes'

    if ($FonteSubstituida -eq 'GRID_EXECUTADO') {
        & $sinal 'conferindo programacoes concluidas'
        Update-ProgramacoesConcluidasPorExecucao -IdsExecutados $idsNovosLote -TodasOS $final
        & $marca 'programacoes concluidas'
    }

    # v3.12.0 - distancia de cada OS ate APP/Reserva Legal (lib/AppRl.ps1). Nunca derruba a importacao:
    # se falhar, a OS entra do mesmo jeito e o indice de APP/RL fica como estava (aviso no prompt).
    & $sinal 'calculando APP e RL'
    $apRl = Update-AppRlIndice -Lista $final -ProgressCallback $ProgressCallback
    if (-not $apRl.ok) { Write-Warning ("APP/RL nao atualizado: " + $apRl.aviso) }
    & $marca 'APP/RL'
}

function Get-OsSnapAssinatura {
    <# Assinatura barata dos campos que importam (para saber se a copia guardada mudou). #>
    param($r)
    $partes = foreach ($c in 'statusOS','previsto','realizado','previstoPoda','previstoLimpeza','previstoEstrutura','realizadoPoda','realizadoLimpeza','realizadoEstrutura','osPrimaria','dataExecucao','localidade','tipoServico') { "$($r.$c)" }
    return ($partes -join '|')
}

function Add-OsSnapNaProgramacao {
    <# v3.0.7 - guarda/atualiza copias de OS dentro da programacao (propriedade osSnap = as OS
       programadas; execSnap = as OS Executadas que apontam para elas). Nunca apaga nada.
       Programacao Concluida fica "congelada": so entram copias que ainda nao existiam. #>
    param($Prog, [string]$Prop, $Registros, [bool]$Congelada)
    $lista = New-Object System.Collections.Generic.List[object]
    $idx = @{}
    if ($Prog.PSObject.Properties[$Prop]) {
        foreach ($x in @($Prog.$Prop)) {
            if ($x -and $null -ne $x.id) { $idx[([string]$x.id).Trim()] = $lista.Count; $lista.Add($x) }
        }
    }
    $mudou = $false
    foreach ($r in @($Registros)) {
        if (-not $r) { continue }
        $k = ([string]$r.id).Trim()
        if (-not $k) { continue }
        if ($idx.ContainsKey($k)) {
            if ($Congelada) { continue }
            $pos = $idx[$k]
            if ((Get-OsSnapAssinatura $lista[$pos]) -ne (Get-OsSnapAssinatura $r)) { $lista[$pos] = $r; $mudou = $true }
        } else {
            $idx[$k] = $lista.Count; $lista.Add($r); $mudou = $true
        }
    }
    if ($mudou) {
        if ($Prog.PSObject.Properties[$Prop]) { $Prog.$Prop = $lista.ToArray() }
        else { Add-Member -InputObject $Prog -NotePropertyName $Prop -NotePropertyValue $lista.ToArray() }
    }
    return $mudou
}

function Sync-SnapshotsProgramacoes {
    <# v3.0.7 - A OS programada e a PRIMARIA e some da base quando a grid pendente e reimportada;
       as OS Executadas (filhas) tambem somem quando o GRID_EXECUTADO e substituido. Depois de CADA
       carga de grid, copia para dentro de cada programacao (osSnap/execSnap) o que existe agora na
       base para as OS dela - assim previsto, realizado e OS ficam gravados na propria programacao.
       Mesma ordem de locks das rotas: rota_programacao -> programacao. #>
    param([Parameter(Mandatory)][array]$Final)
    $lockRotaProg = Lock-Entity -Entity "rota_programacao" -TimeoutMs 20000 -StaleMs 90000
    try {
    $lockProg = Lock-Entity -Entity "programacao" -TimeoutMs 20000
    try {
    $programacoes = @(Read-JsonModel -Entity "programacao")
    if ($programacoes.Count -eq 0) { return }
    $porId = @{}
    $filhas = @{}
    foreach ($f in $Final) {
        $id = ([string]$f.id).Trim()
        if ($id) { $porId[$id] = $f }
        if ("$($f.statusOS)" -eq 'Executada' -and $f.osPrimaria) {
            $k = ([string]$f.osPrimaria).Trim()
            if ($k) {
                if (-not $filhas.ContainsKey($k)) { $filhas[$k] = New-Object System.Collections.Generic.List[object] }
                $filhas[$k].Add($f)
            }
        }
    }
    $mudou = $false
    foreach ($p in $programacoes) {
        if ("$($p.status)" -eq 'Cancelada') { continue }
        $congelada = ("$($p.status)" -eq 'Concluída')
        $regsOs = New-Object System.Collections.Generic.List[object]
        $regsFil = New-Object System.Collections.Generic.List[object]
        foreach ($i in @($p.osIds)) {
            $id = ([string]$i).Trim()
            if (-not $id) { continue }
            if ($porId.ContainsKey($id)) { $regsOs.Add($porId[$id]) }
            if ($filhas.ContainsKey($id)) { foreach ($c in $filhas[$id]) { $regsFil.Add($c) } }
        }
        if (Add-OsSnapNaProgramacao -Prog $p -Prop 'osSnap' -Registros $regsOs.ToArray() -Congelada $congelada) { $mudou = $true }
        if (Add-OsSnapNaProgramacao -Prog $p -Prop 'execSnap' -Registros $regsFil.ToArray() -Congelada $congelada) { $mudou = $true }
    }
    if ($mudou) { Write-JsonModel -Entity "programacao" -Data $programacoes }
    } finally { Unlock-Entity -LockPath $lockProg }
    } finally { Unlock-Entity -LockPath $lockRotaProg }
}

function Get-OsSnapMesclado {
    <# POST/PUT de programacao: junta o que o Controller ja tem guardado com as copias de OS que o
       navegador mandou (so dos osIds, so campos conhecidos). Copia que o Controller ja tem NUNCA e
       sobrescrita pelo navegador. Copias de OS que sairam da programacao sao descartadas. #>
    param($OsIds, $SnapAtual, $ExecAtual, $Enviados)
    $ids = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($i in @($OsIds)) { $s = ([string]$i).Trim(); if ($s) { [void]$ids.Add($s) } }
    $campos = 'id','origem','statusOS','tipoServico','tipoEquipeNecessaria','tipoEquipeExec','trecho','osPrimaria','alimentador','conjunto','protecaoId','localidade','dataAbertura','dataExecucao','previsto','realizado','previstoPoda','previstoLimpeza','previstoEstrutura','realizadoPoda','realizadoLimpeza','realizadoEstrutura','observacao','descEsquema','prioridade','numObra','recursoMo','statusBase'
    $snap = New-Object System.Collections.Generic.List[object]
    $tem = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($x in @($SnapAtual)) {
        if ($x -and $null -ne $x.id) {
            $k = ([string]$x.id).Trim()
            if ($ids.Contains($k) -and $tem.Add($k)) { $snap.Add($x) }
        }
    }
    foreach ($e in @($Enviados)) {
        if (-not $e -or $null -eq $e.id) { continue }
        $k = ([string]$e.id).Trim()
        if (-not $ids.Contains($k) -or $tem.Contains($k)) { continue }
        $r = [ordered]@{}
        foreach ($c in $campos) { if ($e.PSObject.Properties[$c]) { $r[$c] = $e.$c } }
        if ($e.PSObject.Properties['lat'] -and $null -ne $e.lat -and $null -ne $e.lng) {
            $r['localizacao'] = [ordered]@{ lat = $e.lat; lng = $e.lng; fonte = $e.fonte }
        }
        [void]$tem.Add($k)
        $snap.Add([pscustomobject]$r)
    }
    $exec = New-Object System.Collections.Generic.List[object]
    foreach ($x in @($ExecAtual)) {
        if ($x -and $x.osPrimaria -and $ids.Contains(([string]$x.osPrimaria).Trim())) { $exec.Add($x) }
    }
    return @{ osSnap = $snap.ToArray(); execSnap = $exec.ToArray() }
}

function Update-ProgramacoesConcluidasPorExecucao {
    <# Depois de mesclar um lote novo de GRID_EXECUTADO: toda Programação
       vinculada (osIds) cujas OS ligadas estão TODAS com statusOS =
       Executada vira "Concluída" automaticamente - reflete de verdade o que
       já foi feito em campo, sem precisar o programador voltar na tela pra
       fechar manualmente. Programação cancelada nunca é tocada. Se só
       PARTE das OS vinculadas foi executada, a Programação continua
       "Programada" e a tela já mostra, por conta própria, quais OS dela
       ainda estão em aberto (e em alerta, se a data já passou). #>
    param(
        [Parameter(Mandatory)][System.Collections.Generic.HashSet[string]]$IdsExecutados,
        [Parameter(Mandatory)][array]$TodasOS
    )
    # v2.15.13 - ler/alterar/gravar sob o lock da programacao (outro usuario
    # pode estar mexendo nela ao mesmo tempo)
    # v3.0.5 - pega primeiro o MESMO lock das rotas de programacao (rota_programacao),
    # senao este ler-alterar-gravar podia atropelar uma programacao criada/editada por
    # outro usuario no mesmo instante (mesma ordem das rotas: rota_ -> programacao).
    $lockRotaProg = Lock-Entity -Entity "rota_programacao" -TimeoutMs 20000 -StaleMs 90000
    try {
    $lockProg = Lock-Entity -Entity "programacao" -TimeoutMs 20000
    try {
    $programacoes = @(Read-JsonModel -Entity "programacao")
    if ($programacoes.Count -eq 0) { return }
    $statusPorId = @{}
    # v3.0.4 - a OS programada e sempre a PRIMARIA: ela fica Pendente na base e quem
    # aparece Executada e uma OS-filha que aponta para ela (osPrimaria). A primaria
    # conta como atendida quando existe uma Executada apontando para ela.
    $primariasAtendidas = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($os in $TodasOS) {
        $statusPorId[[string]$os.id] = $os.statusOS
        if ($os.statusOS -eq 'Executada' -and $os.osPrimaria) {
            $chavePrim = ([string]$os.osPrimaria).Trim()
            if ($chavePrim) { [void]$primariasAtendidas.Add($chavePrim) }
        }
    }

    $mudou = $false
    foreach ($p in $programacoes) {
        if ($p.status -eq 'Cancelada' -or $p.status -eq 'Concluída') { continue }
        $vinculadas = @($p.osIds)
        if ($vinculadas.Count -eq 0) { continue }
        # v3.0.4 - nao exige mais que o lote novo "toque" a OS programada (a filha
        # executada tem outro numero): confere todas as programacoes ativas.
        $todasExecutadas = -not ($vinculadas | Where-Object {
            $idv = ([string]$_).Trim()
            $statusPorId[[string]$_] -ne 'Executada' -and -not $primariasAtendidas.Contains($idv)
        })
        if ($todasExecutadas) {
            $p.status = 'Concluída'
            $p.atualizadoEm = Get-IsoNow
            $mudou = $true
        }
    }
    if ($mudou) { Write-JsonModel -Entity "programacao" -Data $programacoes }
    } finally { Unlock-Entity -LockPath $lockProg }
    } finally { Unlock-Entity -LockPath $lockRotaProg }
}

function Import-PodasExecutado {
    <# GRID_EXECUTADO + MO_EXECUTADA -> registros com localizacao.fonte =
       'GRID_EXECUTADO', mesclados no model/manutencao_os.json.

       -ProgressCallback (opcional): scriptblock repassado pra Read-XlsxColunas
       e também chamado direto nas fases que não são leitura de arquivo
       (cruzando/concluído) - ver Invoke-PodasStreamingUpload em
       routes/importacao.ps1, que usa isso pra transmitir progresso em tempo
       real na própria resposta HTTP (o server é single-threaded: uma rota
       separada de "consultar progresso" não seria atendida enquanto o
       import estivesse rodando). #>
    param(
        [Parameter(Mandatory)][byte[]]$GridExecutadoBytes,
        [Parameter(Mandatory)][byte[]]$MoExecutadaBytes,
        [byte[]]$MoPendenteBytes,
        [scriptblock]$ProgressCallback,
        # v3.11.0 - HISTORICO: -Plano > 0 grava o resultado no arquivo do plano
        # (PodasHistorico.ps1) em vez de mesclar na base de hoje, e so aceita as OS cuja
        # data de execucao cai no periodo do plano (01/nov do ano anterior a 31/out).
        [int]$Plano = 0,
        [string]$ModoHistorico = 'substituir',
        [string]$UsuarioId = '',
        [string]$ArquivosNomes = ''
    )
    try {
        $colunasMO = @('Número OS', 'DE-PARA RECURSOS.MO 2', 'DE-PARA RECURSOS.MO 1', 'Qtd Poda', 'Qtd Limpeza (M²)', 'Qtd Estrutura')
        $moExecutada = (Read-XlsxColunas -Bytes $MoExecutadaBytes -Colunas $colunasMO `
            -ProgressCallback $ProgressCallback -ProgressLabel 'MO_EXECUTADA' -ProgressFase 'mo').linhas
        $dicMoExecutada = Get-DicionarioMO -LinhasMO $moExecutada -CampoOS 'Número OS'
        $tabelaEW = Get-TabelaPrioridadeEW
        $qtdMoExecutada = Get-QuantidadesMO -LinhasMO $moExecutada -CampoOS 'Número OS'
        $recMoExecutada = Get-RecursosMO -LinhasMO $moExecutada -CampoOS 'Número OS'
        $recMoPendente = @{}
        $moLinhasInfo = $null
        if ($Plano -le 0) { $moLinhasInfo = Save-MoLinhas -LinhasMO $moExecutada -Origem 'executada' }   # v3.23.0 (histórico por plano não mexe nas linhas da MO)

        # MO_PENDENTE é OPCIONAL aqui: só serve pra calcular o "Previsto" (a
        # OS executada busca a quantidade prevista na MO da OS-mãe/
        # OSPrimária - ver Get-ChavePrevisto). Sem ela, a importação do
        # Executado continua funcionando normalmente, só que Previsto fica
        # em 0 até o programador subir a MO_PENDENTE também (aviso no resumo).
        $qtdMoPendente = @{}
        $temMoPendente = $false
        if ($MoPendenteBytes -and $MoPendenteBytes.Length -gt 0) {
            $moPendenteLinhas = (Read-XlsxColunas -Bytes $MoPendenteBytes -Colunas $colunasMO `
                -ProgressCallback $ProgressCallback -ProgressLabel 'MO_PENDENTE' -ProgressFase 'mo').linhas
            $qtdMoPendente = Get-QuantidadesMO -LinhasMO $moPendenteLinhas -CampoOS 'Número OS'
            $recMoPendente = Get-RecursosMO -LinhasMO $moPendenteLinhas -CampoOS 'Número OS'
            $temMoPendente = $true
        }

        $colunasGridExec = @('Num. Obra','Número OS','OSPrimária(int)','COORDENADA UTM X','COORDENADA UTM Y','OSFechada?','CodSetor','Localidade','DescEsquema','Observação','Observacao','Prioridade','Data de criação','Início Execução','Término Execução','TIPO_EQUIPE_EXEC','Complemento de Localização','CODIGO DA ARVORE','Trecho','protecao')
        $gridExecutado = (Read-XlsxColunas -Bytes $GridExecutadoBytes -Colunas $colunasGridExec `
            -ProgressCallback $ProgressCallback -ProgressLabel 'SGM_EXECUTADO' -ProgressFase 'grid').linhas

        $novos = New-Object System.Collections.Generic.List[object]
        $resumo = [ordered]@{ executadoTotal = $gridExecutado.Count; executadoSemMO = 0; executadoSemCoordenada = 0; executadoPlotadas = 0; previstoCalculado = $temMoPendente; executadoAproximadas = 0; executadoSemPosicao = 0; executadoSoPrevisto = 0 }
        if ($moLinhasInfo) { $resumo['moLinhasGravadas'] = $moLinhasInfo.linhas }
        $intervaloPlano = $null
        if ($Plano -gt 0) {
            $intervaloPlano = Get-PlanoIntervalo -Plano $Plano
            $resumo['historicoPlano'] = $Plano
            $resumo['historicoInicio'] = $intervaloPlano.inicio
            $resumo['historicoFim'] = $intervaloPlano.fim
            $resumo['historicoSemData'] = 0
            $resumo['historicoForaDoPlano'] = 0
            $resumo['historicoForaPorPlano'] = [ordered]@{}
            $resumo['historicoAmostraRejeitadas'] = New-Object System.Collections.Generic.List[string]
        }
        $acumLat = @{}; $acumLng = @{}
        $semCoordLista = New-Object System.Collections.Generic.List[object]

        if ($ProgressCallback) { & $ProgressCallback @{ fase='cruzando'; arquivo='cruzando GRID com MO'; percentual=99 } }

        # O GRID_EXECUTADO real tem ~178 mil linhas - cruzar cada uma com a MO e
        # converter a coordenada (UTM -> lat/lng, várias contas trigonométricas)
        # é rápido por linha, mas a soma dá dezenas de segundos rodando em
        # silêncio total: sem nenhum aviso de progresso nesse trecho, a tela
        # ficava parada (parecia travada) e, em arquivos ainda maiores, dava
        # pra estourar o timeout de trava do navegador - mesma causa raiz já
        # corrigida no cruzamento/gravação do shapefile (ver ShapefileImporter).
        # Aqui o progresso é throttled por tempo (a cada 400ms), não por linha.
        $totalGrid = $gridExecutado.Count
        $ultimoProgressoCruzamento = [DateTime]::MinValue
        $tabelaVao = Get-VaoPostesKm
        $regrasImp = @(Get-RegrasAtivas -Base 'executada')
        $resumo['podaLinear'] = 0
        if (-not $tabelaVao) { $resumo['podaLinearSemVao'] = $true }
        $i = 0
        foreach ($linha in $gridExecutado) {
            $i++
            if ($ProgressCallback -and $totalGrid -gt 0) {
                $agora = [DateTime]::UtcNow
                if (($agora - $ultimoProgressoCruzamento).TotalMilliseconds -ge 400 -or $i -eq $totalGrid) {
                    $ultimoProgressoCruzamento = $agora
                    $pct = [Math]::Min(99, [Math]::Round(100.0 * $i / $totalGrid, 1))
                    & $ProgressCallback @{ fase='cruzando'; arquivo='cruzando GRID com MO'; linha=$i; total=$totalGrid; percentual=$pct }
                }
            }
            $osNum = $linha['Número OS']
            if ([string]::IsNullOrWhiteSpace($osNum)) { $resumo.executadoSemMO++; continue }
            $osChave = $osNum.Trim()
            # v3.11.0 - historico: o plano da OS vem da data de execucao; fora do periodo = rejeitada
            if ($Plano -gt 0) {
                $dRef = ConvertFrom-SerialExcelParaData -Valor $linha['Término Execução']
                if (-not $dRef) { $dRef = ConvertFrom-SerialExcelParaData -Valor $linha['Início Execução'] }
                if (-not $dRef) {
                    $resumo['historicoSemData'] = [int]$resumo['historicoSemData'] + 1
                    if ($resumo['historicoAmostraRejeitadas'].Count -lt 15) { $resumo['historicoAmostraRejeitadas'].Add("OS $osChave - sem data de execucao") }
                    continue
                }
                if ([string]::CompareOrdinal($dRef, $intervaloPlano.inicio) -lt 0 -or [string]::CompareOrdinal($dRef, $intervaloPlano.fim) -gt 0) {
                    $resumo['historicoForaDoPlano'] = [int]$resumo['historicoForaDoPlano'] + 1
                    $planoDaOS = Get-PlanoDaData -Iso $dRef
                    $kp = "$planoDaOS"
                    $resumo['historicoForaPorPlano'][$kp] = 1 + [int]$resumo['historicoForaPorPlano'][$kp]
                    if ($resumo['historicoAmostraRejeitadas'].Count -lt 15) { $resumo['historicoAmostraRejeitadas'].Add("OS $osChave - execucao em $dRef (plano $planoDaOS)") }
                    continue
                }
            }
            # v2.13.20 - como o BI: OS executada que NAO tem MO executada mas tem
            # PREVISTO (MO pendente da OS-mae) continua no sistema,
            # com realizado 0. Sem MO executada e sem previsto = nao e servico de
            # poda/limpeza/estrutura (inspecao etc.) e segue descartada.
            $soPrevisto = $false
            if (-not $dicMoExecutada.ContainsKey($osChave)) {
                # So vale quando a OS tem OS-MAE (OSPrimaria): o previsto vem da MO
                # pendente da mae. Conferido contra o BI (setembro/2026): 113 das 116
                # OS que o BI tem a mais sao desse tipo; OS sem mae que apenas
                # aparecem na MO pendente NAO entram no BI e continuam descartadas.
                $osPrimEarlyTxt = ([string]$linha['OSPrimária(int)']).Trim()
                if ([string]::IsNullOrWhiteSpace($osPrimEarlyTxt)) { $resumo.executadoSemMO++; continue }
                $qPrevEarly = Get-QtdOuZero -Dic $qtdMoPendente -Chave $osPrimEarlyTxt
                if (($qPrevEarly.poda + $qPrevEarly.limpeza + $qPrevEarly.estrutura) -le 0) { $resumo.executadoSemMO++; continue }
                $soPrevisto = $true
                $resumo.executadoSoPrevisto++
            }

            $xTxt = $linha['COORDENADA UTM X']; $yTxt = $linha['COORDENADA UTM Y']
            $x = 0.0; $y = 0.0
            $latlng = $null
            if ([double]::TryParse($xTxt, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$x) -and
                [double]::TryParse($yTxt, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$y) -and
                $x -ne 0 -and $y -ne 0) {
                $latlng = ConvertFrom-UtmParaLatLng -Leste $x -Norte $y -Zona 22
            }
            $chaveLoc = Get-NomeLocalidadeSemCodigo -Texto $linha['Localidade']
            $latV = $null; $lngV = $null
            if ($latlng) {
                $latV = $latlng.lat; $lngV = $latlng.lng
                if ($chaveLoc) { Add-PontoAcumulado -AcLat $acumLat -AcLng $acumLng -Chave $chaveLoc -Lat $latV -Lng $lngV }
            } else {
                $resumo.executadoSemCoordenada++
            }
            if ($soPrevisto) {
                $tipoDerivado = 'Poda'
                if ($qPrevEarly.poda -le 0 -and $qPrevEarly.limpeza -gt 0) { $tipoDerivado = 'Limpeza de Faixa' }
                elseif ($qPrevEarly.poda -le 0 -and $qPrevEarly.estrutura -gt 0) { $tipoDerivado = 'Estrutura' }
                $mo = @{ tipoServico = $tipoDerivado; detalhe = $null }
            } else {
                $mo = $dicMoExecutada[$osChave]
            }

            $dataExec = ConvertFrom-SerialExcelParaData -Valor $linha['Término Execução']
            if (-not $dataExec) { $dataExec = ConvertFrom-SerialExcelParaData -Valor $linha['Início Execução'] }

            # Previsto/Realizado — mecanismo confirmado com os arquivos reais:
            # Realizado = linhas da MO_EXECUTADA batendo na PRÓPRIA OS;
            # Previsto = linhas da MO_PENDENTE batendo na OS-MÃE (OSPrimária)
            # quando existir, senão na própria OS (ver Get-ChavePrevisto).
            $osPrimariaTxt = $linha['OSPrimária(int)']
            $osPrimaria = if ([string]::IsNullOrWhiteSpace($osPrimariaTxt)) { $null } else { $osPrimariaTxt.Trim() }
            $chavePrevisto = Get-ChavePrevisto -OsChave $osChave -OsPrimaria $osPrimaria
            $qPrev = Get-QtdOuZero -Dic $qtdMoPendente -Chave $chavePrevisto
            $qReal = Get-QtdOuZero -Dic $qtdMoExecutada -Chave $osChave

            # v2.15.4 - PODA LINEAR (como o BI): zera os recursos da MO e a limpeza de
            # faixa vem do tamanho do vao (Rota km x 15.000 m2) do poste da OS.
            # So vale pra OS que tem linha de MO executada.
            # v3.33.0 - as regras (poda linear etc.) agora sao dados editaveis em Configuracao > Regras de importacao
            if ($regrasImp.Count -gt 0) {
                $rr = Invoke-RegrasImportacao -Regras $regrasImp -Linha $linha -QReal $qReal -QPrev $qPrev -Mo $mo -TabelaVao $tabelaVao -PosteId (Get-PosteIdDoComplemento $linha['Complemento de Localização']) -SoPrevisto $soPrevisto -Resumo $resumo
                $qReal = $rr.qReal; $qPrev = $rr.qPrev; $mo = $rr.mo
            }

            $reg = [ordered]@{
                id = $osChave; origem = 'SGM'; osPrimaria = $osPrimaria; idVera = (Get-IdVeraDaGrid $linha)
                statusOS = (ConvertTo-StatusExecutado -OsFechada $linha['OSFechada?'])
                tipoServico = $mo.tipoServico; tipoEquipeNecessaria = $null; posteId = (Get-PosteIdDoComplemento $linha['Complemento de Localização']); tipoEquipeExec = $(if ([string]::IsNullOrWhiteSpace([string]$linha['TIPO_EQUIPE_EXEC'])) { 'Livre' } else { ([string]$linha['TIPO_EQUIPE_EXEC']).Trim() })
                numObra = (Get-TextoOuNulo $linha['Num. Obra']); recursoMo = $(if ($recMoExecutada.ContainsKey($osChave)) { $recMoExecutada[$osChave] } elseif ($recMoPendente.ContainsKey($chavePrevisto)) { $recMoPendente[$chavePrevisto] } else { $null })
                prioridade = (Get-PrioridadeSgm $linha['Prioridade']); prioridadeEW = (ConvertTo-PrioridadeEW -CodPrioridade $linha['Prioridade'] -QtdPoda ($qPrev.poda + $qReal.poda) -QtdLimpeza ($qPrev.limpeza + $qReal.limpeza) -QtdEstrutura ($qPrev.estrutura + $qReal.estrutura) -TipoServico ([string]$mo.tipoServico) -Tabela $tabelaEW); equipeId = (Get-EquipeExecutoraDoNumeroOS -OsChave $osChave)
                dataAbertura = (ConvertFrom-SerialExcelParaData -Valor $linha['Data de criação']); dataExecucao = $dataExec
                ativo = $null; alimentador = $linha['CodSetor']; conjunto = $null; localidade = (Get-NomeLocalidadeSemCodigo -Texto $linha['Localidade']); protecaoId = (Get-TextoOuNulo $linha['protecao']); trecho = (Get-TrechoDaGrid $linha['Trecho'])
                localizacao = [ordered]@{ lat = $latV; lng = $lngV; fonte = 'GRID_EXECUTADO'; aproximada = $false }
                previsto = [Math]::Round($qPrev.poda, 2); realizado = [Math]::Round($qReal.poda, 2)
                previstoPoda = [Math]::Round($qPrev.poda, 2); previstoLimpeza = [Math]::Round($qPrev.limpeza, 2); previstoEstrutura = [Math]::Round($qPrev.estrutura, 2)
                realizadoPoda = [Math]::Round($qReal.poda, 2); realizadoLimpeza = [Math]::Round($qReal.limpeza, 2); realizadoEstrutura = [Math]::Round($qReal.estrutura, 2)
                descEsquema = (Get-TextoOuNulo $linha['DescEsquema'])
                observacao = (ConvertTo-TextoCorrigido $(if ($linha['Observação']) { $linha['Observação'] } else { $linha['Observacao'] }))
            }
            if ($Plano -gt 0) { $reg.Remove('observacao') }
            $novos.Add($reg)
            if ($latlng) { $resumo.executadoPlotadas++ } else { $semCoordLista.Add(@{ reg = $reg; chave = $chaveLoc }) }
        }

        # Gravar o resultado (ConvertTo-Json de novo num array que pode chegar
        # a dezenas de milhares de registros, mais o rename atômico do
        # arquivo) também não é instantâneo - um aviso aqui evita que a tela
        # fique parada em "99% cruzando" enquanto na real já tá gravando.
        # v2.14.3 - cadeia de posicao: VERA > XY > Poste > centro da cidade
        $cadeia = Set-PosicaoPorVeraEPoste -Novos $novos -SemCoordLista $semCoordLista
        $semCoordLista = $cadeia.semCoord
        foreach ($k in $cadeia.stats.Keys) { $resumo[$k] = $cadeia.stats[$k] }
        $posEx = Set-PosicaoAproximada -Pendentes $semCoordLista -AcLat $acumLat -AcLng $acumLng
        Set-OrigemCidadeNasAproximadas -SemCoordLista $semCoordLista
        $resumo.executadoAproximadas = $posEx['aproximadas']
        $resumo.executadoSemPosicao = $posEx['semPosicao']
        if ($ProgressCallback) { & $ProgressCallback @{ fase='gravando'; percentual=99 } }
        if ($Plano -gt 0) {
            $hist = Save-PodasHistorico -Plano $Plano -Modo $ModoHistorico -Novos $novos -UsuarioId $UsuarioId -Arquivos $ArquivosNomes -ProgressCallback $ProgressCallback
            foreach ($k in $hist.Keys) { $resumo[$k] = $hist[$k] }
        } else {
            Merge-PodasNoModelo -FonteSubstituida 'GRID_EXECUTADO' -Novos $novos -ProgressCallback $ProgressCallback
        }
        $resumo.totalPlotadas = $novos.Count
        return $resumo
    } finally {
        if ($ProgressCallback) { & $ProgressCallback @{ fase='concluido'; percentual=100 } }
    }
}

function Import-PodasPendente {
    <# GRID_PENDENTE + MO_PENDENTE -> registros com localizacao.fonte =
       'GRID_PENDENTE', mesclados no model/manutencao_os.json. Ver
       -ProgressCallback em Import-PodasExecutado, acima. #>
    param(
        [Parameter(Mandatory)][byte[]]$GridPendenteBytes,
        [Parameter(Mandatory)][byte[]]$MoPendenteBytes,
        [byte[]]$MoExecutadaBytes,
        [scriptblock]$ProgressCallback
    )
    try {
        $colunasMO = @('Número OS', 'DE-PARA RECURSOS.MO 2', 'DE-PARA RECURSOS.MO 1', 'Qtd Poda', 'Qtd Limpeza (M²)', 'Qtd Estrutura')
        $moPendente = (Read-XlsxColunas -Bytes $MoPendenteBytes -Colunas $colunasMO `
            -ProgressCallback $ProgressCallback -ProgressLabel 'MO_PENDENTE' -ProgressFase 'mo').linhas
        $dicMoPendente = Get-DicionarioMO -LinhasMO $moPendente -CampoOS 'Número OS'
        $tabelaEW = Get-TabelaPrioridadeEW
        $qtdMoPendente = Get-QuantidadesMO -LinhasMO $moPendente -CampoOS 'Número OS'
        $recMoPendente = Get-RecursosMO -LinhasMO $moPendente -CampoOS 'Número OS'
        $recMoExecutada = @{}
        $moLinhasInfo = Save-MoLinhas -LinhasMO $moPendente -Origem 'pendente'   # v3.23.0

        # MO_EXECUTADA é OPCIONAL aqui: uma OS pendente às vezes já tem algum
        # apontamento de execução parcial (ou acabou de fechar e ainda não
        # foi reclassificada) — quando a planilha vem junto, usamos pra
        # preencher Realizado também nas linhas pendentes, pela própria OS.
        $qtdMoExecutada = @{}
        if ($MoExecutadaBytes -and $MoExecutadaBytes.Length -gt 0) {
            $moExecutadaLinhas = (Read-XlsxColunas -Bytes $MoExecutadaBytes -Colunas $colunasMO `
                -ProgressCallback $ProgressCallback -ProgressLabel 'MO_EXECUTADA' -ProgressFase 'mo').linhas
            $qtdMoExecutada = Get-QuantidadesMO -LinhasMO $moExecutadaLinhas -CampoOS 'Número OS'
            $recMoExecutada = Get-RecursosMO -LinhasMO $moExecutadaLinhas -CampoOS 'Número OS'
        }

        $colunasGridPend = @('Num. Obra','OSNumero','CodEsquema','COORDENADA UTM X','COORDENADA UTM Y','CodEstado','CodSetor','Localidade','DescEsquema','Observação','Observacao','CodPrioridade','DataCriação','TIPO_EQUIPE_EXEC','Complemento de Localização','CODIGO DA ARVORE','Trecho','protecao')
        $gridPendente = (Read-XlsxColunas -Bytes $GridPendenteBytes -Colunas $colunasGridPend `
            -ProgressCallback $ProgressCallback -ProgressLabel 'SGM_PENDENTE' -ProgressFase 'grid').linhas

        $novos = New-Object System.Collections.Generic.List[object]
        $resumo = [ordered]@{ pendenteTotal = $gridPendente.Count; pendenteSemMO = 0; pendentePrevistoPorEsquema = 0; pendenteSemCoordenada = 0; pendentePlotadas = 0; pendenteAproximadas = 0; pendenteSemPosicao = 0 }
        if ($moLinhasInfo) { $resumo['moLinhasGravadas'] = $moLinhasInfo.linhas }
        $acumLat = @{}; $acumLng = @{}
        $semCoordLista = New-Object System.Collections.Generic.List[object]

        if ($ProgressCallback) { & $ProgressCallback @{ fase='cruzando'; arquivo='cruzando GRID com MO'; percentual=99 } }

        # Mesmo motivo do Import-PodasExecutado acima: sem progresso item a
        # item aqui, esse laço ficava mudo por dezenas de segundos num arquivo
        # grande e passava a impressão de tela travada.
        $totalGridPend = $gridPendente.Count
        $ultimoProgressoCruzamento = [DateTime]::MinValue
        $tabelaVaoPend = Get-VaoPostesKm
        $regrasImp = @(Get-RegrasAtivas -Base 'pendente')
        $tabelaEsquemas = Get-TabelaEsquemas
        $resumo['podaLinear'] = 0
        $i = 0
        foreach ($linha in $gridPendente) {
            $i++
            if ($ProgressCallback -and $totalGridPend -gt 0) {
                $agora = [DateTime]::UtcNow
                if (($agora - $ultimoProgressoCruzamento).TotalMilliseconds -ge 400 -or $i -eq $totalGridPend) {
                    $ultimoProgressoCruzamento = $agora
                    $pct = [Math]::Min(99, [Math]::Round(100.0 * $i / $totalGridPend, 1))
                    & $ProgressCallback @{ fase='cruzando'; arquivo='cruzando GRID com MO'; linha=$i; total=$totalGridPend; percentual=$pct }
                }
            }
            $osNum = $linha['OSNumero']
            if ([string]::IsNullOrWhiteSpace($osNum)) { $resumo.pendenteSemMO++; continue }
            $osChave = $osNum.Trim()
            # v2.15.20 - OS pendente SEM linha na MO: se o esquema dela esta na base "Esquemas"
            # (esquemas que nao podem ser ignorados), entra com previsto 1 do tipo do esquema
            # (1 poda / 1 m2 de faixa / 1 estrutura). Fora da base, continua descartada.
            $tipoEsquema = ''
            if (-not $dicMoPendente.ContainsKey($osChave)) {
                $tipoEsquema = Get-TipoDoEsquemaDaOS -Tabela $tabelaEsquemas -DescEsquema ([string]$linha['DescEsquema']) -CodEsquema ([string]$linha['CodEsquema'])
                if (-not $tipoEsquema) { $resumo.pendenteSemMO++; continue }
            }

            $xTxt = $linha['COORDENADA UTM X']; $yTxt = $linha['COORDENADA UTM Y']
            $x = 0.0; $y = 0.0
            $latlng = $null
            if ([double]::TryParse($xTxt, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$x) -and
                [double]::TryParse($yTxt, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$y) -and
                $x -ne 0 -and $y -ne 0) {
                $latlng = ConvertFrom-UtmParaLatLng -Leste $x -Norte $y -Zona 22
            }
            $chaveLoc = $(if ([string]::IsNullOrWhiteSpace([string]$linha['CodSetor'])) { $null } else { ([string]$linha['CodSetor']).Trim().ToUpper() })
            $latV = $null; $lngV = $null
            if ($latlng) {
                $latV = $latlng.lat; $lngV = $latlng.lng
                if ($chaveLoc) { Add-PontoAcumulado -AcLat $acumLat -AcLng $acumLng -Chave $chaveLoc -Lat $latV -Lng $lngV }
            } else {
                $resumo.pendenteSemCoordenada++
            }
            if ($tipoEsquema) {
                $nomeTipo = switch ($tipoEsquema) { 'limpeza' { 'Limpeza de Faixa' } 'estrutura' { 'Estrutura' } default { 'Poda' } }
                $mo = @{ tipoServico = $nomeTipo; detalhe = $null }
                $qPrev = @{ poda = $(if ($tipoEsquema -eq 'poda') { 1.0 } else { 0.0 }); limpeza = $(if ($tipoEsquema -eq 'limpeza') { 1.0 } else { 0.0 }); estrutura = $(if ($tipoEsquema -eq 'estrutura') { 1.0 } else { 0.0 }) }
                $resumo['pendentePrevistoPorEsquema'] = [int]$resumo['pendentePrevistoPorEsquema'] + 1
            } else {
                $mo = $dicMoPendente[$osChave]
                $qPrev = Get-QtdOuZero -Dic $qtdMoPendente -Chave $osChave
            }
            $qReal = Get-QtdOuZero -Dic $qtdMoExecutada -Chave $osChave

            # v2.15.4 - PODA LINEAR (ver Import-PodasExecutado): previsto = vao x 15.000 m2
            if ($regrasImp.Count -gt 0) {
                $rr = Invoke-RegrasImportacao -Regras $regrasImp -Linha $linha -QReal $qReal -QPrev $qPrev -Mo $mo -TabelaVao $tabelaVaoPend -PosteId (Get-PosteIdDoComplemento $linha['Complemento de Localização']) -SoPrevisto $false -Resumo $resumo
                $qReal = $rr.qReal; $qPrev = $rr.qPrev; $mo = $rr.mo
            }

            $reg = [ordered]@{
                id = $osChave; origem = 'SGM'; osPrimaria = $null; idVera = (Get-IdVeraDaGrid $linha)
                statusOS = (ConvertTo-StatusPendente -CodEstado $linha['CodEstado'])
                tipoServico = $mo.tipoServico; tipoEquipeNecessaria = $null; posteId = (Get-PosteIdDoComplemento $linha['Complemento de Localização']); tipoEquipeExec = $(if ([string]::IsNullOrWhiteSpace([string]$linha['TIPO_EQUIPE_EXEC'])) { 'Livre' } else { ([string]$linha['TIPO_EQUIPE_EXEC']).Trim() })
                numObra = (Get-TextoOuNulo $linha['Num. Obra']); recursoMo = $(if ($recMoPendente.ContainsKey($osChave)) { $recMoPendente[$osChave] } elseif ($recMoExecutada.ContainsKey($osChave)) { $recMoExecutada[$osChave] } else { $null })
                prioridade = (Get-PrioridadeSgm $linha['CodPrioridade']); prioridadeEW = (ConvertTo-PrioridadeEW -CodPrioridade $linha['CodPrioridade'] -QtdPoda ($qPrev.poda + $qReal.poda) -QtdLimpeza ($qPrev.limpeza + $qReal.limpeza) -QtdEstrutura ($qPrev.estrutura + $qReal.estrutura) -TipoServico ([string]$mo.tipoServico) -Tabela $tabelaEW); equipeId = (Get-EquipeExecutoraDoNumeroOS -OsChave $osChave)
                dataAbertura = (ConvertFrom-SerialExcelParaData -Valor $linha['DataCriação']); dataExecucao = $null
                ativo = $null; alimentador = $linha['CodSetor']; conjunto = $null; localidade = (Get-NomeLocalidadeSemCodigo -Texto $linha['Localidade']); protecaoId = (Get-TextoOuNulo $linha['protecao']); trecho = (Get-TrechoDaGrid $linha['Trecho'])
                localizacao = [ordered]@{ lat = $latV; lng = $lngV; fonte = 'GRID_PENDENTE'; aproximada = $false }
                previsto = [Math]::Round($qPrev.poda, 2); realizado = [Math]::Round($qReal.poda, 2)
                previstoPoda = [Math]::Round($qPrev.poda, 2); previstoLimpeza = [Math]::Round($qPrev.limpeza, 2); previstoEstrutura = [Math]::Round($qPrev.estrutura, 2)
                realizadoPoda = [Math]::Round($qReal.poda, 2); realizadoLimpeza = [Math]::Round($qReal.limpeza, 2); realizadoEstrutura = [Math]::Round($qReal.estrutura, 2)
                descEsquema = (Get-TextoOuNulo $linha['DescEsquema'])
                observacao = (ConvertTo-TextoCorrigido $(if ($linha['Observação']) { $linha['Observação'] } else { $linha['Observacao'] }))
                previstoPorEsquema = [bool]$tipoEsquema
            }
            $novos.Add($reg)
            if ($latlng) { $resumo.pendentePlotadas++ } else { $semCoordLista.Add(@{ reg = $reg; chave = $chaveLoc }) }
        }

        # v2.14.3 - cadeia de posicao: VERA > XY > Poste > centro da cidade
        if ($ProgressCallback) { & $ProgressCallback @{ fase='cruzando'; arquivo='posicao pela VERA e pelos postes'; percentual=99 } }
        $cronCadeia = [System.Diagnostics.Stopwatch]::StartNew()
        $cadeia = Set-PosicaoPorVeraEPoste -Novos $novos -SemCoordLista $semCoordLista
        Write-Host ("  [importacao] posicao VERA/poste: {0:N1}s" -f $cronCadeia.Elapsed.TotalSeconds) -ForegroundColor DarkCyan
        $semCoordLista = $cadeia.semCoord
        foreach ($k in $cadeia.stats.Keys) { $resumo[$k] = $cadeia.stats[$k] }
        $posPe = Set-PosicaoAproximada -Pendentes $semCoordLista -AcLat $acumLat -AcLng $acumLng
        Set-OrigemCidadeNasAproximadas -SemCoordLista $semCoordLista
        $resumo.pendenteAproximadas = $posPe['aproximadas']
        $resumo.pendenteSemPosicao = $posPe['semPosicao']
        if ($ProgressCallback) { & $ProgressCallback @{ fase='gravando'; percentual=99 } }
        Merge-PodasNoModelo -FonteSubstituida 'GRID_PENDENTE' -Novos $novos -ProgressCallback $ProgressCallback
        $resumo.totalPlotadas = $novos.Count
        return $resumo
    } finally {
        if ($ProgressCallback) { & $ProgressCallback @{ fase='concluido'; percentual=100 } }
    }
}

function Import-PodasSigod {
    <# SIGOD - podas que NAO vem do GRID/MO: sao as podas de "oportunidade" e
       de "plantao" (reclamacao de cliente, atendimento de emergencia) que o
       SIGOD registra, exportadas na planilha basePoda<mes>-<ano>.xlsx (aba
       "Base Poda", 1 linha por OS). Mesmo destino do GRID (model/
       manutencao_os.json -> Mapa de Manutencao), registros com
       localizacao.fonte = 'SIGOD' e origem = 'SIGOD', mesclados pelo
       Merge-PodasNoModelo (o lote SIGOD e substituido a cada import; os
       lotes GRID_EXECUTADO/GRID_PENDENTE ficam intactos).

       Diferencas pro GRID:
         - Sem cruzamento com MO: a planilha ja e 1 linha por OS.
         - Coordenada ja vem em graus (VLR_COORDENADA_LATITUDE/LONGITUDE),
           nao UTM - so e validada (faixa do Brasil) e o decimal com virgula
           e aceito.
         - Status: DTH_FIM_EXECUCAO preenchida = Executada; senao
           DH_ALOCACAO preenchida = Despachada; senao Pendente.
         - Previsto/Realizado = 1 por OS (cada poda e um atendimento);
           Realizado so quando executada.
         - Prioridade EW: TIPO_PODA = "PODA PLANTAO" (emergencia).
         - A observacao NAO copia DSC_OBSERVACAO_OS (texto livre do
           atendente, traz CPF, nome e telefone do cliente) - guarda so tipo
           da poda + endereco da ocorrencia.
         - Localidade: coluna LOCALIDADE (e formula na planilha) se vier
           preenchida; senao cruza CODLCD com o D_Localidade importado. #>
    param(
        [Parameter(Mandatory)][byte[]]$BasePodaBytes,
        [scriptblock]$ProgressCallback
    )
    try {
        $colunas = @('NUMOS','DATA_SOL','VLR_COORDENADA_LATITUDE','VLR_COORDENADA_LONGITUDE','NUM_ALIMENTADOR',
                     'EQUIPE','DH_ALOCACAO','DTH_FIM_EXECUCAO','TIPO_PODA','NOM_LOGRADOURO','NUM_CASA','DSC_BAIRRO','CODLCD','LOCALIDADE')
        $linhas = (Read-XlsxColunas -Bytes $BasePodaBytes -Colunas $colunas `
            -ProgressCallback $ProgressCallback -ProgressLabel 'BASE_PODA (SIGOD)' -ProgressFase 'grid').linhas

        # CODLCD -> nome da localidade, so pra linhas onde a coluna LOCALIDADE
        # (formula) veio vazia.
        $localidadePorCod = @{}
        foreach ($loc in @(Read-JsonModel -Entity "localidades")) {
            if ($loc.codLocalidade -ne $null -and -not [string]::IsNullOrWhiteSpace([string]$loc.localidade)) {
                $localidadePorCod[([string]$loc.codLocalidade).Trim()] = [string]$loc.localidade
            }
        }

        $inv = [System.Globalization.CultureInfo]::InvariantCulture
        $resumo = [ordered]@{ sigodTotal = $linhas.Count; sigodSemNumeroOS = 0; sigodSemCoordenada = 0; sigodPlotadas = 0; sigodExecutadas = 0; sigodPlantao = 0 }
        $porId = [ordered]@{}
        $acumLat = @{}; $acumLng = @{}
        $semCoordLista = New-Object System.Collections.Generic.List[object]
        if ($ProgressCallback) { & $ProgressCallback @{ fase='cruzando'; arquivo='convertendo a base SIGOD'; percentual=99 } }

        $total = $linhas.Count
        $ultimoProgresso = [DateTime]::MinValue
        $i = 0
        foreach ($linha in $linhas) {
            $i++
            if ($ProgressCallback -and $total -gt 0) {
                $agora = [DateTime]::UtcNow
                if (($agora - $ultimoProgresso).TotalMilliseconds -ge 400 -or $i -eq $total) {
                    $ultimoProgresso = $agora
                    $pct = [Math]::Min(99, [Math]::Round(100.0 * $i / $total, 1))
                    & $ProgressCallback @{ fase='cruzando'; arquivo='convertendo a base SIGOD'; linha=$i; total=$total; percentual=$pct }
                }
            }

            $numOs = [string]$linha['NUMOS']
            if ([string]::IsNullOrWhiteSpace($numOs)) { $resumo.sigodSemNumeroOS++; continue }
            $numOs = $numOs.Trim()
            # numero da OS as vezes vem como "88976420.0" (numero lido como decimal)
            if ($numOs -match '^(\d+)\.0+$') { $numOs = $Matches[1] }

            # v2.15.5 - OS SEM coordenada valida NAO sai mais: entra nos totais (como no
            # BI) com posicao aproximada no centro da localidade (marcada com *); sem
            # nenhuma referencia fica sem posicao (conta nos totais, nao vai pro mapa).
            $lat = 0.0; $lng = 0.0
            $temCoord = $true
            $latTxt = ([string]$linha['VLR_COORDENADA_LATITUDE']).Trim().Replace(',', '.')
            $lngTxt = ([string]$linha['VLR_COORDENADA_LONGITUDE']).Trim().Replace(',', '.')
            if (-not [double]::TryParse($latTxt, [System.Globalization.NumberStyles]::Float, $inv, [ref]$lat) -or
                -not [double]::TryParse($lngTxt, [System.Globalization.NumberStyles]::Float, $inv, [ref]$lng) -or
                $lat -lt -35 -or $lat -gt 6 -or $lng -lt -75 -or $lng -gt -30) {
                $resumo.sigodSemCoordenada++
                $temCoord = $false
            }

            $dataExec = ConvertFrom-SerialExcelParaData -Valor ([string]$linha['DTH_FIM_EXECUCAO'])
            $alocada = -not [string]::IsNullOrWhiteSpace([string]$linha['DH_ALOCACAO'])
            $status = if ($dataExec) { 'Executada' } elseif ($alocada) { 'Despachada' } else { 'Pendente' }

            $tipoPoda = ([string]$linha['TIPO_PODA']).Trim()
            $plantao = $tipoPoda.ToUpper().Contains('PLANT')
            if ($plantao) { $resumo.sigodPlantao++ }
            if ($status -eq 'Executada') { $resumo.sigodExecutadas++ }

            $localidade = ([string]$linha['LOCALIDADE']).Trim()
            if ([string]::IsNullOrWhiteSpace($localidade) -or $localidade.StartsWith('=')) {
                $cod = ([string]$linha['CODLCD']).Trim()
                if ($cod -match '^(\d+)\.0+$') { $cod = $Matches[1] }
                $localidade = if ($localidadePorCod.ContainsKey($cod)) { $localidadePorCod[$cod] } else { $null }
            }

            $partesEndereco = @(([string]$linha['NOM_LOGRADOURO']).Trim(), ([string]$linha['NUM_CASA']).Trim()) | Where-Object { $_ }
            $endereco = ($partesEndereco -join ', ')
            $bairro = ([string]$linha['DSC_BAIRRO']).Trim()
            $obs = @($tipoPoda, $endereco, $bairro) | Where-Object { $_ }
            $observacao = ($obs -join ' - ')

            $equipe = ([string]$linha['EQUIPE']).Trim()
            $id = "SIGOD-$numOs"
            $chaveLocSig = Get-NomeLocalidadeSemCodigo -Texto $localidade
            $latSig = $null; $lngSig = $null
            if ($temCoord) {
                $latSig = $lat; $lngSig = $lng
                if ($chaveLocSig) { Add-PontoAcumulado -AcLat $acumLat -AcLng $acumLng -Chave $chaveLocSig -Lat $lat -Lng $lng }
            }
            $porId[$id] = [ordered]@{
                id = $id; origem = 'SIGOD'; osPrimaria = $null; idVera = $null
                statusOS = $status
                tipoServico = 'Poda'; tipoEquipeNecessaria = $null
                prioridadeEW = $false; equipeId = $(if ($equipe) { $equipe } else { $null })
                dataAbertura = (ConvertFrom-SerialExcelParaData -Valor ([string]$linha['DATA_SOL'])); dataExecucao = $dataExec
                ativo = $null; alimentador = ([string]$linha['NUM_ALIMENTADOR']).Trim(); conjunto = $localidade; protecaoId = $null
                localizacao = [ordered]@{ lat = $latSig; lng = $lngSig; fonte = 'SIGOD'; aproximada = $false }
                previsto = 1; realizado = $(if ($status -eq 'Executada') { 1 } else { 0 })
                previstoPoda = 1; previstoLimpeza = 0; previstoEstrutura = 0
                realizadoPoda = $(if ($status -eq 'Executada') { 1 } else { 0 }); realizadoLimpeza = 0; realizadoEstrutura = 0
                observacao = $observacao
            }
            if ($temCoord) { $resumo.sigodPlotadas++ } else { $semCoordLista.Add(@{ reg = $porId[$id]; chave = $chaveLocSig }) }
        }

        $posSig = Set-PosicaoAproximada -Pendentes $semCoordLista -AcLat $acumLat -AcLng $acumLng
        Set-OrigemCidadeNasAproximadas -SemCoordLista $semCoordLista
        $resumo.sigodAproximadas = $posSig['aproximadas']
        $resumo.sigodSemPosicao = $posSig['semPosicao']

        $novos = New-Object System.Collections.Generic.List[object]
        foreach ($v in $porId.Values) { $novos.Add($v) }
        if ($ProgressCallback) { & $ProgressCallback @{ fase='gravando'; percentual=99 } }
        Merge-PodasNoModelo -FonteSubstituida 'SIGOD' -Novos $novos -ProgressCallback $ProgressCallback
        $resumo.totalPlotadas = $novos.Count
        return $resumo
    } finally {
        if ($ProgressCallback) { & $ProgressCallback @{ fase='concluido'; percentual=100 } }
    }
}

function Import-PodasSigodPendente {
    <# v2.13.24 - SIGOD PENDENTES (planilha pendentes_sigod.xlsx, 1 linha por OS,
       servicos 324 "poda de arvore operacao" e 77 "poda de arvore"). Cada OS e
       1 poda prevista, status Pendente, EW = nao (EW nao conta pro SIGOD).
       Coordenada = UTM zona 22 (vlrcdn_x/vlrcdn_y; a zona 22 "estendida" vale
       tambem pra regional 3, x ~ 950 mil). Valores fora da faixa (vazios,
       repetidos ou com a virgula deslocada) ficam sem coordenada e ganham
       posicao aproximada pelo centro da localidade (nomelcd), com "*".
       Lote proprio (SIGOD_PENDENTE): nao mexe no SIGOD executado. OS que ja
       esta no lote SIGOD (executada) nao e duplicada. #>
    param(
        [Parameter(Mandatory)][byte[]]$BasePendenteBytes,
        [scriptblock]$ProgressCallback
    )
    try {
        $colunas = @('numos','datasol','dataprev','codlcd','nomelcd','vlrcdn_x','vlrcdn_y','sitos','dscsvc','codserv','obsos','dsclgr_os','numcasa','bairro','codreg')
        $linhas = (Read-XlsxColunas -Bytes $BasePendenteBytes -Colunas $colunas `
            -ProgressCallback $ProgressCallback -ProgressLabel 'SIGOD_PENDENTES' -ProgressFase 'grid').linhas
        $inv = [System.Globalization.CultureInfo]::InvariantCulture
        $resumo = [ordered]@{ sigodPendTotal = $linhas.Count; sigodPendSemNumeroOS = 0; sigodPendJaExecutadas = 0; sigodPendComCoordenada = 0; sigodPendAproximadas = 0; sigodPendSemPosicao = 0; sigodPendCoordInvalida = 0 }

        $idsSigod = [System.Collections.Generic.HashSet[string]]::new()
        foreach ($e in @(Read-JsonModel -Entity "manutencao_os")) {
            if ($e.localizacao -and $e.localizacao.fonte -eq 'SIGOD') { [void]$idsSigod.Add([string]$e.id) }
        }

        $porId = [ordered]@{}
        $acumLat = @{}; $acumLng = @{}; $semCoordLista = New-Object System.Collections.Generic.List[object]
        foreach ($linha in $linhas) {
            $numOs = ([string]$linha['numos']).Trim()
            if ($numOs -match '^(\d+)\.0+$') { $numOs = $Matches[1] }
            if ([string]::IsNullOrWhiteSpace($numOs)) { $resumo.sigodPendSemNumeroOS++; continue }
            $id = "SIGOD-$numOs"
            if ($idsSigod.Contains($id)) { $resumo.sigodPendJaExecutadas++; continue }
            if ($porId.Contains($id)) { continue }

            $latV = $null; $lngV = $null
            $xt = ([string]$linha['vlrcdn_x']).Trim().Replace(',', '.')
            $yt = ([string]$linha['vlrcdn_y']).Trim().Replace(',', '.')
            $x = 0.0; $y = 0.0
            if ($xt -ne '' -or $yt -ne '') {
                if ([double]::TryParse($xt, [System.Globalization.NumberStyles]::Float, $inv, [ref]$x) -and
                    [double]::TryParse($yt, [System.Globalization.NumberStyles]::Float, $inv, [ref]$y) -and
                    $x -ge 150000 -and $x -le 1300000 -and $y -ge 6500000 -and $y -le 8200000) {
                    $ll = ConvertFrom-UtmParaLatLng -Leste $x -Norte $y -Zona 22
                    if ($ll) { $latV = $ll.lat; $lngV = $ll.lng }
                }
                if ($null -eq $latV) { $resumo.sigodPendCoordInvalida++ }
            }

            $nomeLoc = Get-NomeLocalidadeSemCodigo -Texto $linha['nomelcd']
            if ($null -ne $latV) {
                $resumo.sigodPendComCoordenada++
                if ($nomeLoc) { Add-PontoAcumulado -AcLat $acumLat -AcLng $acumLng -Chave $nomeLoc -Lat $latV -Lng $lngV }
            }

            $partes = @(([string]$linha['dsclgr_os']).Trim(), ([string]$linha['numcasa']).Trim()) | Where-Object { $_ }
            $endereco = ($partes -join ', ')
            $bairro = ([string]$linha['bairro']).Trim()
            $servico = if ([string]$linha['codserv'] -match '324') { 'Poda de árvore operação (324)' } else { 'Poda de árvore (77)' }
            $observacao = (@($servico, $endereco, $bairro) | Where-Object { $_ }) -join ' - '

            $reg = [ordered]@{
                id = $id; origem = 'SIGOD'; osPrimaria = $null; idVera = $null
                statusOS = 'Pendente'
                tipoServico = 'Poda'; tipoEquipeNecessaria = $null
                prioridadeEW = $false; equipeId = $null
                dataAbertura = (ConvertFrom-SerialExcelParaData -Valor ([string]$linha['datasol'])); dataExecucao = $null
                dataPrevista = (ConvertFrom-SerialExcelParaData -Valor ([string]$linha['dataprev']))
                ativo = $null; alimentador = $null; conjunto = $nomeLoc; protecaoId = $null
                localizacao = [ordered]@{ lat = $latV; lng = $lngV; fonte = 'SIGOD_PENDENTE'; aproximada = $false }
                previsto = 1; realizado = 0
                previstoPoda = 1; previstoLimpeza = 0; previstoEstrutura = 0
                realizadoPoda = 0; realizadoLimpeza = 0; realizadoEstrutura = 0
                observacao = $observacao
            }
            $porId[$id] = $reg
            if ($null -eq $latV) { $semCoordLista.Add(@{ chave = $nomeLoc; reg = $reg }) }
        }
        if ($ProgressCallback) { & $ProgressCallback @{ fase='cruzando'; arquivo='posicao aproximada das OS sem coordenada'; percentual=99 } }
        $apr = Set-PosicaoAproximada -Pendentes $semCoordLista -AcLat $acumLat -AcLng $acumLng
        $resumo.sigodPendAproximadas = $apr['aproximadas']
        $resumo.sigodPendSemPosicao = $apr['semPosicao']

        $novos = New-Object System.Collections.Generic.List[object]
        foreach ($v in $porId.Values) { $novos.Add($v) }
        if ($ProgressCallback) { & $ProgressCallback @{ fase='gravando'; percentual=99 } }
        Merge-PodasNoModelo -FonteSubstituida 'SIGOD_PENDENTE' -Novos $novos -ProgressCallback $ProgressCallback
        $resumo.totalPlotadas = $novos.Count
        return $resumo
    } finally {
        if ($ProgressCallback) { & $ProgressCallback @{ fase='concluido'; percentual=100 } }
    }
}
