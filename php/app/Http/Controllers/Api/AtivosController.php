<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use App\Services\Importacao\ImportadorAtivos;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Acoes de manutencao das bases (contrato de routes/postes.ps1, routes/equip.ps1 e routes/importacao.ps1):
 *   DELETE /postes?confirmar=sim                   apaga a base de postes (importar + editar)
 *   POST   /postes/aplicar                         reaplica VERA > XY > Poste > cidade nas OS (importar + editar)
 *   DELETE /equip?camada=X&confirmar=sim          apaga uma camada de equipamentos (importar + editar)
 *   POST   /importacao/resetar-tudo                "Apagar tudo" (so administrador): as bases importadas e as camadas de rede;
 *                                                  usuarios, permissoes, feriados, postes, equipamentos, historico, nix e rank ficam
 */
class AtivosController extends Controller
{
    private function negar(Request $r, string $msg): ?JsonResponse
    {
        $eu = $r->user();

        return ($eu->pode('manutencao', 'importar') && $eu->pode('manutencao', 'editar')) ? null : response()->json(['erro' => $msg], 403);
    }

    public function apagarPostes(Request $r): JsonResponse
    {
        if ($x = $this->negar($r, 'Sem permissão para apagar a base de postes (precisa poder importar e editar).')) {
            return $x;
        }
        if ($r->query('confirmar') !== 'sim') {
            return response()->json(['erro' => 'Falta a confirmação (confirmar=sim).'], 400);
        }
        $n = DB::transaction(function () {
            DB::table('legado_bruto')->where('entidade', 'postes_meta')->delete();

            return DB::table('postes')->delete();
        });
        Auditoria::registrar('apagar_tudo', 'postes', null, $r->user()->id, ['apagados' => $n], $r->ip());

        return response()->json(['ok' => true]);
    }

    public function aplicar(Request $r): JsonResponse
    {
        if ($x = $this->negar($r, 'Sem permissão para reaplicar a posição das OS.')) {
            return $x;
        }
        @set_time_limit(600);
        $st = ImportadorAtivos::aplicarPosicao();
        Auditoria::registrar('aplicar', 'postes', null, $r->user()->id, $st, $r->ip());

        return response()->json($st);
    }

    public function apagarEquip(Request $r): JsonResponse
    {
        if ($x = $this->negar($r, 'Sem permissão para apagar a base de equipamentos.')) {
            return $x;
        }
        $camada = (string) $r->query('camada', '');
        if (! isset(ImportadorAtivos::EQUIP[$camada])) {
            return response()->json(['erro' => 'Camada inválida.'], 400);
        }
        if ($r->query('confirmar') !== 'sim') {
            return response()->json(['erro' => 'Falta a confirmação (confirmar=sim).'], 400);
        }
        DB::transaction(function () use ($camada) {
            DB::table('equipamentos')->where('camada', $camada)->delete();
            $meta = array_values(array_filter(json_decode((string) DB::table('legado_bruto')->where('entidade', 'equip_meta')->value('dados'), true) ?: [],
                fn ($m) => ($m['camada'] ?? '') !== $camada));
            DB::table('legado_bruto')->upsert([['entidade' => 'equip_meta', 'dados' => json_encode($meta), 'importado_em' => now()]], ['entidade'], ['dados', 'importado_em']);
        });
        Auditoria::registrar('apagar_tudo', 'equip', $camada, $r->user()->id, [], $r->ip());

        return response()->json(['ok' => true]);
    }

    public function resetarTudo(Request $r): JsonResponse
    {
        if (! $r->user()->isAdmin()) {
            return response()->json(['erro' => 'Só administradores podem apagar todas as bases.'], 403);
        }
        $tabelas = ['equipes', 'vao', 'protecoes', 'vera', 'metas', 'conjuntos', 'os', 'programacoes', 'justificativas', 'indisponibilidades',
            'importacoes_log', 'protecao_alimentador', 'alimentador_polo', 'exclusoes', 'rede_feicoes', 'rede_alimentadores', 'app_rl_indice', 'mo_linhas'];
        $brutos = ['prefeituras', 'localidades', 'logistica_equipes', 'logistica_os', 'logistica_programacoes', 'logistica_vinculos'];
        try {
            DB::transaction(function () use ($tabelas, $brutos) {
                DB::statement('TRUNCATE '.implode(', ', $tabelas).' CASCADE');   // programacoes leva equipes/OS/log da programacao
                DB::table('legado_bruto')->whereIn('entidade', $brutos)->delete();
                DB::table('configuracoes')->where('chave', 'app_rl_indice')->delete();
            });
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['erro' => 'Erro ao apagar as bases: '.$e->getMessage()], 500);
        }
        foreach (glob(storage_path('app'.DIRECTORY_SEPARATOR.'cache'.DIRECTORY_SEPARATOR.'*')) ?: [] as $f) {
            @unlink($f);
        }
        Auditoria::registrar('resetar_tudo', 'bases', null, $r->user()->id, ['tabelas' => $tabelas, 'legado_bruto' => $brutos], $r->ip());

        return response()->json(['ok' => true, 'basesZeradas' => array_merge(['equipes', 'vao', 'protecao', 'vera', 'prefeituras', 'metas', 'localidades', 'conjuntos',
            'manutencao_os', 'programacao', 'justificativas', 'indisponibilidades', 'logistica_equipes', 'logistica_os', 'logistica_programacoes',
            'importacoes_log', 'protecao_alim', 'alimentador_polo', 'exclusoes'], ['logistica_vinculos']),
            'camadasZeradas' => ['rede_media_tensao', 'rede_baixa_tensao', 'rede_alta_tensao', 'reserva_legal', 'app'],
            'mensagem' => 'Todas as bases importadas e as camadas de rede foram apagadas. Usuários, permissões e feriados foram preservados.']);
    }
}
