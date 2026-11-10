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
 * /api/justificativas — contrato de routes/produtividade.ps1 (Invoke-JustificativasRoute).
 * Imutavel depois de criada; 1 por equipe por dia; excluir e logico (flag), com quem e quando.
 */
class JustificativaController extends Controller
{
    public function index(Request $r): JsonResponse
    {
        if (! $r->user()->pode('produtividade', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para visualizar Justificativas.'], 403);
        }
        $q = DB::table('justificativas')->where('excluido', false);
        if ($e = $r->query('equipe')) {
            $q->where('equipe_id', $e);
        }

        return response()->json($q->orderBy('data')->orderBy('criado_em')->get()->map(fn ($j) => self::paraFront($j))->values());
    }

    public function store(Request $r): JsonResponse
    {
        $eu = $r->user();
        // "Nova" pela Gestao de Bases exige gestaoBases/criar; o "Justificar" da Produtividade, produtividade/criar
        $modulo = (string) $r->input('origem') === 'gestao' ? 'gestaoBases' : 'produtividade';
        if (! $eu->pode($modulo, 'criar')) {
            return response()->json(['erro' => 'Sem permissão para registrar Justificativas.'], 403);
        }
        $equipe = trim((string) $r->input('equipeId', ''));
        $dia = substr(trim((string) $r->input('data', '')), 0, 10);
        if ($equipe === '' || ! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dia, $m) || ! checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            return response()->json(['erro' => 'Informe a equipe e a data (AAAA-MM-DD).'], 400);
        }
        $novo = ['id' => (string) Str::uuid(), 'equipe_id' => mb_substr($equipe, 0, 60), 'data' => $dia,
            'tipo' => mb_substr(trim((string) $r->input('tipo', '')), 0, 200) ?: null, 'texto' => mb_substr(trim((string) $r->input('texto', '')), 0, 4000) ?: null,
            'autor_id' => $eu->id, 'criado_em' => now(), 'excluido' => false];
        $criou = DB::transaction(function () use ($novo) {
            // trava a equipe+dia para dois cliques simultaneos nao gravarem 2
            DB::select('SELECT pg_advisory_xact_lock(hashtext(?))', ['justificativa|'.$novo['equipe_id'].'|'.$novo['data']]);
            if (DB::table('justificativas')->where('excluido', false)->where('equipe_id', $novo['equipe_id'])->where('data', $novo['data'])->exists()) {
                return false;
            }
            DB::table('justificativas')->insert($novo);

            return true;
        });
        if (! $criou) {
            return response()->json(['erro' => 'Essa equipe já tem justificativa nesse dia.'], 409);
        }
        Auditoria::registrar('criar', 'justificativas', $novo['id'], $eu->id, ['equipe' => $equipe, 'data' => $dia, 'tipo' => $novo['tipo']], $r->ip());

        return response()->json(self::paraFront((object) $novo), 201);
    }

    public function destroy(Request $r, string $id): JsonResponse
    {
        $eu = $r->user();
        if (! $eu->pode('gestaoBases', 'excluirStatus')) {
            return response()->json(['erro' => 'Sem permissão para excluir Justificativas.'], 403);
        }
        $n = DB::table('justificativas')->where('id', $id)->where('excluido', false)->update(['excluido' => true, 'excluido_por' => $eu->id, 'excluido_em' => now()]);
        if (! $n) {
            return response()->json(['erro' => 'Justificativa não encontrada.'], 404);
        }
        Auditoria::registrar('excluir', 'justificativas', $id, $eu->id, [], $r->ip());

        return response()->json(['ok' => true, 'id' => $id]);
    }

    private static function paraFront(object $j): array
    {
        return ['id' => $j->id, 'equipeId' => $j->equipe_id, 'data' => substr((string) $j->data, 0, 10), 'tipo' => $j->tipo, 'texto' => $j->texto,
            'autorId' => $j->autor_id, 'criadoEm' => $j->criado_em ? Carbon::parse($j->criado_em)->toIso8601String() : null];
    }
}
