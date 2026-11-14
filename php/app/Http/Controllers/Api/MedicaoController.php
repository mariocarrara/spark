<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Medicao de terceiros (routes/medicao.ps1, v3.24): GET /medicao/mo -> linhas da MO EXECUTADA, no formato do
 * mo_linhas_executada.json do legado: {origem, geradoEm, colunas, linhas:[[os, grupo, tipo, qtdPoda, qtdLimpeza, qtdEstrutura]]}.
 * A juncao OS x equipe terceira e feita no navegador. Administrador sempre; os demais so com a caixa "Medicao de terceiros (menu)".
 */
class MedicaoController extends Controller
{
    public function mo(Request $r): Response
    {
        if (! $r->user()->pode('medicao', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para a Medição de terceiros.'], 403);
        }
        $meta = json_decode((string) DB::table('configuracoes')->where('chave', 'mo_linhas_executada')->value('valor'), true);
        if (! $meta) {
            return response()->json(['origem' => '', 'geradoEm' => null, 'colunas' => [], 'linhas' => []]);
        }
        $linhas = (string) DB::selectOne("SELECT coalesce(json_agg(json_build_array(os, coalesce(grupo, ''), coalesce(tipo, ''),
            qtd_poda::float8, qtd_limpeza::float8, qtd_estrutura::float8) ORDER BY ordem), '[]')::text AS j FROM mo_linhas WHERE origem = 'executada'")->j;
        $cab = json_encode(['origem' => 'executada', 'geradoEm' => $meta['geradoEm'] ?? null, 'colunas' => ['os', 'grupo', 'tipo', 'qtdPoda', 'qtdLimpeza', 'qtdEstrutura']], JSON_UNESCAPED_UNICODE);

        return response(substr($cab, 0, -1).',"linhas":'.$linhas.'}', 200, ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store']);
    }
}
