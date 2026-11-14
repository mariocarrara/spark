<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use App\Services\Importacao\ImportadorGrids;
use App\Services\ListaOs;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Historico de podas por PLANO (01/nov do ano anterior a 31/out) — contrato de routes/historico.ps1:
 *   GET    /historico/planos                       planos guardados
 *   GET    /historico/os?plano=&q&status&tipo&alim&de&ate&pagina&porPagina  -> {itens,total,totalPlano,resumo,filtros,...}
 *   GET    /historico/exportar?plano=&...          CSV (;) para o Excel
 *   GET    /historico/mapa?plano=                  o plano inteiro no formato das OS (gzip) para o mapa
 *   DELETE /historico/planos/{plano}               apaga o plano (importar + editar)
 * Novo (Gestao de Bases > Historico): POST /historico/planos/{plano}/importar {modo, os:[...]} com o historico_podas_<plano>.json
 * do legado (ou o exportado = GET /historico/mapa). A carga normal continua sendo a das grids (POST /importacao/podas-historico).
 */
class HistoricoController extends Controller
{
    private function ver(Request $r): ?JsonResponse
    {
        return $r->user()->podeHistorico() ? null
            : response()->json(['erro' => 'Sem permissão para consultar o histórico de podas.'], 403);
    }

    private static function plano($v): ?int
    {
        return is_numeric($v) && (int) $v >= 2000 && (int) $v <= 2100 ? (int) $v : null;
    }

    public function planos(Request $r): JsonResponse
    {
        if ($x = $this->ver($r)) {
            return $x;
        }
        $iso = fn ($v) => $v ? Carbon::parse($v)->setTimezone(config('app.timezone'))->toIso8601String() : null;

        return response()->json(DB::table('historico_planos')->orderByDesc('plano')->get()->map(fn ($p) => [
            'plano' => (int) $p->plano, 'total' => (int) $p->total, 'inicio' => substr((string) $p->inicio, 0, 10), 'fim' => substr((string) $p->fim, 0, 10),
            'atualizadoEm' => $iso($p->atualizado_em), 'usuarioId' => $p->usuario_id, 'modo' => $p->modo,
            'novas' => $p->novas === null ? null : (int) $p->novas, 'atualizadas' => $p->atualizadas === null ? null : (int) $p->atualizadas, 'arquivos' => $p->arquivos,
        ])->values());
    }

    /** Filtros da consulta (mesmas regras do Get-HistoricoFiltrado: alimentador e texto sem diferenciar maiuscula). */
    private static function filtrar(Request $r, int $plano)
    {
        $q = DB::table('os_historico AS os')->where('os.plano', $plano);
        $t = fn ($k) => trim((string) $r->query($k, ''));
        $like = fn ($v) => '%'.addcslashes($v, '%_\\').'%';
        if ($t('status') !== '') {
            $q->where('os.status_os', $t('status'));
        }
        if ($t('tipo') !== '') {
            $q->where('os.tipo_servico', $t('tipo'));
        }
        if ($t('alim') !== '') {
            $q->where('os.alimentador', 'ilike', $like($t('alim')));
        }
        if ($t('de') !== '' || $t('ate') !== '') {
            $q->whereNotNull('os.data_execucao');
            $t('de') !== '' && $q->where('os.data_execucao', '>=', substr($t('de'), 0, 10));
            $t('ate') !== '' && $q->where('os.data_execucao', '<=', substr($t('ate'), 0, 10));
        }
        if ($t('q') !== '') {
            $v = $like($t('q'));
            $q->where(function ($w) use ($v) {
                foreach (['id', 'alimentador', 'localidade', 'trecho', 'poste_id', 'protecao_id', 'desc_esquema'] as $c) {
                    $w->orWhere("os.$c", 'ilike', $v);
                }
            });
        }

        return $q;
    }

    private function semPlano(int $plano): JsonResponse
    {
        return response()->json(['erro' => "O plano {$plano} ainda não foi enviado para o histórico."], 404);
    }

