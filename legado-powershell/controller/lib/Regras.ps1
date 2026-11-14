# =============================================================================
# lib/Regras.ps1 - Regras de importacao editaveis (v3.33.0)
# Regra = QUANDO (condicoes) + ENTAO (acoes com formula). Guardadas em
# model/regras.json (dados, nao codigo - migram junto pro PHP/PostgreSQL).
# Usado pelos importadores de podas (grid executada e pendente) e pela tela
# Configuracao > Regras de importacao (simulacao). Compativel com PowerShell 5.1.
# =============================================================================

function Remove-Acentos {
    param([string]$Texto)
    if ([string]::IsNullOrEmpty($Texto)) { return '' }
    $n = $Texto.Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($c in $n.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($c) }
    }
    return $sb.ToString()
}

function Get-RegrasCampos {
    <# Catalogo de campos que as regras enxergam. tipo: num | texto. leitura = so leitura (nao pode ser alterado). #>
    return @(
        @{ chave = 'esquema';            rotulo = 'Esquema';             tipo = 'texto'; leitura = $true  }
        @{ chave = 'tipoServico';        rotulo = 'Tipo de serviço';     tipo = 'texto'; leitura = $false }
        @{ chave = 'previstoPoda';       rotulo = 'Previsto poda';       tipo = 'num';   leitura = $false }
        @{ chave = 'previstoLimpeza';    rotulo = 'Previsto limpeza';    tipo = 'num';   leitura = $false }
        @{ chave = 'previstoEstrutura';  rotulo = 'Previsto estrutura';  tipo = 'num';   leitura = $false }
        @{ chave = 'realizadoPoda';      rotulo = 'Realizado poda';      tipo = 'num';   leitura = $false }
        @{ chave = 'realizadoLimpeza';   rotulo = 'Realizado limpeza';   tipo = 'num';   leitura = $false }
        @{ chave = 'realizadoEstrutura'; rotulo = 'Realizado estrutura'; tipo = 'num';   leitura = $false }
        @{ chave = 'previstoTotal';      rotulo = 'Previsto total';      tipo = 'num';   leitura = $true  }
        @{ chave = 'realizadoTotal';     rotulo = 'Realizado total';     tipo = 'num';   leitura = $true  }
        @{ chave = 'vaoKm';              rotulo = 'Vão (km)';            tipo = 'num';   leitura = $true  }
        @{ chave = 'soPrevisto';         rotulo = 'Só previsto (sem MO executada)'; tipo = 'num'; leitura = $true }
    )
}

function Get-RegrasFuncoes {
    return @(
        @{ nome = 'SE';         ajuda = 'SE(condição; valor se verdadeiro; valor se falso)' }
        @{ nome = 'SOMA';       ajuda = 'SOMA(a; b; ...)' }
        @{ nome = 'ARREDONDAR'; ajuda = 'ARREDONDAR(valor; casas)' }
        @{ nome = 'MAXIMO';     ajuda = 'MAXIMO(a; b; ...)' }
        @{ nome = 'MINIMO';     ajuda = 'MINIMO(a; b; ...)' }
        @{ nome = 'ABS';        ajuda = 'ABS(valor)' }
    )
}

function Get-RegrasMapaCampos {
    # rotulo normalizado (sem acento, minusculo) e chave -> chave
    $m = @{}
    foreach ($c in (Get-RegrasCampos)) {
        $m[(Remove-Acentos $c.rotulo).ToLowerInvariant()] = $c.chave
        $m[$c.chave.ToLowerInvariant()] = $c.chave
    }
    return $m
}

