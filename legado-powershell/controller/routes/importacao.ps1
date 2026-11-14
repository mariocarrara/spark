# =============================================================================
# routes/importacao.ps1 — Módulo 5: Importação de Bases (genérico, Escopo seção 7)
# =============================================================================

function New-CronometroImportacao {
    # Estado do cronometro (hashtable = tipo referencia, entao o scriptblock
    # com GetNewClosure() enxerga as mesmas atualizacoes).
    return @{ sw = [System.Diagnostics.Stopwatch]::StartNew(); fase = $null; inicioFase = 0.0; impresso = $false }
}

function Write-FaseImportacao {
    # Chamada a cada progresso: quando a "fase" muda, imprime no prompt quanto
    # tempo a fase anterior levou; em 'concluido' imprime tambem o total.
    param($Cron, $P)
    if (-not $P -or -not $P.fase) { return }
    $fase = "$($P.fase)"
    if ($Cron.fase -eq $fase) { return }
    $agora = $Cron.sw.Elapsed.TotalSeconds
    if ($Cron.fase) {
        Write-Host ("  [importacao] fase '{0}': {1:N1}s" -f $Cron.fase, ($agora - $Cron.inicioFase)) -ForegroundColor DarkCyan
    }
    $Cron.fase = $fase
    $Cron.inicioFase = $agora
    if ($fase -eq 'concluido' -and -not $Cron.impresso) {
        $Cron.impresso = $true
        Write-Host ("  [importacao] TOTAL: {0:N1}s" -f $agora) -ForegroundColor Cyan
    }
}

function Write-ErroImportacao {
    # v2.13.12 - erros das importacoes em streaming iam so para o navegador
    # (linha NDJSON "erro"); o console ficava mudo. Agora tambem aparece aqui,
    # com a etapa, o tipo da excecao e a linha do script onde ocorreu.
    param([string]$Etapa, $Erro)
    try {
        Write-Host ("  [importacao] ERRO ao {0}: {1}" -f $Etapa, $Erro.Exception.Message) -ForegroundColor Red
        Write-Host ("    tipo: {0}" -f $Erro.Exception.GetType().FullName) -ForegroundColor Red
        if ($Erro.InvocationInfo) { Write-Host ("    onde: {0}" -f ($Erro.InvocationInfo.PositionMessage -replace "\r?\n", " | ")) -ForegroundColor Red }
        if ($Erro.ScriptStackTrace) { Write-Host ("    pilha: {0}" -f ($Erro.ScriptStackTrace -replace "\r?\n", " | ")) -ForegroundColor DarkRed }
    } catch { }
}

function Invoke-ImportacaoRoute {
    param($Method, $Segments, $Query, $Body, $Usuario)

    # POST /api/importacao/validar — recebe linhas já parseadas do Excel pelo
    # front-end (o parse binário do .xlsx acontece no navegador antes do
    # envio; o Controller só valida estrutura e tipo, como definido no
    # Escopo 7.2), devolve pré-visualização + erros linha a linha, sem gravar.
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "validar") {
        $base = $Body.base
        $rows = @($Body.linhas)
        try {
            $resultado = Test-ImportRows -Base $base -Rows $rows
        } catch {
            return @{ status = 400; body = @{ erro = $_.Exception.Message } }
        }
        # erros limitado aos primeiros 500: devolver os erros linha a linha
        # de uma base com dezenas/centenas de milhares de registros (ex.:
        # VERA, que pode passar de 140 mil árvores) significava um corpo de
        # resposta gigante e uma tabela de erros impossível de renderizar
        # no navegador sem travar a aba - a pré-visualização já era limitada
        # a 20 linhas pelo mesmo motivo, isso só faltava no lado dos erros.
        return @{ status = 200; body = @{
            base = $base
            totalLinhas = $rows.Count
            validas = $resultado.validas.Count
            totalErros = $resultado.erros.Count
            erros = @($resultado.erros | Select-Object -First 500)
            preVisualizacao = @($resultado.validas | Select-Object -First 20)
        } }
    }

    # POST /api/importacao/confirmar — efetiva a gravação (Escopo 7.2: grava
    # por chave única sem duplicar). Delega para o handler genérico
    # compartilhado por cada módulo (Invoke-ImportacaoGenerica em server.ps1).
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "confirmar") {
        $base = $Body.base
        $entityMap = @{
            "Metas" = "metas"; "Equipes" = "equipes"; "Vao" = "vao"
            "Protecao" = "protecao"; "VERA" = "vera"; "Prefeituras" = "prefeituras"
            "Localidades" = "localidades"; "PrioridadeEW" = "prioridade_ew"; "Esquemas" = "esquemas"; "Conjuntos" = "conjuntos"
        }
        $keyMap = @{
            "Metas" = "id"; "Equipes" = "id"; "Vao" = "protecaoId"
            "Protecao" = "protecaoId"; "VERA" = "idVera"; "Prefeituras" = "municipio"
            "Localidades" = "codLocalidade"; "PrioridadeEW" = "chave"; "Esquemas" = "codigo"; "Conjuntos" = "alimentador"
        }
        if (-not $entityMap.ContainsKey($base)) {
            return @{ status = 400; body = @{ erro = "Base de importação desconhecida: $base" } }
        }
        # As colunas do Excel (CodigoEquipe, MetaMensal...) usam nomes diferentes
        # dos campos gravados no JSON (id, metaMensal...) — cada base precisa da
        # sua própria tradução antes de gravar, igual ao que os endpoints
        # dedicados (/api/equipes/importar, /api/metas/importar) já fazem.
        $posProcessar = Get-PosProcessarDaBase -Base $base -Usuario $Usuario
        return Invoke-ImportacaoGenerica -Base $base -Body $Body -Usuario $Usuario -EntityFile $entityMap[$base] -KeyField $keyMap[$base] -PosProcessar $posProcessar
    }

    # POST /api/importacao/shapefile é tratada à parte (streaming) — ver
    # Invoke-ShapefileStreamingUpload, chamada direto pelo server.ps1 antes
    # de chegar aqui, pelo mesmo motivo do Podas logo abaixo: o Controller
    # atende um pedido por vez, e o SSDMT real (427.910 registros) pode
    # levar minutos pra ler.

    # POST /api/importacao/podas-executado e /api/importacao/podas-pendente
    # são tratadas à parte (streaming) — ver Invoke-PodasStreamingUpload,
    # chamada direto pelo server.ps1 antes de chegar aqui, porque precisam
    # escrever a resposta HTTP aos poucos conforme a leitura avança.

    # GET /api/importacao/log
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "log") {
        $log = @(Read-JsonModel -Entity "importacoes_log") | Sort-Object dataHora -Descending
        return @{ status = 200; body = @($log) }
    }

    # GET /api/importacao/camadas — tela "Gerenciar Camadas" (agora dentro
    # da aba "Camadas de rede" da Gestão de Bases): lista os alimentadores
    # já carregados, um bloco por camada, pra o usuário poder apagar um
    # alimentador importado errado/incompleto sem precisar mexer em
    # arquivo. reserva_legal/app entraram aqui do mesmo jeito que MT/BT/AT —
    # Get-AlimentadoresCarregados já é genérica (ver Get-CamadaConfig).
    if ($Method -eq "GET" -and $Segments.Count -eq 1 -and $Segments[0] -eq "camadas") {
        $geoRoot = Join-Path $PSScriptRoot "..\..\geo"
        return @{ status = 200; body = @{
            rede_media_tensao = @(Get-AlimentadoresCarregados -Camada "rede_media_tensao" -GeoRoot $geoRoot)
            rede_baixa_tensao = @(Get-AlimentadoresCarregados -Camada "rede_baixa_tensao" -GeoRoot $geoRoot)
            rede_alta_tensao  = @(Get-AlimentadoresCarregados -Camada "rede_alta_tensao" -GeoRoot $geoRoot)
            reserva_legal     = @(Get-AlimentadoresCarregados -Camada "reserva_legal" -GeoRoot $geoRoot)
            app               = @(Get-AlimentadoresCarregados -Camada "app" -GeoRoot $geoRoot)
        } }
    }

    # DELETE /api/importacao/camadas/<camada> - "Apagar tudo" da aba da camada (v2.13.30)
    if ($Method -eq "DELETE" -and $Segments.Count -eq 2 -and $Segments[0] -eq "camadas") {
        if (-not ((Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "importar") -and (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "editar"))) {
            return @{ status = 403; body = @{ erro = "Sem permissão para apagar camadas de rede (precisa poder importar e editar)." } }
        }
        $camada = $Segments[1]
        $camadasValidas = @("rede_media_tensao", "rede_baixa_tensao", "rede_alta_tensao", "reserva_legal", "app")
        if ($camadasValidas -notcontains $camada) { return @{ status = 400; body = @{ erro = "Camada de rede desconhecida: $camada" } } }
        if ("$($Query['confirmar'])" -ne "sim") { return @{ status = 400; body = @{ erro = "Falta a confirmação (confirmar=sim)." } } }
        $geoRoot = Join-Path $PSScriptRoot "..\..\geo"
        $qtd = 0
        foreach ($it in @(Get-AlimentadoresCarregados -Camada $camada -GeoRoot $geoRoot)) {
            try { Remove-AlimentadorCarregado -Camada $camada -Chave $it.chave -GeoRoot $geoRoot; $qtd++ } catch { }
        }
        Update-ResumoKmDeRedeAposImportacao
        return @{ status = 200; body = @{ camada = $camada; apagados = $qtd } }
    }

    # DELETE /api/importacao/camadas/<camada>/<chave> — apaga um alimentador
    # já carregado dessa camada (botão "X" da tela Gerenciar Camadas).
    if ($Method -eq "DELETE" -and $Segments.Count -eq 3 -and $Segments[0] -eq "camadas") {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "importar")) {
            return @{ status = 403; body = @{ erro = "Sem permissão para apagar camadas de rede." } }
        }
        $camada = $Segments[1]
        $chave = [System.Uri]::UnescapeDataString($Segments[2])
        $camadasValidas = @("rede_media_tensao", "rede_baixa_tensao", "rede_alta_tensao", "reserva_legal", "app")
        if ($camadasValidas -notcontains $camada) {
            return @{ status = 400; body = @{ erro = "Camada de rede desconhecida: $camada" } }
        }
        $geoRoot = Join-Path $PSScriptRoot "..\..\geo"
        try {
            Remove-AlimentadorCarregado -Camada $camada -Chave $chave -GeoRoot $geoRoot
        } catch {
            return @{ status = 404; body = @{ erro = $_.Exception.Message } }
        }
        # v2.12.0 - apagar um alimentador muda o total de Km de rede.
        Update-ResumoKmDeRedeAposImportacao
        return @{ status = 200; body = @{ ok = $true } }
    }

    # POST /api/importacao/resetar-tudo — "apagar tudo de uma vez" (pedido
    # do Mario: um botão só pra admin zerar todas as bases importadas de
    # uma vez pra poder recomeçar os testes do zero, sem editar arquivo na
    # mão). Só Administrador de verdade (Test-Administrador consulta
    # usuarios.json pelo id da sessão - nunca confiar em campo vindo do
    # front-end). NUNCA entram aqui: usuarios.json/permissoes.json (contas
    # e matriz de acesso) e feriados.json (calendário, não é base
    # importada) - só o que foi importado/gerado por uso do sistema.
    if ($Method -eq "POST" -and $Segments.Count -eq 1 -and $Segments[0] -eq "resetar-tudo") {
        if (-not (Test-Administrador -UsuarioId $Usuario.usuarioId)) {
            return @{ status = 403; body = @{ erro = "Só administradores podem apagar todas as bases." } }
        }
        try {
            $resultado = Invoke-ResetarTodasAsBases
        } catch {
            return @{ status = 500; body = @{ erro = "Erro ao apagar as bases: $($_.Exception.Message)" } }
        }
        return @{ status = 200; body = $resultado }
    }

    return @{ status = 404; body = @{ erro = "Rota não encontrada em /api/importacao." } }
}

