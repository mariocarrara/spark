<?php

namespace App\Services\Importacao;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Bases grandes da Importacao de Bases, lidas do .xlsx no servidor (Invoke-BaseGrandeStreamingUpload / Invoke-VeraStreamingUpload):
 *  - vao():      d.Vao.xlsx (~793 mil linhas). SUBSTITUI `vao` (1 por Protecao: postes e Rota km somados, Polo/Regional da 1a linha)
 *                e `vao_postes` (Rota km da 1a linha de cada "Poste 1": e o [Vão (km)] da Poda linear). Depois refaz alimentador_polo.
 *  - protecao(): d.Protecao.xlsx (~214 mil). SUBSTITUI `protecoes` (1 por ELEMENTO, linhas repetidas fundidas campo a campo)
 *                e `protecao_alimentador` (PROT. ELEMENTO 2 x ALIMENTADOR). Depois refaz alimentador_polo.
 *  - vera():     arvores da VERA. JUNTA pela chave ID arvore (as que ja existem sao atualizadas, as demais ficam).
 * Registros "excluidos" na Gestao de Bases continuam marcados (a flag e por chave, fora da tabela).
 */
class ImportadorBasesGrandes
{
    /** @var callable|null */
    private $avisar;

    public function __construct(?callable $avisar = null)
    {
        $this->avisar = $avisar;
    }

    private function aviso(array $p): void
    {
        $this->avisar && ($this->avisar)($p);
    }

    /** Vazio, "#N/A" e "Sem" viram null (Limpar do legado). */
    private static function limpar($v): ?string
    {
        $t = trim((string) $v);

        return ($t === '' || strcasecmp($t, '#N/A') === 0 || strcasecmp($t, 'Sem') === 0) ? null : $t;
    }

    /** ConvertTo-DoubleSeguro: virgula vira ponto; texto que nao e numero -> null. */
    private static function numero($v): ?float
    {
        $t = str_replace(',', '.', trim((string) $v));

        return ($t !== '' && is_numeric($t)) ? (float) $t : null;
    }

    private function ler(string $arq, array $cols, string $nome): array
    {
        $leitor = new LeitorXlsx($arq, $cols);
        $gen = $leitor->linhas(fn ($l, $t) => $this->aviso(['fase' => 'lendo-vera', 'arquivo' => $nome, 'linha' => $l]
            + ($t ? ['total' => $t, 'percentual' => min(99, round(100 * $l / $t, 1))] : [])));

        return [$leitor, $gen];
    }

    private function faltando(LeitorXlsx $l, array $obrig, array $cols, string $base): void
    {
        $falta = array_values(array_diff($obrig, $l->encontradas));
        if ($falta) {
            throw new RuntimeException("O cabeçalho não bate com a base {$base}: faltou a coluna ".implode(', ', $falta).'. Colunas esperadas: '.implode(' | ', $cols).'.');
        }
    }

    // ------------------------------------------------------------------ Vao