# ---------------------------------------------------------------- formulas
function ConvertTo-RegraTokens {
    param([string]$Texto)
    $t = New-Object System.Collections.ArrayList
    $i = 0; $n = $Texto.Length
    while ($i -lt $n) {
        $c = $Texto[$i]
        if ([char]::IsWhiteSpace($c)) { $i++; continue }
        if ($c -eq '[') {
            $j = $Texto.IndexOf(']', $i + 1)
            if ($j -lt 0) { throw "Falta fechar o colchete ']' do campo." }
            [void]$t.Add(@{ k = 'fld'; v = $Texto.Substring($i + 1, $j - $i - 1).Trim() }); $i = $j + 1; continue
        }
        if ($c -eq '"') {
            $j = $Texto.IndexOf('"', $i + 1)
            if ($j -lt 0) { throw 'Falta fechar as aspas do texto.' }
            [void]$t.Add(@{ k = 'str'; v = $Texto.Substring($i + 1, $j - $i - 1) }); $i = $j + 1; continue
        }
        if ([char]::IsDigit($c) -or ($c -eq ',' -and $i + 1 -lt $n -and [char]::IsDigit($Texto[$i + 1])) -or ($c -eq '.' -and $i + 1 -lt $n -and [char]::IsDigit($Texto[$i + 1]))) {
            $j = $i
            while ($j -lt $n -and ([char]::IsDigit($Texto[$j]) -or $Texto[$j] -eq ',' -or $Texto[$j] -eq '.')) { $j++ }
            $s = $Texto.Substring($i, $j - $i).Replace(',', '.')
            $v = 0.0
            if (-not [double]::TryParse($s, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$v)) { throw "Número inválido: $s" }
            [void]$t.Add(@{ k = 'num'; v = $v }); $i = $j; continue
        }
        if ([char]::IsLetter($c)) {
            $j = $i
            while ($j -lt $n -and ([char]::IsLetterOrDigit($Texto[$j]) -or $Texto[$j] -eq '_')) { $j++ }
            [void]$t.Add(@{ k = 'id'; v = (Remove-Acentos $Texto.Substring($i, $j - $i)).ToUpperInvariant() }); $i = $j; continue
        }
        $dois = if ($i + 1 -lt $n) { $Texto.Substring($i, 2) } else { '' }
        if ($dois -eq '>=' -or $dois -eq '<=' -or $dois -eq '<>') { [void]$t.Add(@{ k = 'op'; v = $dois }); $i += 2; continue }
        if ('+-*/()=<>;'.Contains([string]$c)) { [void]$t.Add(@{ k = 'op'; v = [string]$c }); $i++; continue }
        throw "Caractere não reconhecido: '$c'"
    }
    return ,$t
}