function Invoke-ResetarTodasAsBases {
    <# Zera todas as entidades "importadas/geradas pelo uso" em model/*.json
       (volta cada uma pra lista vazia) e limpa a pasta geo/ (camadas de
       rede/Reserva Legal/APP), devolvendo um resumo do que foi apagado.
       Ver comentário da rota acima pra lista do que NUNCA é tocado aqui. #>
    # "logistica_vinculos" fica de fora desta lista de propósito: ao
    # contrário de TODAS as outras entidades aqui (que são listas simples),
    # model/logistica_vinculos.json é um OBJETO ({ vinculos: {...},
    # estatisticas: {...} } - ver GET /api/logistica/vinculos) - zerar ele
    # com uma lista vazia "@()" quebrava essa rota (e a tela que depende
    # dela) depois do reset, porque ela devolve o conteúdo do arquivo direto,
    # sem embrulhar num "@(...)" como as outras rotas de /logistica/*. Tratado
    # à parte, logo abaixo, com o formato de objeto vazio correto.
    $entidades = @(
        "equipes", "vao", "protecao", "vera", "prefeituras", "metas",
        "localidades", "conjuntos",
        "manutencao_os", "programacao", "justificativas", "indisponibilidades",
        "logistica_equipes", "logistica_os", "logistica_programacoes",
        "importacoes_log", "protecao_alim", "alimentador_polo", "exclusoes"
    )
    foreach ($entidade in $entidades) {
        Write-JsonModel -Entity $entidade -Data @()
    }
    # v3.23.0 - linhas da MO (arquivos próprios, formato objeto): remove junto com as demais bases
    foreach ($arqMo in @("mo_linhas_executada", "mo_linhas_pendente")) {
        $pMo = Get-EntityPath -Entity $arqMo
        if (Test-Path $pMo) { Remove-Item $pMo -Force }
    }
    Write-JsonModel -Entity "logistica_vinculos" -Data @{ vinculos = @{}; estatisticas = @{} }

    $geoRoot = Join-Path $PSScriptRoot "..\..\geo"

    # Camadas particionadas por alimentador (MT, BT, AT, Reserva Legal, APP)
    # — apaga todo arquivo dentro da pasta, inclusive o "_index.json" (some
    # junto; Read-IndiceAlimentadores já trata pasta/índice ausente como
    # "vazio"). BT e AT entraram aqui na v2.11.3, quando passaram a ser
    # particionadas por alimentador igual à MT (ver Get-CamadaConfig em
    # ShapefileImporter.ps1) — antes disso eram um arquivo único, zerado à
    # parte com um FeatureCollection vazio; esse caminho não existe mais.
    $pastasLimpas = @()
    foreach ($camada in @("rede_media_tensao", "rede_baixa_tensao", "rede_alta_tensao", "reserva_legal", "app")) {
        $config = Get-CamadaConfig -Camada $camada -GeoRoot $geoRoot
        if (Test-Path $config.Pasta) {
            Get-ChildItem -Path $config.Pasta -File | Remove-Item -Force
            $pastasLimpas += $camada
        }
    }

    # Apaga também o arquivo único antigo de BT/AT, se ainda sobrar algum
    # (de uma base que nunca chegou a reabrir o Controller depois da
    # atualização pra v2.11.3 migrar sozinho — ver
    # Invoke-MigrarCamadaArquivoUnicoParaParticionada em server.ps1). Sem
    # isso, "Apagar tudo" deixaria um arquivo de 100MB+ órfão pra trás.
    foreach ($arquivoAntigo in @("rede_bt.geojson", "rede_at.geojson")) {
        $caminho = Join-Path $geoRoot $arquivoAntigo
        if (Test-Path $caminho) { Remove-Item $caminho -Force }
    }

    # v2.11.3 — o resumo de Km de rede (Visão Geral) é cacheado em memória
    # (ver Get-ResumoKmDeRede/Clear-KmRedeResumoCache em manutencao.ps1);
    # sem isso, depois de "Apagar tudo" a Visão Geral continuaria mostrando
    # os números antigos até o Controller ser reiniciado. v2.12.0: além de
    # esquecer o cache, já regrava geo/_resumo_km_rede.json (zerado) agora.
    Update-ResumoKmDeRedeAposImportacao

    return @{
        ok = $true
        basesZeradas = $entidades + @("logistica_vinculos")
        camadasZeradas = $pastasLimpas
        mensagem = "Todas as bases importadas e as camadas de rede foram apagadas. Usuários, permissões e feriados foram preservados."
    }
}

function Invoke-ImportacaoGenerica {
    <# Handler compartilhado: grava/atualiza registros no JSON da base pela
       chave única (sem duplicar - Escopo 7.2), registra o log de importação
       (quem, quando, quantos - Escopo 7.2) e devolve o resumo. $PosProcessar
       é um scriptblock opcional pra transformar a linha crua do Excel no
       formato final da entidade (usado por Metas, que calcula metaDiaria). #>
    param(
        [Parameter(Mandatory)][string]$Base,
        [Parameter(Mandatory)]$Body,
        [Parameter(Mandatory)]$Usuario,
        [Parameter(Mandatory)][string]$EntityFile,
        [Parameter(Mandatory)][string]$KeyField,
        [scriptblock]$PosProcessar
    )
    if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo $(Get-ModuloDaBase $Base) -Acao "importar")) {
        return @{ status = 403; body = @{ erro = "Sem permissão para importar $Base." } }
    }

    $rows = @($Body.linhas)
    try {
        $validacao = Test-ImportRows -Base $Base -Rows $rows
    } catch {
        return @{ status = 400; body = @{ erro = $_.Exception.Message } }
    }

    $existentes = @(Read-JsonModel -Entity $EntityFile)
    $porChave = @{}
    foreach ($item in $existentes) { $porChave[$item.$KeyField] = $item }

    foreach ($row in $validacao.validas) {
        $registro = if ($PosProcessar) { & $PosProcessar $row } else { $row }
        $porChave[$registro.$KeyField] = $registro
    }
    $resultadoFinal = @($porChave.Values)
    Write-JsonModel -Entity $EntityFile -Data $resultadoFinal

    $logEntry = @{
        id = New-EntityId
        base = $Base
        usuarioId = $Usuario.usuarioId
        dataHora = Get-IsoNow
        registrosProcessados = $validacao.validas.Count
        registrosComErro = $validacao.erros.Count
        arquivoOrigem = $Body.arquivoOrigem
    }
    $log = @(Read-JsonModel -Entity "importacoes_log") + $logEntry
    Write-JsonModel -Entity "importacoes_log" -Data $log

    # v2.11.3 — Proteção alimenta Get-MapaAlimentadorMunicipio (o cruzamento
    # alimentador -> município usado no "por cidade" do resumo de Km de
    # rede), então reimportá-la também invalida o cache. As outras bases
    # (Metas, Equipes, Vao, VERA, Prefeituras, Localidades) não entram no
    # cálculo do resumo — limpar o cache à toa pra elas só custaria um
    # recálculo sem necessidade, por isso fica restrito só à Protecao aqui.
    if ($Base -eq "Protecao") { Update-ResumoKmDeRedeAposImportacao }

    return @{ status = 200; body = @{
        processados = $validacao.validas.Count
        erros = $validacao.erros
        log = $logEntry
    } }
}

