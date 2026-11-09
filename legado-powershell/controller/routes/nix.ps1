# =============================================================================
# routes/nix.ps1 - Pontos NIX (v3.10.0)
# NIX = ponto estimado (por calculo) onde a rede parou. A planilha traz o elemento/
# protecao, o PPF (possivel ponto de falha) e ate 2 coordenadas "lat,long". Serve de
# ALERTA no mapa (nao e prioridade). Cada nova planilha SUBSTITUI a anterior: nao
# guarda historico (so o log de quem enviou e quando).
#   GET    /api/nix     base atual {meta, itens}  (nix/visualizar)
#   POST   /api/nix     substitui a base          (nix/importar)
#   PUT    /api/nix     muda o raio (m) do alerta (nix/importar)
#   DELETE /api/nix     apaga a base atual        (nix/importar)
#   POST   /api/nix {incluir:{...}}  inclui 1 ponto manual (nix/criar) - v3.16.0; a planilha nova NAO apaga os manuais
#   DELETE /api/nix?id=<id>          apaga 1 ponto manual   (nix/excluirStatus)
# Arquivos: model/nix.json (itens), model/nix_meta.json (1 registro), model/nix_log.jsonl
# =============================================================================

function Write-NixLog {
    param([string]$UsuarioId, [string]$Acao, $Dados)
    try {
        $path = Join-Path (Split-Path (Get-EntityPath -Entity "nix") -Parent) "nix_log.jsonl"
        $reg = [ordered]@{ t = (Get-IsoNow); u = $UsuarioId; a = $Acao; d = $Dados }
        $linha = (ConvertTo-Json -InputObject $reg -Compress -Depth 5) + "`n"
        $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($linha)
        $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
        try { $fs.Write($bytes, 0, $bytes.Length) } finally { $fs.Dispose() }
    } catch { }
}

function Get-NixTexto {
    param($Obj, [string]$Campo, [int]$Max = 200)
    $v = $null
    if ($Obj -is [System.Collections.IDictionary]) { if ($Obj.Contains($Campo)) { $v = $Obj[$Campo] } }
    elseif ($null -ne $Obj -and $Obj.PSObject.Properties[$Campo]) { $v = $Obj.PSObject.Properties[$Campo].Value }
    $t = if ($null -eq $v) { "" } else { ("$v").Trim() }
    if ($t.Length -gt $Max) { $t = $t.Substring(0, $Max) }
    return $t
}

function ConvertTo-NixPonto {
    # "-21.9445973,-50.6890000" -> @{lat;lng}; qualquer outra coisa ("-", "BI", vazio) -> $null
    param([string]$Texto)
    if ($Texto -match '^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$') {
        $inv = [System.Globalization.CultureInfo]::InvariantCulture
        $la = 0.0; $lo = 0.0
        $ok1 = [double]::TryParse(($Matches[1] -replace ',', '.'), [System.Globalization.NumberStyles]::Float, $inv, [ref]$la)
        $ok2 = [double]::TryParse(($Matches[2] -replace ',', '.'), [System.Globalization.NumberStyles]::Float, $inv, [ref]$lo)
        if ($ok1 -and $ok2 -and [math]::Abs($la) -le 90 -and [math]::Abs($lo) -le 180 -and -not ($la -eq 0 -and $lo -eq 0)) {
            return [ordered]@{ lat = $la; lng = $lo }
        }
    }
    return $null
}

