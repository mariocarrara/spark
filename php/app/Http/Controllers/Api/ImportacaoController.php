<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** /api/importacao/* — por enquanto so o log (os importadores vem depois). */
class ImportacaoController extends Controller
{
    public function log(): JsonResponse
    {
        $lista = DB::table('importacoes_log')->orderByDesc('data_hora')->limit(2000)->get()->map(fn ($l) => [
            'id' => $l->id, 'dataHora' => Carbon::parse($l->data_hora)->toIso8601String(), 'usuarioId' => $l->usuario_id,
            'base' => $l->base, 'arquivoOrigem' => $l->arquivo_origem,
            'registrosProcessados' => (int) $l->registros_processados, 'registrosComErro' => (int) $l->registros_com_erro,
        ]);

        return response()->json($lista->values());
    }
}
