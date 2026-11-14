<?php

namespace Tests\Feature;

use App\Models\Usuario;
use App\Services\Importacao\ImportadorGrids;
use App\Services\Importacao\LeitorXlsx;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\XlsxTeste as X;
use Tests\TestCase;

/**
 * Grids de OS (SGM executado/pendente, SIGOD, historico) com planilhas montadas no teste.
 * Precisa da extensao zip:  php -d extension=zip artisan test
 */
class ImportacaoGridTest extends TestCase
{
    use DatabaseTransactions;

    private const UTM_X = 500000;      // ponto valido na regiao: lat -22.606856803692228, lng -51

    private const UTM_Y = 7500000;

    protected function setUp(): void
    {
        parent::setUp();
        if (! class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('Extensão zip desligada (rode: php -d extension=zip artisan test).');
        }
        $pt = fn ($lng, $lat) => DB::raw("ST_SetSRID(ST_MakePoint($lng, $lat), 4326)");
        DB::table('vera')->insert(['id_vera' => 'V9', 'especie' => 'IPE', 'loc' => $pt(-50.5, -22.5)]);
        DB::table('postes')->insert(['cod_id' => 'P5', 'tipo' => 'POS', 'area_local' => 'UB', 'conjunto' => 'C1', 'municipio' => '3109105', 'loc' => $pt(-46.1, -22.7)]);
        DB::table('vao_postes')->insert(['poste_id' => '111', 'rota_km' => 0.5]);
        DB::table('esquemas')->insert(['codigo' => 'E1', 'descricao' => 'Poda obrigatória', 'tipo' => 'Poda']);
    }

    private function mo(array $linhas): string
    {
        return X::criar(array_merge([['Número OS', 'DE-PARA RECURSOS.MO 1', 'DE-PARA RECURSOS.MO 2', 'Qtd Poda', 'Qtd Limpeza (M²)', 'Qtd Estrutura']], $linhas));
    }

    private function gridExecutado(array $linhas): string
    {
        return X::criar(array_merge([['Número OS', 'OSPrimária(int)', 'COORDENADA UTM X', 'COORDENADA UTM Y', 'OSFechada?', 'CodSetor', 'Localidade', 'DescEsquema',
            'Observação', 'Prioridade', 'Data de criação', 'Início Execução', 'Término Execução', 'TIPO_EQUIPE_EXEC', 'Complemento de Localização', 'CODIGO DA ARVORE', 'Trecho', 'protecao']], $linhas));
    }

    private function adminCab(): array
    {
        $u = new \App\Models\Usuario(['id' => 'adm-grid', 'nome' => 'Adm', 'email' => 'adm-grid@t.local', 'status_conta' => 'Ativo', 'perfil_base' => 'Administrador']);
        $u->senha_hash = \Illuminate\Support\Facades\Hash::make('senha-forte-1');
        $u->save();

        return ['Authorization' => 'Bearer '.\App\Services\SessaoToken::criar($u, '127.0.0.1', 'teste')];
    }

    private function os(string $id): array
    {
        $o = DB::selectOne('SELECT *, ST_Y(loc) AS lat, ST_X(loc) AS lng FROM os WHERE id = ?', [$id]);

        return $o ? (array) $o : [];
    }

    public function test_leitor_xlsx_casa_cabecalho_como_o_legado(): void
    {
        $arq = X::criar([[' NÚMERO  OS ', "Qtd\u{00A0}Poda", 'Outra'], ['A 1', 2.5, 'x'], ['A 2', null, 'y']]);
        $l = new LeitorXlsx($arq, ['Número OS', 'Qtd Poda', 'Não Existe']);
        $linhas = iterator_to_array($l->linhas(), false);
        $this->assertSame([['Número OS' => 'A 1', 'Qtd Poda' => '2.5', 'Não Existe' => null], ['Número OS' => 'A 2', 'Qtd Poda' => null, 'Não Existe' => null]], $linhas);
        $this->assertSame(['Número OS', 'Qtd Poda'], $l->encontradas);
        $this->assertSame(2, $l->totalEstimado);
    }

