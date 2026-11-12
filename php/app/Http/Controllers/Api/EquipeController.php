<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * /api/equipes — contrato do legado (routes/equipes.ps1). Falta portar: POST /equipes/importar (Excel).
 * Escrita (criar/editar): manutencao importar + editar, igual ao botao do front (podeEditarLinhaBase).
 * No legado o PUT nao conferia permissao e aceitava qualquer campo; aqui so os campos conhecidos.
 */
class EquipeController extends Controller
{
    /** campo do front => coluna */
    private const CAMPOS = [
        'nome' => 'nome', 'tipoEquipe' => 'tipo_equipe', 'polo' => 'polo', 'regional' => 'regional',
        'departamento' => 'departamento', 'proprioTerceiro' => 'proprio_terceiro',
        'equipePoda' => 'equipe_poda', 'ativo' => 'ativo',
    ];

    public function index(): JsonResponse
    {
        // excluidas na Gestao de Bases (flag em "exclusoes") somem, como no legado
        $excl = DB::table('exclusoes')->where('base', 'equipes')->pluck('chave')->flip();

        return response()->json(self::consulta()->orderBy('id')->get()->reject(fn ($e) => isset($excl[$e->id]))
            ->map(fn ($e) => self::paraFront($e))->values());
    }

    public function store(Request $request): JsonResponse
    {
        $eu = $request->user();
        if (! ($eu->pode('manutencao', 'importar') && $eu->pode('manutencao', 'editar'))) {
            return response()->json(['erro' => 'Sem permissão para cadastrar equipes.'], 403);
        }
        $id = trim((string) $request->input('id', ''));
        if ($id === '' || mb_strlen($id) > 60) {
            return response()->json(['erro' => 'Informe o código da equipe.'], 400);
        }
        if (DB::table('equipes')->where('id', $id)->exists()) {
            return response()->json(['erro' => 'Já existe uma equipe com esse código.'], 409);
        }
        $dados = self::colunas($request->all()) + ['id' => $id, 'ativo' => true, 'equipe_poda' => false];
        $dados['nome'] = ($dados['nome'] ?? '') !== '' ? $dados['nome'] : $id;
        DB::table('equipes')->insert($dados);
        self::gravarBase($id, $request);
        Auditoria::registrar('criar', 'equipes', $id, $eu->id, ['dados' => $request->only(array_merge(array_keys(self::CAMPOS), ['baseLat', 'baseLng']))], $request->ip());

        return response()->json(self::paraFront(self::consulta()->where('id', $id)->first()), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $eu = $request->user();
        if (! ($eu->pode('manutencao', 'importar') && $eu->pode('manutencao', 'editar'))) {
            return response()->json(['erro' => 'Sem permissão para editar equipes.'], 403);
        }
        $antes = self::consulta()->where('id', $id)->first();
        if (! $antes) {
            return response()->json(['erro' => 'Equipe não encontrada.'], 404);
        }
        $dados = self::colunas($request->all());
        if (array_key_exists('nome', $dados) && $dados['nome'] === '') {
            return response()->json(['erro' => 'O nome não pode ficar vazio.'], 400);
        }
        DB::transaction(function () use ($id, $dados, $request) {
            if ($dados) {
                DB::table('equipes')->where('id', $id)->update($dados);
            }
            self::gravarBase($id, $request);
        });
        $depois = self::paraFront(self::consulta()->where('id', $id)->first());
        Auditoria::registrar('alterar', 'equipes', $id, $eu->id, ['de' => self::paraFront($antes), 'para' => $depois], $request->ip());

        return response()->json($depois);
    }

    /**
     * GET /api/equipes/sem-cadastro — codigos de equipe que aparecem nas OS e NAO estao no cadastro (por isso nao entram
     * na Produtividade). Sugere polo/regional pelo alimentador mais frequente das OS da equipe (tabela alimentador_polo).
     */
    public function semCadastro(Request $r): JsonResponse
    {
        if (! $r->user()->pode('manutencao', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para ver as equipes.'], 403);
        }
        $linhas = DB::select("WITH sem AS (
                SELECT os.equipe_id, count(*) AS n, string_agg(DISTINCT os.origem, '/') AS origens, max(os.data_execucao) AS ultima
                FROM os WHERE coalesce(os.equipe_id, '') <> '' AND NOT EXISTS (SELECT 1 FROM equipes e WHERE e.id = os.equipe_id) GROUP BY 1),
            pol AS (SELECT os.equipe_id, ap.polo, ap.regional, row_number() OVER (PARTITION BY os.equipe_id ORDER BY count(*) DESC, ap.polo) AS rk
                FROM os JOIN alimentador_polo ap ON ap.alimentador = os.alimentador JOIN sem ON sem.equipe_id = os.equipe_id GROUP BY os.equipe_id, ap.polo, ap.regional)
            SELECT sem.*, pol.polo, pol.regional FROM sem LEFT JOIN pol ON pol.equipe_id = sem.equipe_id AND pol.rk = 1 ORDER BY sem.n DESC, sem.equipe_id");

        return response()->json(array_map(fn ($x) => ['id' => $x->equipe_id, 'os' => (int) $x->n, 'origens' => $x->origens, 'ultimaExecucao' => $x->ultima ? substr((string) $x->ultima, 0, 10) : null,
            'plantao' => self::ehPlantao($x->equipe_id), 'poloSugerido' => $x->polo, 'regionalSugerida' => $x->regional], $linhas));
    }

    /** POST /api/equipes/cadastrar-varias {equipes:[{id, polo, regional, ...}]} — cadastro em lote (as que ja existem sao ignoradas). */
    public function cadastrarVarias(Request $r): JsonResponse
    {
        $eu = $r->user();
        if (! ($eu->pode('manutencao', 'importar') && $eu->pode('manutencao', 'editar'))) {
            return response()->json(['erro' => 'Sem permissão para cadastrar equipes.'], 403);
        }
        $lista = array_values(array_filter((array) $r->input('equipes', []), 'is_array'));
        if (! $lista || count($lista) > 2000) {
            return response()->json(['erro' => 'Envie de 1 a 2000 equipes.'], 400);
        }
        $criadas = [];
        DB::transaction(function () use ($lista, &$criadas) {
            foreach ($lista as $e) {
                $id = mb_substr(trim((string) ($e['id'] ?? '')), 0, 60);
                if ($id === '' || DB::table('equipes')->where('id', $id)->exists()) {
                    continue;
                }
                $dados = self::colunas($e) + ['id' => $id, 'nome' => $id, 'ativo' => true, 'equipe_poda' => true];
                if (self::ehPlantao($id) && empty($dados['tipo_equipe'])) {
                    $dados['tipo_equipe'] = 'Plantão';
                }
                DB::table('equipes')->insert($dados);
                $criadas[] = $id;
            }
        });
        Auditoria::registrar('criar', 'equipes', null, $eu->id, ['emLote' => count($criadas), 'ids' => array_slice($criadas, 0, 200)], $r->ip());

        return response()->json(['criadas' => count($criadas), 'ids' => $criadas]);
    }

    /** Equipe de plantao: codigo terminando em PL + numero (BRAPL01) — sao as do SIGOD, uma ou mais por polo. */
    public static function ehPlantao(?string $id): bool
    {
        return (bool) preg_match('/PL\d+$/i', (string) $id);
    }

    public static function consulta()
    {
        return DB::table('equipes')->select('*', DB::raw('ST_Y(base) AS base_lat'), DB::raw('ST_X(base) AS base_lng'));
    }

    /** So os campos conhecidos que vieram no corpo. */
    private static function colunas(array $corpo): array
    {
        $saida = [];
        foreach (self::CAMPOS as $campo => $coluna) {
            if (! array_key_exists($campo, $corpo)) {
                continue;
            }
            $v = $corpo[$campo];
            $saida[$coluna] = in_array($campo, ['equipePoda', 'ativo'], true)
                ? filter_var($v, FILTER_VALIDATE_BOOLEAN)
                : ($v === null ? null : mb_substr(trim((string) $v), 0, 200));
        }

        return $saida;
    }

    /** baseLat/baseLng -> geometry(Point,4326). So mexe se os dois vierem no corpo. */
    private static function gravarBase(string $id, Request $request): void
    {
        if (! $request->has('baseLat') || ! $request->has('baseLng')) {
            return;
        }
        $lat = $request->input('baseLat');
        $lng = $request->input('baseLng');
        if (is_numeric($lat) && is_numeric($lng) && abs($lat) <= 90 && abs($lng) <= 180) {
            DB::update('UPDATE equipes SET base = ST_SetSRID(ST_MakePoint(?, ?), 4326) WHERE id = ?', [(float) $lng, (float) $lat, $id]);
        } else {
            DB::update('UPDATE equipes SET base = NULL WHERE id = ?', [$id]);
        }
    }

    public static function paraFront(object $e): array
    {
        return [
            'id' => $e->id, 'nome' => $e->nome, 'tipoEquipe' => $e->tipo_equipe, 'polo' => $e->polo,
            'regional' => $e->regional, 'departamento' => $e->departamento, 'proprioTerceiro' => $e->proprio_terceiro,
            'equipePoda' => (bool) $e->equipe_poda,
            'baseLat' => $e->base_lat !== null ? (float) $e->base_lat : null,
            'baseLng' => $e->base_lng !== null ? (float) $e->base_lng : null,
            'ativo' => (bool) $e->ativo,
        ];
    }
}
