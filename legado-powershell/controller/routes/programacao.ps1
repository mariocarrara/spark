# =============================================================================
# routes/programacao.ps1 — Módulo 3: Programação de Proteções (Escopo, seção 5)
# =============================================================================

$Script:ProtecaoBuscaCache = $null
$Script:ProtecaoBuscaDigital = $null

function Get-ProtecaoParaBusca {
    <# v2.13.0 - a base de Protecao real tem ~109 mil elementos: nao da pra
       mandar tudo pro navegador. Le o model/protecao.json UMA vez (e de novo
       so se o arquivo mudar - tamanho+data) e guarda em memoria uma lista
       enxuta pra busca. #>
    $path = Get-EntityPath -Entity "protecao"
    if (-not (Test-Path $path)) { return @() }
    $info = Get-Item $path
    $digital = "$($info.Length)|$($info.LastWriteTimeUtc.Ticks)"
    if ($Script:ProtecaoBuscaCache -and $Script:ProtecaoBuscaDigital -eq $digital) { return $Script:ProtecaoBuscaCache }
    $lista = New-Object System.Collections.Generic.List[object]
    foreach ($p in @(Read-JsonModel -Entity "protecao")) {
        $lista.Add(@{
            id = "$($p.protecaoId)"; p2 = "$($p.protecao2)"; alim = "$($p.alimentador)"
            trecho = "$($p.trecho)"; lat = $p.lat; lng = $p.lng
            idl = "$($p.protecaoId)".ToLower(); p2l = "$($p.protecao2)".ToLower(); alml = "$($p.alimentador)".ToLower()
        })
    }
    $Script:ProtecaoBuscaCache = $lista
    $Script:ProtecaoBuscaDigital = $digital
    return $lista
}

# -----------------------------------------------------------------------------
# v3.4.0 - LOG DE EDICAO das programacoes (model/programacao_log.jsonl) + mover OS entre programacoes.
# O log e so ACRESCENTADO (1 linha por alteracao, depois que a programacao ja foi gravada) e qualquer
# erro ao gravar o log e engolido: o log NUNCA trava nem desfaz o salvamento da programacao.
# Cada linha: t (data/hora), u (usuarioId), p (programacao), a (acao), r (resumo), ref (outra programacao),
# m (mudancas de campo: c/de/para), add / rem (OS incluidas / retiradas).
# -----------------------------------------------------------------------------
$Script:ProgLogCampos = @('protecaoId','alimentador','dataInicio','dataFim','equipesIds','numeroSIS','plano','equipeNecessaria','desligamento','observacao','localidade','polo','regional','previstoConcluir','status')

function Get-EquipesInativasDe {
    <# v3.5.2 - ids (dentre $Ids, ignorando as que ja estavam em $Ja) de equipes marcadas como INATIVAS (Gestao de Bases > Equipes > Ativa? = Nao).
       Equipe inativa nao pode receber programacao nova. Equipe que nao existe no cadastro nao e barrada aqui. #>
    param($Ids, $Ja = @())
    $saida = New-Object System.Collections.Generic.List[string]
    $eqs = @(Read-JsonModel -Entity "equipes")
    foreach ($id in @($Ids)) {
        $t = "$id".Trim()
        if (-not $t) { continue }
        if (@($Ja) -contains $t) { continue }
        $e = $eqs | Where-Object { "$($_.id)" -eq $t } | Select-Object -First 1
        if ($e -and $e.PSObject.Properties["ativo"] -and ($e.ativo -eq $false -or "$($e.ativo)" -match '^(false|0|n[aã]o|nao)$')) { $saida.Add($t) }
    }
    return ,$saida.ToArray()
}

function Get-ProgLogPath {
    return (Join-Path (Split-Path (Get-EntityPath -Entity "programacao") -Parent) "programacao_log.jsonl")
}

