<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CadastrosApiTest extends TestCase
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

    public function test_equipes_criar_editar_com_base_geografica(): void
    {
        $adm = $this->usuario('a1', 'Administrador');
        $this->postJson('/api/equipes', ['id' => 'EQ-01', 'tipoEquipe' => 'LM', 'polo' => 'Polo A', 'equipePoda' => true, 'baseLat' => -15.6, 'baseLng' => -56.1], $adm)
            ->assertCreated()->assertJson(['id' => 'EQ-01', 'nome' => 'EQ-01', 'equipePoda' => true, 'ativo' => true, 'baseLat' => -15.6, 'baseLng' => -56.1]);
        $this->postJson('/api/equipes', ['id' => 'EQ-01'], $adm)->assertStatus(409);

        $this->putJson('/api/equipes/EQ-01', ['nome' => 'Equipe 01', 'ativo' => false, 'campoInventado' => 'x'], $adm)
            ->assertOk()->assertJson(['nome' => 'Equipe 01', 'ativo' => false, 'baseLat' => -15.6]);
        $this->assertSame('POINT(-56.1 -15.6)', DB::selectOne("SELECT ST_AsText(base) t FROM equipes WHERE id='EQ-01'")->t);

        $this->getJson('/api/equipes', $adm)->assertOk()->assertJsonFragment(['id' => 'EQ-01', 'polo' => 'Polo A']);
        $this->putJson('/api/equipes/NAO', ['nome' => 'x'], $adm)->assertStatus(404);
    }

    public function test_equipes_sem_permissao(): void
    {
        $this->usuario('a1', 'Administrador');
        DB::table('equipes')->insert(['id' => 'EQ-02', 'nome' => 'EQ-02']);
        $h = $this->usuario('u1', 'Consulta', ['manutencao.visualizar', 'manutencao.editar']); // falta importar
        $this->getJson('/api/equipes', $h)->assertOk();
        $this->postJson('/api/equipes', ['id' => 'X'], $h)->assertStatus(403);
        $this->putJson('/api/equipes/EQ-02', ['nome' => 'invadido'], $h)->assertStatus(403);
    }

    public function test_feriados(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $this->postJson('/api/feriados', ['data' => '2026-02-30', 'descricao' => 'x'], $h)->assertStatus(400);
        $this->postJson('/api/feriados', ['data' => '2026-12-25', 'descricao' => 'Natal'], $h)->assertCreated();
        $this->postJson('/api/feriados', ['data' => '2026-12-25', 'descricao' => 'Natal!', 'abrangencia' => 'Nacional'], $h)->assertCreated(); // atualiza, nao duplica
        $this->getJson('/api/feriados', $h)->assertOk()->assertExactJson([['data' => '2026-12-25', 'descricao' => 'Natal!', 'abrangencia' => 'Nacional']]);
        $this->postJson('/api/feriados', ['data' => '2026-11-15', 'descricao' => 'x'], $this->usuario('u1'))->assertStatus(403);
    }

    public function test_listas_semeia_e_edita(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $l = $this->getJson('/api/listas', $h)->assertOk()->json();
        $this->assertSame(['plano', 'equipeNecessaria', 'justificativaTipo'], array_keys($l));
        $this->assertSame('Alimentadores Sensíveis', $l['plano'][0]['nome']);

        $this->postJson('/api/listas', ['lista' => 'plano', 'nome' => 'arsesp'], $h)->assertStatus(409); // repetido (ignora maiusculas)
        $this->postJson('/api/listas', ['lista' => 'inventada', 'nome' => 'x'], $h)->assertStatus(400);
        $novo = $this->postJson('/api/listas', ['lista' => 'plano', 'nome' => 'Plano Novo'], $h)->assertCreated()->json();
        $this->assertSame(15, $novo['ordem']);
        $this->putJson("/api/listas/{$novo['id']}", ['ativo' => false], $h)->assertOk()->assertJson(['ativo' => false]);
        $this->putJson("/api/listas/{$novo['id']}", ['excluido' => true], $h)->assertOk();
        $this->assertCount(14, $this->getJson('/api/listas', $h)->json('plano'));

        $this->deleteJson('/api/listas?lista=plano', [], $h)->assertStatus(400);
        $this->deleteJson('/api/listas?lista=plano&confirmar=sim', [], $h)->assertOk()->assertJson(['apagados' => 14]);
        $this->assertCount(0, $this->getJson('/api/listas', $h)->json('plano'));
    }

    public function test_indisponibilidades(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $this->postJson('/api/indisponibilidades', ['equipeId' => 'EQ-1', 'dataInicio' => '2026-11-10', 'dataFim' => '2026-11-09', 'tipo' => 'Férias'], $h)->assertStatus(400);
        $id = $this->postJson('/api/indisponibilidades', ['equipeId' => 'EQ-1', 'dataInicio' => '2026-11-10', 'dataFim' => '2026-11-12', 'tipo' => 'Férias', 'texto' => 'ok'], $h)
            ->assertCreated()->assertJson(['equipeId' => 'EQ-1', 'dataInicio' => '2026-11-10', 'autorId' => 'a1'])->json('id');
        $this->getJson('/api/indisponibilidades', $h)->assertOk()->assertJsonCount(1);
        $this->deleteJson("/api/indisponibilidades/$id", [], $h)->assertOk();
        $this->getJson('/api/indisponibilidades', $h)->assertOk()->assertJsonCount(0);
        $this->deleteJson("/api/indisponibilidades/$id", [], $h)->assertStatus(404);
        $this->assertTrue((bool) DB::table('indisponibilidades')->where('id', $id)->value('excluido')); // exclusao logica
    }

    public function test_log_de_importacao(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        DB::table('importacoes_log')->insert(['id' => 'i1', 'data_hora' => '2026-11-01 10:00:00-03', 'base' => 'Equipes', 'registros_processados' => 10, 'registros_com_erro' => 1]);
        $this->getJson('/api/importacao/log', $h)->assertOk()->assertJson([['id' => 'i1', 'base' => 'Equipes', 'registrosProcessados' => 10, 'registrosComErro' => 1]]);
    }

    public function test_front_e_servido_e_nao_vaza_arquivo_fora_da_pasta(): void
    {
        $this->get('/')->assertOk()->assertHeader('Content-Type', 'text/html; charset=utf-8');
        $this->get('/js/api.js')->assertOk();
        $this->get('/../controller/server.ps1')->assertNotFound();
        $this->get('/%2e%2e/controller/server.ps1')->assertNotFound();
        $this->get('/nao-existe.js')->assertNotFound();
        $this->getJson('/api/nao-existe')->assertNotFound()->assertJson(['erro' => 'Esta função ainda não foi migrada para o sistema novo.']);
        $this->postJson('/api/metas', [])->assertNotFound(); // escrita em modulo pendente
    }
}
