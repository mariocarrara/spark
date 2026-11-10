<?php

namespace Tests\Feature;

use App\Models\Permissao;
use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ImportacaoBasesTest extends TestCase
{
    use DatabaseTransactions;

    private array $h;

    protected function setUp(): void
    {
        parent::setUp();
        $this->h = $this->como('a1', 'Administrador');
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

        return ['Authorization' => 'Bearer '.SessaoToken::criar($u, '127.0.0.1', 't')];
    }

    private function enviar(string $acao, string $base, array $linhas, ?array $h = null)
    {
        return $this->postJson("/api/importacao/$acao", ['base' => $base, 'linhas' => $linhas, 'arquivoOrigem' => 'teste.xlsx'], $h ?? $this->h);
    }

    public function test_validar_mostra_erros_linha_a_linha_sem_gravar(): void
    {
        $r = $this->enviar('validar', 'Metas', [
            ['CodigoEquipe' => 'EQ1', 'AnoMes' => '2026-03', 'MetaMensal' => '357', 'Servico' => ''],
            ['CodigoEquipe' => 'EQ2', 'AnoMes' => 'março', 'MetaMensal' => 'x', 'Servico' => ''],
        ])->assertOk()->json();
        $this->assertSame([2, 1, 2], [$r['totalLinhas'], $r['validas'], $r['totalErros']]);
        $this->assertSame(['numeroLinha' => 3, 'coluna' => 'AnoMes', 'motivo' => 'AnoMes ausente ou fora do formato esperado (anomes)'], $r['erros'][0]);
        $this->assertSame('EQ1', $r['preVisualizacao'][0]['CodigoEquipe']);
        $this->assertSame(0, DB::table('metas')->count());
    }

    public function test_metas_dias_uteis_e_repetidas_vale_a_ultima(): void
    {
        DB::table('feriados')->insert(['data' => '2026-04-21', 'descricao' => 'Tiradentes']);
        $this->enviar('confirmar', 'Metas', [
            ['CodigoEquipe' => 'EQ1', 'AnoMes' => '2026-04', 'MetaMensal' => '100', 'Servico' => ''],
            ['codigoequipe' => 'EQ1', 'AnoMes' => '2026-04', 'MetaMensal' => '210', 'Servico' => 'Poda'],      // mesma meta: vale esta
            ['CodigoEquipe' => 'EQ1', 'AnoMes' => '2026-04', 'MetaMensal' => '5,5', 'Servico' => 'Limpeza de faixa'],
        ])->assertOk()->assertJson(['processados' => 3, 'log' => ['base' => 'Metas', 'registrosProcessados' => 3]]);
        $poda = DB::table('metas')->where('tipo', 'poda')->first();
        // abril/2026: 22 dias uteis menos o feriado de 21/04 = 21
        $this->assertEquals([210, 21, 10, 'Importado', 'Nome a1'], [(float) $poda->meta_mensal, $poda->dias_uteis, (float) $poda->meta_diaria, $poda->origem, $poda->atualizado_por]);
        $this->assertEquals(5.5, (float) DB::table('metas')->where('tipo', 'faixa')->value('meta_mensal'));
        // reimportar atualiza, nao duplica
        $this->enviar('confirmar', 'Metas', [['CodigoEquipe' => 'EQ1', 'AnoMes' => '2026-04', 'MetaMensal' => '300', 'Servico' => '']])->assertOk();
        $this->assertSame(2, DB::table('metas')->count());
        $this->assertEquals(300, (float) DB::table('metas')->where('tipo', 'poda')->value('meta_mensal'));
    }

    public function test_equipes_nao_reativa_equipe_desativada(): void
    {
        DB::table('equipes')->insert(['id' => 'EQ-OFF', 'nome' => 'EQ-OFF', 'ativo' => false]);
        $linha = fn ($id, $extra = []) => array_merge(['CodigoEquipe' => $id, 'TipoEquipe' => 'LM', 'Polo' => 'Assis', 'Regional' => 'Oeste', 'Departamento' => 'D',
            'ProprioTerceiro' => 'Própria', 'EquipePoda' => 'Sim', 'BaseLat' => '-22,5', 'BaseLng' => '-50,1'], $extra);
        $this->enviar('confirmar', 'Equipes', [$linha('EQ-OFF'), $linha('EQ-NOVA'), $linha('EQ-X', ['Ativa' => 'Não'])])->assertOk()->assertJson(['processados' => 3]);
        $this->assertSame([false, true, false], DB::table('equipes')->whereIn('id', ['EQ-OFF', 'EQ-NOVA', 'EQ-X'])->orderByRaw("array_position(ARRAY['EQ-OFF','EQ-NOVA','EQ-X'], id)")->pluck('ativo')->all());
        $e = DB::selectOne("SELECT polo, equipe_poda, ST_Y(base) AS lat FROM equipes WHERE id = 'EQ-NOVA'");
        $this->assertSame(['Assis', true], [$e->polo, $e->equipe_poda]);
        $this->assertEquals(-22.5, (float) $e->lat);
    }

    public function test_esquemas_conjuntos_prioridade_localidades_prefeituras(): void
    {
        $this->enviar('confirmar', 'Esquemas', [['Código' => 'E1', 'Descrição Esquema' => 'Poda obrigatória', 'Tipo' => 'Poda']])->assertOk();
        $this->assertSame('Poda obrigatória', DB::table('esquemas')->where('codigo', 'E1')->value('descricao'));

        $this->enviar('confirmar', 'Conjuntos', [['ALIMENTADOR' => 'alm-1', 'NOME CONJUNTO' => 'Assis', 'Conjunto' => '123', 'Tensão' => '13,8', 'TENSAO ' => '11,4/13,8', 'Regional' => 'O']])->assertOk();
        $c = DB::table('conjuntos')->where('alimentador', 'ALM-1')->first();
        $this->assertSame(['Assis', '123', '13,8', '11,4/13,8'], [$c->nome_conjunto, $c->cod_conjunto, $c->tensao_nominal, $c->tensao]);

        $this->enviar('confirmar', 'PrioridadeEW', [['Prioridade' => 'ALTA', 'Grupo Recurso' => 'PODA', 'Prioridade EW' => 'Sim', 'Tensão' => 'MT', 'Regional' => 'O']])->assertOk();
        $this->assertSame('Sim', DB::table('prioridade_ew')->where('chave', 'MT-ALTA-PODA-O')->value('prioridade_ew'));

        $this->enviar('confirmar', 'Localidades', [['COD LOCALIDADE' => '6001', 'POLO' => 'ASSIS', 'LOCALIDADE' => 'ASSIS', 'REGIONAL' => 'OESTE', 'COORDENADOR RESPONSÁVEL' => 'Fulano']])->assertOk();
        $this->getJson('/api/manutencao/localidades-mapa', $this->h)->assertJson(['porMunicipio' => ['ASSIS' => ['regional' => 'OESTE', 'coordenadorResponsavel' => 'Fulano']]]);

        $this->enviar('confirmar', 'Prefeituras', [['Municipio' => 'Assis', 'ContatoNome' => 'C', 'Email' => 'c@exemplo.com.br']])->assertOk();
        $this->enviar('confirmar', 'Prefeituras', [['Municipio' => 'Assis', 'ContatoNome' => 'D', 'Email' => 'd@exemplo.com.br']])->assertOk();
        $pref = json_decode(DB::table('legado_bruto')->where('entidade', 'prefeituras')->value('dados'), true);
        $this->assertEquals([['municipio' => 'Assis', 'contatoNome' => 'D', 'email' => 'd@exemplo.com.br', 'telefone' => null, 'ativo' => true]], $pref);
        $this->assertSame(6, DB::table('importacoes_log')->where('arquivo_origem', 'teste.xlsx')->count());   // 1 log por importacao
    }

    public function test_permissoes_e_bases_nao_migradas(): void
    {
        $h = $this->como('u1', 'Consulta', ['manutencao.visualizar', 'metas.visualizar']);
        $this->enviar('confirmar', 'Metas', [['CodigoEquipe' => 'EQ1', 'AnoMes' => '2026-04', 'MetaMensal' => '1']], $h)->assertStatus(403);
        $this->enviar('confirmar', 'Equipes', [], $h)->assertStatus(403);
        $this->enviar('validar', 'Inventada', [])->assertStatus(400);
        $this->enviar('validar', 'VERA', [])->assertStatus(400)->assertJson(['erro' => 'A importação de VERA ainda não foi migrada para o sistema novo.']);
    }
}