function Get-RegraAst {
    <# Texto da formula -> arvore (cacheada). Lanca excecao com mensagem em portugues se invalida. #>
    param([string]$Formula)
    if (-not $Script:RegraAstCache) { $Script:RegraAstCache = @{} }
    if ($Script:RegraAstCache.ContainsKey($Formula)) { return $Script:RegraAstCache[$Formula] }
    if ([string]::IsNullOrWhiteSpace($Formula)) { throw 'Fórmula vazia.' }
    $tok = ConvertTo-RegraTokens -Texto $Formula
    $mapa = Get-RegrasMapaCampos
    $st = @{ p = 0 }
    $peek = { if ($st.p -lt $tok.Count) { $tok[$st.p] } else { $null } }
    $ehOp = { param($o) $x = & $peek; return ($null -ne $x -and $x.k -eq 'op' -and $x.v -eq $o) }
    $parseExpr = $null
    $parsePrim = {
        $x = & $peek
        if ($null -eq $x) { throw 'A fórmula terminou antes da hora.' }
        $st.p++
        if ($x.k -eq 'num') { return @{ t = 'num'; v = $x.v } }
        if ($x.k -eq 'str') { return @{ t = 'str'; v = $x.v } }
        if ($x.k -eq 'fld') {
            $chave = $mapa[(Remove-Acentos $x.v).ToLowerInvariant()]
            if (-not $chave) { throw "Campo desconhecido: [$($x.v)]" }
            return @{ t = 'fld'; k = $chave }
        }
        if ($x.k -eq 'id') {
            if (-not (& $ehOp '(')) { throw "Depois de $($x.v) falta '('." }
            $st.p++
            $lista = New-Object System.Collections.ArrayList
            if (-not (& $ehOp ')')) {
                [void]$lista.Add((& $parseExpr))
                while (& $ehOp ';') { $st.p++; [void]$lista.Add((& $parseExpr)) }
            }
            if (-not (& $ehOp ')')) { throw "Falta fechar o parêntese de $($x.v)." }
            $st.p++
            $nome = $x.v; if ($nome -eq 'MÁXIMO') { $nome = 'MAXIMO' }
            if ($nome -notin @('SE', 'SOMA', 'ARREDONDAR', 'MAXIMO', 'MINIMO', 'ABS')) { throw "Função desconhecida: $($x.v)" }
            $q = $lista.Count
            if ($nome -eq 'SE' -and $q -ne 3) { throw 'SE precisa de 3 partes: SE(condição; se verdadeiro; se falso).' }
            if ($nome -eq 'ARREDONDAR' -and $q -ne 2) { throw 'ARREDONDAR precisa de 2 partes: ARREDONDAR(valor; casas).' }
            if ($nome -eq 'ABS' -and $q -ne 1) { throw 'ABS precisa de 1 valor.' }
            if (($nome -in @('SOMA', 'MAXIMO', 'MINIMO')) -and $q -lt 1) { throw "$nome precisa de ao menos 1 valor." }
            return @{ t = 'fn'; n = $nome; a = $lista.ToArray() }
        }
        if ($x.k -eq 'op' -and $x.v -eq '(') {
            $e = & $parseExpr
            if (-not (& $ehOp ')')) { throw "Falta fechar o parêntese." }
            $st.p++
            return $e
        }
        throw "Não esperava '$($x.v)' aqui."
    }
    $parseUn = {
        if (& $ehOp '-') { $st.p++; return @{ t = 'neg'; e = (& $parseUn) } }
        return (& $parsePrim)
    }
    $parseMul = {
        $l = & $parseUn
        while ((& $ehOp '*') -or (& $ehOp '/')) { $o = (& $peek).v; $st.p++; $r = & $parseUn; $l = @{ t = 'bin'; o = $o; l = $l; r = $r } }
        return $l
    }
    $parseAdd = {
        $l = & $parseMul
        while ((& $ehOp '+') -or (& $ehOp '-')) { $o = (& $peek).v; $st.p++; $r = & $parseMul; $l = @{ t = 'bin'; o = $o; l = $l; r = $r } }
        return $l
    }
    $parseExpr = {
        $l = & $parseAdd
        $x = & $peek
        if ($null -ne $x -and $x.k -eq 'op' -and $x.v -in @('>', '<', '>=', '<=', '=', '<>')) {
            $st.p++; $r = & $parseAdd; $l = @{ t = 'bin'; o = $x.v; l = $l; r = $r }
        }
        return $l
    }
    $ast = & $parseExpr
    if ($st.p -lt $tok.Count) { throw "Sobrou algo no fim da fórmula: '$($tok[$st.p].v)'" }
    $Script:RegraAstCache[$Formula] = $ast
    return $ast
}

function Get-RegraAstCampos {
    param($Ast)
    $r = New-Object System.Collections.ArrayList
    $visita = $null
    $visita = {
        param($n)
        if ($null -eq $n) { return }
        if ($n.t -eq 'fld') { [void]$r.Add($n.k) }
        elseif ($n.t -eq 'neg') { & $visita $n.e }
        elseif ($n.t -eq 'bin') { & $visita $n.l; & $visita $n.r }
        elseif ($n.t -eq 'fn') { foreach ($a in $n.a) { & $visita $a } }
    }
    & $visita $Ast
    return @($r | Select-Object -Unique)
}

