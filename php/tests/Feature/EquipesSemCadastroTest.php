<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EquipesSemCadastroTest extends TestCase
{
    use DatabaseTransactions;

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

    public function test_lista_sugere_polo_e_cadastra_em_lote(): void
    {
        $h = $this->como('a1', 'Administrador');
        DB::table('equipes')->insert(['id' => 'EQ-OK', 'nome' => 'EQ-OK']);
        DB::table('alimentador_polo')->insert([['alimentador' => 'A1', 'polo' => 'BRAGANÇA PAULISTA', 'regional' => 'LESTE'], ['alimentador' => 'A2', 'polo' => 'ATIBAIA', 'regional' => 'LESTE']]);
        $os = fn ($id, $eq, $alim, $origem = 'SIGOD') => ['id' => $id, 'origem' => $origem, 'status_os' => 'Executada', 'tipo_servico' => 'Poda', 'equipe_id' => $eq, 'alimentador' => $alim, 'loc_fonte' => $origem];
        DB::table('os')->insert([$os('S1', 'BRAPL01', 'A1'), $os('S2', 'BRAPL01', 'A1'), $os('S3', 'BRAPL01', 'A2'), $os('S4', 'COEC-X', null, 'SGM'), $os('S5', 'EQ-OK', 'A1')]);

        $l = $this->getJson('/api/equipes/sem-cadastro', $h)->assertOk()->json();
        $this->assertSame(['BRAPL01', 'COEC-X'], array_column($l, 'id'));   // mais OS primeiro; EQ-OK ja tem cadastro
        $this->assertSame([3, true, 'BRAGANÇA PAULISTA', 'LESTE', 'SIGOD'], [$l[0]['os'], $l[0]['plantao'], $l[0]['poloSugerido'], $l[0]['regionalSugerida'], $l[0]['origens']]);
        $this->assertSame([false, null], [$l[1]['plantao'], $l[1]['poloSugerido']]);

        $this->postJson('/api/equipes/cadastrar-varias', ['equipes' => [['id' => 'BRAPL01', 'polo' => 'BRAGANÇA PAULISTA', 'regional' => 'LESTE'], ['id' => 'EQ-OK', 'polo' => 'X']]], $h)
            ->assertOk()->assertJson(['criadas' => 1, 'ids' => ['BRAPL01']]);
        $e = DB::table('equipes')->where('id', 'BRAPL01')->first();
        $this->assertSame(['BRAPL01', 'Plantão', 'BRAGANÇA PAULISTA', 'LESTE', true], [$e->nome, $e->tipo_equipe, $e->polo, $e->regional, $e->ativo]);
        $this->assertNull(DB::table('equipes')->where('id', 'EQ-OK')->value('polo'));   // a que ja existia nao muda
        $this->assertSame(['COEC-X'], array_column($this->getJson('/api/equipes/sem-cadastro', $h)->json(), 'id'));
    }

    public function test_permissoes(): void
    {
        $h = $this->como('u1', 'Consulta', ['manutencao.visualizar']);
        $this->getJson('/api/equipes/sem-cadastro', $h)->assertOk();
        $this->postJson('/api/equipes/cadastrar-varias', ['equipes' => [['id' => 'X']]], $h)->assertStatus(403);
        $this->getJson('/api/equipes/sem-cadastro', $this->como('u2', 'Consulta'))->assertStatus(403);
        $this->postJson('/api/equipes/cadastrar-varias', ['equipes' => []], $this->como('a1', 'Administrador'))->assertStatus(400);
    }
}