    public function test_sgm_executado_regras_do_legado(): void
    {
        // lote pendente atual: EQA 0002 (vai sair, chegou executada) e EQA 0099 (fica)
        DB::table('os')->insert([
            ['id' => 'EQA 0002', 'origem' => 'SGM', 'status_os' => 'Pendente', 'tipo_servico' => 'Poda', 'loc_fonte' => 'GRID_PENDENTE'],
            ['id' => 'EQA 0099', 'origem' => 'SGM', 'status_os' => 'Pendente', 'tipo_servico' => 'Poda', 'loc_fonte' => 'GRID_PENDENTE'],
        ]);
        // programacao da OS-mae MAE 9 (sera atendida pela filha EQA 0001) e outra da EQA 0099
        $p1 = '11111111-1111-1111-1111-111111111111';
        $p2 = '22222222-2222-2222-2222-222222222222';
        foreach ([[$p1, 'MAE 9'], [$p2, 'EQA 0099']] as [$pid, $os]) {
            DB::table('programacoes')->insert(['id' => $pid, 'status' => 'Programada', 'data_inicio' => '2026-03-01', 'data_fim' => '2026-03-02', 'criado_em' => now(), 'atualizado_em' => now()]);
            DB::table('programacao_os')->insert(['programacao_id' => $pid, 'os_id' => $os, 'ordem' => 0]);
        }

        $moExec = $this->mo([['EQA 0001', 'Poda', 'Poda', 1, 0, 0], ['EQA 0001', 'Poda', '', 1, 0, 0], ['EQA 0002', 'Faixa', 'Limpeza de Faixa', 0, 10, 0], ['EQA 0004', 'Poda', 'Poda', 3, 0, 0]]);
        $moPend = $this->mo([['EQA 0001', 'Poda', 'Poda', 5, 0, 0], ['MAE 9', 'Poda', 'Poda', '4', 0, 0], ['MAE 7', 'Estrutura', 'Estrutura', 0, 0, '2,0']]);
        $d = X::serial('2026-03-10');
        $grid = $this->gridExecutado([
            ['EQA 0001', 'MAE 9', self::UTM_X, self::UTM_Y, 'SIM', 'ALM-1', 'ASSIS 6001-218', 'Esquema X', 'obs Ã¡rvore', 'ALTA', $d - 30, $d, $d, '', '218-999', 'V9', 't3', 'V100-1'],
            ['EQA 0002', '', '', '', 'NÃO', 'ALM-1', 'ASSIS 6001-218', '', '', 'BAIXA', $d - 30, $d, '', 'LV', '', '-', '', ''],
            ['EQA 0003', 'MAE 7', self::UTM_X, self::UTM_Y, 'SIM', 'ALM-2', 'CAMBUI 1', '', '', 'URGENTE', $d, $d, $d, '', '', '', '', ''],
            ['EQA 0004', '', self::UTM_X, self::UTM_Y, 'SIM', 'ALM-3', 'CAMBUI 1', 'PODA LINEAR 1', '', 'BAIXA', $d, $d, $d, '', '218-111', '', '', ''],
            ['EQA 0005', '', self::UTM_X, self::UTM_Y, 'SIM', 'ALM-3', 'CAMBUI 1', '', '', '', $d, $d, $d, '', '', '', '', ''],
        ]);
        $res = (new ImportadorGrids)->executado($grid, $moExec, $moPend);

        $this->assertSame([5, 1, 1, 4, 1, true, 1, 1], [$res['executadoTotal'], $res['executadoSemMO'], $res['executadoSemCoordenada'], $res['totalPlotadas'],
            $res['executadoSoPrevisto'], $res['previstoCalculado'], $res['podaLinear'], $res['programacoesConcluidas']]);

        $o1 = $this->os('EQA 0001');
        $this->assertSame(['Executada', 'Poda', 'EQA', 'MAE 9', 'ASSIS', 'T3', 'V100-1', 'Livre', '2026-03-10', 'obs árvore', 'VERA', '999', true],
            [$o1['status_os'], $o1['tipo_servico'], $o1['equipe_id'], $o1['os_primaria'], $o1['localidade'], $o1['trecho'], $o1['protecao_id'], $o1['tipo_equipe_exec'],
                $o1['data_execucao'], $o1['observacao'], $o1['loc_origem'], $o1['poste_id'], $o1['prioridade_ew']]);
        $this->assertEquals([4, 2, 2], [(float) $o1['previsto_poda'], (float) $o1['realizado_poda'], (float) $o1['realizado']]);   // previsto da OS-mae
        $this->assertEquals([-22.5, -50.5], [(float) $o1['lat'], (float) $o1['lng']]);   // posicao da arvore (VERA)

        $o2 = $this->os('EQA 0002');   // sem coordenada: centro de ASSIS (mediana das OS de ASSIS com XY), marcada aproximada
        $this->assertSame(['Despachada', 'Limpeza de Faixa', 'GRID_EXECUTADO', true, 'CIDADE', 'LV'], [$o2['status_os'], $o2['tipo_servico'], $o2['loc_fonte'], $o2['loc_aproximada'], $o2['loc_origem'], $o2['tipo_equipe_exec']]);
        $this->assertEqualsWithDelta(-22.606857, (float) $o2['lat'], 1e-6);

        $o3 = $this->os('EQA 0003');   // sem MO executada, mas com previsto da mae: entra so com previsto
        $this->assertSame('Estrutura', $o3['tipo_servico']);
        $this->assertEquals([2, 0], [(float) $o3['previsto_estrutura'], (float) $o3['realizado_estrutura']]);

        $o4 = $this->os('EQA 0004');   // PODA LINEAR: limpeza = 0,5 km x 15.000 m2
        $this->assertSame('Limpeza de Faixa', $o4['tipo_servico']);
        $this->assertEquals([7500, 0, 0], [(float) $o4['realizado_limpeza'], (float) $o4['realizado_poda'], (float) $o4['previsto_poda']]);

        // v3.21-v3.23: criticidade do SGM, Recurso (MO 1) e linhas da MO para a Medicao
        $this->assertSame(['ALTA', 'Poda', null], [$o1['prioridade'], $o1['recurso_mo'], $o1['num_obra']]);
        $this->assertSame(['Faixa', 'URGENTE', 'Estrutura'], [$o2['recurso_mo'], $o3['prioridade'], $o3['recurso_mo']]);   // 0003 sem MO executada: recurso da mae na MO pendente
        $this->assertSame(4, $res['moLinhasGravadas']);
        $this->assertSame([['EQA 0001', 'Poda', 'Poda', 1, 0, 0], ['EQA 0001', 'Poda', '', 1, 0, 0]],
            array_slice(json_decode($this->get('/api/medicao/mo', $this->adminCab())->assertOk()->getContent(), true)['linhas'], 0, 2));
        $noMapa = json_decode(DB::selectOne('SELECT '.\App\Services\ListaOs::OBJETO.'::text AS j FROM os WHERE id = ?', ['EQA 0001'])->j, true);
        $this->assertSame(['ALTA', 'Poda'], [$noMapa['prioridade'], $noMapa['recursoMo']]);   // o mapa recebe os campos novos

        $this->assertSame([], $this->os('EQA 0005'));   // sem MO e sem mae: descartada
        $this->assertSame(['EQA 0099'], DB::table('os')->where('loc_fonte', 'GRID_PENDENTE')->pluck('id')->all());
        // programacao da mae concluida sozinha, com a executada guardada; a outra continua
        $this->assertSame('Concluída', DB::table('programacoes')->where('id', $p1)->value('status'));
        $this->assertSame(['EQA 0001'], array_column(json_decode(DB::table('programacoes')->where('id', $p1)->value('exec_snap'), true), 'id'));
        $this->assertSame('Programada', DB::table('programacoes')->where('id', $p2)->value('status'));
        $this->assertSame('EQA 0099', json_decode(DB::table('programacao_os')->where('programacao_id', $p2)->value('snapshot'), true)['id']);

        // reimportar o mesmo executado nao duplica
        (new ImportadorGrids)->executado($grid, $moExec, $moPend);
        $this->assertSame(4, DB::table('os')->where('loc_fonte', 'GRID_EXECUTADO')->count());
    }

