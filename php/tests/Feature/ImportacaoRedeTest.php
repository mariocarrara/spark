<?php

namespace Tests\Feature;

use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ImportacaoRedeTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): array
    {
        $u = new Usuario(['id' => 'a1', 'nome' => 'Adm', 'email' => 'a1@t.local', 'status_conta' => 'Ativo', 'perfil_base' => 'Administrador']);
        $u->senha_hash = Hash::make('senha-forte-1');
        $u->save();

        return ['Authorization' => 'Bearer '.SessaoToken::criar($u, '127.0.0.1', 'teste')];
    }

    /** .shp de polilinhas (1 parte cada) */
    private static function shp(array $linhas): string
    {
        $corpo = '';
        foreach ($linhas as $i => $pts) {
            $c = pack('V', 3).str_repeat("\0", 32).pack('V2', 1, count($pts)).pack('V', 0);
            foreach ($pts as [$x, $y]) {
                $c .= pack('e2', $x, $y);
            }
            $corpo .= pack('N2', $i + 1, strlen($c) / 2).$c;
        }

        return pack('N', 9994).str_repeat("\0", 20).pack('N', (100 + strlen($corpo)) / 2).pack('V2', 1000, 3).str_repeat("\0", 64).$corpo;
    }

    /** .dbf (Latin-1) com campos texto */
    private static function dbf(array $campos, array $regs): string
    {
        $cab = '';
        $tamReg = 1;
        foreach ($campos as [$nome, $t]) {
            $cab .= str_pad($nome, 11, "\0").'C'.str_repeat("\0", 4).chr($t).str_repeat("\0", 15);
            $tamReg += $t;
        }
        $dados = '';
        foreach ($regs as $r) {
            $dados .= ($r['__excluido'] ?? false) ? '*' : ' ';
            foreach ($campos as [$nome, $t]) {
                $dados .= str_pad(substr(mb_convert_encoding((string) ($r[$nome] ?? ''), 'ISO-8859-1', 'UTF-8'), 0, $t), $t, ' ');
            }
        }

        return chr(3).str_repeat("\0", 3).pack('V', count($regs)).pack('v2', 32 + strlen($cab) + 1, $tamReg).str_repeat("\0", 20).$cab."\x0D".$dados."\x1A";
    }

    private static function zip(string $nome, array $arquivos): UploadedFile
    {
        $tmp = tempnam(sys_get_temp_dir(), 'spk');
        $z = new \ZipArchive;
        $z->open($tmp, \ZipArchive::OVERWRITE);
        foreach ($arquivos as $n => $c) {
            $z->addFromString($n, $c);
        }
        $z->close();

        return new UploadedFile($tmp, $nome, null, null, true);
    }

    public function test_shapefile_da_rede_mt(): void
    {
        if (! class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('extensao zip');
        }
        $h = $this->admin();
        $campos = [['COD_ID', 10], ['CTMT', 10], ['CT_COD_OP', 10], ['SUB', 4], ['FAS_CON', 4], ['TIP_CND', 10], ['COMP', 10]];
        $shp = self::shp([[[-51.4735561, -22.0657544], [-51.473717, -22.066001]], [[-51.1, -22.1], [-51.2, -22.2]], [[-51.3, -22.3], [-51.4, -22.4]], [[-50, -21], [-50.1, -21.1]]]);
        $dbf = self::dbf($campos, [
            ['COD_ID' => '1152929', 'CTMT' => '1378394', 'CT_COD_OP' => 'H2-A8', 'SUB' => '23', 'FAS_CON' => 'ABC', 'TIP_CND' => '1975HOR-3', 'COMP' => '31.959'],
            ['COD_ID' => '1152931', 'CTMT' => '1378394', 'CT_COD_OP' => 'H2-A8', 'SUB' => '23', 'FAS_CON' => 'ABC', 'TIP_CND' => '1995COM-3', 'COMP' => '31.006'],
            ['COD_ID' => '9', 'CTMT' => '', 'CT_COD_OP' => '', 'COMP' => '10'],
            ['COD_ID' => 'X', 'CTMT' => '1', '__excluido' => true],
        ]);
        $res = $this->post('/api/importacao/shapefile', ['camada' => 'rede_media_tensao', 'base' => 'Rede MT', 'arquivo' => [self::zip('ssdmt.zip', ['SSDMT.shp' => $shp, 'SSDMT.dbf' => $dbf, 'SSDMT.prj' => 'GEOGCS["SIRGAS 2000"]'])]], $h);
        $linhas = array_map(fn ($l) => json_decode($l, true), array_filter(explode("\n", $res->streamedContent())));
        $fim = end($linhas);
        $this->assertSame('final', $fim['tipo'], json_encode($fim));
        $this->assertSame([2, 3, 1, null], [$fim['alimentadores'], $fim['trechos'], $fim['rejeitados'], $fim['avisoProjecao']]);

        $fc = json_decode($this->get('/api/manutencao/camadas?ctmt=1378394', $h)->getContent(), true)['rede_mt'];
        $this->assertSame([[-51.473556, -22.065754], [-51.473717, -22.066001]], $fc['features'][0]['geometry']['coordinates']);
        $this->assertEquals(['COD_ID' => '1152929', 'CTMT' => '1378394', 'NOM_ALIM' => 'H2-A8', 'CT_COD_OP' => 'H2-A8', 'SUB' => '23', 'FAS_CON' => 'ABC', 'TIP_CND' => '1975HOR-3', 'COMP' => 31.959],
            $fc['features'][0]['properties']);
        $a = DB::table('rede_alimentadores')->where('camada', 'mt')->where('alimentador', '1378394')->first();
        $this->assertSame(['H2-A8', 2, 63.0], [$a->nome, $a->trechos, (float) $a->metros]);
        $this->assertTrue(DB::table('rede_alimentadores')->where('camada', 'mt')->where('alimentador', '_sem_alimentador')->exists());

        $this->post('/api/importacao/shapefile', ['camada' => 'postes', 'arquivo' => [self::zip('p.zip', ['a.shp' => $shp])]], $h)->assertOk();
    }

    public function test_kmz_de_app(): void
    {
        if (! class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('extensao zip');
        }
        $h = $this->admin();
        $kml = '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document id="x"><Placemark><name>3500105</name>'
            .'<description><![CDATA[<table><tr><td>MUNICIPIO</td><td>ADAMANTINA</td></tr><tr><td>APP_M</td><td>30</td></tr></table>]]></description>'
            .'<Polygon><outerBoundaryIs><LinearRing><coordinates>-51.0364806206841,-21.6612565200239,0 -51.03,-21.66,0 -51.04,-21.67,0 -51.0364806206841,-21.6612565200239,0</coordinates></LinearRing></outerBoundaryIs></Polygon>'
            .'</Placemark></Document></kml>';
        $res = $this->post('/api/importacao/shapefile', ['camada' => 'app', 'arquivo' => [self::zip('Trecho_AL1C01_APP.kmz', ['doc.kml' => $kml]), self::zip('sem_padrao.kmz', ['doc.kml' => $kml])]], $h);
        $linhas = array_map(fn ($l) => json_decode($l, true), array_filter(explode("\n", $res->streamedContent())));
        $fim = end($linhas);
        $this->assertSame([1, 1, 1], [$fim['alimentadores'], $fim['trechos'], $fim['rejeitados']], json_encode($fim));
        $this->assertStringContainsString('Trecho_<ALIMENTADOR>_APP.kmz', $fim['errosDetalhe'][0]['motivo']);
        $fc = json_decode($this->get('/api/manutencao/camadas?app=AL1C01', $h)->getContent(), true)['app'];
        $this->assertEquals(['NOME' => '3500105', 'MUNICIPIO' => 'ADAMANTINA', 'APP_M' => '30'], $fc['features'][0]['properties']);
        $this->assertSame(-51.0364806206841, $fc['features'][0]['geometry']['coordinates'][0][0][0]);
    }
}
