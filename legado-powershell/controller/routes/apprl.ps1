# =============================================================================
# routes/apprl.ps1 - OS x APP / Reserva Legal (v3.12.0) - ver lib/AppRl.ps1
#   GET  /api/apprl/indice      indice calculado (so as OS dentro ou a ate 100 m de APP/RL) - JSON cru
#   GET  /api/apprl/config      tolerancia atual (m) + quando o indice foi gerado
#   PUT  /api/apprl/config      { toleranciaM } - 0 a 100 m (manutencao/editar)
#   POST /api/apprl/recalcular  recalcula o indice agora (manutencao/importar)
# A classificacao (dentro / borda / fora) e feita no navegador com a tolerancia; aqui so
# se guarda a distancia em metros, por isso trocar a tolerancia nao exige recalcular.
# =============================================================================

function Invoke-AppRlRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
        return @{ status = 403; body = @{ erro = "Sem permissão para ver APP/RL." } }
    }
    if ($Segments.Count -ne 1) { return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/apprl." } } }

    # GET /api/apprl/indice
    if ($Method -eq "GET" -and $Segments[0] -eq "indice") {
        $bytes = Get-AppRlIndiceBytes
        if (-not $bytes) { return @{ status = 200; body = @{ geradoEm = $null; maxM = $Script:AppRlMaxM; avaliadas = 0; semPosicao = 0; alimentadoresApp = @(); alimentadoresRl = @(); os = @{} } } }
        return @{ status = 200; rawBytes = $bytes; gzip = $false }
    }

    # GET /api/apprl/config
    if ($Method -eq "GET" -and $Segments[0] -eq "config") {
        $cfg = Get-AppRlConfig
        $gerado = $null
        $p = Get-AppRlIndicePath
        if (Test-Path $p) { $gerado = (Get-Item $p).LastWriteTime.ToString("yyyy-MM-ddTHH:mm:ss") }
        $cfg['indiceGeradoEm'] = $gerado
        return @{ status = 200; body = $cfg }
    }

    # PUT /api/apprl/config
    if ($Method -eq "PUT" -and $Segments[0] -eq "config") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para alterar a tolerância de APP/RL." } }
        }
        $tol = 0.0
        $txt = if ($null -ne $Body -and $null -ne $Body.toleranciaM) { ("$($Body.toleranciaM)").Replace(',', '.') } else { "" }
        if (-not [double]::TryParse($txt, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$tol) -or $tol -lt 0 -or $tol -gt $Script:AppRlMaxM) {
            return @{ status = 400; body = @{ erro = "A tolerância precisa ser um número entre 0 e $($Script:AppRlMaxM) metros." } }
        }
        $antes = (Get-AppRlConfig).toleranciaM
        $reg = [ordered]@{ toleranciaM = [Math]::Round($tol, 1); atualizadoEm = (Get-IsoNow); atualizadoPor = $Usuario.usuarioId }
        Write-JsonModel -Entity "app_rl_config" -Data @($reg)
        $logEntry = @{
            id = New-EntityId; base = "APP/RL — tolerância de $antes m para $([Math]::Round($tol, 1)) m"; usuarioId = $Usuario.usuarioId
            dataHora = Get-IsoNow; registrosProcessados = 0; registrosComErro = 0; arquivoOrigem = ""
        }
        try { Write-JsonModel -Entity "importacoes_log" -Data (@(Read-JsonModel -Entity "importacoes_log") + $logEntry) } catch { }
        return @{ status = 200; body = (Get-AppRlConfig) }
    }

    # POST /api/apprl/recalcular
    if ($Method -eq "POST" -and $Segments[0] -eq "recalcular") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "importar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para recalcular APP/RL." } }
        }
        $r = Update-AppRlIndice
        if (-not $r.ok) { return @{ status = 500; body = @{ erro = $r.aviso } } }
        return @{ status = 200; body = $r }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/apprl." } }
}