    public function os(Request $r): JsonResponse
    {
        if ($x = $this->ver($r)) {
            return $x;
        }
        if (! $plano = self::plano($r->query('plano'))) {
            return response()->json(['erro' => 'Informe o plano (ex.: ?plano=2026).'], 400);
        }
        $totalPlano = DB::table('os_historico')->where('plano', $plano)->count();
        if (! $totalPlano && ! DB::table('historico_planos')->where('plano', $plano)->exists()) {
            return $this->semPlano($plano);
        }
        $base = self::filtrar($r, $plano);
        $res = (clone $base)->selectRaw('count(*) AS n, coalesce(sum(previsto_poda),0) AS pp, coalesce(sum(realizado_poda),0) AS rp,
            coalesce(sum(realizado_limpeza),0) AS rl, coalesce(sum(realizado_estrutura),0) AS re')->first();
        $porStatus = (clone $base)->groupBy('os.status_os')->selectRaw('os.status_os AS s, count(*) AS n')->pluck('n', 's')->map(fn ($n) => (int) $n);
        $total = (int) $res->n;
        $porPag = min(200, max(10, (int) ($r->query('porPagina') ?: 50)));
        $paginas = max(1, (int) ceil($total / $porPag));
        $pag = min($paginas, max(1, (int) $r->query('pagina', 1)));
        $itens = (clone $base)->orderBy('os.id')->offset(($pag - 1) * $porPag)->limit($porPag)
            ->select('os.*', DB::raw('ST_Y(os.loc) AS lat'), DB::raw('ST_X(os.loc) AS lng'))->get()->map(fn ($o) => self::linha($o));
        $n = fn ($v) => round((float) $v, 2);

        return response()->json([
            'plano' => $plano, 'total' => $total, 'totalPlano' => $totalPlano, 'pagina' => $pag, 'porPagina' => $porPag, 'paginas' => $paginas,
            'itens' => $itens->values(),
            'resumo' => ['previstoPoda' => $n($res->pp), 'realizadoPoda' => $n($res->rp), 'realizadoLimpeza' => $n($res->rl), 'realizadoEstrutura' => $n($res->re),
                'porStatus' => (object) $porStatus->all()],
            'filtros' => [
                'status' => DB::table('os_historico')->where('plano', $plano)->whereNotNull('status_os')->distinct()->orderBy('status_os')->pluck('status_os'),
                'tipos' => DB::table('os_historico')->where('plano', $plano)->whereNotNull('tipo_servico')->distinct()->orderBy('tipo_servico')->pluck('tipo_servico'),
            ],
        ]);
    }

    private static function linha(object $o): array
    {
        $num = fn ($v) => $v === null ? null : (fmod((float) $v, 1.0) == 0.0 ? (int) $v : (float) $v);
        $d = fn ($v) => $v ? substr((string) $v, 0, 10) : null;

        return ['id' => (string) $o->id, 'statusOS' => $o->status_os, 'tipoServico' => $o->tipo_servico, 'dataAbertura' => $d($o->data_abertura), 'dataExecucao' => $d($o->data_execucao),
            'alimentador' => $o->alimentador, 'localidade' => $o->localidade, 'trecho' => $o->trecho, 'posteId' => $o->poste_id, 'equipeId' => $o->equipe_id,
            'descEsquema' => $o->desc_esquema, 'numObra' => $o->num_obra, 'recursoMo' => $o->recurso_mo, 'previstoPoda' => $num($o->previsto_poda), 'previstoLimpeza' => $num($o->previsto_limpeza),
            'previstoEstrutura' => $num($o->previsto_estrutura), 'realizadoPoda' => $num($o->realizado_poda), 'realizadoLimpeza' => $num($o->realizado_limpeza),
            'realizadoEstrutura' => $num($o->realizado_estrutura), 'lat' => $o->lat === null ? null : (float) $o->lat, 'lng' => $o->lng === null ? null : (float) $o->lng,
            'aproximada' => (bool) $o->loc_aproximada];
    }

    /** CSV (;) igual ao do legado: BOM, datas dd/mm/aaaa, numeros com virgula, ate 300 mil linhas. */
    public function exportar(Request $r): Response
    {
        if ($x = $this->ver($r)) {
            return $x;
        }
        if (! $plano = self::plano($r->query('plano'))) {
            return response()->json(['erro' => 'Informe o plano (ex.: ?plano=2026).'], 400);
        }
        if (! DB::table('historico_planos')->where('plano', $plano)->exists() && ! DB::table('os_historico')->where('plano', $plano)->exists()) {
            return $this->semPlano($plano);
        }
        $q = self::filtrar($r, $plano)->select('os.*', DB::raw('ST_Y(os.loc) AS lat'), DB::raw('ST_X(os.loc) AS lng'))->orderBy('os.id')->limit(300000);

        return response()->stream(function () use ($q) {
            echo "\u{FEFF}OS;Status;Servico;Abertura;Execucao;Alimentador;Localidade;Trecho;Poste;Esquema;Previsto poda;Realizado poda;Previsto limpeza (m2);Realizado limpeza (m2);Previsto estrutura;Realizado estrutura;Latitude;Longitude;Posicao aproximada\r\n";
            $txt = fn ($v) => preg_match('/[;"\r\n]/', (string) $v) ? '"'.str_replace('"', '""', (string) $v).'"' : (string) $v;
            $dt = fn ($v) => strlen((string) $v) >= 10 ? substr($v, 8, 2).'/'.substr($v, 5, 2).'/'.substr($v, 0, 4) : (string) $v;
            $num = fn ($v, $c) => $v === null ? '' : str_replace('.', ',', rtrim(rtrim(number_format((float) $v, $c, '.', ''), '0'), '.'));
            foreach ($q->lazy(5000) as $o) {
                $cols = [$txt(trim((string) $o->id)), $txt($o->status_os), $txt($o->tipo_servico), $dt($o->data_abertura), $dt($o->data_execucao), $txt($o->alimentador),
                    $txt($o->localidade), $txt($o->trecho), $txt($o->poste_id), $txt($o->desc_esquema)];
                foreach (['previsto_poda', 'realizado_poda', 'previsto_limpeza', 'realizado_limpeza', 'previsto_estrutura', 'realizado_estrutura'] as $c) {
                    $cols[] = $num($o->$c, 2);
                }
                $cols[] = $o->lat === null ? '' : $num($o->lat, 6);
                $cols[] = $o->lng === null ? '' : $num($o->lng, 6);
                $cols[] = $o->loc_aproximada ? 'sim' : '';
                echo implode(';', $cols), "\r\n";
            }
        }, 200, ['Content-Type' => 'text/csv; charset=utf-8', 'Cache-Control' => 'no-store']);
    }

    /** O plano inteiro no formato das OS (o mesmo do historico_podas_<plano>.json), gzip em cache enquanto o plano nao muda. */
    public function mapa(Request $r): Response
    {
        if ($x = $this->ver($r)) {
            return $x;
        }
        if (! $plano = self::plano($r->query('plano'))) {
            return response()->json(['erro' => 'Informe o plano (ex.: ?plano=2025).'], 400);
        }
        $v = DB::selectOne('SELECT count(*) AS n, coalesce(max(atualizado_em)::text, \'\') AS m FROM os_historico WHERE plano = ?', [$plano]);
        if (! $v->n && ! DB::table('historico_planos')->where('plano', $plano)->exists()) {
            return $this->semPlano($plano);
        }
        $marca = (string) DB::table('historico_planos')->where('plano', $plano)->value('atualizado_em');
        $dir = storage_path('app'.DIRECTORY_SEPARATOR.'cache');
        $arq = $dir.DIRECTORY_SEPARATOR."hist_{$plano}_".md5($v->n.'|'.$v->m.'|'.$marca).'.json.gz';
        if (! is_file($arq)) {
            is_dir($dir) || mkdir($dir, 0775, true);
            $tmp = $arq.'.'.bin2hex(random_bytes(4)).'.tmp';
            $gz = gzopen($tmp, 'wb6');
            gzwrite($gz, '[');
            $primeiro = true;
            $ultimo = null;
            do {
                $lote = DB::select('SELECT os.id, '.ListaOs::OBJETO.'::text AS j FROM os_historico os WHERE os.plano = ?'.($ultimo === null ? '' : ' AND os.id > ?').' ORDER BY os.id LIMIT 5000',
                    $ultimo === null ? [$plano] : [$plano, $ultimo]);
                foreach ($lote as $l) {
                    gzwrite($gz, ($primeiro ? '' : ',').$l->j);
                    $primeiro = false;
                    $ultimo = $l->id;
                }
            } while (count($lote) === 5000);
            gzwrite($gz, ']');
            gzclose($gz);
            rename($tmp, $arq);
            foreach (glob($dir.DIRECTORY_SEPARATOR."hist_{$plano}_*.json.gz") ?: [] as $velho) {
                $velho !== $arq && @unlink($velho);
            }
        }
        $cab = ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store', 'Vary' => 'Accept-Encoding'];
        if (str_contains(strtolower((string) $r->header('Accept-Encoding')), 'gzip')) {
            return response()->file($arq, $cab + ['Content-Encoding' => 'gzip']);
        }

        return response()->stream(fn () => readgzfile($arq), 200, $cab);
    }

    private function podeEscrever(Request $r, string $msg): ?JsonResponse
    {
        $eu = $r->user();

        return ($eu->pode('manutencao', 'importar') && $eu->pode('manutencao', 'editar')) ? null : response()->json(['erro' => $msg], 403);
    }

    public function apagarPlano(Request $r, string $plano): JsonResponse
    {
        if ($x = $this->podeEscrever($r, 'Sem permissão para apagar um plano do histórico (precisa poder importar e editar).')) {
            return $x;
        }
        if (! $p = self::plano($plano)) {
            return response()->json(['erro' => 'Plano inválido.'], 400);
        }
        if (! DB::table('historico_planos')->where('plano', $p)->exists() && ! DB::table('os_historico')->where('plano', $p)->exists()) {
            return response()->json(['erro' => "O plano {$p} não está no histórico."], 404);
        }
        DB::transaction(function () use ($p, $r) {
            DB::table('os_historico')->where('plano', $p)->delete();
            DB::table('historico_planos')->where('plano', $p)->delete();
            DB::table('importacoes_log')->insert(['id' => (string) Str::uuid(), 'data_hora' => now(), 'usuario_id' => $r->user()->id,
                'base' => "Podas — Histórico (plano {$p} apagado)", 'arquivo_origem' => '', 'registros_processados' => 0, 'registros_com_erro' => 0]);
        });
        Auditoria::registrar('apagar', 'historico', (string) $p, $r->user()->id, [], $r->ip());

        return response()->json(['ok' => true, 'plano' => $p]);
    }

    /** Gestao de Bases > Historico: grava um plano a partir do JSON no formato das OS (em pedacos: o 1o substitui, os outros acrescentam). */
    public function importarPlano(Request $r, string $plano): JsonResponse
    {
        if ($x = $this->podeEscrever($r, 'Sem permissão para importar o histórico (precisa poder importar e editar).')) {
            return $x;
        }
        if (! $p = self::plano($plano)) {
            return response()->json(['erro' => 'Plano inválido (ex.: 2025).'], 400);
        }
        $corpo = json_decode($r->getContent(), true);
        $os = is_array($corpo) ? ($corpo['os'] ?? null) : null;
        if (! is_array($os) || ! $os || count($os) > 20000) {
            return response()->json(['erro' => 'Envie de 1 a 20000 OS por pedaço.'], 400);
        }
        @set_time_limit(600);
        $modo = ($corpo['modo'] ?? '') === 'acrescentar' ? 'acrescentar' : 'substituir';
        $res = (new ImportadorGrids)->historicoDeOs($p, $modo, array_values($os), $r->user()->id, mb_substr((string) ($corpo['arquivo'] ?? ''), 0, 200));
        Auditoria::registrar('importar', 'historico', (string) $p, $r->user()->id, ['modo' => $modo, 'os' => count($os)], $r->ip());

        return response()->json($res + ['plano' => $p]);
    }
}
