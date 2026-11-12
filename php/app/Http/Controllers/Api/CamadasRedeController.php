<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use App\Services\RedeGeo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gestao de Bases > abas Rede MT/BT/AT, Reserva Legal e APP (contrato de routes/importacao.ps1 + exportar/importar novos):
 *   GET    /importacao/camadas                          -> {rede_media_tensao:[{chave,nome,trechos}], ...}
 *   DELETE /importacao/camadas/{camada}?confirmar=sim     apaga a camada inteira (importar + editar)
 *   DELETE /importacao/camadas/{camada}/{chave}           apaga 1 alimentador (importar)
 *   GET    /importacao/camadas/{camada}/exportar          GeoJSON da camada inteira; cada feicao leva _alimentador/_alimentadorNome
 *   POST   /importacao/camadas/{camada}/alimentador       {alimentador, nome?, nomes?, metros?, features:[...]} grava/substitui 1 alimentador
 */
class CamadasRedeController extends Controller
{
    public function index(Request $r): JsonResponse
    {
        if (! $r->user()->pode('manutencao', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para ver as camadas de rede.'], 403);
        }
        $saida = [];
        foreach (RedeGeo::CAMADAS as $nome => $c) {
            $saida[$nome] = array_map(fn ($a) => ['chave' => $a['ctmt'], 'nome' => $a['nome'], 'trechos' => $a['trechos']], RedeGeo::lista($c));
        }

        return response()->json($saida);
    }

    public function destroyCamada(Request $r, string $camada): JsonResponse
    {
        $eu = $r->user();
        if (! ($eu->pode('manutencao', 'importar') && $eu->pode('manutencao', 'editar'))) {
            return response()->json(['erro' => 'Sem permissão para apagar camadas de rede (precisa poder importar e editar).'], 403);
        }
        if (! $c = RedeGeo::CAMADAS[$camada] ?? null) {
            return response()->json(['erro' => "Camada de rede desconhecida: {$camada}"], 400);
        }
        if ($r->query('confirmar') !== 'sim') {
            return response()->json(['erro' => 'Falta a confirmação (confirmar=sim).'], 400);
        }
        $qtd = RedeGeo::apagarCamada($c);
        Auditoria::registrar('apagar_tudo', "camadas/{$camada}", null, $eu->id, ['alimentadores' => $qtd], $r->ip());

        return response()->json(['camada' => $camada, 'apagados' => $qtd]);
    }

    public function destroyAlimentador(Request $r, string $camada, string $chave): JsonResponse
    {
        $eu = $r->user();
        if (! $eu->pode('manutencao', 'importar')) {
            return response()->json(['erro' => 'Sem permissão para apagar camadas de rede.'], 403);
        }
        if (! $c = RedeGeo::CAMADAS[$camada] ?? null) {
            return response()->json(['erro' => "Camada de rede desconhecida: {$camada}"], 400);
        }
        if (! DB::table('rede_alimentadores')->where('camada', $c)->where('alimentador', $chave)->exists()) {
            return response()->json(['erro' => "Alimentador {$chave} não encontrado na camada."], 404);
        }
        $n = RedeGeo::apagarAlimentador($c, $chave);
        Auditoria::registrar('excluir', "camadas/{$camada}", $chave, $eu->id, ['trechos' => $n], $r->ip());

        return response()->json(['ok' => true]);
    }

    /** A camada inteira num GeoJSON so (em fluxo: a MT passa de 100 MB). Reimportavel pela propria aba. */
    public function exportar(Request $r, string $camada): Response
    {
        if (! $r->user()->pode('manutencao', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para ver as camadas de rede.'], 403);
        }
        if (! $c = RedeGeo::CAMADAS[$camada] ?? null) {
            return response()->json(['erro' => "Camada de rede desconhecida: {$camada}"], 400);
        }
        Auditoria::registrar('exportar', "camadas/{$camada}", null, $r->user()->id, [], $r->ip());
        $nomes = [];
        foreach (RedeGeo::lista($c) as $a) {
            $nomes[$a['ctmt']] = $a['nome'];
        }

        return response()->stream(function () use ($c, $camada, $nomes) {
            @set_time_limit(0);
            echo '{"type":"FeatureCollection","name":'.json_encode($camada).',"features":[';
            $primeiro = true;
            foreach ($nomes as $alim => $nome) {
                $extra = json_encode(['_alimentador' => (string) $alim, '_alimentadorNome' => $nome], JSON_UNESCAPED_UNICODE);
                $linhas = DB::select("SELECT json_build_object('type', 'Feature', 'properties', atributos || ?::jsonb,
                        'geometry', ST_AsGeoJSON(geom, 15)::json)::text AS f FROM rede_feicoes WHERE camada = ? AND alimentador = ? ORDER BY id", [$extra, $c, (string) $alim]);
                foreach ($linhas as $l) {
                    echo ($primeiro ? '' : ','), $l->f;
                    $primeiro = false;
                }
            }
            echo ']}';
        }, 200, ['Content-Type' => 'application/geo+json; charset=utf-8', 'Cache-Control' => 'no-store']);
    }

    /** Grava (substitui) UM alimentador. O navegador le os .geojson e manda um alimentador por vez. */
    public function importarAlimentador(Request $r, string $camada): JsonResponse
    {
        $eu = $r->user();
        if (! ($eu->pode('manutencao', 'importar') && $eu->pode('manutencao', 'editar'))) {
            return response()->json(['erro' => 'Sem permissão para importar camadas de rede (precisa poder importar e editar).'], 403);
        }
        if (! $c = RedeGeo::CAMADAS[$camada] ?? null) {
            return response()->json(['erro' => "Camada de rede desconhecida: {$camada}"], 400);
        }
        $alim = trim((string) $r->input('alimentador', ''));
        if ($alim === '' || mb_strlen($alim) > 120) {
            return response()->json(['erro' => 'Informe o alimentador (nome do arquivo).'], 400);
        }
        // corpo cru: o Laravel troca "" por null em toda a entrada, e os atributos da BDGD tem que chegar intactos
        $corpo = json_decode($r->getContent(), true);
        $features = is_array($corpo) ? ($corpo['features'] ?? null) : null;
        if (! is_array($features)) {
            return response()->json(['erro' => 'O arquivo não tem "features" (não é um GeoJSON).'], 400);
        }
        $nomes = $r->input('nomes');
        try {
            $res = RedeGeo::gravarAlimentador($c, $alim, array_values($features), $r->input('nome') ? (string) $r->input('nome') : null,
                is_array($nomes) ? array_map('strval', $nomes) : null, $r->input('metros'));
        } catch (\Illuminate\Database\QueryException $e) {
            return response()->json(['erro' => "Geometria inválida em {$alim}: ".mb_substr($e->getPrevious()?->getMessage() ?? $e->getMessage(), 0, 200)], 400);
        }
        Auditoria::registrar('importar', "camadas/{$camada}", $alim, $eu->id, $res, $r->ip());

        return response()->json($res + ['alimentador' => $alim]);
    }
}