function Invoke-RegraAst {
    param($No, $Ctx)
    switch ($No.t) {
        'num' { return [double]$No.v }
        'str' { return [string]$No.v }
        'fld' {
            $v = $Ctx[$No.k]
            if ($null -eq $v) { throw "O campo '$($No.k)' não tem valor neste registro." }
            return $v
        }
        'neg' { return -1.0 * [double](Invoke-RegraAst $No.e $Ctx) }
        'bin' {
            $a = Invoke-RegraAst $No.l $Ctx; $b = Invoke-RegraAst $No.r $Ctx
            $o = $No.o
            if ($o -in @('=', '<>')) {
                if ($a -is [string] -or $b -is [string]) { $igual = ((Remove-Acentos ([string]$a)).ToUpperInvariant() -eq (Remove-Acentos ([string]$b)).ToUpperInvariant()) }
                else { $igual = ([math]::Abs([double]$a - [double]$b) -lt 1e-9) }
                if ($o -eq '=') { return $(if ($igual) { 1.0 } else { 0.0 }) } else { return $(if ($igual) { 0.0 } else { 1.0 }) }
            }
            $x = [double]$a; $y = [double]$b
            switch ($o) {
                '+' { return $x + $y }
                '-' { return $x - $y }
                '*' { return $x * $y }
                '/' { if ($y -eq 0) { throw 'Divisão por zero.' }; return $x / $y }
                '>' { return $(if ($x -gt $y) { 1.0 } else { 0.0 }) }
                '<' { return $(if ($x -lt $y) { 1.0 } else { 0.0 }) }
                '>=' { return $(if ($x -ge $y) { 1.0 } else { 0.0 }) }
                '<=' { return $(if ($x -le $y) { 1.0 } else { 0.0 }) }
            }
        }
        'fn' {
            $n = $No.n
            if ($n -eq 'SE') {
                $c = Invoke-RegraAst $No.a[0] $Ctx
                if ([double]$c -ne 0) { return (Invoke-RegraAst $No.a[1] $Ctx) } else { return (Invoke-RegraAst $No.a[2] $Ctx) }
            }
            $vals = @(); foreach ($a in $No.a) { $vals += [double](Invoke-RegraAst $a $Ctx) }
            switch ($n) {
                'SOMA' { $s = 0.0; foreach ($v in $vals) { $s += $v }; return $s }
                'MAXIMO' { return [double](($vals | Measure-Object -Maximum).Maximum) }
                'MINIMO' { return [double](($vals | Measure-Object -Minimum).Minimum) }
                'ABS' { return [math]::Abs($vals[0]) }
                'ARREDONDAR' { return [math]::Round($vals[0], [int]$vals[1], [System.MidpointRounding]::AwayFromZero) }
            }
        }
    }
    throw 'Expressão inválida.'
}

function Test-RegraFormula {
    param([string]$Formula)
    try { $ast = Get-RegraAst -Formula $Formula; return @{ ok = $true; campos = @(Get-RegraAstCampos $ast) } }
    catch { return @{ ok = $false; erro = $_.Exception.Message } }
}

# ---------------------------------------------------------------- condicoes / aplicacao
$Script:RegrasOperadores = @('contem', 'naoContem', 'igual', 'diferente', 'maior', 'menor', 'maiorIgual', 'menorIgual', 'vazio', 'naoVazio')

function Test-RegraCondicao {
    param($Cond, $Ctx)
    $v = $Ctx[[string]$Cond.campo]
    $op = [string]$Cond.op
    if ($op -eq 'vazio') { return ($null -eq $v -or [string]$v -eq '') }
    if ($op -eq 'naoVazio') { return ($null -ne $v -and [string]$v -ne '') }
    if ($null -eq $v) { return $false }
    $ref = $Cond.valor
    $campo = $null; foreach ($c in (Get-RegrasCampos)) { if ($c.chave -eq $Cond.campo) { $campo = $c } }
    if ($campo -and $campo.tipo -eq 'texto') {
        $a = (Remove-Acentos ([string]$v)).ToUpperInvariant().Trim(); $b = (Remove-Acentos ([string]$ref)).ToUpperInvariant().Trim()
        switch ($op) {
            'contem' { return $a.Contains($b) }
            'naoContem' { return (-not $a.Contains($b)) }
            'igual' { return ($a -eq $b) }
            'diferente' { return ($a -ne $b) }
        }
        return $false
    }
    $x = 0.0; $y = 0.0
    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    if (-not [double]::TryParse(([string]$v).Replace(',', '.'), [System.Globalization.NumberStyles]::Float, $inv, [ref]$x)) { return $false }
    if (-not [double]::TryParse(([string]$ref).Replace(',', '.'), [System.Globalization.NumberStyles]::Float, $inv, [ref]$y)) { return $false }
    switch ($op) {
        'igual' { return ([math]::Abs($x - $y) -lt 1e-9) }
        'diferente' { return ([math]::Abs($x - $y) -ge 1e-9) }
        'maior' { return ($x -gt $y) }
        'menor' { return ($x -lt $y) }
        'maiorIgual' { return ($x -ge $y) }
        'menorIgual' { return ($x -le $y) }
    }
    return $false
}