function Get-PosProcessarDaBase {
    <# Devolve o scriptblock de tradução Excel -> JSON para a tela genérica
       de Importação de Bases (Escopo 7.2). Espelha exatamente o que os
       endpoints dedicados de cada módulo já fazem (equipes.ps1, e o cálculo
       de metaDiaria em produtividade.ps1), para que os dois caminhos de
       importação (tela genérica e endpoint por módulo) gravem sempre igual. #>
    param([string]$Base, $Usuario)
    switch ($Base) {
        "Metas" {
            return {
                param($row)
                $feriados = @(Read-JsonModel -Entity "feriados")
                $equipeId = Get-CampoDoRow -Row $row -Campo "CodigoEquipe"
                $anoMes = Get-CampoDoRow -Row $row -Campo "AnoMes"
                $metaMensal = [double](Get-CampoDoRow -Row $row -Campo "MetaMensal")
                $diasUteis = Get-DiasUteisNoMes -AnoMes $anoMes -Feriados $feriados
                # reaproveita o id se já existir uma meta para essa equipe+mês,
                # pra atualizar em vez de duplicar (chave única, Escopo 7.2)
                $tipoMeta = ConvertTo-TipoMeta (Get-CampoDoRow -Row $row -Campo "Servico")
                $existente = @(Read-JsonModel -Entity "metas") | Where-Object { $_.equipeId -eq $equipeId -and $_.anoMes -eq $anoMes -and ((ConvertTo-TipoMeta $_.tipo) -eq $tipoMeta) } | Select-Object -First 1
                return @{
                    id = if ($existente) { $existente.id } else { New-EntityId }
                    equipeId = $equipeId
                    tipo = $tipoMeta
                    anoMes = $anoMes
                    metaMensal = $metaMensal
                    diasUteis = $diasUteis
                    metaDiaria = if ($diasUteis -gt 0) { [math]::Round($metaMensal / $diasUteis, 2) } else { 0 }
                    origem = "Importado"
                    atualizadoPor = $Usuario.nome
                    atualizadoEm = Get-IsoNow
                }
            }
        }
        "Equipes" {
            return {
                param($row)
                $podaTexto = "$(Get-CampoDoRow -Row $row -Campo 'EquipePoda')".ToLower()
                return @{
                    id = Get-CampoDoRow -Row $row -Campo "CodigoEquipe"
                    nome = Get-CampoDoRow -Row $row -Campo "CodigoEquipe"
                    tipoEquipe = Get-CampoDoRow -Row $row -Campo "TipoEquipe"
                    polo = Get-CampoDoRow -Row $row -Campo "Polo"
                    regional = Get-CampoDoRow -Row $row -Campo "Regional"
                    departamento = Get-CampoDoRow -Row $row -Campo "Departamento"
                    proprioTerceiro = Get-CampoDoRow -Row $row -Campo "ProprioTerceiro"
                    equipePoda = ($podaTexto -eq "true" -or $podaTexto -eq "sim" -or $podaTexto -eq "1")
                    baseLat = $(try { [double](Get-CampoDoRow -Row $row -Campo "BaseLat") } catch { $null })
                    baseLng = $(try { [double](Get-CampoDoRow -Row $row -Campo "BaseLng") } catch { $null })
                    ativo = $true
                }
            }
        }
        "Vao" {
            return {
                param($row)
                return @{
                    protecaoId = Get-CampoDoRow -Row $row -Campo "Proteção"
                    polo = Get-CampoDoRow -Row $row -Campo "Polo"
                    regional = Get-CampoDoRow -Row $row -Campo "Regional"
                    postes = 1
                    rotaKm = $(try { [double](Get-CampoDoRow -Row $row -Campo "Rota (km)") } catch { 0 })
                }
            }
        }
        "Protecao" {
            return {
                param($row)
                return @{
                    protecaoId = Get-CampoDoRow -Row $row -Campo "ELEMENTO"
                    protElemento = Get-CampoDoRow -Row $row -Campo "PROT. ELEMENTO"
                    protecao2 = Get-CampoDoRow -Row $row -Campo "PROT. ELEMENTO 2"
                    alimentador = Get-CampoDoRow -Row $row -Campo "ALIMENTADOR"
                    zona = Get-CampoDoRow -Row $row -Campo "ZONA"
                    lat = $(try { [double](Get-CampoDoRow -Row $row -Campo "LAT") } catch { $null })
                    lng = $(try { [double](Get-CampoDoRow -Row $row -Campo "LONG") } catch { $null })
                    trecho = Get-CampoDoRow -Row $row -Campo "TRECHO"
                    trechoT4 = Get-CampoDoRow -Row $row -Campo "TRECHO COM T4"
                    planoEasyWork = Get-CampoDoRow -Row $row -Campo "PLANO EASY WORK"
                }
            }
        }
        "VERA" {
            return {
                param($row)
                # Lat/Lng na exportação real do VERA vêm com vírgula decimal
                # ("-22,158369") — ConvertTo-DoubleSeguro (Validacao.ps1) já
                # troca "," por "." e NUNCA lança exceção (usa TryParse por
                # baixo), diferente do [double]::Parse() direto que este
                # trecho usava antes — um Lat/Lng num formato inesperado (que
                # escapou da regex de validação, ex.: espaço colado) derrubava
                # o import inteiro das 141 mil árvores por causa de 1 linha
                # ruim. Agora essa linha específica só vira um erro isolado
                # (idVeraInvalida/latInvalida abaixo), sem derrubar as outras.
                # O nome da coluna também varia entre exportações ("Lat" ou
                # "Latitude") — Get-CampoDoRowComAlias tenta as duas.
                $latTexto = "$(Get-CampoDoRowComAlias -Row $row -Campos @('Lat','Latitude'))"
                $lngTexto = "$(Get-CampoDoRowComAlias -Row $row -Campos @('Lng','Longitude'))"
                $lat = ConvertTo-DoubleSeguro -Texto $latTexto
                $lng = ConvertTo-DoubleSeguro -Texto $lngTexto
                if ($null -eq $lat -or $null -eq $lng) {
                    throw "Lat/Lng fora do formato esperado (Lat='$latTexto', Lng='$lngTexto')."
                }
                return @{
                    idVera = Get-CampoDoRow -Row $row -Campo "ID árvore"
                    alimentador = Get-CampoDoRow -Row $row -Campo "Alimentadores"
                    lat = $lat
                    lng = $lng
                    especie = Get-CampoDoRow -Row $row -Campo "Espécie"
                    cidade = Get-CampoDoRow -Row $row -Campo "Cidade"
                }
            }
        }
        "Prefeituras" {
            return {
                param($row)
                return @{
                    municipio = Get-CampoDoRow -Row $row -Campo "Municipio"
                    contatoNome = Get-CampoDoRow -Row $row -Campo "ContatoNome"
                    email = Get-CampoDoRow -Row $row -Campo "Email"
                    telefone = Get-CampoDoRow -Row $row -Campo "Telefone"
                    ativo = $true
                }
            }
        }
        "PrioridadeEW" {
            return {
                param($row)
                $pri = Get-CampoDoRow -Row $row -Campo "Prioridade"
                $grp = Get-CampoDoRow -Row $row -Campo "Grupo Recurso"
                $ten = Get-CampoDoRow -Row $row -Campo "Tensão"
                $reg = Get-CampoDoRow -Row $row -Campo "Regional"
                $ch = Get-CampoDoRow -Row $row -Campo "Chave"
                if ([string]::IsNullOrWhiteSpace($ch)) { $ch = "$ten-$pri-$grp-$reg" }
                return @{
                    chave = $ch; tensao = $ten; prioridade = $pri; grupoRecurso = $grp
                    prioridadeEW = Get-CampoDoRow -Row $row -Campo "Prioridade EW"; regional = $reg
                }
            }
        }
        "Esquemas" {
            return {
                param($row)
                $cod = "$(Get-CampoDoRowComAlias -Row $row -Campos @('CODIGO','Código','CÓDIGO','Codigo'))".Trim()
                $desc = "$(Get-CampoDoRowComAlias -Row $row -Campos @('DESCRICAO ESQUEMA','DESCRIÇÃO ESQUEMA','Descrição Esquema','Descricao Esquema','DescEsquema'))".Trim()
                $tipo = "$(Get-CampoDoRowComAlias -Row $row -Campos @('TIPO','Tipo'))".Trim()
                return @{ codigo = $cod; descricao = $desc; tipo = $tipo }
            }
        }
        "Conjuntos" {
            return {
                param($row)
                $alim = "$(Get-CampoPorCabecalho -Row $row -Nomes @('alimentador'))".Trim().ToUpper()
                $nome = "$(Get-CampoPorCabecalho -Row $row -Nomes @('nomeconjunto','nomedoconjunto','conjuntonome'))".Trim()
                $cod  = "$(Get-CampoPorCabecalho -Row $row -Nomes @('conjunto','codconjunto','codigoconjunto','codigodoconjunto','cdconjunto'))".Trim()
                $reg  = "$(Get-CampoPorCabecalho -Row $row -Nomes @('regional'))".Trim()
                $sig  = "$(Get-CampoPorCabecalho -Row $row -Nomes @('sigla'))".Trim()
                # duas colunas de tensao na planilha: a 1a (numerica, ex. 13,8) e a 2a (faixa, ex. 11,4/13,8)
                $tl = @(Get-CampoPorCabecalho -Row $row -ListaPrefixo 'tens')
                $tnom = ''; $tens = ''
                if ($tl.Count -ge 2) { $tnom = "$($tl[0])".Trim(); $tens = "$($tl[1])".Trim() }
                elseif ($tl.Count -eq 1) { $tens = "$($tl[0])".Trim() }
                return @{ alimentador = $alim; codConjunto = $cod; nomeConjunto = $nome; regional = $reg; sigla = $sig; tensaoNominal = $tnom; tensao = $tens }
            }
        }
        "Localidades" {
            return {
                param($row)
                return @{
                    codLocalidade = Get-CampoDoRow -Row $row -Campo "COD LOCALIDADE"
                    polo = Get-CampoDoRow -Row $row -Campo "POLO"
                    localidade = Get-CampoDoRow -Row $row -Campo "LOCALIDADE"
                    postoOperacional = Get-CampoDoRow -Row $row -Campo "POSTO OPERACIONAL"
                    polo2 = Get-CampoDoRow -Row $row -Campo "POLO2"
                    regional = Get-CampoDoRow -Row $row -Campo "REGIONAL"
                    coordenadorResponsavel = Get-CampoDoRow -Row $row -Campo "COORDENADOR RESPONSÁVEL"
                    supervisorResponsavel = Get-CampoDoRow -Row $row -Campo "SUPERVISOR RESPONSÁVEL"
                    pontoFocalResponsavel = Get-CampoDoRow -Row $row -Campo "PONTO FOCAL RESPONSÁVEL"
                    codLocalidade2 = Get-CampoDoRow -Row $row -Campo "COD LOCALIDADE2"
                }
            }
        }
        default { return $null }
    }
}

function Get-ModuloDaBase {
    param([string]$Base)
    switch ($Base) {
        "Metas"       { return "metas" }
        "Prefeituras" { return "prefeituras" }
        default       { return "manutencao" }
    }
}

