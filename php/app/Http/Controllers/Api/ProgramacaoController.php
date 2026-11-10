<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use App\Services\Programacoes as P;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * /api/programacao/* — contrato de routes/programacao.ps1 (v3.16).
 * A mais que o legado (regras no backend): datas validas e fim >= inicio, status so dos valores conhecidos,
 * PUT so altera campos conhecidos (o legado aceitava qualquer campo), programadorId nao muda.
 */
class ProgramacaoController extends Controller
{
    private function negar(Request $r, string $acao, string $msg): ?JsonResponse
    {
        return $r->user()->pode('programacao', $acao) ? null : response()->json(['erro' => $msg], 403);
    }

    public function index(Request $r): JsonResponse
    {
        if ($x = $this->negar($r, 'visualizar', 'Sem permissão para visualizar Programação.')) {
            return $x;
        }

        return response()->json(P::listar($r->only(['status', 'alimentador', 'equipe', 'dataInicio', 'dataFim'])));
    }

    public function store(Request $r): JsonResponse
    {
        if ($x = $this->negar($r, 'criar', 'Sem permissão para criar Programação.')) {
            return $x;
        }
        $eu = $r->user();
        if (trim((string) $r->input('localidade', '')) === '') {
            return response()->json(['erro' => 'Informe a Cidade / localidade da programação (obrigatória para a Logística).'], 400);
        }
        $ini = P::dataValida($r->input('dataInicio'));
        $fim = P::dataValida($r->input('dataFim'));
        if (! $ini || ! $fim) {
            return response()->json(['erro' => 'Informe as datas de início e fim (AAAA-MM-DD).'], 400);
        }
        if ($fim < $ini) {
            return response()->json(['erro' => 'A data fim não pode ser antes da data início.'], 400);
        }
        $equipes = P::lista($r->input('equipesIds'));
        if ($inativas = P::equipesInativas($equipes)) {
            return response()->json(['erro' => 'Equipe inativa não pode receber programação: '.implode(', ', $inativas).'.'], 400);
        }
        $moverPedido = $r->input('moverOs');
        if (! empty($moverPedido) && ! $eu->pode('programacao', 'editar')) {
            return response()->json(['erro' => 'Sem permissão para tirar OS de outra Programação (editar).'], 403);
        }

        // o navegador gera o id; se o mesmo POST chegar de novo (rede caiu), devolve a ja gravada
        $id = strtolower(trim((string) $r->input('id', '')));
        if (P::uuidValido($id)) {
            if ($ja = P::uma($id)) {
                return response()->json(['programacao' => $ja, 'avisosConflito' => [], 'movidas' => []]);
            }
        } else {
            $id = (string) Str::uuid();
        }
        $osIds = P::lista($r->input('osIds'));
        $origem = in_array($r->input('origemTela'), ['Mapa', 'Proteções'], true) ? $r->input('origemTela') : '';

        $dados = ['id' => $id, 'status' => 'Programada', 'data_inicio' => $ini, 'data_fim' => $fim, 'programador_id' => $eu->id,
            'previsto_concluir' => filter_var($r->input('previstoConcluir'), FILTER_VALIDATE_BOOLEAN), 'origem_tela' => $origem,
            'criado_em' => now(), 'atualizado_em' => now()];
        foreach (P::TEXTO as $campo => $col) {
            $dados[$col] = self::texto($r->input($campo));
        }
        $dados['tipo_programacao'] = $dados['tipo_programacao'] ?: 'Poda';
        $dados['plano'] = $dados['plano'] ?: $dados['tipo_plano'];

        $movidas = DB::transaction(function () use ($dados, $equipes, $osIds, $r, $moverPedido, $id) {
            DB::table('programacoes')->insert($dados);
            P::gravarListas($id, $equipes, $osIds, $r->input('osSnap'));

            return empty($moverPedido) ? [] : P::moverOs($id, $moverPedido, $osIds);
        });
        $nova = P::uma($id);
        $avisos = P::conflitos($nova);

        $idsMov = array_merge([], ...array_column($movidas, 'osIds'));
        $mud = [];
        foreach (['protecaoId', 'alimentador', 'dataInicio', 'dataFim', 'equipesIds', 'plano', 'numeroSIS'] as $c) {
            $mud[] = ['c' => $c, 'de' => '', 'para' => P::valorTexto($nova, $c)];
        }
        P::log($id, $eu->id, 'criar', $mud, array_values(array_diff($osIds, $idsMov)), [], 'Programação criada');
        P::logMovidas($movidas, $id, $eu->id);

        return response()->json(['programacao' => $nova, 'avisosConflito' => $avisos, 'movidas' => $movidas], 201);
    }

