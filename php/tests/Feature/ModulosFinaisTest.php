<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** Alertas, Ajuda, Prefeituras, Logistica, Nix e Rank. */
class ModulosFinaisTest extends TestCase
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

    public function test_alertas_e_ajuda(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $this->getJson('/api/alertas/config', $h)->assertOk()->assertExactJson(['valores' => null]);
        $this->putJson('/api/alertas/config', ['raioM' => 50, 'nome' => ''], $h)->assertOk()->assertJson(['valores' => ['raioM' => 50, 'nome' => ''], 'atualizadoPor' => 'Nome a1']);
        $this->getJson('/api/alertas/config', $h)->assertJson(['valores' => ['raioM' => 50, 'nome' => '']]);
        $this->putJson('/api/alertas/tratados', ['tipo' => 'zero', 'chave' => 'OS 1', 'status' => 'Resolvido'], $h)->assertOk();
        $this->putJson('/api/alertas/tratados', ['tipo' => 'xx', 'chave' => 'OS 1', 'status' => 'Resolvido'], $h)->assertStatus(400);
        $this->getJson('/api/alertas/tratados', $h)->assertJson([['tipo' => 'zero', 'chave' => 'OS 1', 'status' => 'Resolvido', 'por' => 'Nome a1']]);
        $this->putJson('/api/alertas/tratados', ['tipo' => 'zero', 'chave' => 'OS 1', 'status' => ''], $h)->assertOk();
        $this->getJson('/api/alertas/tratados', $h)->assertExactJson([]);
        $this->deleteJson('/api/alertas/config', [], $h)->assertOk();

        $lista = $this->getJson('/api/ajuda', $h)->assertOk()->json();   // semeia com o padrao
        $this->assertGreaterThan(5, count($lista));
        $n = $this->postJson('/api/ajuda', ['pergunta' => 'P?', 'resposta' => 'R.'], $h)->assertCreated()->json();
        $this->assertSame(['Geral', count($lista) + 1], [$n['categoria'], $n['ordem']]);
        $this->putJson('/api/ajuda/'.$n['id'], ['excluido' => true], $h)->assertOk();
        $this->assertCount(count($lista), $this->getJson('/api/ajuda', $h)->json());
        $this->putJson('/api/ajuda/'.$n['id'], ['resposta' => ''], $h)->assertStatus(400);

        $ver = $this->usuario('u1', 'Consulta', ['manutencao.visualizar']);
        $this->putJson('/api/alertas/config', ['x' => 1], $ver)->assertStatus(403);
        $this->postJson('/api/ajuda', ['pergunta' => 'P?', 'resposta' => 'R.'], $ver)->assertStatus(403);
    }

    public function test_prefeituras_e_logistica(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        DB::table('legado_bruto')->insert(['entidade' => 'prefeituras', 'dados' => json_encode([['municipio' => 'Tupã', 'contatoNome' => 'X']])]);
        $this->getJson('/api/prefeituras', $h)->assertOk()->assertJson([['municipio' => 'Tupã']]);
        $this->putJson('/api/prefeituras/config/'.rawurlencode('Tupã'), ['tiposOS' => ['Pendente', 'Inventado'], 'kmz' => true], $h)->assertOk()
            ->assertJson(['municipio' => 'Tupã', 'tiposOS' => ['Pendente'], 'kmz' => true]);
        $this->getJson('/api/prefeituras/config', $h)->assertJson([['municipio' => 'Tupã', 'kmz' => true]]);
        $this->putJson('/api/prefeituras/config/'.rawurlencode('Tupã'), [], $h)->assertOk();
        $this->getJson('/api/prefeituras/config', $h)->assertExactJson([]);
        $this->postJson('/api/prefeituras/salvar-pacote', ['nome' => '../x.zip', 'base64' => base64_encode('PK'.str_repeat('a', 30))], $h)->assertStatus(400);
        $this->postJson('/api/prefeituras/salvar-pacote', ['nome' => 'tupa.zip', 'base64' => base64_encode('PK'.str_repeat('a', 30))], $h)->assertOk()->assertJson(['bytes' => 32]);

        $this->getJson('/api/logistica/vinculos', $h)->assertOk()->assertJson(['vinculos' => [], 'estatisticas' => []]);
        $this->getJson('/api/logistica/equipes', $h)->assertOk()->assertExactJson([]);
        $sem = $this->usuario('u1', 'Consulta', []);
        $this->getJson('/api/prefeituras', $sem)->assertStatus(403);
        $this->getJson('/api/logistica/os', $sem)->assertStatus(403);
    }

    public function test_nix(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $this->postJson('/api/nix', ['incluir' => ['e' => 'MAN-1', 'lat' => '-21,9445973', 'lng' => '-50.689']], $h)->assertOk()->assertJsonPath('item.manual', true);
        $r = $this->postJson('/api/nix', ['arquivo' => 'nix.xlsx', 'aba' => 'A', 'itens' => [
            ['e' => 'P1', 'rk' => '1', 'll1' => '-21.9,-50.6', 'll2' => '-21.95;-50.65', 'ppf' => ''], ['e' => 'P2', 'll1' => 'BI'], ['ll1' => '-21,-50']]], $h)->assertOk()->json();
        $this->assertSame([1, 2, 1], [$r['validas'], $r['rejeitadas'], $r['semCoordenada']]);
        $this->assertEquals(['linhas' => 2, 'pontos' => 3, 'raioM' => 500], array_intersect_key($r['meta'], ['linhas' => 1, 'pontos' => 1, 'raioM' => 1]));
        $g = $this->getJson('/api/nix', $h)->assertOk()->json();
        $this->assertSame(['P1', 'MAN-1'], array_column($g['itens'], 'e'));   // manual sobreviveu a planilha
        $this->assertSame([['lat' => -21.9, 'lng' => -50.6], ['lat' => -21.95, 'lng' => -50.65]], $g['itens'][0]['pontos']);
        $this->assertSame(-21.9445973, $g['itens'][1]['pontos'][0]['lat']);
        $this->putJson('/api/nix', ['raioM' => 5], $h)->assertStatus(400);
        $this->putJson('/api/nix', ['raioM' => 800], $h)->assertOk();
        $this->deleteJson('/api/nix?id='.$g['itens'][1]['id'], [], $h)->assertOk();
        $this->deleteJson('/api/nix?id=nao-existe', [], $h)->assertStatus(404);
        $this->assertSame(800, $this->getJson('/api/nix', $h)->json('meta.raioM'));
        $this->deleteJson('/api/nix', [], $h)->assertOk();
        $this->assertNull($this->getJson('/api/nix', $h)->json('meta'));
    }

    public function test_rank(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $this->getJson('/api/rank/atual', $h)->assertOk()->assertExactJson(['lista' => null, 'itens' => []]);
        $r = $this->postJson('/api/rank', ['arquivo' => 'rank.xlsx', 'itens' => [
            ['e' => 'B', 'r' => '2', 'dec' => '0.0017410606703786883', 'di' => '2026-11-03T00:00:00'], ['e' => 'A', 'r' => '1'], ['e' => 'a', 'r' => '3'], ['e' => 'C', 'r' => 'x']]], $h)
            ->assertOk()->json();
        $this->assertSame([2, 2, 1], [$r['validas'], $r['rejeitadas'], $r['lista']['comData']]);
        $l = $this->getJson('/api/rank/atual', $h)->assertOk()->json();
        $this->assertSame(['A', 'B'], array_column($l['itens'], 'e'));
        $this->assertSame(0.0017410606703786883, $l['itens'][1]['dec']);
        $this->assertSame(['2026-11-03', ''], [$l['itens'][1]['di'], $l['itens'][1]['df']]);
        $this->getJson('/api/rank', $h)->assertJsonCount(1);
        $this->deleteJson('/api/rank/xx', [], $h)->assertStatus(400);
        $this->deleteJson('/api/rank/'.$r['lista']['id'], [], $h)->assertOk();
        $this->assertSame(0, DB::table('rank_itens')->count());
    }
}
