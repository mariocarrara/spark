<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * OS x APP / Reserva Legal (lib/AppRl.ps1 do legado), feito no PostGIS.
 * Para cada OS com posicao confiavel (nao aproximada) mede a distancia em METROS ate a divisa do poligono
 * de APP e de RL mais proximo: negativa = DENTRO (profundidade ate a divisa); positiva = fora.
 * So guarda as OS dentro ou a ate MAX_M. A tolerancia (ex.: 15 m) e so uma regua aplicada no navegador.
 *
 * Mesma conta do C# do legado: so o contorno EXTERNO de cada poligono; metros por projecao local
 * (x = dLng * 111320 * cos(lat), y = dLat * 110540). Velocidade: contornos e poligonos quebrados em pedacos
 * de ate 64 vertices com indice espacial (os poligonos de APP chegam a 81 mil vertices).
 */
class AppRl
{
    public const MAX_M = 100;

    public const TOL_PADRAO = 15;

    /** Recalcula o indice inteiro (~50 s com a base real). Devolve o resumo; nunca lanca (quem chama e importacao). */
    public static function recalcular(): array
    {
        try {
            @set_time_limit(0);
            $t = microtime(true);
            $r = DB::transaction(function () {
                DB::statement('DROP TABLE IF EXISTS ar_partes, ar_pecas, ar_pts, ar_fora, ar_dentro_par, ar_dentro');
                $pol = "FROM rede_feicoes f WHERE f.camada IN ('app','rl') AND GeometryType(f.geom) = 'POLYGON'";
                DB::statement("CREATE TEMP TABLE ar_partes ON COMMIT DROP AS SELECT f.id AS pol, f.camada, ST_Subdivide(ST_ExteriorRing(f.geom), 64) AS g $pol");
                DB::statement('CREATE INDEX ON ar_partes USING GIST (g)');
                DB::statement("CREATE TEMP TABLE ar_pecas ON COMMIT DROP AS SELECT f.id AS pol, f.camada, ST_Subdivide(ST_MakePolygon(ST_ExteriorRing(f.geom)), 64) AS g $pol");
                DB::statement('CREATE INDEX ON ar_pecas USING GIST (g)');
                DB::statement('CREATE TEMP TABLE ar_pts ON COMMIT DROP AS SELECT trim(id) AS id, loc, ST_Y(loc) AS lat, ST_X(loc) AS lng, 111320 * cos(radians(ST_Y(loc))) AS mx
                    FROM os WHERE loc IS NOT NULL AND NOT loc_aproximada');
                DB::statement('CREATE INDEX ON ar_pts USING GIST (loc)');
                DB::unprepared('ANALYZE ar_partes; ANALYZE ar_pecas; ANALYZE ar_pts');
                // fora: menor distancia ate um pedaco de contorno a ate ~150 m (o filtro final e MAX_M)
                DB::statement('CREATE TEMP TABLE ar_fora ON COMMIT DROP AS SELECT p.id, q.camada,
                    min(ST_Distance(ST_Scale(ST_Translate(q.g, -p.lng, -p.lat), p.mx, 110540), ST_SetSRID(ST_Point(0, 0), 4326))) AS d
                    FROM ar_pts p JOIN ar_partes q ON q.g && ST_Expand(p.loc, 0.0015) GROUP BY p.id, q.camada');
                // dentro: a OS cai num pedaco do poligono; profundidade = maior distancia ate a divisa entre os poligonos que a contem
                DB::statement('CREATE TEMP TABLE ar_dentro_par ON COMMIT DROP AS SELECT DISTINCT p.id, pc.pol, pc.camada FROM ar_pts p JOIN ar_pecas pc ON pc.g && p.loc AND ST_Covers(pc.g, p.loc)');
                // profundidade exata em metros: a distancia em graus ate o contorno limita a busca (raio = graus * 110540 / mx)
                // e a conta em metros e feita so nos pedacos do contorno desse poligono dentro do raio
                DB::statement('CREATE TEMP TABLE ar_dentro ON COMMIT DROP AS SELECT x.id, x.camada, max(x.dm) AS d FROM (
                    SELECT d.id, d.camada, (SELECT min(ST_Distance(ST_Scale(ST_Translate(q.g, -p.lng, -p.lat), p.mx, 110540), ST_SetSRID(ST_Point(0, 0), 4326)))
                        FROM ar_partes q WHERE q.pol = d.pol AND q.g && ST_Expand(p.loc, ST_Distance(ST_ExteriorRing(f.geom), p.loc) * 110540 / p.mx + 0.000001)) AS dm
                    FROM ar_dentro_par d JOIN ar_pts p ON p.id = d.id JOIN rede_feicoes f ON f.id = d.pol) x GROUP BY x.id, x.camada');
                DB::statement('DELETE FROM app_rl_indice');
                DB::statement("INSERT INTO app_rl_indice (os_id, app, rl)
                    SELECT id, max(v) FILTER (WHERE camada = 'app'), max(v) FILTER (WHERE camada = 'rl') FROM (
                        SELECT coalesce(dd.id, f.id) AS id, coalesce(dd.camada, f.camada) AS camada,
                            round(CASE WHEN dd.id IS NOT NULL THEN -dd.d ELSE f.d END::numeric, 1) AS v
                        FROM ar_dentro dd FULL JOIN ar_fora f ON f.id = dd.id AND f.camada = dd.camada
                        WHERE dd.id IS NOT NULL OR f.d <= ?
                    ) x GROUP BY id", [self::MAX_M]);
                $avaliadas = (int) DB::selectOne('SELECT count(*) AS n FROM ar_pts')->n;
                $total = (int) DB::selectOne('SELECT count(*) AS n FROM os')->n;
                $meta = ['geradoEm' => now()->toIso8601String(), 'maxM' => self::MAX_M, 'avaliadas' => $avaliadas, 'semPosicao' => $total - $avaliadas];
                DB::table('configuracoes')->upsert([['chave' => 'app_rl_indice', 'valor' => json_encode($meta), 'atualizado_em' => now(), 'atualizado_por' => null]],
                    ['chave'], ['valor', 'atualizado_em']);

                return $meta + ['noIndice' => (int) DB::selectOne('SELECT count(*) AS n FROM app_rl_indice')->n,
                    'poligonosApp' => DB::table('rede_feicoes')->where('camada', 'app')->count(), 'poligonosRl' => DB::table('rede_feicoes')->where('camada', 'rl')->count()];
            });

            return ['ok' => true, 'aviso' => null, 'segundos' => round(microtime(true) - $t, 1)] + $r;
        } catch (\Throwable $e) {
            report($e);

            return ['ok' => false, 'aviso' => 'Não foi possível calcular APP/RL: '.mb_substr($e->getMessage(), 0, 300)];
        }
    }

    /** O indice no formato do app_rl_indice.json (o navegador classifica dentro/borda/fora com a tolerancia). */
    public static function indiceJson(): string
    {
        $meta = json_decode((string) DB::table('configuracoes')->where('chave', 'app_rl_indice')->value('valor'), true);
        $alims = function (string $c) {
            $l = DB::table('rede_alimentadores')->where('camada', $c)->where('trechos', '>', 0)->pluck('alimentador')->all();
            usort($l, 'strcasecmp');

            return $l;
        };
        $cab = ['geradoEm' => $meta['geradoEm'] ?? null, 'maxM' => self::MAX_M, 'avaliadas' => $meta['avaliadas'] ?? 0, 'semPosicao' => $meta['semPosicao'] ?? 0,
            'alimentadoresApp' => $alims('app'), 'alimentadoresRl' => $alims('rl')];
        $os = (string) DB::selectOne("SELECT coalesce(json_object_agg(os_id, json_build_array(app::float8, rl::float8)), '{}')::text AS j FROM app_rl_indice")->j;

        return substr(json_encode($cab, JSON_UNESCAPED_UNICODE), 0, -1).',"os":'.$os.'}';
    }

    public static function config(): array
    {
        $c = json_decode((string) DB::table('configuracoes')->where('chave', 'app_rl')->value('valor'), true) ?: [];
        $meta = json_decode((string) DB::table('configuracoes')->where('chave', 'app_rl_indice')->value('valor'), true) ?: [];
        $gerado = isset($meta['geradoEm']) ? Carbon::parse($meta['geradoEm'])->setTimezone(config('app.timezone'))->format('Y-m-d\TH:i:s') : null;

        return ['toleranciaM' => isset($c['toleranciaM']) ? (float) $c['toleranciaM'] : (float) self::TOL_PADRAO, 'toleranciaMax' => self::MAX_M,
            'atualizadoEm' => $c['atualizadoEm'] ?? null, 'atualizadoPor' => $c['atualizadoPor'] ?? null, 'indiceGeradoEm' => $gerado];
    }
}
