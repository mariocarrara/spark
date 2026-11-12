<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Camadas vetoriais do mapa (o que no legado era a pasta geo/): Rede MT/BT/AT, Reserva Legal e APP.
 * Cada alimentador (CTMT) de cada camada e um conjunto de feicoes em rede_feicoes + uma linha em rede_alimentadores
 * (o antigo _index.json: nome, trechos, metros). O mapa recebe o MESMO GeoJSON que o legado entregava do disco.
 */
class RedeGeo
{
    /** nome da camada no front/Gestao de Bases => codigo curto no banco */
    public const CAMADAS = ['rede_media_tensao' => 'mt', 'rede_baixa_tensao' => 'bt', 'rede_alta_tensao' => 'at', 'reserva_legal' => 'rl', 'app' => 'app'];

    /** pasta do legado (geo/<pasta>) => codigo */
    public const PASTAS = ['rede_mt' => 'mt', 'rede_bt' => 'bt', 'rede_at' => 'at', 'reserva_legal' => 'rl', 'app' => 'app'];

    public const SEM_ALIMENTADOR = '_sem_alimentador';

    private const LOTE = 400;

    /**
     * Grava (substitui) um alimentador de uma camada. $features = lista de Feature do GeoJSON.
     * Retorna ['trechos' => gravadas, 'semGeometria' => puladas].
     */
    public static function gravarAlimentador(string $camada, string $alimentador, array $features, ?string $nome = null, ?array $nomes = null, $metros = null): array
    {
        $linhas = [];
        $sem = 0;
        $somaComp = 0.0;
        $nomesVistos = [];
        foreach ($features as $f) {
            $g = is_array($f) ? ($f['geometry'] ?? null) : null;
            if (! is_array($g) || empty($g['type']) || ! isset($g['coordinates'])) {
                $sem++;

                continue;
            }
            $p = is_array($f['properties'] ?? null) ? $f['properties'] : [];
            unset($p['_alimentador'], $p['_alimentadorNome']);   // colunas extras da exportacao do sistema novo
            // DBF da BDGD traz campo vazio preenchido com caractere nulo; o Postgres nao aceita \u0000 em JSONB
            array_walk_recursive($p, function (&$v) {
                if (is_string($v) && str_contains($v, "\0")) {
                    $v = str_replace("\0", '', $v);
                }
            });
            if (isset($p['COMP']) && is_numeric(str_replace(',', '.', (string) $p['COMP']))) {
                $somaComp += (float) str_replace(',', '.', (string) $p['COMP']);
            }
            $n = trim((string) ($p['CT_COD_OP'] ?? ''));
            if ($n !== '') {
                $nomesVistos[$n] = ($nomesVistos[$n] ?? 0) + 1;
            }
            $linhas[] = [json_encode($p ?: new \stdClass, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE), json_encode($g)];
        }

        DB::transaction(function () use ($camada, $alimentador, $linhas, $nome, $nomes, $metros, $somaComp, $nomesVistos) {
            DB::table('rede_feicoes')->where('camada', $camada)->where('alimentador', $alimentador)->delete();
            foreach (array_chunk($linhas, self::LOTE) as $bloco) {
                $vals = [];
                $bind = [];
                foreach ($bloco as [$atr, $geo]) {
                    $vals[] = '(?, ?, ?::jsonb, ST_SetSRID(ST_GeomFromGeoJSON(?), 4326))';
                    array_push($bind, $camada, $alimentador, $atr, $geo);
                }
                DB::insert('INSERT INTO rede_feicoes (camada, alimentador, atributos, geom) VALUES '.implode(',', $vals), $bind);
            }
            if ($nome === null || $nome === '') {
                arsort($nomesVistos);
                $nome = $nomesVistos ? (string) array_key_first($nomesVistos) : $alimentador;
            }
            if ($nomes === null && count($nomesVistos) > 1) {
                $nomes = array_keys($nomesVistos);
            }
            $ehRede = in_array($camada, ['mt', 'bt', 'at'], true);
            DB::table('rede_alimentadores')->upsert([[
                'camada' => $camada, 'alimentador' => $alimentador, 'nome' => mb_substr($nome, 0, 200),
                'nomes' => $nomes ? json_encode(array_values($nomes), JSON_UNESCAPED_UNICODE) : null,
                'trechos' => count($linhas),
                'metros' => $ehRede ? (is_numeric($metros) ? round((float) $metros, 1) : round($somaComp, 1)) : null,
                'atualizado_em' => now(),
            ]], ['camada', 'alimentador'], ['nome', 'nomes', 'trechos', 'metros', 'atualizado_em']);
        });

        return ['trechos' => count($linhas), 'semGeometria' => $sem];
    }