function Invoke-ShapefileStreamingUpload {
    <# POST /api/importacao/shapefile — upload direto pela tela (multipart/
       form-data: arquivo(s) .shp+.dbf+.prj soltos, ou um .zip com eles, mais
       o campo "camada"). Reaproveita o mesmo leitor testado contra os
       427.910 registros do SSDMT (controller/lib/ShapefileImporter.ps1) — o
       mesmo que o script de linha de comando usa.

       Segue o mesmo formato NDJSON/streaming que Invoke-PodasStreamingUpload
       (logo abaixo) já usa pro Podas: uma linha JSON de progresso por
       atualização, terminando com uma linha final {tipo:'final', ...} ou
       {tipo:'erro', ...} — necessário pelo mesmo motivo (Controller
       single-threaded, sem como "perguntar" o progresso numa rota
       separada enquanto o upload grande está rodando).

       Recebe $Request (não $Body já processado): o corpo multipart só é
       lido/parseado AQUI DENTRO, depois que a resposta já está em modo
       chunked e o primeiro aviso de progresso já foi mandado — ver o
       comentário sobre -ProgressCallback em Get-MultipartFormData
       (server.ps1) pro motivo (evita ficar em silêncio durante o
       recebimento de um upload grande). #>
    param($Response, $Request, $Usuario)

    $Response.StatusCode = 200
    $Response.ContentType = "application/x-ndjson; charset=utf-8"
    $Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    $Response.SendChunked = $true

    $streamWriter = New-Object System.IO.StreamWriter($Response.OutputStream, (New-Object System.Text.UTF8Encoding($false)))
    $streamWriter.AutoFlush = $true

    # GetNewClosure() pelo mesmo motivo do Podas: este scriptblock é
    # repassado pra dentro de Import-ShapefileUpload/Rede/Read-ShpBuffer/
    # Read-DbfBuffer (outro arquivo, dot-sourced separadamente) e invocado lá
    # de dentro via "& $callback" — sem isso $streamWriter não resolveria.
    $enviarLinha = {
        param($Dados)
        try {
            $json = $Dados | ConvertTo-Json -Depth 6 -Compress
            $streamWriter.Write($json + "`n")
        } catch { }
    }.GetNewClosure()

    # v2.13.3 - cronometro por fase: mostra no prompt quanto tempo cada etapa
    # da importacao levou (recebendo, lendo, validando, cruzando, gravando).
    $cron = New-CronometroImportacao
    $progressoCallback = {
        param($p)
        try { Write-FaseImportacao -Cron $cron -P $p } catch { }
        & $enviarLinha (@{ tipo = 'progresso' } + $p)
    }.GetNewClosure()

    try {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "importar")) {
            & $enviarLinha @{ tipo = 'erro'; mensagem = 'Sem permissão para importar camadas de rede.' }
            return
        }

        # Get-MultipartFormData está definida em server.ps1 (dot-sourced no
        # mesmo processo) - lê o corpo aos poucos, avisando o progresso do
        # recebimento pelo mesmo $progressoCallback usado pro resto do
        # import, então o cliente nunca fica sem notícia nenhuma.
        $multipart = Get-MultipartFormData -Request $Request -ProgressCallback $progressoCallback
        $camada = $multipart.Fields['camada']
        $baseNome = $multipart.Fields['base']
        # sem @() aqui: envolver uma List<object> que carrega um Hashtable com
        # um byte[] dentro faz o PowerShell falhar com "Argument types do not
        # match" nesta versão — a List já é enumerável, não precisa do wrap.
        $arquivos = $multipart.Files
        if (-not $camada) {
            & $enviarLinha @{ tipo = 'erro'; mensagem = 'Faltou informar a camada (rede_media_tensao, rede_baixa_tensao, rede_alta_tensao, reserva_legal ou app).' }
            return
        }
        if ($arquivos.Count -eq 0) {
            & $enviarLinha @{ tipo = 'erro'; mensagem = 'Nenhum arquivo recebido. Envie o .shp + .dbf (e .prj) — ou, para Reserva Legal/APP, um ou mais .kmz.' }
            return
        }

        $geoRoot = Join-Path $PSScriptRoot "..\..\geo"
        # reserva_legal/app usam um leitor diferente (KmzImporter.ps1 em vez
        # de ShapefileImporter.ps1) — um .kmz por alimentador, não .shp/.dbf
        # — mas seguem o MESMO streaming/NDJSON e a mesma gravação
        # particionada por alimentador (Get-CamadaConfig), então reaproveita
        # esta rota inteira em vez de duplicar o endpoint.
        $camadasPoligono = @("reserva_legal", "app")
        try {
            if ($camada -eq "postes") {
                # v2.14.3 - PONNOT (pontos): grava model/postes.tsv e reaplica a posicao nas OS
                $rp = Import-PostesUpload -Arquivos $arquivos -ProgressCallback $progressoCallback
                $aplic = Invoke-AplicarPosicaoPostesVera -ProgressCallback $progressoCallback
                Write-JsonModel -Entity "postes_meta" -Data @(@{
                    total = $rp.total; porTipo = $rp.porTipo; semGeometria = $rp.semGeometria
                    atualizadoEm = (Get-IsoNow); atualizadoPor = $Usuario.usuarioId
                    arquivo = (($arquivos | ForEach-Object { $_.FileName }) -join ", ")
                })
                $resultado = @{ trechos = $rp.total; rejeitados = $rp.semGeometria; alimentadores = 0; errosDetalhe = $null; avisoProjecao = $null; particionado = $false; postes = $rp; aplicadoNasOS = $aplic }
            } elseif ($camada -eq "equipamentos") {
                # v2.15.0 - UNTRMT/UNSEMT/UNREMT/UNCRMT (.dbf): acha o poste de cada equipamento pelo PAC
                $re = Import-EquipUpload -Arquivos $arquivos -ProgressCallback $progressoCallback
                $meta = @(@(Read-JsonModel -Entity "equip_meta") | Where-Object { $re.camadas.camada -notcontains $_.camada })
                $novos = foreach ($c in $re.camadas) {
                    @{ camada = $c.camada; total = $c.total; comPoste = $c.comPoste; semPoste = $c.semPoste; semPosicao = $c.semPosicao
                       porTipo = $c.porTipo; arquivo = $c.arquivo; atualizadoEm = (Get-IsoNow); atualizadoPor = $Usuario.usuarioId }
                }
                Write-JsonModel -Entity "equip_meta" -Data @($meta + @($novos))
                $tot = 0; $rej = 0
                foreach ($c in $re.camadas) { $tot += $c.total; $rej += $c.semPosicao }
                foreach ($nn in @($re.nomes)) { $tot += $nn.lidos; $rej += $nn.semChave }
                $resultado = @{ trechos = $tot; rejeitados = $rej; alimentadores = 0; errosDetalhe = $null; avisoProjecao = $null; particionado = $false; equipamentos = $re }
            } elseif ($camadasPoligono -contains $camada) {
                $resultado = Import-KmzUpload -Arquivos $arquivos -Camada $camada -GeoRoot $geoRoot -ProgressCallback $progressoCallback
            } else {
                $resultado = Import-ShapefileUpload -Arquivos $arquivos -Camada $camada -GeoRoot $geoRoot -ProgressCallback $progressoCallback
            }
        } catch {
            Write-ErroImportacao -Etapa "importar a camada ($camada)" -Erro $_
            & $enviarLinha @{ tipo = 'erro'; mensagem = $_.Exception.Message }
            return
        }

        $logEntry = @{
            id = New-EntityId
            base = $(if ($baseNome) { $baseNome } else { $camada })
            usuarioId = $Usuario.usuarioId
            dataHora = Get-IsoNow
            registrosProcessados = $resultado.trechos
            registrosComErro = $resultado.rejeitados
            arquivoOrigem = (($arquivos | ForEach-Object { $_.FileName }) -join ", ")
        }
        $log = @(Read-JsonModel -Entity "importacoes_log") + $logEntry
        Write-JsonModel -Entity "importacoes_log" -Data $log

        # v2.11.3 — qualquer import de camada de rede muda o resumo de Km
        # (Visão Geral); limpa o cache pra recalcular na próxima visita (ver
        # Clear-KmRedeResumoCache em manutencao.ps1). v2.12.0: o resumo
        # também é REGRAVADO em disco aqui, no próprio upload (somando os
        # _index.json - rápido), pra Visão Geral nunca precisar recalcular.
        & $enviarLinha @{ tipo = 'progresso'; fase = 'resumo-km'; percentual = 99 }
        Update-ResumoKmDeRedeAposImportacao

        & $enviarLinha @{
            tipo = 'final'
            camada = $camada
            alimentadores = $resultado.alimentadores
            trechos = $resultado.trechos
            rejeitados = $resultado.rejeitados
            # só o KmzImporter preenche isso (um motivo por arquivo
            # rejeitado) — nos shapefiles fica vazio/ausente, sem problema.
            errosDetalhe = $resultado.errosDetalhe
            avisoProjecao = $resultado.avisoProjecao
            particionado = $resultado.particionado
            postes = $resultado.postes
            equipamentos = $resultado.equipamentos
            aplicadoNasOS = $resultado.aplicadoNasOS
            log = $logEntry
        }
    } catch {
        Write-ErroImportacao -Etapa "concluir a importacao da camada" -Erro $_
        try { & $enviarLinha @{ tipo = 'erro'; mensagem = $_.Exception.Message } } catch { }
    } finally {
        try { $streamWriter.Flush() } catch { }
        try { $streamWriter.Close() } catch { }
        try { $Response.OutputStream.Close() } catch { }
    }
}

