<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MetasJustificativasTest extends TestCase
{
    use DatabaseTransactions;

    private array $h;

    protected function setUp(): void
    {
        parent::setUp();
        $this->h = $this->como('a1', 'Administrador');
    }

    private function como(string $id, string $perfil, array $perms = []): array
    {
        $u = new Usuario(['id' => $id, 'nome' => "Nome $id", 'email' => "$id@t.local", 'status_conta' => 'Ativo', 'perfil_base' => $perfil]);
        $u->senha_hash = Hash::make('senha-forte-1');
        $u->save();
        foreach ($perms as $p) {
            [$m, $a] = explode('.', $p);
            Permissao::create(['usuario_id' => $id, 'modulo' => $m, 'acao' => $a]);
        }
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.SessaoToken::criar($u, '127.0.0.1', 't')];
    }

    public function test_metas_criar_atualiza_em_vez_de_duplicar(): void
    {
        $r = $this->postJson('/api/metas', ['equipeId' => 'EQ1', 'anoMes' => '2026-04', 'metaMensal' => 210], $this->h)->assertCreated()
            ->assertJson(['equipeId' => 'EQ1', 'tipo' => 'poda', 'anoMes' => '2026-04', 'metaMensal' => 210, 'diasUteis' => 22, 'metaDiaria' => 9.55, 'origem' => 'Manual', 'atualizadoPor' => 'Nome a1']);
        $id = $r->json('id');
        $this->postJson('/api/metas', ['equipeId' => 'EQ1', 'anoMes' => '2026-04', 'metaMensal' => 220], $this->h)->assertCreated()->assertJson(['id' => $id, 'metaMensal' => 220]);
        $this->postJson('/api/metas', ['equipeId' => 'EQ1', 'anoMes' => '2026-04', 'metaMensal' => 5, 'tipo' => 'Limpeza de faixa'], $this->h)->assertCreated()->assertJson(['tipo' => 'faixa']);
        $this->getJson('/api/metas', $this->h)->assertOk()->assertJsonCount(2);
        $this->postJson('/api/metas', ['equipeId' => 'EQ1', 'anoMes' => '2026-13', 'metaMensal' => 1], $this->h)->assertStatus(400);
    }

    public function test_metas_editar(): void
    {
        DB::table('feriados')->insert(['data' => '2026-05-01', 'descricao' => 'Trabalho']);
        $id = $this->postJson('/api/metas', ['equipeId' => 'EQ1', 'anoMes' => '2026-04', 'metaMensal' => 210], $this->h)->json('id');
        $this->postJson('/api/metas', ['equipeId' => 'EQ1', 'anoMes' => '2026-05', 'metaMensal' => 1], $this->h);
        $this->putJson("/api/metas/$id", ['metaMensal' => 400], $this->h)->assertOk()->assertJson(['metaMensal' => 400, 'anoMes' => '2026-04']);
        $this->putJson("/api/metas/$id", ['anoMes' => '2026-05'], $this->h)->assertStatus(409);   // ja tem meta em maio
        $this->putJson('/api/metas/nao-existe', ['metaMensal' => 1], $this->h)->assertStatus(404);
        // maio/2026: 21 dias uteis menos o feriado de 1/5 = 20
        $this->assertSame(20, DB::table('metas')->where('ano_mes', '2026-05')->value('dias_uteis'));
    }

    public function test_metas_excluidas_na_gestao_nao_aparecem_e_permissoes(): void
    {
        $id = $this->postJson('/api/metas', ['equipeId' => 'EQ1', 'anoMes' => '2026-04', 'metaMensal' => 1], $this->h)->json('id');
        DB::table('exclusoes')->insert(['base' => 'metas', 'chave' => $id]);
        $this->getJson('/api/metas', $this->h)->assertJsonCount(0);
        $h = $this->como('u1', 'Consulta', ['metas.visualizar']);
        $this->getJson('/api/metas', $h)->assertOk();
        $this->postJson('/api/metas', ['equipeId' => 'EQ1', 'anoMes' => '2026-04', 'metaMensal' => 1], $h)->assertStatus(403);
        $this->getJson('/api/metas', $this->como('u2', 'Consulta'))->assertStatus(403);
    }

    public function test_justificativas_uma_por_dia_e_exclusao_logica(): void
    {
        $r = $this->postJson('/api/justificativas', ['equipeId' => 'EQ1', 'data' => '2026-11-04T00:00:00', 'tipo' => 'Chuva', 'texto' => 'choveu'], $this->h)
            ->assertCreated()->assertJson(['equipeId' => 'EQ1', 'data' => '2026-11-04', 'tipo' => 'Chuva', 'autorId' => 'a1']);
        $this->postJson('/api/justificativas', ['equipeId' => 'EQ1', 'data' => '2026-11-04', 'tipo' => 'Outros'], $this->h)->assertStatus(409);
        $this->postJson('/api/justificativas', ['equipeId' => 'EQ1', 'data' => '2026-02-30'], $this->h)->assertStatus(400);
        $this->getJson('/api/justificativas?equipe=EQ1', $this->h)->assertJsonCount(1);
        $this->deleteJson('/api/justificativas/'.$r->json('id'), [], $this->h)->assertOk();
        $this->getJson('/api/justificativas', $this->h)->assertJsonCount(0);
        $this->assertTrue((bool) DB::table('justificativas')->where('id', $r->json('id'))->value('excluido'));
        // excluida libera o dia de novo
        $this->postJson('/api/justificativas', ['equipeId' => 'EQ1', 'data' => '2026-11-04', 'tipo' => 'Outros'], $this->h)->assertCreated();
    }

    public function test_justificativas_permissao_pela_origem(): void
    {
        $prod = $this->como('u1', 'Consulta', ['produtividade.visualizar', 'produtividade.criar']);
        $this->postJson('/api/justificativas', ['equipeId' => 'EQ1', 'data' => '2026-11-04'], $prod)->assertCreated();
        $this->postJson('/api/justificativas', ['equipeId' => 'EQ2', 'data' => '2026-11-04', 'origem' => 'gestao'], $prod)->assertStatus(403);
        $this->deleteJson('/api/justificativas/x', [], $prod)->assertStatus(403);
    }
}