function Update-RegraCtxTotais {
    param($Ctx)
    $Ctx['previstoTotal'] = [double]$Ctx['previstoPoda'] + [double]$Ctx['previstoLimpeza'] + [double]$Ctx['previstoEstrutura']
    $Ctx['realizadoTotal'] = [double]$Ctx['realizadoPoda'] + [double]$Ctx['realizadoLimpeza'] + [double]$Ctx['realizadoEstrutura']
}

function Invoke-RegrasNoCtx {
    <# Aplica as regras (ja filtradas/ordenadas) em $Ctx (hashtable). As formulas de uma regra veem os
       valores de ANTES dessa regra (foto), entao a ordem das acoes dentro da regra nao importa.
       Devolve @{ aplicadas = @(nomes); ignoradas = @(@{nome; motivo}) }. #>
    param($Regras, $Ctx)
    $aplicadas = @(); $ignoradas = @()
    $campos = Get-RegrasCampos
    foreach ($r in $Regras) {
        Update-RegraCtxTotais $Ctx
        $ok = $true
        foreach ($c in @($r.condicoes)) { if (-not (Test-RegraCondicao -Cond $c -Ctx $Ctx)) { $ok = $false; break } }
        if (-not $ok) { continue }
        $foto = @{}; foreach ($k in @($Ctx.Keys)) { $foto[$k] = $Ctx[$k] }
        $novos = @{}
        try {
            foreach ($a in @($r.acoes)) {
                $cp = $null; foreach ($c in $campos) { if ($c.chave -eq $a.campo) { $cp = $c } }
                if (-not $cp -or $cp.leitura) { throw "O campo '$($a.campo)' não pode ser alterado." }
                if ($cp.tipo -eq 'texto') { $novos[$a.campo] = [string]$a.valor }
                else { $novos[$a.campo] = [double](Invoke-RegraAst -No (Get-RegraAst -Formula ([string]$a.valor)) -Ctx $foto) }
            }
        } catch {
            $ignoradas += @{ nome = [string]$r.nome; motivo = $_.Exception.Message }
            continue
        }
        foreach ($k in $novos.Keys) { $Ctx[$k] = $novos[$k] }
        $aplicadas += [string]$r.nome
    }
    Update-RegraCtxTotais $Ctx
    return @{ aplicadas = $aplicadas; ignoradas = $ignoradas }
}

