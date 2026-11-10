<?php

namespace App\Services\Importacao;

use App\Services\ListaOs;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Importacao das grids de OS (lib/PodasImporter.ps1 do legado), gravando direto no banco.
 *   executado(): SGM_EXECUTADO + MO_EXECUTADA (+ MO_PENDENTE opcional, para o Previsto)  -> lote GRID_EXECUTADO (ou historico de um plano)
 *   pendente():  SGM_PENDENTE + MO_PENDENTE (+ MO_EXECUTADA opcional, para o Realizado) -> lote GRID_PENDENTE
 *   sigod():     basePoda (aba "Base Poda")                                           -> lote SIGOD
 *   sigodPendente(): pendentes_sigod                                                  -> lote SIGOD_PENDENTE
 * Cada importacao SUBSTITUI so o proprio lote (os outros ficam). Depois: copias das OS nas programacoes
 * (osSnap/execSnap) e, no executado, programacao com todas as OS executadas vira "Concluída".
 * Fica de fora por enquanto: recalculo de APP/RL (depende das camadas de rede, pasta geo/).
 */
class ImportadorGrids
{
    public const FONTES = ['GRID_EXECUTADO', 'GRID_PENDENTE', 'SIGOD', 'SIGOD_PENDENTE'];

    private const COLS_MO = ['Número OS', 'DE-PARA RECURSOS.MO 2', 'DE-PARA RECURSOS.MO 1', 'Qtd Poda', 'Qtd Limpeza (M²)', 'Qtd Estrutura'];

    /** @var callable */
    private $avisar;

    private ?float $ultimoAviso = null;

    private array $cacheVao = [];

    private ?bool $temVao = null;

    public function __construct(?callable $avisar = null)
    {
        $this->avisar = $avisar ?? fn (array $p) => null;
    }

    // =============================================================== SGM EXECUTADO

    public function executado(string $grid, string $moExec, ?string $moPend, int $plano = 0, string $modo = 'substituir', ?string $usuario = null, string $arquivos = ''): array
    {
        try {
            [$dicMoExec, $qtdMoExec] = $this->lerMO($moExec, 'MO_EXECUTADA');
            $qtdMoPend = [];
            $temMoPend = false;
            if ($moPend) {
                [, $qtdMoPend] = $this->lerMO($moPend, 'MO_PENDENTE');
                $temMoPend = true;
            }
            $tabEW = $this->tabelaPrioridadeEW();
            $res = ['executadoTotal' => 0, 'executadoSemMO' => 0, 'executadoSemCoordenada' => 0, 'executadoPlotadas' => 0, 'previstoCalculado' => $temMoPend,
                'executadoAproximadas' => 0, 'executadoSemPosicao' => 0, 'executadoSoPrevisto' => 0];
            $iv = null;
            if ($plano > 0) {
                $iv = RegrasGrid::intervaloPlano($plano);
                $res += ['historicoPlano' => $plano, 'historicoInicio' => $iv['inicio'], 'historicoFim' => $iv['fim'], 'historicoSemData' => 0,
                    'historicoForaDoPlano' => 0, 'historicoForaPorPlano' => [], 'historicoAmostraRejeitadas' => []];
            }
            $res['podaLinear'] = 0;
            if (! $this->temVao()) {
                $res['podaLinearSemVao'] = true;
            }
            $cols = ['Número OS', 'OSPrimária(int)', 'COORDENADA UTM X', 'COORDENADA UTM Y', 'OSFechada?', 'CodSetor', 'Localidade', 'DescEsquema', 'Observação', 'Observacao',
                'Prioridade', 'Data de criação', 'Início Execução', 'Término Execução', 'TIPO_EQUIPE_EXEC', 'Complemento de Localização', 'CODIGO DA ARVORE', 'Trecho', 'protecao'];
            $novos = [];
            $acum = [];
            $semCoord = [];
            $leitor = new LeitorXlsx($grid, $cols);
            foreach ($this->ler($leitor, 'SGM_EXECUTADO', 'grid') as $l) {
                $res['executadoTotal']++;
                $os = $l['Número OS'];
                if ($os === null || trim($os) === '') {
                    $res['executadoSemMO']++;

                    continue;
                }
                $osChave = trim($os);
                if ($plano > 0) {
                    $dRef = RegrasGrid::serialParaData($l['Término Execução']) ?? RegrasGrid::serialParaData($l['Início Execução']);
                    if (! $dRef) {
                        $res['historicoSemData']++;
                        if (count($res['historicoAmostraRejeitadas']) < 15) {
                            $res['historicoAmostraRejeitadas'][] = "OS $osChave - sem data de execucao";
                        }

                        continue;
                    }
                    if (strcmp($dRef, $iv['inicio']) < 0 || strcmp($dRef, $iv['fim']) > 0) {
                        $res['historicoForaDoPlano']++;
                        $pd = (string) RegrasGrid::planoDaData($dRef);
                        $res['historicoForaPorPlano'][$pd] = ($res['historicoForaPorPlano'][$pd] ?? 0) + 1;
                        if (count($res['historicoAmostraRejeitadas']) < 15) {
                            $res['historicoAmostraRejeitadas'][] = "OS $osChave - execucao em $dRef (plano $pd)";
                        }

                        continue;
                    }
                }
                // Sem MO executada: so continua se tiver OS-mae com Previsto (como o BI)
                $soPrevisto = false;
                $qPrevCedo = null;
                if (! isset($dicMoExec[$osChave])) {
                    $osPrimCedo = trim((string) $l['OSPrimária(int)']);
                    if ($osPrimCedo === '') {
                        $res['executadoSemMO']++;

                        continue;
                    }
                    $qPrevCedo = $qtdMoPend[$osPrimCedo] ?? self::zero();
                    if (array_sum($qPrevCedo) <= 0) {
                        $res['executadoSemMO']++;

                        continue;
                    }
                    $soPrevisto = true;
                    $res['executadoSoPrevisto']++;
                }
                $ll = RegrasGrid::latLngDaGrid($l['COORDENADA UTM X'], $l['COORDENADA UTM Y']);
                $chaveLoc = RegrasGrid::nomeLocalidadeSemCodigo($l['Localidade']);
                if ($ll) {
                    if ($chaveLoc) {
                        $acum[$chaveLoc][] = [$ll['lat'], $ll['lng']];
                    }
                } else {
                    $res['executadoSemCoordenada']++;
                }
                if ($soPrevisto) {
                    $tipo = 'Poda';
                    if ($qPrevCedo['poda'] <= 0 && $qPrevCedo['limpeza'] > 0) {
                        $tipo = 'Limpeza de Faixa';
                    } elseif ($qPrevCedo['poda'] <= 0 && $qPrevCedo['estrutura'] > 0) {
                        $tipo = 'Estrutura';
                    }
                    $mo = ['tipoServico' => $tipo, 'detalhe' => null];
                } else {
                    $mo = $dicMoExec[$osChave];
                }
                $dataExec = RegrasGrid::serialParaData($l['Término Execução']) ?? RegrasGrid::serialParaData($l['Início Execução']);
                $osPrimaria = trim((string) $l['OSPrimária(int)']);
                $osPrimaria = $osPrimaria === '' ? null : $osPrimaria;
                $qPrev = $qtdMoPend[$osPrimaria ?? $osChave] ?? self::zero();   // Previsto vem da OS-mae, se houver
                $qReal = $qtdMoExec[$osChave] ?? self::zero();
                $posteId = RegrasGrid::posteDoComplemento($l['Complemento de Localização']);
                if (! $soPrevisto && $this->temVao() && self::podaLinear($l['DescEsquema'])) {
                    $qReal = ['poda' => 0.0, 'limpeza' => $this->limpezaPodaLinear($posteId), 'estrutura' => 0.0];
                    $qPrev = self::zero();
                    $mo = ['tipoServico' => 'Limpeza de Faixa', 'detalhe' => $mo['detalhe']];
                    $res['podaLinear']++;
                }
                $reg = [
                    'id' => $osChave, 'origem' => 'SGM', 'osPrimaria' => $osPrimaria, 'idVera' => RegrasGrid::idVeraDaGrid($l['CODIGO DA ARVORE']),
                    'statusOS' => RegrasGrid::statusExecutado($l['OSFechada?']), 'tipoServico' => $mo['tipoServico'], 'tipoEquipeNecessaria' => null,
                    'posteId' => $posteId, 'tipoEquipeExec' => self::tipoEquipeExec($l['TIPO_EQUIPE_EXEC']),
                    'prioridadeEW' => RegrasGrid::prioridadeEW($l['Prioridade'], $qPrev['poda'] + $qReal['poda'], $qPrev['limpeza'] + $qReal['limpeza'],
                        $qPrev['estrutura'] + $qReal['estrutura'], (string) $mo['tipoServico'], $tabEW),
                    'equipeId' => RegrasGrid::equipeDoNumeroOS($osChave),
                    'dataAbertura' => RegrasGrid::serialParaData($l['Data de criação']), 'dataExecucao' => $dataExec,
                    'alimentador' => $l['CodSetor'], 'conjunto' => null, 'localidade' => $chaveLoc,
                    'protecaoId' => RegrasGrid::textoOuNulo($l['protecao']), 'trecho' => RegrasGrid::trecho($l['Trecho']),
                    'localizacao' => ['lat' => $ll['lat'] ?? null, 'lng' => $ll['lng'] ?? null, 'fonte' => 'GRID_EXECUTADO', 'aproximada' => false],
                    'descEsquema' => RegrasGrid::textoOuNulo($l['DescEsquema']),
                    'observacao' => $plano > 0 ? null : RegrasGrid::textoCorrigido($l['Observação'] ?: $l['Observacao']),
                ] + self::quantidades($qPrev, $qReal);
                $novos[$osChave] = $reg;
                if ($ll) {
                    $res['executadoPlotadas']++;
                } else {
                    $semCoord[] = ['id' => $osChave, 'chave' => $chaveLoc];
                }
            }
            $this->exigirColunas($leitor, ['Número OS'], 'SGM_EXECUTADO');
            $this->posicoes($novos, $semCoord, $acum, $res, 'executado', true);
            $this->avisar(['fase' => 'gravando', 'percentual' => 99]);
            if ($plano > 0) {
                $res += $this->gravarHistorico($plano, $modo, $novos, $usuario, $arquivos);
            } else {
                $res += $this->gravarLote('GRID_EXECUTADO', $novos);
            }
            $res['totalPlotadas'] = count($novos);

            return $res;
        } finally {
            $this->avisar(['fase' => 'concluido', 'percentual' => 100]);
        }
    }