    public function test_sgm_pendente_esquema_poste_e_lote_executado(): void
    {
        DB::table('os')->insert(['id' => 'EQB 9', 'origem' => 'SGM', 'status_os' => 'Executada', 'tipo_servico' => 'Poda', 'loc_fonte' => 'GRID_EXECUTADO']);
        $moPend = $this->mo([['EQB 1', 'Poda', 'Poda', 3, 0, 0], ['EQB 9', 'Poda', 'Poda', 1, 0, 0], ['EQB 4', 'Poda', 'Poda', 1, 0, 0]]);
        $grid = X::criar([
            ['OSNumero', 'CodEsquema', 'COORDENADA UTM X', 'COORDENADA UTM Y', 'CodEstado', 'CodSetor', 'Localidade', 'DescEsquema', 'Observação', 'CodPrioridade', 'DataCriação', 'TIPO_EQUIPE_EXEC', 'Complemento de Localização', 'CODIGO DA ARVORE', 'Trecho', 'protecao'],
            ['EQB 1', 'X', self::UTM_X, self::UTM_Y, 'A REPROGRAMAR', 'S1', 'ASSIS 1', 'Desc', '', 'EMERGENCIAL', X::serial('2026-01-05'), '', '', '', '', ''],
            ['EQB 2', 'E1', self::UTM_X, self::UTM_Y, 'CRIADA', 'S1', 'ASSIS 1', 'outra', '', '', X::serial('2026-01-05'), '', '', '', '', ''],
            ['EQB 3', 'ZZ', self::UTM_X, self::UTM_Y, 'CRIADA', 'S1', 'ASSIS 1', 'nada', '', '', X::serial('2026-01-05'), '', '', '', '', ''],
            ['EQB 4', 'X', '', '', 'DESPACHADA', 'S2', '', '', '', '', X::serial('2026-01-05'), '', '218-P5', '', '', ''],
            ['EQB 9', 'X', self::UTM_X, self::UTM_Y, 'CRIADA', 'S1', 'ASSIS 1', '', '', '', X::serial('2026-01-05'), '', '', '', '', ''],
        ]);
        $res = (new ImportadorGrids)->pendente($grid, $moPend, null);
        $this->assertSame([5, 1, 1, 1, 3], [$res['pendenteTotal'], $res['pendenteSemMO'], $res['pendentePrevistoPorEsquema'], $res['jaEmOutroLote'], $res['totalPlotadas'] - $res['jaEmOutroLote']]);

        $o1 = $this->os('EQB 1');
        $this->assertSame(['A reprogramar', true, '2026-01-05'], [$o1['status_os'], $o1['prioridade_ew'], $o1['data_abertura']]);
        $o2 = $this->os('EQB 2');   // sem MO, esquema da base "Esquemas": previsto 1 poda
        $this->assertSame([true, 'Poda'], [$o2['previsto_por_esquema'], $o2['tipo_servico']]);
        $this->assertEquals(1, (float) $o2['previsto_poda']);
        $o4 = $this->os('EQB 4');   // sem XY: posicao e cidade pelo poste
        $this->assertSame(['POSTE', 'BUENO BRANDAO', true, 'Despachada'], [$o4['loc_origem'], $o4['localidade'], $o4['localidade_por_poste'], $o4['status_os']]);
        $this->assertEquals([-22.7, -46.1], [(float) $o4['lat'], (float) $o4['lng']]);
        $this->assertSame('Executada', $this->os('EQB 9')['status_os']);   // a executada continua valendo
    }

