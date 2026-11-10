<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Lista de OS do Mapa de Manutencao no MESMO formato do manutencao_os.json do legado.
 *
 * Velocidade: o JSON e montado pelo proprio Postgres (json_build_object, linha a linha por cursor),
 * gravado JA compactado (gzip) em storage/app/cache e reaproveitado enquanto as OS nao mudarem
 * (chave = quantidade + ultima atualizacao). Nunca guarda as 113 mil OS na memoria do PHP.
 */
class ListaOs
{
    /** Expressao SQL que devolve 1 OS no formato do legado. */
    private const OBJETO = <<<'SQL'
json_strip_nulls(json_build_object(
  'id', id, 'origem', origem, 'osPrimaria', os_primaria, 'idVera', id_vera, 'statusOS', status_os, 'tipoServico', tipo_servico,
  'tipoEquipeNecessaria', tipo_equipe_necessaria, 'tipoEquipeExec', tipo_equipe_exec, 'prioridadeEW', prioridade_ew, 'equipeId', equipe_id,
  'dataAbertura', to_char(data_abertura, 'YYYY-MM-DD'), 'dataExecucao', to_char(data_execucao, 'YYYY-MM-DD'), 'dataPrevista', to_char(data_prevista, 'YYYY-MM-DD'),
  'alimentador', alimentador, 'conjunto', conjunto, 'protecaoId', protecao_id, 'trecho', trecho, 'localidade', localidade,
  'descEsquema', desc_esquema, 'observacao', observacao,
  'localizacao', CASE WHEN loc IS NULL THEN NULL ELSE json_build_object('lat', ST_Y(loc), 'lng', ST_X(loc), 'fonte', loc_fonte, 'aproximada', loc_aproximada, 'origem', loc_origem) END,
  'previsto', previsto::float8, 'realizado', realizado::float8, 'previstoPoda', previsto_poda::float8, 'previstoLimpeza', previsto_limpeza::float8,
  'previstoEstrutura', previsto_estrutura::float8, 'realizadoPoda', realizado_poda::float8, 'realizadoLimpeza', realizado_limpeza::float8,
  'realizadoEstrutura', realizado_estrutura::float8,
  'posteId', poste_id, 'posteTipo', poste_tipo, 'posteAreaLocal', poste_area_local, 'posteConjunto', poste_conjunto, 'posteMun', poste_mun,
  'posteLat', ST_Y(poste_loc), 'posteLng', ST_X(poste_loc), 'previstoPorEsquema', previsto_por_esquema, 'localidadePorPoste', localidade_por_poste
))
SQL;

    /** Caminho do .json.gz pronto da lista completa (gera se nao existir ou se as OS mudaram). */
    public static function arquivoCompleto(): string
    {
        $v = DB::selectOne('SELECT count(*) AS n, coalesce(max(atualizado_em)::text, \'\') AS m FROM os');
        $chave = md5($v->n.'|'.$v->m);
        $dir = storage_path('app'.DIRECTORY_SEPARATOR.'cache');
        $arq = $dir.DIRECTORY_SEPARATOR."os_{$chave}.json.gz";
        if (is_file($arq)) {
            return $arq;
        }
        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        // gera num temporario e troca de uma vez (outro pedido nunca le arquivo pela metade)
        $tmp = $arq.'.'.bin2hex(random_bytes(4)).'.tmp';
        self::gravarGz($tmp, '');
        rename($tmp, $arq);
        foreach (glob($dir.DIRECTORY_SEPARATOR.'os_*.json.gz') ?: [] as $velho) {
            if ($velho !== $arq) {
                @unlink($velho);
            }
        }

        return $arq;
    }

    /**
     * Lista filtrada (raro: o front pede a completa). Aplica o "Programada" das programacoes ativas no servidor,
     * como o legado fazia nas consultas com filtro.
     */
    public static function filtrada(array $f): array
    {
        $where = [];
        $p = [];
        if (! empty($f['equipe'])) {
            $where[] = 'equipe_id = ?';
            $p[] = $f['equipe'];
        }
        if (isset($f['prioridadeEW']) && $f['prioridadeEW'] !== '') {
            $where[] = 'prioridade_ew = ?';
            $p[] = in_array(strtolower((string) $f['prioridadeEW']), ['true', '1', 'sim'], true);
        }
        if (! empty($f['dataInicio'])) {
            $where[] = 'data_abertura >= ?';
            $p[] = substr($f['dataInicio'], 0, 10);
        }
        if (! empty($f['dataFim'])) {
            $where[] = 'data_abertura <= ?';
            $p[] = substr($f['dataFim'], 0, 10);
        }
        $sql = 'SELECT '.self::OBJETO.'::text AS j FROM os'.($where ? ' WHERE '.implode(' AND ', $where) : '');
        $programadas = DB::table('programacao_os')->join('programacoes', 'programacoes.id', '=', 'programacao_os.programacao_id')
            ->whereNotIn('programacoes.status', ['Cancelada', 'Concluída'])->pluck('os_id')->flip();
        $saida = [];
        foreach (DB::cursor($sql, $p) as $l) {
            $o = json_decode($l->j, true);
            if (isset($programadas[$o['id']]) && in_array($o['statusOS'], ['Pendente', 'A reprogramar'], true)) {
                $o['statusBase'] = $o['statusOS'];
                $o['statusOS'] = 'Programada';
            }
            if (! empty($f['status']) && $o['statusOS'] !== $f['status']) {
                continue;
            }
            $saida[] = $o;
        }

        return $saida;
    }

    private static function gravarGz(string $arquivo, string $where): void
    {
        // lotes de 5 mil por chave (o driver do Postgres traria tudo de uma vez num cursor comum)
        $gz = gzopen($arquivo, 'wb6');
        gzwrite($gz, '[');
        $primeiro = true;
        $ultimo = null;
        do {
            $lote = DB::select('SELECT id, '.self::OBJETO.'::text AS j FROM os WHERE ('.($ultimo === null ? 'true' : 'id > ?').')'.$where.' ORDER BY id LIMIT 5000',
                $ultimo === null ? [] : [$ultimo]);
            $buf = '';
            foreach ($lote as $l) {
                $buf .= ($primeiro ? '' : ',').$l->j;
                $primeiro = false;
                $ultimo = $l->id;
            }
            gzwrite($gz, $buf);
        } while (count($lote) === 5000);
        gzwrite($gz, ']');
        gzclose($gz);
    }
}
