# =============================================================================
# routes/historico.ps1 - Historico de podas executadas por PLANO (v3.11.0)
# Plano = 01/nov do ano anterior a 31/out do ano do plano. Dados em
# model/historico_podas_<plano>.json (ver lib/PodasHistorico.ps1). A IMPORTACAO e o
# POST /api/importacao/podas-historico (streaming, em routes/importacao.ps1).
#   GET    /api/historico/planos            planos guardados {plano,total,inicio,fim,atualizadoEm,...}
#   GET    /api/historico/os?plano=2026&...  consulta paginada (q, status, tipo, alim, de, ate,
#                                            pagina, porPagina) -> {itens, total, resumo, filtros}
#   GET    /api/historico/exportar?plano=... mesmos filtros; devolve CSV (;) pra abrir no Excel
#   GET    /api/historico/mapa?plano=2026    o plano INTEIRO no formato das OS (gzip) pro mapa (v3.14.0)
#   DELETE /api/historico/planos/<plano>    apaga o plano (precisa poder importar e editar)
# Leitura: manutencao/visualizar.
# =============================================================================

function Get-HistoricoTextoQuery {
    param($Query, [string]$Campo)
    if ($null -eq $Query -or -not $Query.ContainsKey($Campo)) { return "" }
    return ("$($Query[$Campo])").Trim()
}

function Get-HistoricoFiltrado {
    <# Aplica os filtros da query na lista do plano. Devolve @{ itens (List); resumo }.
       Loop com foreach (Where-Object seria varias vezes mais lento em 100 mil OS). #>
    param($Cache, $Query)
    $q = Get-HistoricoTextoQuery $Query "q"
    $status = Get-HistoricoTextoQuery $Query "status"
    $tipo = Get-HistoricoTextoQuery $Query "tipo"
    $alim = Get-HistoricoTextoQuery $Query "alim"
    $de = Get-HistoricoTextoQuery $Query "de"
    $ate = Get-HistoricoTextoQuery $Query "ate"
    $ci = [System.StringComparison]::OrdinalIgnoreCase
    $itens = New-Object System.Collections.Generic.List[object]
    $sumPrevPoda = 0.0; $sumRealPoda = 0.0; $sumRealLimp = 0.0; $sumRealEstr = 0.0
    $porStatus = @{}
    foreach ($o in $Cache.lista) {
        if ($status -and ([string]$o.statusOS) -ne $status) { continue }
        if ($tipo -and ([string]$o.tipoServico) -ne $tipo) { continue }
        if ($alim -and ([string]$o.alimentador).IndexOf($alim, $ci) -lt 0) { continue }
        if ($de -or $ate) {
            $d = [string]$o.dataExecucao
            if ($d.Length -gt 10) { $d = $d.Substring(0, 10) }
            if (-not $d) { continue }
            if ($de -and [string]::CompareOrdinal($d, $de) -lt 0) { continue }
            if ($ate -and [string]::CompareOrdinal($d, $ate) -gt 0) { continue }
        }
        if ($q) {
            $achou = $false
            foreach ($campo in @($o.id, $o.alimentador, $o.localidade, $o.trecho, $o.posteId, $o.protecaoId, $o.descEsquema)) {
                if (([string]$campo).IndexOf($q, $ci) -ge 0) { $achou = $true; break }
            }
            if (-not $achou) { continue }
        }
        $itens.Add($o)
        $sumPrevPoda += [double]$o.previstoPoda
        $sumRealPoda += [double]$o.realizadoPoda
        $sumRealLimp += [double]$o.realizadoLimpeza
        $sumRealEstr += [double]$o.realizadoEstrutura
        $sk = [string]$o.statusOS
        $porStatus[$sk] = 1 + [int]$porStatus[$sk]
    }
    return @{
        itens = $itens
        resumo = [ordered]@{
            previstoPoda = [Math]::Round($sumPrevPoda, 2); realizadoPoda = [Math]::Round($sumRealPoda, 2)
            realizadoLimpeza = [Math]::Round($sumRealLimp, 2); realizadoEstrutura = [Math]::Round($sumRealEstr, 2)
            porStatus = $porStatus
        }
    }
}

