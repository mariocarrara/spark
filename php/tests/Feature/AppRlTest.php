<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\RedeGeo;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AppRlTest extends TestCase
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

    private function os(string $id, ?float $lat, ?float $lng, bool $aprox = false): void
    {
        DB::table('os')->insert(['id' => $id, 'origem' => 'SGM', 'status_os' => 'Pendente', 'tipo_servico' => 'Poda', 'loc_aproximada' => $aprox]);
        if ($lat !== null) {
            DB::update('UPDATE os SET loc = ST_SetSRID(ST_MakePoint(?, ?), 4326) WHERE id = ?', [$lng, $lat, $id]);
        }
    }

    public function test_indice_config_e_recalculo(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        // quadrado de APP: lng -51.0 a -50.99, lat -22.0 a -21.99 (lado ~1 km)
        RedeGeo::gravarAlimentador('app', 'AL1', [['type' => 'Feature', 'properties' => [],
            'geometry' => ['type' => 'Polygon', 'coordinates' => [[[-51.0, -22.0], [-50.99, -22.0], [-50.99, -21.99], [-51.0, -21.99], [-51.0, -22.0]]]]]]);
        $this->os('DENTRO', -21.995, -50.995);                 // centro: ~516 m da divisa (lat) / ~516 m (lng)
        $this->os('FORA50', -21.995, -51.0 - 50 / (111320 * cos(deg2rad(21.995))));   // 50 m a oeste
        $this->os('LONGE', -21.995, -51.01);                    // ~1 km
        $this->os('APROX', -21.995, -50.995, true);
        $this->os('SEMPOS', null, null);

        $this->getJson('/api/apprl/indice', $h)->assertOk()->assertJson(['geradoEm' => null, 'avaliadas' => 0, 'os' => []]);
        $this->postJson('/api/apprl/recalcular', [], $h)->assertOk()->assertJson(['ok' => true, 'avaliadas' => 3, 'semPosicao' => 2, 'noIndice' => 2]);
        $ind = $this->getJson('/api/apprl/indice', $h)->assertOk()->json();
        $this->assertSame(['AL1'], $ind['alimentadoresApp']);
        $this->assertEqualsWithDelta(-516.1, $ind['os']['DENTRO'][0], 1.0);
        $this->assertEqualsWithDelta(50.0, $ind['os']['FORA50'][0], 0.1);
        $this->assertNull($ind['os']['DENTRO'][1]);
        $this->assertArrayNotHasKey('LONGE', $ind['os']);

        $this->getJson('/api/apprl/config', $h)->assertOk()->assertJson(['toleranciaM' => 15, 'toleranciaMax' => 100]);
        $this->putJson('/api/apprl/config', ['toleranciaM' => '20,5'], $h)->assertOk()->assertJson(['toleranciaM' => 20.5]);
        $this->putJson('/api/apprl/config', ['toleranciaM' => 101], $h)->assertStatus(400);

        $ver = $this->usuario('u1', 'Consulta', ['manutencao.visualizar']);
        $this->getJson('/api/apprl/indice', $ver)->assertOk();
        $this->putJson('/api/apprl/config', ['toleranciaM' => 10], $ver)->assertStatus(403);
        $this->postJson('/api/apprl/recalcular', [], $ver)->assertStatus(403);
    }
}