    public function test_sigod_e_sigod_pendente(): void
    {
        $d = X::serial('2026-02-01');
        $base = X::criar([
            ['NUMOS', 'DATA_SOL', 'VLR_COORDENADA_LATITUDE', 'VLR_COORDENADA_LONGITUDE', 'NUM_ALIMENTADOR', 'EQUIPE', 'DH_ALOCACAO', 'DTH_FIM_EXECUCAO', 'TIPO_PODA', 'NOM_LOGRADOURO', 'NUM_CASA', 'DSC_BAIRRO', 'CODLCD', 'LOCALIDADE'],
            ['88976420.0', $d, '-22,1', '-50,2', 'A1', 'EQS1', $d, $d + 1, 'PODA PLANTAO', 'RUA X', '10', 'CENTRO', '', 'ASSIS'],
            ['555', $d, '', '', 'A1', '', '', '', 'PODA', '', '', '', '', 'ASSIS'],
        ]);
        $r = (new ImportadorGrids)->sigod($base);
        $this->assertSame([2, 1, 1, 1, 1], [$r['sigodTotal'], $r['sigodExecutadas'], $r['sigodPlantao'], $r['sigodSemCoordenada'], $r['sigodAproximadas']]);
        $o = $this->os('SIGOD-88976420');
        $this->assertSame(['Executada', 'EQS1', 'PODA PLANTAO - RUA X, 10 - CENTRO', 'ASSIS'], [$o['status_os'], $o['equipe_id'], $o['observacao'], $o['conjunto']]);
        $this->assertSame(['Pendente', true, 'CIDADE'], [$this->os('SIGOD-555')['status_os'], $this->os('SIGOD-555')['loc_aproximada'], $this->os('SIGOD-555')['loc_origem']]);

        $pend = X::criar([
            ['numos', 'datasol', 'dataprev', 'codlcd', 'nomelcd', 'vlrcdn_x', 'vlrcdn_y', 'sitos', 'dscsvc', 'codserv', 'obsos', 'dsclgr_os', 'numcasa', 'bairro', 'codreg'],
            ['88976420', $d, $d, '1', 'ASSIS 1', self::UTM_X, self::UTM_Y, '', '', '77', '', 'RUA Y', '', '', ''],   // ja esta no SIGOD executado
            ['777', $d, $d + 10, '1', 'ASSIS 1', '' . self::UTM_X, (string) self::UTM_Y, '', '', '324', '', 'RUA Z', '5', 'VILA', ''],
            ['777', $d, $d, '1', 'ASSIS 1', '', '', '', '', '77', '', '', '', '', ''],   // repetida: vale a primeira
        ]);
        $r = (new ImportadorGrids)->sigodPendente($pend);
        $this->assertSame([3, 1, 1], [$r['sigodPendTotal'], $r['sigodPendJaExecutadas'], $r['totalPlotadas']]);
        $o = $this->os('SIGOD-777');
        $this->assertSame(['Pendente', 'Poda de árvore operação (324) - RUA Z, 5 - VILA', 'SIGOD_PENDENTE'], [$o['status_os'], $o['observacao'], $o['loc_fonte']]);
        $this->assertEqualsWithDelta(-22.606857, (float) $o['lat'], 1e-6);
        $this->assertSame('Executada', $this->os('SIGOD-88976420')['status_os']);
    }

