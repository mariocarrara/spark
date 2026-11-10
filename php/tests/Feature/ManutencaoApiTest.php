<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ManutencaoApiTest extends TestCase
{
    use DatabaseTransactions;

    private array $h;

    protected function setUp(): void
    {
        parent::setUp();
        File::deleteDirectory(storage_path('app/cache'));
        $this->h = $this->como('a1', 'Administrador');
        DB::statement("INSERT INTO os (id, origem, status_os, tipo_servico, prioridade_ew, data_abertura, alimentador, loc, loc_fonte, loc_aproximada, loc_origem, previsto, previsto_poda, observacao) VALUES
            ('SGM  000001/2026', 'SGM', 'Pendente', 'Poda', true, '2026-01-05', 'ALM-01', ST_SetSRID(ST_MakePoint(-50.1, -22.2), 4326), 'GRID_PENDENTE', false, 'XY', 2.5, 2.5, 'árvore'),
            ('SIGOD-9', 'SIGOD', 'Executada', 'Limpeza de faixa', false, '2026-02-01', NULL, NULL, NULL, false, NULL, 0, 0, NULL)");
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path('app/cache'));
        parent::tearDown();
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

    public function test_lista_de_os_no_formato_do_legado_e_compactada(): void
    {
        $r = $this->get('/api/manutencao/os', $this->h + ['Accept-Encoding' => 'gzip'])->assertOk();
        $this->assertSame('gzip', $r->headers->get('Content-Encoding'));
        $lista = json_decode(gzdecode(file_get_contents($r->baseResponse->getFile()->getPathname())), true);
        $this->assertCount(2, $lista);
        $o = collect($lista)->firstWhere('id', 'SGM  000001/2026');
        $this->assertSame(['SGM', 'Pendente', 'Poda', true, '2026-01-05', 'ALM-01', 2.5, 'árvore'],
            [$o['origem'], $o['statusOS'], $o['tipoServico'], $o['prioridadeEW'], $o['dataAbertura'], $o['alimentador'], $o['previsto'], $o['observacao']]);
        $this->assertEquals(['lat' => -22.2, 'lng' => -50.1, 'fonte' => 'GRID_PENDENTE', 'aproximada' => false, 'origem' => 'XY'], $o['localizacao']);
        $this->assertArrayNotHasKey('localizacao', collect($lista)->firstWhere('id', 'SIGOD-9')); // sem posicao: sem o campo

        // 2a chamada usa o arquivo pronto; mudou uma OS -> arquivo novo
        $arq1 = $this->get('/api/manutencao/os', $this->h + ['Accept-Encoding' => 'gzip'])->baseResponse->getFile()->getPathname();
        DB::table('os')->where('id', 'SIGOD-9')->update(['status_os' => 'Cancelada', 'atualizado_em' => now()->addMinute()]);
        $arq2 = $this->get('/api/manutencao/os', $this->h + ['Accept-Encoding' => 'gzip'])->baseResponse->getFile()->getPathname();
        $this->assertNotSame($arq1, $arq2);
    }

    public function test_lista_filtrada_aplica_programada(): void
    {
        $pid = '11111111-1111-1111-1111-111111111111';
        DB::table('programacoes')->insert(['id' => $pid, 'status' => 'Programada', 'data_inicio' => '2026-11-01', 'data_fim' => '2026-11-01', 'criado_em' => now(), 'atualizado_em' => now()]);
        DB::table('programacao_os')->insert(['programacao_id' => $pid, 'os_id' => 'SGM  000001/2026', 'ordem' => 0]);
        $r = $this->getJson('/api/manutencao/os?status=Programada', $this->h)->assertOk()->json();
        $this->assertCount(1, $r);
        $this->assertSame(['Programada', 'Pendente'], [$r[0]['statusOS'], $r[0]['statusBase']]);
    }

    public function test_permissao(): void
    {
        $h = $this->como('u1', 'Consulta');
        foreach (['/api/manutencao/os', '/api/manutencao/localidades-mapa', '/api/cadastros/conjuntos/mapa', '/api/ajustes'] as $rota) {
            $this->getJson($rota, $h)->assertStatus(403);
        }
        $h2 = $this->como('u2', 'Consulta', ['manutencao.visualizar']);
        $this->putJson('/api/ajustes/X', ['alimentador' => 'A'], $h2)->assertStatus(403);
    }

    public function test_ajustes_com_barra_no_numero(): void
    {
        $id = rawurlencode('SGM  000001/2026');
        $this->putJson("/api/ajustes/$id", [], $this->h)->assertStatus(400);
        $this->putJson("/api/ajustes/$id", ['alimentador' => 'ALM-NOVO'], $this->h)->assertOk()
            ->assertJson(['id' => 'SGM  000001/2026', 'alimentador' => 'ALM-NOVO', 'tipoEquipe' => '', 'criadoPor' => 'a1']);
        $this->putJson("/api/ajustes/$id", ['alimentador' => 'ALM-2', 'equipeId' => 'EQ1'], $this->h)->assertOk()->assertJson(['equipeId' => 'EQ1']);
        $this->getJson('/api/ajustes', $this->h)->assertOk()->assertJsonCount(1);
        $this->assertSame(['criar', 'alterar'], DB::table('ajustes_os_log')->orderBy('id')->pluck('acao')->all());
        $this->deleteJson("/api/ajustes/$id", [], $this->h)->assertOk();
        $this->deleteJson("/api/ajustes/$id", [], $this->h)->assertStatus(404);
    }

    public function test_localidades_e_conjuntos(): void
    {
        DB::table('alimentador_polo')->insert([['alimentador' => 'ALM-01', 'polo' => 'Assis', 'regional' => 'Oeste']]);
        DB::table('conjuntos')->insert([['alimentador' => 'ALM-01', 'nome_conjunto' => 'C1', 'regional' => 'Oeste'], ['alimentador' => 'ALM-99', 'nome_conjunto' => 'C9', 'regional' => 'X']]);
        DB::table('exclusoes')->insert(['base' => 'conjuntos', 'chave' => 'ALM-99']);
        $this->getJson('/api/manutencao/localidades-mapa', $this->h)->assertOk()
            ->assertJson(['porAlimentador' => ['ALM-01' => 'Assis'], 'regionalPorAlimentador' => ['ALM-01' => 'Oeste']]);
        $this->getJson('/api/cadastros/conjuntos/mapa', $this->h)->assertOk()->assertExactJson([['a' => 'ALM-01', 'n' => 'C1', 'c' => '', 'r' => 'Oeste', 's' => '']]);
    }
}
