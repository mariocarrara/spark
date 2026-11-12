<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RedeGeo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Camadas de rede do Mapa de Manutencao — contrato de routes/manutencao.ps1 + server.ps1:
 *   GET /manutencao/camadas                      -> {rede_mt_disponiveis:[{ctmt,nome}], reserva_legal_disponiveis, app_disponiveis, rede_bt_disponiveis, rede_at_disponiveis}
 *   GET /manutencao/camadas?ctmt=X (rl|app|bt|at) -> {"rede_mt": FeatureCollection | null}
 *   GET /manutencao/camadas?ctmt=__todos__        -> NDJSON {tipo:"alimentador",ctmt,features,arquivo,total,percentual} ... {tipo:"final"}
 *   GET /manutencao/km-rede-resumo               -> resumo de km (Visao Geral)
 */
class MapaRedeController extends Controller
{
    /** parametro da URL => [camada, chave da resposta] */
    private const ALVOS = ['ctmt' => ['mt', 'rede_mt'], 'rl' => ['rl', 'reserva_legal'], 'app' => ['app', 'app'], 'bt' => ['bt', 'rede_bt'], 'at' => ['at', 'rede_at']];

    public function camadas(Request $r): Response
    {
        if (! $r->user()->pode('manutencao', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para visualizar Manutenção.'], 403);
        }
        foreach (self::ALVOS as $param => [$camada, $chave]) {
            $valor = $r->query($param);
            if ($valor === null || $valor === '') {
                continue;
            }
            $valor = (string) $valor;

            return $valor === '__todos__' ? $this->todos($camada) : $this->um($camada, $chave, $valor);
        }
        $lista = fn ($c) => array_map(fn ($a) => ['ctmt' => $a['ctmt'], 'nome' => $a['nome']], RedeGeo::lista($c));

        return response()->json([
            'rede_mt_disponiveis' => $lista('mt'), 'reserva_legal_disponiveis' => $lista('rl'), 'app_disponiveis' => $lista('app'),
            'rede_bt_disponiveis' => $lista('bt'), 'rede_at_disponiveis' => $lista('at'),
        ]);
    }

    private function um(string $camada, string $chave, string $alimentador): Response
    {
        $fc = RedeGeo::featureCollectionJson($camada, $alimentador);

        return response('{"'.$chave.'":'.($fc ?? 'null').'}', 200, ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store']);
    }

    /** Todos os alimentadores da camada numa conexao so, uma linha por alimentador (como o Invoke-CamadaTodosStream). */
    private function todos(string $camada): Response
    {
        $alims = DB::table('rede_alimentadores')->where('camada', $camada)->orderBy('alimentador')->pluck('alimentador')->all();

        return response()->stream(function () use ($camada, $alims) {
            @set_time_limit(0);
            $total = count($alims);
            $trechos = 0;
            foreach ($alims as $i => $a) {
                $f = RedeGeo::featuresJson($camada, $a) ?? '[]';
                $n = $i + 1;
                $trechos += (int) DB::table('rede_alimentadores')->where('camada', $camada)->where('alimentador', $a)->value('trechos');
                echo '{"tipo":"alimentador","ctmt":'.json_encode($a).',"features":'.$f.',"arquivo":'.$n.',"total":'.$total
                    .',"percentual":'.round(100 * $n / max(1, $total), 1)."}\n";
                if (! app()->runningUnitTests()) {
                    @ob_flush();
                    flush();
                }
            }
            echo json_encode(['tipo' => 'final', 'totalAlimentadores' => $total, 'totalTrechos' => $trechos])."\n";
        }, 200, ['Content-Type' => 'application/x-ndjson; charset=utf-8', 'Cache-Control' => 'no-store', 'X-Accel-Buffering' => 'no']);
    }

    public function kmRedeResumo(Request $r): JsonResponse
    {
        if (! $r->user()->pode('manutencao', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para visualizar Manutenção.'], 403);
        }

        return response()->json(RedeGeo::resumoKm());
    }
}
