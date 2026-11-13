<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Rank de prioridade da programacao — contrato de routes/rank.ps1. Cada lista enviada fica guardada.
 *   GET    /rank          metadados de todas (mais recente primeiro)  (prioridade.visualizar)
 *   GET    /rank/atual    a mais recente + itens
 *   GET    /rank/{id}     uma lista + itens
 *   POST   /rank          guarda uma lista nova                       (prioridade.importar)
 *   DELETE /rank/{id}     apaga uma lista                             (prioridade.excluirStatus)
 */
class RankController extends Controller
{
    private static function iso($v): ?string
    {
        return $v ? Carbon::parse($v)->setTimezone(config('app.timezone'))->toIso8601String() : null;
    }

    private static function meta(object $l): array
    {
        return ['id' => $l->id, 'enviadoEm' => self::iso($l->enviado_em), 'enviadoPor' => $l->enviado_por, 'enviadoPorNome' => $l->enviado_por_nome,
            'arquivo' => (string) $l->arquivo, 'aba' => (string) $l->aba, 'referencia' => (string) $l->referencia, 'origem' => (string) $l->origem,
            'autorArquivo' => (string) $l->autor_arquivo, 'criadoArquivoEm' => (string) self::iso($l->criado_arquivo_em), 'modificadoArquivoEm' => (string) self::iso($l->modificado_arquivo_em),
            'hash' => (string) $l->hash, 'linhas' => (int) $l->linhas, 'comData' => (int) $l->com_data, 'rejeitadas' => (int) $l->rejeitadas];
    }

    private function ver(Request $r): ?JsonResponse
    {
        return $r->user()->pode('prioridade', 'visualizar') ? null : response()->json(['erro' => 'Sem permissão para ver o rank de prioridade.'], 403);
    }

    public function index(Request $r): JsonResponse
    {
        return $this->ver($r) ?? response()->json(DB::table('rank_listas')->orderByDesc('enviado_em')->orderByDesc('id')->get()->map(fn ($l) => self::meta($l))->values());
    }

    public function show(Request $r, string $id): JsonResponse
    {
        if ($x = $this->ver($r)) {
            return $x;
        }
        $q = DB::table('rank_listas');
        $l = $id === 'atual' ? $q->orderByDesc('enviado_em')->orderByDesc('id')->first() : $q->where('id', $id)->first();
        if (! $l) {
            return $id === 'atual' ? response()->json(['lista' => null, 'itens' => []]) : response()->json(['erro' => 'Lista não encontrada.'], 404);
        }
        $num = fn ($v) => $v === null ? null : (fmod((float) $v, 1.0) == 0.0 ? (int) $v : (float) $v);
        $itens = DB::table('rank_itens')->where('lista_id', $l->id)->orderBy('posicao')->get()->map(fn ($i) => [
            'e' => $i->elemento, 'r' => (int) $i->posicao, 'dec' => $num($i->dec), 'trecho' => (string) $i->trecho, 'alim' => (string) $i->alim, 'reg' => (string) $i->reg,
            'polo' => (string) $i->polo, 'conj' => (string) $i->conj, 'plano' => (string) $i->plano,
            'di' => $i->di ? substr((string) $i->di, 0, 10) : '', 'df' => $i->df ? substr((string) $i->df, 0, 10) : '']);

        return response()->json(['lista' => self::meta($l), 'itens' => $itens->values()]);
    }

    private static function txt($o, string $c, int $max): string
    {
        $v = is_array($o) ? ($o[$c] ?? null) : null;

        return mb_substr(trim(is_scalar($v) ? (string) $v : ''), 0, $max);
    }

