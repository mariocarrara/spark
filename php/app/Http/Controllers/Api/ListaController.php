<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * /api/listas — listas de apoio (plano, equipeNecessaria, justificativaTipo). Contrato de routes/listas.ps1.
 * "ativo=false": nao aparece para registros novos; "excluido=true": exclusao logica.
 */
class ListaController extends Controller
{
    public const LISTAS = ['plano', 'equipeNecessaria', 'justificativaTipo'];

    /** Valores iniciais (pedido do Mario), gravados na 1a leitura se a tabela estiver vazia. */
    private const PADRAO = [
        'plano' => ['Alimentadores Sensíveis', 'ARSESP', 'Conjunto ESS', 'Fora Plano', 'LD (34Kv E 40Kv)', 'Linha do Basta', 'Não Efetivo', 'Reclamações', 'Repasse', 'Repetibilidade', 'SOMA', 'T1 & T2', 'TOP AL ESS LT', 'T3 "U" Maior 200 UC'],
        'equipeNecessaria' => ['LM - LIVRE', 'LM - DESLIGAMENTO', 'LINHA VIVA', 'LINHA VIVA 18mts', 'RECOLHA'],
        'justificativaTipo' => ['Serviços Comerciais', 'Férias', 'Sem Informação', 'Treinamento', 'Déficit de efetivo Próprio (aguardando contratação)', 'Veículo Quebrado/Manutenção', 'Atuando em manutenção/estrutura', 'Apoio na Recolha', 'Chuva', 'Déficit de efetivo Terceiro', 'Colaborador Afastado', 'Serviços Baroneza', 'Trabalhando no corte', 'Contingência', 'Outros', 'Colaborador de férias'],
    ];

    public function index(): JsonResponse
    {
        self::semear();
        $saida = array_fill_keys(self::LISTAS, []);
        foreach (DB::table('listas_cadastro')->where('excluido', false)->whereIn('lista', self::LISTAS)->orderBy('ordem')->get() as $i) {
            $saida[$i->lista][] = self::paraFront($i);
        }

        return response()->json($saida);
    }

    public function store(Request $request): JsonResponse
    {
        $eu = $request->user();
        if (! $eu->pode('manutencao', 'editar')) {
            return response()->json(['erro' => 'Sem permissão para editar as listas.'], 403);
        }
        $lista = (string) $request->input('lista', '');
        if (! in_array($lista, self::LISTAS, true)) {
            return response()->json(['erro' => "Lista desconhecida: {$lista}"], 400);
        }
        $nome = mb_substr(trim((string) $request->input('nome', '')), 0, 200);
        if ($nome === '') {
            return response()->json(['erro' => 'Informe o nome.'], 400);
        }
        self::semear();
        $repetido = DB::table('listas_cadastro')->where('lista', $lista)->where('excluido', false)->whereRaw('lower(nome) = ?', [mb_strtolower($nome)])->exists();
        if ($repetido) {
            return response()->json(['erro' => 'Já existe um item com esse nome nessa lista.'], 409);
        }
        $novo = ['id' => (string) Str::uuid(), 'lista' => $lista, 'nome' => $nome, 'ativo' => true, 'excluido' => false,
            'ordem' => (int) DB::table('listas_cadastro')->where('lista', $lista)->max('ordem') + 1];
        DB::table('listas_cadastro')->insert($novo);
        Auditoria::registrar('criar', 'listas', $novo['id'], $eu->id, ['lista' => $lista, 'nome' => $nome], $request->ip());

        return response()->json($novo, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $eu = $request->user();
        if (! $eu->pode('manutencao', 'editar')) {
            return response()->json(['erro' => 'Sem permissão para editar as listas.'], 403);
        }
        $item = DB::table('listas_cadastro')->where('id', $id)->first();
        if (! $item) {
            return response()->json(['erro' => 'Item não encontrado.'], 404);
        }
        $mud = [];
        if ($request->has('nome')) {
            $nome = mb_substr(trim((string) $request->input('nome')), 0, 200);
            if ($nome === '') {
                return response()->json(['erro' => 'O nome não pode ficar vazio.'], 400);
            }
            $mud['nome'] = $nome;
        }
        foreach (['ativo', 'excluido'] as $b) {
            if ($request->has($b)) {
                $mud[$b] = filter_var($request->input($b), FILTER_VALIDATE_BOOLEAN);
            }
        }
        if ($request->has('ordem')) {
            $mud['ordem'] = (int) $request->input('ordem');
        }
        if ($mud) {
            DB::table('listas_cadastro')->where('id', $id)->update($mud);
            Auditoria::registrar('alterar', 'listas', $id, $eu->id, ['de' => self::paraFront($item), 'mudou' => $mud], $request->ip());
        }

        return response()->json(self::paraFront(DB::table('listas_cadastro')->where('id', $id)->first()));
    }

    /** DELETE /api/listas?lista=plano&confirmar=sim — "Apagar tudo" (exclusao logica). */
    public function destroyTodos(Request $request): JsonResponse
    {
        $eu = $request->user();
        if (! ($eu->pode('manutencao', 'importar') && $eu->pode('manutencao', 'editar'))) {
            return response()->json(['erro' => 'Sem permissão para apagar a lista (precisa poder importar e editar).'], 403);
        }
        $lista = (string) $request->query('lista', '');
        if (! in_array($lista, self::LISTAS, true)) {
            return response()->json(['erro' => "Lista desconhecida: {$lista}"], 400);
        }
        if ($request->query('confirmar') !== 'sim') {
            return response()->json(['erro' => 'Falta a confirmação (confirmar=sim).'], 400);
        }
        $qtd = DB::table('listas_cadastro')->where('lista', $lista)->where('excluido', false)->update(['excluido' => true]);
        Auditoria::registrar('excluir_todos', 'listas', $lista, $eu->id, ['apagados' => $qtd], $request->ip());

        return response()->json(['lista' => $lista, 'apagados' => $qtd]);
    }

    private static function semear(): void
    {
        if (DB::table('listas_cadastro')->exists()) {
            return;
        }
        $linhas = [];
        foreach (self::PADRAO as $lista => $nomes) {
            foreach ($nomes as $i => $nome) {
                $linhas[] = ['id' => (string) Str::uuid(), 'lista' => $lista, 'nome' => $nome, 'ordem' => $i + 1, 'ativo' => true, 'excluido' => false];
            }
        }
        DB::table('listas_cadastro')->insert($linhas);
    }

    private static function paraFront(object $i): array
    {
        return ['id' => $i->id, 'lista' => $i->lista, 'nome' => $i->nome, 'ativo' => (bool) $i->ativo, 'excluido' => (bool) $i->excluido, 'ordem' => (int) $i->ordem];
    }
}