    public function update(Request $r, string $id): JsonResponse
    {
        if ($x = $this->negar($r, 'editar', 'Sem permissão para editar Programação.')) {
            return $x;
        }
        $eu = $r->user();
        if ($r->has('localidade') && trim((string) $r->input('localidade')) === '') {
            return response()->json(['erro' => 'A Cidade / localidade não pode ficar em branco (obrigatória para a Logística).'], 400);
        }
        $antes = P::uma($id);
        if (! $antes) {
            return response()->json(['erro' => 'Programação não encontrada.'], 404);
        }

        $mud = [];
        foreach (P::TEXTO as $campo => $col) {
            if ($r->has($campo)) {
                $mud[$col] = self::texto($r->input($campo));
            }
        }
        $ini = $r->has('dataInicio') ? P::dataValida($r->input('dataInicio')) : $antes['dataInicio'];
        $fim = $r->has('dataFim') ? P::dataValida($r->input('dataFim')) : $antes['dataFim'];
        if (! $ini || ! $fim) {
            return response()->json(['erro' => 'Datas inválidas (AAAA-MM-DD).'], 400);
        }
        if ($fim < $ini) {
            return response()->json(['erro' => 'A data fim não pode ser antes da data início.'], 400);
        }
        $mud['data_inicio'] = $ini;
        $mud['data_fim'] = $fim;
        if ($r->has('previstoConcluir')) {
            $mud['previsto_concluir'] = filter_var($r->input('previstoConcluir'), FILTER_VALIDATE_BOOLEAN);
        }
        if ($r->has('status')) {
            if (! in_array($r->input('status'), P::STATUS, true)) {
                return response()->json(['erro' => 'Status inválido.'], 400);
            }
            $mud['status'] = $r->input('status');
        }
        $equipes = $r->has('equipesIds') ? P::lista($r->input('equipesIds')) : $antes['equipesIds'];
        if ($inativas = P::equipesInativas($equipes, $antes['equipesIds'])) {
            return response()->json(['erro' => 'Equipe inativa não pode receber programação: '.implode(', ', $inativas).'.'], 400);
        }
        $osIds = $r->has('osIds') ? P::lista($r->input('osIds')) : $antes['osIds'];
        $mud['atualizado_em'] = now();

        $movidas = DB::transaction(function () use ($id, $mud, $equipes, $osIds, $r) {
            DB::table('programacoes')->where('id', $id)->lockForUpdate()->first();
            DB::table('programacoes')->where('id', $id)->update($mud);
            P::gravarListas($id, $equipes, $osIds, $r->input('osSnap'));

            return empty($r->input('moverOs')) ? [] : P::moverOs($id, $r->input('moverOs'), $osIds);
        });
        $depois = P::uma($id);
        $avisos = P::conflitos($depois);

        $mudLog = [];
        foreach (P::CAMPOS_LOG as $c) {
            $de = P::valorTexto($antes, $c);
            $para = P::valorTexto($depois, $c);
            if ($de !== $para) {
                $mudLog[] = ['c' => $c, 'de' => $de, 'para' => $para];
            }
        }
        $idsMov = array_merge([], ...array_column($movidas, 'osIds'));
        $add = array_values(array_diff($depois['osIds'], $antes['osIds'], $idsMov));
        $rem = array_values(array_diff($antes['osIds'], $depois['osIds']));
        if ($mudLog || $add || $rem) {
            P::log($id, $eu->id, 'editar', $mudLog, $add, $rem, 'Programação editada');
        }
        P::logMovidas($movidas, $id, $eu->id);

        return response()->json(['programacao' => $depois, 'avisosConflito' => $avisos, 'movidas' => $movidas]);
    }