function Invoke-NixRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    if ($Segments.Count -ne 0) { return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/nix." } } }

    if ($Method -eq "GET") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "nix" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para ver os pontos Nix." } }
        }
        $meta = @(Read-JsonModel -Entity "nix_meta") | Select-Object -First 1
        $itens = @(Read-JsonModel -Entity "nix")
        return @{ status = 200; body = @{ meta = $meta; itens = $itens } }
    }

    if ($Method -eq "POST" -and $null -ne $Body.incluir) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "nix" -Acao "criar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para incluir ponto Nix." } }
        }
        $b = $Body.incluir
        $elem = Get-NixTexto -Obj $b -Campo "e" -Max 60
        if (-not $elem) { return @{ status = 400; body = @{ erro = "Informe o elemento (proteção/equipamento)." } } }
        $lat = Get-NixTexto -Obj $b -Campo "lat" -Max 30
        $lng = Get-NixTexto -Obj $b -Campo "lng" -Max 30
        $p1 = if ($lng) { ConvertTo-NixPonto -Texto "$lat,$lng" } else { ConvertTo-NixPonto -Texto $lat }
        if (-not $p1) { return @{ status = 400; body = @{ erro = "Coordenada inválida. Use latitude e longitude em graus decimais (ex.: -21.9445973 e -50.6890000)." } } }
        $itensAtuais = @(Read-JsonModel -Entity "nix")
        $novo = [ordered]@{
            id = (New-EntityId -Prefix "nx")
            manual = $true
            e = $elem
            ranque = ""
            trecho = (Get-NixTexto -Obj $b -Campo "trecho" -Max 20)
            alim = (Get-NixTexto -Obj $b -Campo "alim" -Max 60)
            reg = (Get-NixTexto -Obj $b -Campo "reg" -Max 40)
            conj = (Get-NixTexto -Obj $b -Campo "conj" -Max 80)
            tensao = ""
            dh = (Get-NixTexto -Obj $b -Campo "dh" -Max 40)
            ppf = (Get-NixTexto -Obj $b -Campo "ppf" -Max 600)
            pontos = @($p1)
            criadoEm = (Get-IsoNow)
            criadoPor = "$($Usuario.nome)"
        }
        $todos = @($itensAtuais) + @($novo)
        Write-JsonModel -Entity "nix" -Data @($todos)
        $metaAnt = @(Read-JsonModel -Entity "nix_meta") | Select-Object -First 1
        $meta = [ordered]@{}
        if ($metaAnt) { foreach ($p in $metaAnt.PSObject.Properties) { $meta[$p.Name] = $p.Value } }
        else { $meta["raioM"] = 500; $meta["enviadoEm"] = (Get-IsoNow); $meta["enviadoPorNome"] = "$($Usuario.nome)"; $meta["arquivo"] = "(inclusão manual)"; $meta["aba"] = ""; $meta["rejeitadas"] = 0 }
        $meta["linhas"] = $todos.Count
        $meta["pontos"] = (@($todos | ForEach-Object { @($_.pontos).Count } | Measure-Object -Sum).Sum)
        Write-JsonModel -Entity "nix_meta" -Data @(, $meta)
        Write-NixLog -UsuarioId $Usuario.usuarioId -Acao "incluir" -Dados ([ordered]@{ id = $novo.id; e = $elem; lat = $p1.lat; lng = $p1.lng })
        return @{ status = 200; body = @{ ok = $true; item = $novo } }
    }

    if ($Method -eq "POST") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "nix" -Acao "importar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para enviar a base de pontos Nix." } }
        }
        $brutos = @($Body.itens)
        if ($brutos.Count -eq 0) { return @{ status = 400; body = @{ erro = "A planilha veio vazia." } } }
        if ($brutos.Count -gt 20000) { return @{ status = 400; body = @{ erro = "Planilha grande demais (máximo 20.000 linhas)." } } }
        $itens = New-Object System.Collections.ArrayList
        $motivos = New-Object System.Collections.ArrayList
        $rejeitadas = 0; $semCoord = 0; $n = 0
        foreach ($b in $brutos) {
            $n++
            $elem = Get-NixTexto -Obj $b -Campo "e" -Max 60
            $p1 = ConvertTo-NixPonto -Texto (Get-NixTexto -Obj $b -Campo "ll1" -Max 60)
            $p2 = ConvertTo-NixPonto -Texto (Get-NixTexto -Obj $b -Campo "ll2" -Max 60)
            $motivo = $null
            if (-not $elem) { $motivo = "elemento em branco" }
            elseif (-not $p1 -and -not $p2) { $motivo = "sem coordenada válida ($elem)"; $semCoord++ }
            if ($motivo) {
                $rejeitadas++
                if ($motivos.Count -lt 20) { [void]$motivos.Add("linha ${n}: $motivo") }
                continue
            }
            $pontos = New-Object System.Collections.ArrayList
            if ($p1) { [void]$pontos.Add($p1) }
            if ($p2) { [void]$pontos.Add($p2) }
            [void]$itens.Add([ordered]@{
                e = $elem
                ranque = (Get-NixTexto -Obj $b -Campo "rk" -Max 12)
                trecho = (Get-NixTexto -Obj $b -Campo "trecho" -Max 20)
                alim = (Get-NixTexto -Obj $b -Campo "alim" -Max 60)
                reg = (Get-NixTexto -Obj $b -Campo "reg" -Max 40)
                conj = (Get-NixTexto -Obj $b -Campo "conj" -Max 80)
                tensao = (Get-NixTexto -Obj $b -Campo "tensao" -Max 12)
                dh = (Get-NixTexto -Obj $b -Campo "dh" -Max 40)
                ppf = (Get-NixTexto -Obj $b -Campo "ppf" -Max 600)
                pontos = @($pontos)
            })
        }
        if ($itens.Count -eq 0) {
            return @{ status = 400; body = @{ erro = "Nenhuma linha com coordenada válida na planilha. A base anterior foi mantida."; motivos = @($motivos); rejeitadas = $rejeitadas } }
        }
        $metaAnt = @(Read-JsonModel -Entity "nix_meta") | Select-Object -First 1
        $raio = 500
        if ($metaAnt -and $metaAnt.PSObject.Properties["raioM"] -and [int]$metaAnt.raioM -ge 10) { $raio = [int]$metaAnt.raioM }
        $meta = [ordered]@{
            raioM = $raio
            enviadoEm = (Get-IsoNow)
            enviadoPor = $Usuario.usuarioId
            enviadoPorNome = "$($Usuario.nome)"
            arquivo = (Get-NixTexto -Obj $Body -Campo "arquivo" -Max 200)
            aba = (Get-NixTexto -Obj $Body -Campo "aba" -Max 80)
            linhas = $itens.Count
            pontos = (@($itens | ForEach-Object { @($_.pontos).Count } | Measure-Object -Sum).Sum)
            rejeitadas = $rejeitadas
        }
        # v3.16.0 - pontos incluídos à mão sobrevivem à nova planilha
        $manuais = @(@(Read-JsonModel -Entity "nix") | Where-Object { $_.PSObject.Properties["manual"] -and $_.manual })
        $final = @($itens) + $manuais
        $meta["linhas"] = $final.Count
        $meta["pontos"] = (@($final | ForEach-Object { @($_.pontos).Count } | Measure-Object -Sum).Sum)
        Write-JsonModel -Entity "nix" -Data @($final)
        Write-JsonModel -Entity "nix_meta" -Data @(, $meta)
        Write-NixLog -UsuarioId $Usuario.usuarioId -Acao "enviar" -Dados ([ordered]@{ arquivo = $meta.arquivo; aba = $meta.aba; linhas = $meta.linhas; rejeitadas = $rejeitadas })
        return @{ status = 200; body = @{ ok = $true; meta = $meta; recebidas = $brutos.Count; validas = $itens.Count; rejeitadas = $rejeitadas; semCoordenada = $semCoord; motivos = @($motivos) } }
    }

    if ($Method -eq "PUT") {
        # muda so o raio de alerta (metros) em volta de cada ponto Nix
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "nix" -Acao "importar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para alterar o raio do Nix." } }
        }
        $r = 0
        [void][int]::TryParse((Get-NixTexto -Obj $Body -Campo "raioM" -Max 8), [ref]$r)
        if ($r -lt 10 -or $r -gt 5000) { return @{ status = 400; body = @{ erro = "Raio inválido (use de 10 a 5000 metros)." } } }
        $m = @(Read-JsonModel -Entity "nix_meta") | Select-Object -First 1
        $novo = [ordered]@{}
        if ($m) { foreach ($p in $m.PSObject.Properties) { $novo[$p.Name] = $p.Value } }
        $novo["raioM"] = $r
        Write-JsonModel -Entity "nix_meta" -Data @(, $novo)
        Write-NixLog -UsuarioId $Usuario.usuarioId -Acao "raio" -Dados ([ordered]@{ raioM = $r })
        return @{ status = 200; body = @{ ok = $true; raioM = $r } }
    }

    if ($Method -eq "DELETE" -and $Query["id"]) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "nix" -Acao "excluirStatus")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para apagar ponto Nix." } }
        }
        $idDel = "$($Query['id'])"
        $itensAtuais = @(Read-JsonModel -Entity "nix")
        $alvo = $itensAtuais | Where-Object { $_.PSObject.Properties["id"] -and $_.id -eq $idDel -and $_.PSObject.Properties["manual"] -and $_.manual } | Select-Object -First 1
        if (-not $alvo) { return @{ status = 404; body = @{ erro = "Ponto manual não encontrado (só os incluídos à mão podem ser apagados aqui)." } } }
        $resto = @($itensAtuais | Where-Object { -not ($_.PSObject.Properties["id"] -and $_.id -eq $idDel) })
        Write-JsonModel -Entity "nix" -Data @($resto)
        $metaAnt = @(Read-JsonModel -Entity "nix_meta") | Select-Object -First 1
        if ($metaAnt) {
            $meta = [ordered]@{}
            foreach ($p in $metaAnt.PSObject.Properties) { $meta[$p.Name] = $p.Value }
            $meta["linhas"] = $resto.Count
            $meta["pontos"] = (@($resto | ForEach-Object { @($_.pontos).Count } | Measure-Object -Sum).Sum)
            Write-JsonModel -Entity "nix_meta" -Data @(, $meta)
        }
        Write-NixLog -UsuarioId $Usuario.usuarioId -Acao "apagar-manual" -Dados ([ordered]@{ id = $idDel; e = "$($alvo.e)" })
        return @{ status = 200; body = @{ ok = $true } }
    }

    if ($Method -eq "DELETE") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "nix" -Acao "importar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para apagar a base de pontos Nix." } }
        }
        Write-JsonModel -Entity "nix" -Data @()
        Write-JsonModel -Entity "nix_meta" -Data @()
        Write-NixLog -UsuarioId $Usuario.usuarioId -Acao "apagar" -Dados @{}
        return @{ status = 200; body = @{ ok = $true } }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/nix." } }
}
