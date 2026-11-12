<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * /api/ajustes — "Ajuste de OS" (routes/ajustes.ps1). O ajuste e SOBERANO: tipo de equipe, equipe executora,
 * alimentador e protecao informados a mao valem mais que o SGM/SIGOD e sobrevivem a novas cargas.
 * Quem aplica por cima da OS e o navegador (aplicarAjusteOS). Campo em branco = vale o original.
 * O numero da OS tem barra e espacos ("AUDTUP1  000304/2026"): a rota aceita "/" no {osId}.
 */
class AjusteController extends Controller
{
    private const CAMPOS = ['tipoEquipe' => 'tipo_equipe', 'equipeId' => 'equipe_id', 'alimentador' => 'alimentador', 'protecaoId' => 'protecao_id'];

    public function index(Request $r): JsonResponse
    {
        if (! $r->user()->pode('manutencao', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para ver os ajustes de OS.'], 403);
        }

        return response()->json(DB::table('ajustes_os')->orderBy('os_id')->get()->map(fn ($a) => self::paraFront($a))->values());
    }

    public function salvar(Request $r, string $osId): JsonResponse
    {
        if ($x = $this->negar($r)) {
            return $x;
        }
        $osId = mb_strtoupper(trim($osId));
        if ($osId === '' || mb_strlen($osId) > 80) {
            return response()->json(['erro' => 'Informe a OS.'], 400);
        }
        $novo = [];
        foreach (self::CAMPOS as $campo => $col) {
            $novo[$campo] = mb_substr(trim((string) $r->input($campo, '')), 0, 120);
        }
        if (! array_filter($novo)) {
            return response()->json(['erro' => 'Preencha pelo menos um campo para ajustar (ou use Remover).'], 400);
        }
        $eu = $r->user()->id;
        $atual = DB::table('ajustes_os')->whereRaw('upper(os_id) = ?', [$osId])->first();
        $linha = ['os_id' => $osId, 'atualizado_por' => $eu, 'atualizado_em' => now(),
            'criado_por' => $atual->criado_por ?? $eu, 'criado_em' => $atual->criado_em ?? now()];
        foreach (self::CAMPOS as $campo => $col) {
            $linha[$col] = $novo[$campo] !== '' ? $novo[$campo] : null;
        }
        DB::transaction(function () use ($atual, $linha, $osId, $eu, $novo) {
            if ($atual) {
                DB::table('ajustes_os')->where('os_id', $atual->os_id)->delete();
            }
            DB::table('ajustes_os')->insert($linha);
            DB::table('ajustes_os_log')->insert(['momento' => now(), 'usuario_id' => $eu, 'os_id' => $osId, 'acao' => $atual ? 'alterar' : 'criar',
                'de' => $atual ? json_encode(self::campos($atual), JSON_UNESCAPED_UNICODE) : null, 'para' => json_encode($novo, JSON_UNESCAPED_UNICODE)]);
        });

        return response()->json(self::paraFront((object) $linha));
    }

    public function remover(Request $r, string $osId): JsonResponse
    {
        if ($x = $this->negar($r)) {
            return $x;
        }
        $osId = mb_strtoupper(trim($osId));
        $atual = DB::table('ajustes_os')->whereRaw('upper(os_id) = ?', [$osId])->first();
        if (! $atual) {
            return response()->json(['erro' => 'Essa OS não tem ajuste.'], 404);
        }
        DB::transaction(function () use ($atual, $osId, $r) {
            DB::table('ajustes_os')->where('os_id', $atual->os_id)->delete();
            DB::table('ajustes_os_log')->insert(['momento' => now(), 'usuario_id' => $r->user()->id, 'os_id' => $osId, 'acao' => 'remover',
                'de' => json_encode(self::campos($atual), JSON_UNESCAPED_UNICODE), 'para' => null]);
        });

        return response()->json(['ok' => true, 'id' => $osId]);
    }

    private function negar(Request $r): ?JsonResponse
    {
        return $r->user()->pode('manutencao', 'editar') ? null
            : response()->json(['erro' => 'Sem permissão para ajustar OS (precisa poder editar a Manutenção).'], 403);
    }

    private static function campos(object $a): array
    {
        $h = [];
        foreach (self::CAMPOS as $campo => $col) {
            $h[$campo] = (string) ($a->$col ?? '');
        }

        return $h;
    }

    public static function paraFront(object $a): array
    {
        $iso = fn ($v) => $v ? Carbon::parse($v)->setTimezone(config('app.timezone'))->toIso8601String() : null;

        return ['id' => $a->os_id] + self::campos($a) + ['criadoPor' => $a->criado_por, 'criadoEm' => $iso($a->criado_em),
            'atualizadoPor' => $a->atualizado_por, 'atualizadoEm' => $iso($a->atualizado_em)];
    }
}