    /** Cancelar/reativar (cancelamento e exclusao logica). */
    public function status(Request $r, string $id): JsonResponse
    {
        if ($x = $this->negar($r, 'excluirStatus', 'Sem permissão para alterar status de Programação.')) {
            return $x;
        }
        $novo = (string) $r->input('status', '');
        if (! in_array($novo, P::STATUS, true)) {
            return response()->json(['erro' => 'Status inválido.'], 400);
        }
        $antes = P::uma($id);
        if (! $antes) {
            return response()->json(['erro' => 'Programação não encontrada.'], 404);
        }
        DB::table('programacoes')->where('id', $id)->update(['status' => $novo, 'atualizado_em' => now()]);
        if ($antes['status'] !== $novo) {
            P::log($id, $r->user()->id, 'status', [['c' => 'status', 'de' => $antes['status'], 'para' => $novo]], [], [], 'Status alterado');
        }

        return response()->json(P::uma($id));
    }

    public function log(Request $r, string $id): JsonResponse
    {
        if ($x = $this->negar($r, 'visualizar', 'Sem permissão para visualizar Programação.')) {
            return $x;
        }
        if (! P::uuidValido($id)) {
            return response()->json(['eventos' => []]);
        }
        $nomes = DB::table('usuarios')->pluck('nome', 'id');
        $eventos = DB::table('programacao_log')->where('programacao_id', $id)->orderByDesc('momento')->orderByDesc('id')->limit(300)->get()
            ->map(fn ($l) => [
                't' => Carbon::parse($l->momento)->setTimezone(config('app.timezone'))->toIso8601String(), 'u' => $l->usuario_id, 'p' => $l->programacao_id, 'a' => $l->acao,
                'r' => (string) $l->resumo, 'ref' => (string) $l->ref, 'm' => json_decode($l->mudancas ?? '[]'),
                'add' => json_decode($l->os_add ?? '[]'), 'rem' => json_decode($l->os_rem ?? '[]'),
                'usuario' => $nomes[$l->usuario_id] ?? (string) $l->usuario_id,
            ]);

        return response()->json(['eventos' => $eventos->values()]);
    }

    /** Busca de protecao por elemento, "PROT. ELEMENTO 2" ou alimentador; quem comeca com o texto vem primeiro. */
    public function buscarProtecao(Request $r): JsonResponse
    {
        if ($x = $this->negar($r, 'visualizar', 'Sem permissão para visualizar Programação.')) {
            return $x;
        }
        $q = mb_strtolower(trim((string) $r->query('q', '')));
        $limite = max(1, min(100, (int) $r->query('limite', 30)));
        if (mb_strlen($q) < 2) {
            return response()->json(['total' => 0, 'resultados' => []]);
        }
        $esc = addcslashes($q, '%_\\');
        $rows = DB::select("SELECT protecao_id, protecao2, alimentador, trecho, ST_Y(loc) AS lat, ST_X(loc) AS lng,
                CASE WHEN lower(protecao_id) LIKE :p1 OR lower(protecao2) LIKE :p2 OR lower(alimentador) LIKE :p3 THEN 0 ELSE 1 END AS ordem
            FROM protecoes WHERE lower(protecao_id) LIKE :c1 OR lower(protecao2) LIKE :c2 OR lower(alimentador) LIKE :c3
            ORDER BY ordem, id LIMIT {$limite}",
            ['p1' => "$esc%", 'p2' => "$esc%", 'p3' => "$esc%", 'c1' => "%$esc%", 'c2' => "%$esc%", 'c3' => "%$esc%"]);
        $res = array_map(fn ($x) => ['protecaoId' => $x->protecao_id, 'protecao2' => (string) $x->protecao2, 'alimentador' => (string) $x->alimentador,
            'trecho' => (string) $x->trecho, 'lat' => $x->lat !== null ? (float) $x->lat : null, 'lng' => $x->lng !== null ? (float) $x->lng : null], $rows);

        return response()->json(['total' => count($res), 'resultados' => $res]);
    }

