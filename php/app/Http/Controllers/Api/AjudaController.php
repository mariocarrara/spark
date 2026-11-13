<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Perguntas e respostas do chat de Ajuda — contrato de routes/ajuda.ps1:
 *   GET /ajuda (qualquer logado; sem os excluidos, pela ordem) | POST /ajuda | PUT /ajuda/{id} (manutencao.editar)
 * Tabela vazia: semeia com resources/spark/ajuda_padrao.json (o mesmo lib/ajuda_padrao.json do legado).
 */
class AjudaController extends Controller
{
    private static function semear(): void
    {
        if (DB::table('ajuda_faq')->exists()) {
            return;
        }
        $padrao = json_decode((string) @file_get_contents(resource_path('spark/ajuda_padrao.json')), true) ?: [];
        $linhas = [];
        foreach (array_values($padrao) as $i => $p) {
            $linhas[] = ['id' => (string) Str::uuid(), 'categoria' => (string) ($p['categoria'] ?? ''), 'pergunta' => (string) ($p['pergunta'] ?? ''),
                'resposta' => (string) ($p['resposta'] ?? ''), 'palavras' => (string) ($p['palavras'] ?? ''), 'ordem' => $i + 1, 'ativo' => true, 'excluido' => false];
        }
        $linhas && DB::table('ajuda_faq')->insert($linhas);
    }

    private static function paraFront(object $a): array
    {
        return ['id' => $a->id, 'categoria' => $a->categoria, 'pergunta' => $a->pergunta, 'resposta' => $a->resposta, 'palavras' => $a->palavras,
            'ordem' => (int) $a->ordem, 'ativo' => (bool) $a->ativo, 'excluido' => (bool) $a->excluido];
    }

    public function index(): JsonResponse
    {
        self::semear();

        return response()->json(DB::table('ajuda_faq')->where('excluido', false)->orderBy('ordem')->get()->map(fn ($a) => self::paraFront($a))->values());
    }

    private function negar(Request $r): ?JsonResponse
    {
        return $r->user()->pode('manutencao', 'editar') ? null : response()->json(['erro' => 'Sem permissão para editar a Ajuda.'], 403);
    }

    public function store(Request $r): JsonResponse
    {
        if ($x = $this->negar($r)) {
            return $x;
        }
        $pergunta = trim((string) $r->input('pergunta', ''));
        $resposta = trim((string) $r->input('resposta', ''));
        if ($pergunta === '' || $resposta === '') {
            return response()->json(['erro' => 'Informe a pergunta e a resposta.'], 400);
        }
        self::semear();
        $novo = ['id' => (string) Str::uuid(), 'categoria' => mb_substr(trim((string) $r->input('categoria', '')) ?: 'Geral', 0, 100),
            'pergunta' => mb_substr($pergunta, 0, 1000), 'resposta' => mb_substr($resposta, 0, 10000), 'palavras' => mb_substr(trim((string) $r->input('palavras', '')), 0, 1000),
            'ordem' => (int) DB::table('ajuda_faq')->max('ordem') + 1, 'ativo' => true, 'excluido' => false];
        DB::table('ajuda_faq')->insert($novo);

        return response()->json(self::paraFront((object) $novo), 201);
    }

    public function update(Request $r, string $id): JsonResponse
    {
        if ($x = $this->negar($r)) {
            return $x;
        }
        if (! DB::table('ajuda_faq')->where('id', $id)->exists()) {
            return response()->json(['erro' => 'Pergunta não encontrada.'], 404);
        }
        $dados = [];
        foreach (['categoria' => 100, 'pergunta' => 1000, 'resposta' => 10000, 'palavras' => 1000] as $campo => $max) {
            if ($r->exists($campo)) {
                $v = trim((string) $r->input($campo, ''));
                if (in_array($campo, ['pergunta', 'resposta'], true) && $v === '') {
                    return response()->json(['erro' => 'A pergunta e a resposta não podem ficar vazias.'], 400);
                }
                $dados[$campo] = mb_substr($v, 0, $max);
            }
        }
        foreach (['ativo', 'excluido'] as $b) {
            if ($r->input($b) !== null) {
                $dados[$b] = filter_var($r->input($b), FILTER_VALIDATE_BOOLEAN);
            }
        }
        if ($r->input('ordem') !== null) {
            $dados['ordem'] = (int) $r->input('ordem');
        }
        $dados && DB::table('ajuda_faq')->where('id', $id)->update($dados);

        return response()->json(self::paraFront(DB::table('ajuda_faq')->where('id', $id)->first()));
    }
}