    public function test_historico_por_plano(): void
    {
        $moExec = $this->mo([['EQH 1', 'Poda', 'Poda', 1, 0, 0], ['EQH 2', 'Poda', 'Poda', 1, 0, 0], ['EQH 3', 'Poda', 'Poda', 1, 0, 0]]);
        $grid = $this->gridExecutado([
            ['EQH 1', '', self::UTM_X, self::UTM_Y, 'SIM', 'A', 'ASSIS 1', '', 'obs', '', X::serial('2026-01-01'), X::serial('2026-03-10'), X::serial('2026-03-10'), '', '', '', '', ''],
            ['EQH 2', '', self::UTM_X, self::UTM_Y, 'SIM', 'A', 'ASSIS 1', '', '', '', X::serial('2024-01-01'), X::serial('2024-03-10'), X::serial('2024-03-10'), '', '', '', '', ''],
            ['EQH 3', '', self::UTM_X, self::UTM_Y, 'SIM', 'A', 'ASSIS 1', '', '', '', '', '', '', '', '', '', '', ''],
        ]);
        $r = (new ImportadorGrids)->executado($grid, $moExec, null, 2026, 'substituir', 'u1', 'a.xlsx');
        $this->assertSame([1, 1, 1, ['2024' => 1], 1], [$r['historicoNovas'], $r['historicoForaDoPlano'], $r['historicoSemData'], $r['historicoForaPorPlano'], $r['historicoTotalNoPlano']]);
        $this->assertSame(0, DB::table('os')->count());   // historico nao mexe na base de hoje
        $h = DB::table('os_historico')->where('plano', 2026)->first();
        $this->assertSame(['EQH 1', null], [$h->id, $h->observacao]);
        $this->assertSame(1, DB::table('historico_planos')->where('plano', 2026)->value('total'));
    }

    public function test_rota_com_progresso_em_ndjson(): void
    {
        $u = new Usuario(['id' => 'a1', 'nome' => 'A', 'email' => 'a1@t.local', 'status_conta' => 'Ativo', 'perfil_base' => 'Administrador']);
        $u->senha_hash = Hash::make('senha-forte-1');
        $u->save();
        $h = ['Authorization' => 'Bearer '.SessaoToken::criar($u, '127.0.0.1', 't')];
        $base = X::criar([['NUMOS', 'VLR_COORDENADA_LATITUDE', 'VLR_COORDENADA_LONGITUDE'], ['1', '-22.1', '-50.2']]);
        $r = $this->post('/api/importacao/podas-sigod', ['basePoda' => new UploadedFile($base, 'basePoda.xlsx', null, null, true)], $h);
        $linhas = array_map(fn ($l) => json_decode($l, true), array_filter(explode("\n", $r->streamedContent())));
        $this->assertSame('progresso', $linhas[0]['tipo']);
        $final = end($linhas);
        $this->assertSame(['final', 1, 'Podas — SIGOD (OS)'], [$final['tipo'], $final['resumo']['totalPlotadas'], $final['log']['base']]);
        $this->assertSame(1, DB::table('importacoes_log')->where('base', 'Podas — SIGOD (OS)')->count());

        $faltando = $this->post('/api/importacao/podas-executado', [], $h)->streamedContent();
        $this->assertStringContainsString('Faltou o arquivo: SGM_EXECUTADO, MO_EXECUTADA', $faltando);
    }
}
