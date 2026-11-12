<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\RegistrosController;
use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RegistrosTest extends TestCase
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

    public function test_programacoes_do_legado_excel_e_log(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $leg = ['id' => 'prog-antiga-1', 'dataInicio' => '2026-11-03', 'dataFim' => '2026-11-04', 'status' => 'Programada', 'protecaoId' => 'P1', 'observacao' => '',
            'equipesIds' => ['EQ1', 'EQ2'], 'osIds' => ['OS 1/2026', 'OS 2/2026'], 'osSnap' => [['id' => 'OS 1/2026', 'trecho' => '', 'previsto' => 3]],
            'criadoEm' => '2026-11-01T08:00:00-03:00', 'atualizadoEm' => '2026-11-01T09:00:00-03:00', 'previstoConcluir' => true];
        $r = $this->postJson('/api/registros/programacoes/importar', ['modo' => 'atualizar', 'registros' => [$leg,
            ['dataInicio' => '2026-02-30', 'dataFim' => '2026-03-01'], ['dataInicio' => '2026-11-05', 'dataFim' => '2026-11-04'], ['dataInicio' => '2026-11-05', 'dataFim' => '2026-11-05', 'status' => 'Xis']]], $h)
            ->assertOk()->assertJson(['novos' => 1, 'atualizados' => 0])->json();
        $this->assertSame([2, 3, 4], array_column($r['erros'], 'linha'));
        $id = RegistrosController::uuidDe('prog-antiga-1');
        // o "" dentro da copia da OS chega intacto (o Laravel trocaria por null)
        $this->assertSame('', json_decode(DB::table('programacao_os')->where('programacao_id', $id)->where('os_id', 'OS 1/2026')->value('snapshot'), true)['trecho']);
        $this->assertSame(['EQ1', 'EQ2'], DB::table('programacao_equipes')->where('programacao_id', $id)->orderBy('equipe_id')->pluck('equipe_id')->all());

        // Excel: equipes/OS em texto com "; "; sem osSnap -> mantem a copia que ja estava
        $this->postJson('/api/registros/programacoes/importar', ['registros' => [['id' => $id, 'dataInicio' => '2026-11-03', 'dataFim' => '2026-11-06', 'status' => 'Concluída',
            'equipesIds' => 'EQ3', 'osIds' => 'OS 1/2026; OS 3/2026']]], $h)->assertOk()->assertJson(['novos' => 0, 'atualizados' => 1]);
        $exp = $this->getJson('/api/registros/programacoes/exportar', $h)->assertOk()->json();
        $this->assertSame(['Concluída', '2026-11-06', ['EQ3'], ['OS 1/2026', 'OS 3/2026']], [$exp[0]['status'], $exp[0]['dataFim'], $exp[0]['equipesIds'], $exp[0]['osIds']]);
        $this->assertCount(1, $exp[0]['osSnap']);

        // log: reimportar nao duplica; log de programacao inexistente volta como erro
        $log = [['t' => '2026-11-01T08:00:00-03:00', 'u' => 'u1', 'p' => 'prog-antiga-1', 'a' => 'criar', 'r' => 'Programação criada', 'add' => ['OS 1/2026']],
            ['t' => '2026-11-01T08:00:00-03:00', 'u' => 'u1', 'p' => 'nao-existe', 'a' => 'criar']];
        $this->postJson('/api/registros/programacao_log/importar', ['registros' => $log], $h)->assertOk()->assertJson(['novos' => 1])->assertJsonCount(1, 'erros');
        $this->postJson('/api/registros/programacao_log/importar', ['registros' => $log], $h)->assertOk();
        $this->assertSame(1, DB::table('programacao_log')->count());
        $this->assertSame([['t' => '2026-11-01T08:00:00-03:00', 'u' => 'u1', 'p' => $id, 'a' => 'criar', 'r' => 'Programação criada', 'ref' => '', 'm' => [], 'add' => ['OS 1/2026'], 'rem' => []]],
            $this->getJson('/api/registros/programacao_log/exportar', $h)->json());

        // substituir: o que nao veio sai
        $this->postJson('/api/registros/programacoes/importar', ['modo' => 'substituir', 'registros' => [['dataInicio' => '2026-12-01', 'dataFim' => '2026-12-01']]], $h)
            ->assertOk()->assertJson(['novos' => 1, 'removidos' => 1]);
        $this->assertFalse(DB::table('programacoes')->where('id', $id)->exists());
    }

    public function test_listas_justificativas_indisponibilidades(): void
    {
        $h = $this->usuario("a1", "Administrador");
        $this->postJson("/api/registros/listas/importar", ["registros" => [["lista" => "plano", "nome" => "Plano 2026", "ativo" => "Sim"], ["nome" => "sem lista"]]], $h)
            ->assertOk()->assertJson(["novos" => 1])->assertJsonCount(1, "erros");
        $this->getJson("/api/listas", $h)->assertJsonFragment(["lista" => "plano", "nome" => "Plano 2026"]);

        DB::table("justificativas")->insert(["id" => "j0", "data" => "2026-11-03", "equipe_id" => "EQ1", "excluido" => false]);
        $r = $this->postJson("/api/registros/justificativas/importar", ["registros" => [
            ["id" => "j1", "equipeId" => "EQ1", "data" => "2026-11-03", "tipo" => "Chuva"],          // ja tem j0 no dia
            ["id" => "j2", "equipeId" => "EQ2", "data" => "2026-11-03", "texto" => ""],
            ["id" => "j3", "equipeId" => "EQ2", "data" => "2026-11-03"],                             // repetida no arquivo
            ["id" => "j4", "equipeId" => "EQ2", "data" => "2026-11-03", "excluido" => true],         // excluida nao conta
        ]], $h)->assertOk()->json();
        $this->assertSame(2, $r["novos"]);
        $this->assertCount(2, $r["erros"]);
        $this->assertSame(["j0", "j2", "j4"], DB::table("justificativas")->orderBy("id")->pluck("id")->all());

        $this->postJson("/api/registros/indisponibilidades/importar", ["registros" => [["equipeId" => "EQ1", "dataInicio" => "2026-11-05", "dataFim" => "2026-11-04"],
            ["equipeId" => "EQ1", "dataInicio" => "2026-11-05", "dataFim" => "2026-11-06", "tipo" => "Férias"]]], $h)->assertOk()->assertJson(["novos" => 1])->assertJsonCount(1, "erros");

        $ver = $this->usuario("u1", "Consulta", ["produtividade.visualizar", "produtividade.importar", "produtividade.editar"]);
        $this->getJson("/api/registros/justificativas/exportar", $ver)->assertOk()->assertJsonCount(3);
        $this->postJson("/api/registros/justificativas/importar", ["registros" => [["equipeId" => "X", "data" => "2026-01-01"]]], $ver)->assertStatus(403);   // precisa de gestaoBases
    }

    public function test_ajustes_e_permissoes(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $this->postJson('/api/registros/ajustes/importar', ['registros' => [['id' => 'aud  000304/2026', 'tipoEquipe' => 'RECOLHA', 'equipeId' => ''], ['tipoEquipe' => 'x']]], $h)
            ->assertOk()->assertJson(['novos' => 1])->assertJsonCount(1, 'erros');
        $this->getJson('/api/ajustes', $h)->assertJsonFragment(['id' => 'AUD  000304/2026', 'tipoEquipe' => 'RECOLHA']);
        $this->postJson('/api/registros/ajustes_log/importar', ['registros' => [['t' => '2026-11-04T07:38:09-03:00', 'u' => 'u1', 'os' => 'AUD  000304/2026', 'a' => 'criar', 'de' => null, 'para' => ['equipeId' => '']]]], $h)
            ->assertOk()->assertJson(['novos' => 1]);
        $this->assertSame('{"equipeId": ""}', DB::table('ajustes_os_log')->value('para'));

        $ver = $this->usuario('u1', 'Consulta', ['programacao.visualizar', 'programacao.editar']);
        $this->getJson('/api/registros/programacoes/exportar', $ver)->assertOk();
        $this->postJson('/api/registros/programacoes/importar', ['registros' => [['dataInicio' => '2026-12-01', 'dataFim' => '2026-12-01']]], $ver)->assertStatus(403);
        $this->getJson('/api/registros/ajustes/exportar', $ver)->assertStatus(403);
        $this->getJson('/api/registros/nada/exportar', $h)->assertStatus(400);
    }
}
