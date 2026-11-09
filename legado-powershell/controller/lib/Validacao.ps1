# =============================================================================
# Validacao.ps1 — validação de importação de planilhas Excel
#
# Cada base tem um schema (nome da coluna, tipo esperado, obrigatoriedade).
# A tela de Importação exibe esse schema antes do upload (modelo pra
# download) e, após o envio, mostra erro linha a linha (Escopo, seção 7.2).
# Aqui os schemas ficam centralizados e a função Test-ImportRows valida uma
# lista de linhas (já lida do Excel/CSV pelo chamador) contra o schema.
# =============================================================================

# Converte texto pra [double] sem NUNCA lançar exceção — "-22,158369" (vírgula,
# formato brasileiro) ou "-22.158369" (ponto), aceitando os dois. Usada no lugar
# de [double]::Parse() direto porque Parse() lança uma exceção .NET pra
# QUALQUER formato inesperado (inclusive coisas que a regex de validação não
# pegou, ex.: um espaço "invisível" colado no número vindo do Excel) — e isso,
# ao estourar DENTRO do loop de gravação da VERA (141 mil+ linhas), já foi
# visto derrubando a importação inteira com uma mensagem de erro genérica do
# .NET, sem dizer qual linha nem qual campo. TryParse nunca lança — só devolve
# $false, e quem chama decide o que fazer (vira 1 erro de gravação daquela
# árvore específica, sem derrubar as outras 140 mil).
function ConvertTo-DoubleSeguro {
    param([string]$Texto)
    if ([string]::IsNullOrWhiteSpace($Texto)) { return $null }
    $limpo = $Texto.Trim().Replace(",", ".")
    $valor = 0.0
    $estiloNumero = [System.Globalization.NumberStyles]::Float -bor [System.Globalization.NumberStyles]::AllowThousands
    if ([double]::TryParse($limpo, $estiloNumero, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$valor)) {
        return $valor
    }
    return $null
}

