<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Regras;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Configuracao > Regras de importacao (routes/regras.ps1, v3.33.0):
 *   GET /regras (lista + catalogo + vaoImportado) | POST /regras | PUT /regras/{id} | DELETE /regras/{id}
 *   POST /regras/validar {formula} | POST /regras/simular {regra, amostra} | GET /regras/historico
 * Acesso: administrador; os demais so com a caixa "Regras de importacao" marcada na matriz.
 */
class RegrasController extends Controller
{
    private function negar(Request $r): ?JsonResponse
    {
        return $r->user()->pode('regras', 'visualizar') ? null : response()->json(['erro' => 'Sem permissão para as Regras de importação.'], 403);
    }

    private static function corpo(Request $r): array
    {
        $c = json_decode($r->getContent(), true);   // cru: "" das condicoes/acoes chega intacto

        return is_array($c) ? $c : [];
    }

    public function index(Request $r): JsonResponse
    {
        return $this->negar($r) ?? response()->json(['regras' => Regras::todas(), 'campos' => Regras::CAMPOS, 'funcoes' => Regras::FUNCOES,
            'vaoImportado' => DB::table('vao_postes')->exists()]);
    }

    public function historico(Request $r): JsonResponse
    {
        if ($x = $this->negar($r)) {
            return $x;
        }

        return response()->json(DB::table('regras_historico')->orderByDesc('id')->limit(200)->get()->map(fn ($h) => [
            'em' => Carbon::parse($h->em)->setTimezone(config('app.timezone'))->format('Y-m-d\TH:i:s'), 'usuario' => $h->usuario, 'regraId' => $h->regra_id,
            'nome' => $h->nome, 'acao' => $h->acao, 'antes' => $h->antes ? json_decode($h->antes) : null, 'depois' => $h->depois ? json_decode($h->depois) : null,
        ])->values());
    }

    public function validar(Request $r): JsonResponse
    {
        return $this->negar($r) ?? response()->json(Regras::validarFormula((string) (self::corpo($r)['formula'] ?? '')));
    }

    public function simular(Request $r): JsonResponse
    {
        if ($x = $this->negar($r)) {
            return $x;
        }
        $c = self::corpo($r);
        $regra = Regras::normalizar((array) ($c['regra'] ?? []), 'simulacao');
        if ($erros = Regras::validar($regra)) {
            return response()->json(['erro' => implode(' ', $erros), 'erros' => $erros], 400);
        }
        $am = (array) ($c['amostra'] ?? []);
        $num = fn ($v) => is_numeric($t = str_replace(',', '.', (string) $v)) ? (float) $t : 0.0;
        $ctx = ['esquema' => (string) ($am['esquema'] ?? ''), 'tipoServico' => (string) ($am['tipoServico'] ?? '')];
        foreach (['previstoPoda', 'previstoLimpeza', 'previstoEstrutura', 'realizadoPoda', 'realizadoLimpeza', 'realizadoEstrutura', 'vaoKm', 'soPrevisto'] as $k) {
            $ctx[$k] = $num($am[$k] ?? null);
        }
        Regras::totais($ctx);
        $antes = $ctx;
        [$aplicadas, $ignoradas] = Regras::aplicarNoCtx([$regra], $ctx);

        return response()->json(['antes' => $antes, 'depois' => $ctx, 'aplicou' => (bool) $aplicadas, 'erro' => $ignoradas[0]['motivo'] ?? null]);
    }

    public function store(Request $r): JsonResponse
    {
        if ($x = $this->negar($r)) {
            return $x;
        }
        $todas = Regras::todas();
        $nova = Regras::normalizar(self::corpo($r), 'r'.substr(bin2hex(random_bytes(8)), 0, 10));
        if ($nova['ordem'] <= 0) {
            $nova['ordem'] = count($todas) + 1;
        }
        if ($erros = Regras::validar($nova)) {
            return response()->json(['erro' => implode(' ', $erros), 'erros' => $erros], 400);
        }
        $nova += ['atualizadoPor' => $r->user()->nome, 'atualizadoEm' => now()->format('Y-m-d\TH:i:s')];
        DB::transaction(function () use ($nova, $r) {
            DB::table('regras')->insert(['id' => $nova['id'], 'ordem' => $nova['ordem'], 'dados' => json_encode($nova, JSON_UNESCAPED_UNICODE)]);
            Regras::historico($nova['id'], $nova['nome'], 'criada', null, $nova, $r->user()->nome);
        });

        return response()->json($nova, 201);
    }

    public function update(Request $r, string $id): JsonResponse
    {
        if ($x = $this->negar($r)) {
            return $x;
        }
        Regras::todas();
        $ant = DB::table('regras')->where('id', $id)->value('dados');
        if (! $ant) {
            return response()->json(['erro' => 'Regra não encontrada.'], 404);
        }
        $ant = json_decode($ant, true);
        $nova = Regras::normalizar(self::corpo($r), $id);
        if ($erros = Regras::validar($nova)) {
            return response()->json(['erro' => implode(' ', $erros), 'erros' => $erros], 400);
        }
        $nova += ['atualizadoPor' => $r->user()->nome, 'atualizadoEm' => now()->format('Y-m-d\TH:i:s')];
        $acao = ! empty($ant['ativa']) !== $nova['ativa'] ? ($nova['ativa'] ? 'ativada' : 'desativada') : 'alterada';
        DB::transaction(function () use ($id, $nova, $ant, $acao, $r) {
            DB::table('regras')->where('id', $id)->update(['ordem' => $nova['ordem'], 'dados' => json_encode($nova, JSON_UNESCAPED_UNICODE)]);
            Regras::historico($id, $nova['nome'], $acao, $ant, $nova, $r->user()->nome);
        });

        return response()->json($nova);
    }

    public function destroy(Request $r, string $id): JsonResponse
    {
        if ($x = $this->negar($r)) {
            return $x;
        }
        Regras::todas();
        $ant = DB::table('regras')->where('id', $id)->value('dados');
        if (! $ant) {
            return response()->json(['erro' => 'Regra não encontrada.'], 404);
        }
        $ant = json_decode($ant, true);
        DB::transaction(function () use ($id, $ant, $r) {
            DB::table('regras')->where('id', $id)->delete();
            Regras::historico($id, (string) ($ant['nome'] ?? ''), 'apagada', $ant, null, $r->user()->nome);
        });

        return response()->json(['ok' => true]);
    }
}
