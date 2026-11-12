<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CadastroBasesTest extends TestCase
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

    public function test_lista_paginada_busca_e_ordem(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        foreach (range(1, 60) as $i) {
            DB::table('vao')->insert(['protecao_id' => sprintf('P%03d', $i), 'polo' => $i % 2 ? 'Cuiabá' : 'Sinop', 'regional' => 'Norte', 'postes' => $i, 'rota_km' => $i / 10]);
        }
        $r = $this->getJson('/api/cadastros/vao', $h)->assertOk()->assertJson(['base' => 'vao', 'total' => 60, 'pagina' => 1, 'tamanhoPagina' => 50]);
        $this->assertCount(50, $r->json('registros'));
        $this->assertSame(['protecaoId' => 'P001', 'polo' => 'Cuiabá', 'regional' => 'Norte', 'postes' => 1, 'rotaKm' => 0.1], $r->json('registros.0'));

        $this->assertCount(10, $this->getJson('/api/cadastros/vao?pagina=2', $h)->json('registros'));
        $this->getJson('/api/cadastros/vao?busca=SINOP', $h)->assertJson(['total' => 30]);
        $this->assertSame('P060', $this->getJson('/api/cadastros/vao?ordenar=postes&dir=desc', $h)->json('registros.0.protecaoId'));
        // campo de ordem inventado cai na chave (nada de SQL vindo da URL)
        $this->assertSame('P001', $this->getJson('/api/cadastros/vao?ordenar=x;drop', $h)->json('registros.0.protecaoId'));
        $this->getJson('/api/cadastros/nada', $h)->assertStatus(400);
    }

    public function test_novo_editar_excluir_restaurar_com_coordenada(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        $this->postJson('/api/cadastros/vera', ['idVera' => '123', 'especie' => 'Ipê', 'lat' => '-15,6', 'lng' => -56.1, 'campoInventado' => 'x'], $h)
            ->assertCreated()->assertExactJson(['idVera' => '123', 'alimentador' => null, 'especie' => 'Ipê', 'cidade' => null, 'lat' => -15.6, 'lng' => -56.1]);
        $this->postJson('/api/cadastros/vera', ['idVera' => '123'], $h)->assertStatus(409);
        $this->postJson('/api/cadastros/vera', ['especie' => 'x'], $h)->assertStatus(400);
        $this->postJson('/api/cadastros/vera', ['idVera' => '9', 'lat' => 'abc', 'lng' => 1], $h)->assertStatus(400);

        $this->putJson('/api/cadastros/vera/123', ['cidade' => 'Cuiabá', 'idVera' => 'trocado'], $h)->assertOk()->assertJson(['idVera' => '123', 'cidade' => 'Cuiabá', 'lat' => -15.6]);
        $this->putJson('/api/cadastros/vera/999', ['cidade' => 'x'], $h)->assertStatus(404);

        $this->deleteJson('/api/cadastros/vera/123', [], $h)->assertOk()->assertJson(['excluido' => true]);
        $this->getJson('/api/cadastros/vera', $h)->assertJson(['total' => 0]);
        $this->getJson('/api/cadastros/vera?excluidos=1', $h)->assertJson(['total' => 1]);
        $this->assertSame('Nome a1', DB::table('exclusoes')->where('base', 'vera')->value('por'));

        $this->postJson('/api/cadastros/vera/123/restaurar', [], $h)->assertOk()->assertJson(['excluido' => false]);
        $this->getJson('/api/cadastros/vera', $h)->assertJson(['total' => 1]);
    }

    public function test_chave_com_barra_e_tabela_com_chave_repetida(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        DB::table('conjuntos')->insert([['alimentador' => 'ALM/01', 'nome_conjunto' => 'Primeiro'], ['alimentador' => 'ALM/01', 'nome_conjunto' => 'Segundo']]);
        $this->putJson('/api/cadastros/conjuntos/'.rawurlencode('ALM/01'), ['nomeConjunto' => 'Editado'], $h)->assertOk()->assertJson(['nomeConjunto' => 'Editado']);
        $this->assertSame(['Editado', 'Segundo'], DB::table('conjuntos')->orderBy('id')->pluck('nome_conjunto')->all());
        $this->deleteJson('/api/cadastros/conjuntos/'.rawurlencode('ALM/01'), [], $h)->assertOk();
        $this->getJson('/api/cadastros/conjuntos/mapa', $h)->assertExactJson([]);
    }

    public function test_permissoes(): void
    {
        $this->usuario('a1', 'Administrador');
        DB::table('esquemas')->insert(['codigo' => 'E1', 'descricao' => 'Poda leve', 'tipo' => 'Poda']);
        $ver = $this->usuario('u1', 'Consulta', ['manutencao.visualizar']);
        $this->getJson('/api/cadastros/esquemas', $ver)->assertOk()->assertJson(['total' => 1]);
        $this->getJson('/api/cadastros/esquemas?excluidos=1', $ver)->assertStatus(403);
        $this->putJson('/api/cadastros/esquemas/E1', ['tipo' => 'x'], $ver)->assertStatus(403);
        $this->deleteJson('/api/cadastros/esquemas/E1', [], $ver)->assertStatus(403);

        $edita = $this->usuario('u2', 'Consulta', ['manutencao.visualizar', 'manutencao.editar']);
        $this->putJson('/api/cadastros/esquemas/E1', ['tipo' => 'Limpeza'], $edita)->assertOk();
        $this->postJson('/api/cadastros/esquemas', ['codigo' => 'E2'], $edita)->assertStatus(403); // falta importar
        $this->deleteJson('/api/cadastros/esquemas?confirmar=sim', [], $edita)->assertStatus(403);
        $this->deleteJson('/api/cadastros/esquemas/E1', [], $edita)->assertOk();
        $this->postJson('/api/cadastros/esquemas/E1/restaurar', [], $edita)->assertStatus(403);

        $sem = $this->usuario('u3', 'Consulta', []);
        $this->getJson('/api/cadastros/esquemas', $sem)->assertStatus(403);
    }

    public function test_apagar_tudo_e_novo_limpa_exclusao(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        DB::table('prioridade_ew')->insert(['chave' => 'K1', 'prioridade' => 'ALTA']);
        DB::table('exclusoes')->insert(['base' => 'prioridade_ew', 'chave' => 'K1']);
        $this->deleteJson('/api/cadastros/prioridade_ew', [], $h)->assertStatus(400);
        $this->deleteJson('/api/cadastros/prioridade_ew?confirmar=sim', [], $h)->assertOk()->assertJson(['apagados' => 1]);
        $this->assertSame(0, DB::table('exclusoes')->where('base', 'prioridade_ew')->count());

        // sem chave, a EW monta tensao-prioridade-grupo-regional (igual ao legado)
        $this->postJson('/api/cadastros/prioridade_ew', ['tensao' => '13,8', 'prioridade' => 'ALTA', 'grupoRecurso' => 'Poda', 'regional' => 'Norte', 'prioridadeEW' => 'Sim'], $h)
            ->assertCreated()->assertJson(['chave' => '13,8-ALTA-Poda-Norte', 'prioridadeEW' => 'Sim']);
    }

    public function test_municipios_no_legado_bruto(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        DB::table('legado_bruto')->insert(['entidade' => 'municipios', 'dados' => json_encode([['codigo' => '5103403', 'nome' => 'Cuiabá']])]);
        $this->getJson('/api/cadastros/municipios', $h)->assertJson(['total' => 1, 'registros' => [['codigo' => '5103403', 'nome' => 'Cuiabá']]]);
        $this->postJson('/api/cadastros/municipios', ['codigo' => '5108402', 'nome' => 'Várzea Grande'], $h)->assertCreated();
        $this->putJson('/api/cadastros/municipios/5103403', ['nome' => 'Cuiaba'], $h)->assertOk()->assertJson(['nome' => 'Cuiaba']);
        $this->getJson('/api/cadastros/municipios?busca=várzea', $h)->assertJson(['total' => 1]);
        $this->deleteJson('/api/cadastros/municipios?confirmar=sim', [], $h)->assertJson(['apagados' => 2]);
    }

    private function importar(array $h, string $base, array $registros, string $modo = 'atualizar'): array
    {
        $lote = $this->postJson("/api/cadastros/{$base}/importar/iniciar", [], $h)->assertOk()->json('lote');
        $parte = $this->postJson("/api/cadastros/{$base}/importar/{$lote}/parte", ['inicio' => 0, 'registros' => $registros], $h)->assertOk()->json();
        $fim = $this->postJson("/api/cadastros/{$base}/importar/{$lote}/aplicar", ['modo' => $modo, 'arquivo' => 'teste.xlsx'], $h);

        return [$parte, $fim];
    }

    public function test_exportar_e_importar_de_volta(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        DB::table('protecoes')->insert(['protecao_id' => 'P1', 'alimentador' => 'AL1']);
        DB::statement("UPDATE protecoes SET loc = ST_SetSRID(ST_MakePoint(-56.1, -15.6), 4326) WHERE protecao_id = 'P1'");
        DB::table('protecoes')->insert(['protecao_id' => 'P2', 'alimentador' => 'AL2']);
        DB::table('exclusoes')->insert(['base' => 'protecao', 'chave' => 'P2']);

        $exp = $this->get('/api/cadastros/protecao/exportar', $h)->assertOk()->streamedContent();
        $lista = json_decode($exp, true);
        $this->assertCount(1, $lista);   // o excluido nao sai
        $this->assertSame(['P1', 'AL1', -15.6, -56.1], [$lista[0]['protecaoId'], $lista[0]['alimentador'], $lista[0]['lat'], $lista[0]['lng']]);

        // atualizar: P1 muda so o que veio, P3 entra; linha ruim e sem chave nao derrubam as outras
        $lista[0]['zona'] = 'U';
        [$parte, $fim] = $this->importar($h, 'protecao', [$lista[0], ['protecaoId' => 'P3', 'lat' => '-15,5', 'lng' => '-56'], ['protecaoId' => 'P4', 'lat' => 'x', 'lng' => 1], ['zona' => 'R']]);
        $this->assertSame(2, $parte['aceitas']);
        $this->assertSame([3, 4], array_column($parte['erros'], 'linha'));
        $fim->assertOk()->assertJson(['novos' => 1, 'atualizados' => 1, 'removidos' => 0]);
        $this->assertSame('U', DB::table('protecoes')->where('protecao_id', 'P1')->value('zona'));
        $this->assertSame('POINT(-56 -15.5)', DB::selectOne("SELECT ST_AsText(loc) t FROM protecoes WHERE protecao_id='P3'")->t);
        $this->assertTrue(DB::table('exclusoes')->where('base', 'protecao')->where('chave', 'P2')->exists()); // flag continua
        $this->assertSame('Gestão de Bases: protecao', DB::table('importacoes_log')->value('base'));
    }

    public function test_importar_substituir_repetida_e_colunas_ausentes(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        DB::table('vao')->insert([['protecao_id' => 'A', 'polo' => 'X', 'postes' => 1], ['protecao_id' => 'B', 'polo' => 'Y', 'postes' => 2]]);
        // arquivo sem a coluna "postes": ela fica como estava; A repetida -> vale a ultima
        [, $fim] = $this->importar($h, 'vao', [['protecaoId' => 'A', 'polo' => 'P1'], ['protecaoId' => 'A', 'polo' => 'P2'], ['protecaoId' => 'C', 'polo' => 'Z']], 'substituir');
        $fim->assertOk()->assertJson(['novos' => 1, 'atualizados' => 1, 'removidos' => 1, 'repetidasNoArquivo' => 1]);
        $this->assertSame(['A' => 'P2', 'C' => 'Z'], DB::table('vao')->orderBy('protecao_id')->pluck('polo', 'protecao_id')->all());
        $this->assertSame(1, DB::table('vao')->where('protecao_id', 'A')->value('postes'));

        // equipes: nome obrigatorio vira o codigo; esquema sem descricao vira vazio
        $this->importar($h, 'equipes', [['id' => 'EQ9', 'polo' => 'Sinop']])[1]->assertOk();
        $this->assertSame(['EQ9', true], [DB::table('equipes')->where('id', 'EQ9')->value('nome'), (bool) DB::table('equipes')->where('id', 'EQ9')->value('ativo')]);
        $this->importar($h, 'esquemas', [['codigo' => 'E9', 'tipo' => 'Poda']])[1]->assertOk();
        $this->assertSame('', DB::table('esquemas')->where('codigo', 'E9')->value('descricao'));
        $this->importar($h, 'municipios', [['codigo' => '1', 'nome' => 'Um']])[1]->assertOk()->assertJson(['novos' => 1]);
    }

    public function test_importar_permissao_e_metas(): void
    {
        $this->usuario('a1', 'Administrador');
        $ver = $this->usuario('u1', 'Consulta', ['manutencao.visualizar', 'manutencao.editar']);
        $this->postJson('/api/cadastros/vao/importar/iniciar', [], $ver)->assertStatus(403);
        $this->get('/api/cadastros/vao/exportar', $ver)->assertOk();
        $adm = $this->usuario('a2', 'Administrador');
        $this->postJson('/api/cadastros/metas/importar/iniciar', [], $adm)->assertStatus(400);
        // lote de outra pessoa nao e aplicado
        $lote = $this->postJson('/api/cadastros/vao/importar/iniciar', [], $adm)->json('lote');
        $this->postJson("/api/cadastros/vao/importar/{$lote}/parte", ['registros' => [['protecaoId' => 'Z']]], $adm)->assertOk();
        $outro = $this->usuario('a3', 'Administrador');
        $this->postJson("/api/cadastros/vao/importar/{$lote}/aplicar", [], $outro)->assertStatus(400);
    }

    public function test_equipes_e_metas_so_excluir_e_restaurar(): void
    {
        $h = $this->usuario('a1', 'Administrador');
        DB::table('equipes')->insert(['id' => 'EQ1', 'nome' => 'EQ1', 'polo' => 'Cuiabá']);
        DB::table('metas')->insert(['id' => 'm1', 'equipe_id' => 'EQ1', 'ano_mes' => '2026-01', 'meta_mensal' => 100, 'dias_uteis' => 20, 'meta_diaria' => 5]);

        $this->deleteJson('/api/cadastros/equipes/EQ1', [], $h)->assertOk();
        $this->getJson('/api/equipes', $h)->assertExactJson([]);
        $this->getJson('/api/cadastros/equipes?excluidos=1', $h)->assertJson(['total' => 1, 'registros' => [['id' => 'EQ1', 'polo' => 'Cuiabá', 'ativo' => true]]]);

        $this->deleteJson('/api/cadastros/metas/m1', [], $h)->assertOk();
        $this->getJson('/api/metas', $h)->assertExactJson([]);
        $this->getJson('/api/cadastros/metas?excluidos=1&tamanhoPagina=200', $h)->assertJson(['registros' => [['id' => 'm1', 'equipeId' => 'EQ1', 'metaMensal' => 100]]]);
        $this->postJson('/api/cadastros/metas', ['id' => 'x'], $h)->assertStatus(400);
        $this->putJson('/api/cadastros/metas/m1', ['metaMensal' => 1], $h)->assertStatus(400);
        $this->postJson('/api/cadastros/metas/m1/restaurar', [], $h)->assertOk();
        $this->assertCount(1, $this->getJson('/api/metas', $h)->json());
    }
}
