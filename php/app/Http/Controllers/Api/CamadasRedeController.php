<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Gestao de Bases > abas Rede MT/BT/AT, Reserva Legal e APP — contrato de routes/importacao.ps1:
 *   GET    /importacao/camadas                       -> {rede_media_tensao:[{chave,nome,trechos}], ...}
 *   DELETE /importacao/camadas/{camada}?confirmar=sim  apaga a camada inteira (importar + editar)
 *   DELETE /importacao/camadas/{camada}/{chave}        apaga 1 alimentador (importar)
 * No sistema novo a rede fica em rede_trechos (mt|bt|at) e areas_protegidas (rl|app).
 * A IMPORTACAO de KMZ/Shapefile ainda nao foi portada (depende da pasta geo/): ate la as listas vem vazias.
 */
class CamadasRedeController extends Controller
{
    /** camada do front => [tabela, coluna do tipo, valor] */
    private const CAMADAS = [
        'rede_media_tensao' => ['rede_trechos', 'camada', 'mt'],
        'rede_baixa_tensao' => ['rede_trechos', 'camada', 'bt'],
        'rede_alta_tensao' => ['rede_trechos', 'camada', 'at'],
        'reserva_legal' => ['areas_protegidas', 'tipo', 'rl'],
        'app' => ['areas_protegidas', 'tipo', 'app'],
    ];

    /** alimentador vazio vira esta chave (a URL nao aceita chave vazia) */
    private const SEM_ALIMENTADOR = '(sem alimentador)';

    public function index(Request $r): JsonResponse
    {
        if (! $r->user()->pode('manutencao', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para ver as camadas de rede.'], 403);
        }
        $saida = [];
        foreach (self::CAMADAS as $camada => [$tabela, $col, $valor]) {
            $saida[$camada] = DB::table($tabela)->where($col, $valor)
                ->selectRaw('alimentador, count(*) AS trechos')->groupBy('alimentador')->get()
                ->map(fn ($l) => ['chave' => $l->alimentador ?? self::SEM_ALIMENTADOR, 'nome' => $l->alimentador ?? self::SEM_ALIMENTADOR, 'trechos' => (int) $l->trechos])
                ->sortBy('chave')->values()->all();
        }

        return response()->json($saida);
    }

    public function destroyCamada(Request $r, string $camada): JsonResponse
    {
        $eu = $r->user();
        if (! ($eu->pode('manutencao', 'importar') && $eu->pode('manutencao', 'editar'))) {
            return response()->json(['erro' => 'Sem permissão para apagar camadas de rede (precisa poder importar e editar).'], 403);
        }
        if (! isset(self::CAMADAS[$camada])) {
            return response()->json(['erro' => "Camada de rede desconhecida: {$camada}"], 400);
        }
        if ($r->query('confirmar') !== 'sim') {
            return response()->json(['erro' => 'Falta a confirmação (confirmar=sim).'], 400);
        }
        [$tabela, $col, $valor] = self::CAMADAS[$camada];
        $qtd = DB::table($tabela)->where($col, $valor)->distinct()->count('alimentador');
        DB::table($tabela)->where($col, $valor)->delete();
        Auditoria::registrar('apagar_tudo', "camadas/{$camada}", null, $eu->id, ['alimentadores' => $qtd], $r->ip());

        return response()->json(['camada' => $camada, 'apagados' => $qtd]);
    }

    public function destroyAlimentador(Request $r, string $camada, string $chave): JsonResponse
    {
        $eu = $r->user();
        if (! $eu->pode('manutencao', 'importar')) {
            return response()->json(['erro' => 'Sem permissão para apagar camadas de rede.'], 403);
        }
        if (! isset(self::CAMADAS[$camada])) {
            return response()->json(['erro' => "Camada de rede desconhecida: {$camada}"], 400);
        }
        [$tabela, $col, $valor] = self::CAMADAS[$camada];
        $q = DB::table($tabela)->where($col, $valor);
        $chave === self::SEM_ALIMENTADOR ? $q->whereNull('alimentador') : $q->where('alimentador', $chave);
        $n = $q->delete();
        if (! $n) {
            return response()->json(['erro' => "Alimentador {$chave} não encontrado na camada."], 404);
        }
        Auditoria::registrar('excluir', "camadas/{$camada}", $chave, $eu->id, ['trechos' => $n], $r->ip());

        return response()->json(['ok' => true]);
    }
}