$Script:ImportSchemas = @{
    Metas = @(
        @{ coluna = "CodigoEquipe"; tipo = "texto";  obrigatorio = $true }
        @{ coluna = "AnoMes";       tipo = "anomes";  obrigatorio = $true }
        @{ coluna = "MetaMensal";   tipo = "numero";  obrigatorio = $true }
        @{ coluna = "Servico";      tipo = "texto";   obrigatorio = $false }
    )
    Equipes = @(
        @{ coluna = "CodigoEquipe";     tipo = "texto";   obrigatorio = $true }
        @{ coluna = "TipoEquipe";       tipo = "texto";   obrigatorio = $true }
        @{ coluna = "Polo";             tipo = "texto";   obrigatorio = $true }
        @{ coluna = "Regional";         tipo = "texto";   obrigatorio = $true }
        @{ coluna = "Departamento";     tipo = "texto";   obrigatorio = $true }
        @{ coluna = "ProprioTerceiro";  tipo = "texto";   obrigatorio = $true }
        @{ coluna = "EquipePoda";       tipo = "booleano"; obrigatorio = $true }
        @{ coluna = "BaseLat";          tipo = "numero";  obrigatorio = $false }
        @{ coluna = "BaseLng";          tipo = "numero";  obrigatorio = $false }
    )
    # v2.13.0 - cabecalhos iguais aos arquivos reais (d.Vao.xlsx / d.Protecao.xlsx)
    Vao = @(
        @{ coluna = "Poste 1";    tipo = "texto";  obrigatorio = $true }
        @{ coluna = "Proteção";   tipo = "texto";  obrigatorio = $true }
        @{ coluna = "Regional";   tipo = "texto";  obrigatorio = $false }
        @{ coluna = "Polo";       tipo = "texto";  obrigatorio = $false }
        @{ coluna = "Rota (km)";  tipo = "numero"; obrigatorio = $false }
    )
    Protecao = @(
        @{ coluna = "ELEMENTO";          tipo = "texto";  obrigatorio = $true }
        @{ coluna = "PROT. ELEMENTO";    tipo = "texto";  obrigatorio = $false }
        @{ coluna = "PROT. ELEMENTO 2";  tipo = "texto";  obrigatorio = $false }
        @{ coluna = "ALIMENTADOR";       tipo = "texto";  obrigatorio = $false }
        @{ coluna = "ZONA";              tipo = "texto";  obrigatorio = $false }
        @{ coluna = "LAT";               tipo = "numero"; obrigatorio = $false }
        @{ coluna = "LONG";              tipo = "numero"; obrigatorio = $false }
        @{ coluna = "TRECHO";            tipo = "texto";  obrigatorio = $false }
        @{ coluna = "TRECHO COM T4";     tipo = "texto";  obrigatorio = $false }
        @{ coluna = "PLANO EASY WORK";   tipo = "texto";  obrigatorio = $false }
    )
    VERA = @(
        @{ coluna = "ID árvore";     tipo = "numero"; obrigatorio = $true }
        @{ coluna = "Alimentadores"; tipo = "texto";  obrigatorio = $true }
        @{ coluna = "Lat";           aliases = @("Latitude");  tipo = "numero"; obrigatorio = $true }
        @{ coluna = "Lng";           aliases = @("Longitude"); tipo = "numero"; obrigatorio = $true }
        @{ coluna = "Espécie";       tipo = "texto";  obrigatorio = $false }
        @{ coluna = "Cidade";        tipo = "texto";  obrigatorio = $false }
    )
    Prefeituras = @(
        @{ coluna = "Municipio";    tipo = "texto"; obrigatorio = $true }
        @{ coluna = "ContatoNome";  tipo = "texto"; obrigatorio = $true }
        @{ coluna = "Email";        tipo = "email"; obrigatorio = $true }
        @{ coluna = "Telefone";     tipo = "texto"; obrigatorio = $false }
    )
    # Cabeçalho igual ao arquivo real que o Mario mandou (D_LOCALIDADE.xlsx,
    # aba "D_LOCALIDADE"). "COD LOCALIDADE" é a chave única (cada linha é uma
    # localidade). POLO é o campo que já bate com o "municipio" usado em
    # Vão/Proteção/Prefeituras (confirmado comparando os dois arquivos) — é
    # por POLO que o cruzamento com essas bases e com o Mapa de Manutenção
    # acontece, não por LOCALIDADE (mais fino, não tem equivalente hoje).
    PrioridadeEW = @(
        @{ coluna = "Prioridade";    tipo = "texto"; obrigatorio = $true }
        @{ coluna = "Grupo Recurso"; tipo = "texto"; obrigatorio = $true }
        @{ coluna = "Prioridade EW"; tipo = "texto"; obrigatorio = $true }
        @{ coluna = "Chave";         tipo = "texto"; obrigatorio = $false }
        @{ coluna = "Tensão";        tipo = "texto"; obrigatorio = $false }
        @{ coluna = "Regional";      tipo = "texto"; obrigatorio = $false }
    )
    # v2.15.20 - base "Esquemas": esquemas do SGM que NAO podem ser ignorados.
    # Cabecalho igual ao da planilha do Mario (CODIGO / DESCRICAO ESQUEMA / TIPO).
    # TIPO = Poda, Limpeza ou Estrutura (pode ficar vazio: esquema sem tipo nao gera previsto).
    Esquemas = @(
        @{ coluna = "CODIGO";            aliases = @("Código", "CÓDIGO", "Codigo"); tipo = "texto"; obrigatorio = $true }
        @{ coluna = "DESCRICAO ESQUEMA"; aliases = @("DESCRIÇÃO ESQUEMA", "Descrição Esquema", "Descricao Esquema", "DescEsquema"); tipo = "texto"; obrigatorio = $true }
        @{ coluna = "TIPO";              aliases = @("Tipo"); tipo = "texto"; obrigatorio = $false }
    )
    # v3.2.1 - base "Conjuntos": de-para Alimentador -> Conjunto (planilha da empresa, ~600 linhas:
    # Conjunto | Alimentador | Nome Conjunto | Regional | Sigla | Tensao | Tensao). Obrigatorios so
    # Alimentador (chave do cruzamento) e Nome Conjunto (resultado); as demais colunas sao lidas
    # pelo PosProcessar com tolerancia de cabecalho (acento/caixa/espaco) e guardadas.
    Conjuntos = @(
        @{ coluna = "Alimentador";   aliases = @("ALIMENTADOR", "alimentador"); tipo = "texto"; obrigatorio = $true }
        @{ coluna = "Nome Conjunto"; aliases = @("NOME CONJUNTO", "NomeConjunto", "Nome do Conjunto", "Conjunto Nome", "Nome_Conjunto"); tipo = "texto"; obrigatorio = $true }
    )
    Localidades = @(
        @{ coluna = "COD LOCALIDADE";              tipo = "texto"; obrigatorio = $true }
        @{ coluna = "POLO";                        tipo = "texto"; obrigatorio = $true }
        @{ coluna = "LOCALIDADE";                  tipo = "texto"; obrigatorio = $true }
        @{ coluna = "POSTO OPERACIONAL";           tipo = "texto"; obrigatorio = $false }
        @{ coluna = "POLO2";                       tipo = "texto"; obrigatorio = $false }
        @{ coluna = "REGIONAL";                    tipo = "texto"; obrigatorio = $false }
        @{ coluna = "COORDENADOR RESPONSÁVEL";     tipo = "texto"; obrigatorio = $false }
        @{ coluna = "SUPERVISOR RESPONSÁVEL";      tipo = "texto"; obrigatorio = $false }
        @{ coluna = "PONTO FOCAL RESPONSÁVEL";     tipo = "texto"; obrigatorio = $false }
        @{ coluna = "COD LOCALIDADE2";             tipo = "texto"; obrigatorio = $false }
    )
}

