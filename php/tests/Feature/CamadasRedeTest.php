<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CamadasRedeTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $id, string $perfil = 'Consulta', array $perms = []): array
    {
        $u = new Usuario(['id' => $id, 'nome' => "Nome $id", 'email' => "$id@t.local", 'status_conta' => 'Ativo', 'perfil_base' => $perfil]);
        $u->senha_hash = Hash::make('senha-forte-1');
        $u->save();
        foreach ($perms as $p) {
            [$m, $a] = explode('.', $p);
            Permissao::create(['usuario_id' => $id, 'modulo' => $m, 'acao' => $a]);
        }
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.SessaoToken::criar($u, '127.0.0.1', 'teste')];
    }

    private function trecho(string $op, float $comp, array $coords = [[-51.473556, -22.065754], [-51.473717, -22.066001]]): array
    {
        return ['type' => 'Feature', 'properties' => ['COD_ID' => (string) rand(), 'CTMT' => '1378394', 'CT_COD_OP' => $op, 'SUB' => "2\u{0}3", 'COMP' => $comp],
            'geometry' => ['type' => 'LineString', 'coordinates' => $coords]];
    }

    public function test_importar_mapa_exportar_e_apagar(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        // MT com nome vindo dos trechos; BT sem nome (usa o da MT do mesmo CTMT)
        $this->postJson('/api/importacao/camadas/rede_media_tensao/alimentador', ['alimentador' => '1378394', 'features' => [$this->trecho('H2-A8', 31.959), $this->trecho('H2-A8', 27.053)]], $h)
            ->assertOk()->assertJson(['trechos' => 2, 'semGeometria' => 0]);
        $this->postJson('/api/importacao/camadas/rede_baixa_tensao/alimentador', ['alimentador' => '1378394', 'nome' => '1378394', 'metros' => 1000,
            'features' => [['type' => 'Feature', 'properties' => [], 'geometry' => ['type' => 'LineString', 'coordinates' => [[-51.1, -22.1], [-51.2, -22.2]]]], ['type' => 'Feature', 'properties' => []]]], $h)
            ->assertOk()->assertJson(['trechos' => 1, 'semGeometria' => 1]);
        $this->postJson('/api/importacao/camadas/app/alimentador', ['alimentador' => 'AS1C07', 'features' => [['type' => 'Feature', 'properties' => ['APP_M' => '30'],
            'geometry' => ['type' => 'Polygon', 'coordinates' => [[[-51.0364806206841, -21.6612565200239], [-51.03, -21.66], [-51.04, -21.67], [-51.0364806206841, -21.6612565200239]]]]]]], $h)->assertOk();

        // listas do mapa
        $this->getJson('/api/manutencao/camadas', $h)->assertOk()
            ->assertJsonPath('rede_mt_disponiveis', [['ctmt' => '1378394', 'nome' => 'H2-A8']])
            ->assertJsonPath('rede_bt_disponiveis', [['ctmt' => '1378394', 'nome' => 'H2-A8']])
            ->assertJsonPath('app_disponiveis', [['ctmt' => 'AS1C07', 'nome' => 'AS1C07']]);

        // um alimentador: o GeoJSON igual ao do disco (coordenadas exatas; caractere nulo do DBF some)
        $um = json_decode($this->get('/api/manutencao/camadas?ctmt=1378394', $h)->assertOk()->getContent(), true);
        $this->assertSame('FeatureCollection', $um['rede_mt']['type']);
        $this->assertSame([[-51.473556, -22.065754], [-51.473717, -22.066001]], $um['rede_mt']['features'][0]['geometry']['coordinates']);
        $this->assertSame(['COD_ID', 'CTMT', 'CT_COD_OP', 'SUB', 'COMP'], array_keys(array_intersect_key(['COD_ID' => 1, 'CTMT' => 1, 'CT_COD_OP' => 1, 'SUB' => 1, 'COMP' => 1], $um['rede_mt']['features'][0]['properties'])));
        $this->assertSame('23', $um['rede_mt']['features'][0]['properties']['SUB']);
        $poli = json_decode($this->get('/api/manutencao/camadas?app=AS1C07', $h)->getContent(), true);
        $this->assertSame(-51.0364806206841, $poli['app']['features'][0]['geometry']['coordinates'][0][0][0]);
        $this->assertSame('{"rede_at":null}', $this->get('/api/manutencao/camadas?at=NAO', $h)->getContent());

        // todos (NDJSON)
        $linhas = array_map(fn ($l) => json_decode($l, true), array_filter(explode("\n", $this->get('/api/manutencao/camadas?ctmt=__todos__', $h)->streamedContent())));
        $this->assertSame(['alimentador', 'final'], array_column($linhas, 'tipo'));
        $this->assertSame(2, $linhas[1]['totalTrechos']);

        // km: MT pelo COMP, BT pelo "metros" informado
        $this->getJson('/api/manutencao/km-rede-resumo', $h)->assertOk()->assertJson(['porCamadaKm' => ['mt' => 0.06, 'bt' => 1.0, 'at' => 0.0], 'btAtIlustrativo' => false]);

        // exportar e importar de volta (agrupa por _alimentador)
        $exp = json_decode($this->get('/api/importacao/camadas/rede_media_tensao/exportar', $h)->assertOk()->streamedContent(), true);
        $this->assertCount(2, $exp['features']);
        $this->assertSame(['1378394', 'H2-A8'], [$exp['features'][0]['properties']['_alimentador'], $exp['features'][0]['properties']['_alimentadorNome']]);
        $this->postJson('/api/importacao/camadas/rede_media_tensao/alimentador', ['alimentador' => '1378394', 'features' => $exp['features']], $h)->assertOk();
        $this->assertFalse(DB::table('rede_feicoes')->whereRaw("jsonb_exists(atributos, '_alimentador')")->exists());

        // Gestao de Bases: lista, apagar 1, apagar camada
        $this->getJson('/api/importacao/camadas', $h)->assertOk()->assertJsonPath('rede_media_tensao', [['chave' => '1378394', 'nome' => 'H2-A8', 'trechos' => 2]]);
        $this->deleteJson('/api/importacao/camadas/rede_media_tensao/1378394', [], $h)->assertOk();
        $this->deleteJson('/api/importacao/camadas/rede_media_tensao/1378394', [], $h)->assertStatus(404);
        $this->deleteJson('/api/importacao/camadas/xyz?confirmar=sim', [], $h)->assertStatus(400);
        $this->deleteJson('/api/importacao/camadas/rede_baixa_tensao?confirmar=sim', [], $h)->assertOk()->assertJson(['apagados' => 1]);
        $this->assertSame(1, DB::table('rede_feicoes')->count());   // so a APP
    }

    public function test_geometria_invalida_e_permissoes(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $this->postJson('/api/importacao/camadas/app/alimentador', ['alimentador' => 'X', 'features' => [['type' => 'Feature', 'geometry' => ['type' => 'Polygon', 'coordinates' => 'lixo']]]], $h)->assertStatus(400);
        $this->postJson('/api/importacao/camadas/app/alimentador', ['alimentador' => 'X'], $h)->assertStatus(400);

        $ver = $this->usuario('u1', 'Consulta', ['manutencao.visualizar']);
        $this->getJson('/api/importacao/camadas', $ver)->assertOk();
        $this->getJson('/api/manutencao/camadas', $ver)->assertOk();
        $this->postJson('/api/importacao/camadas/app/alimentador', ['alimentador' => 'X', 'features' => []], $ver)->assertStatus(403);
        $this->deleteJson('/api/importacao/camadas/app?confirmar=sim', [], $ver)->assertStatus(403);
        $sem = $this->usuario('u2', 'Consulta', []);
        $this->getJson('/api/manutencao/camadas', $sem)->assertStatus(403);
    }
}
