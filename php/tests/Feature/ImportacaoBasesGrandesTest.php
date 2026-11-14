<?php

namespace Tests\Feature;

use App\Models\Usuario;
use App\Services\SessaoToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\XlsxTeste;
use Tests\TestCase;

class ImportacaoBasesGrandesTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): array
    {
        $u = new Usuario(['id' => 'a1', 'nome' => 'Adm', 'email' => 'a1@t.local', 'status_conta' => 'Ativo', 'perfil_base' => 'Administrador']);
        $u->senha_hash = Hash::make('senha-forte-1');
        $u->save();

        return ['Authorization' => 'Bearer '.SessaoToken::criar($u, '127.0.0.1', 'teste')];
    }

    private function enviar(array $h, string $base, array $linhas): array
    {
        $arq = new UploadedFile(XlsxTeste::criar($linhas), "d.$base.xlsx", null, null, true);
        $txt = $this->post("/api/importacao/$base", ['arquivo' => $arq], $h)->assertOk()->streamedContent();
        $l = array_map(fn ($x) => json_decode($x, true), array_filter(explode("\n", $txt)));

        return end($l);
    }

    public function test_vao_protecao_e_alimentador_polo(): void
    {
        if (! class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('extensao zip');
        }
        $h = $this->admin();
        DB::table('vao')->insert(['protecao_id' => 'VELHA', 'postes' => 1]);
        $fim = $this->enviar($h, 'vao', [
            ['Poste 1', 'Proteção', 'Regional', 'Polo', 'Rota (km)'],
            ['5286727.0', 'P-1', 'NORTE', 'TUPA', '0,12'],
            ['218-5286728', 'p-1', '#N/A', 'Sem', '0.30'],
            ['5286727', 'P-2', 'SUL', 'ASSIS', '9'],        // poste repetido: vale a 1a linha (0,12)
            ['', 'P-3', 'SUL', 'ASSIS', '1'],               // sem poste: nao conta
        ]);
        $this->assertSame('final', $fim['tipo'], json_encode($fim));
        $this->assertSame([2, 1, 2], [$fim['processados'], $fim['totalErros'], $fim['resumo']['postesComVao']]);
        $v = DB::table('vao')->where('protecao_id', 'P-1')->first();
        $this->assertSame([2, 0.42, 'TUPA', 'NORTE'], [(int) $v->postes, (float) $v->rota_km, $v->polo, $v->regional]);
        $this->assertFalse(DB::table('vao')->where('protecao_id', 'VELHA')->exists());   // substitui
        $this->assertSame(['5286727' => 0.12, '5286728' => 0.3], DB::table('vao_postes')->orderBy('poste_id')->pluck('rota_km', 'poste_id')->map(fn ($x) => (float) $x)->all());

        $fim = $this->enviar($h, 'protecao', [
            ['ELEMENTO', 'PROT. ELEMENTO', 'PROT. ELEMENTO 2', 'ALIMENTADOR', 'ZONA', 'LAT', 'LONG', 'TRECHO', 'TRECHO COM T4', 'PLANO EASY WORK'],
            ['E1', '', 'P-1', '', 'U', '-21,5', '-50.1', 'T1', '', ''],
            ['E1', 'X', '', 'AL1', 'R', '', '', 'T9', '', ''],          // linha repetida: completa so o que faltava
            ['E2', '', 'P-2', 'AL1', '', '-200', '1', '', '', ''],      // coordenada invalida
            ['', '', '', '', '', '', '', '', '', ''],
        ]);
        $this->assertSame([2, 2], [$fim['processados'], $fim['totalErros']], json_encode($fim));
        $e1 = DB::table('protecoes')->where('protecao_id', 'E1')->selectRaw('*, ST_AsText(loc) AS t')->first();
        $this->assertSame(['X', 'P-1', 'AL1', 'U', 'T1', 'POINT(-50.1 -21.5)'], [$e1->prot_elemento, $e1->protecao2, $e1->alimentador, $e1->zona, $e1->trecho, $e1->t]);
        // AL1 liga a P-1 (2 postes, TUPA) e P-2 (1 poste, ASSIS): fica TUPA
        $this->assertSame(['TUPA', 'NORTE'], array_values((array) DB::table('alimentador_polo')->where('alimentador', 'AL1')->first(['polo', 'regional'])));
        $this->assertTrue($this->getJson('/api/regras', $h)->json('vaoImportado'));
    }

    public function test_vera_junta_pela_chave(): void
    {
        if (! class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('extensao zip');
        }
        $h = $this->admin();
        DB::statement("INSERT INTO vera (id_vera, especie, loc) VALUES ('1', 'VELHA', ST_SetSRID(ST_MakePoint(-50, -21), 4326)), ('9', 'FICA', NULL)");
        $fim = $this->enviar($h, 'vera', [
            ['ID árvore', 'Alimentadores', 'Latitude', 'Longitude', 'Espécie', 'Cidade'],
            ['1', 'AL1', '-22,158369', '-51,1', 'IPÊ', 'TUPÃ'],
            ['2', 'AL2', '-22', '-51', '', ''],
            ['x', 'AL3', '-22', '-51', '', ''],
            ['3', 'AL3', 'abc', '-51', '', ''],
        ]);
        $this->assertSame([2, 2], [$fim['processados'], $fim['totalErros']], json_encode($fim));
        $this->assertSame(['IPÊ', 'TUPÃ', 'POINT(-51.1 -22.158369)'], array_values((array) DB::table('vera')->where('id_vera', '1')->selectRaw('especie, cidade, ST_AsText(loc)')->first()));
        $this->assertSame(3, DB::table('vera')->count());
        $this->assertSame('erro', $this->enviar($h, 'vera', [['Outra', 'Coluna'], ['1', '2']])['tipo']);
    }
}