function Test-CampoValor {
    param([string]$Tipo, $Valor)
    if ($null -eq $Valor -or ($Valor -is [string] -and [string]::IsNullOrWhiteSpace($Valor))) { return $false }
    switch ($Tipo) {
        # Aceita tanto "-22.158369" (ponto) quanto "-22,158369" (vírgula,
        # formato brasileiro — é assim que a exportação real do VERA grava
        # Lat/Lng). Antes só o ponto passava, e com vírgula TODA linha de
        # Lat/Lng da VERA caía como erro de tipo, mesmo com o cabeçalho já
        # corrigido.
        "numero"   { return $Valor -match '^-?\d+([.,]\d+)?$' }
        "anomes"   { return $Valor -match '^\d{4}-\d{2}$' }
        "booleano" { return $Valor -match '^(true|false|sim|nao|não|1|0)$' }
        "email"    { return $Valor -match '^[^@\s]+@[^@\s]+\.[^@\s]+$' }
        default    { return $true } # texto
    }
}

function Test-ImportRows {
    <# Recebe $Base (nome do schema) e $Rows (array de hashtables coluna->valor,
       já extraído do Excel/CSV pelo chamador). Devolve @{ validas=[]; erros=[] }
       onde cada erro tem numeroLinha, coluna e motivo — exatamente o formato
       que a tela de Importação exibe (Escopo, seção 7.2).

       -ProgressCallback (opcional): chamado periodicamente (a cada 5000
       linhas) com @{fase;linha;total}. Existe por causa da VERA
       (Invoke-VeraStreamingUpload) — com 141 mil+ linhas reais, validar
       tudo aqui dentro sem mandar NENHUM byte de volta pro navegador por
       um tempo longo o bastante estourava o timeout "de trava" do upload
       em streaming (ver stallMs em apiUploadFormDataStream, api.js): o
       Controller não tinha travado, só estava ocupado demais pra avisar
       que seguia vivo. As outras bases (pequenas) nunca precisaram disso
       — por isso o parâmetro é opcional e não muda nada pra elas. #>
    param(
        [Parameter(Mandatory)][string]$Base,
        [Parameter(Mandatory)][array]$Rows,
        [scriptblock]$ProgressCallback
    )
    $schema = $Script:ImportSchemas[$Base]
    if (-not $schema) { throw "Schema de importação não definido para a base '$Base'." }

    # $validas/$erros como List[object] em vez de array comum: com "+=" num
    # array, cada linha reconstrói o array inteiro do zero (custo O(n) por
    # linha, O(n²) no total) - exatamente o mesmo problema já visto e
    # corrigido em ConvertTo-IsoDatesDeep (JsonStore.ps1) pra Podas (~21 mil
    # OS, >20s só nisso). Essa função nunca tinha recebido o mesmo ajuste, e
    # ficou invisível enquanto as bases usadas aqui (Metas, Equipes, Vão,
    # Proteção, Prefeituras) eram pequenas - mas a VERA (árvores) pode
    # chegar a mais de 140 mil linhas num envio só, onde o "+=" sozinho
    # passa de minutos e estoura qualquer timeout do navegador antes de
    # terminar. List[object].Add é O(1) amortizado, então o total volta a
    # ser O(n).
    $validas = New-Object System.Collections.Generic.List[object]
    $erros = New-Object System.Collections.Generic.List[object]
    $total = $Rows.Count
    $linha = 1
    foreach ($row in $Rows) {
        $linha++
        if ($ProgressCallback -and ($linha % 5000 -eq 0)) {
            try { & $ProgressCallback @{ fase = 'validando'; linha = ($linha - 1); total = $total } } catch { }
        }
        $linhaOk = $true
        foreach ($col in $schema) {
            # $row chega como PSCustomObject quando vem do corpo JSON da
            # requisição (o caso normal). O indexador "$row['Coluna']" NÃO
            # funciona em PSCustomObject (sempre devolve vazio) - só em
            # Hashtable. Get-CampoDoRow trata os dois casos.
            $valor = Get-CampoDoRow -Row $row -Campo $col.coluna
            # Se a coluna principal veio vazia e esse campo tem "aliases"
            # (nomes alternativos de cabeçalho — ver comentário na VERA
            # acima), tenta cada um antes de considerar o campo ausente.
            if (($null -eq $valor -or ($valor -is [string] -and [string]::IsNullOrWhiteSpace($valor))) -and $col.aliases) {
                foreach ($aliasNome in $col.aliases) {
                    $valorAlias = Get-CampoDoRow -Row $row -Campo $aliasNome
                    if (-not ($null -eq $valorAlias -or ($valorAlias -is [string] -and [string]::IsNullOrWhiteSpace($valorAlias)))) {
                        $valor = $valorAlias
                        break
                    }
                }
            }
            if ($col.obrigatorio -and -not (Test-CampoValor -Tipo $col.tipo -Valor $valor)) {
                $erros.Add(@{ numeroLinha = $linha; coluna = $col.coluna; motivo = "$($col.coluna) ausente ou fora do formato esperado ($($col.tipo))" })
                $linhaOk = $false
            }
        }
        if ($linhaOk) { $validas.Add($row) }
    }
    return @{ validas = $validas.ToArray(); erros = $erros.ToArray(); schema = $schema }
}

