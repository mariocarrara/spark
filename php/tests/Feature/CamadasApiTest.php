<?php

namespace Tests\Feature;

use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CamadasApiTest extends TestCase
{
    use DatabaseTransactions;

    private array $h;

    protected function setUp(): void
    {
        parent::setUp();
        File::deleteDirectory(storage_path('app/cache'));
        $u = new Usuario(['id' => 'a1', 'nome' => 'A', 'email' => 'a1@t.local', 'status_conta' => 'Ativo', 'perfil_base' => 'Administrador']);
        $u->senha_hash = Hash::make('senha-forte-1');
        $u->save();
        $this->h = ['Authorization' => 'Bearer '.SessaoToken::criar($u, '127.0.0.1', 't')];

        $pt = fn ($lng, $lat) => DB::raw("ST_SetSRID(ST_MakePoint($lng, $lat), 4326)");
        DB::table('vera')->insert([['id_vera' => 'V1', 'especie' => 'IPÊ', 'loc' => $pt(-50.0, -22.0)], ['id_vera' => 'V2', 'especie' => 'X', 'loc' => null]]);
        DB::table('postes')->insert([
            ['cod_id' => 'P1', 'tipo' => 'POS', 'area_local' => 'UB', 'conjunto' => 'C1', 'loc' => $pt(-50.0, -22.0)],
            ['cod_id' => 'P2', 'tipo' => 'TOR', 'area_local' => 'NU', 'conjunto' => 'C1', 'loc' => $pt(-50.01, -22.01)],
            ['cod_id' => 'P3', 'tipo' => 'POS', 'area_local' => 'UB', 'conjunto' => 'C2', 'loc' => $pt(-49.0, -21.0)],
        ]);
        DB::table('equipamentos')->insert([
            ['camada' => 'trafos', 'cod_id' => 'T1', 'poste' => 'P1', 'v1' => 'PT', 'nome_operativo' => 'TR-1301', 'loc' => $pt(-50.0, -22.0)],
            ['camada' => 'protecoes', 'cod_id' => 'F1', 'poste' => 'P1', 'v0' => '22', 'nome_operativo' => null, 'loc' => $pt(-50.0, -22.0)],  // fusivel do trafo T1
            ['camada' => 'protecoes', 'cod_id' => 'F2', 'poste' => 'P2', 'v0' => '22', 'nome_operativo' => null, 'loc' => $pt(-50.01, -22.01)], // fusivel sem trafo
            ['camada' => 'protecoes', 'cod_id' => 'R1', 'poste' => 'P2', 'v0' => '33', 'nome_operativo' => 'V100-1', 'loc' => $pt(-50.01, -22.01)],
        ]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path('app/cache'));
        parent::tearDown();
    }

    private const BOX = 'sul=-22.5&oeste=-50.5&norte=-21.5&leste=-49.5';

    public function test_vera_em_ndjson(): void
    {
        $r = $this->get('/api/manutencao/vera-mapa', $this->h)->assertOk();
        $linhas = array_map('json_decode', array_filter(explode("\n", $r->streamedContent())));
        $this->assertEquals([[-22.0, -50.0, 'V1', 'IPÊ', null, null]], $linhas[0]->pontos);   // v3.32.1: + alimentador e cidade
        $this->assertSame(['lote', 'final', 1], [$linhas[0]->tipo, $linhas[1]->tipo, $linhas[1]->total]);
    }

    public function test_postes_no_retangulo_e_filtro_de_tipo(): void
    {
        $r = $this->getJson('/api/postes/area?'.self::BOX, $this->h)->assertOk()->json();
        $this->assertSame([2, false, ['POS', 'TOR']], [$r['total'], $r['truncado'], $r['tipos']]);
        $this->assertEquals(['P1', 'POS', 'UB', 'C1', -22.0, -50.0], collect($r['pontos'])->firstWhere(0, 'P1'));
        $this->assertSame(1, $this->getJson('/api/postes/area?'.self::BOX.'&tipos=tor', $this->h)->json('total'));
        $this->getJson('/api/postes/area?'.self::BOX.'&limite=1', $this->h)->assertJson(['total' => 2, 'truncado' => true]);
        $this->getJson('/api/postes/area?sul=x', $this->h)->assertStatus(400);
        $this->getJson('/api/postes/lista?busca=c2', $this->h)->assertJson(['total' => 1, 'linhas' => [['codId' => 'P3']]]);
        $this->getJson('/api/postes/resumo', $this->h)->assertJson(['total' => 3, 'porTipo' => ['POS' => 2, 'TOR' => 1]]);
    }

    public function test_fusivel_do_trafo_nao_aparece(): void
    {
        $ids = array_column($this->getJson('/api/equip/area?camada=protecoes&'.self::BOX, $this->h)->assertOk()->json('itens'), 0);
        sort($ids);
        $this->assertSame(['F2', 'R1'], $ids);
        $this->assertSame(['trafos'], array_keys($this->getJson('/api/equip/poste?id=P1', $this->h)->json()));
        $this->assertSame(['T1', 'P1'], array_slice($this->getJson('/api/equip/poste?id=P1', $this->h)->json('trafos.0'), 0, 2));
        $this->getJson('/api/equip/area?camada=inventada&'.self::BOX, $this->h)->assertStatus(400);
    }

    public function test_lista_busca_pelo_nome_operativo_e_resumo(): void
    {
        DB::table('importacoes_log')->insert(['id' => 'i1', 'data_hora' => '2026-10-19 08:03:50-03', 'usuario_id' => 'a1', 'base' => 'Equipamentos — Trafos', 'registros_processados' => 1, 'registros_com_erro' => 0]);
        $this->getJson('/api/equip/lista?camada=trafos&busca=TR-13', $this->h)->assertJson(['total' => 1, 'itens' => [['T1', 'P1']]]);
        $this->assertSame('TR-1301', $this->getJson('/api/equip/lista?camada=trafos', $this->h)->json('itens.0.11'));
        $r = $this->getJson('/api/equip/resumo', $this->h)->assertOk()->json();
        $this->assertSame([1, ['PT' => 1], 'a1'], [$r['trafos']['total'], $r['trafos']['porTipo'], $r['trafos']['atualizadoPor']]);
        $this->assertMatchesRegularExpression('/^2026-10-19T08:03:50-03:00$/', $r['trafos']['atualizadoEm']);
        $this->assertSame(3, $r['protecoes']['total']);
    }

    public function test_cadastro_da_protecao(): void
    {
        DB::statement("INSERT INTO protecoes (protecao_id, protecao2, alimentador, trecho) VALUES ('V100-1', 'D-9', 'ALM-01', 'T2')");
        $this->getJson('/api/equip/cadastro?nome=v100-1', $this->h)->assertJson(['achou' => true, 'disjuntor' => 'D-9', 'alimentador' => 'ALM-01']);
        $this->getJson('/api/equip/cadastro?nome=nada', $this->h)->assertJson(['achou' => false]);
    }
}
