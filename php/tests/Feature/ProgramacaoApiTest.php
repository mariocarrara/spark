<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProgramacaoApiTest extends TestCase
{
    use DatabaseTransactions;

    private array $h;

    protected function setUp(): void
    {
        parent::setUp();
        $this->h = $this->como('a1', 'Administrador');
        DB::table('equipes')->insert([['id' => 'EQ1', 'nome' => 'EQ1', 'ativo' => true], ['id' => 'EQ2', 'nome' => 'EQ2', 'ativo' => true], ['id' => 'EQ-OFF', 'nome' => 'EQ-OFF', 'ativo' => false]]);
        DB::statement("INSERT INTO protecoes (protecao_id, protecao2, alimentador, trecho, loc) VALUES
            ('V100-1', 'P2-A', 'ALM-01', 'T1', ST_SetSRID(ST_MakePoint(-50.000, -22.000), 4326)),
            ('V200-2', 'P2-B', 'ALM-01', 'T2', ST_SetSRID(ST_MakePoint(-50.100, -22.100), 4326)),
            ('X300-3', 'V100-9', 'ALM-02', 'T3', NULL)");
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

        return ['Authorization' => 'Bearer '.SessaoToken::criar($u, '127.0.0.1', 'teste')];
    }

    private function corpo(array $extra = []): array
    {
        return array_merge(['id' => (string) Str::uuid(), 'protecaoId' => 'V100-1', 'alimentador' => 'ALM-01', 'dataInicio' => '2026-11-10', 'dataFim' => '2026-11-12',
            'equipesIds' => ['EQ1'], 'numeroSIS' => 'SIS-1', 'plano' => 'SOMA', 'equipeNecessaria' => 'LM - LIVRE', 'desligamento' => 'DS',
            'localidade' => 'Cidade A', 'polo' => 'Polo 1', 'regional' => 'Reg 1', 'osIds' => ['OS-1', 'OS-2'], 'origemTela' => 'Mapa',
            'osSnap' => [['id' => 'OS-1', 'statusOS' => 'Pendente', 'lat' => -22, 'lng' => -50, 'fonte' => 'gps', 'campoInventado' => 'x'], ['id' => 'OS-FORA', 'statusOS' => 'x']]], $extra);
    }

    public function test_criar_e_formato_do_legado(): void
    {
        $c = $this->corpo();
        $r = $this->postJson('/api/programacao', $c, $this->h)->assertCreated();
        $p = $r->json('programacao');
        $this->assertSame($c['id'], $p['id']);
        $this->assertSame(['Programada', 'a1', 'Poda', '2026-11-10', ['EQ1'], ['OS-1', 'OS-2'], 'Mapa'], [$p['status'], $p['programadorId'], $p['tipoProgramacao'], $p['dataInicio'], $p['equipesIds'], $p['osIds'], $p['origemTela']]);
        // copia da OS: so campos conhecidos, posicao em "localizacao", OS fora da programacao descartada
        $this->assertCount(1, $p['osSnap']);
        $this->assertSame(['id' => 'OS-1', 'statusOS' => 'Pendente', 'localizacao' => ['lat' => -22, 'lng' => -50, 'fonte' => 'gps']], $p['osSnap'][0]);
        $this->assertSame([], $p['execSnap']);

        // reenvio do mesmo POST (rede caiu) nao duplica
        $this->postJson('/api/programacao', $c, $this->h)->assertOk()->assertJsonPath('programacao.id', $c['id']);
        $this->assertSame(1, DB::table('programacoes')->count());
        $this->getJson('/api/programacao', $this->h)->assertOk()->assertJsonCount(1)->assertJsonPath('0.numeroSIS', 'SIS-1');
    }

    public function test_validacoes(): void
    {
        $this->postJson('/api/programacao', $this->corpo(['localidade' => ' ']), $this->h)->assertStatus(400);
        $this->postJson('/api/programacao', $this->corpo(['dataFim' => '2026-11-01']), $this->h)->assertStatus(400);
        $this->postJson('/api/programacao', $this->corpo(['dataInicio' => '2026-02-30']), $this->h)->assertStatus(400);
        $this->postJson('/api/programacao', $this->corpo(['equipesIds' => ['EQ-OFF']]), $this->h)->assertStatus(400)->assertJsonFragment(['erro' => 'Equipe inativa não pode receber programação: EQ-OFF.']);
        // id que nao e UUID: o servidor gera um (o front passa a usar o devolvido)
        $id = $this->postJson('/api/programacao', $this->corpo(['id' => 'p123']), $this->h)->assertCreated()->json('programacao.id');
        $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $id);
    }

    public function test_conflitos_sao_aviso_nao_bloqueio(): void
    {
        $this->postJson('/api/programacao', $this->corpo(), $this->h)->assertCreated();
        $r = $this->postJson('/api/programacao', $this->corpo(['numeroSIS' => 'SIS-2', 'osIds' => ['OS-9']]), $this->h)->assertCreated();
        $this->assertCount(2, $r->json('avisosConflito'));
        $this->assertStringContainsString('EQ1', $r->json('avisosConflito.0'));
        $this->assertStringContainsString('desligamento', $r->json('avisosConflito.1'));
    }

    public function test_editar_gera_log_e_mantem_copia_do_servidor(): void
    {
        $c = $this->corpo();
        $this->postJson('/api/programacao', $c, $this->h)->assertCreated();
        $r = $this->putJson("/api/programacao/{$c['id']}", ['dataFim' => '2026-11-15', 'osIds' => ['OS-1', 'OS-3'], 'programadorId' => 'invasor', 'campoInventado' => 1,
            'osSnap' => [['id' => 'OS-1', 'statusOS' => 'MUDOU'], ['id' => 'OS-3', 'statusOS' => 'Nova']]], $this->h)->assertOk();
        $p = $r->json('programacao');
        $this->assertSame(['2026-11-15', 'a1', ['OS-1', 'OS-3']], [$p['dataFim'], $p['programadorId'], $p['osIds']]);
        $this->assertSame('Pendente', collect($p['osSnap'])->firstWhere('id', 'OS-1')['statusOS']); // copia do servidor nao e sobrescrita
        $this->assertSame('Nova', collect($p['osSnap'])->firstWhere('id', 'OS-3')['statusOS']);

        $ev = $this->getJson("/api/programacao/{$c['id']}/log", $this->h)->assertOk()->json('eventos');
        $this->assertSame(['editar', 'criar'], array_column($ev, 'a'));
        $this->assertSame([['c' => 'dataFim', 'de' => '2026-11-12', 'para' => '2026-11-15']], $ev[0]['m']);
        $this->assertSame([['OS-3'], ['OS-2']], [$ev[0]['add'], $ev[0]['rem']]);
        $this->assertSame('Nome a1', $ev[0]['usuario']);
        $this->putJson('/api/programacao/'.Str::uuid(), ['dataFim' => '2026-11-15'], $this->h)->assertStatus(404);
    }

    public function test_mover_os_entre_programacoes(): void
    {
        $a = $this->corpo(['osIds' => ['OS-1', 'OS-2']]);
        $this->postJson('/api/programacao', $a, $this->h)->assertCreated();
        DB::table('programacoes')->where('id', $a['id'])->update(['exec_snap' => json_encode([['id' => 'EX-1', 'osPrimaria' => 'OS-1'], ['id' => 'EX-2', 'osPrimaria' => 'OS-2']])]);

        $b = $this->corpo(['dataInicio' => '2026-12-01', 'dataFim' => '2026-12-01', 'osIds' => ['OS-1'], 'moverOs' => [['osId' => 'OS-1', 'de' => $a['id']]]]);
        $r = $this->postJson('/api/programacao', $b, $this->h)->assertCreated();
        $this->assertSame([['de' => $a['id'], 'osIds' => ['OS-1'], 'ficouVazia' => false]], $r->json('movidas'));
        $antiga = collect($this->getJson('/api/programacao', $this->h)->json())->firstWhere('id', $a['id']);
        $this->assertSame(['OS-2'], $antiga['osIds']);
        $this->assertSame(['EX-2'], array_column($antiga['execSnap'], 'id')); // a executada da OS movida sai junto
        $this->assertSame(['mover-saida', 'criar'], array_column($this->getJson("/api/programacao/{$a['id']}/log", $this->h)->json('eventos'), 'a'));

        // mover exige "editar"
        $h = $this->como('u1', 'Consulta', ['programacao.visualizar', 'programacao.criar']);
        $this->postJson('/api/programacao', $this->corpo(['osIds' => ['OS-2'], 'moverOs' => [['osId' => 'OS-2', 'de' => $a['id']]]]), $h)->assertStatus(403);
    }

    public function test_cancelar_e_reativar(): void
    {
        $c = $this->corpo();
        $this->postJson('/api/programacao', $c, $this->h)->assertCreated();
        $this->patchJson("/api/programacao/{$c['id']}/status", ['status' => 'Apagada'], $this->h)->assertStatus(400);
        $this->patchJson("/api/programacao/{$c['id']}/status", ['status' => 'Cancelada'], $this->h)->assertOk()->assertJson(['status' => 'Cancelada']);
        $this->patchJson("/api/programacao/{$c['id']}/status", ['status' => 'Programada'], $this->h)->assertOk();
        $this->assertSame(1, DB::table('programacoes')->count()); // cancelar nao apaga
    }

    public function test_permissoes(): void
    {
        $c = $this->corpo();
        $this->postJson('/api/programacao', $c, $this->h)->assertCreated();
        $h = $this->como('u2', 'Consulta', ['programacao.visualizar']);
        $this->getJson('/api/programacao', $h)->assertOk();
        $this->postJson('/api/programacao', $this->corpo(), $h)->assertStatus(403);
        $this->putJson("/api/programacao/{$c['id']}", ['observacao' => 'x'], $h)->assertStatus(403);
        $this->patchJson("/api/programacao/{$c['id']}/status", ['status' => 'Cancelada'], $h)->assertStatus(403);
        $this->postJson('/api/programacao/zerar', ['confirmar' => 'APAGAR'], $h)->assertStatus(403);
        $this->getJson('/api/programacao', $this->como('u3', 'Consulta'))->assertStatus(403);
    }

    public function test_buscar_e_protecao_proxima(): void
    {
        $r = $this->getJson('/api/programacao/buscar-protecao?q=v100&limite=10', $this->h)->assertOk();
        $this->assertSame(['V100-1', 'X300-3'], array_column($r->json('resultados'), 'protecaoId')); // quem comeca vem antes de quem contem
        $this->assertEquals(-22, $r->json('resultados.0.lat'));
        $this->getJson('/api/programacao/buscar-protecao?q=v', $this->h)->assertJson(['total' => 0]);
        $this->getJson('/api/programacao/buscar-protecao?q=%25%25', $this->h)->assertJson(['total' => 0]); // % nao vira curinga

        $p = $this->getJson('/api/programacao/protecao-proxima?alimentador=alm-01&lat=-22.09&lng=-50.09', $this->h)->assertOk()->json();
        $this->assertSame(['encontrada' => true, 'total' => 2, 'protecaoId' => 'V200-2'], array_intersect_key($p, array_flip(['encontrada', 'total', 'protecaoId'])));
        $this->assertLessThan(2000, $p['distanciaM']);
        $this->getJson('/api/programacao/protecao-proxima?alimentador=ALM-02', $this->h)->assertJson(['encontrada' => true, 'total' => 1, 'protecaoId' => 'X300-3']);
        $this->getJson('/api/programacao/protecao-proxima?alimentador=NADA', $this->h)->assertJson(['encontrada' => false, 'total' => 0]);
    }

    public function test_zerar_guarda_copia(): void
    {
        $this->postJson('/api/programacao', $this->corpo(), $this->h)->assertCreated();
        $this->postJson('/api/programacao/zerar', ['confirmar' => 'sim'], $this->h)->assertStatus(400);
        $r = $this->postJson('/api/programacao/zerar', ['confirmar' => 'apagar'], $this->h)->assertOk()->assertJson(['ok' => true, 'apagadas' => 1]);
        $this->assertSame(0, DB::table('programacoes')->count());
        $copia = json_decode(DB::table('legado_bruto')->where('entidade', $r->json('backup'))->value('dados'), true);
        $this->assertSame('SIS-1', $copia[0]['numeroSIS']);
    }
}