    // =============================================================== SGM PENDENTE

    public function pendente(string $grid, string $moPend, ?string $moExec): array
    {
        try {
            [$dicMoPend, $qtdMoPend] = $this->lerMO($moPend, 'MO_PENDENTE');
            $qtdMoExec = [];
            if ($moExec) {
                [, $qtdMoExec] = $this->lerMO($moExec, 'MO_EXECUTADA');
            }
            $tabEW = $this->tabelaPrioridadeEW();
            $tabEsq = $this->tabelaEsquemas();
            $res = ['pendenteTotal' => 0, 'pendenteSemMO' => 0, 'pendentePrevistoPorEsquema' => 0, 'pendenteSemCoordenada' => 0, 'pendentePlotadas' => 0,
                'pendenteAproximadas' => 0, 'pendenteSemPosicao' => 0, 'podaLinear' => 0];
            $cols = ['OSNumero', 'CodEsquema', 'COORDENADA UTM X', 'COORDENADA UTM Y', 'CodEstado', 'CodSetor', 'Localidade', 'DescEsquema', 'Observação', 'Observacao',
                'CodPrioridade', 'DataCriação', 'TIPO_EQUIPE_EXEC', 'Complemento de Localização', 'CODIGO DA ARVORE', 'Trecho', 'protecao'];
            $novos = [];
            $acum = [];
            $semCoord = [];
            $leitor = new LeitorXlsx($grid, $cols);
            foreach ($this->ler($leitor, 'SGM_PENDENTE', 'grid') as $l) {
                $res['pendenteTotal']++;
                $os = $l['OSNumero'];
                if ($os === null || trim($os) === '') {
                    $res['pendenteSemMO']++;

                    continue;
                }
                $osChave = trim($os);
                // sem MO: entra so se o esquema estiver na base "Esquemas" (previsto 1 do tipo do esquema)
                $tipoEsq = '';
                if (! isset($dicMoPend[$osChave])) {
                    $tipoEsq = $this->tipoDoEsquema($tabEsq, (string) $l['DescEsquema'], (string) $l['CodEsquema']);
                    if ($tipoEsq === '') {
                        $res['pendenteSemMO']++;

                        continue;
                    }
                }
                $ll = RegrasGrid::latLngDaGrid($l['COORDENADA UTM X'], $l['COORDENADA UTM Y']);
                $chaveSetor = trim((string) $l['CodSetor']) === '' ? null : mb_strtoupper(trim((string) $l['CodSetor']));
                if ($ll) {
                    if ($chaveSetor) {
                        $acum[$chaveSetor][] = [$ll['lat'], $ll['lng']];
                    }
                } else {
                    $res['pendenteSemCoordenada']++;
                }
                if ($tipoEsq !== '') {
                    $mo = ['tipoServico' => match ($tipoEsq) { 'limpeza' => 'Limpeza de Faixa', 'estrutura' => 'Estrutura', default => 'Poda' }, 'detalhe' => null];
                    $qPrev = ['poda' => $tipoEsq === 'poda' ? 1.0 : 0.0, 'limpeza' => $tipoEsq === 'limpeza' ? 1.0 : 0.0, 'estrutura' => $tipoEsq === 'estrutura' ? 1.0 : 0.0];
                    $res['pendentePrevistoPorEsquema']++;
                } else {
                    $mo = $dicMoPend[$osChave];
                    $qPrev = $qtdMoPend[$osChave] ?? self::zero();
                }
                $qReal = $qtdMoExec[$osChave] ?? self::zero();
                $posteId = RegrasGrid::posteDoComplemento($l['Complemento de Localização']);
                if ($this->temVao() && self::podaLinear($l['DescEsquema'])) {
                    $lim = $this->limpezaPodaLinear($posteId);
                    $tinhaReal = array_sum($qReal) > 0;
                    $qPrev = ['poda' => 0.0, 'limpeza' => $lim, 'estrutura' => 0.0];
                    $qReal = ['poda' => 0.0, 'limpeza' => $tinhaReal ? $lim : 0.0, 'estrutura' => 0.0];
                    $mo = ['tipoServico' => 'Limpeza de Faixa', 'detalhe' => $mo['detalhe']];
                    $res['podaLinear']++;
                }
                $reg = [
                    'id' => $osChave, 'origem' => 'SGM', 'osPrimaria' => null, 'idVera' => RegrasGrid::idVeraDaGrid($l['CODIGO DA ARVORE']),
                    'statusOS' => RegrasGrid::statusPendente($l['CodEstado']), 'tipoServico' => $mo['tipoServico'], 'tipoEquipeNecessaria' => null,
                    'posteId' => $posteId, 'tipoEquipeExec' => self::tipoEquipeExec($l['TIPO_EQUIPE_EXEC']),
                    'prioridadeEW' => RegrasGrid::prioridadeEW($l['CodPrioridade'], $qPrev['poda'] + $qReal['poda'], $qPrev['limpeza'] + $qReal['limpeza'],
                        $qPrev['estrutura'] + $qReal['estrutura'], (string) $mo['tipoServico'], $tabEW),
                    'equipeId' => RegrasGrid::equipeDoNumeroOS($osChave),
                    'dataAbertura' => RegrasGrid::serialParaData($l['DataCriação']), 'dataExecucao' => null,
                    'alimentador' => $l['CodSetor'], 'conjunto' => null, 'localidade' => RegrasGrid::nomeLocalidadeSemCodigo($l['Localidade']),
                    'protecaoId' => RegrasGrid::textoOuNulo($l['protecao']), 'trecho' => RegrasGrid::trecho($l['Trecho']),
                    'localizacao' => ['lat' => $ll['lat'] ?? null, 'lng' => $ll['lng'] ?? null, 'fonte' => 'GRID_PENDENTE', 'aproximada' => false],
                    'descEsquema' => RegrasGrid::textoOuNulo($l['DescEsquema']),
                    'observacao' => RegrasGrid::textoCorrigido($l['Observação'] ?: $l['Observacao']),
                    'previstoPorEsquema' => $tipoEsq !== '',
                ] + self::quantidades($qPrev, $qReal);
                $novos[$osChave] = $reg;
                if ($ll) {
                    $res['pendentePlotadas']++;
                } else {
                    $semCoord[] = ['id' => $osChave, 'chave' => $chaveSetor];
                }
            }
            $this->exigirColunas($leitor, ['OSNumero'], 'SGM_PENDENTE');
            $this->avisar(['fase' => 'cruzando', 'arquivo' => 'posicao pela VERA e pelos postes', 'percentual' => 99]);
            $this->posicoes($novos, $semCoord, $acum, $res, 'pendente', true);
            $this->avisar(['fase' => 'gravando', 'percentual' => 99]);
            $res += $this->gravarLote('GRID_PENDENTE', $novos);
            $res['totalPlotadas'] = count($novos);

            return $res;
        } finally {
            $this->avisar(['fase' => 'concluido', 'percentual' => 100]);
        }
    }

