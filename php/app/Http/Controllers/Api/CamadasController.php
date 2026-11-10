<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Camadas do Mapa de Manutencao que vem do banco: VERA (arvores), postes (PONNOT) e equipamentos da BDGD.
 * Contratos de routes/manutencao.ps1 (vera-mapa), routes/postes.ps1 e routes/equip.ps1 + lib/Equip.ps1.
 * O legado percorria os 760 mil postes a cada pedido; aqui e o indice espacial (GIST) do PostGIS.
 */
class CamadasController extends Controller
{
    /** Rotulos e coluna "tipo" (dentro de v0..v4) de cada camada (SparkEquip.IdxTipo). */
    private const EQUIP = [
        'trafos' => ['rotulo' => 'Trafos', 'tipo' => 'v1'],
        'protecoes' => ['rotulo' => 'Proteções', 'tipo' => 'v0'],
        'reguladores' => ['rotulo' => 'Reguladores', 'tipo' => 'v0'],
        'capacitores' => ['rotulo' => 'Capacitores', 'tipo' => 'v3'],
    ];

    /**
     * Fusivel (tipo 22) no MESMO poste de um trafo e o fusivel do proprio trafo: nao aparece no mapa
     * nem no popup (regra FusivelDeTrafo do legado). Vale so para a camada protecoes.
     */
    private const SEM_FUSIVEL_DE_TRAFO = "NOT (e.camada = 'protecoes' AND e.v0 = '22' AND coalesce(e.poste, '') <> ''
        AND EXISTS (SELECT 1 FROM equipamentos t WHERE t.camada = 'trafos' AND t.poste = e.poste))";

    private function ver(Request $r, string $msg = 'Sem permissão para ver os equipamentos.'): ?JsonResponse
    {
        return $r->user()->pode('manutencao', 'visualizar') ? null : response()->json(['erro' => $msg], 403);
    }

    // ------------------------------------------------------------------ VERA

    /**
     * GET /api/manutencao/vera-mapa — NDJSON: {"tipo":"lote","pontos":[[lat,lng,idVera,especie]...],"enviadas","total"} ... {"tipo":"final"}.
     * Montado uma vez e guardado compactado (como a lista de OS).
     */
    public function veraMapa(Request $r): Response
    {
        if ($x = $this->ver($r, 'Sem permissão para visualizar Manutenção.')) {
            return $x;
        }
        $v = DB::selectOne("SELECT count(*) AS n, coalesce(min(id_vera), '') AS a, coalesce(max(id_vera), '') AS b FROM vera WHERE loc IS NOT NULL");
        $dir = storage_path('app'.DIRECTORY_SEPARATOR.'cache');
        $arq = $dir.DIRECTORY_SEPARATOR.'vera_'.md5($v->n.'|'.$v->a.'|'.$v->b).'.ndjson.gz';
        if (! is_file($arq)) {
            if (! is_dir($dir)) {
                mkdir($dir, 0775, true);
            }
            $tmp = $arq.'.'.bin2hex(random_bytes(4)).'.tmp';
            $gz = gzopen($tmp, 'wb6');
            $total = (int) $v->n;
            $enviadas = 0;
            $ultimo = null;
            do {
                $lote = DB::select('SELECT id_vera, ST_Y(loc) AS lat, ST_X(loc) AS lng, especie FROM vera WHERE loc IS NOT NULL'
                    .($ultimo === null ? '' : ' AND id_vera > ?').' ORDER BY id_vera LIMIT 5000', $ultimo === null ? [] : [$ultimo]);
                if (! $lote) {
                    break;
                }
                $pontos = [];
                foreach ($lote as $p) {
                    $pontos[] = [(float) $p->lat, (float) $p->lng, $p->id_vera, $p->especie];
                    $ultimo = $p->id_vera;
                }
                $enviadas += count($pontos);
                gzwrite($gz, json_encode(['tipo' => 'lote', 'pontos' => $pontos, 'enviadas' => $enviadas, 'total' => $total], JSON_UNESCAPED_UNICODE)."\n");
            } while (count($lote) === 5000);
            gzwrite($gz, json_encode(['tipo' => 'final', 'total' => $enviadas])."\n");
            gzclose($gz);
            rename($tmp, $arq);
            foreach (glob($dir.DIRECTORY_SEPARATOR.'vera_*.ndjson.gz') ?: [] as $velho) {
                if ($velho !== $arq) {
                    @unlink($velho);
                }
            }
        }
        $cab = ['Content-Type' => 'application/x-ndjson; charset=utf-8', 'Cache-Control' => 'no-store', 'Vary' => 'Accept-Encoding'];
        if (str_contains(strtolower((string) $r->header('Accept-Encoding')), 'gzip')) {
            return response()->file($arq, $cab + ['Content-Encoding' => 'gzip']);
        }

        return response()->stream(fn () => readgzfile($arq), 200, $cab);
    }

    // ------------------------------------------------------------------ Postes (PONNOT)

    public function postesResumo(Request $r): JsonResponse
    {
        if ($x = $this->ver($r, 'Sem permissão para ver a base de Postes.')) {
            return $x;
        }
        $meta = json_decode((string) DB::table('legado_bruto')->where('entidade', 'postes_meta')->value('dados'), true);
        $meta = is_array($meta) ? ($meta[0] ?? $meta) : [];
        $porTipo = DB::table('postes')->selectRaw("coalesce(tipo, '') AS t, count(*) AS n")->groupBy('t')->pluck('n', 't')->map(fn ($n) => (int) $n);
        $total = (int) $porTipo->sum();
        if ($total === 0) {
            return response()->json(['total' => 0]);
        }

        return response()->json(array_merge($meta, ['total' => $total, 'porTipo' => (object) $porTipo->all()]));
    }

    /** Pontos de um retangulo: [codId, tipo, areaLocal, conjunto, lat, lng]. */
    public function postesArea(Request $r): JsonResponse
    {
        if ($x = $this->ver($r, 'Sem permissão para ver a base de Postes.')) {
            return $x;
        }
        if (! $box = self::retangulo($r)) {
            return response()->json(['erro' => 'Parâmetros sul, oeste, norte e leste são obrigatórios.'], 400);
        }
        $lim = max(1, min(8000, (int) $r->query('limite', 4000)));
        [$filtroTipo, $pTipo] = self::filtroTipos($r->query('tipos'), 'tipo');
        $where = 'loc && ST_MakeEnvelope(?, ?, ?, ?, 4326)'.$filtroTipo;
        $p = array_merge($box, $pTipo);
        $total = (int) DB::selectOne("SELECT count(*) AS n FROM postes WHERE $where", $p)->n;
        $rows = DB::select("SELECT cod_id, coalesce(tipo, '') AS tipo, coalesce(area_local, '') AS area_local, coalesce(conjunto, '') AS conjunto,
            round(ST_Y(loc)::numeric, 6)::float8 AS lat, round(ST_X(loc)::numeric, 6)::float8 AS lng FROM postes WHERE $where LIMIT $lim", $p);
        $tipos = DB::table('postes')->distinct()->orderBy('tipo')->pluck('tipo')->filter(fn ($t) => $t !== null)->values();

        return response()->json(['total' => $total, 'truncado' => $total > $lim, 'tipos' => $tipos,
            'pontos' => array_map(fn ($x) => [$x->cod_id, $x->tipo, $x->area_local, $x->conjunto, (float) $x->lat, (float) $x->lng], $rows)]);
    }

    /** Lista paginada (Gestao de Bases > Ativos): busca = parte do COD_ID ou CONJ/ARE_LOC exatos. */
    public function postesLista(Request $r): JsonResponse
    {
        if ($x = $this->ver($r, 'Sem permissão para ver a base de Postes.')) {
            return $x;
        }
        $pg = max(1, (int) $r->query('pagina', 1));
        $q = DB::table('postes');
        if ($t = trim((string) $r->query('tipo', ''))) {
            $q->whereRaw('lower(tipo) = lower(?)', [$t]);
        }
        if ($b = trim((string) $r->query('busca', ''))) {
            $q->where(fn ($w) => $w->where('cod_id', 'ilike', '%'.addcslashes($b, '%_\\').'%')
                ->orWhereRaw('lower(conjunto) = lower(?)', [$b])->orWhereRaw('lower(area_local) = lower(?)', [$b]));
        }
        $total = (clone $q)->count();
        $linhas = $q->orderBy('cod_id')->offset(($pg - 1) * 50)->limit(50)
            ->get(['cod_id', 'tipo', 'area_local', 'conjunto', DB::raw('ST_Y(loc) AS lat'), DB::raw('ST_X(loc) AS lng')])
            ->map(fn ($p) => ['codId' => $p->cod_id, 'tipo' => (string) $p->tipo, 'areaLocal' => (string) $p->area_local, 'conjunto' => (string) $p->conjunto,
                'lat' => (float) $p->lat, 'lng' => (float) $p->lng]);

        return response()->json(['total' => $total, 'pagina' => $pg, 'tamanhoPagina' => 50, 'linhas' => $linhas]);
    }

    // ------------------------------------------------------------------ Equipamentos (BDGD)

    public function equipResumo(Request $r): JsonResponse
    {
        if ($x = $this->ver($r)) {
            return $x;
        }
        $saida = [];
        foreach (self::EQUIP as $camada => $cfg) {
            $c = DB::selectOne("SELECT count(*) AS total, count(*) FILTER (WHERE coalesce(poste, '') <> '') AS com_poste,
                count(*) FILTER (WHERE loc IS NULL) AS sem_posicao FROM equipamentos WHERE camada = ?", [$camada]);
            if (! $c->total) {
                continue;
            }
            $porTipo = DB::table('equipamentos')->where('camada', $camada)->selectRaw("coalesce({$cfg['tipo']}, '') AS t, count(*) AS n")
                ->groupBy('t')->pluck('n', 't')->map(fn ($n) => (int) $n);
            $imp = DB::table('importacoes_log')->where('base', 'ilike', '%'.$cfg['rotulo'].'%')->orderByDesc('data_hora')->first();
            $saida[$camada] = ['rotulo' => $cfg['rotulo'], 'total' => (int) $c->total, 'comPoste' => (int) $c->com_poste,
                'semPoste' => (int) $c->total - (int) $c->com_poste, 'semPosicao' => (int) $c->sem_posicao, 'porTipo' => (object) $porTipo->all(),
                'atualizadoEm' => isset($imp->data_hora) ? \Illuminate\Support\Carbon::parse($imp->data_hora)->toIso8601String() : null, 'atualizadoPor' => $imp->usuario_id ?? null];
        }

        return response()->json((object) $saida);
    }

    /** Itens da camada no retangulo: [codId, posteId, lat, lng, ctmt, conj, v0..v4, nomeOperativo]. */
    public function equipArea(Request $r): JsonResponse
    {
        if ($x = $this->ver($r)) {
            return $x;
        }
        $camada = (string) $r->query('camada', '');
        if (! isset(self::EQUIP[$camada])) {
            return response()->json(['erro' => 'Camada inválida.'], 400);
        }
        if (! $box = self::retangulo($r)) {
            return response()->json(['erro' => 'Parâmetros sul, oeste, norte e leste são obrigatórios.'], 400);
        }
        $lim = max(1, min(8000, (int) $r->query('limite', 4000)));
        [$filtroTipo, $pTipo] = self::filtroTipos($r->query('tipos'), 'e.'.self::EQUIP[$camada]['tipo']);
        $where = "e.camada = ? AND e.loc && ST_MakeEnvelope(?, ?, ?, ?, 4326) AND ".self::SEM_FUSIVEL_DE_TRAFO.$filtroTipo;
        $p = array_merge([$camada], $box, $pTipo);
        $total = (int) DB::selectOne("SELECT count(*) AS n FROM equipamentos e WHERE $where", $p)->n;
        $itens = self::itens(DB::select('SELECT '.self::COLS." FROM equipamentos e WHERE $where LIMIT $lim", $p));

        return response()->json(['total' => $total, 'truncado' => $total > $lim, 'itens' => $itens]);
    }

    /** Tudo que esta no poste (popup da OS): { trafos: [...], protecoes: [...] }. */
    public function equipPoste(Request $r): JsonResponse
    {
        if ($x = $this->ver($r)) {
            return $x;
        }
        $id = trim((string) $r->query('id', ''));
        if ($id === '') {
            return response()->json(['erro' => 'Informe o id do poste.'], 400);
        }
        $saida = [];
        foreach (DB::select('SELECT e.camada, '.self::COLS.' FROM equipamentos e WHERE e.poste = ? AND '.self::SEM_FUSIVEL_DE_TRAFO.' ORDER BY e.cod_id', [$id]) as $l) {
            $saida[$l->camada][] = self::itens([$l])[0];
        }
        $ordenado = [];
        foreach (array_keys(self::EQUIP) as $c) {
            if (isset($saida[$c])) {
                $ordenado[$c] = $saida[$c];
            }
        }

        return response()->json((object) $ordenado);
    }

    /** Lista paginada (Gestao de Bases > Equipamentos). Busca tambem pelo nome operativo (ex.: TR-1301). */
    public function equipLista(Request $r): JsonResponse
    {
        if ($x = $this->ver($r)) {
            return $x;
        }
        $camada = (string) $r->query('camada', '');
        if (! isset(self::EQUIP[$camada])) {
            return response()->json(['erro' => 'Camada inválida.'], 400);
        }
        $pg = max(1, (int) $r->query('pagina', 1));
        $where = 'e.camada = ? AND '.self::SEM_FUSIVEL_DE_TRAFO;
        $p = [$camada];
        if ($t = trim((string) $r->query('tipo', ''))) {
            $where .= ' AND lower(e.'.self::EQUIP[$camada]['tipo'].') = lower(?)';
            $p[] = $t;
        }
        if ($b = trim((string) $r->query('busca', ''))) {
            $like = '%'.addcslashes($b, '%_\\').'%';
            $where .= ' AND (e.cod_id ILIKE ? OR e.poste ILIKE ? OR lower(e.ctmt) = lower(?) OR lower(e.conj) = lower(?) OR e.nome_operativo ILIKE ?)';
            array_push($p, $like, $like, $b, $b, $like);
        }
        $total = (int) DB::selectOne("SELECT count(*) AS n FROM equipamentos e WHERE $where", $p)->n;
        $off = ($pg - 1) * 50;
        $itens = self::itens(DB::select('SELECT '.self::COLS." FROM equipamentos e WHERE $where ORDER BY e.cod_id LIMIT 50 OFFSET $off", $p));

        return response()->json(['total' => $total, 'pagina' => $pg, 'tamanhoPagina' => 50, 'itens' => $itens]);
    }

    /** Disjuntor / trecho / alimentador do cadastro de Protecao para UM nome (popup). */
    public function equipCadastro(Request $r): JsonResponse
    {
        if ($x = $this->ver($r)) {
            return $x;
        }
        $nome = trim((string) $r->query('nome', ''));
        if ($nome === '') {
            return response()->json(['erro' => 'Informe o nome.'], 400);
        }
        $c = DB::table('protecoes')->whereRaw('upper(protecao_id) = upper(?)', [$nome])->orderBy('id')->first();
        if (! $c) {
            return response()->json(['achou' => false]);
        }

        return response()->json(['achou' => true, 'disjuntor' => (string) $c->protecao2, 'trecho' => (string) $c->trecho, 'alimentador' => (string) $c->alimentador]);
    }

    // ------------------------------------------------------------------ apoio

    private const COLS = "e.cod_id, coalesce(e.poste, '') AS poste, ST_Y(e.loc) AS lat, ST_X(e.loc) AS lng, coalesce(e.ctmt, '') AS ctmt,
        coalesce(e.conj, '') AS conj, coalesce(e.v0, '') AS v0, coalesce(e.v1, '') AS v1, coalesce(e.v2, '') AS v2, coalesce(e.v3, '') AS v3,
        coalesce(e.v4, '') AS v4, coalesce(e.nome_operativo, '') AS nome";

    private static function itens(array $rows): array
    {
        return array_map(fn ($x) => [$x->cod_id, $x->poste, $x->lat !== null ? (float) $x->lat : 0.0, $x->lng !== null ? (float) $x->lng : 0.0,
            $x->ctmt, $x->conj, $x->v0, $x->v1, $x->v2, $x->v3, $x->v4, $x->nome], $rows);
    }

    /** [oeste, sul, leste, norte] para ST_MakeEnvelope, ou null. */
    private static function retangulo(Request $r): ?array
    {
        $v = [];
        foreach (['oeste', 'sul', 'leste', 'norte'] as $k) {
            $x = $r->query($k);
            if (! is_numeric($x)) {
                return null;
            }
            $v[] = (float) $x;
        }

        return $v;
    }

    /** "POS,TOR" -> [" AND lower(col) IN (?,?)", ['pos','tor']] (vazio = todos). */
    private static function filtroTipos($csv, string $col): array
    {
        $tipos = array_values(array_filter(array_map(fn ($t) => mb_strtolower(trim($t)), explode(',', (string) $csv)), fn ($t) => $t !== ''));
        if (! $tipos) {
            return ['', []];
        }

        return [" AND lower($col) IN (".implode(',', array_fill(0, count($tipos), '?')).')', $tipos];
    }
}
