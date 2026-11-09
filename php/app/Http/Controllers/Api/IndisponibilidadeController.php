<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** /api/indisponibilidades — contrato de routes/indisponibilidades.ps1 (exclusao logica). */
class IndisponibilidadeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $eu = $request->user();
        if (! ($eu->pode('produtividade', 'visualizar') || $eu->pode('programacao', 'visualizar') || $eu->pode('manutencao', 'visualizar'))) {
            return response()->json(['erro' => 'Sem permissão para ver Indisponibilidades.'], 403);
        }
        $lista = DB::table('indisponibilidades')->where('excluido', false)->orderBy('data_inicio')->get()->map(fn ($i) => self::paraFront($i));

        return response()->json($lista->values());
    }

    public function store(Request $request): JsonResponse
    {
        $eu = $request->user();
        if (! $eu->pode('produtividade', 'criar')) {
            return response()->json(['erro' => 'Sem permissão para registrar Indisponibilidades.'], 403);
        }
        $equipe = trim((string) $request->input('equipeId', ''));
        $ini = trim((string) $request->input('dataInicio', ''));
        $fim = trim((string) $request->input('dataFim', ''));
        $tipo = trim((string) $request->input('tipo', ''));
        if ($equipe === '') {
            return response()->json(['erro' => 'Informe a equipe.'], 400);
        }
        if (! FeriadoController::dataValida($ini) || ! FeriadoController::dataValida($fim)) {
            return response()->json(['erro' => 'Informe as datas no formato AAAA-MM-DD.'], 400);
        }
        if ($fim < $ini) {
            return response()->json(['erro' => 'A data final não pode ser antes da inicial.'], 400);
        }
        if ($tipo === '') {
            return response()->json(['erro' => 'Informe o motivo (tipo).'], 400);
        }
        $novo = ['id' => (string) Str::uuid(), 'equipe_id' => mb_substr($equipe, 0, 60), 'data_inicio' => $ini, 'data_fim' => $fim,
            'tipo' => mb_substr($tipo, 0, 200), 'texto' => mb_substr(trim((string) $request->input('texto', '')), 0, 2000),
            'autor_id' => $eu->id, 'criado_em' => now(), 'excluido' => false];
        DB::table('indisponibilidades')->insert($novo);
        Auditoria::registrar('criar', 'indisponibilidades', $novo['id'], $eu->id, ['equipe' => $equipe, 'de' => $ini, 'ate' => $fim, 'tipo' => $tipo], $request->ip());

        return response()->json(self::paraFront((object) $novo), 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $eu = $request->user();
        if (! $eu->pode('gestaoBases', 'excluirStatus')) {
            return response()->json(['erro' => 'Sem permissão para excluir Indisponibilidades.'], 403);
        }
        $n = DB::table('indisponibilidades')->where('id', $id)->where('excluido', false)
            ->update(['excluido' => true, 'excluido_por' => $eu->id, 'excluido_em' => now()]);
        if (! $n) {
            return response()->json(['erro' => 'Indisponibilidade não encontrada.'], 404);
        }
        Auditoria::registrar('excluir', 'indisponibilidades', $id, $eu->id, [], $request->ip());

        return response()->json(['ok' => true, 'id' => $id]);
    }

    private static function paraFront(object $i): array
    {
        return ['id' => $i->id, 'equipeId' => $i->equipe_id, 'dataInicio' => substr((string) $i->data_inicio, 0, 10), 'dataFim' => substr((string) $i->data_fim, 0, 10),
            'tipo' => $i->tipo, 'texto' => $i->texto, 'autorId' => $i->autor_id,
            'criadoEm' => $i->criado_em ? \Illuminate\Support\Carbon::parse($i->criado_em)->toIso8601String() : null];
    }
}