    // =============================================================== SIGOD (executadas / plantao)

    public function sigod(string $base): array
    {
        try {
            $cols = ['NUMOS', 'DATA_SOL', 'VLR_COORDENADA_LATITUDE', 'VLR_COORDENADA_LONGITUDE', 'NUM_ALIMENTADOR', 'EQUIPE', 'DH_ALOCACAO', 'DTH_FIM_EXECUCAO',
                'TIPO_PODA', 'NOM_LOGRADOURO', 'NUM_CASA', 'DSC_BAIRRO', 'CODLCD', 'LOCALIDADE'];
            $locPorCod = [];
            foreach ($this->legadoBruto('localidades') as $loc) {
                if (isset($loc['codLocalidade']) && trim((string) ($loc['localidade'] ?? '')) !== '') {
                    $locPorCod[trim((string) $loc['codLocalidade'])] = (string) $loc['localidade'];
                }
            }
            $res = ['sigodTotal' => 0, 'sigodSemNumeroOS' => 0, 'sigodSemCoordenada' => 0, 'sigodPlotadas' => 0, 'sigodExecutadas' => 0, 'sigodPlantao' => 0];
            $novos = [];
            $acum = [];
            $semCoord = [];
            $leitor = new LeitorXlsx($base, $cols);
            foreach ($this->ler($leitor, 'BASE_PODA (SIGOD)', 'grid') as $l) {
                $res['sigodTotal']++;
                $num = trim((string) $l['NUMOS']);
                if ($num === '') {
                    $res['sigodSemNumeroOS']++;

                    continue;
                }
                $num = RegrasGrid::semPontoZero($num);
                $lat = RegrasGrid::numeroInvariante(str_replace(',', '.', trim((string) $l['VLR_COORDENADA_LATITUDE'])));
                $lng = RegrasGrid::numeroInvariante(str_replace(',', '.', trim((string) $l['VLR_COORDENADA_LONGITUDE'])));
                $temCoord = $lat !== null && $lng !== null && $lat >= -35 && $lat <= 6 && $lng >= -75 && $lng <= -30;
                if (! $temCoord) {
                    $res['sigodSemCoordenada']++;
                }
                $dataExec = RegrasGrid::serialParaData($l['DTH_FIM_EXECUCAO']);
                $alocada = trim((string) $l['DH_ALOCACAO']) !== '';
                $status = $dataExec ? 'Executada' : ($alocada ? 'Despachada' : 'Pendente');
                $tipoPoda = trim((string) $l['TIPO_PODA']);
                if (str_contains(mb_strtoupper($tipoPoda), 'PLANT')) {
                    $res['sigodPlantao']++;
                }
                if ($status === 'Executada') {
                    $res['sigodExecutadas']++;
                }
                $localidade = trim((string) $l['LOCALIDADE']);
                if ($localidade === '' || str_starts_with($localidade, '=')) {
                    $cod = RegrasGrid::semPontoZero(trim((string) $l['CODLCD']));
                    $localidade = $locPorCod[$cod] ?? null;
                }
                $endereco = implode(', ', array_filter([trim((string) $l['NOM_LOGRADOURO']), trim((string) $l['NUM_CASA'])], fn ($x) => $x !== ''));
                $obs = implode(' - ', array_filter([$tipoPoda, $endereco, trim((string) $l['DSC_BAIRRO'])], fn ($x) => $x !== ''));
                $equipe = trim((string) $l['EQUIPE']);
                $id = "SIGOD-$num";
                $chaveLoc = RegrasGrid::nomeLocalidadeSemCodigo($localidade);
                if ($temCoord && $chaveLoc) {
                    $acum[$chaveLoc][] = [$lat, $lng];
                }
                $exec = $status === 'Executada' ? 1 : 0;
                $novos[$id] = [
                    'id' => $id, 'origem' => 'SIGOD', 'osPrimaria' => null, 'idVera' => null, 'statusOS' => $status, 'tipoServico' => 'Poda',
                    'tipoEquipeNecessaria' => null, 'prioridadeEW' => false, 'equipeId' => $equipe !== '' ? $equipe : null,
                    'dataAbertura' => RegrasGrid::serialParaData($l['DATA_SOL']), 'dataExecucao' => $dataExec,
                    'alimentador' => trim((string) $l['NUM_ALIMENTADOR']), 'conjunto' => $localidade, 'protecaoId' => null,
                    'localizacao' => ['lat' => $temCoord ? $lat : null, 'lng' => $temCoord ? $lng : null, 'fonte' => 'SIGOD', 'aproximada' => false],
                    'previsto' => 1, 'realizado' => $exec, 'previstoPoda' => 1, 'previstoLimpeza' => 0, 'previstoEstrutura' => 0,
                    'realizadoPoda' => $exec, 'realizadoLimpeza' => 0, 'realizadoEstrutura' => 0, 'observacao' => $obs,
                ];
                if ($temCoord) {
                    $res['sigodPlotadas']++;
                } else {
                    $semCoord[] = ['id' => $id, 'chave' => $chaveLoc];
                }
            }
            $this->exigirColunas($leitor, ['NUMOS'], 'BASE_PODA (SIGOD)');
            $ap = $this->aproximadas($novos, $semCoord, $acum, true);
            $res['sigodAproximadas'] = $ap['aproximadas'];
            $res['sigodSemPosicao'] = $ap['semPosicao'];
            $this->avisar(['fase' => 'gravando', 'percentual' => 99]);
            $res += $this->gravarLote('SIGOD', $novos);
            $res['totalPlotadas'] = count($novos);

            return $res;
        } finally {
            $this->avisar(['fase' => 'concluido', 'percentual' => 100]);
        }
    }