    public function vao(string $arq, string $nome): array
    {
        $cols = ['Poste 1', 'Proteção', 'Regional', 'Polo', 'Rota (km)'];
        [$leitor, $gen] = $this->ler($arq, $cols, $nome);
        $agg = [];        // chave em maiusculas (OrdinalIgnoreCase), vale a 1a grafia
        $postes = [];     // poste -> km (1a linha)
        $lidas = $semChave = 0;
        foreach ($gen as $r) {
            $lidas++;
            $prot = self::limpar($r['Proteção'] ?? null);
            $poste = self::limpar($r['Poste 1'] ?? null);
            if ($poste !== null) {
                $pk = $poste;
                if (str_ends_with($pk, '.0')) {
                    $pk = substr($pk, 0, -2);
                }
                if (str_starts_with($pk, '218-')) {
                    $pk = substr($pk, 4);
                }
                if ($pk !== '' && $pk !== '0' && ! isset($postes[$pk]) && ($km = self::numero($r['Rota (km)'] ?? null)) !== null) {
                    $postes[$pk] = $km;
                }
            }
            if ($prot === null || $poste === null) {
                $semChave++;

                continue;
            }
            $k = mb_strtoupper($prot);
            $a = &$agg[$k];
            $a ??= ['protecao_id' => $prot, 'polo' => null, 'regional' => null, 'postes' => 0, 'rota_km' => 0.0];
            $a['postes']++;
            if (($km = self::numero($r['Rota (km)'] ?? null)) !== null) {
                $a['rota_km'] += $km;
            }
            $a['polo'] ??= self::limpar($r['Polo'] ?? null);
            $a['regional'] ??= self::limpar($r['Regional'] ?? null);
            unset($a);
        }
        $this->faltando($leitor, ['Poste 1', 'Proteção'], $cols, 'Vao');
        if (! $agg) {
            throw new RuntimeException('Nenhuma linha válida encontrada no arquivo (todas sem Poste 1 / Proteção).');
        }
        $this->aviso(['tipo' => 'progresso', 'fase' => 'salvando-json', 'total' => count($agg)]);
        DB::transaction(function () use ($agg, $postes) {
            DB::table('vao')->delete();
            foreach (array_chunk(array_values($agg), 2000) as $lote) {
                DB::table('vao')->insert($lote);
            }
            DB::table('vao_postes')->delete();
            $linhas = [];
            foreach ($postes as $p => $km) {
                $linhas[] = ['poste_id' => (string) $p, 'rota_km' => $km];
                if (count($linhas) === 5000) {
                    DB::table('vao_postes')->insert($linhas);
                    $linhas = [];
                }
            }
            $linhas && DB::table('vao_postes')->insert($linhas);
        });
        $alimPolo = self::atualizarAlimentadorPolo();

        return ['totalLinhas' => $leitor->linhasLidas, 'processados' => count($agg), 'totalErros' => $semChave,
            'resumo' => ['linhasLidas' => $lidas, 'registrosGravados' => count($agg), 'linhasSemChave' => $semChave, 'coordenadasInvalidas' => 0,
                'alimentadoresComPolo' => $alimPolo, 'postesComVao' => count($postes)]];
    }

    // ------------------------------------------------------------------ Protecao