function ConvertTo-HistoricoLinha {
    # o que a tela da consulta precisa de cada OS (sem o resto, pra resposta ficar leve)
    param($o)
    $lat = $null; $lng = $null; $aprox = $false
    if ($o.localizacao) { $lat = $o.localizacao.lat; $lng = $o.localizacao.lng; $aprox = [bool]$o.localizacao.aproximada }
    return [ordered]@{
        id = [string]$o.id; statusOS = $o.statusOS; tipoServico = $o.tipoServico
        dataAbertura = $o.dataAbertura; dataExecucao = $o.dataExecucao
        alimentador = $o.alimentador; localidade = $o.localidade; trecho = $o.trecho; posteId = $o.posteId
        equipeId = $o.equipeId; descEsquema = $o.descEsquema; numObra = $o.numObra; recursoMo = $o.recursoMo
        previstoPoda = $o.previstoPoda; previstoLimpeza = $o.previstoLimpeza; previstoEstrutura = $o.previstoEstrutura
        realizadoPoda = $o.realizadoPoda; realizadoLimpeza = $o.realizadoLimpeza; realizadoEstrutura = $o.realizadoEstrutura
        lat = $lat; lng = $lng; aproximada = $aprox
    }
}

function Get-HistoricoMapaPacote {
    <# v3.14.0 - bytes do arquivo do plano (formato das OS, o mesmo de manutencao_os.json) comprimidos em
       gzip, pro mapa de manutencao mostrar OS de planos anteriores. Guarda em memoria so o ULTIMO plano
       pedido; recarrega quando o arquivo muda. $null se o plano nao existe. #>
    param([Parameter(Mandatory)][int]$Plano)
    $arq = Get-EntityPath -Entity (Get-EntidadeHistorico -Plano $Plano)
    $info = Get-Item -Path $arq -ErrorAction SilentlyContinue
    if (-not $info) { return $null }
    $chave = "$Plano-$($info.LastWriteTimeUtc.Ticks)-$($info.Length)"
    if ($Script:HistMapaChave -eq $chave -and $Script:HistMapaPacote) { return $Script:HistMapaPacote }
    $Script:HistMapaPacote = $null; $Script:HistMapaChave = ""
    $raw = [System.IO.File]::ReadAllBytes($arq)
    $ms = New-Object System.IO.MemoryStream
    $gz = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionLevel]::Fastest)
    $gz.Write($raw, 0, $raw.Length); $gz.Close()
    $pacote = @{ raw = $raw; gzip = $ms.ToArray() }
    Write-Host ("  [historico no mapa] plano {0}: {1:N1} MB -> gzip {2:N1} MB" -f $Plano, ($raw.Length / 1MB), ($pacote.gzip.Length / 1MB))
    $Script:HistMapaPacote = $pacote; $Script:HistMapaChave = $chave
    return $pacote
}