    // =============================================================== SIGOD PENDENTES

    public function sigodPendente(string $base): array
    {
        try {
            $cols = ['numos', 'datasol', 'dataprev', 'codlcd', 'nomelcd', 'vlrcdn_x', 'vlrcdn_y', 'sitos', 'dscsvc', 'codserv', 'obsos', 'dsclgr_os', 'numcasa', 'bairro', 'codreg'];
            $res = ['sigodPendTotal' => 0, 'sigodPendSemNumeroOS' => 0, 'sigodPendJaExecutadas' => 0, 'sigodPendComCoordenada' => 0, 'sigodPendAproximadas' => 0,
                'sigodPendSemPosicao' => 0, 'sigodPendCoordInvalida' => 0];
            $jaSigod = DB::table('os')->where('loc_fonte', 'SIGOD')->pluck('id')->flip();
            $novos = [];
            $acum = [];
            $semCoord = [];
            $leitor = new LeitorXlsx($base, $cols);
            foreach ($this->ler($leitor, 'SIGOD_PENDENTES', 'grid') as $l) {
                $res['sigodPendTotal']++;
                $num = RegrasGrid::semPontoZero(trim((string) $l['numos']));
                if ($num === '') {
                    $res['sigodPendSemNumeroOS']++;

                    continue;
                }
                $id = "SIGOD-$num";
                if (isset($jaSigod[$id])) {
                    $res['sigodPendJaExecutadas']++;

                    continue;
                }
                if (isset($novos[$id])) {
                    continue;   // a primeira linha da OS vale
                }
                $lat = null;
                $lng = null;
                $xt = str_replace(',', '.', trim((string) $l['vlrcdn_x']));
                $yt = str_replace(',', '.', trim((string) $l['vlrcdn_y']));
                if ($xt !== '' || $yt !== '') {
                    $x = RegrasGrid::numeroInvariante($xt);
                    $y = RegrasGrid::numeroInvariante($yt);
                    if ($x !== null && $y !== null && $x >= 150000 && $x <= 1300000 && $y >= 6500000 && $y <= 8200000) {
                        $ll = RegrasGrid::utmParaLatLng($x, $y, 22);
                        if ($ll) {
                            [$lat, $lng] = [$ll['lat'], $ll['lng']];
                        }
                    }
                    if ($lat === null) {
                        $res['sigodPendCoordInvalida']++;
                    }
                }
                $nomeLoc = RegrasGrid::nomeLocalidadeSemCodigo($l['nomelcd']);
                if ($lat !== null) {
                    $res['sigodPendComCoordenada']++;
                    if ($nomeLoc) {
                        $acum[$nomeLoc][] = [$lat, $lng];
                    }
                }
                $endereco = implode(', ', array_filter([trim((string) $l['dsclgr_os']), trim((string) $l['numcasa'])], fn ($x) => $x !== ''));
                $servico = str_contains((string) $l['codserv'], '324') ? 'Poda de árvore operação (324)' : 'Poda de árvore (77)';
                $novos[$id] = [
                    'id' => $id, 'origem' => 'SIGOD', 'osPrimaria' => null, 'idVera' => null, 'statusOS' => 'Pendente', 'tipoServico' => 'Poda',
                    'tipoEquipeNecessaria' => null, 'prioridadeEW' => false, 'equipeId' => null,
                    'dataAbertura' => RegrasGrid::serialParaData($l['datasol']), 'dataExecucao' => null, 'dataPrevista' => RegrasGrid::serialParaData($l['dataprev']),
                    'alimentador' => null, 'conjunto' => $nomeLoc, 'protecaoId' => null,
                    'localizacao' => ['lat' => $lat, 'lng' => $lng, 'fonte' => 'SIGOD_PENDENTE', 'aproximada' => false],
                    'previsto' => 1, 'realizado' => 0, 'previstoPoda' => 1, 'previstoLimpeza' => 0, 'previstoEstrutura' => 0,
                    'realizadoPoda' => 0, 'realizadoLimpeza' => 0, 'realizadoEstrutura' => 0,
                    'observacao' => implode(' - ', array_filter([$servico, $endereco, trim((string) $l['bairro'])], fn ($x) => $x !== '')),
                ];
                if ($lat === null) {
                    $semCoord[] = ['id' => $id, 'chave' => $nomeLoc];
                }
            }
            $this->exigirColunas($leitor, ['numos'], 'SIGOD_PENDENTES');
            $this->avisar(['fase' => 'cruzando', 'arquivo' => 'posicao aproximada das OS sem coordenada', 'percentual' => 99]);
            // o legado nao marca origem CIDADE nas aproximadas deste lote
            $ap = $this->aproximadas($novos, $semCoord, $acum, false);
            $res['sigodPendAproximadas'] = $ap['aproximadas'];
            $res['sigodPendSemPosicao'] = $ap['semPosicao'];
            $this->avisar(['fase' => 'gravando', 'percentual' => 99]);
            $res += $this->gravarLote('SIGOD_PENDENTE', $novos);
            $res['totalPlotadas'] = count($novos);

            return $res;
        } finally {
            $this->avisar(['fase' => 'concluido', 'percentual' => 100]);
        }
    }