    public static function apagarAlimentador(string $camada, string $alimentador): int
    {
        return DB::transaction(function () use ($camada, $alimentador) {
            DB::table('rede_alimentadores')->where('camada', $camada)->where('alimentador', $alimentador)->delete();

            return DB::table('rede_feicoes')->where('camada', $camada)->where('alimentador', $alimentador)->delete();
        });
    }

    public static function apagarCamada(string $camada): int
    {
        return DB::transaction(function () use ($camada) {
            $n = DB::table('rede_alimentadores')->where('camada', $camada)->delete();
            DB::statement('DELETE FROM rede_feicoes WHERE camada = ?', [$camada]);

            return $n;
        });
    }

    /**
     * Lista {ctmt, nome} de uma camada, com a regra de nome do legado (Get-AlimentadoresDisponiveisResumo):
     * varios nomes -> "A / B"; sem nome (ou nome = codigo) -> nome da Rede MT do mesmo CTMT; _sem_alimentador -> "(sem alimentador)".
     */
    public static function lista(string $camada): array
    {
        $mt = $camada === 'mt' ? [] : DB::table('rede_alimentadores')->where('camada', 'mt')->pluck('nome', 'alimentador')->all();
        $saida = [];
        foreach (DB::table('rede_alimentadores')->where('camada', $camada)->orderBy('alimentador')->get() as $a) {
            $nome = $a->nome;
            $nomes = $a->nomes ? json_decode($a->nomes, true) : [];
            if (count($nomes) > 1) {
                $nome = implode(' / ', $nomes);
            }
            if (($nome === null || trim($nome) === '' || $nome === $a->alimentador) && ! empty($mt[$a->alimentador])) {
                $nome = $mt[$a->alimentador];
            }
            if ($a->alimentador === self::SEM_ALIMENTADOR) {
                $nome = '(sem alimentador)';
            }
            $saida[] = ['ctmt' => $a->alimentador, 'nome' => $nome ?: $a->alimentador, 'trechos' => (int) $a->trechos];
        }

        return $saida;
    }

