<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppRl;
use App\Services\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * OS x APP / Reserva Legal — contrato de routes/apprl.ps1:
 *   GET  /apprl/indice      indice (so as OS dentro ou a ate 100 m de APP/RL)
 *   GET  /apprl/config      tolerancia + quando o indice foi gerado
 *   PUT  /apprl/config      {toleranciaM} 0 a 100 m (manutencao.editar)
 *   POST /apprl/recalcular  recalcula agora (manutencao.importar)
 */
class AppRlController extends Controller
{
    private function ver(Request $r): ?JsonResponse
    {
        return $r->user()->pode('manutencao', 'visualizar') ? null : response()->json(['erro' => 'Sem permissão para ver APP/RL.'], 403);
    }

    public function indice(Request $r): Response
    {
        if ($x = $this->ver($r)) {
            return $x;
        }

        return response(AppRl::indiceJson(), 200, ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store']);
    }

    public function config(Request $r): JsonResponse
    {
        return $this->ver($r) ?? response()->json(AppRl::config());
    }

    public function salvarConfig(Request $r): JsonResponse
    {
        if ($x = $this->ver($r)) {
            return $x;
        }
        $eu = $r->user();
        if (! $eu->pode('manutencao', 'editar')) {
            return response()->json(['erro' => 'Sem permissão para alterar a tolerância de APP/RL.'], 403);
        }
        $txt = str_replace(',', '.', trim((string) $r->input('toleranciaM', '')));
        if (! is_numeric($txt) || (float) $txt < 0 || (float) $txt > AppRl::MAX_M) {
            return response()->json(['erro' => 'A tolerância precisa ser um número entre 0 e '.AppRl::MAX_M.' metros.'], 400);
        }
        $antes = AppRl::config()['toleranciaM'];
        $tol = round((float) $txt, 1);
        $reg = ['toleranciaM' => $tol, 'atualizadoEm' => now()->toIso8601String(), 'atualizadoPor' => $eu->id];
        DB::table('configuracoes')->upsert([['chave' => 'app_rl', 'valor' => json_encode($reg), 'atualizado_em' => now(), 'atualizado_por' => $eu->id]], ['chave'], ['valor', 'atualizado_em', 'atualizado_por']);
        DB::table('importacoes_log')->insert(['id' => (string) Str::uuid(), 'data_hora' => now(), 'usuario_id' => $eu->id,
            'base' => "APP/RL — tolerância de {$antes} m para {$tol} m", 'arquivo_origem' => '', 'registros_processados' => 0, 'registros_com_erro' => 0]);
        Auditoria::registrar('editar', 'apprl', 'tolerancia', $eu->id, ['de' => $antes, 'para' => $tol], $r->ip());

        return response()->json(AppRl::config());
    }

    public function recalcular(Request $r): JsonResponse
    {
        if ($x = $this->ver($r)) {
            return $x;
        }
        if (! $r->user()->pode('manutencao', 'importar')) {
            return response()->json(['erro' => 'Sem permissão para recalcular APP/RL.'], 403);
        }
        $res = AppRl::recalcular();
        Auditoria::registrar('recalcular', 'apprl', null, $r->user()->id, $res, $r->ip());

        return $res['ok'] ? response()->json($res) : response()->json(['erro' => $res['aviso']], 500);
    }
}
