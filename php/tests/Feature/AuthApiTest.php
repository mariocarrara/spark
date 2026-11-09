<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SenhaLegada;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use DatabaseTransactions; // banco spark_test (php artisan spark:banco-teste); cada teste e desfeito no fim

    protected function setUp(): void
    {
        parent::setUp();
    }

    private function usuario(array $a = []): Usuario
    {
        $u = new Usuario(array_merge(['id' => 'u1', 'nome' => 'Fulano', 'email' => 'fulano@teste.local', 'status_conta' => 'Ativo', 'perfil_base' => 'Consulta'], $a));
        $u->senha_hash = array_key_exists('senha_hash', $a) ? $a['senha_hash'] : Hash::make('senha-forte-1');
        $u->senha_legada = $a['senha_legada'] ?? null;
        $u->save();

        return $u;
    }

    private function logar(string $email = 'fulano@teste.local', string $senha = 'senha-forte-1')
    {
        return $this->postJson('/api/auth/login', ['email' => $email, 'senha' => $senha]);
    }

    public function test_health_e_publico(): void
    {
        $this->getJson('/api/health')->assertOk()->assertJson(['status' => 'ok', 'usuario' => 'Anônimo']);
    }

    public function test_login_ok_devolve_token_e_usuario_no_formato_do_legado(): void
    {
        $this->usuario();
        $r = $this->logar('  FULANO@teste.local ')->assertOk();
        $r->assertJsonStructure(['token', 'usuario' => ['id', 'nome', 'email', 'perfilBase']]);
        $this->assertArrayNotHasKey('senha_hash', $r->json('usuario'));

        $token = $r->json('token');
        $this->assertDatabaseHas('sessoes', ['token_hash' => hash('sha256', $token)]);
        $this->assertDatabaseMissing('sessoes', ['token_hash' => $token]);
        $this->getJson('/api/auth/me', ['Authorization' => "Bearer $token"])->assertOk()->assertJson(['id' => 'u1', 'perfilBase' => 'Consulta']);
    }

    public function test_senha_errada_e_email_inexistente_dao_401_igual(): void
    {
        $this->usuario();
        $this->logar(senha: 'errada')->assertStatus(401)->assertJson(['erro' => 'E-mail ou senha inválidos.']);
        $this->logar('ninguem@teste.local')->assertStatus(401)->assertJson(['erro' => 'E-mail ou senha inválidos.']);
    }

    public function test_sem_token_da_401_em_json(): void
    {
        $this->getJson('/api/auth/me')->assertStatus(401)->assertJson(['erro' => 'Não autenticado. Faça login novamente.']);
        $this->get('/api/auth/me', ['Authorization' => 'Bearer '.str_repeat('a', 64)])->assertStatus(401);
    }

    public function test_senha_legada_converte_para_hash_no_primeiro_login(): void
    {
        $this->usuario(['senha_hash' => null, 'senha_legada' => SenhaLegada::ofuscar('abc')]);
        $this->logar(senha: 'abc')->assertOk();

        $u = Usuario::find('u1');
        $this->assertNull($u->senha_legada);
        $this->assertTrue(Hash::check('abc', $u->senha_hash));
        $this->logar(senha: 'abc')->assertOk();
    }

    public function test_bloqueado_e_pendente_dao_403(): void
    {
        $this->usuario(['status_conta' => 'Bloqueado']);
        $this->logar()->assertStatus(403);
        $this->usuario(['id' => 'u2', 'email' => 'p@teste.local', 'status_conta' => 'PendenteAprovacao']);
        $this->logar('p@teste.local')->assertStatus(403)->assertJson(['erro' => 'Cadastro pendente de liberação por um administrador.']);
    }

    public function test_bloqueio_por_tentativas(): void
    {
        $this->usuario();
        for ($i = 0; $i < 5; $i++) {
            $this->logar(senha: 'errada')->assertStatus(401);
        }
        $this->logar()->assertStatus(429); // nem a senha certa entra durante o bloqueio
    }

    public function test_usuario_bloqueado_depois_perde_a_sessao(): void
    {
        $this->usuario();
        $token = $this->logar()->json('token');
        Usuario::where('id', 'u1')->update(['status_conta' => 'Bloqueado']);
        $this->getJson('/api/auth/me', ['Authorization' => "Bearer $token"])->assertStatus(401);
    }

    public function test_logout_invalida_token(): void
    {
        $this->usuario();
        $token = $this->logar()->json('token');
        $h = ['Authorization' => "Bearer $token"];
        $this->postJson('/api/auth/logout', [], $h)->assertOk()->assertJson(['ok' => true]);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/auth/me', $h)->assertStatus(401);
    }

    public function test_trocar_senha(): void
    {
        $this->usuario();
        $h = ['Authorization' => 'Bearer '.$this->logar()->json('token')];
        $this->postJson('/api/auth/trocar-senha', ['senhaAtual' => 'errada', 'senhaNova' => 'nova-senha-123'], $h)->assertStatus(401);
        $this->postJson('/api/auth/trocar-senha', ['senhaAtual' => 'senha-forte-1', 'senhaNova' => 'curta'], $h)->assertStatus(400);
        $this->postJson('/api/auth/trocar-senha', ['senhaAtual' => 'senha-forte-1', 'senhaNova' => 'nova-senha-123'], $h)->assertOk();
        $this->logar(senha: 'nova-senha-123')->assertOk();
    }

    public function test_auditoria_nao_grava_senha(): void
    {
        $this->usuario();
        $this->logar(senha: 'segredo-que-nao-pode-vazar');
        $this->logar();
        $tudo = json_encode(DB::table('auditoria')->get());
        $this->assertStringNotContainsString('segredo-que-nao-pode-vazar', $tudo);
        $this->assertStringNotContainsString('senha-forte-1', $tudo);
        $this->assertDatabaseHas('auditoria', ['acao' => 'login', 'usuario_id' => 'u1']);
        $this->assertDatabaseHas('auditoria', ['acao' => 'login_falhou']);
    }

    public function test_permissoes_admin_e_matriz(): void
    {
        $admin = $this->usuario(['id' => 'a1', 'email' => 'a@t.local', 'perfil_base' => 'Administrador']);
        $u = $this->usuario();
        Permissao::create(['usuario_id' => 'u1', 'modulo' => 'programacao', 'acao' => 'editar']);

        $this->assertTrue($admin->pode('usuarios', 'excluirStatus'));
        $this->assertTrue($u->pode('programacao', 'editar'));
        $this->assertFalse($u->pode('programacao', 'importar'));
        $u->status_conta = 'Bloqueado';
        $this->assertFalse($u->pode('programacao', 'editar'));
    }
}