# ---------------------------------------------------------------- armazenamento
function Get-RegrasPadrao {
    $ag = (Get-Date).ToString('s')
    $cond = @(
        @{ campo = 'esquema'; op = 'contem'; valor = 'PODA LINEAR' }
    )
    return @(
        [ordered]@{
            id = 'poda-linear-executada'; nome = 'Poda linear — grid executada'
            descricao = 'Zera os recursos da MO e a limpeza de faixa vem do vão do poste (km × 15.000 m²). Só vale para OS que tem MO executada.'
            ativa = $true; ordem = 1; aplicaEm = @('executada')
            condicoes = @(@{ campo = 'esquema'; op = 'contem'; valor = 'PODA LINEAR' }, @{ campo = 'soPrevisto'; op = 'igual'; valor = '0' })
            acoes = @(
                @{ campo = 'realizadoPoda'; valor = '0' }, @{ campo = 'realizadoEstrutura'; valor = '0' }
                @{ campo = 'previstoPoda'; valor = '0' }, @{ campo = 'previstoLimpeza'; valor = '0' }, @{ campo = 'previstoEstrutura'; valor = '0' }
                @{ campo = 'realizadoLimpeza'; valor = '[Vão (km)] * 15000' }
                @{ campo = 'tipoServico'; valor = 'Limpeza de Faixa' }
            )
            atualizadoPor = 'sistema'; atualizadoEm = $ag
        }
        [ordered]@{
            id = 'poda-linear-pendente'; nome = 'Poda linear — grid pendente'
            descricao = 'Previsto = vão × 15.000 m². Se a OS já tinha execução, o realizado é igual ao previsto.'
            ativa = $true; ordem = 2; aplicaEm = @('pendente')
            condicoes = $cond
            acoes = @(
                @{ campo = 'previstoPoda'; valor = '0' }, @{ campo = 'previstoEstrutura'; valor = '0' }, @{ campo = 'realizadoPoda'; valor = '0' }, @{ campo = 'realizadoEstrutura'; valor = '0' }
                @{ campo = 'previstoLimpeza'; valor = '[Vão (km)] * 15000' }
                @{ campo = 'realizadoLimpeza'; valor = 'SE([Realizado total] > 0; [Vão (km)] * 15000; 0)' }
                @{ campo = 'tipoServico'; valor = 'Limpeza de Faixa' }
            )
            atualizadoPor = 'sistema'; atualizadoEm = $ag
        }
    )
}

function Get-RegrasTodas {
    <# Le model/regras.json; se nao existir, grava as regras padrao (as que antes eram fixas no codigo). #>
    $p = Get-EntityPath -Entity 'regras'
    if (-not (Test-Path -LiteralPath $p)) { Write-JsonModel -Entity 'regras' -Data @(Get-RegrasPadrao) }
    return @(Read-JsonModel -Entity 'regras' | Sort-Object { [int]$_.ordem })
}

function Get-RegrasAtivas {
    param([ValidateSet('executada', 'pendente')][string]$Base)
    $r = @()
    foreach ($x in (Get-RegrasTodas)) {
        if ($x.ativa -and (@($x.aplicaEm) -contains $Base)) { $r += $x }
    }
    return $r
}

function Test-RegraValida {
    <# Valida uma regra vinda da tela. Devolve lista de mensagens de erro (vazia = ok). #>
    param($R)
    $erros = @()
    if ([string]::IsNullOrWhiteSpace([string]$R.nome)) { $erros += 'Dê um nome à regra.' }
    $ap = @($R.aplicaEm | Where-Object { $_ -in @('executada', 'pendente') })
    if ($ap.Count -eq 0) { $erros += 'Escolha onde a regra se aplica (grid executada e/ou pendente).' }
    $campos = Get-RegrasCampos
    foreach ($c in @($R.condicoes)) {
        $cp = $campos | Where-Object { $_.chave -eq $c.campo } | Select-Object -First 1
        if (-not $cp) { $erros += "Condição com campo desconhecido: $($c.campo)"; continue }
        if ($c.op -notin $Script:RegrasOperadores) { $erros += "Condição com operador desconhecido: $($c.op)" }
        if ($c.op -notin @('vazio', 'naoVazio') -and [string]::IsNullOrWhiteSpace([string]$c.valor)) { $erros += "Condição em '$($cp.rotulo)' sem valor." }
    }
    $acoes = @($R.acoes)
    if ($acoes.Count -eq 0) { $erros += 'Adicione ao menos uma ação (ENTÃO).' }
    foreach ($a in $acoes) {
        $cp = $campos | Where-Object { $_.chave -eq $a.campo } | Select-Object -First 1
        if (-not $cp) { $erros += "Ação com campo desconhecido: $($a.campo)"; continue }
        if ($cp.leitura) { $erros += "O campo '$($cp.rotulo)' só pode ser lido, não alterado."; continue }
        if ($cp.tipo -eq 'num') {
            $t = Test-RegraFormula -Formula ([string]$a.valor)
            if (-not $t.ok) { $erros += "Fórmula de '$($cp.rotulo)': $($t.erro)" }
        } elseif ([string]::IsNullOrWhiteSpace([string]$a.valor)) { $erros += "Ação em '$($cp.rotulo)' sem valor." }
    }
    return $erros
}

