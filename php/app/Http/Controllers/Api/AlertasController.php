<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Alertas do mapa (os calculos sao no navegador) — contrato de routes/alertas.ps1:
 *   GET/PUT/DELETE /alertas/config     parametros (configuracoes.alertas)
 *   GET /alertas/tratados              [{tipo, chave, status, por, em}]
 *   PUT /alertas/tratados              {tipo, chave, status} (status vazio = desmarca)
 */
class AlertasController extends Controller
{
    private const TIPOS = ['proximas', 'outliers', 'zero'];

    private const STATUS = ['Em análise', 'Resolvido', 'Falso positivo'];

    private function pode(Request $r, string $acao, string $msg): ?JsonResponse
    {
        return $r->user()->pode('manutencao', $acao) ? null : response()->json(['erro' => $msg], 403);
    }

    public function config(Request $r): JsonResponse
    {
        if ($x = $this->pode($r, 'visualizar', 'Sem permissão para ver os alertas.')) {
            return $x;
        }
        $c = DB::table('configuracoes')->where('chave', 'alertas')->first();
        if (! $c) {
            return response()->json(['valores' => null]);
        }

        return response()->json(['valores' => json_decode($c->valor), 'atualizadoEm' => Carbon::parse($c->atualizado_em)->setTimezone(config('app.timezone'))->toIso8601String(),
            'atualizadoPor' => $c->atualizado_por]);
    }

    public function salvarConfig(Request $r): JsonResponse
    {
        if ($x = $this->pode($r, 'editar', 'Sem permissão para alterar os parâmetros dos alertas.')) {
            return $x;
        }
        $valores = json_decode($r->getContent(), true);   // corpo cru: os parametros vao intactos
        if (! is_array($valores)) {
            return response()->json(['erro' => 'Parâmetros inválidos.'], 400);
        }
        $agora = now();
        DB::table('configuracoes')->upsert([['chave' => 'alertas', 'valor' => json_encode($valores, JSON_UNESCAPED_UNICODE), 'atualizado_em' => $agora,
            'atualizado_por' => $r->user()->nome]], ['chave'], ['valor', 'atualizado_em', 'atualizado_por']);

        return response()->json(['valores' => $valores, 'atualizadoEm' => $agora->toIso8601String(), 'atualizadoPor' => $r->user()->nome]);
    }

    public function apagarConfig(Request $r): JsonResponse
    {
        if ($x = $this->pode($r, 'editar', 'Sem permissão para alterar os parâmetros dos alertas.')) {
            return $x;
        }
        DB::table('configuracoes')->where('chave', 'alertas')->delete();

        return response()->json(['valores' => null]);
    }

    public function tratados(Request $r): JsonResponse
    {
        if ($x = $this->pode($r, 'visualizar', 'Sem permissão para ver os alertas.')) {
            return $x;
        }
        $nomes = DB::table('usuarios')->pluck('nome', 'id');

        return response()->json(DB::table('alertas_tratados')->orderBy('atualizado_em')->get()->map(fn ($a) => [
            'tipo' => $a->tipo, 'chave' => $a->chave, 'status' => $a->status, 'por' => $nomes[$a->usuario_id] ?? $a->usuario_id,
            'em' => Carbon::parse($a->atualizado_em)->setTimezone(config('app.timezone'))->toIso8601String(),
        ])->values());
    }

    public function tratar(Request $r): JsonResponse
    {
        if ($x = $this->pode($r, 'editar', 'Sem permissão para tratar alertas.')) {
            return $x;
        }
        $tipo = (string) $r->input('tipo', '');
        $chave = trim((string) $r->input('chave', ''));
        $status = (string) $r->input('status', '');
        if (! in_array($tipo, self::TIPOS, true) || $chave === '' || mb_strlen($chave) > 300) {
            return response()->json(['erro' => 'Alerta inválido.'], 400);
        }
        if ($status !== '' && ! in_array($status, self::STATUS, true)) {
            return response()->json(['erro' => 'Status inválido.'], 400);
        }
        if ($status === '') {
            DB::table('alertas_tratados')->where('tipo', $tipo)->where('chave', $chave)->delete();
        } else {
            DB::table('alertas_tratados')->upsert([['tipo' => $tipo, 'chave' => $chave, 'status' => $status, 'usuario_id' => $r->user()->id, 'atualizado_em' => now()]],
                ['tipo', 'chave'], ['status', 'usuario_id', 'atualizado_em']);
        }

        return response()->json(['tipo' => $tipo, 'chave' => $chave, 'status' => $status]);
    }
}