function Invoke-PodasStreamingUpload {
    <# POST /api/importacao/podas-executado — GRID_EXECUTADO + MO_EXECUTADA
       POST /api/importacao/podas-pendente  — GRID_PENDENTE + MO_PENDENTE
       Separados (antes eram as 4 planilhas de uma vez só): o GRID_EXECUTADO
       é um arquivo bem maior (~60MB/178 mil linhas) que o GRID_PENDENTE, e
       forçar quem só queria atualizar as pendentes a esperar o executado
       inteiro ler de novo deixava a tela pesada à toa (ver PodasImporter.ps1
       pra como cada import mescla com o que já estava gravado, sem apagar o
       outro lote).

       Chamada direto pelo server.ps1 (não passa pelo Invoke-ImportacaoRoute
       genérico) porque precisa do objeto $Response bruto: em vez do padrão
       "monta o corpo inteiro e devolve @{status;body}", esta função escreve
       a resposta HTTP EM PARTES (chunked) conforme o import avança — uma
       linha JSON por atualização de progresso, terminando com uma linha
       final {"tipo":"final", resumo, log}. Isso existe porque o Controller
       atende um pedido HTTP por vez (loop single-threaded): uma rota
       separada de "consultar progresso" nunca seria atendida enquanto este
       POST (que pode levar minutos) estivesse rodando — a resposta tem que
       ir pela MESMA conexão, aos poucos, pra a barra de progresso da tela
       funcionar de verdade.

       Recebe $Request (não $Body já processado) pelo mesmo motivo descrito
       em Invoke-ShapefileStreamingUpload acima: o corpo multipart (até uns
       60MB no GRID_EXECUTADO real) só é lido depois que a resposta já está
       em modo chunked, com progresso mandado durante o próprio
       recebimento. #>
    param($Response, [string]$Segmento, $Request, $Usuario)

    $Response.StatusCode = 200
    $Response.ContentType = "application/x-ndjson; charset=utf-8"
    $Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    $Response.SendChunked = $true

    $streamWriter = New-Object System.IO.StreamWriter($Response.OutputStream, (New-Object System.Text.UTF8Encoding($false)))
    $streamWriter.AutoFlush = $true

    # .GetNewClosure() é essencial aqui: este scriptblock é repassado pra
    # dentro de Import-PodasExecutado/Pendente e de Read-XlsxColunas (outras
    # funções, dot-sourced separadamente) e invocado lá de dentro via
    # "& $callback". Sem GetNewClosure(), a resolução de $streamWriter
    # dentro do scriptblock dependeria do escopo de QUEM chama (escopo
    # dinâmico do PowerShell), não de onde o scriptblock foi definido — e
    # $streamWriter não existe no escopo de Read-XlsxColunas. GetNewClosure()
    # "empacota" a variável junto com o scriptblock, então funciona não
    # importa de onde seja invocado.
    $enviarLinha = {
        param($Dados)
        try {
            $json = $Dados | ConvertTo-Json -Depth 6 -Compress
            $streamWriter.Write($json + "`n")
        } catch { }
    }.GetNewClosure()

    # v2.13.3 - cronometro por fase: mostra no prompt quanto tempo cada etapa
    # da importacao levou (recebendo, lendo, validando, cruzando, gravando).
    $cron = New-CronometroImportacao
    $progressoCallback = {
        param($p)
        try { Write-FaseImportacao -Cron $cron -P $p } catch { }
        & $enviarLinha (@{ tipo = 'progresso' } + $p)
    }.GetNewClosure()

    try {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo "manutencao" -Acao "importar")) {
            & $enviarLinha @{ tipo = 'erro'; mensagem = 'Sem permissão para importar a base de podas.' }
            return
        }

        # Get-MultipartFormData está definida em server.ps1 (dot-sourced no
        # mesmo processo) - lê o corpo aos poucos, avisando o progresso do
        # recebimento pelo mesmo $progressoCallback usado pro resto do
        # import (leitura do Excel, cruzamento, gravação), então o cliente
        # nunca fica sem notícia nenhuma do começo ao fim.
        $multipart = Get-MultipartFormData -Request $Request -ProgressCallback $progressoCallback
        $arquivos = $multipart.Files
        function Get-BytesPorNomeStream([string]$Nome) {
            $achado = $arquivos | Where-Object { $_.Name -eq $Nome } | Select-Object -First 1
            return $achado.Bytes
        }

        if ($Segmento -eq "podas-sigod") {
            # SIGOD (podas de oportunidade/plantão, vindas de reclamação de
            # cliente): UMA planilha só (basePoda...xlsx), sem cruzamento com
            # MO - ver Import-PodasSigod em PodasImporter.ps1.
            $baseBytes = Get-BytesPorNomeStream 'basePoda'
            if (-not $baseBytes) {
                & $enviarLinha @{ tipo = 'erro'; mensagem = "Faltou o arquivo da base SIGOD (basePoda...xlsx). Envie a planilha com a aba 'Base Poda'." }
                return
            }
            try {
                $resumo = Import-PodasSigod -BasePodaBytes $baseBytes -ProgressCallback $progressoCallback
            } catch {
                & $enviarLinha @{ tipo = 'erro'; mensagem = "Erro ao processar a planilha SIGOD: $($_.Exception.Message)" }
                return
            }
            $baseLog = "Podas — SIGOD (OS)"
            $errosLog = $resumo.sigodSemCoordenada + $resumo.sigodSemNumeroOS
        } elseif ($Segmento -eq "podas-sigod-pendente") {
            $pendBytes = Get-BytesPorNomeStream 'sigodPendente'
            if (-not $pendBytes) {
                & $enviarLinha @{ tipo = 'erro'; mensagem = "Faltou o arquivo dos pendentes do SIGOD (pendentes_sigod...xlsx)." }
                return
            }
            try {
                $resumo = Import-PodasSigodPendente -BasePendenteBytes $pendBytes -ProgressCallback $progressoCallback
            } catch {
                & $enviarLinha @{ tipo = 'erro'; mensagem = "Erro ao processar a planilha de pendentes do SIGOD: $($_.Exception.Message)" }
                return
            }
            $baseLog = "Podas — SIGOD pendentes"
            $errosLog = $resumo.sigodPendSemNumeroOS + $resumo.sigodPendSemPosicao
        } elseif ($Segmento -eq "podas-historico") {
            # v3.11.0 - HISTORICO por PLANO (01/nov do ano anterior a 31/out): mesmo cruzamento
            # SGM + MO do Executado, mas grava num arquivo do plano (PodasHistorico.ps1) e nao
            # mexe na base de hoje, nos alertas, no rank nem nas programacoes.
            $planoNum = 0
            if (-not [int]::TryParse(("$($multipart.Fields['plano'])").Trim(), [ref]$planoNum) -or $planoNum -lt 2000 -or $planoNum -gt 2100) {
                & $enviarLinha @{ tipo = 'erro'; mensagem = "Informe o plano (ex.: 2026 = 01/11/2025 a 31/10/2026)." }
                return
            }
            $modoTxt = ("$($multipart.Fields['modo'])").Trim().ToLower()
            if ($modoTxt -ne 'acrescentar') { $modoTxt = 'substituir' }
            $gridBytes = Get-BytesPorNomeStream 'gridExecutado'
            $moBytes   = Get-BytesPorNomeStream 'moExecutada'
            $moPendenteBytesOpc = Get-BytesPorNomeStream 'moPendente'
            $faltando = @()
            if (-not $gridBytes) { $faltando += "SGM_EXECUTADO" }
            if (-not $moBytes)   { $faltando += "MO_EXECUTADA" }
            if ($faltando.Count -gt 0) {
                & $enviarLinha @{ tipo = 'erro'; mensagem = "Faltou o arquivo: $($faltando -join ', '). Envie os 2 juntos (e, se puder, a MO_PENDENTE também — sem ela o Previsto não é calculado)." }
                return
            }
            $nomesArq = (($arquivos | ForEach-Object { $_.FileName }) -join ", ")
            try {
                $resumo = Import-PodasExecutado -GridExecutadoBytes $gridBytes -MoExecutadaBytes $moBytes -MoPendenteBytes $moPendenteBytesOpc -ProgressCallback $progressoCallback -Plano $planoNum -ModoHistorico $modoTxt -UsuarioId $Usuario.usuarioId -ArquivosNomes $nomesArq
            } catch {
                & $enviarLinha @{ tipo = 'erro'; mensagem = "Erro ao processar as planilhas: $($_.Exception.Message)" }
                return
            }
            $baseLog = "Podas — Histórico (plano $planoNum, $modoTxt)"
            $errosLog = $resumo.historicoSemData + $resumo.historicoForaDoPlano + $resumo.executadoSemMO + $resumo.executadoSemCoordenada
        } elseif ($Segmento -eq "podas-executado") {
            $gridBytes = Get-BytesPorNomeStream 'gridExecutado'
            $moBytes   = Get-BytesPorNomeStream 'moExecutada'
            # moPendente é OPCIONAL neste segmento: só é usada pra calcular o
            # "Previsto" de cada OS executada (o Previsto mora na OS-mãe/
            # OSPrimária, apontada na MO_PENDENTE — ver PodasImporter.ps1).
            # Sem ela a importação segue normal, só Previsto fica zerado.
            $moPendenteBytesOpc = Get-BytesPorNomeStream 'moPendente'
            $faltando = @()
            if (-not $gridBytes) { $faltando += "SGM_EXECUTADO" }
            if (-not $moBytes)   { $faltando += "MO_EXECUTADA" }
            if ($faltando.Count -gt 0) {
                & $enviarLinha @{ tipo = 'erro'; mensagem = "Faltou o arquivo: $($faltando -join ', '). Envie os 2 juntos (e, se puder, a MO_PENDENTE também — sem ela o Previsto não é calculado)." }
                return
            }
            try {
                $resumo = Import-PodasExecutado -GridExecutadoBytes $gridBytes -MoExecutadaBytes $moBytes -MoPendenteBytes $moPendenteBytesOpc -ProgressCallback $progressoCallback
            } catch {
                & $enviarLinha @{ tipo = 'erro'; mensagem = "Erro ao processar as planilhas: $($_.Exception.Message)" }
                return
            }
            $baseLog = "Podas — Executado (OS)"
            $errosLog = $resumo.executadoSemMO + $resumo.executadoSemCoordenada
        } else {
            $gridBytes = Get-BytesPorNomeStream 'gridPendente'
            $moBytes   = Get-BytesPorNomeStream 'moPendente'
            # moExecutada é OPCIONAL neste segmento — só enriquece o
            # "Realizado" de OS pendentes que já tenham algum apontamento de
            # execução parcial (ver PodasImporter.ps1).
            $moExecutadaBytesOpc = Get-BytesPorNomeStream 'moExecutada'
            $faltando = @()
            if (-not $gridBytes) { $faltando += "SGM_PENDENTE" }
            if (-not $moBytes)   { $faltando += "MO_PENDENTE" }
            if ($faltando.Count -gt 0) {
                & $enviarLinha @{ tipo = 'erro'; mensagem = "Faltou o arquivo: $($faltando -join ', '). Envie os 2 juntos." }
                return
            }
            try {
                $resumo = Import-PodasPendente -GridPendenteBytes $gridBytes -MoPendenteBytes $moBytes -MoExecutadaBytes $moExecutadaBytesOpc -ProgressCallback $progressoCallback
            } catch {
                & $enviarLinha @{ tipo = 'erro'; mensagem = "Erro ao processar as planilhas: $($_.Exception.Message)" }
                return
            }
            $baseLog = "Podas — Pendente (OS)"
            $errosLog = $resumo.pendenteSemMO + $resumo.pendenteSemCoordenada
        }

        $logEntry = @{
            id = New-EntityId
            base = $baseLog
            usuarioId = $Usuario.usuarioId
            dataHora = Get-IsoNow
            registrosProcessados = $resumo.totalPlotadas
            registrosComErro = $errosLog
            arquivoOrigem = (($arquivos | ForEach-Object { $_.FileName }) -join ", ")
        }
        $log = @(Read-JsonModel -Entity "importacoes_log") + $logEntry
        Write-JsonModel -Entity "importacoes_log" -Data $log

        & $enviarLinha @{ tipo = 'final'; resumo = $resumo; log = $logEntry }
    } catch {
        try { & $enviarLinha @{ tipo = 'erro'; mensagem = $_.Exception.Message } } catch { }
    } finally {
        try { $streamWriter.Flush() } catch { }
        try { $streamWriter.Close() } catch { }
        try { $Response.OutputStream.Close() } catch { }
    }
}

