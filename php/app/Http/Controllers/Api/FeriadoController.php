<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** /api/feriados — contrato do legado (routes/feriados.ps1). Usado no calculo de dias uteis. */
class FeriadoController extends Controller
{
    public function index(): JsonResponse
    {
        $lista = DB::table('feriados')->orderBy('data')->get()
            ->map(fn ($f) => ['data' => substr((string) $f->data, 0, 10), 'descricao' => $f->descricao, 'abrangencia' => $f->abrangencia]);

        return response()->json($lista->values());
    }

    /** Grava ou atualiza (a data e a chave; o legado deixava duplicar). */
    public function store(Request $request): JsonResponse
    {
        $eu = $request->user();
        if (! $eu->pode('usuarios', 'editar')) { // mesma regra do legado
            return response()->json(['erro' => 'Sem permissão para cadastrar feriados.'], 403);
        }
        $data = trim((string) $request->input('data', ''));
        $descricao = trim((string) $request->input('descricao', ''));
        $abr = trim((string) $request->input('abrangencia', '')) ?: 'Nacional';
        if (! self::dataValida($data)) {
            return response()->json(['erro' => 'Informe a data no formato AAAA-MM-DD.'], 400);
        }
        if ($descricao === '') {
            return response()->json(['erro' => 'Informe a descrição do feriado.'], 400);
        }
        $novo = ['data' => $data, 'descricao' => mb_substr($descricao, 0, 200), 'abrangencia' => mb_substr($abr, 0, 60)];
        DB::table('feriados')->upsert([$novo], ['data'], ['descricao', 'abrangencia']);
        Auditoria::registrar('criar', 'feriados', $data, $eu->id, $novo, $request->ip());

        return response()->json($novo, 201);
    }

    public static function dataValida(string $d): bool
    {
        if (! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m)) {
            return false;
        }

        return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
    }
}
