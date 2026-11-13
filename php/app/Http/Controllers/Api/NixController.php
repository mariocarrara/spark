<?php

namespace App\Http\Controllers\Api;

use App\Services\Auditoria;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Pontos NIX (onde a rede parou) — contrato de routes/nix.ps1:
 *   GET    /nix                    {meta, itens}                         (nix.visualizar)
 *   POST   /nix {itens,arquivo,aba} substitui a base (os manuais ficam)  (nix.importar)
 *   POST   /nix {incluir:{...}}    inclui 1 ponto manual                 (nix.criar)
 *   PUT    /nix {raioM}            raio do alerta, 10 a 5000 m           (nix.importar)
 *   DELETE /nix?id=                apaga 1 ponto manual                  (nix.excluirStatus)
 *   DELETE /nix                    apaga a base                          (nix.importar)
 * Meta em configuracoes.nix_meta; o log do legado (nix_log.jsonl) virou auditoria.
 */
class NixController extends Controller
{
    private function negar(Request $r, string $acao, string $msg): ?JsonResponse
    {
        return $r->user()->pode('nix', $acao) ? null : response()->json(['erro' => $msg], 403);
    }

    private static function meta(): ?array
    {
        $v = DB::table('configuracoes')->where('chave', 'nix_meta')->value('valor');

        return $v === null ? null : json_decode($v, true);
    }

    private static function gravarMeta(?array $m, string $quem): void
    {
        if ($m === null) {
            DB::table('configuracoes')->where('chave', 'nix_meta')->delete();

            return;
        }
        DB::table('configuracoes')->upsert([['chave' => 'nix_meta', 'valor' => json_encode($m, JSON_UNESCAPED_UNICODE), 'atualizado_em' => now(), 'atualizado_por' => $quem]],
            ['chave'], ['valor', 'atualizado_em', 'atualizado_por']);
    }

    /** "lat,lng" (ou lat e lng) -> [lat, lng]; qualquer outra coisa ("-", "BI", vazio) -> null */
    private static function ponto(string $t): ?array
    {
        if (! preg_match('/^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/', $t, $m)) {
            return null;
        }
        $la = (float) str_replace(',', '.', $m[1]);
        $lo = (float) str_replace(',', '.', $m[2]);

        return abs($la) <= 90 && abs($lo) <= 180 && ! ($la == 0.0 && $lo == 0.0) ? [$la, $lo] : null;
    }

    private static function txt($o, string $c, int $max): string
    {
        $v = is_array($o) ? ($o[$c] ?? null) : null;

        return mb_substr(trim(is_scalar($v) ? (string) $v : ''), 0, $max);
    }

    public function index(Request $r): JsonResponse
    {
        if ($x = $this->negar($r, 'visualizar', 'Sem permissão para ver os pontos Nix.')) {
            return $x;
        }
        $pontos = [];
        foreach (DB::table('nix_pontos')->orderBy('nix_id')->orderBy('ordem')->get(['nix_id', DB::raw('ST_Y(loc) AS lat'), DB::raw('ST_X(loc) AS lng')]) as $p) {
            $pontos[$p->nix_id][] = ['lat' => (float) $p->lat, 'lng' => (float) $p->lng];
        }
        $itens = DB::table('nix')->orderByRaw('manual, id')->get()->map(function ($n) use ($pontos) {
            $i = ['e' => $n->elemento, 'ranque' => (string) $n->ranque, 'trecho' => (string) $n->trecho, 'alim' => (string) $n->alim, 'reg' => (string) $n->reg,
                'conj' => (string) $n->conj, 'tensao' => (string) $n->tensao, 'dh' => (string) $n->dh, 'ppf' => (string) $n->ppf, 'pontos' => $pontos[$n->id] ?? []];
            if ($n->manual) {
                $i = ['id' => $n->id, 'manual' => true] + $i + ['criadoEm' => $n->criado_em ? Carbon::parse($n->criado_em)->setTimezone(config('app.timezone'))->toIso8601String() : null,
                    'criadoPor' => $n->criado_por];
            }

            return $i;
        });

        return response()->json(['meta' => self::meta(), 'itens' => $itens->values()]);
    }

