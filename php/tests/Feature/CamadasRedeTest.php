<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CamadasRedeTest extends TestCase
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

    public function test_lista_e_apaga_alimentador(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $linha = "ST_GeomFromText('MULTILINESTRING((-56 -15,-56.1 -15.1))', 4326)";
        DB::statement("INSERT INTO rede_trechos (camada, alimentador, geom) VALUES ('mt','AL1',$linha),('mt','AL1',$linha),('mt',NULL,$linha),('bt','AL9',$linha)");

        $this->getJson('/api/importacao/camadas', $h)->assertOk()
            ->assertJsonPath('rede_media_tensao', [['chave' => '(sem alimentador)', 'nome' => '(sem alimentador)', 'trechos' => 1], ['chave' => 'AL1', 'nome' => 'AL1', 'trechos' => 2]])
            ->assertJsonPath('app', []);
        $this->deleteJson('/api/importacao/camadas/rede_media_tensao/AL1', [], $h)->assertOk();
        $this->deleteJson('/api/importacao/camadas/rede_media_tensao/AL1', [], $h)->assertStatus(404);
        $this->deleteJson('/api/importacao/camadas/rede_media_tensao/'.rawurlencode('(sem alimentador)'), [], $h)->assertOk();
        $this->deleteJson('/api/importacao/camadas/xyz?confirmar=sim', [], $h)->assertStatus(400);
        $this->deleteJson('/api/importacao/camadas/rede_baixa_tensao?confirmar=sim', [], $h)->assertOk()->assertJson(['apagados' => 1]);
        $this->assertSame(0, DB::table('rede_trechos')->count());

        $ver = $this->usuario('u1', 'Consulta', ['manutencao.visualizar']);
        $this->getJson('/api/importacao/camadas', $ver)->assertOk();
        $this->deleteJson('/api/importacao/camadas/app?confirmar=sim', [], $ver)->assertStatus(403);
    }
}