function Get-ProgValorTexto {
    param($Obj, [string]$Nome)
    $v = $null
    if ($Obj -is [System.Collections.IDictionary]) { if ($Obj.Contains($Nome)) { $v = $Obj[$Nome] } }
    elseif ($null -ne $Obj) { $pp = $Obj.PSObject.Properties[$Nome]; if ($pp) { $v = $pp.Value } }
    if ($null -eq $v) { return "" }
    if ($v -is [System.Array]) { return (@($v | ForEach-Object { "$_" }) -join ", ") }
    $t = "$v"
    if ($t.Length -gt 300) { $t = $t.Substring(0, 300) }
    return $t
}

function Get-ProgSnapshotCampos {
    param($Obj)
    $h = @{}
    foreach ($c in $Script:ProgLogCampos) { $h[$c] = Get-ProgValorTexto -Obj $Obj -Nome $c }
    return $h
}

function Get-ProgOsIds {
    param($Obj)
    $lista = New-Object System.Collections.Generic.List[string]
    $pp = $null
    if ($Obj -is [System.Collections.IDictionary]) { if ($Obj.Contains('osIds')) { $pp = $Obj['osIds'] } }
    elseif ($null -ne $Obj -and $Obj.PSObject.Properties['osIds']) { $pp = $Obj.PSObject.Properties['osIds'].Value }
    foreach ($i in @($pp)) { $t = "$i".Trim(); if ($t) { $lista.Add($t) } }
    return $lista.ToArray()
}

function Get-ProgMudancas {
    param($Antes, $Obj)
    $m = New-Object System.Collections.Generic.List[object]
    foreach ($c in $Script:ProgLogCampos) {
        $b = Get-ProgValorTexto -Obj $Obj -Nome $c
        if ("$($Antes[$c])" -ne $b) { $m.Add(@{ c = $c; de = "$($Antes[$c])"; para = $b }) }
    }
    return $m.ToArray()
}

function Write-ProgLog {
    param([string]$ProgId, [string]$UsuarioId, [string]$Acao, $Mudancas = @(), $OsAdd = @(), $OsRem = @(), [string]$Resumo = "", [string]$RefId = "")
    try {
        $path = Get-ProgLogPath
        $fi = New-Object System.IO.FileInfo($path)
        if ($fi.Exists -and $fi.Length -gt 20MB) {
            Move-Item -LiteralPath $path -Destination ($path -replace '\.jsonl$', ("_" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".jsonl")) -Force
        }
        $reg = [ordered]@{ t = (Get-IsoNow); u = $UsuarioId; p = $ProgId; a = $Acao; r = $Resumo; ref = $RefId; m = @($Mudancas); add = @($OsAdd); rem = @($OsRem) }
        $linha = (ConvertTo-Json -InputObject $reg -Compress -Depth 6) + "`n"
        $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($linha)
        $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
        try { $fs.Write($bytes, 0, $bytes.Length) } finally { $fs.Dispose() }
    } catch { }
}

function Move-OsEntreProgramacoes {
    <# Tira da(s) programacao(oes) antiga(s) as OS que o usuario escolheu MOVER para a programacao $NovoId.
       Pedidos = lista de { osId, de }. So move OS que realmente estao na programacao nova e na antiga.
       Altera os objetos de $Programacoes (o chamador grava depois). Devolve [{ de, osIds, ficouVazia }]. #>
    param($Programacoes, [string]$NovoId, $Pedidos, $OsDaNova)
    $res = New-Object System.Collections.Generic.List[object]
    $naNova = @(@($OsDaNova) | ForEach-Object { "$_".Trim() })
    $porDe = @{}
    foreach ($pd in @($Pedidos)) {
        if ($null -eq $pd) { continue }
        $os = "$($pd.osId)".Trim(); $de = "$($pd.de)".Trim()
        if (-not $os -or -not $de -or $de -eq $NovoId) { continue }
        if ($naNova -notcontains $os) { continue }
        if (-not $porDe.ContainsKey($de)) { $porDe[$de] = New-Object System.Collections.Generic.List[string] }
        if (-not $porDe[$de].Contains($os)) { $porDe[$de].Add($os) }
    }
    foreach ($de in @($porDe.Keys)) {
        $antiga = @($Programacoes) | Where-Object { $_.id -eq $de } | Select-Object -First 1
        if (-not $antiga) { continue }
        $atuais = @(Get-ProgOsIds -Obj $antiga)
        $tirar = @($porDe[$de].ToArray() | Where-Object { $atuais -contains $_ })
        if ($tirar.Count -eq 0) { continue }
        $restantes = @($atuais | Where-Object { $tirar -notcontains $_ })
        Set-PropValor $antiga "osIds" $restantes
        $snapAtual = $null; $execAtual = $null
        if ($antiga.PSObject.Properties["osSnap"]) { $snapAtual = $antiga.osSnap }
        if ($antiga.PSObject.Properties["execSnap"]) { $execAtual = $antiga.execSnap }
        $snapNovo = Get-OsSnapMesclado -OsIds $restantes -SnapAtual $snapAtual -ExecAtual $execAtual -Enviados $null
        Set-PropValor $antiga "osSnap" $snapNovo.osSnap
        Set-PropValor $antiga "execSnap" $snapNovo.execSnap
        Set-PropValor $antiga "atualizadoEm" (Get-IsoNow)
        $res.Add(@{ de = $de; osIds = $tirar; ficouVazia = ($restantes.Count -eq 0) })
    }
    return $res.ToArray()
}

