<?php

namespace Tests\Feature;

use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Travas do upload da pasta model/. O "executar" (que roda o migrar.php e substitui tudo)
 * nao entra aqui porque usa outra conexao e faz COMMIT; foi testado a mao contra o spark_test
 * (sucesso, admin recolocado, senha legada convertida e falha no meio sem alterar nada).
 */
class ImportacaoLegadoTest extends TestCase
{
    use DatabaseTransactions;

    private function como(string $id, string $perfil): array
    {
        $u = new Usuario(['id' => $id, 'nome' => $id, 'email' => "$id@t.local", 'status_conta' => 'Ativo', 'perfil_base' => $perfil]);
        $u->senha_hash = Hash::make('senha-forte-1');
        $u->save();
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.SessaoToken::criar($u, '127.0.0.1', 'teste')];
    }

    private function parte(string $lote, string $nome, int $offset, string $conteudo, array $h)
    {
        return $this->post("/api/importacao/legado/$lote/parte", [
            'nome' => $nome, 'offset' => $offset, 'parte' => UploadedFile::fake()->createWithContent($nome, $conteudo),
        ], $h + ['Accept' => 'application/json']);
    }

    public function test_so_admin(): void
    {
        $this->postJson('/api/importacao/legado/iniciar', [], $this->como('u1', 'Consulta'))->assertStatus(403);
    }

    public function test_upload_em_pedacos_e_travas(): void
    {
        $h = $this->como('a1', 'Administrador');
        $lote = $this->postJson('/api/importacao/legado/iniciar', [], $h)->assertOk()->json('lote');
        $pasta = storage_path("app/legado/$lote");
        $this->assertDirectoryExists($pasta);

        $this->parte($lote, 'usuarios.json', 0, '[{"id":', $h)->assertOk();
        $this->parte($lote, 'usuarios.json', 7, '"u1"}]', $h)->assertOk()->assertJson(['tamanho' => 13]);
        $this->assertSame('[{"id":"u1"}]', file_get_contents("$pasta/usuarios.json"));

        $this->parte($lote, 'usuarios.json', 0, 'x', $h)->assertStatus(409);       // fora de ordem
        $this->parte($lote, '../fuga.json', 0, 'x', $h)->assertStatus(400);        // tentativa de sair da pasta
        $this->parte($lote, 'script.php', 0, 'x', $h)->assertStatus(400);          // so .json/.tsv
        $this->parte('00000000-0000-0000-0000-000000000000', 'a.json', 0, 'x', $h)->assertStatus(404);
        $this->postJson("/api/importacao/legado/$lote/executar", [], $h)->assertStatus(400); // sem SUBSTITUIR

        $this->deleteJson("/api/importacao/legado/$lote", [], $h)->assertOk();
        $this->assertDirectoryDoesNotExist($pasta);
    }

    public function test_health_diz_que_e_laravel(): void
    {
        $this->getJson('/api/health')->assertJson(['backend' => 'laravel']);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path('app/legado'));
        parent::tearDown();
    }
}