function ConvertTo-TipoMeta {
    <# v2.15.54 - tipo de servico da meta: "faixa" (limpeza de faixa, meta em km lineares)
       ou "poda" (padrao, unidades). Vazio/desconhecido = poda (metas antigas). #>
    param($Valor)
    $x = "$Valor".ToLower()
    if ($x -match "faixa|limpeza") { return "faixa" }
    return "poda"
}

function Get-CampoDoRow {
    <# Acesso uniforme a um campo de $Row, que pode ser um PSCustomObject
       (linhas vindas de JSON, o caso comum) ou uma Hashtable. #>
    param($Row, [Parameter(Mandatory)][string]$Campo)
    if ($Row -is [System.Collections.IDictionary]) {
        return $Row[$Campo]
    }
    if ($Row.PSObject.Properties.Match($Campo).Count -gt 0) {
        return $Row.$Campo
    }
    return $null
}

function Get-CampoDoRowComAlias {
    <# Igual a Get-CampoDoRow, mas tenta uma lista de nomes de coluna em
       ordem e devolve o primeiro que vier preenchido — usado onde o
       cabeçalho real pode variar entre exportações (ex.: VERA ora manda
       "Lat"/"Lng", ora "Latitude"/"Longitude"). #>
    param($Row, [Parameter(Mandatory)][string[]]$Campos)
    foreach ($nome in $Campos) {
        $valor = Get-CampoDoRow -Row $Row -Campo $nome
        if (-not ($null -eq $valor -or ($valor -is [string] -and [string]::IsNullOrWhiteSpace($valor)))) {
            return $valor
        }
    }
    return $null
}

function ConvertTo-ChaveCabecalho {
    <# v3.2.1 - "Nome Conjunto" / "NOME_CONJUNTO" / "Tensão" -> "nomeconjunto" / "tensao" (sem acento, caixa, espaco ou simbolo). #>
    param([string]$Texto)
    if ($null -eq $Texto) { return '' }
    $d = $Texto.Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -eq [System.Globalization.UnicodeCategory]::NonSpacingMark) { continue }
        if ([char]::IsLetterOrDigit($ch)) { [void]$sb.Append([char]::ToLowerInvariant($ch)) }
    }
    return $sb.ToString()
}

function Get-CampoPorCabecalho {
    <# v3.2.1 - le uma coluna da linha tolerando acento/caixa/espaco no cabecalho. -Nomes = chaves ja
       normalizadas (ConvertTo-ChaveCabecalho) aceitas, em ordem. -ListaPrefixo = devolve a LISTA de valores
       de todas as colunas cujo nome normalizado COMECA com o prefixo, na ordem da planilha (ex.: as duas
       colunas de tensao: "Tens..." e "Tensao"). #>
    param($Row, [string[]]$Nomes = @(), [string]$ListaPrefixo = '')
    $pares = @()
    if ($Row -is [System.Collections.IDictionary]) { foreach ($k in $Row.Keys) { $pares += ,@("$k", $Row[$k]) } }
    else { foreach ($p in $Row.PSObject.Properties) { $pares += ,@($p.Name, $p.Value) } }
    $vazio = { param($v) ($null -eq $v -or ($v -is [string] -and [string]::IsNullOrWhiteSpace($v))) }
    foreach ($n in $Nomes) {
        foreach ($par in $pares) {
            if ((ConvertTo-ChaveCabecalho $par[0]) -eq $n -and -not (& $vazio $par[1])) { return $par[1] }
        }
    }
    if ($ListaPrefixo) {
        # todas as colunas cujo nome comeca com o prefixo, na ordem da planilha (ex.: as duas "Tensao")
        $lista = New-Object System.Collections.Generic.List[object]
        foreach ($par in $pares) {
            if ((ConvertTo-ChaveCabecalho $par[0]).StartsWith($ListaPrefixo)) { $lista.Add($par[1]) }
        }
        return $lista.ToArray()
    }
    return $null
}

function Get-ImportSchema {
    param([Parameter(Mandatory)][string]$Base)
    return $Script:ImportSchemas[$Base]
}