    /** Protecao do alimentador mais perto do ponto (centro das OS selecionadas). */
    public function protecaoProxima(Request $r): JsonResponse
    {
        if ($x = $this->negar($r, 'visualizar', 'Sem permissão para visualizar Programação.')) {
            return $x;
        }
        $alim = mb_strtolower(trim((string) $r->query('alimentador', '')));
        if ($alim === '') {
            return response()->json(['encontrada' => false, 'total' => 0]);
        }
        $total = (int) DB::table('protecoes')->whereRaw('lower(alimentador) = ?', [$alim])->count();
        $lat = $r->query('lat');
        $lng = $r->query('lng');
        $saida = fn ($p, $d) => ['encontrada' => true, 'total' => $total, 'distanciaM' => $d, 'protecaoId' => $p->protecao_id,
            'protecao2' => (string) $p->protecao2, 'alimentador' => (string) $p->alimentador, 'trecho' => (string) $p->trecho];
        if (is_numeric($lat) && is_numeric($lng)) {
            $p = DB::selectOne('SELECT protecao_id, protecao2, alimentador, trecho,
                    ST_Distance(loc::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography) AS d
                FROM protecoes WHERE lower(alimentador) = ? AND loc IS NOT NULL ORDER BY loc <-> ST_SetSRID(ST_MakePoint(?, ?), 4326) LIMIT 1',
                [(float) $lng, (float) $lat, $alim, (float) $lng, (float) $lat]);
            if ($p) {
                return response()->json($saida($p, (int) round($p->d)));
            }
        }
        if ($total === 1) {
            $p = DB::table('protecoes')->whereRaw('lower(alimentador) = ?', [$alim])->first();

            return response()->json($saida($p, null));
        }

        return response()->json(['encontrada' => false, 'total' => $total]);
    }

    /** Programacoes ativas no dia + equipes (visao logistica). */
    public function logistica(Request $r): JsonResponse
    {
        if ($x = $this->negar($r, 'visualizar', 'Sem permissão para visualizar Programação.')) {
            return $x;
        }
        $dia = P::dataValida($r->query('data', '')) ?? now()->toDateString();
        $equipes = app(EquipeController::class)->index()->getData(true);

        return response()->json(['data' => $dia, 'programacoes' => P::listar(['dia' => $dia]), 'equipes' => $equipes]);
    }

    /** Zera SO as programacoes (admin, confirmar=APAGAR). Copia de seguranca vai para legado_bruto. */
    public function zerar(Request $r): JsonResponse
    {
        if (! $r->user()->isAdmin()) {
            return response()->json(['erro' => 'Só administradores podem zerar as programações.'], 403);
        }
        if (mb_strtoupper(trim((string) $r->input('confirmar', ''))) !== 'APAGAR') {
            return response()->json(['erro' => 'Falta a confirmação (confirmar = APAGAR).'], 400);
        }
        $todas = P::listar();
        $backup = null;
        DB::transaction(function () use ($todas, &$backup, $r) {
            if ($todas) {
                $backup = 'programacao_backup_'.now()->format('Ymd-His');
                DB::table('legado_bruto')->insert(['entidade' => $backup, 'dados' => json_encode($todas, JSON_UNESCAPED_UNICODE), 'importado_em' => now()]);
            }
            DB::table('programacoes')->delete();
            DB::table('importacoes_log')->insert(['id' => (string) Str::uuid(), 'data_hora' => now(), 'usuario_id' => $r->user()->id,
                'base' => 'Programação (zerada)', 'arquivo_origem' => $backup ?? '', 'registros_processados' => count($todas), 'registros_com_erro' => 0]);
        });
        Auditoria::registrar('zerar', 'programacao', null, $r->user()->id, ['apagadas' => count($todas), 'backup' => $backup], $r->ip());

        return response()->json(['ok' => true, 'apagadas' => count($todas), 'backup' => $backup]);
    }

    private static function texto($v): ?string
    {
        if ($v === null || is_array($v) || is_object($v)) {
            return null;
        }
        $t = trim((string) $v);

        return $t === '' ? null : mb_substr($t, 0, 2000);
    }
}