function Invoke-HistoricoRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    if (-not (Test-PermissaoHistorico -UsuarioId $Usuario.usuarioId)) {
        return @{ status = 403; body = @{ erro = "Sem permissão para consultar o histórico de podas." } }
    }

    # GET /api/historico/planos
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "planos") {
        return @{ status = 200; body = @(Get-HistoricoMeta) }
    }

    # GET /api/historico/mapa?plano=2025  (v3.14.0) - o plano inteiro, no formato das OS, pro mapa
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "mapa") {
        $planoM = 0
        if (-not [int]::TryParse((Get-HistoricoTextoQuery $Query "plano"), [ref]$planoM) -or $planoM -lt 2000 -or $planoM -gt 2100) {
            return @{ status = 400; body = @{ erro = "Informe o plano (ex.: ?plano=2025)." } }
        }
        $pac = Get-HistoricoMapaPacote -Plano $planoM
        if (-not $pac) { return @{ status = 404; body = @{ erro = "O plano $planoM ainda não foi enviado para o histórico." } } }
        if ($Script:ClienteAceitaGzip) { return @{ status = 200; rawBytes = $pac.gzip; gzip = $true } }
        return @{ status = 200; rawBytes = $pac.raw }
    }

    # GET /api/historico/os  e  /api/historico/exportar
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and ($Segments[0] -eq "os" -or $Segments[0] -eq "exportar")) {
        $plano = 0
        if (-not [int]::TryParse((Get-HistoricoTextoQuery $Query "plano"), [ref]$plano) -or $plano -lt 2000 -or $plano -gt 2100) {
            return @{ status = 400; body = @{ erro = "Informe o plano (ex.: ?plano=2026)." } }
        }
        $cache = Get-HistoricoCache -Plano $plano
        if (-not $cache) { return @{ status = 404; body = @{ erro = "O plano $plano ainda não foi enviado para o histórico." } } }
        $f = Get-HistoricoFiltrado -Cache $cache -Query $Query
        $itens = $f.itens

        if ($Segments[0] -eq "exportar") {
            $limite = 300000
            $pt = [System.Globalization.CultureInfo]::GetCultureInfo("pt-BR")
            $esp = [char[]]@(';', '"', "`n", "`r")
            $sb = New-Object System.Text.StringBuilder
            [void]$sb.Append([char]0xFEFF)
            [void]$sb.Append("OS;Status;Servico;Abertura;Execucao;Alimentador;Localidade;Trecho;Poste;Esquema;Previsto poda;Realizado poda;Previsto limpeza (m2);Realizado limpeza (m2);Previsto estrutura;Realizado estrutura;Latitude;Longitude;Posicao aproximada`r`n")
            $n = 0
            foreach ($o in $itens) {
                if ($n -ge $limite) { break }
                $n++
                # tudo inline (sem funcao por campo): 100 mil OS x 19 colunas em funcao seria lento demais
                $txt = @(([string]$o.id).Trim(), [string]$o.statusOS, [string]$o.tipoServico, [string]$o.alimentador, [string]$o.localidade, [string]$o.trecho, [string]$o.posteId, [string]$o.descEsquema)
                for ($k = 0; $k -lt $txt.Count; $k++) {
                    if ($txt[$k].IndexOfAny($esp) -ge 0) { $txt[$k] = '"' + $txt[$k].Replace('"', '""') + '"' }
                }
                $dAb = [string]$o.dataAbertura; if ($dAb.Length -ge 10) { $dAb = $dAb.Substring(8, 2) + "/" + $dAb.Substring(5, 2) + "/" + $dAb.Substring(0, 4) }
                $dEx = [string]$o.dataExecucao; if ($dEx.Length -ge 10) { $dEx = $dEx.Substring(8, 2) + "/" + $dEx.Substring(5, 2) + "/" + $dEx.Substring(0, 4) }
                $qtd = @($o.previstoPoda, $o.realizadoPoda, $o.previstoLimpeza, $o.realizadoLimpeza, $o.previstoEstrutura, $o.realizadoEstrutura)
                for ($k = 0; $k -lt 6; $k++) {
                    if ($null -eq $qtd[$k] -or "$($qtd[$k])" -eq "") { $qtd[$k] = "" } else { $qtd[$k] = ([double]$qtd[$k]).ToString("0.##", $pt) }
                }
                $lat = ""; $lng = ""; $aprox = ""
                if ($o.localizacao) {
                    if ($null -ne $o.localizacao.lat -and $null -ne $o.localizacao.lng) {
                        $lat = ([double]$o.localizacao.lat).ToString("0.######", $pt)
                        $lng = ([double]$o.localizacao.lng).ToString("0.######", $pt)
                    }
                    if ($o.localizacao.aproximada) { $aprox = "sim" }
                }
                # ordem = cabecalho: OS;Status;Servico;Abertura;Execucao;Alimentador;Localidade;Trecho;Poste;Esquema;qtds...;lat;lng;aprox
                [void]$sb.Append($txt[0]).Append(';').Append($txt[1]).Append(';').Append($txt[2]).Append(';').Append($dAb).Append(';').Append($dEx).Append(';').Append($txt[3]).Append(';').Append($txt[4]).Append(';').Append($txt[5]).Append(';').Append($txt[6]).Append(';').Append($txt[7])
                for ($k = 0; $k -lt 6; $k++) { [void]$sb.Append(';').Append($qtd[$k]) }
                [void]$sb.Append(';').Append($lat).Append(';').Append($lng).Append(';').Append($aprox).Append("`r`n")
            }
            $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($sb.ToString())
            return @{ status = 200; rawBytes = $bytes; gzip = $false }
        }

        $porPag = 50
        $tmpPP = 0
        if ([int]::TryParse((Get-HistoricoTextoQuery $Query "porPagina"), [ref]$tmpPP)) { $porPag = $tmpPP }
        if ($porPag -lt 10) { $porPag = 10 }
        if ($porPag -gt 200) { $porPag = 200 }
        $pag = 1
        [void][int]::TryParse((Get-HistoricoTextoQuery $Query "pagina"), [ref]$pag)
        if ($pag -lt 1) { $pag = 1 }
        $total = $itens.Count
        $paginas = [Math]::Max(1, [int][Math]::Ceiling($total / [double]$porPag))
        if ($pag -gt $paginas) { $pag = $paginas }
        $ini = ($pag - 1) * $porPag
        $fim = [Math]::Min($total, $ini + $porPag)
        $linhas = New-Object System.Collections.Generic.List[object]
        for ($i = $ini; $i -lt $fim; $i++) { $linhas.Add((ConvertTo-HistoricoLinha $itens[$i])) }
        return @{ status = 200; body = [ordered]@{
            plano = $plano; total = $total; totalPlano = $cache.lista.Count; pagina = $pag; porPagina = $porPag; paginas = $paginas
            itens = $linhas; resumo = $f.resumo
            filtros = [ordered]@{ status = @($cache.status); tipos = @($cache.tipos) }
        } }
    }

    # DELETE /api/historico/planos/<plano>
    if ($Method -eq "DELETE" -and $Segments.Count -eq 2 -and $Segments[0] -eq "planos") {
        if (-not ((Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "importar") -and (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar"))) {
            return @{ status = 403; body = @{ erro = "Sem permissão para apagar um plano do histórico (precisa poder importar e editar)." } }
        }
        $plano = 0
        if (-not [int]::TryParse("$($Segments[1])", [ref]$plano) -or $plano -lt 2000 -or $plano -gt 2100) {
            return @{ status = 400; body = @{ erro = "Plano inválido." } }
        }
        $path = Get-EntityPath -Entity (Get-EntidadeHistorico -Plano $plano)
        if (-not (Test-Path $path)) { return @{ status = 404; body = @{ erro = "O plano $plano não está no histórico." } } }
        Remove-Item -LiteralPath $path -Force
        Clear-HistoricoCache
        $meta = @(Get-HistoricoMeta | Where-Object { [int]$_.plano -ne $plano })
        Write-JsonModel -Entity "historico_podas_meta" -Data $meta
        $logEntry = @{
            id = New-EntityId; base = "Podas — Histórico (plano $plano apagado)"; usuarioId = $Usuario.usuarioId
            dataHora = Get-IsoNow; registrosProcessados = 0; registrosComErro = 0; arquivoOrigem = ""
        }
        Write-JsonModel -Entity "importacoes_log" -Data (@(Read-JsonModel -Entity "importacoes_log") + $logEntry)
        return @{ status = 200; body = @{ ok = $true; plano = $plano } }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/historico." } }
}
