<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ListaOs;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/** /api/manutencao/* — Mapa de Manutencao (contrato de routes/manutencao.ps1). */
class ManutencaoController extends Controller
{
    /**
     * GET /api/manutencao/os — sem filtros (o que o front pede ao abrir) devolve o arquivo pronto e
     * compactado (ver ListaOs); com filtros, consulta direto.
     */
    public function os(Request $r): Response
    {
        if (! $r->user()->pode('manutencao', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para visualizar Manutenção.'], 403);
        }
        $filtros = array_filter($r->only(['status', 'equipe', 'prioridadeEW', 'dataInicio', 'dataFim']), fn ($v) => $v !== null && $v !== '');
        if ($filtros) {
            return response()->json(ListaOs::filtrada($filtros));
        }

        $arq = ListaOs::arquivoCompleto();
        $comGzip = str_contains(strtolower((string) $r->header('Accept-Encoding')), 'gzip');
        $cab = ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store', 'Vary' => 'Accept-Encoding'];
        if ($comGzip) {
            return response()->file($arq, $cab + ['Content-Encoding' => 'gzip']);
        }

        return response()->stream(function () use ($arq) {
            readgzfile($arq);
        }, 200, $cab);
    }

    /** alimentador -> polo/regional (filtros Polo/Regional do mapa). */
    public function localidadesMapa(Request $r): JsonResponse
    {
        if (! $r->user()->pode('manutencao', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para visualizar Manutenção.'], 403);
        }
        $porAlim = [];
        $regPorAlim = [];
        foreach (DB::table('alimentador_polo')->get() as $x) {
            if ($x->polo) {
                $porAlim[$x->alimentador] = $x->polo;
            }
            if ($x->regional) {
                $regPorAlim[$x->alimentador] = $x->regional;
            }
        }
        // municipio -> dados da localidade (D_Localidade, guardado intacto em legado_bruto)
        $porMun = [];
        $loc = json_decode((string) DB::table('legado_bruto')->where('entidade', 'localidades')->value('dados'), true) ?: [];
        foreach ($loc as $l) {
            foreach ([$l['polo'] ?? null, $l['polo2'] ?? null] as $chave) {
                if ($chave && ! isset($porMun[$chave])) {
                    $porMun[$chave] = ['regional' => $l['regional'] ?? null, 'coordenadorResponsavel' => $l['coordenadorResponsavel'] ?? null,
                        'supervisorResponsavel' => $l['supervisorResponsavel'] ?? null, 'pontoFocalResponsavel' => $l['pontoFocalResponsavel'] ?? null];
                }
            }
        }

        return response()->json(['porAlimentador' => (object) $porAlim, 'porMunicipio' => (object) $porMun, 'regionalPorAlimentador' => (object) $regPorAlim]);
    }

    /** Lista enxuta alimentador -> conjunto (sem os excluidos na Gestao de Bases). */
    public function conjuntosMapa(Request $r): JsonResponse
    {
        if (! $r->user()->pode('manutencao', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para visualizar conjuntos.'], 403);
        }
        $excl = DB::table('exclusoes')->where('base', 'conjuntos')->pluck('chave')->flip();
        $saida = [];
        foreach (DB::table('conjuntos')->orderBy('id')->get() as $c) {
            if (isset($excl[(string) $c->alimentador])) {
                continue;
            }
            $saida[] = ['a' => (string) $c->alimentador, 'n' => (string) $c->nome_conjunto, 'c' => (string) $c->cod_conjunto, 'r' => (string) $c->regional, 's' => (string) $c->sigla];
        }

        return response()->json($saida);
    }
}