    private static function inserir(array $itens): void
    {
        foreach (array_chunk($itens, 500) as $lote) {
            DB::table('nix')->insert(array_map(fn ($i) => array_diff_key($i, ['pontos' => 1]), $lote));
            $pts = [];
            foreach ($lote as $i) {
                foreach ($i['pontos'] as $k => [$la, $lo]) {
                    $pts[] = [$i['id'], $k, json_encode($lo), json_encode($la)];   // texto exato do double
                }
            }
            foreach (array_chunk($pts, 500) as $bloco) {
                DB::insert('INSERT INTO nix_pontos (nix_id, ordem, loc) VALUES '.implode(',', array_fill(0, count($bloco), '(?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326))')),
                    array_merge(...$bloco));
            }
        }
    }

    private static function recontar(string $quem): ?array
    {
        $m = self::meta();
        if ($m !== null) {
            $m['linhas'] = DB::table('nix')->count();
            $m['pontos'] = DB::table('nix_pontos')->count();
            self::gravarMeta($m, $quem);
        }

        return $m;
    }

    public function store(Request $r): JsonResponse
    {
        $eu = $r->user();
        $corpo = json_decode($r->getContent(), true) ?: [];
        if (isset($corpo['incluir'])) {
            if ($x = $this->negar($r, 'criar', 'Sem permissão para incluir ponto Nix.')) {
                return $x;
            }
            $b = (array) $corpo['incluir'];
            $elem = self::txt($b, 'e', 60);
            if ($elem === '') {
                return response()->json(['erro' => 'Informe o elemento (proteção/equipamento).'], 400);
            }
            $lat = self::txt($b, 'lat', 30);
            $lng = self::txt($b, 'lng', 30);
            $p = self::ponto($lng !== '' ? "$lat,$lng" : $lat);
            if (! $p) {
                return response()->json(['erro' => 'Coordenada inválida. Use latitude e longitude em graus decimais (ex.: -21.9445973 e -50.6890000).'], 400);
            }
            $novo = ['id' => 'nx-'.Str::uuid(), 'manual' => true, 'elemento' => $elem, 'ranque' => '', 'trecho' => self::txt($b, 'trecho', 20), 'alim' => self::txt($b, 'alim', 60),
                'reg' => self::txt($b, 'reg', 40), 'conj' => self::txt($b, 'conj', 80), 'tensao' => '', 'dh' => self::txt($b, 'dh', 40), 'ppf' => self::txt($b, 'ppf', 600),
                'criado_por' => $eu->nome, 'criado_em' => now(), 'pontos' => [$p]];
            DB::transaction(function () use ($novo, $eu) {
                self::inserir([$novo]);
                if (self::meta() === null) {
                    self::gravarMeta(['raioM' => 500, 'enviadoEm' => now()->toIso8601String(), 'enviadoPorNome' => $eu->nome, 'arquivo' => '(inclusão manual)', 'aba' => '', 'rejeitadas' => 0], $eu->id);
                }
                self::recontar($eu->id);
            });
            Auditoria::registrar('incluir', 'nix', $novo['id'], $eu->id, ['e' => $elem, 'lat' => $p[0], 'lng' => $p[1]], $r->ip());
            $item = ['id' => $novo['id'], 'manual' => true, 'e' => $elem, 'ranque' => '', 'trecho' => $novo['trecho'], 'alim' => $novo['alim'], 'reg' => $novo['reg'],
                'conj' => $novo['conj'], 'tensao' => '', 'dh' => $novo['dh'], 'ppf' => $novo['ppf'], 'pontos' => [['lat' => $p[0], 'lng' => $p[1]]],
                'criadoEm' => now()->toIso8601String(), 'criadoPor' => $eu->nome];

            return response()->json(['ok' => true, 'item' => $item]);
        }

        if ($x = $this->negar($r, 'importar', 'Sem permissão para enviar a base de pontos Nix.')) {
            return $x;
        }
        $brutos = array_values((array) ($corpo['itens'] ?? []));
        if (! $brutos) {
            return response()->json(['erro' => 'A planilha veio vazia.'], 400);
        }
        if (count($brutos) > 20000) {
            return response()->json(['erro' => 'Planilha grande demais (máximo 20.000 linhas).'], 400);
        }
        $itens = [];
        $motivos = [];
        $rejeitadas = 0;
        $semCoord = 0;
        foreach ($brutos as $n => $b) {
            $elem = self::txt($b, 'e', 60);
            $p1 = self::ponto(self::txt($b, 'll1', 60));
            $p2 = self::ponto(self::txt($b, 'll2', 60));
            $motivo = $elem === '' ? 'elemento em branco' : (! $p1 && ! $p2 ? "sem coordenada válida ($elem)" : null);
            if ($motivo) {
                $rejeitadas++;
                $elem !== '' && $semCoord++;
                count($motivos) < 20 && $motivos[] = 'linha '.($n + 1).": $motivo";

                continue;
            }
            $itens[] = ['id' => 'nx-'.Str::uuid(), 'manual' => false, 'elemento' => $elem, 'ranque' => self::txt($b, 'rk', 12), 'trecho' => self::txt($b, 'trecho', 20),
                'alim' => self::txt($b, 'alim', 60), 'reg' => self::txt($b, 'reg', 40), 'conj' => self::txt($b, 'conj', 80), 'tensao' => self::txt($b, 'tensao', 12),
                'dh' => self::txt($b, 'dh', 40), 'ppf' => self::txt($b, 'ppf', 600), 'criado_por' => null, 'criado_em' => now(), 'pontos' => array_values(array_filter([$p1, $p2]))];
        }
        if (! $itens) {
            return response()->json(['erro' => 'Nenhuma linha com coordenada válida na planilha. A base anterior foi mantida.', 'motivos' => $motivos, 'rejeitadas' => $rejeitadas], 400);
        }
        $ant = self::meta();
        $meta = ['raioM' => isset($ant['raioM']) && (int) $ant['raioM'] >= 10 ? (int) $ant['raioM'] : 500, 'enviadoEm' => now()->toIso8601String(), 'enviadoPor' => $eu->id,
            'enviadoPorNome' => $eu->nome, 'arquivo' => self::txt($corpo, 'arquivo', 200), 'aba' => self::txt($corpo, 'aba', 80), 'linhas' => 0, 'pontos' => 0, 'rejeitadas' => $rejeitadas];
        DB::transaction(function () use ($itens, $meta, $eu) {
            DB::table('nix')->where('manual', false)->delete();   // os incluidos a mao sobrevivem a planilha nova
            self::inserir($itens);
            self::gravarMeta($meta, $eu->id);
        });
        $meta = self::recontar($eu->id);
        Auditoria::registrar('enviar', 'nix', null, $eu->id, ['arquivo' => $meta['arquivo'], 'linhas' => $meta['linhas'], 'rejeitadas' => $rejeitadas], $r->ip());

        return response()->json(['ok' => true, 'meta' => $meta, 'recebidas' => count($brutos), 'validas' => count($itens), 'rejeitadas' => $rejeitadas,
            'semCoordenada' => $semCoord, 'motivos' => $motivos]);
    }