    /** JSON (texto) da lista de Features de um alimentador, na ordem em que foram gravadas. */
    public static function featuresJson(string $camada, string $alimentador): ?string
    {
        if (! DB::table('rede_alimentadores')->where('camada', $camada)->where('alimentador', $alimentador)->exists()) {
            return null;
        }

        return (string) DB::selectOne("SELECT coalesce(json_agg(json_build_object('type', 'Feature', 'properties', atributos,
                'geometry', ST_AsGeoJSON(geom, 15)::json) ORDER BY id), '[]')::text AS j
            FROM rede_feicoes WHERE camada = ? AND alimentador = ?", [$camada, $alimentador])->j;
    }

    /** O GeoJSON do alimentador como o legado gravava no disco (FeatureCollection). */
    public static function featureCollectionJson(string $camada, string $alimentador): ?string
    {
        $f = self::featuresJson($camada, $alimentador);

        return $f === null ? null : '{"type":"FeatureCollection","name":'.json_encode($alimentador).',"features":'.$f.'}';
    }

    /** Resumo de km (Visao Geral) — mesma forma do Get-ResumoKmDeRede; por cidade = polo do alimentador (MT). */
    public static function resumoKm(): array
    {
        $porCamada = ['mt' => 0.0, 'bt' => 0.0, 'at' => 0.0];
        foreach (DB::table('rede_alimentadores')->whereIn('camada', ['mt', 'bt', 'at'])->groupBy('camada')
            ->selectRaw('camada, coalesce(sum(metros), 0) AS m')->get() as $l) {
            $porCamada[$l->camada] = (float) $l->m;
        }
        $polo = [];
        foreach (DB::table('alimentador_polo')->whereNotNull('polo')->get() as $x) {
            $polo[$x->alimentador] = $x->polo;
        }
        $porCidade = [];
        $semMun = 0.0;
        foreach (DB::table('rede_alimentadores')->where('camada', 'mt')->get(['nome', 'metros']) as $a) {
            $m = (float) $a->metros;
            if ($a->nome !== null && isset($polo[$a->nome])) {
                $porCidade[$polo[$a->nome]] = ($porCidade[$polo[$a->nome]] ?? 0) + $m;
            } else {
                $semMun += $m;
            }
        }
        arsort($porCidade);
        $cidades = [];
        foreach ($porCidade as $mun => $m) {
            $cidades[] = ['municipio' => $mun, 'km' => round($m / 1000, 2)];
        }

        return [
            'porCamadaKm' => ['mt' => round($porCamada['mt'] / 1000, 2), 'bt' => round($porCamada['bt'] / 1000, 2), 'at' => round($porCamada['at'] / 1000, 2)],
            'btAtIlustrativo' => ! DB::table('rede_alimentadores')->whereIn('camada', ['bt', 'at'])->exists(),
            'porCidadeKm' => $cidades,
            'naoIdentificadoKm' => round($semMun / 1000, 2),
        ];
    }

    /** Carrega uma pasta geo/ do legado inteira (linha de comando). $aviso recebe o progresso. */
    public static function importarPasta(string $pasta, ?callable $aviso = null): array
    {
        $tot = [];
        foreach (self::PASTAS as $sub => $camada) {
            $dir = $pasta.DIRECTORY_SEPARATOR.$sub;
            if (! is_dir($dir)) {
                continue;
            }
            $indice = self::lerJson($dir.DIRECTORY_SEPARATOR.'_index.json') ?: [];
            $arquivos = glob($dir.DIRECTORY_SEPARATOR.'*.geojson') ?: [];
            self::apagarCamada($camada);
            $tot[$camada] = ['alimentadores' => 0, 'trechos' => 0, 'semGeometria' => 0];
            foreach ($arquivos as $arq) {
                $alim = basename($arq, '.geojson');
                $geo = self::lerJson($arq);
                if (! is_array($geo)) {
                    $aviso && $aviso("  AVISO: {$sub}/".basename($arq).' nao e um GeoJSON valido; ignorado');

                    continue;
                }
                $e = $indice[$alim] ?? null;
                $nome = is_string($e) ? $e : (is_array($e) ? ($e['nome'] ?? null) : null);
                $nomes = is_array($e) && ! empty($e['nomes']) ? (array) $e['nomes'] : null;
                $metros = is_array($e) ? ($e['metros'] ?? null) : null;
                $r = self::gravarAlimentador($camada, $alim, (array) ($geo['features'] ?? []), $nome, $nomes, $metros);
                $tot[$camada]['alimentadores']++;
                $tot[$camada]['trechos'] += $r['trechos'];
                $tot[$camada]['semGeometria'] += $r['semGeometria'];
            }
            $aviso && $aviso(sprintf('  %-4s %4d alimentadores %8d feicoes', $camada, $tot[$camada]['alimentadores'], $tot[$camada]['trechos']));
        }

        return $tot;
    }

    public static function lerJson(string $arq)
    {
        if (! is_file($arq)) {
            return null;
        }
        $t = file_get_contents($arq);
        if (strncmp($t, "\xEF\xBB\xBF", 3) === 0) {
            $t = substr($t, 3);
        }

        return json_decode($t, true, 512, JSON_INVALID_UTF8_SUBSTITUTE);
    }
}
