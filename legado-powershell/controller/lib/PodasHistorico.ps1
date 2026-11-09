# PodasHistorico.ps1 - historico de podas EXECUTADAS por PLANO (v3.11.0)
#
# PLANO = periodo de 01/nov do ano anterior ate 31/out do ano do plano
# (ex.: plano 2027 = 01/11/2026 a 31/10/2027). O plano de cada OS vem da DATA DE
# EXECUCAO. O plano em aberto continua na base de hoje (manutencao_os.json); os
# planos fechados sobem aqui, UM ARQUIVO POR PLANO (model/historico_podas_<plano>.json).
#
# O historico fica SEPARADO de tudo que e "vivo": nao entra em alertas, rank,
# programacoes nem no Mapa de Manutencao de hoje. Quem le e a rota /api/historico.
# Os registros sao os mesmos da importacao do Executado (mesmo cruzamento SGM + MO),
# so sem o campo "observacao" (texto livre, pesado e sem uso na consulta).
#
# Indice dos planos (contagem, quem subiu, quando): model/historico_podas_meta.json

function Get-PlanoDaData {
    <# "yyyy-MM-dd" -> numero do plano (nov/dez contam como o ano seguinte) ou $null #>
    param([string]$Iso)
    if ($Iso -match '^(\d{4})-(\d{2})-\d{2}') {
        $ano = [int]$Matches[1]; $mes = [int]$Matches[2]
        if ($mes -ge 11) { return ($ano + 1) }
        return $ano
    }
    return $null
}

function Get-PlanoIntervalo {
    param([Parameter(Mandatory)][int]$Plano)
    return @{ inicio = ("{0}-11-01" -f ($Plano - 1)); fim = ("{0}-10-31" -f $Plano) }
}

function Get-EntidadeHistorico {
    param([Parameter(Mandatory)][int]$Plano)
    return "historico_podas_$Plano"
}

$Script:HistCache = @{ plano = 0; stamp = 0; lista = @(); status = @(); tipos = @() }

function Clear-HistoricoCache {
    $Script:HistCache = @{ plano = 0; stamp = 0; lista = @(); status = @(); tipos = @() }
}

function Get-HistoricoCache {
    <# Le o plano do disco so quando o arquivo mudou (guarda UM plano por vez em memoria,
       o ultimo consultado, pra nao pesar o Controller). $null se o plano nao existe. #>
    param([Parameter(Mandatory)][int]$Plano)
    $ent = Get-EntidadeHistorico -Plano $Plano
    $path = Get-EntityPath -Entity $ent
    if (-not (Test-Path $path)) { return $null }
    $stamp = (Get-Item $path).LastWriteTimeUtc.Ticks
    $c = $Script:HistCache
    if ($c.plano -eq $Plano -and $c.stamp -eq $stamp) { return $c }
    Clear-HistoricoCache
    $lista = @(Read-JsonModel -Entity $ent)
    $st = New-Object 'System.Collections.Generic.SortedSet[string]'
    $tp = New-Object 'System.Collections.Generic.SortedSet[string]'
    foreach ($o in $lista) {
        $s = [string]$o.statusOS; if ($s) { [void]$st.Add($s) }
        $t = [string]$o.tipoServico; if ($t) { [void]$tp.Add($t) }
    }
    $Script:HistCache = @{ plano = $Plano; stamp = $stamp; lista = $lista; status = @($st); tipos = @($tp) }
    return $Script:HistCache
}

function Get-HistoricoMeta {
    return @(Read-JsonModel -Entity "historico_podas_meta")
}

function Save-PodasHistorico {
    <# Grava as OS de um plano. -Modo 'substituir' apaga o que o plano ja tinha e grava o que
       veio; 'acrescentar' junta pelo numero da OS (OS nova entra, OS que ja existe e atualizada,
       nada duplica). Devolve contagens pro resumo da importacao. #>
    param(
        [Parameter(Mandatory)][int]$Plano,
        [Parameter(Mandatory)][string]$Modo,
        [Parameter(Mandatory)][System.Collections.Generic.List[object]]$Novos,
        [string]$UsuarioId = "",
        [string]$Arquivos = "",
        $ProgressCallback = $null
    )
    $sinal = { param($txt) if ($ProgressCallback) { try { & $ProgressCallback @{ fase='gravando'; arquivo=$txt; percentual=99 } } catch { } } }
    $ent = Get-EntidadeHistorico -Plano $Plano
    $novasOS = 0; $atualizadas = 0
    $mapa = [System.Collections.Generic.Dictionary[string,object]]::new()
    if ($Modo -eq 'acrescentar') {
        & $sinal 'lendo o plano que ja existe'
        foreach ($e in @(Read-JsonModel -Entity $ent)) { $mapa[[string]$e.id] = $e }
    }
    foreach ($n in $Novos) {
        # campos vazios (null) nao sao gravados: o arquivo de ~100 mil OS fica menor e mais rapido de ler
        foreach ($campo in @($n.Keys)) { if ($null -eq $n[$campo]) { $n.Remove($campo) } }
        $k = [string]$n.id
        if ($mapa.ContainsKey($k)) { $atualizadas++ } else { $novasOS++ }
        $mapa[$k] = $n
    }
    & $sinal 'ordenando as OS'
    # mais recentes primeiro (a consulta ja usa essa ordem sem precisar ordenar de novo)
    $final = @($mapa.Values | Sort-Object -Property @{ Expression = { [string]$_.dataExecucao }; Descending = $true }, @{ Expression = { [string]$_.id }; Descending = $false })
    & $sinal 'gravando o plano'
    Write-JsonModel -Entity $ent -Data $final
    Clear-HistoricoCache

    $iv = Get-PlanoIntervalo -Plano $Plano
    $metaReg = [ordered]@{
        plano = $Plano; total = $final.Count; inicio = $iv.inicio; fim = $iv.fim
        atualizadoEm = (Get-IsoNow); usuarioId = $UsuarioId; modo = $Modo
        novas = $novasOS; atualizadas = $atualizadas; arquivos = $Arquivos
    }
    $meta = @(Get-HistoricoMeta | Where-Object { [int]$_.plano -ne $Plano }) + $metaReg
    Write-JsonModel -Entity "historico_podas_meta" -Data @($meta | Sort-Object { [int]$_.plano } -Descending)

    return @{ historicoModo = $Modo; historicoNovas = $novasOS; historicoAtualizadas = $atualizadas; historicoTotalNoPlano = $final.Count }
}
