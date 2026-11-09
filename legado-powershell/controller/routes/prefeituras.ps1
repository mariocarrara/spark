# =============================================================================
# routes/prefeituras.ps1 — Módulo 4: Envio de Programação às Prefeituras
# (Conformidade ANEEL — Escopo, seção 6)
# =============================================================================

function Invoke-PrefeiturasRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # GET /api/prefeituras
    if ($Method -eq "GET" -and $Segments.Count -eq 0) {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "prefeituras" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Prefeituras." } }
        }
        return @{ status = 200; body = @(Read-JsonModel -Entity "prefeituras") }
    }

    # POST /api/prefeituras/importar
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "importar") {
        return Invoke-ImportacaoGenerica -Base "Prefeituras" -Body $Body -Usuario $Usuario -EntityFile "prefeituras" -KeyField "municipio"
    }

    # GET /api/prefeituras/config - configuracao de envio por municipio
    # (v2.13.34): quais tipos/status de OS a prefeitura recebe e se recebe KMZ.
    # Fica numa entidade separada porque reimportar os contatos regrava
    # model/prefeituras.json inteiro e apagaria essas preferencias.
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "config") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "prefeituras" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para visualizar Prefeituras." } }
        }
        return @{ status = 200; body = @(Read-JsonModel -Entity "prefeituras_config") }
    }

    # PUT /api/prefeituras/config/<municipio> { tiposOS: [..] | null, kmz: true|false|null }
    if ($Method -eq "PUT" -and $Segments.Count -eq 2 -and $Segments[0] -eq "config") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "prefeituras" -Acao "editar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para editar as prefeituras." } }
        }
        $mun = [System.Uri]::UnescapeDataString($Segments[1])
        $validos = @("Pendente", "A reprogramar", "Programada", "Despachada", "Executada", "Cancelada")
        $tipos = $null
        if ($null -ne $Body.tiposOS) {
            $tipos = @(@($Body.tiposOS) | Where-Object { $validos -contains $_ })
        }
        $kmz = $null
        if ($null -ne $Body.kmz) { $kmz = [bool]$Body.kmz }
        $todos = @(Read-JsonModel -Entity "prefeituras_config" | Where-Object { $_.municipio -ne $mun })
        if ($null -ne $tipos -or $null -ne $kmz) {
            $todos += @{ municipio = $mun; tiposOS = $tipos; kmz = $kmz; atualizadoEm = (Get-IsoNow); atualizadoPor = $Usuario.nome }
        }
        Write-JsonModel -Entity "prefeituras_config" -Data $todos
        return @{ status = 200; body = @{ municipio = $mun; tiposOS = $tipos; kmz = $kmz } }
    }

    # POST /api/prefeituras/salvar-pacote { nome, base64 } - guarda o .zip gerado
    # na tela em model/_relatorios_prefeituras/<data>/ pra automacao (Automate) pegar.
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "salvar-pacote") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "prefeituras" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para gerar relatório." } }
        }
        $nome = "$($Body.nome)"
        if ($nome -notmatch '^[A-Za-z0-9_\-\.]{1,80}\.zip$') {
            return @{ status = 400; body = @{ erro = "Nome de arquivo inválido." } }
        }
        try { $bytes = [Convert]::FromBase64String("$($Body.base64)") } catch { return @{ status = 400; body = @{ erro = "Conteúdo inválido." } } }
        if ($bytes.Length -lt 22 -or $bytes.Length -gt 80MB) { return @{ status = 400; body = @{ erro = "Tamanho de arquivo inválido." } } }
        $dir = Join-Path $PSScriptRoot "..\..\model\_relatorios_prefeituras\$((Get-Date).ToString('yyyy-MM-dd'))"
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $destino = Join-Path $dir $nome
        [System.IO.File]::WriteAllBytes($destino, $bytes)
        return @{ status = 200; body = @{ pasta = $dir; arquivo = $nome; bytes = $bytes.Length } }
    }

    # POST /api/prefeituras/gerar-relatorio
    # Gera 1 Excel por município com a programação dos 7 dias seguintes
    # (Escopo 6.3). O disparo do e-mail é responsabilidade de uma automação
    # externa (RPA/Automate) que consome os arquivos aqui gerados - o
    # Controller só produz os arquivos, não envia e-mail (fora do escopo do
    # sistema, seção 6.3).
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "gerar-relatorio") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "prefeituras" -Acao "excluirStatus") -and
            -not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "prefeituras" -Acao "visualizar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para gerar relatório." } }
        }

        $municipios = @(Read-JsonModel -Entity "prefeituras")
        $protecoes = @(Read-JsonModel -Entity "protecao")
        $programacoes = @(Read-JsonModel -Entity "programacao")

        $hoje = Get-Date
        $seteDiasDepois = $hoje.AddDays(7)

        $protecaoPorId = @{}
        foreach ($p in $protecoes) { $protecaoPorId[$p.protecaoId] = $p }

        $relatoriosGerados = @()
        $outDir = Join-Path $PSScriptRoot "..\..\model\_relatorios_prefeituras\$($hoje.ToString('yyyy-MM-dd'))"
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null

        foreach ($municipio in $municipios) {
            $programacoesDoMunicipio = $programacoes | Where-Object {
                $prot = $protecaoPorId[$_.protecaoId]
                $prot -and $prot.municipio -eq $municipio.municipio -and
                $_.status -ne "Cancelada" -and
                $_.dataInicio -ge $hoje.ToString("yyyy-MM-dd") -and
                $_.dataInicio -le $seteDiasDepois.ToString("yyyy-MM-dd")
            }

            if ($programacoesDoMunicipio.Count -eq 0) { continue }

            # Campos exatos do relatório ainda pendentes de definição com o
            # cliente (Escopo, seção 6.4) - usamos os campos já cadastrados
            # da programação como base inicial (CSV, mais simples de gerar
            # em PowerShell puro sem módulos de terceiros; trocar para XLSX
            # real com ImportExcel ou COM quando os campos forem fechados).
            $csvPath = Join-Path $outDir "$($municipio.municipio -replace '[^\w]','_').csv"
            $programacoesDoMunicipio |
                Select-Object numeroSIS, alimentador, protecaoId, dataInicio, dataFim, tipoProgramacao, desligamento, status |
                Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8

            $relatoriosGerados += @{ municipio = $municipio.municipio; arquivo = $csvPath; quantidade = $programacoesDoMunicipio.Count }
        }

        return @{ status = 200; body = @{ geradoEm = Get-IsoNow; pasta = $outDir; relatorios = @($relatoriosGerados) } }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/prefeituras." } }
}