function Write-ProgLogMovidas {
    param($Movidas, [string]$NovoId, [string]$UsuarioId)
    foreach ($mv in @($Movidas)) {
        Write-ProgLog -ProgId $mv.de -UsuarioId $UsuarioId -Acao "mover-saida" -OsRem $mv.osIds -RefId $NovoId -Resumo "OS movida(s) para outra programação"
        Write-ProgLog -ProgId $NovoId -UsuarioId $UsuarioId -Acao "mover-entrada" -OsAdd $mv.osIds -RefId $mv.de -Resumo "OS movida(s) de outra programação"
    }
}

function Invoke-ProgramacaoRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # GET /api/programacao/buscar-protecao?q=texto&limite=30 - busca por
    # elemento, "PROT. ELEMENTO 2" (a que liga ao Vao) ou alimentador. Quem
    # comeca com o texto vem primeiro.
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "buscar-protecao") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "programacao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Programação." } }
        }
        $q = "$($Query['q'])".Trim().ToLower()
        $limite = 30
        if ($Query["limite"]) { $limite = [Math]::Max(1, [Math]::Min(100, [int]$Query["limite"])) }
        if ($q.Length -lt 2) { return @{ status = 200; body = @{ total = 0; resultados = @() } } }
        $base = Get-ProtecaoParaBusca
        $comeca = New-Object System.Collections.Generic.List[object]
        $contem = New-Object System.Collections.Generic.List[object]
        foreach ($x in $base) {
            if ($x.idl.StartsWith($q) -or $x.p2l.StartsWith($q) -or $x.alml.StartsWith($q)) { $comeca.Add($x) }
            elseif ($comeca.Count -lt $limite -and ($x.idl.Contains($q) -or $x.p2l.Contains($q) -or $x.alml.Contains($q))) { $contem.Add($x) }
            if ($comeca.Count -ge $limite) { break }
        }
        $saida = New-Object System.Collections.Generic.List[object]
        foreach ($x in $comeca) { if ($saida.Count -lt $limite) { $saida.Add($x) } }
        foreach ($x in $contem) { if ($saida.Count -lt $limite) { $saida.Add($x) } }
        $resultados = @($saida | ForEach-Object { @{ protecaoId = $_.id; protecao2 = $_.p2; alimentador = $_.alim; trecho = $_.trecho; lat = $_.lat; lng = $_.lng } })
        return @{ status = 200; body = @{ total = $resultados.Count; resultados = $resultados } }
    }

    # GET /api/programacao/protecao-proxima?alimentador=X&lat=..&lng=.. (v2.13.29)
    # Proteção do alimentador mais perto do ponto (centro das OS selecionadas) -
    # preenche a Proteção do popup "Nova programação" sem o programador digitar.
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "protecao-proxima") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "programacao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Programação." } }
        }
        $alim = "$($Query['alimentador'])".Trim().ToLower()
        if (-not $alim) { return @{ status = 200; body = @{ encontrada = $false; total = 0 } } }
        $inv = [System.Globalization.CultureInfo]::InvariantCulture
        $lat0 = 0.0; $lng0 = 0.0
        $temPonto = ([double]::TryParse("$($Query['lat'])", [System.Globalization.NumberStyles]::Float, $inv, [ref]$lat0) -and
                     [double]::TryParse("$($Query['lng'])", [System.Globalization.NumberStyles]::Float, $inv, [ref]$lng0))
        $melhor = $null; $melhorD = [double]::MaxValue; $total = 0; $primeiro = $null
        foreach ($x in (Get-ProtecaoParaBusca)) {
            if ($x.alml -ne $alim) { continue }
            $total++
            if ($null -eq $primeiro) { $primeiro = $x }
            if (-not $temPonto -or $null -eq $x.lat -or $null -eq $x.lng) { continue }
            $la = 0.0; $lo = 0.0
            if (-not ([double]::TryParse("$($x.lat)", [System.Globalization.NumberStyles]::Float, $inv, [ref]$la) -and
                      [double]::TryParse("$($x.lng)", [System.Globalization.NumberStyles]::Float, $inv, [ref]$lo))) { continue }
            $dLat = ($la - $lat0) * 111320.0
            $dLng = ($lo - $lng0) * 111320.0 * [Math]::Cos($lat0 * [Math]::PI / 180.0)
            $d = [Math]::Sqrt($dLat * $dLat + $dLng * $dLng)
            if ($d -lt $melhorD) { $melhorD = $d; $melhor = $x }
        }
        if ($melhor) {
            return @{ status = 200; body = @{ encontrada = $true; total = $total; distanciaM = [Math]::Round($melhorD); protecaoId = $melhor.id; protecao2 = $melhor.p2; alimentador = $melhor.alim; trecho = $melhor.trecho } }
        }
        if ($total -eq 1 -and $primeiro) {
            return @{ status = 200; body = @{ encontrada = $true; total = 1; distanciaM = $null; protecaoId = $primeiro.id; protecao2 = $primeiro.p2; alimentador = $primeiro.alim; trecho = $primeiro.trecho } }
        }
        return @{ status = 200; body = @{ encontrada = $false; total = $total } }
    }

    # GET /api/programacao/logistica — antes do GET genérico, mais específico
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "logistica") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "programacao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Programação." } }
        }
        $hoje = (Get-Date).ToString("yyyy-MM-dd")
        $dia = if ($Query["data"]) { $Query["data"] } else { $hoje }
        $programacoes = @(Read-JsonModel -Entity "programacao") | Where-Object {
            $_.status -ne "Cancelada" -and $_.dataInicio.Substring(0,10) -le $dia -and $_.dataFim.Substring(0,10) -ge $dia
        }
        return @{ status = 200; body = @{
            data = $dia
            programacoes = @($programacoes)
            equipes = @(Read-JsonModel -Entity "equipes")
        } }
    }

    # GET /api/programacao/{id}/log  (v3.4.0) - historico de alteracoes da programacao (mais recente primeiro)
    if ($Method -eq "GET" -and $Segments.Count -eq 2 -and $Segments[1] -eq "log") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "programacao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Programação." } }
        }
        $idLog = "$($Segments[0])"
        $eventos = New-Object System.Collections.Generic.List[object]
        $path = Get-ProgLogPath
        if (Test-Path -LiteralPath $path) {
            $nomes = @{}
            try { foreach ($u in @(Read-JsonModel -Entity "usuarios")) { $nomes["$($u.id)"] = "$($u.nome)" } } catch { }
            $needle = '"p":"' + $idLog + '"'
            $fs = $null; $sr = $null
            try {
                $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
                $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
                while ($null -ne ($linha = $sr.ReadLine())) {
                    if ($linha.Contains($needle)) {
                        try {
                            $ev = $linha | ConvertFrom-Json
                            $nm = $nomes["$($ev.u)"]
                            $ev | Add-Member -NotePropertyName "usuario" -NotePropertyValue $(if ($nm) { $nm } else { "$($ev.u)" }) -Force
                            $eventos.Add($ev)
                        } catch { }
                    }
                }
            } finally { if ($sr) { $sr.Dispose() } elseif ($fs) { $fs.Dispose() } }
        }
        $arr = $eventos.ToArray()
        [array]::Reverse($arr)
        if ($arr.Count -gt 300) { $arr = $arr[0..299] }
        return @{ status = 200; body = @{ eventos = @($arr) } }
    }

    # POST /api/programacao/zerar  { confirmar: "APAGAR" }  (v2.15.29) - so administrador.
    # Zera SO as programacoes (model/programacao.json), com copia de seguranca ao lado
    # (programacao_backup_AAAAMMDD-HHMMSS.json). Nao mexe em equipes, Vao, Protecao, OS etc.
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "zerar") {
        if (-not (Test-Administrador -UsuarioId $Usuario.usuarioId)) {
            return @{ status = 403; body = @{ erro = "Só administradores podem zerar as programações." } }
        }
        if ("$($Body.confirmar)".Trim().ToUpper() -ne "APAGAR") {
            return @{ status = 400; body = @{ erro = "Falta a confirmação (confirmar = APAGAR)." } }
        }
        $antes = @(Read-JsonModel -Entity "programacao")
        $backup = $null
        try {
            $orig = Get-EntityPath -Entity "programacao"
            if ($antes.Count -gt 0 -and (Test-Path $orig)) {
                $backup = Join-Path (Split-Path $orig -Parent) ("programacao_backup_" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".json")
                Copy-Item -LiteralPath $orig -Destination $backup -Force
            }
        } catch { $backup = $null }
        Write-JsonModel -Entity "programacao" -Data @()
        try {
            $log = @(Read-JsonModel -Entity "importacoes_log") + @{
                id = New-EntityId; base = "Programação (zerada)"; usuarioId = $Usuario.usuarioId; dataHora = Get-IsoNow
                registrosProcessados = $antes.Count; registrosComErro = 0; arquivoOrigem = $(if ($backup) { Split-Path $backup -Leaf } else { "" })
            }
            Write-JsonModel -Entity "importacoes_log" -Data $log
        } catch { }
        return @{ status = 200; body = @{ ok = $true; apagadas = $antes.Count; backup = $(if ($backup) { Split-Path $backup -Leaf } else { $null }) } }
    }

    # GET /api/programacao?status=&equipe=&alimentador=&polo=&dataInicio=&dataFim=
    if ($Method -eq "GET" -and $Segments.Count -eq 0) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "programacao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Programação." } }
        }
        $programacoes = @(Read-JsonModel -Entity "programacao")
        if ($Query["status"])      { $programacoes = $programacoes | Where-Object { $_.status -eq $Query["status"] } }
        if ($Query["alimentador"]) { $programacoes = $programacoes | Where-Object { $_.alimentador -eq $Query["alimentador"] } }
        if ($Query["equipe"])      { $programacoes = $programacoes | Where-Object { $_.equipesIds -contains $Query["equipe"] } }
        if ($Query["dataInicio"])  { $programacoes = $programacoes | Where-Object { $_.dataInicio -ge $Query["dataInicio"] } }
        if ($Query["dataFim"])     { $programacoes = $programacoes | Where-Object { $_.dataFim -le $Query["dataFim"] } }
        return @{ status = 200; body = @($programacoes) }
    }

    # POST /api/programacao — valida conflitos (Detalhamento 2.6): aviso, não bloqueio
    if ($Method -eq "POST" -and $Segments.Count -eq 0) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "programacao" -Acao "criar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para criar Programação." } }
        }
        # v2.14.1 - Cidade/localidade e obrigatoria: a Logistica compara por ela
        if (-not "$($Body.localidade)".Trim()) {
            return @{ status = 400; body = @{ erro = "Informe a Cidade / localidade da programação (obrigatória para a Logística)." } }
        }
        # v3.5.2 - equipe inativa nao recebe programacao
        $inativasPost = Get-EquipesInativasDe -Ids $Body.equipesIds
        if ($inativasPost.Count -gt 0) {
            return @{ status = 400; body = @{ erro = "Equipe inativa não pode receber programação: $($inativasPost -join ', ')." } }
        }
        $programacoes = @(Read-JsonModel -Entity "programacao")
        # v2.15.15 - o navegador gera o id (GUID) e pode reenviar o mesmo POST se a
        # resposta se perder (timeout/rede): se esse id ja existe, devolve a
        # programacao que ja esta gravada em vez de criar uma duplicada.
        $idCliente = "$($Body.id)".Trim().ToLower()
        if ($idCliente -match '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') {
            $jaGravada = $programacoes | Where-Object { $_.id -eq $idCliente } | Select-Object -First 1
            if ($jaGravada) { return @{ status = 200; body = @{ programacao = $jaGravada; avisosConflito = @() } } }
        } else { $idCliente = "" }
        $novo = @{
            id = $(if ($idCliente) { $idCliente } else { New-EntityId })
            protecaoId = $Body.protecaoId
            alimentador = $Body.alimentador
            dataInicio = $Body.dataInicio
            dataFim = $Body.dataFim
            equipesIds = @($Body.equipesIds)
            numeroSIS = $Body.numeroSIS
            tipoPlano = $Body.tipoPlano
            plano = $(if ($Body.plano) { $Body.plano } else { $Body.tipoPlano })
            tipoProgramacao = $Body.tipoProgramacao
            equipeNecessaria = $Body.equipeNecessaria
            desligamento = $Body.desligamento
            previstoConcluir = [bool]$Body.previstoConcluir
            status = "Programada"
            programadorId = $Usuario.usuarioId
            observacao = $Body.observacao
            osIds = @($Body.osIds)
            osSnap = @()
            execSnap = @()
            localidade = $Body.localidade
            polo = $Body.polo
            regional = $Body.regional
            origemTela = $(if (@('Mapa','Proteções') -contains "$($Body.origemTela)") { "$($Body.origemTela)" } else { '' })
            criadoEm = Get-IsoNow
            atualizadoEm = Get-IsoNow
        }
        # v3.0.7 - guarda dentro da programacao uma copia das OS (previsto, tipo, cidade, posicao...)
        $enviadosSnap = $null
        if ($Body.PSObject.Properties.Name -contains "osSnap") { $enviadosSnap = $Body.osSnap }
        $snapNovo = Get-OsSnapMesclado -OsIds $novo.osIds -SnapAtual @() -ExecAtual @() -Enviados $enviadosSnap
        $novo.osSnap = $snapNovo.osSnap
        $novo.execSnap = $snapNovo.execSnap
        # v3.4.0 - OS que o usuario escolheu MOVER de outra programacao (exige permissao de editar)
        $movidas = @()
        if ($null -ne $Body.moverOs -and @($Body.moverOs).Count -gt 0) {
            if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "programacao" -Acao "editar")) {
                return @{ status = 403; body = @{ erro = "Sem permissão para tirar OS de outra Programação (editar)." } }
            }
            $movidas = @(Move-OsEntreProgramacoes -Programacoes $programacoes -NovoId $novo.id -Pedidos $Body.moverOs -OsDaNova $novo.osIds)
        }
        $conflitos = Get-ConflitosProgramacao -Nova $novo -Existentes $programacoes
        $programacoes += $novo
        Write-JsonModel -Entity "programacao" -Data $programacoes
        # log (depois de gravar; nunca atrapalha o salvamento)
        $idsMov = @($movidas | ForEach-Object { $_.osIds } | ForEach-Object { $_ })
        $osCriar = @(Get-ProgOsIds -Obj $novo | Where-Object { $idsMov -notcontains $_ })
        $mudCriar = @(); foreach ($c in @('protecaoId','alimentador','dataInicio','dataFim','equipesIds','plano','numeroSIS')) { $mudCriar += @{ c = $c; de = ""; para = (Get-ProgValorTexto -Obj $novo -Nome $c) } }
        Write-ProgLog -ProgId $novo.id -UsuarioId $Usuario.usuarioId -Acao "criar" -Mudancas $mudCriar -OsAdd $osCriar -Resumo "Programação criada"
        Write-ProgLogMovidas -Movidas $movidas -NovoId $novo.id -UsuarioId $Usuario.usuarioId
        return @{ status = 201; body = @{ programacao = $novo; avisosConflito = $conflitos; movidas = @($movidas) } }
    }

    # PUT /api/programacao/{id}
    if ($Method -eq "PUT" -and $Segments.Count -eq 1) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "programacao" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para editar Programação." } }
        }
        if ($Body.PSObject.Properties.Name -contains "localidade" -and -not "$($Body.localidade)".Trim()) {
            return @{ status = 400; body = @{ erro = "A Cidade / localidade não pode ficar em branco (obrigatória para a Logística)." } }
        }
        $id = $Segments[0]
        $programacoes = @(Read-JsonModel -Entity "programacao")
        $idx = 0..($programacoes.Count - 1) | Where-Object { $programacoes[$_].id -eq $id } | Select-Object -First 1
        if ($null -eq $idx) { return @{ status = 404; body = @{ erro = "Programação não encontrada." } } }

        # v3.5.2 - equipe inativa nao pode ser ADICIONADA (as que ja estavam na programacao continuam)
        if ($Body.PSObject.Properties.Name -contains "equipesIds") {
            $inativasPut = Get-EquipesInativasDe -Ids $Body.equipesIds -Ja @($programacoes[$idx].equipesIds)
            if ($inativasPut.Count -gt 0) {
                return @{ status = 400; body = @{ erro = "Equipe inativa não pode receber programação: $($inativasPut -join ', ')." } }
            }
        }

        # v3.4.0 - foto dos campos antes de alterar (para o log de edicao)
        $antesLog = Get-ProgSnapshotCampos -Obj $programacoes[$idx]
        $osAntesLog = @(Get-ProgOsIds -Obj $programacoes[$idx])
        foreach ($prop in $Body.PSObject.Properties) {
            # v3.0.7 - as copias das OS sao do Controller: o navegador nunca as sobrescreve
            if ($prop.Name -eq "osSnap" -or $prop.Name -eq "execSnap" -or $prop.Name -eq "moverOs") { continue }
            $programacoes[$idx] | Add-Member -NotePropertyName $prop.Name -NotePropertyValue $prop.Value -Force
        }
        $snapAtual = $null; $execAtual = $null; $enviadosSnap = $null
        if ($programacoes[$idx].PSObject.Properties["osSnap"]) { $snapAtual = $programacoes[$idx].osSnap }
        if ($programacoes[$idx].PSObject.Properties["execSnap"]) { $execAtual = $programacoes[$idx].execSnap }
        if ($Body.PSObject.Properties.Name -contains "osSnap") { $enviadosSnap = $Body.osSnap }
        $snapNovo = Get-OsSnapMesclado -OsIds $programacoes[$idx].osIds -SnapAtual $snapAtual -ExecAtual $execAtual -Enviados $enviadosSnap
        Set-PropValor $programacoes[$idx] "osSnap" $snapNovo.osSnap
        Set-PropValor $programacoes[$idx] "execSnap" $snapNovo.execSnap
        Set-PropValor $programacoes[$idx] "atualizadoEm" (Get-IsoNow)

        # v3.4.0 - OS que o usuario escolheu MOVER de outra programacao (exige permissao de editar, ja checada acima)
        $movidas = @()
        if ($null -ne $Body.moverOs -and @($Body.moverOs).Count -gt 0) {
            $movidas = @(Move-OsEntreProgramacoes -Programacoes $programacoes -NovoId $id -Pedidos $Body.moverOs -OsDaNova $programacoes[$idx].osIds)
        }

        $outras = $programacoes | Where-Object { $_.id -ne $id }
        $conflitos = Get-ConflitosProgramacao -Nova $programacoes[$idx] -Existentes $outras

        Write-JsonModel -Entity "programacao" -Data $programacoes
        # log de edicao (depois de gravar; nunca atrapalha o salvamento)
        $mudLog = @(Get-ProgMudancas -Antes $antesLog -Obj $programacoes[$idx])
        $osDepoisLog = @(Get-ProgOsIds -Obj $programacoes[$idx])
        $idsMov = @($movidas | ForEach-Object { $_.osIds } | ForEach-Object { $_ })
        $osAddLog = @($osDepoisLog | Where-Object { $osAntesLog -notcontains $_ -and $idsMov -notcontains $_ })
        $osRemLog = @($osAntesLog | Where-Object { $osDepoisLog -notcontains $_ })
        if ($mudLog.Count -gt 0 -or $osAddLog.Count -gt 0 -or $osRemLog.Count -gt 0) {
            Write-ProgLog -ProgId $id -UsuarioId $Usuario.usuarioId -Acao "editar" -Mudancas $mudLog -OsAdd $osAddLog -OsRem $osRemLog -Resumo "Programação editada"
        }
        Write-ProgLogMovidas -Movidas $movidas -NovoId $id -UsuarioId $Usuario.usuarioId
        return @{ status = 200; body = @{ programacao = $programacoes[$idx]; avisosConflito = $conflitos; movidas = @($movidas) } }
    }

    # PATCH /api/programacao/{id}/status — cancelamento é soft delete (Escopo 5.5.2 / regra 9)
    if ($Method -eq "PATCH" -and $Segments.Count -eq 2 -and $Segments[1] -eq "status") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "programacao" -Acao "excluirStatus")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para alterar status de Programação." } }
        }
        $id = $Segments[0]
        $programacoes = @(Read-JsonModel -Entity "programacao")
        $idx = 0..($programacoes.Count - 1) | Where-Object { $programacoes[$_].id -eq $id } | Select-Object -First 1
        if ($null -eq $idx) { return @{ status = 404; body = @{ erro = "Programação não encontrada." } } }

        $statusAntesLog = Get-ProgValorTexto -Obj $programacoes[$idx] -Nome "status"
        $programacoes[$idx].status = $Body.status
        Set-PropValor $programacoes[$idx] "atualizadoEm" (Get-IsoNow)
        Write-JsonModel -Entity "programacao" -Data $programacoes
        if ($statusAntesLog -ne "$($Body.status)") {
            Write-ProgLog -ProgId $id -UsuarioId $Usuario.usuarioId -Acao "status" -Mudancas @(@{ c = "status"; de = $statusAntesLog; para = "$($Body.status)" }) -Resumo "Status alterado"
        }
        return @{ status = 200; body = $programacoes[$idx] }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/programacao." } }
}

