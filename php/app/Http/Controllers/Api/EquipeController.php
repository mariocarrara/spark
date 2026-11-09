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
        return response()->json(self::consulta()->orderBy('id')->get()->map(fn ($e) => self::paraFront($e))->values());
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

    private static function consulta()
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

    private static function paraFront(object $e): array
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
