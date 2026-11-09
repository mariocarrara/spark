# =============================================================================
# routes/ajustes.ps1 - "Ajuste de OS" (v3.5.0), na Gestao de Bases
#   GET    /api/ajustes            lista os ajustes (manutencao/visualizar)
#   PUT    /api/ajustes/{osId}     cria/altera o ajuste de uma OS (manutencao/editar)
#   DELETE /api/ajustes/{osId}     remove o ajuste (a OS volta ao valor original)
# O ajuste e SOBERANO: tipo de equipe, equipe executora, alimentador e protecao
# informados aqui valem mais que o que veio do SGM/SIGOD. Fica em arquivo proprio
# (model/ajustes_os.json), por isso SOBREVIVE a novas cargas de GRID. Quem aplica o
# ajuste por cima da OS e o navegador (mapOsRaw, api.js), tambem nas copias que as
# programacoes guardam. Campo em branco = nao ajustar (vale o original).
# Historico (quem/quando/de-para): model/ajustes_os_log.jsonl (so acrescenta).
# =============================================================================

$Script:AjusteCampos = @('tipoEquipe','equipeId','alimentador','protecaoId')

function Write-AjusteLog {
    param([string]$OsId, [string]$UsuarioId, [string]$Acao, $Antes, $Depois)
    try {
        $path = Join-Path (Split-Path (Get-EntityPath -Entity "ajustes_os") -Parent) "ajustes_os_log.jsonl"
        $reg = [ordered]@{ t = (Get-IsoNow); u = $UsuarioId; os = $OsId; a = $Acao; de = $Antes; para = $Depois }
        $linha = (ConvertTo-Json -InputObject $reg -Compress -Depth 5) + "`n"
        $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($linha)
        $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
        try { $fs.Write($bytes, 0, $bytes.Length) } finally { $fs.Dispose() }
    } catch { }
}

function Get-AjusteCamposDe {
    param($Obj)
    $h = [ordered]@{}
    foreach ($c in $Script:AjusteCampos) {
        $v = $null
        if ($Obj -is [System.Collections.IDictionary]) { if ($Obj.Contains($c)) { $v = $Obj[$c] } }
        elseif ($null -ne $Obj -and $Obj.PSObject.Properties[$c]) { $v = $Obj.PSObject.Properties[$c].Value }
        $t = if ($null -eq $v) { "" } else { ("$v").Trim() }
        if ($t.Length -gt 120) { $t = $t.Substring(0, 120) }
        $h[$c] = $t
    }
    return $h
}

function Invoke-AjustesRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # GET /api/ajustes
    if ($Method -eq "GET" -and $Segments.Count -eq 0) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para ver os ajustes de OS." } }
        }
        return @{ status = 200; body = @(Read-JsonModel -Entity "ajustes_os") }
    }

    if ($Segments.Count -eq 1 -and ($Method -eq "PUT" -or $Method -eq "DELETE")) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para ajustar OS (precisa poder editar a Manutenção)." } }
        }
        $osId = ([System.Uri]::UnescapeDataString([string]$Segments[0])).Trim().ToUpper()
        if (-not $osId) { return @{ status = 400; body = @{ erro = "Informe a OS." } } }

        $todos = @(Read-JsonModel -Entity "ajustes_os")
        $atual = $todos | Where-Object { "$($_.id)".ToUpper() -eq $osId } | Select-Object -First 1
        $outros = @($todos | Where-Object { "$($_.id)".ToUpper() -ne $osId })
        $antes = if ($atual) { Get-AjusteCamposDe -Obj $atual } else { $null }

        if ($Method -eq "DELETE") {
            if (-not $atual) { return @{ status = 404; body = @{ erro = "Essa OS não tem ajuste." } } }
            Write-JsonModel -Entity "ajustes_os" -Data @($outros)
            Write-AjusteLog -OsId $osId -UsuarioId $Usuario.usuarioId -Acao "remover" -Antes $antes -Depois $null
            return @{ status = 200; body = @{ ok = $true; id = $osId } }
        }

        $novo = Get-AjusteCamposDe -Obj $Body
        $algum = $false
        foreach ($c in $Script:AjusteCampos) { if ($novo[$c]) { $algum = $true } }
        if (-not $algum) { return @{ status = 400; body = @{ erro = "Preencha pelo menos um campo para ajustar (ou use Remover)." } } }

        $agora = Get-IsoNow
        $reg = @{
            id = $osId
            tipoEquipe = $novo['tipoEquipe']; equipeId = $novo['equipeId']; alimentador = $novo['alimentador']; protecaoId = $novo['protecaoId']
            criadoPor = $(if ($atual -and $atual.criadoPor) { $atual.criadoPor } else { $Usuario.usuarioId })
            criadoEm = $(if ($atual -and $atual.criadoEm) { $atual.criadoEm } else { $agora })
            atualizadoPor = $Usuario.usuarioId
            atualizadoEm = $agora
        }
        Write-JsonModel -Entity "ajustes_os" -Data @(@($outros) + @($reg))
        Write-AjusteLog -OsId $osId -UsuarioId $Usuario.usuarioId -Acao $(if ($atual) { "alterar" } else { "criar" }) -Antes $antes -Depois $novo
        return @{ status = 200; body = $reg }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/ajustes." } }
}
