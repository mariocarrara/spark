<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\Matriz;
use App\Services\SessaoToken;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class UsuariosApiTest extends TestCase
{
    use DatabaseTransactions; // banco spark_test (php artisan spark:banco-teste); cada teste e desfeito no fim

    private const SENHA = 'senha-forte-1';

    protected function setUp(): void
    {
        parent::setUp();
    }

    private function criar(string $id, string $perfil = 'Consulta', string $status = 'Ativo', array $perms = []): Usuario
    {
        $u = new Usuario(['id' => $id, 'nome' => "Nome $id", 'email' => "$id@t.local", 'status_conta' => $status, 'perfil_base' => $perfil]);
        $u->senha_hash = Hash::make(self::SENHA);
        $u->save();
        foreach ($perms as $p) {
            [$m, $a] = explode('.', $p);
            Permissao::create(['usuario_id' => $id, 'modulo' => $m, 'acao' => $a]);
        }

        return $u;
    }

    /** Cabecalho Authorization de uma sessao do usuario (sem passar pelo login). */
    private function como(Usuario $u): array
    {
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.SessaoToken::criar($u, '127.0.0.1', 'teste')];
    }

    public function test_lista_sem_senha(): void
    {
        $u = $this->criar('u1');
        $r = $this->getJson('/api/usuarios', $this->como($u))->assertOk()->assertJsonCount(1);
        $this->assertSame(['id', 'nome', 'email', 'statusConta', 'perfilBase'], array_keys($r->json(0)));
    }

    public function test_solicitar_cadastro_publico_generico_e_aprovar(): void
    {
        $admin = $this->criar('a1', 'Administrador');
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $msg = ['ok' => true];
        $pedido = fn (array $a) => $this->postJson('/api/usuarios/solicitar-cadastro', $a + ['senha' => 'minha-senha-1']);
        $pedido(['email' => 'Novo@T.local', 'nome' => 'Fulano Novo'])->assertOk()->assertJson($msg);
        $pedido(['email' => 'novo@t.local', 'senha' => 'outra-senha-9'])->assertOk()->assertJson($msg); // repetido: mesma resposta, nao troca a senha
        $pedido(['email' => 'a1@t.local'])->assertOk()->assertJson($msg);  // ja existe: mesma resposta
        $pedido(['email' => 'lixo'])->assertStatus(400);
        $this->postJson('/api/usuarios/solicitar-cadastro', ['email' => 'sem@senha.local'])->assertStatus(400);
        $pedido(['email' => 'curta@t.local', 'senha' => 'abc'])->assertStatus(400);
        $this->assertSame(1, DB::table('solicitacoes_cadastro')->count());

        $pendente = Usuario::where('email', 'novo@t.local')->first();
        $this->assertSame('PendenteAprovacao', $pendente->status_conta);
        $this->assertSame('Fulano Novo', $pendente->nome);
        $this->assertTrue(Hash::check('minha-senha-1', $pendente->senha_hash));

        // antes da aprovacao a senha certa NAO entra
        $this->postJson('/api/auth/login', ['email' => 'novo@t.local', 'senha' => 'minha-senha-1'])->assertStatus(403);

        $h = $this->como($admin);
        $sol = $this->getJson('/api/usuarios/solicitacoes', $h)->assertOk()->assertJson([['nome' => 'Fulano Novo', 'temSenha' => true]])->json(0);
        $sid = $sol['id'];
        $this->postJson("/api/usuarios/solicitacoes/$sid/aprovar", ['perfilBase' => 'Programador', 'senha' => 'curta'], $h)->assertStatus(400);
        // aprova SEM informar senha: vale a que a pessoa escolheu
        $this->postJson("/api/usuarios/solicitacoes/$sid/aprovar", ['nome' => '', 'perfilBase' => 'Programador'], $h)
            ->assertOk()->assertJson(['id' => $pendente->id, 'nome' => 'Fulano Novo', 'statusConta' => 'Ativo', 'perfilBase' => 'Programador']);
        $this->postJson("/api/usuarios/solicitacoes/$sid/aprovar", ['senha' => 'senha-inicial-1'], $h)->assertStatus(409);

        $this->assertTrue(Usuario::find($pendente->id)->pode('programacao', 'editar'));
        $this->assertFalse(Usuario::find($pendente->id)->pode('usuarios', 'editar'));
        $this->postJson('/api/auth/login', ['email' => 'novo@t.local', 'senha' => 'minha-senha-1'])->assertOk();
    }

    public function test_admin_pode_substituir_a_senha_escolhida_ou_exigir_quando_nao_ha(): void
    {
        $admin = $this->criar('a1', 'Administrador');
        $h = $this->como($admin);
        $this->postJson('/api/usuarios/solicitar-cadastro', ['email' => 'p@t.local', 'senha' => 'minha-senha-1'])->assertOk();
        $sid = DB::table('solicitacoes_cadastro')->value('id');
        $this->postJson("/api/usuarios/solicitacoes/$sid/aprovar", ['senha' => 'definida-pelo-admin'], $h)->assertOk();
        $this->postJson('/api/auth/login', ['email' => 'p@t.local', 'senha' => 'definida-pelo-admin'])->assertOk();
        $this->postJson('/api/auth/login', ['email' => 'p@t.local', 'senha' => 'minha-senha-1'])->assertStatus(401);

        // pedido antigo (feito antes desta versao, sem senha): admin precisa definir
        DB::table('solicitacoes_cadastro')->insert(['id' => 's-velho', 'email' => 'velho@t.local', 'status' => 'Pendente', 'criado_em' => now()]);
        (new Usuario(['id' => 'u-velho', 'nome' => 'velho', 'email' => 'velho@t.local', 'status_conta' => 'PendenteAprovacao', 'perfil_base' => 'Consulta']))->save();
        $this->getJson('/api/usuarios/solicitacoes', $h)->assertJson([['id' => 's-velho', 'temSenha' => false]]);
        $this->postJson('/api/usuarios/solicitacoes/s-velho/aprovar', [], $h)->assertStatus(400);
    }

    public function test_solicitar_cadastro_tem_limite_por_ip(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/usuarios/solicitar-cadastro', ['email' => "x$i@t.local", 'senha' => 'minha-senha-1'])->assertOk();
        }
        $this->postJson('/api/usuarios/solicitar-cadastro', ['email' => 'x9@t.local', 'senha' => 'minha-senha-1'])->assertStatus(429);
    }

    public function test_recusar_remove_pendente(): void
    {
        $admin = $this->criar('a1', 'Administrador');
        $this->postJson('/api/usuarios/solicitar-cadastro', ['email' => 'x@t.local', 'senha' => 'minha-senha-1']);
        $h = $this->como($admin);
        $sid = DB::table('solicitacoes_cadastro')->value('id');
        $this->postJson("/api/usuarios/solicitacoes/$sid/recusar", [], $h)->assertOk()->assertJson(['status' => 'Recusada']);
        $this->assertFalse(Usuario::where('email', 'x@t.local')->exists());
    }

    public function test_sem_permissao_da_403(): void
    {
        $u = $this->criar('u1');
        $alvo = $this->criar('u2');
        $h = $this->como($u);
        $this->getJson('/api/usuarios/solicitacoes', $h)->assertStatus(403);
        $this->patchJson('/api/usuarios/u2/bloquear', [], $h)->assertStatus(403);
        $this->patchJson('/api/usuarios/u2/senha', ['senhaNova' => 'outra-senha-1'], $h)->assertStatus(403);
        $this->putJson('/api/permissoes/u2', ['matriz' => []], $h)->assertStatus(403);
        $this->deleteJson('/api/usuarios/u2', [], $h)->assertStatus(403);
    }

    public function test_gestor_de_usuarios_nao_mexe_em_admin_nem_se_promove(): void
    {
        $this->criar('a1', 'Administrador');
        $g = $this->criar('g1', 'Consulta', 'Ativo', ['usuarios.editar', 'usuarios.excluirStatus']);
        $this->criar('u2');
        $h = $this->como($g);

        $this->patchJson('/api/usuarios/a1/senha', ['senhaNova' => 'tomei-a-conta-1'], $h)->assertStatus(403);
        $this->patchJson('/api/usuarios/a1/bloquear', [], $h)->assertStatus(403);
        $this->putJson('/api/permissoes/a1', ['matriz' => []], $h)->assertStatus(403);
        $this->putJson('/api/permissoes/g1', ['matriz' => ['programacao' => ['editar' => true]]], $h)->assertStatus(403);
        $this->putJson('/api/permissoes/u2', ['perfilBase' => 'Administrador', 'matriz' => []], $h)->assertStatus(403);
        $this->assertSame('Consulta', Usuario::find('u2')->perfil_base);

        // o que ele pode: mexer em usuario comum
        $this->putJson('/api/permissoes/u2', ['perfilBase' => 'Programador', 'matriz' => ['programacao' => ['visualizar' => true, 'editar' => true]]], $h)->assertOk();
        $this->assertSame('Programador', Usuario::find('u2')->perfil_base);
    }

    public function test_bloquear_derruba_sessao_e_excluir_exige_bloqueio(): void
    {
        $admin = $this->criar('a1', 'Administrador');
        $u = $this->criar('u2');
        $hU = $this->como($u);
        $h = $this->como($admin);

        $this->deleteJson('/api/usuarios/u2', [], $h)->assertStatus(409);
        $this->patchJson('/api/usuarios/a1/bloquear', [], $h)->assertStatus(400);
        $r = $this->patchJson('/api/usuarios/u2/bloquear', [], $h)->assertOk()->assertJson(['statusConta' => 'Bloqueado']);
        $this->assertArrayNotHasKey('senha_hash', $r->json());
        $this->assertSame(0, DB::table('sessoes')->where('usuario_id', 'u2')->count());
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/auth/me', $hU)->assertStatus(401);

        $this->app['auth']->forgetGuards();
        $this->deleteJson('/api/usuarios/u2', [], $h)->assertOk()->assertJson(['ok' => true, 'id' => 'u2']);
        $this->assertNull(Usuario::find('u2'));
    }

    public function test_redefinir_senha_pelo_admin(): void
    {
        $admin = $this->criar('a1', 'Administrador');
        $this->criar('u2');
        $h = $this->como($admin);
        $this->patchJson('/api/usuarios/u2/senha', ['senhaNova' => 'abc'], $h)->assertStatus(400);
        $this->patchJson('/api/usuarios/u2/senha', ['senhaNova' => 'nova-senha-u2'], $h)->assertOk();
        $this->postJson('/api/auth/login', ['email' => 'u2@t.local', 'senha' => 'nova-senha-u2'])->assertOk();
    }

    public function test_matriz_formato_e_regra_dos_alertas(): void
    {
        $admin = $this->criar('a1', 'Administrador');
        $this->criar('u2');
        $h = $this->como($admin);

        // sem alertas explicito: segue manutencao.visualizar
        $this->putJson('/api/permissoes/u2', ['matriz' => ['manutencao' => ['visualizar' => true], 'inventado' => ['x' => true]]], $h)
            ->assertOk()->assertExactJson(['usuarioId' => 'u2', 'matriz' => ['manutencao' => ['visualizar' => true], 'alertas' => ['visualizar' => true]]]);
        // false explicito em alertas e respeitado
        $this->putJson('/api/permissoes/u2', ['matriz' => ['manutencao' => ['visualizar' => true], 'alertas' => ['visualizar' => false]]], $h)->assertOk();
        $this->getJson('/api/permissoes/u2', $h)->assertOk()->assertExactJson(['usuarioId' => 'u2', 'matriz' => ['manutencao' => ['visualizar' => true], 'alertas' => ['visualizar' => false]]]);

        $this->getJson('/api/permissoes/nao-existe', $h)->assertStatus(404);
    }

    public function test_liberar_cria_matriz_do_perfil(): void
    {
        $admin = $this->criar('a1', 'Administrador');
        $this->criar('p1', 'Gestor/Coordenador', 'PendenteAprovacao');
        $this->patchJson('/api/usuarios/p1/liberar', [], $this->como($admin))->assertOk()->assertJson(['statusConta' => 'Ativo']);
        $this->assertEquals(Matriz::ler('p1'), Matriz::doPerfil('Gestor/Coordenador') + ['alertas' => ['visualizar' => true]]);
        $this->assertTrue(Usuario::find('p1')->pode('metas', 'importar'));
    }

    public function test_auditoria_de_alteracoes(): void
    {
        $admin = $this->criar('a1', 'Administrador');
        $this->criar('u2');
        $h = $this->como($admin);
        $this->patchJson('/api/usuarios/u2/senha', ['senhaNova' => 'nova-senha-u2'], $h);
        $this->patchJson('/api/usuarios/u2/bloquear', [], $h);
        $this->assertDatabaseHas('auditoria', ['acao' => 'redefinir_senha', 'registro_id' => 'u2', 'usuario_id' => 'a1']);
        $this->assertDatabaseHas('auditoria', ['acao' => 'bloquear', 'registro_id' => 'u2']);
        $this->assertStringNotContainsString('nova-senha-u2', json_encode(DB::table('auditoria')->get()));
    }
}
