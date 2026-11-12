<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class HistoricoTest extends TestCase
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

    private function os(string $id, array $extra = []): array
    {
        return $extra + ['id' => $id, 'origem' => 'SGM', 'statusOS' => 'Executada', 'tipoServico' => 'Poda', 'alimentador' => 'Z-A7', 'localidade' => 'OSVALDO CRUZ',
            'dataAbertura' => '2025-02-06', 'dataExecucao' => '2025-07-04', 'previstoPoda' => 2, 'realizadoPoda' => 1.5, 'descEsquema' => 'Esq; com ponto e virgula',
            'localizacao' => ['lat' => -21.790301, 'lng' => -50.877, 'fonte' => 'XY', 'aproximada' => false]];
    }

    public function test_importar_consultar_exportar_mapa_apagar(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $this->postJson('/api/historico/planos/2025/importar', ['modo' => 'substituir', 'arquivo' => 'historico_podas_2025.json',
            'os' => [$this->os('OS 1/2025'), $this->os('OS 2/2025', ['tipoServico' => 'Limpeza de Faixa', 'statusOS' => 'Cancelada', 'dataExecucao' => '2024-12-01'])]], $h)
            ->assertOk()->assertJson(['historicoTotalNoPlano' => 2, 'plano' => 2025]);
        $this->postJson('/api/historico/planos/2025/importar', ['modo' => 'acrescentar', 'os' => [$this->os('OS 2/2025', ['statusOS' => 'Executada']), $this->os('OS 3/2025')]], $h)
            ->assertOk()->assertJson(['historicoTotalNoPlano' => 3, 'historicoAtualizadas' => 1]);

        $this->getJson('/api/historico/planos', $h)->assertOk()->assertJsonPath('0.plano', 2025)->assertJsonPath('0.total', 3)->assertJsonPath('0.inicio', '2024-11-01');
        $c = $this->getJson('/api/historico/os?plano=2025&tipo=Poda', $h)->assertOk()->json();
        $this->assertEquals([3, 3, 6, 4.5], [$c['total'], $c['totalPlano'], $c['resumo']['previstoPoda'], $c['resumo']['realizadoPoda']]);
        $this->assertSame(['Poda'], $c['filtros']['tipos']);
        $this->assertSame(1, $this->getJson('/api/historico/os?plano=2025&q=os 3&de=2025-01-01', $h)->json('total'));
        $this->getJson('/api/historico/os?plano=2019', $h)->assertStatus(404);
        $this->getJson('/api/historico/os', $h)->assertStatus(400);

        $csv = $this->get('/api/historico/exportar?plano=2025', $h)->assertOk()->streamedContent();
        $this->assertStringContainsString('OS 1/2025;Executada;Poda;06/02/2025;04/07/2025;Z-A7;OSVALDO CRUZ;;;"Esq; com ponto e virgula";2;1,5;0;0;0;0;-21,790301;-50,877;', $csv);

        $lista = json_decode($this->get('/api/historico/mapa?plano=2025', $h)->assertOk()->streamedContent(), true);
        $this->assertSame(['OS 1/2025', 'OS 2/2025', 'OS 3/2025'], array_column($lista, 'id'));
        $this->assertSame(-21.790301, $lista[0]['localizacao']['lat']);

        $ver = $this->usuario('u1', 'Consulta', ['manutencao.visualizar']);
        $this->deleteJson('/api/historico/planos/2025', [], $ver)->assertStatus(403);
        $this->postJson('/api/historico/planos/2025/importar', ['os' => [$this->os('X')]], $ver)->assertStatus(403);
        $this->app['auth']->forgetGuards();   // no teste o guard guarda o ultimo usuario entre requisicoes
        $this->deleteJson('/api/historico/planos/2025', [], $h)->assertOk();
        $this->assertSame(0, DB::table('os_historico')->count());
    }
}