    // =============================================================== leitura

    private function ler(LeitorXlsx $leitor, string $rotulo, string $fase): \Generator
    {
        $this->avisar(['fase' => 'indexando', 'arquivo' => $rotulo, 'linha' => 0]);

        return $leitor->linhas(function (int $lidas, int $total) use ($rotulo, $fase) {
            $p = ['fase' => $fase, 'arquivo' => $rotulo, 'linha' => $lidas];
            if ($total > 0) {
                $p += ['total' => $total, 'percentual' => min(99, round(100.0 * $lidas / $total, 1))];
            }
            $this->avisar($p, true);
        });
    }

    /** MO: [dicionario por OS (tipo do 1o apontamento), quantidades somadas por OS]. */
    private function lerMO(string $arq, string $rotulo): array
    {
        $dic = [];
        $qtd = [];
        $leitor = new LeitorXlsx($arq, self::COLS_MO);
        foreach ($this->ler($leitor, $rotulo, 'mo') as $l) {
            $os = $l['Número OS'];
            if ($os === null || trim($os) === '') {
                continue;
            }
            $k = trim($os);
            if (! isset($dic[$k])) {
                $mo2 = $l['DE-PARA RECURSOS.MO 2'];
                $dic[$k] = ['tipoServico' => (trim((string) $mo2) === '') ? $l['DE-PARA RECURSOS.MO 1'] : $mo2, 'detalhe' => $l['DE-PARA RECURSOS.MO 1']];
                $qtd[$k] = self::zero();
            }
            foreach (['poda' => 'Qtd Poda', 'limpeza' => 'Qtd Limpeza (M²)', 'estrutura' => 'Qtd Estrutura'] as $c => $col) {
                $v = RegrasGrid::doubleSeguro($l[$col]);
                if ($v !== null) {
                    $qtd[$k][$c] += $v;
                }
            }
        }
        $this->exigirColunas($leitor, ['Número OS'], $rotulo);

        return [$dic, $qtd];
    }

    private function exigirColunas(LeitorXlsx $leitor, array $obrig, string $rotulo): void
    {
        foreach ($obrig as $c) {
            if (! in_array($c, $leitor->encontradas, true)) {
                throw new RuntimeException("A planilha $rotulo não tem a coluna \"$c\". Confira se é o arquivo certo (cabeçalhos: ".implode(', ', array_slice($leitor->cabecalhos, 0, 12)).'…).');
            }
        }
    }

    // =============================================================== posicao

    /** VERA > XY > Poste > centro da cidade (mediana das OS do mesmo lugar). */
    private function posicoes(array &$novos, array $semCoord, array $acum, array &$res, string $pref, bool $marcarCidade): void
    {
        $st = ['veraComId' => 0, 'veraUsada' => 0, 'posteComId' => 0, 'posteEncontrado' => 0, 'posteUsado' => 0, 'localidadePorPoste' => 0];
        $idsVera = [];
        $idsPoste = [];
        foreach ($novos as $r) {
            if (! empty($r['idVera'])) {
                $idsVera[$r['idVera']] = true;
                $st['veraComId']++;
            }
            if (! empty($r['posteId'])) {
                $idsPoste[$r['posteId']] = true;
                $st['posteComId']++;
            }
        }
        $vera = [];
        foreach (array_chunk(array_keys($idsVera), 5000) as $lote) {
            foreach (DB::table('vera')->whereIn('id_vera', $lote)->whereNotNull('loc')->get(['id_vera', DB::raw('ST_Y(loc) AS lat'), DB::raw('ST_X(loc) AS lng')]) as $v) {
                $vera[$v->id_vera] = [(float) $v->lat, (float) $v->lng];
            }
        }
        $postes = [];
        foreach (array_chunk(array_keys($idsPoste), 5000) as $lote) {
            foreach (DB::table('postes')->whereIn('cod_id', $lote)->get(['cod_id', 'tipo', 'area_local', 'conjunto', 'municipio', DB::raw('ST_Y(loc) AS lat'), DB::raw('ST_X(loc) AS lng')]) as $p) {
                $postes[$p->cod_id] = $p;
            }
        }
        $mun = $this->tabelaMunicipios();
        foreach ($novos as $id => &$r) {
            $loc = &$r['localizacao'];
            $temXY = $loc['lat'] !== null && $loc['lng'] !== null;
            $p = ! empty($r['posteId']) ? ($postes[$r['posteId']] ?? null) : null;
            if ($p) {
                $st['posteEncontrado']++;
                $r['posteTipo'] = $p->tipo;
                $r['posteAreaLocal'] = $p->area_local;
                $r['posteConjunto'] = $p->conjunto;
                $r['posteLat'] = (float) $p->lat;
                $r['posteLng'] = (float) $p->lng;
                $r['posteMun'] = trim((string) $p->municipio);
                if (trim((string) ($r['localidade'] ?? '')) === '' && $r['posteMun'] !== '' && isset($mun[$r['posteMun']])) {
                    $r['localidade'] = $mun[$r['posteMun']];
                    $r['localidadePorPoste'] = true;
                    $st['localidadePorPoste']++;
                }
            }
            $nova = null;
            if (! empty($r['idVera']) && isset($vera[$r['idVera']])) {
                $nova = [$vera[$r['idVera']][0], $vera[$r['idVera']][1], 'VERA'];
                $st['veraUsada']++;
            } elseif ($temXY) {
                $nova = [$loc['lat'], $loc['lng'], 'XY'];
            } elseif ($p) {
                $nova = [(float) $p->lat, (float) $p->lng, 'POSTE'];
                $st['posteUsado']++;
            }
            if ($nova) {
                $loc['lat'] = round($nova[0], 6);
                $loc['lng'] = round($nova[1], 6);
                $loc['aproximada'] = false;
                $loc['origem'] = $nova[2];
            }
            unset($loc);
        }
        unset($r);
        $res += $st;
        $ainda = array_values(array_filter($semCoord, fn ($it) => $novos[$it['id']]['localizacao']['lat'] === null));
        $ap = $this->aproximadas($novos, $ainda, $acum, $marcarCidade);
        $res[$pref.'Aproximadas'] = $ap['aproximadas'];
        $res[$pref.'SemPosicao'] = $ap['semPosicao'];
    }