    public function raio(Request $r): JsonResponse
    {
        if ($x = $this->negar($r, 'importar', 'Sem permissão para alterar o raio do Nix.')) {
            return $x;
        }
        $v = (int) $r->input('raioM');
        if ($v < 10 || $v > 5000) {
            return response()->json(['erro' => 'Raio inválido (use de 10 a 5000 metros).'], 400);
        }
        self::gravarMeta(['raioM' => $v] + (self::meta() ?? []), $r->user()->id);
        Auditoria::registrar('raio', 'nix', null, $r->user()->id, ['raioM' => $v], $r->ip());

        return response()->json(['ok' => true, 'raioM' => $v]);
    }

    public function destroy(Request $r): JsonResponse
    {
        $id = (string) $r->query('id', '');
        if ($id !== '') {
            if ($x = $this->negar($r, 'excluirStatus', 'Sem permissão para apagar ponto Nix.')) {
                return $x;
            }
            $alvo = DB::table('nix')->where('id', $id)->where('manual', true)->first();
            if (! $alvo) {
                return response()->json(['erro' => 'Ponto manual não encontrado (só os incluídos à mão podem ser apagados aqui).'], 404);
            }
            DB::table('nix')->where('id', $id)->delete();
            self::recontar($r->user()->id);
            Auditoria::registrar('apagar-manual', 'nix', $id, $r->user()->id, ['e' => $alvo->elemento], $r->ip());

            return response()->json(['ok' => true]);
        }
        if ($x = $this->negar($r, 'importar', 'Sem permissão para apagar a base de pontos Nix.')) {
            return $x;
        }
        DB::transaction(function () use ($r) {
            DB::table('nix')->delete();
            self::gravarMeta(null, $r->user()->id);
        });
        Auditoria::registrar('apagar', 'nix', null, $r->user()->id, [], $r->ip());

        return response()->json(['ok' => true]);
    }
}