function Get-ConflitosProgramacao {
    <# Duas checagens (Escopo 5.5.2): mesma equipe em mais de um atendimento
       no mesmo dia; desligamento sobreposto no mesmo alimentador no período.
       Retorna avisos - nunca bloqueia o salvamento (decisão documentada). #>
    param($Nova, [array]$Existentes)
    $avisos = @()
    $novaInicio = "$($Nova.dataInicio)".Substring(0, 10)
    $novaFim = "$($Nova.dataFim)".Substring(0, 10)
    foreach ($outra in $Existentes) {
        if ($outra.id -eq $Nova.id -or $outra.status -eq "Cancelada") { continue }
        $outraInicio = "$($outra.dataInicio)".Substring(0, 10)
        $outraFim = "$($outra.dataFim)".Substring(0, 10)
        $mesmoPeriodo = -not ($novaFim -lt $outraInicio -or $novaInicio -gt $outraFim)
        if (-not $mesmoPeriodo) { continue }

        $equipesEmComum = @($Nova.equipesIds | Where-Object { $outra.equipesIds -contains $_ })
        if ($equipesEmComum.Count -gt 0) {
            $avisos += "Equipe(s) $($equipesEmComum -join ', ') já alocada(s) em outro atendimento no período ($($outra.numeroSIS))."
        }
        if ($outra.alimentador -eq $Nova.alimentador -and $outra.desligamento -eq "DS" -and $Nova.desligamento -eq "DS") {
            $avisos += "Outro desligamento já programado no alimentador $($Nova.alimentador) no mesmo período ($($outra.numeroSIS))."
        }
    }
    # nota: "return ,$avisos" (com a vírgula) e não "return @($avisos)" -
    # PowerShell "desembrulha" arrays de 1 item quando saem de uma função
    # via return/pipeline; a vírgula unária evita esse achatamento e garante
    # que o chamador sempre receba um array, mesmo com 0 ou 1 aviso.
    return ,$avisos
}