    private static function data(string $t): ?string
    {
        return preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $t, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1]) ? "$m[1]-$m[2]-$m[3]" : null;
    }

    private static function momento(string $t): ?string
    {
        if ($t === '') {
            return null;
        }
        try {
            return Carbon::parse($t)->toIso8601String();
        } catch (\Throwable) {
            return null;
        }
    }

    public function store(Request $r): JsonResponse
    {
        $eu = $r->user();
        if (! $eu->pode('prioridade', 'importar')) {
            return response()->json(['erro' => 'Sem permissão para enviar listas de prioridade.'], 403);
        }
        $corpo = json_decode($r->getContent(), true) ?: [];
        $brutos = array_values((array) ($corpo['itens'] ?? []));
        if (! $brutos) {
            return response()->json(['erro' => 'A lista veio vazia.'], 400);
        }
        if (count($brutos) > 20000) {
            return response()->json(['erro' => 'Lista grande demais (máximo 20.000 linhas).'], 400);
        }
        $itens = [];
        $vistos = [];
        $motivos = [];
        $rejeitadas = 0;
        $comData = 0;
        foreach ($brutos as $n => $b) {
            $elem = self::txt($b, 'e', 60);
            $rkTxt = self::txt($b, 'r', 12);
            $rk = ctype_digit($rkTxt) ? (int) $rkTxt : 0;
            $motivo = $elem === '' ? 'elemento em branco' : ($rk < 1 ? "prioridade inválida ($rkTxt)" : (isset($vistos[mb_strtoupper($elem)]) ? "elemento repetido ($elem)" : null));
            if (! $motivo && isset($itens[$rk])) {
                $motivo = "prioridade repetida ($rk)";
            }
            if ($motivo) {
                $rejeitadas++;
                count($motivos) < 20 && $motivos[] = 'linha '.($n + 1).": $motivo";

                continue;
            }
            $vistos[mb_strtoupper($elem)] = true;
            $decTxt = self::txt($b, 'dec', 40);
            $di = self::data(self::txt($b, 'di', 20));
            $di && $comData++;
            $itens[$rk] = ['posicao' => $rk, 'elemento' => $elem, 'dec' => is_numeric($decTxt) ? json_encode((float) $decTxt) : null, 'trecho' => self::txt($b, 'trecho', 20),
                'alim' => self::txt($b, 'alim', 60), 'reg' => self::txt($b, 'reg', 40), 'polo' => self::txt($b, 'polo', 60), 'conj' => self::txt($b, 'conj', 80),
                'plano' => self::txt($b, 'plano', 60), 'di' => $di, 'df' => self::data(self::txt($b, 'df', 20))];
        }
        if (! $itens) {
            return response()->json(['erro' => 'Nenhuma linha válida na lista.', 'motivos' => $motivos], 400);
        }
        ksort($itens);
        $id = 'L'.now()->format('YmdHis').substr(now()->format('u'), 0, 3);
        $meta = ['id' => $id, 'enviado_em' => now(), 'enviado_por' => $eu->id, 'enviado_por_nome' => $eu->nome, 'arquivo' => self::txt($corpo, 'arquivo', 200),
            'aba' => self::txt($corpo, 'aba', 80), 'referencia' => self::txt($corpo, 'referencia', 120), 'origem' => self::txt($corpo, 'origem', 300),
            'autor_arquivo' => self::txt($corpo, 'autor', 120), 'criado_arquivo_em' => self::momento(self::txt($corpo, 'criadoArquivoEm', 40)),
            'modificado_arquivo_em' => self::momento(self::txt($corpo, 'modificadoArquivoEm', 40)), 'hash' => self::txt($corpo, 'hash', 80),
            'linhas' => count($itens), 'com_data' => $comData, 'rejeitadas' => $rejeitadas];
        DB::transaction(function () use ($meta, $itens, $id) {
            DB::table('rank_listas')->insert($meta);
            foreach (array_chunk(array_values($itens), 1000) as $lote) {
                DB::table('rank_itens')->insert(array_map(fn ($i) => $i + ['lista_id' => $id], $lote));
            }
        });
        Auditoria::registrar('enviar', 'rank', $id, $eu->id, ['arquivo' => $meta['arquivo'], 'aba' => $meta['aba'], 'linhas' => $meta['linhas'], 'rejeitadas' => $rejeitadas], $r->ip());

        return response()->json(['ok' => true, 'lista' => self::meta(DB::table('rank_listas')->where('id', $id)->first()), 'recebidas' => count($brutos),
            'validas' => count($itens), 'rejeitadas' => $rejeitadas, 'motivos' => $motivos]);
    }

    public function destroy(Request $r, string $id): JsonResponse
    {
        if (! $r->user()->pode('prioridade', 'excluirStatus')) {
            return response()->json(['erro' => 'Sem permissão para apagar listas de prioridade.'], 403);
        }
        if (! preg_match('/^L\d{10,20}$/', $id)) {
            return response()->json(['erro' => 'Identificador de lista inválido.'], 400);
        }
        $alvo = DB::table('rank_listas')->where('id', $id)->first();
        if (! $alvo) {
            return response()->json(['erro' => 'Lista não encontrada.'], 404);
        }
        DB::table('rank_listas')->where('id', $id)->delete();   // itens caem junto (FK)
        Auditoria::registrar('apagar', 'rank', $id, $r->user()->id, ['arquivo' => $alvo->arquivo, 'linhas' => $alvo->linhas], $r->ip());

        return response()->json(['ok' => true, 'id' => $id]);
    }
}