    public function protecao(string $arq, string $nome): array
    {
        $cols = ['ELEMENTO', 'PROT. ELEMENTO', 'PROT. ELEMENTO 2', 'ALIMENTADOR', 'ZONA', 'LAT', 'LONG', 'TRECHO', 'TRECHO COM T4', 'PLANO EASY WORK'];
        [$leitor, $gen] = $this->ler($arq, $cols, $nome);
        $mapa = ['prot_elemento' => 'PROT. ELEMENTO', 'protecao2' => 'PROT. ELEMENTO 2', 'alimentador' => 'ALIMENTADOR', 'zona' => 'ZONA', 'trecho' => 'TRECHO',
            'trecho_t4' => 'TRECHO COM T4', 'plano_easywork' => 'PLANO EASY WORK'];
        $agg = [];
        $pares = [];
        $lidas = $semChave = $coordInv = 0;
        foreach ($gen as $r) {
            $lidas++;
            $id = self::limpar($r['ELEMENTO'] ?? null);
            if ($id === null) {
                $semChave++;

                continue;
            }
            $a = &$agg[$id];
            $a ??= ['protecao_id' => $id, 'prot_elemento' => null, 'protecao2' => null, 'alimentador' => null, 'zona' => null, 'trecho' => null, 'trecho_t4' => null,
                'plano_easywork' => null, 'lat' => null, 'lng' => null];
            foreach ($mapa as $col => $campo) {
                $a[$col] ??= self::limpar($r[$campo] ?? null);   // linhas repetidas do mesmo elemento: o primeiro valor preenchido vale
            }
            if ($a['lat'] === null) {
                $la = self::numero($r['LAT'] ?? null);
                $lo = self::numero($r['LONG'] ?? null);
                if ($la !== null && $lo !== null) {
                    if (abs($la) <= 90 && abs($lo) <= 180) {
                        $a['lat'] = $la;
                        $a['lng'] = $lo;
                    } else {
                        $coordInv++;
                    }
                }
            }
            if ($a['protecao2'] !== null && $a['alimentador'] !== null) {
                $pares[$a['protecao2'].'|'.$a['alimentador']] = [$a['alimentador'], $a['protecao2']];
            }
            unset($a);
        }
        $this->faltando($leitor, ['ELEMENTO'], $cols, 'Protecao');
        if (! $agg) {
            throw new RuntimeException('Nenhuma linha válida encontrada no arquivo (todas sem ELEMENTO).');
        }
        $this->aviso(['tipo' => 'progresso', 'fase' => 'salvando-json', 'total' => count($agg)]);
        DB::transaction(function () use ($agg, $pares) {
            DB::table('protecoes')->delete();
            DB::statement('ALTER SEQUENCE protecoes_id_seq RESTART');
            foreach (array_chunk(array_values($agg), 1000) as $lote) {
                $vals = [];
                $bind = [];
                foreach ($lote as $p) {
                    $vals[] = '(?, ?, ?, ?, ?, ?, ?, ?, '.($p['lat'] !== null ? 'ST_SetSRID(ST_MakePoint(?, ?), 4326)' : 'NULL').')';
                    array_push($bind, $p['protecao_id'], $p['prot_elemento'], $p['protecao2'], $p['alimentador'], $p['trecho'], $p['trecho_t4'], $p['zona'], $p['plano_easywork']);
                    if ($p['lat'] !== null) {
                        array_push($bind, json_encode($p['lng']), json_encode($p['lat']));
                    }
                }
                DB::insert('INSERT INTO protecoes (protecao_id, prot_elemento, protecao2, alimentador, trecho, trecho_t4, zona, plano_easywork, loc) VALUES '.implode(',', $vals), $bind);
            }
            DB::table('protecao_alimentador')->delete();
            foreach (array_chunk(array_values($pares), 2000) as $lote) {
                DB::table('protecao_alimentador')->insert(array_map(fn ($x) => ['alimentador' => $x[0], 'protecao_id' => $x[1]], $lote));
            }
        });
        $alimPolo = self::atualizarAlimentadorPolo();

        return ['totalLinhas' => $leitor->linhasLidas, 'processados' => count($agg), 'totalErros' => $semChave + $coordInv,
            'resumo' => ['linhasLidas' => $lidas, 'registrosGravados' => count($agg), 'linhasSemChave' => $semChave, 'coordenadasInvalidas' => $coordInv, 'alimentadoresComPolo' => $alimPolo]];
    }

