<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\Regras;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RegrasTest extends TestCase
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

    public function test_crud_validar_simular_historico(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $l = $this->getJson('/api/regras', $h)->assertOk()->json();
        $this->assertSame(['poda-linear-executada', 'poda-linear-pendente'], array_column($l['regras'], 'id'));   // semeadas na 1a vez
        $this->assertFalse($l['vaoImportado']);
        $this->assertCount(12, $l['campos']);

        $this->postJson('/api/regras/validar', ['formula' => 'SE([Realizado total] > 0; 1; 0)'], $h)->assertJson(['ok' => true, 'campos' => ['realizadoTotal']]);
        $this->postJson('/api/regras/validar', ['formula' => 'SE(1; 2)'], $h)->assertJson(['ok' => false]);

        $nova = ['nome' => 'Estrutura vira poda', 'ativa' => true, 'aplicaEm' => ['executada'], 'condicoes' => [['campo' => 'esquema', 'op' => 'contem', 'valor' => 'ESTRUTURA']],
            'acoes' => [['campo' => 'realizadoPoda', 'valor' => '[Realizado poda] + [Realizado estrutura]'], ['campo' => 'realizadoEstrutura', 'valor' => '0']]];
        $r = $this->postJson('/api/regras', $nova, $h)->assertCreated()->json();
        $this->assertSame([3, 'Nome a1'], [$r['ordem'], $r['atualizadoPor']]);
        $this->postJson('/api/regras', ['nome' => '', 'aplicaEm' => [], 'acoes' => [['campo' => 'vaoKm', 'valor' => '1']]], $h)->assertStatus(400);

        $sim = $this->postJson('/api/regras/simular', ['regra' => $nova, 'amostra' => ['esquema' => 'TROCA ESTRUTURA', 'realizadoPoda' => '2', 'realizadoEstrutura' => '1,5']], $h)
            ->assertOk()->json();
        $this->assertEquals([true, 3.5, 0], [$sim['aplicou'], $sim['depois']['realizadoPoda'], $sim['depois']['realizadoEstrutura']]);

        $this->putJson('/api/regras/'.$r['id'], ['ativa' => false] + $nova, $h)->assertOk();
        $this->assertCount(1, Regras::ativas('executada'));
        $this->deleteJson('/api/regras/'.$r['id'], [], $h)->assertOk();
        $this->deleteJson('/api/regras/'.$r['id'], [], $h)->assertStatus(404);
        $this->assertSame(['apagada', 'desativada', 'criada'], array_column($this->getJson('/api/regras/historico', $h)->json(), 'acao'));

        // apagar todas nao re-semeia
        DB::table('regras')->delete();
        $this->assertSame([], Regras::todas());

        $sem = $this->usuario('u1', 'Consulta', ['manutencao.visualizar']);
        $this->getJson('/api/regras', $sem)->assertStatus(403);
    }

    public function test_caixas_de_menu_com_tres_estados(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $this->usuario('u1', 'Consulta', ['manutencao.visualizar']);
        $this->putJson('/api/permissoes/u1', ['matriz' => ['manutencao' => ['visualizar' => true], 'historico' => ['visualizar' => false], 'regras' => ['visualizar' => true]]], $h)->assertOk();
        $m = $this->getJson('/api/permissoes/u1', $h)->json();
        $m = $m['matriz'] ?? $m;
        $this->assertSame([false, true], [$m['historico']['visualizar'], $m['regras']['visualizar']]);
        $u = Usuario::find('u1');
        $this->assertFalse($u->podeHistorico());   // desmarcada de proposito, mesmo vendo Manutencao
        $this->assertTrue($u->pode('regras', 'visualizar'));
        DB::table('permissoes')->where('usuario_id', 'u1')->where('modulo', 'historico')->delete();
        $this->assertTrue($u->podeHistorico());    // sem escolha: segue Manutencao
    }
}