    /** OS sem posicao: mediana das OS (com XY) da mesma cidade/setor; marca aproximada (e origem CIDADE). */
    private function aproximadas(array &$novos, array $semCoord, array $acum, bool $marcarCidade): array
    {
        $cache = [];
        $ap = 0;
        $sem = 0;
        foreach ($semCoord as $it) {
            $k = $it['chave'];
            if ($k && isset($acum[$k])) {
                $cache[$k] ??= [RegrasGrid::mediana(array_column($acum[$k], 0)), RegrasGrid::mediana(array_column($acum[$k], 1))];
                $loc = &$novos[$it['id']]['localizacao'];
                $loc['lat'] = round($cache[$k][0], 6);
                $loc['lng'] = round($cache[$k][1], 6);
                $loc['aproximada'] = true;
                if ($marcarCidade) {
                    $loc['origem'] = 'CIDADE';
                }
                unset($loc);
                $ap++;
            } else {
                $sem++;
            }
        }

        return ['aproximadas' => $ap, 'semPosicao' => $sem];
    }

    // =============================================================== gravacao

    /**
     * Substitui o lote $fonte. Executado tira do lote pendente as OS que chegaram executadas (idem SIGOD x SIGOD_PENDENTE).
     * OS que ja esta em OUTRO lote nao entra de novo (o banco nao aceita a mesma OS duas vezes; o legado duplicava).
     */
    private function gravarLote(string $fonte, array $novos): array
    {
        $ids = array_keys($novos);
        $ignoradas = 0;
        DB::transaction(function () use ($fonte, &$novos, $ids, &$ignoradas) {
            DB::statement('LOCK TABLE os IN SHARE ROW EXCLUSIVE MODE');
            DB::table('os')->whereNull('loc_fonte')->orWhereNotIn('loc_fonte', self::FONTES)->orWhere('loc_fonte', $fonte)->delete();
            $outro = ['GRID_EXECUTADO' => 'GRID_PENDENTE', 'SIGOD' => 'SIGOD_PENDENTE'][$fonte] ?? null;
            foreach (array_chunk($ids, 5000) as $lote) {
                if ($outro) {
                    DB::table('os')->where('loc_fonte', $outro)->whereIn('id', $lote)->delete();
                }
                foreach (DB::table('os')->whereIn('id', $lote)->pluck('id') as $ja) {
                    unset($novos[$ja]);
                    $ignoradas++;
                }
            }
            $this->copiar(array_values($novos));
        });
        $this->avisar(['fase' => 'gravando', 'arquivo' => 'guardando as OS nas programacoes', 'percentual' => 99]);
        $snaps = $this->sincronizarProgramacoes();
        $concl = 0;
        if ($fonte === 'GRID_EXECUTADO') {
            $this->avisar(['fase' => 'gravando', 'arquivo' => 'conferindo programacoes concluidas', 'percentual' => 99]);
            $concl = $this->concluirProgramacoes();
        }
        $saida = ['programacoesAtualizadas' => $snaps, 'programacoesConcluidas' => $concl];
        if ($ignoradas) {
            $saida['jaEmOutroLote'] = $ignoradas;
        }

        return $saida;
    }

    /** Historico de um plano: 'substituir' apaga o plano e grava; 'acrescentar' junta pelo numero da OS. */
    private function gravarHistorico(int $plano, string $modo, array $novos, ?string $usuario, string $arquivos): array
    {
        $iv = RegrasGrid::intervaloPlano($plano);
        $novas = 0;
        $atualizadas = 0;
        DB::transaction(function () use ($plano, $modo, $novos, &$novas, &$atualizadas) {
            if ($modo === 'acrescentar') {
                foreach (array_chunk(array_keys($novos), 5000) as $lote) {
                    $ja = DB::table('os_historico')->where('plano', $plano)->whereIn('id', $lote)->pluck('id')->all();
                    $atualizadas += count($ja);
                    if ($ja) {
                        DB::table('os_historico')->where('plano', $plano)->whereIn('id', $ja)->delete();
                    }
                }
                $novas = count($novos) - $atualizadas;
            } else {
                DB::table('os_historico')->where('plano', $plano)->delete();
                $novas = count($novos);
            }
            $this->copiar(array_values($novos), $plano);
        });
        $total = DB::table('os_historico')->where('plano', $plano)->count();
        DB::table('historico_planos')->upsert([['plano' => $plano, 'total' => $total, 'inicio' => $iv['inicio'], 'fim' => $iv['fim'], 'atualizado_em' => now(),
            'usuario_id' => $usuario, 'modo' => $modo, 'novas' => $novas, 'atualizadas' => $atualizadas, 'arquivos' => $arquivos]], ['plano'],
            ['total', 'inicio', 'fim', 'atualizado_em', 'usuario_id', 'modo', 'novas', 'atualizadas', 'arquivos']);

        return ['historicoModo' => $modo, 'historicoNovas' => $novas, 'historicoAtualizadas' => $atualizadas, 'historicoTotalNoPlano' => $total];
    }

    private const COLS_OS = ['id', 'origem', 'os_primaria', 'id_vera', 'status_os', 'tipo_servico', 'tipo_equipe_necessaria', 'tipo_equipe_exec', 'prioridade_ew', 'equipe_id',
        'data_abertura', 'data_execucao', 'data_prevista', 'alimentador', 'conjunto', 'protecao_id', 'trecho', 'localidade', 'desc_esquema', 'observacao',
        'loc', 'loc_fonte', 'loc_origem', 'loc_aproximada', 'previsto', 'realizado', 'previsto_poda', 'previsto_limpeza', 'previsto_estrutura',
        'realizado_poda', 'realizado_limpeza', 'realizado_estrutura', 'poste_id', 'poste_tipo', 'poste_area_local', 'poste_conjunto', 'poste_mun', 'poste_loc',
        'previsto_por_esquema', 'localidade_por_poste', 'atualizado_em'];