    /**
     * Update-MapaAlimentadorPolo: alimentador -> polo/regional mais frequente (pesado pelos postes do Vao) entre as protecoes
     * (PROT. ELEMENTO 2) do alimentador. E o que alimenta os filtros Polo/Regional do mapa. -> quantos alimentadores ficaram com polo.
     */
    public static function atualizarAlimentadorPolo(): int
    {
        return DB::transaction(function () {
            DB::table('alimentador_polo')->delete();

            return DB::affectingStatement("INSERT INTO alimentador_polo (alimentador, polo, regional)
                SELECT DISTINCT ON (alimentador) alimentador, polo, regional FROM (
                    SELECT pa.alimentador, v.polo, v.regional, sum(greatest(1, coalesce(v.postes, 0))) AS peso
                    FROM protecao_alimentador pa JOIN vao v ON v.protecao_id = pa.protecao_id
                    WHERE coalesce(v.polo, '') <> '' GROUP BY pa.alimentador, v.polo, v.regional) x
                ORDER BY alimentador, peso DESC, polo, regional");
        });
    }

    // ------------------------------------------------------------------ VERA

    public function vera(string $arq, string $nome): array
    {
        $cols = ['ID árvore', 'Alimentadores', 'Lat', 'Latitude', 'Lng', 'Longitude', 'Espécie', 'Cidade'];
        [$leitor, $gen] = $this->ler($arq, $cols, $nome);
        $validas = [];
        $erros = [];
        $n = 0;
        foreach ($gen as $r) {
            $n++;
            $id = trim((string) ($r['ID árvore'] ?? ''));
            $alim = trim((string) ($r['Alimentadores'] ?? ''));
            $latT = trim((string) ($r['Lat'] ?? $r['Latitude'] ?? ''));
            $lngT = trim((string) ($r['Lng'] ?? $r['Longitude'] ?? ''));
            $lat = self::numero($latT);
            $lng = self::numero($lngT);
            $motivo = match (true) {
                $id === '' => 'ID árvore vazio.',
                self::numero($id) === null => "ID árvore não é número ({$id}).",
                $alim === '' => 'Alimentadores vazio.',
                $lat === null || $lng === null => "Lat/Lng fora do formato esperado (Lat='{$latT}', Lng='{$lngT}').",
                default => null,
            };
            if ($motivo) {
                count($erros) < 500 && $erros[] = ['numeroLinha' => $n + 1, 'motivo' => $motivo];
                $erros['__total'] = ($erros['__total'] ?? 0) + 1;

                continue;
            }
            $validas[$id] = ['id_vera' => $id, 'alimentador' => $alim, 'especie' => trim((string) ($r['Espécie'] ?? '')) ?: null,
                'cidade' => trim((string) ($r['Cidade'] ?? '')) ?: null, 'lat' => $lat, 'lng' => $lng];
        }
        $totalErros = $erros['__total'] ?? 0;
        unset($erros['__total']);
        $falta = [];
        if (! in_array('ID árvore', $leitor->encontradas, true)) {
            $falta[] = 'ID árvore';
        }
        if (! in_array('Alimentadores', $leitor->encontradas, true)) {
            $falta[] = 'Alimentadores';
        }
        if (! array_intersect(['Lat', 'Latitude'], $leitor->encontradas)) {
            $falta[] = 'Lat';
        }
        if (! array_intersect(['Lng', 'Longitude'], $leitor->encontradas)) {
            $falta[] = 'Lng';
        }
        if ($falta) {
            throw new RuntimeException('A planilha nao tem a(s) coluna(s) obrigatoria(s): '.implode(', ', $falta).'. Cabecalhos que encontrei: '.implode(' | ', array_slice($leitor->cabecalhos, 0, 40)));
        }
        if (! $validas) {
            $amostra = implode(' ; ', array_map(fn ($e) => "linha {$e['numeroLinha']}: {$e['motivo']}", array_slice($erros, 0, 3)));
            throw new RuntimeException("Nenhuma linha valida (de {$leitor->linhasLidas}). Exemplos: {$amostra}");
        }
        $this->aviso(['tipo' => 'progresso', 'fase' => 'salvando-json', 'total' => count($validas)]);
        DB::transaction(function () use ($validas) {
            foreach (array_chunk(array_values($validas), 1000) as $lote) {
                $vals = [];
                $bind = [];
                foreach ($lote as $v) {
                    $vals[] = '(?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326))';
                    array_push($bind, $v['id_vera'], $v['especie'], $v['cidade'], $v['alimentador'], json_encode($v['lng']), json_encode($v['lat']));
                }
                DB::insert('INSERT INTO vera (id_vera, especie, cidade, alimentador, loc) VALUES '.implode(',', $vals)
                    .' ON CONFLICT (id_vera) DO UPDATE SET especie = EXCLUDED.especie, cidade = EXCLUDED.cidade, alimentador = EXCLUDED.alimentador, loc = EXCLUDED.loc', $bind);
            }
        });
        foreach (glob(storage_path('app'.DIRECTORY_SEPARATOR.'cache'.DIRECTORY_SEPARATOR.'vera_*.ndjson.gz')) ?: [] as $f) {
            @unlink($f);
        }

        return ['totalLinhas' => $leitor->linhasLidas, 'processados' => count($validas), 'totalErros' => $totalErros, 'erros' => $erros,
            'resumo' => ['linhasLidas' => $n, 'registrosGravados' => count($validas), 'linhasComErro' => $totalErros]];
    }
}