function Add-RegraHistorico {
    param([string]$RegraId, [string]$Nome, [string]$Acao, $Antes, $Depois, [string]$Usuario)
    $h = @(Read-JsonModel -Entity 'regras_historico')
    $h += [ordered]@{ em = (Get-Date).ToString('s'); usuario = $Usuario; regraId = $RegraId; nome = $Nome; acao = $Acao; antes = $Antes; depois = $Depois }
    if ($h.Count -gt 500) { $h = $h[($h.Count - 500)..($h.Count - 1)] }
    Write-JsonModel -Entity 'regras_historico' -Data $h
}

# ---------------------------------------------------------------- uso pelos importadores
function Invoke-RegrasImportacao {
    <# Aplica as regras ativas da $Base numa OS. Devolve @{ qReal; qPrev; mo; aplicadas }.
       $TabelaVao = poste -> km (ou $null se ainda nao importou o Vao: regras que usam [Vão (km)] sao ignoradas). #>
    param($Regras, $Linha, $QReal, $QPrev, $Mo, $TabelaVao, [string]$PosteId, [bool]$SoPrevisto, $Resumo)
    $vao = $null
    if ($TabelaVao) { $vao = 0.0; if (-not [string]::IsNullOrWhiteSpace($PosteId) -and $TabelaVao.ContainsKey($PosteId.Trim())) { $vao = [double]$TabelaVao[$PosteId.Trim()] } }
    $ctx = @{
        esquema = [string]$Linha['DescEsquema']; tipoServico = [string]$Mo.tipoServico
        previstoPoda = [double]$QPrev.poda; previstoLimpeza = [double]$QPrev.limpeza; previstoEstrutura = [double]$QPrev.estrutura
        realizadoPoda = [double]$QReal.poda; realizadoLimpeza = [double]$QReal.limpeza; realizadoEstrutura = [double]$QReal.estrutura
        vaoKm = $vao; soPrevisto = $(if ($SoPrevisto) { 1.0 } else { 0.0 })
    }
    $res = Invoke-RegrasNoCtx -Regras $Regras -Ctx $ctx
    if ($res.aplicadas.Count -gt 0) {
        if (-not $Resumo.Contains('regrasAplicadas')) { $Resumo['regrasAplicadas'] = @{} }
        foreach ($nome in $res.aplicadas) { $Resumo['regrasAplicadas'][$nome] = [int]$Resumo['regrasAplicadas'][$nome] + 1 }
        $Resumo['podaLinear'] = [int]$Resumo['podaLinear'] + $(if ($res.aplicadas -match 'Poda linear') { 1 } else { 0 })
    }
    if ($res.ignoradas.Count -gt 0) {
        if (-not $Resumo.Contains('regrasIgnoradas')) { $Resumo['regrasIgnoradas'] = @{} }
        foreach ($ig in $res.ignoradas) { $Resumo['regrasIgnoradas'][$ig.nome] = $ig.motivo }
    }
    if ($res.aplicadas.Count -eq 0) { return @{ qReal = $QReal; qPrev = $QPrev; mo = $Mo; aplicadas = @() } }
    $det = $Mo.detalhe
    return @{
        qReal = @{ poda = [double]$ctx.realizadoPoda; limpeza = [double]$ctx.realizadoLimpeza; estrutura = [double]$ctx.realizadoEstrutura }
        qPrev = @{ poda = [double]$ctx.previstoPoda; limpeza = [double]$ctx.previstoLimpeza; estrutura = [double]$ctx.previstoEstrutura }
        mo = @{ tipoServico = $ctx.tipoServico; detalhe = $det }
        aplicadas = $res.aplicadas
    }
}
