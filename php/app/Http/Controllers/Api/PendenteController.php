<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * TRANSICAO (strangler): modulos que o front le na abertura mas que AINDA NAO foram portados.
 * Devolvem vazio no formato esperado para a tela abrir (o front so tolera 403, nao 404).
 * Ao portar um modulo, tire a rota dele de PENDENTES e registre o controller de verdade.
 * Qualquer outra rota /api inexistente cai no fallback (routes/api.php): "ainda nao migrado".
 */
class PendenteController extends Controller
{
    public const PENDENTES = [
        'metas' => [],
        'justificativas' => [],
        'prefeituras' => [],
        'logistica/equipes' => [],
        'logistica/programacoes' => [],
        'logistica/os' => [],
        'logistica/vinculos' => ['vinculos' => [], 'estatisticas' => []],
    ];

    public function vazio(string $rota): JsonResponse
    {
        $v = self::PENDENTES[$rota];

        return response()->json($v === [] ? [] : array_map(fn ($x) => (object) $x, $v))
            ->header('X-Spark-Pendente', '1');
    }

    public function naoMigrado(): JsonResponse
    {
        return response()->json(['erro' => 'Esta função ainda não foi migrada para o sistema novo.'], 404)
            ->header('X-Spark-Pendente', '1');
    }
}