    /** COPY das OS (formato do legado -> colunas). $plano > 0 grava no historico. */
    private function copiar(array $regs, int $plano = 0): void
    {
        $agora = now()->toIso8601String();
        $cols = self::COLS_OS;
        if ($plano > 0) {
            $cols[] = 'plano';
        }
        $pdo = DB::connection()->getPdo();
        foreach (array_chunk($regs, 10000) as $lote) {
            $linhas = [];
            foreach ($lote as $o) {
                $l = $o['localizacao'] ?? [];
                $v = [$o['id'], $o['origem'] ?? '', self::nn($o['osPrimaria'] ?? null), self::nn($o['idVera'] ?? null), $o['statusOS'] ?? 'Pendente', $o['tipoServico'] ?? '',
                    self::nn($o['tipoEquipeNecessaria'] ?? null), self::nn($o['tipoEquipeExec'] ?? null), (bool) ($o['prioridadeEW'] ?? false), self::nn($o['equipeId'] ?? null),
                    self::nn($o['dataAbertura'] ?? null), self::nn($o['dataExecucao'] ?? null), self::nn($o['dataPrevista'] ?? null),
                    self::nn($o['alimentador'] ?? null), self::nn($o['conjunto'] ?? null), self::nn($o['protecaoId'] ?? null), self::nn($o['trecho'] ?? null),
                    self::nn($o['localidade'] ?? null), self::nn($o['descEsquema'] ?? null), self::nn($o['observacao'] ?? null),
                    self::ponto($l['lat'] ?? null, $l['lng'] ?? null), self::nn($l['fonte'] ?? null), self::nn($l['origem'] ?? null), (bool) ($l['aproximada'] ?? false),
                    $o['previsto'] ?? 0, $o['realizado'] ?? 0, $o['previstoPoda'] ?? 0, $o['previstoLimpeza'] ?? 0, $o['previstoEstrutura'] ?? 0,
                    $o['realizadoPoda'] ?? 0, $o['realizadoLimpeza'] ?? 0, $o['realizadoEstrutura'] ?? 0,
                    self::nn($o['posteId'] ?? null), self::nn($o['posteTipo'] ?? null), self::nn($o['posteAreaLocal'] ?? null), self::nn($o['posteConjunto'] ?? null),
                    self::nn($o['posteMun'] ?? null), self::ponto($o['posteLat'] ?? null, $o['posteLng'] ?? null),
                    array_key_exists('previstoPorEsquema', $o) ? (bool) $o['previstoPorEsquema'] : null,
                    array_key_exists('localidadePorPoste', $o) ? (bool) $o['localidadePorPoste'] : null, $agora];
                if ($plano > 0) {
                    $v[] = $plano;
                }
                $linhas[] = implode("\t", array_map([self::class, 'esc'], $v))."\n";
            }
            if (! $pdo->pgsqlCopyFromArray($plano > 0 ? 'os_historico' : 'os', $linhas, "\t", '@@NULO@@', implode(',', $cols))) {
                throw new RuntimeException('Falha ao gravar as OS no banco.');
            }
        }
    }

