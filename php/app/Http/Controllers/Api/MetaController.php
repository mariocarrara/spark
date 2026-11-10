<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * /api/metas — contrato de routes/produtividade.ps1 (Invoke-MetasRoute). O calculo da produtividade
 * continua no navegador; aqui so guarda as metas.
 * Regra (CLAUDE.md): meta e unica por equipe + tipo (poda|faixa) + AnoMes — POST de uma que ja existe ATUALIZA
 * (o legado acrescentava outra). metaDiaria = metaMensal / dias uteis (sem sabado, domingo e feriados cadastrados).
 */
class MetaController extends Controller
{
    public function index(Request $r): JsonResponse
    {
        if (! $r->user()->pode('metas', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para visualizar Metas.'], 403);
        }
        $excl = DB::table('exclusoes')->where('base', 'metas')->pluck('chave')->flip();
        $lista = DB::table('metas')->orderBy('ano_mes')->orderBy('equipe_id')->get()
            ->reject(fn ($m) => isset($excl[$m->id]))->map(fn ($m) => self::paraFront($m))->values();

        return response()->json($lista);
    }

    public function store(Request $r): JsonResponse
    {
        $eu = $r->user();
        if (! $eu->pode('metas', 'criar')) {
            return response()->json(['erro' => 'Sem permissão para criar Metas.'], 403);
        }
        $equipe = trim((string) $r->input('equipeId', ''));
        $anoMes = trim((string) $r->input('anoMes', ''));
        $mensal = $r->input('metaMensal');
        if ($equipe === '' || ! self::anoMesValido($anoMes) || ! is_numeric($mensal) || $mensal < 0) {
            return response()->json(['erro' => 'Informe equipe, mês (AAAA-MM) e meta mensal (número).'], 400);
        }
        $tipo = self::tipo($r->input('tipo'));
        $dados = self::calcular($anoMes, (float) $mensal) + ['equipe_id' => mb_substr($equipe, 0, 60), 'tipo' => $tipo, 'ano_mes' => $anoMes,
            'origem' => 'Manual', 'atualizado_por' => $eu->nome, 'atualizado_em' => now()];
        $id = DB::table('metas')->where('equipe_id', $dados['equipe_id'])->where('tipo', $tipo)->where('ano_mes', $anoMes)->value('id');
        if ($id) {
            DB::table('metas')->where('id', $id)->update($dados);
        } else {
            $id = (string) Str::uuid();
            DB::table('metas')->insert($dados + ['id' => $id]);
        }
        Auditoria::registrar('gravar', 'metas', $id, $eu->id, ['equipe' => $equipe, 'tipo' => $tipo, 'anoMes' => $anoMes, 'metaMensal' => (float) $mensal], $r->ip());

        return response()->json(self::paraFront(DB::table('metas')->where('id', $id)->first()), 201);
    }

    public function update(Request $r, string $id): JsonResponse
    {
        $eu = $r->user();
        if (! $eu->pode('metas', 'editar')) {
            return response()->json(['erro' => 'Sem permissão para editar Metas.'], 403);
        }
        $m = DB::table('metas')->where('id', $id)->first();
        if (! $m) {
            return response()->json(['erro' => 'Meta não encontrada.'], 404);
        }
        $anoMes = $r->filled('anoMes') ? trim((string) $r->input('anoMes')) : $m->ano_mes;
        $mensal = $r->has('metaMensal') && $r->input('metaMensal') !== null ? $r->input('metaMensal') : $m->meta_mensal;
        if (! self::anoMesValido($anoMes) || ! is_numeric($mensal) || $mensal < 0) {
            return response()->json(['erro' => 'Mês (AAAA-MM) ou meta mensal inválidos.'], 400);
        }
        $outra = DB::table('metas')->where('id', '<>', $id)->where('equipe_id', $m->equipe_id)->where('tipo', $m->tipo)->where('ano_mes', $anoMes)->exists();
        if ($outra) {
            return response()->json(['erro' => 'Essa equipe já tem meta desse tipo nesse mês.'], 409);
        }
        DB::table('metas')->where('id', $id)->update(self::calcular($anoMes, (float) $mensal) + ['ano_mes' => $anoMes, 'atualizado_por' => $eu->nome, 'atualizado_em' => now()]);
        Auditoria::registrar('alterar', 'metas', $id, $eu->id, ['de' => ['anoMes' => $m->ano_mes, 'metaMensal' => (float) $m->meta_mensal],
            'para' => ['anoMes' => $anoMes, 'metaMensal' => (float) $mensal]], $r->ip());

        return response()->json(self::paraFront(DB::table('metas')->where('id', $id)->first()));
    }

    private static function calcular(string $anoMes, float $mensal): array
    {
        $feriados = DB::table('feriados')->pluck('data')->map(fn ($d) => substr((string) $d, 0, 10))->flip();
        $dias = ImportacaoBasesController::diasUteis($anoMes, $feriados);

        return ['meta_mensal' => $mensal, 'dias_uteis' => $dias, 'meta_diaria' => $dias > 0 ? round($mensal / $dias, 2) : 0];
    }

    /** "faixa" (limpeza de faixa) ou "poda" (padrao). */
    private static function tipo($v): string
    {
        return preg_match('/faixa|limpeza/i', (string) $v) ? 'faixa' : 'poda';
    }

    private static function anoMesValido(string $t): bool
    {
        return (bool) preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $t);
    }

    private static function paraFront(object $m): array
    {
        $n = fn ($v) => $v === null ? null : (fmod((float) $v, 1.0) == 0.0 ? (int) $v : (float) $v);

        return ['id' => $m->id, 'equipeId' => $m->equipe_id, 'tipo' => $m->tipo, 'anoMes' => trim($m->ano_mes), 'metaMensal' => $n($m->meta_mensal),
            'diasUteis' => (int) $m->dias_uteis, 'metaDiaria' => $n($m->meta_diaria), 'origem' => $m->origem, 'atualizadoPor' => $m->atualizado_por,
            'atualizadoEm' => $m->atualizado_em ? Carbon::parse($m->atualizado_em)->toIso8601String() : null];
    }
}
