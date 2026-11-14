<?php

namespace Tests\Feature;

use App\Models\Usuario;
use App\Services\Importacao\ImportadorAtivos;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\XlsxTeste;
use Tests\TestCase;

class ImportacaoAtivosTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): array
    {
        $u = new Usuario(['id' => 'a1', 'nome' => 'Adm', 'email' => 'a1@t.local', 'status_conta' => 'Ativo', 'perfil_base' => 'Administrador']);
        $u->senha_hash = Hash::make('senha-forte-1');
        $u->save();

        return ['Authorization' => 'Bearer '.SessaoToken::criar($u, '127.0.0.1', 'teste')];
    }

    private static function shpPontos(array $pts): string
    {
        $corpo = '';
        foreach ($pts as $i => [$x, $y]) {
            $c = pack('V', 1).pack('e2', $x, $y);
            $corpo .= pack('N2', $i + 1, strlen($c) / 2).$c;
        }

        return pack('N', 9994).str_repeat("\0", 20).pack('N', (100 + strlen($corpo)) / 2).pack('V2', 1000, 1).str_repeat("\0", 64).$corpo;
    }

    private static function dbf(array $campos, array $regs): string
    {
        $cab = '';
        $tam = 1;
        foreach ($campos as [$n, $t]) {
            $cab .= str_pad($n, 11, "\0").'C'.str_repeat("\0", 4).chr($t).str_repeat("\0", 15);
            $tam += $t;
        }
        $d = '';
        foreach ($regs as $r) {
            $d .= ($r['__x'] ?? false) ? '*' : ' ';
            foreach ($campos as [$n, $t]) {
                $d .= str_pad(substr(mb_convert_encoding((string) ($r[$n] ?? ''), 'ISO-8859-1', 'UTF-8'), 0, $t), $t, ' ');
            }
        }

        return chr(3).str_repeat("\0", 3).pack('V', count($regs)).pack('v2', 32 + strlen($cab) + 1, $tam).str_repeat("\0", 20).$cab."\x0D".$d."\x1A";
    }

    private static function arquivo(string $nome, string $conteudo): UploadedFile
    {
        $tmp = tempnam(sys_get_temp_dir(), 'spk');
        file_put_contents($tmp, $conteudo);

        return new UploadedFile($tmp, $nome, null, null, true);
    }

    private function enviar(array $h, string $camada, array $arquivos): array
    {
        $txt = $this->post('/api/importacao/shapefile', ['camada' => $camada, 'arquivo' => $arquivos], $h)->assertOk()->streamedContent();
        $l = array_map(fn ($x) => json_decode($x, true), array_filter(explode("\n", $txt)));

        return end($l);
    }

    public function test_pac_e_utm_iguais_ao_legado(): void
    {
        $this->assertSame([457447.89, 7552899.9], ImportadorAtivos::decodePac('45744789755289990ET'));
        $this->assertNull(ImportadorAtivos::decodePac('2JQM156771'));
        [$lat, $lng] = ImportadorAtivos::utmSul(457447.89, 7552899.90);
        $this->assertEqualsWithDelta(-22.1284292, $lat, 1e-7);
        $this->assertEqualsWithDelta(-51.4126134, $lng, 1e-7);
    }

    public function test_ponnot_equipamentos_e_nomes(): void
    {
        if (! class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('extensao zip');
        }
        $h = $this->admin();
        // PONNOT: o 1o poste fica exatamente onde o PAC abaixo aponta; 1 apagado; 1 repetido
        [$lat, $lng] = ImportadorAtivos::utmSul(457447.89, 7552899.90);
        $shp = self::shpPontos([[$lng, $lat], [-51.0, -22.0], [-51.1, -22.1], [-51.2, -22.2]]);
        $dbf = self::dbf([['COD_ID', 10], ['TIP_PN', 4], ['ARE_LOC', 2], ['CONJ', 6], ['MUN', 8]], [
            ['COD_ID' => 'P1', 'TIP_PN' => 'PT', 'ARE_LOC' => 'UB', 'CONJ' => '123', 'MUN' => '3500105'],
            ['COD_ID' => 'P2', 'TIP_PN' => 'PT'], ['COD_ID' => 'P3', '__x' => true], ['COD_ID' => 'P1', 'TIP_PN' => 'XX']]);
        $fim = $this->enviar($h, 'postes', [self::arquivo('PONNOT.shp', $shp), self::arquivo('PONNOT.dbf', $dbf)]);
        $this->assertSame('final', $fim['tipo'], json_encode($fim));
        $this->assertSame([3, 1, ['PT' => 2, 'XX' => 1]], [$fim['postes']['total'], $fim['postes']['apagados'], $fim['postes']['porTipo']]);
        $this->assertSame(2, DB::table('postes')->count());
        $this->assertSame('PT', DB::table('postes')->where('cod_id', 'P1')->value('tipo'));   // repetido: vale o primeiro
        $this->assertArrayHasKey('osAtualizadas', $fim['aplicadoNasOS']);

        // Excel de nomes antes do DBF: o nome fica guardado e entra quando o equipamento chega
        $xl = XlsxTeste::criar([['Id', 'Name', 'Alias'], ['900.0', 'C2994-2', ''], ['', 'sem id', '']]);
        $fim = $this->enviar($h, 'equipamentos', [new UploadedFile($xl, 'Isolating Equipment Installation.xlsx', null, null, true)]);
        $this->assertSame([1, 1], [$fim['equipamentos']['nomes'][0]['lidos'], $fim['equipamentos']['nomes'][0]['semChave']]);

        $eq = self::dbf([['COD_ID', 6], ['PAC_1', 20], ['CTMT', 8], ['CONJ', 6], ['TIP_UNID', 4], ['FAS_CON', 4]], [
            ['COD_ID' => '900', 'PAC_1' => '45744789755289990ET', 'CTMT' => '1378394', 'TIP_UNID' => '22'],
            ['COD_ID' => '901', 'PAC_1' => '2JQM156771'],                                   // PAC sem coordenada
            ['COD_ID' => '902', 'PAC_1' => '45700000755200000ET', 'TIP_UNID' => '25']]);   // longe de poste
        $fim = $this->enviar($h, 'equipamentos', [self::arquivo('UNSEMT.dbf', $eq), self::arquivo('OUTRA.dbf', $eq)]);
        $c = $fim['equipamentos']['camadas'][0];
        $this->assertSame(['protecoes', 2, 1, 1, 1], [$c['camada'], $c['total'], $c['comPoste'], $c['semPoste'], $c['semPosicao']], json_encode($fim));
        $this->assertSame(['OUTRA.dbf'], $fim['equipamentos']['ignorados']);
        $e = DB::table('equipamentos')->where('camada', 'protecoes')->where('cod_id', '900')->first();
        $this->assertSame(['P1', 'C2994-2', '22'], [$e->poste, $e->nome_operativo, $e->v0]);

        // acoes da Gestao de Bases
        $this->deleteJson('/api/equip?camada=protecoes&confirmar=sim', [], $h)->assertOk();
        $this->assertSame(0, DB::table('equipamentos')->where('camada', 'protecoes')->count());
        $this->assertSame(1, DB::table('equip_nomes')->count());   // os nomes ficam
        $this->postJson('/api/postes/aplicar', [], $h)->assertOk()->assertJsonStructure(['osAtualizadas', 'viraramVera']);
        $this->deleteJson('/api/postes', [], $h)->assertStatus(400);
        $this->deleteJson('/api/postes?confirmar=sim', [], $h)->assertOk();
        $this->assertSame(0, DB::table('postes')->count());
    }

    public function test_resetar_tudo(): void
    {
        $h = $this->admin();
        DB::table('equipes')->insert(['id' => 'E1', 'nome' => 'E1']);
        DB::table('feriados')->insert(['data' => '2026-12-25', 'descricao' => 'Natal', 'abrangencia' => 'Nacional']);
        DB::table('legado_bruto')->insert(['entidade' => 'prefeituras', 'dados' => '[]']);
        $this->postJson('/api/importacao/resetar-tudo', [], $h)->assertOk()->assertJson(['ok' => true]);
        $this->assertSame([0, 1, 0], [DB::table('equipes')->count(), DB::table('feriados')->count(), DB::table('legado_bruto')->where('entidade', 'prefeituras')->count()]);
        $this->assertTrue(DB::table('usuarios')->exists());
    }
}