function Invoke-BaseGrandeStreamingUpload {
    <# POST /api/importacao/vao e /api/importacao/protecao - upload direto do
       .xlsx cru (v2.13.0). Mesmo padrao da VERA/shapefile/podas (multipart +
       Read-XlsxColunas + resposta NDJSON de progresso), pelos mesmos motivos:
       o Vao real (d.Vao.xlsx) tem ~793 mil linhas e a Protecao
       (d.Protecao.xlsx) ~214 mil - o caminho generico (navegador le com
       XLSX.js e manda um JSON gigante) nao aguenta.

       Diferenca: as linhas NAO ficam todas em memoria. Cada linha lida e
       entregue a um callback (Read-XlsxColunas -LinhaCallback) que agrega:
         - Vao: 1 registro por PROTECAO (soma de postes e de Rota km, com
           Polo/Regional) - ~57 mil registros em vez de 793 mil.
         - Protecao: 1 registro por ELEMENTO (o arquivo repete cada elemento
           em 2+ linhas, uma completa e as demais so com alimentador - as
           linhas sao fundidas campo a campo) - ~109 mil registros.
       Ao final recalcula alimentador -> polo/regional (Update-MapaAlimentadorPolo,
       Geografia.ps1), que e o cruzamento que alimenta os filtros Polo/Regional
       do Mapa de Manutencao. A importacao SUBSTITUI a base inteira (e um dump
       completo) - registros "excluidos" (flag) continuam marcados por chave. #>
    param($Response, $Request, $Usuario, [string]$Base)

    $Response.StatusCode = 200
    $Response.ContentType = "application/x-ndjson; charset=utf-8"
    $Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    $Response.SendChunked = $true

    $streamWriter = New-Object System.IO.StreamWriter($Response.OutputStream, (New-Object System.Text.UTF8Encoding($false)))
    $streamWriter.AutoFlush = $true
    $enviarLinha = {
        param($Dados)
        try { $streamWriter.Write(($Dados | ConvertTo-Json -Depth 6 -Compress) + "`n") } catch { }
    }.GetNewClosure()
    # v2.13.3 - cronometro por fase: mostra no prompt quanto tempo cada etapa
    # da importacao levou (recebendo, lendo, validando, cruzando, gravando).
    $cron = New-CronometroImportacao
    $progressoCallback = {
        param($p)
        try { Write-FaseImportacao -Cron $cron -P $p } catch { }
        & $enviarLinha (@{ tipo = 'progresso' } + $p)
    }.GetNewClosure()

    $etapaAtual = "iniciando"
    try {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo (Get-ModuloDaBase $Base) -Acao "importar")) {
            & $enviarLinha @{ tipo = 'erro'; mensagem = "Sem permissão para importar a base $Base." }
            return
        }
        $etapaAtual = "recebendo o upload"
        $multipart = Get-MultipartFormData -Request $Request -ProgressCallback $progressoCallback
        if ($multipart.Files.Count -eq 0) {
            & $enviarLinha @{ tipo = 'erro'; mensagem = "Nenhum arquivo recebido. Envie o .xlsx da base $Base." }
            return
        }
        $arquivo = $multipart.Files[0]

        $schema = Get-ImportSchema -Base $Base
        $colunasPedidas = @($schema | ForEach-Object { $_.coluna })
        $obrigatorias = @($schema | Where-Object { $_.obrigatorio } | ForEach-Object { $_.coluna })

        # Contadores/agregados em hashtables (tipo referencia) pra o callback
        # (invocado dentro de Read-XlsxColunas) conseguir atualiza-los.
        $agg = @{}
        $pares = @{}
        $postesKm = [ordered]@{}   # v2.15.4 - poste -> Rota (km), so no caminho lento do Vao
        $c = @{ lidas = 0; semChave = 0; coordInvalida = 0 }

        $limpar = {
            param($v)
            $t = "$v".Trim()
            if ($t -eq "" -or $t -eq "#N/A" -or $t -eq "Sem") { return $null }
            return $t
        }

        if ($Base -eq "Vao") {
            $linhaCallback = {
                param($r)
                $c.lidas++
                $prot = & $limpar $r["Proteção"]
                $poste = & $limpar $r["Poste 1"]
                if ($poste) {
                    $pk = "$poste".Trim()
                    if ($pk.EndsWith(".0")) { $pk = $pk.Substring(0, $pk.Length - 2) }
                    if ($pk.StartsWith("218-")) { $pk = $pk.Substring(4) }
                    if ($pk -ne "" -and $pk -ne "0" -and -not $postesKm.Contains($pk)) {
                        $kmP = ConvertTo-DoubleSeguro -Texto "$($r['Rota (km)'])"
                        if ($null -ne $kmP) { $postesKm[$pk] = $kmP }
                    }
                }
                if (-not $prot -or -not $poste) { $c.semChave++; return }
                if (-not $agg.ContainsKey($prot)) {
                    $agg[$prot] = @{ protecaoId = $prot; regional = $null; polo = $null; postes = 0; rotaKm = 0.0 }
                }
                $a = $agg[$prot]
                $a.postes = $a.postes + 1
                $km = ConvertTo-DoubleSeguro -Texto "$($r['Rota (km)'])"
                if ($null -ne $km) { $a.rotaKm = $a.rotaKm + $km }
                if (-not $a.polo) { $a.polo = & $limpar $r["Polo"] }
                if (-not $a.regional) { $a.regional = & $limpar $r["Regional"] }
            }.GetNewClosure()
        } else {
            $linhaCallback = {
                param($r)
                $c.lidas++
                $id = & $limpar $r["ELEMENTO"]
                if (-not $id) { $c.semChave++; return }
                if (-not $agg.ContainsKey($id)) {
                    $agg[$id] = @{ protecaoId = $id; protElemento = $null; protecao2 = $null; alimentador = $null; zona = $null; lat = $null; lng = $null; trecho = $null; trechoT4 = $null; planoEasyWork = $null }
                }
                $a = $agg[$id]
                if (-not $a.protElemento) { $a.protElemento = & $limpar $r["PROT. ELEMENTO"] }
                if (-not $a.protecao2)    { $a.protecao2    = & $limpar $r["PROT. ELEMENTO 2"] }
                if (-not $a.alimentador)  { $a.alimentador  = & $limpar $r["ALIMENTADOR"] }
                if (-not $a.zona)         { $a.zona         = & $limpar $r["ZONA"] }
                if (-not $a.trecho)       { $a.trecho       = & $limpar $r["TRECHO"] }
                if (-not $a.trechoT4)     { $a.trechoT4     = & $limpar $r["TRECHO COM T4"] }
                if (-not $a.planoEasyWork){ $a.planoEasyWork = & $limpar $r["PLANO EASY WORK"] }
                if ($null -eq $a.lat) {
                    $la = ConvertTo-DoubleSeguro -Texto "$($r['LAT'])"
                    $lo = ConvertTo-DoubleSeguro -Texto "$($r['LONG'])"
                    if ($null -ne $la -and $null -ne $lo) {
                        if ($la -ge -90 -and $la -le 90 -and $lo -ge -180 -and $lo -le 180) { $a.lat = $la; $a.lng = $lo }
                        else { $c.coordInvalida++ }
                    }
                }
                $p2 = $a.protecao2; $al = $a.alimentador
                if ($p2 -and $al) { $pares["$p2|$al"] = @{ p = $p2; a = $al } }
            }.GetNewClosure()
        }

        $etapaAtual = "lendo a planilha"
        # v2.13.7 - Vao: leitura E agrupamento por protecao inteiros em C#
        # (Read-VaoAgregado). O callback em PowerShell (793 mil chamadas) fica so
        # como plano B, se o Add-Type nao estiver disponivel.
        $rapido = $null
        if ($Base -eq "Vao") {
            try {
                $rapido = Read-VaoAgregado -Bytes $arquivo.Bytes -Colunas $colunasPedidas -ProgressCallback $progressoCallback -ProgressLabel $arquivo.FileName -ProgressFase "lendo-vera" -ArquivoPostes (Join-Path $Script:ModelRoot "vao_postes.tsv")
            } catch {
                # Nao derruba a importacao: avisa no prompt (com a linha exata, pra
                # diagnostico) e segue pelo caminho antigo, mais lento.
                $rapido = $null
                Write-Host ("  [aviso] leitura rapida do Vao falhou - usando o caminho lento. " + $_.Exception.GetType().FullName + ": " + $_.Exception.Message) -ForegroundColor Yellow
                try { Write-Host ("  [aviso] " + $_.InvocationInfo.PositionMessage) -ForegroundColor Yellow } catch { }
                $c.lidas = 0; $c.semChave = 0; $agg.Clear()
            }
        }
        if ($rapido) {
            $etapaAtual = "montando o resultado da leitura rapida"
            $leitura = @{ colunasEncontradas = @($rapido.colunasEncontradas); totalLinhas = [int]$rapido.totalLinhas }
            $c.lidas = [int]$rapido.lidas
            $c.semChave = [int]$rapido.semChave
            $etapaAtual = "lendo a planilha"
        } else {
            try {
                $leitura = Read-XlsxColunas -Bytes $arquivo.Bytes -Colunas $colunasPedidas -ProgressCallback $progressoCallback -ProgressLabel $arquivo.FileName -ProgressFase "lendo-vera" -LinhaCallback $linhaCallback
            } catch {
                & $enviarLinha @{ tipo = 'erro'; mensagem = "Erro ao ler o arquivo: $($_.Exception.Message)" }
                return
            }
        }
        # v2.15.4 - caminho lento: grava poste -> Rota (km) (o rapido ja gravou em C#)
        if ($Base -eq "Vao" -and -not $rapido -and $postesKm.Count -gt 0) {
            try {
                $sb = New-Object System.Text.StringBuilder
                foreach ($k in $postesKm.Keys) {
                    [void]$sb.Append($k).Append("`t").Append(([double]$postesKm[$k]).ToString("R", [System.Globalization.CultureInfo]::InvariantCulture)).Append("`n")
                }
                [System.IO.File]::WriteAllText((Join-Path $Script:ModelRoot "vao_postes.tsv"), $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
            } catch { Write-Host ("  [aviso] nao consegui gravar vao_postes.tsv: " + $_.Exception.Message) -ForegroundColor Yellow }
        }
        # Cabecalho: se faltar coluna obrigatoria o arquivo e de outra base
        $faltando = @($obrigatorias | Where-Object { $leitura.colunasEncontradas -notcontains $_ })
        if ($faltando.Count -gt 0) {
            & $enviarLinha @{ tipo = 'erro'; mensagem = "O cabeçalho não bate com a base ${Base}: faltou a coluna $($faltando -join ', '). Colunas esperadas: $($colunasPedidas -join ' | ')." }
            return
        }
        $etapaAtual = "reunindo os registros lidos"
        if ($rapido) { $registros = @($rapido.itens.ToArray()) } else { $registros = @($agg.Values) }
        if ($registros.Count -eq 0) {
            & $enviarLinha @{ tipo = 'erro'; mensagem = "Nenhuma linha válida encontrada no arquivo (todas sem $($obrigatorias -join ' / '))." }
            return
        }

        $etapaAtual = "gravando a base"
        $total = $registros.Count
        & $enviarLinha @{ tipo = 'progresso'; fase = 'salvando-json'; total = $total }
        $entidade = if ($Base -eq "Vao") { "vao" } else { "protecao" }
        Write-JsonModel -Entity $entidade -Data $registros

        $etapaAtual = "cruzando alimentador com polo/regional"
        & $enviarLinha @{ tipo = 'progresso'; fase = 'resumo-km'; percentual = 99 }
        if ($Base -eq "Protecao") {
            Write-JsonModel -Entity "protecao_alim" -Data @($pares.Values)
        }
        $totalAlimPolo = 0
        try { $totalAlimPolo = Update-MapaAlimentadorPolo } catch { & $enviarLinha @{ tipo = 'progresso'; fase = 'aviso'; mensagem = "Base salva, mas não consegui recalcular o cruzamento alimentador/polo: $($_.Exception.Message)" } }
        if ($Base -eq "Protecao") { try { Update-ResumoKmDeRedeAposImportacao } catch { } }

        $etapaAtual = "registrando no histórico de importações"
        $logEntry = @{
            id = New-EntityId
            base = $(if ($Base -eq "Vao") { "Vão" } else { "Proteção" })
            usuarioId = $Usuario.usuarioId
            dataHora = Get-IsoNow
            registrosProcessados = $total
            registrosComErro = ($c.semChave + $c.coordInvalida)
            arquivoOrigem = $arquivo.FileName
        }
        try {
            $log = @(Read-JsonModel -Entity "importacoes_log") + $logEntry
            Write-JsonModel -Entity "importacoes_log" -Data $log
        } catch {
            & $enviarLinha @{ tipo = 'progresso'; fase = 'aviso'; mensagem = "Base salva, mas não consegui atualizar o histórico de importações: $($_.Exception.Message)" }
        }
        & $enviarLinha @{
            tipo = 'final'
            totalLinhas = $leitura.totalLinhas
            processados = $total
            totalErros = ($c.semChave + $c.coordInvalida)
            resumo = @{ linhasLidas = $c.lidas; registrosGravados = $total; linhasSemChave = $c.semChave; coordenadasInvalidas = $c.coordInvalida; alimentadoresComPolo = $totalAlimPolo }
            erros = @()
            log = $logEntry
        }
    } catch {
        try { & $enviarLinha @{ tipo = 'erro'; mensagem = "Erro ao $etapaAtual — $($_.Exception.GetType().FullName): $($_.Exception.Message)" } } catch { }
    } finally {
        try { $streamWriter.Flush() } catch { }
        try { $streamWriter.Close() } catch { }
        try { $Response.OutputStream.Close() } catch { }
    }
}