    /**
     * Copias das OS dentro das programacoes ativas (osSnap) e das executadas que apontam para elas (execSnap).
     * Nunca apaga; programacao Concluída fica congelada (so entram copias novas). Devolve quantas mudaram.
     */
    private function sincronizarProgramacoes(): int
    {
        $sig = ['statusOS', 'previsto', 'realizado', 'previstoPoda', 'previstoLimpeza', 'previstoEstrutura', 'realizadoPoda', 'realizadoLimpeza', 'realizadoEstrutura',
            'osPrimaria', 'dataExecucao', 'localidade', 'tipoServico'];
        $assin = fn (?array $o) => $o === null ? null : implode('|', array_map(fn ($c) => is_bool($o[$c] ?? null) ? ($o[$c] ? 'True' : 'False') : (string) ($o[$c] ?? ''), $sig));
        $progs = DB::table('programacoes')->where('status', '<>', 'Cancelada')->get(['id', 'status', 'exec_snap'])->keyBy('id');
        if ($progs->isEmpty()) {
            return 0;
        }
        $mudaram = [];
        DB::transaction(function () use ($progs, $assin, &$mudaram) {
            // osSnap: 1 linha por OS programada que existe na base
            $rows = DB::select('SELECT po.programacao_id, po.os_id, po.snapshot, '.ListaOs::OBJETO.'::text AS atual
                FROM programacao_os po JOIN os ON os.id = po.os_id JOIN programacoes p ON p.id = po.programacao_id WHERE p.status <> ?', ['Cancelada']);
            foreach ($rows as $x) {
                $congelada = $progs[$x->programacao_id]->status === 'Concluída';
                $antes = $x->snapshot ? json_decode($x->snapshot, true) : null;
                if ($antes !== null && ($congelada || $assin($antes) === $assin(json_decode($x->atual, true)))) {
                    continue;
                }
                DB::table('programacao_os')->where('programacao_id', $x->programacao_id)->where('os_id', $x->os_id)->update(['snapshot' => $x->atual]);
                $mudaram[$x->programacao_id] = true;
            }
            // execSnap: executadas (filhas) cuja OS-mae esta numa programacao ativa
            $filhas = [];
            foreach (DB::select('SELECT DISTINCT ON (os.id, po.programacao_id) po.programacao_id, os.id, '.ListaOs::OBJETO.'::text AS atual
                FROM os JOIN programacao_os po ON po.os_id = trim(os.os_primaria) JOIN programacoes p ON p.id = po.programacao_id
                WHERE os.status_os = ? AND p.status <> ?', ['Executada', 'Cancelada']) as $f) {
                $filhas[$f->programacao_id][] = json_decode($f->atual, true);
            }
            foreach ($filhas as $pid => $lista) {
                $congelada = $progs[$pid]->status === 'Concluída';
                $exec = json_decode((string) $progs[$pid]->exec_snap, true) ?: [];
                $idx = [];
                foreach ($exec as $i => $e) {
                    $idx[trim((string) ($e['id'] ?? ''))] = $i;
                }
                $mudou = false;
                foreach ($lista as $f) {
                    $k = trim((string) $f['id']);
                    if (isset($idx[$k])) {
                        if ($congelada || $assin($exec[$idx[$k]]) === $assin($f)) {
                            continue;
                        }
                        $exec[$idx[$k]] = $f;
                    } else {
                        $idx[$k] = count($exec);
                        $exec[] = $f;
                    }
                    $mudou = true;
                }
                if ($mudou) {
                    DB::table('programacoes')->where('id', $pid)->update(['exec_snap' => json_encode(array_values($exec), JSON_UNESCAPED_UNICODE)]);
                    $mudaram[$pid] = true;
                }
            }
        });

        return count($mudaram);
    }

    /** Programacao ativa cujas OS estao TODAS executadas (ou com uma executada apontando para ela) vira "Concluída". */
    private function concluirProgramacoes(): int
    {
        $ids = array_column(DB::select("SELECT p.id FROM programacoes p
            WHERE p.status NOT IN ('Cancelada', 'Concluída') AND EXISTS (SELECT 1 FROM programacao_os po WHERE po.programacao_id = p.id)
              AND NOT EXISTS (SELECT 1 FROM programacao_os po WHERE po.programacao_id = p.id
                  AND NOT EXISTS (SELECT 1 FROM os WHERE os.id = po.os_id AND os.status_os = 'Executada')
                  AND NOT EXISTS (SELECT 1 FROM os WHERE trim(os.os_primaria) = trim(po.os_id) AND os.status_os = 'Executada'))"), 'id');
        foreach (array_chunk($ids, 1000) as $lote) {
            DB::table('programacoes')->whereIn('id', $lote)->update(['status' => 'Concluída', 'atualizado_em' => now()]);
            foreach ($lote as $id) {
                DB::table('programacao_log')->insert(['programacao_id' => $id, 'momento' => now(), 'usuario_id' => null, 'acao' => 'status',
                    'resumo' => 'Concluída automaticamente: todas as OS executadas (importação do SGM executado)',
                    'mudancas' => json_encode([['c' => 'status', 'de' => 'Programada', 'para' => 'Concluída']], JSON_UNESCAPED_UNICODE)]);
            }
        }

        return count($ids);
    }

    // =============================================================== tabelas de apoio

    private function tabelaPrioridadeEW(): array
    {
        $m = [];
        foreach (DB::table('prioridade_ew')->get() as $r) {
            $p = mb_strtoupper(trim((string) $r->prioridade));
            $g = mb_strtoupper(trim((string) $r->grupo_recurso));
            if ($p === '' || $g === '') {
                continue;
            }
            $sim = in_array(mb_strtoupper(trim((string) $r->prioridade_ew)), ['SIM', 'S', 'TRUE', '1'], true);
            $k = "$p|$g";
            if (! isset($m[$k]) || $sim) {
                $m[$k] = $sim;
            }
        }

        return $m;
    }

    private function tabelaEsquemas(): array
    {
        $excl = DB::table('exclusoes')->where('base', 'esquemas')->pluck('chave')->flip();
        $t = ['desc' => [], 'cod' => []];
        foreach (DB::table('esquemas')->get() as $r) {
            if (isset($excl[$r->codigo])) {
                continue;
            }
            $tipo = RegrasGrid::tipoEsquema($r->tipo);
            if ($tipo === '') {
                continue;
            }
            if ($d = RegrasGrid::chaveEsquema($r->descricao)) {
                $t['desc'][$d] = $tipo;
            }
            if ($c = RegrasGrid::chaveEsquema($r->codigo)) {
                $t['cod'][$c] = $tipo;
            }
        }

        return $t;
    }

    private function tipoDoEsquema(array $t, string $desc, string $cod): string
    {
        $d = RegrasGrid::chaveEsquema($desc);
        if ($d !== '' && isset($t['desc'][$d])) {
            return $t['desc'][$d];
        }
        $c = RegrasGrid::chaveEsquema($cod);

        return ($c !== '' && isset($t['cod'][$c])) ? $t['cod'][$c] : '';
    }

    /** codigo IBGE -> nome (semente do legado + base "municipios" por cima). */
    private function tabelaMunicipios(): array
    {
        $t = config('spark_municipios', []);
        foreach ($this->legadoBruto('municipios') as $m) {
            if (! empty($m['excluido'])) {
                continue;
            }
            $c = trim((string) ($m['codigo'] ?? ''));
            $n = trim((string) ($m['nome'] ?? ''));
            if ($c !== '' && $n !== '') {
                $t[$c] = $n;
            }
        }

        return $t;
    }

    private function legadoBruto(string $entidade): array
    {
        return json_decode((string) DB::table('legado_bruto')->where('entidade', $entidade)->value('dados'), true) ?: [];
    }

    private function temVao(): bool
    {
        return $this->temVao ??= DB::table('vao_postes')->exists();
    }

    /** PODA LINEAR: limpeza = Rota (km) do vao do poste x 15.000 m2. Poste sem vao -> 0. */
    private function limpezaPodaLinear(?string $poste): float
    {
        $k = trim((string) $poste);
        if ($k === '') {
            return 0.0;
        }
        if (! array_key_exists($k, $this->cacheVao)) {
            $this->cacheVao[$k] = DB::table('vao_postes')->where('poste_id', $k)->value('rota_km');
        }

        return $this->cacheVao[$k] === null ? 0.0 : (float) $this->cacheVao[$k] * 15000.0;
    }

    // =============================================================== utilidades

    private function avisar(array $p, bool $limitar = false): void
    {
        $agora = microtime(true);
        if ($limitar && $this->ultimoAviso !== null && $agora - $this->ultimoAviso < 0.4) {
            return;
        }
        $this->ultimoAviso = $agora;
        ($this->avisar)($p);
    }

    private static function zero(): array
    {
        return ['poda' => 0.0, 'limpeza' => 0.0, 'estrutura' => 0.0];
    }

    private static function quantidades(array $prev, array $real): array
    {
        return ['previsto' => round($prev['poda'], 2), 'realizado' => round($real['poda'], 2),
            'previstoPoda' => round($prev['poda'], 2), 'previstoLimpeza' => round($prev['limpeza'], 2), 'previstoEstrutura' => round($prev['estrutura'], 2),
            'realizadoPoda' => round($real['poda'], 2), 'realizadoLimpeza' => round($real['limpeza'], 2), 'realizadoEstrutura' => round($real['estrutura'], 2)];
    }

    private static function podaLinear($desc): bool
    {
        return str_contains(mb_strtoupper((string) $desc), 'PODA LINEAR');
    }

    private static function tipoEquipeExec($v): string
    {
        $t = trim((string) $v);

        return $t === '' ? 'Livre' : $t;
    }

    private static function nn($v)
    {
        return ($v === '' || $v === null) ? null : $v;
    }

    /** EWKT aceito direto pelo COPY; null se invalido ou 0,0. */
    private static function ponto($lat, $lng): ?string
    {
        if (! is_numeric($lat) || ! is_numeric($lng)) {
            return null;
        }
        $la = (float) $lat;
        $lo = (float) $lng;
        if (abs($la) > 90 || abs($lo) > 180 || ($la == 0.0 && $lo == 0.0)) {
            return null;
        }

        return sprintf('SRID=4326;POINT(%.10F %.10F)', $lo, $la);
    }

    private static function esc($v): string
    {
        if ($v === null) {
            return '@@NULO@@';
        }
        if (is_bool($v)) {
            return $v ? 't' : 'f';
        }
        if (is_float($v)) {
            $v = rtrim(rtrim(sprintf('%.6F', $v), '0'), '.');
        }

        return strtr((string) $v, ['\\' => '\\\\', "\t" => '\\t', "\n" => '\\n', "\r" => '\\r']);
    }
}