function Invoke-VeraStreamingUpload {
    <# POST /api/importacao/vera — upload direto do .xlsx da VERA (árvores),
       MESMO MOTIVO/MESMO PADRÃO do shapefile e do Podas (pedido do Mario:
       "quebra as etapas igual você fez com o shapefile"). Antes, a VERA
       passava pelo caminho genérico (/importacao/validar -> /confirmar):
       o NAVEGADOR lia o .xlsx inteiro com XLSX.js (trava a aba por alguns
       segundos nas 140 mil+ linhas reais) e depois mandava TODAS as linhas
       já parseadas como um único corpo JSON gigante pro Controller, que
       lia esse corpo com $reader.ReadToEnd() + ConvertFrom-Json — e o
       ConvertFrom-Json do Windows PowerShell 5.1 é lento/frágil pra uma
       string JSON de dezenas de MB, então era isso (não o front-end) que
       mais quebrava com o arquivo real.

       Aqui o navegador só manda o .xlsx CRU (multipart, igual
       shapefile/podas/kmz) e é o Controller quem lê — com Read-XlsxColunas
       (XlsxReader.ps1), um XmlReader forward-only já provado em produção
       no GRID_EXECUTADO do Podas (~60MB/178 mil linhas) — e nunca precisa
       de ConvertFrom-Json/ConvertTo-Json pra transportar as linhas em si.
       Mesmo streaming/NDJSON de progresso das outras rotas grandes. #>
    param($Response, $Request, $Usuario)

    $Response.StatusCode = 200
    $Response.ContentType = "application/x-ndjson; charset=utf-8"
    $Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    $Response.SendChunked = $true

    $streamWriter = New-Object System.IO.StreamWriter($Response.OutputStream, (New-Object System.Text.UTF8Encoding($false)))
    $streamWriter.AutoFlush = $true

    # GetNewClosure() pelo mesmo motivo das outras rotas streaming: este
    # scriptblock é repassado pra dentro de Get-MultipartFormData e de
    # Read-XlsxColunas (outro arquivo, dot-sourced separadamente) e invocado
    # lá de dentro via "& $callback" — sem isso $streamWriter não resolveria.
    $enviarLinha = {
        param($Dados)
        try {
            $json = $Dados | ConvertTo-Json -Depth 6 -Compress
            $streamWriter.Write($json + "`n")
        } catch { }
    }.GetNewClosure()

    # v2.13.3 - cronometro por fase: mostra no prompt quanto tempo cada etapa
    # da importacao levou (recebendo, lendo, validando, cruzando, gravando).
    $cron = New-CronometroImportacao
    $progressoCallback = {
        param($p)
        try { Write-FaseImportacao -Cron $cron -P $p } catch { }
        & $enviarLinha (@{ tipo = 'progresso' } + $p)
    }.GetNewClosure()

    # Nome da etapa em execução no momento — incluído na mensagem de erro se
    # algo quebrar (ver catch no final). Sem isso, um erro genérico do .NET
    # (ex.: "Os tipos de argumento não correspondem", visto num teste real)
    # não dizia QUAL das 6-7 etapas desta rota tinha falhado, tornando quase
    # impossível apontar a causa sem conseguir rodar o PowerShell de verdade.
    $etapaAtual = "iniciando"
    try {
        if (-not (Test-Permissao -UsuarioId $Usuario.usuarioId -Modulo (Get-ModuloDaBase "VERA") -Acao "importar")) {
            & $enviarLinha @{ tipo = 'erro'; mensagem = 'Sem permissão para importar a VERA.' }
            return
        }

        # Get-MultipartFormData está definida em server.ps1 (dot-sourced no
        # mesmo processo) — lê o corpo aos poucos, avisando o progresso do
        # recebimento pelo mesmo $progressoCallback do resto do import.
        $etapaAtual = "recebendo o upload"
        $multipart = Get-MultipartFormData -Request $Request -ProgressCallback $progressoCallback
        $arquivos = $multipart.Files
        if ($arquivos.Count -eq 0) {
            & $enviarLinha @{ tipo = 'erro'; mensagem = 'Nenhum arquivo recebido. Envie o .xlsx da VERA.' }
            return
        }
        $arquivo = $arquivos[0]

        # Pede a coluna principal E os aliases de cada campo (ex.: "Lat" e
        # "Latitude") — a mesma planilha pode vir com qualquer um dos dois
        # nomes (ver comentário em Validacao.ps1), e Read-XlsxColunas só
        # devolve o que foi pedido por nome exato de cabeçalho.
        $schema = Get-ImportSchema -Base "VERA"
        $colunasPedidas = New-Object System.Collections.Generic.List[string]
        foreach ($col in $schema) {
            [void]$colunasPedidas.Add($col.coluna)
            if ($col.aliases) { foreach ($a in $col.aliases) { [void]$colunasPedidas.Add($a) } }
        }

        $etapaAtual = "lendo a planilha"
        try {
            $leitura = Read-XlsxColunas -Bytes $arquivo.Bytes -Colunas @($colunasPedidas) -ProgressCallback $progressoCallback -ProgressLabel $arquivo.FileName -ProgressFase "lendo-vera"
        } catch {
            Write-ErroImportacao -Etapa $etapaAtual -Erro $_
            & $enviarLinha @{ tipo = 'erro'; mensagem = "Erro ao ler o arquivo: $($_.Exception.Message)" }
            return
        }

        # v2.13.12c - confere as colunas obrigatorias ANTES de validar 141 mil
        # linhas: se um cabecalho nao bate, avisa na hora dizendo quais colunas
        # a planilha tem (antes: todas as linhas viravam erro, sem explicacao).
        $etapaAtual = "conferindo as colunas da planilha"
        $achadas = @($leitura.colunasEncontradas)
        $faltandoCols = New-Object System.Collections.Generic.List[string]
        foreach ($col in $schema) {
            if (-not $col.obrigatorio) { continue }
            $ok = ($achadas -contains $col.coluna)
            if (-not $ok -and $col.aliases) { foreach ($al in $col.aliases) { if ($achadas -contains $al) { $ok = $true } } }
            if (-not $ok) { [void]$faltandoCols.Add($col.coluna) }
        }
        if ($faltandoCols.Count -gt 0) {
            $cab = @($leitura.cabecalhos | Where-Object { $_ })
            $txtCab = "(nao foi possivel listar)"
            if ($cab.Count -gt 0) { $txtCab = ($cab[0..([Math]::Min(39, $cab.Count - 1))]) -join " | " }
            Write-Host ("  [importacao] colunas obrigatorias nao encontradas: {0}. Cabecalhos da planilha: {1}" -f ($faltandoCols -join ", "), $txtCab) -ForegroundColor Red
            & $enviarLinha @{ tipo = 'erro'; mensagem = "A planilha nao tem a(s) coluna(s) obrigatoria(s): $($faltandoCols -join ', '). Cabecalhos que encontrei: $txtCab" }
            return
        }

        $etapaAtual = "validando as linhas"
        & $enviarLinha @{ tipo = 'progresso'; fase = 'validando'; arquivo = $arquivo.FileName; linha = 0; total = $leitura.linhas.Count }
        try {
            # -ProgressCallback aqui é o motivo real do "BodyStreamBuffer was
            # aborted" visto num teste real com a planilha inteira: sem ele,
            # validar 141 mil linhas corria inteiro em silêncio (nenhum byte
            # de volta pro navegador) por tempo suficiente pra estourar o
            # timeout "de trava" do upload (stallMs em apiUploadFormDataStream),
            # que derrubava a conexão achando que o Controller tinha travado —
            # ele só estava ocupado. Ver comentário em Test-ImportRows.
            $validacao = Test-ImportRows -Base "VERA" -Rows $leitura.linhas -ProgressCallback $progressoCallback
        } catch {
            Write-ErroImportacao -Etapa $etapaAtual -Erro $_
            & $enviarLinha @{ tipo = 'erro'; mensagem = "Erro ao $etapaAtual - $($_.Exception.GetType().FullName): $($_.Exception.Message)" }
            return
        }

        # v2.13.12c - nenhuma linha valida: nao grava nada nem cria linha no
        # historico; mostra os primeiros motivos (antes a importacao "terminava"
        # com 0 processados e a tela so quebrava no fim).
        if ($validacao.validas.Count -eq 0) {
            $amostra = New-Object System.Collections.Generic.List[string]
            $nAm = [Math]::Min(3, $validacao.erros.Count)
            for ($q = 0; $q -lt $nAm; $q++) { $e0 = $validacao.erros[$q]; [void]$amostra.Add("linha $($e0.numeroLinha): $($e0.motivo)") }
            $txtAm = $amostra -join " ; "
            Write-Host ("  [importacao] nenhuma linha valida em {0} linhas. Exemplos: {1}" -f $leitura.totalLinhas, $txtAm) -ForegroundColor Red
            & $enviarLinha @{ tipo = 'erro'; mensagem = "Nenhuma linha valida (de $($leitura.totalLinhas)). Exemplos: $txtAm" }
            return
        }

        $etapaAtual = "lendo a base atual da VERA (vera.json)"
        & $enviarLinha @{ tipo = 'progresso'; fase = 'gravando'; linha = 0; total = $validacao.validas.Count }
        # Mesma mescla por chave do caminho genérico (Invoke-ImportacaoGenerica)
        # — reaproveita o posProcessar da VERA (conversão de vírgula decimal,
        # alias Lat/Latitude e Lng/Longitude), só que chamado direto aqui em
        # vez de passar por um corpo JSON intermediário.
        $posProcessar = Get-PosProcessarDaBase -Base "VERA" -Usuario $Usuario
        $existentes = @(Read-JsonModel -Entity "vera")
        $porChave = @{}
        foreach ($item in $existentes) { $porChave[$item.idVera] = $item }
        $etapaAtual = "montando os registros das árvores"
        $errosGravacao = New-Object System.Collections.Generic.List[object]
        $totalValidas = $validacao.validas.Count
        $contadorGravacao = 0
        foreach ($row in $validacao.validas) {
            $contadorGravacao++
            # Mesmo motivo do -ProgressCallback em Test-ImportRows acima:
            # este loop roda sobre até 141 mil linhas sem gravar nada em
            # disco até o fim (Write-JsonModel só acontece depois), e sem
            # avisar o navegador periodicamente aqui dentro essa segunda
            # metade do processamento também fica muda tempo demais.
            if ($contadorGravacao % 5000 -eq 0) {
                & $enviarLinha @{ tipo = 'progresso'; fase = 'gravando'; linha = $contadorGravacao; total = $totalValidas }
            }
            # Uma linha com Lat/Lng em formato totalmente inesperado (ex.:
            # texto não numérico que passou pela checagem de obrigatório)
            # não pode derrubar o lote inteiro — isola igual às outras
            # importações grandes (defesa em profundidade).
            try {
                $registro = & $posProcessar $row
                $porChave[$registro.idVera] = $registro
            } catch {
                $errosGravacao.Add(@{ idVera = (Get-CampoDoRow -Row $row -Campo "ID árvore"); motivo = $_.Exception.Message })
            }
        }
        $etapaAtual = "salvando o arquivo da base (vera.json)"
        & $enviarLinha @{ tipo = 'progresso'; fase = 'salvando-json'; total = $totalValidas }
        $listaVera = New-Object System.Collections.Generic.List[object]
        foreach ($itemVera in $porChave.Values) { [void]$listaVera.Add($itemVera) }
        Write-JsonModel -Entity "vera" -Data $listaVera.ToArray()
        # A partir daqui os dados JÁ ESTÃO salvos em disco — um problema nas
        # 2 etapas finais (gravar o log, montar a linha de resposta) não pode
        # mais ser relatado como "a importação falhou", porque não é verdade:
        # as árvores já foram gravadas. Por isso log e resposta final ficam
        # num try/catch PRÓPRIO, separado do try/catch principal — se algum
        # dos dois falhar, a tela ainda assim mostra sucesso (só sem log
        # bonito no histórico), em vez de um "Erro ao importar" enganoso
        # depois do trabalho pesado já ter sido concluído com sucesso.
        $etapaAtual = "registrando no histórico de importações"
        $logEntry = @{
            id = New-EntityId
            base = "VERA"
            usuarioId = $Usuario.usuarioId
            dataHora = Get-IsoNow
            registrosProcessados = $validacao.validas.Count - $errosGravacao.Count
            registrosComErro = $validacao.erros.Count + $errosGravacao.Count
            arquivoOrigem = $arquivo.FileName
        }
        try {
            $log = @(Read-JsonModel -Entity "importacoes_log") + $logEntry
            Write-JsonModel -Entity "importacoes_log" -Data $log
        } catch {
            # Não propaga: a VERA já foi salva, só o histórico que não
            # atualizou. Fica registrado no próprio NDJSON pra quem olhar o
            # console do Controller, mas não derruba a resposta de sucesso.
            & $enviarLinha @{ tipo = 'progresso'; fase = 'aviso'; mensagem = "Árvores salvas, mas não consegui atualizar o histórico de importações: $($_.Exception.Message)" }
        }

        $etapaAtual = "montando a resposta final"
        # v2.13.12c: "Select-Object -First" sobre a lista de erros derrubava aqui
        # com "Os tipos de argumento nao correspondem" (PowerShell 5.1). Copia os
        # 500 primeiros por indice, sem pipeline.
        $errosAmostra = New-Object System.Collections.Generic.List[object]
        $nErr = [Math]::Min(500, $validacao.erros.Count)
        for ($q = 0; $q -lt $nErr; $q++) { [void]$errosAmostra.Add($validacao.erros[$q]) }
        # v2.13.17 - resposta final montada chave a chave, com arrays prontos
        # (ToArray), sem @() sobre listas de hashtables dentro do literal: esse
        # padrao dava "Os tipos de argumento nao correspondem" no PS 5.1.
        $errosAmostraArr = $errosAmostra.ToArray()
        $errosGravacaoArr = $errosGravacao.ToArray()
        $respFinal = @{}
        $respFinal['tipo'] = 'final'
        $respFinal['totalLinhas'] = $leitura.totalLinhas
        $respFinal['processados'] = $logEntry.registrosProcessados
        $respFinal['erros'] = $errosAmostraArr
        $respFinal['totalErros'] = $validacao.erros.Count + $errosGravacao.Count
        $respFinal['errosGravacao'] = $errosGravacaoArr
        $respFinal['log'] = $logEntry
        & $enviarLinha $respFinal
    } catch {
        Write-ErroImportacao -Etapa $etapaAtual -Erro $_
        try { & $enviarLinha @{ tipo = 'erro'; mensagem = "Erro ao $etapaAtual — $($_.Exception.GetType().FullName): $($_.Exception.Message)" } } catch { }
    } finally {
        try { $streamWriter.Flush() } catch { }
        try { $streamWriter.Close() } catch { }
        try { $Response.OutputStream.Close() } catch { }
    }
}
