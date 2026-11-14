<?php

namespace App\Services\Importacao;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Ativos e Equipamentos da BDGD — porte de lib/Postes.ps1 e lib/Equip.ps1:
 *  - postes(): PONNOT (.shp de pontos + .dbf, soltos ou num .zip) SUBSTITUI a base de postes (~760 mil);
 *  - aplicarPosicao(): reaplica VERA > XY > Poste > cidade nas OS do SGM ja gravadas (roda depois do PONNOT);
 *  - equipamentos(): DBFs UNTRMT/UNSEMT/UNREMT/UNCRMT (posicao decodificada do PAC_1/PAC_2, UTM 22S -> graus,
 *    poste do PONNOT a ate 8 m) e/ou o Excel do Smallworld (Id, Name, Alias) com os nomes operativos.
 * Arquivos lidos do disco em fluxo (nao carrega o .dbf de 760 mil linhas inteiro na memoria).
 */
class ImportadorAtivos
{
    /** campos v0..v4 por camada e qual deles e o "tipo" (SparkEquip.Campos / IdxTipo) */
    public const EQUIP = [
        'trafos' => ['dbf' => 'UNTRMT', 'campos' => ['POT_NOM', 'POSTO', 'TEN_LIN_SE', 'FAS_CON_P', 'TIP_TRAFO'], 'tipo' => 1],
        'protecoes' => ['dbf' => 'UNSEMT', 'campos' => ['TIP_UNID', 'CAP_ELO', 'COR_NOM', 'P_N_OPE', 'FAS_CON'], 'tipo' => 0],
        'reguladores' => ['dbf' => 'UNREMT', 'campos' => ['TIP_REGU', 'FAS_CON', 'BANC', 'TIP_UNID', ''], 'tipo' => 0],
        'capacitores' => ['dbf' => 'UNCRMT', 'campos' => ['POT_NOM', 'FAS_CON', 'BANC', 'TIP_UNID', ''], 'tipo' => 3],
    ];

    /** @var callable|null */
    private $avisar;

    /** @var string[] temporarios a apagar no fim */
    private array $tmp = [];

    public function __construct(?callable $avisar = null)
    {
        $this->avisar = $avisar;
    }

    public function __destruct()
    {
        foreach ($this->tmp as $t) {
            @unlink($t);
        }
    }

    private function aviso(array $p): void
    {
        $this->avisar && ($this->avisar)($p);
    }

    /** nome original => caminho; o que estiver dentro de .zip e extraido para temporarios */
    private function abrirArquivos(array $arquivos, array $exts): array
    {
        $saida = [];
        foreach ($arquivos as $nome => $caminho) {
            $ext = strtolower(pathinfo($nome, PATHINFO_EXTENSION));
            if ($ext === 'zip') {
                $this->aviso(['fase' => 'descompactando', 'percentual' => 5]);
                $z = new \ZipArchive;
                if ($z->open($caminho) !== true) {
                    throw new RuntimeException("Não consegui abrir o .zip {$nome}.");
                }
                for ($i = 0; $i < $z->numFiles; $i++) {
                    $n = basename($z->getNameIndex($i));
                    if (in_array(strtolower(pathinfo($n, PATHINFO_EXTENSION)), $exts, true)) {
                        $t = tempnam(sys_get_temp_dir(), 'spk');
                        $this->tmp[] = $t;
                        $in = $z->getStream($z->getNameIndex($i));
                        $out = fopen($t, 'wb');
                        stream_copy_to_stream($in, $out);
                        fclose($in);
                        fclose($out);
                        $saida[$n] = $t;
                    }
                }
                $z->close();
            } elseif (in_array($ext, $exts, true)) {
                $saida[$nome] = $caminho;
            }
        }

        return $saida;
    }

    /** Texto do DBF como o C# do legado: apara espacos e NUL, Latin-1 -> UTF-8, sem TAB/quebra de linha. */
    private static function texto(string $bruto): string
    {
        $t = trim($bruto, " \0");

        return $t === '' ? '' : str_replace(["\t", "\r", "\n"], ' ', mb_convert_encoding($t, 'UTF-8', 'ISO-8859-1'));
    }

    /** Abre um .dbf para leitura registro a registro: [handle, nRegistros, tamCabecalho, tamRegistro, colunas nome => [offset, tamanho]] */
    private static function abrirDbf(string $arq): array
    {
        $h = fopen($arq, 'rb');
        $cab = fread($h, 32);
        if (strlen($cab) < 32) {
            throw new RuntimeException('Arquivo .dbf vazio ou inválido.');
        }
        $n = unpack('V', substr($cab, 4, 4))[1];
        $hdr = unpack('v', substr($cab, 8, 2))[1];
        $reg = unpack('v', substr($cab, 10, 2))[1];
        $desc = fread($h, $hdr - 32);
        $cols = [];
        $off = 1;
        for ($p = 0; $p + 32 <= strlen($desc) && $desc[$p] !== "\x0D"; $p += 32) {
            $nome = strtoupper(trim(explode("\0", substr($desc, $p, 11))[0]));
            $len = ord($desc[$p + 16]);
            $cols[$nome] = [$off, $len];
            $off += $len;
        }
        fseek($h, $hdr);

        return [$h, $n, $hdr, $reg, $cols];
    }

    // ------------------------------------------------------------------ Postes (PONNOT)

    public function postes(array $arquivos, string $usuario): array
    {
        $a = $this->abrirArquivos($arquivos, ['shp', 'dbf']);
        $shp = $dbf = null;
        foreach ($a as $n => $c) {
            str_ends_with(strtolower($n), '.shp') ? $shp = $c : $dbf = $c;
        }
        if (! $shp || ! $dbf) {
            throw new RuntimeException('Nao encontrei o .shp e o .dbf do PONNOT no que foi enviado (soltos ou dentro de um .zip).');
        }
        $hs = fopen($shp, 'rb');
        $cabShp = fread($hs, 100);
        if (strlen($cabShp) < 100) {
            throw new RuntimeException('Arquivo .shp vazio ou inválido.');
        }
        $tipoShape = unpack('V', substr($cabShp, 32, 4))[1];
        if ($tipoShape !== 1) {
            throw new RuntimeException("O shapefile não é de pontos (tipo {$tipoShape}). Para postes envie o PONNOT (pontos).");
        }
        [$hd, $nRec, , $recLen, $cols] = self::abrirDbf($dbf);
        if (! isset($cols['COD_ID'])) {
            throw new RuntimeException('O .dbf não tem a coluna COD_ID.');
        }
        $campo = fn (string $reg, string $c) => isset($cols[$c]) ? self::texto(substr($reg, $cols[$c][0], $cols[$c][1])) : '';

        $total = $semGeo = $apagados = 0;
        $porTipo = [];
        $vistos = [];
        $pdo = DB::connection()->getPdo();
        $esc = fn ($v) => $v === null ? '@@NULO@@' : strtr((string) $v, ["\\" => '\\\\', "\t" => ' ', "\n" => ' ', "\r" => ' ']);
        DB::transaction(function () use ($hs, $hd, $nRec, $recLen, $campo, &$total, &$semGeo, &$apagados, &$porTipo, &$vistos, $pdo, $esc) {
            DB::table('postes')->delete();
            $buf = [];
            for ($i = 0; $i < $nRec; $i++) {
                $cabReg = fread($hs, 8);
                if (strlen($cabReg) < 8) {
                    break;
                }
                $conteudo = fread($hs, unpack('N', substr($cabReg, 4, 4))[1] * 2);
                $reg = fread($hd, $recLen);
                if (strlen($reg) < $recLen) {
                    break;
                }
                if ($reg[0] === '*') {
                    $apagados++;

                    continue;
                }
                if (strlen($conteudo) < 20 || unpack('V', substr($conteudo, 0, 4))[1] !== 1) {
                    $semGeo++;

                    continue;
                }
                $xy = unpack('e2', substr($conteudo, 4, 16));
                $x = $xy[1];
                $y = $xy[2];
                $cod = $campo($reg, 'COD_ID');
                if ($cod === '') {
                    $semGeo++;

                    continue;
                }
                $tip = $campo($reg, 'TIP_PN');
                $total++;
                $porTipo[$tip] = ($porTipo[$tip] ?? 0) + 1;
                if (isset($vistos[$cod]) || ! is_finite($x) || ! is_finite($y)) {
                    continue;   // repetido: vale o primeiro (como o migrar.php)
                }
                $vistos[$cod] = true;
                $buf[] = implode("\t", array_map($esc, [$cod, $tip ?: null, $campo($reg, 'ARE_LOC') ?: null, $campo($reg, 'CONJ') ?: null,
                    sprintf('SRID=4326;POINT(%.6F %.6F)', $x, $y), $campo($reg, 'MUN') ?: null]))."\n";
                if (count($buf) >= 20000) {
                    $pdo->pgsqlCopyFromArray('postes', $buf, "\t", '@@NULO@@', 'cod_id,tipo,area_local,conjunto,loc,municipio');
                    $buf = [];
                    $this->aviso(['fase' => 'gravando', 'arquivo' => 'gravando os pontos do PONNOT', 'linha' => $i + 1, 'total' => $nRec,
                        'percentual' => min(60, round(10 + 50 * ($i + 1) / max(1, $nRec), 1))]);
                }
            }
            $buf && $pdo->pgsqlCopyFromArray('postes', $buf, "\t", '@@NULO@@', 'cod_id,tipo,area_local,conjunto,loc,municipio');
        });
        fclose($hs);
        fclose($hd);
        ksort($porTipo, SORT_STRING);
        $pt = [];
        foreach ($porTipo as $k => $v) {
            $pt[$k === '' ? '(vazio)' : $k] = $v;
        }
        $meta = ['total' => $total, 'porTipo' => $pt, 'semGeometria' => $semGeo, 'atualizadoEm' => now()->toIso8601String(), 'atualizadoPor' => $usuario,
            'arquivo' => implode(', ', array_keys($arquivos))];
        DB::table('legado_bruto')->upsert([['entidade' => 'postes_meta', 'dados' => json_encode([$meta], JSON_UNESCAPED_UNICODE), 'importado_em' => now()]], ['entidade'], ['dados', 'importado_em']);

        return ['total' => $total, 'semGeometria' => $semGeo, 'apagados' => $apagados, 'porTipo' => $pt];
    }

    /**
     * VERA > XY > Poste > cidade nas OS SGM ja gravadas (Invoke-AplicarPosicaoPostesVera), tudo em SQL.
     * Dados do poste (tipo, area, conjunto, posicao, municipio) sempre atualizados; localidade pelo municipio do poste
     * so quando a OS nao tem localidade ou ela ja tinha vindo do poste.
     */
    public static function aplicarPosicao(?callable $aviso = null): array
    {
        $aviso && $aviso(['fase' => 'cruzando', 'arquivo' => 'cruzando OS com VERA e postes', 'percentual' => 70]);

        return DB::transaction(function () {
            $st = ['osComPoste' => (int) DB::selectOne("SELECT count(DISTINCT poste_id) AS n FROM os WHERE origem = 'SGM' AND coalesce(poste_id, '') <> ''")->n];
            // municipio IBGE -> nome (semente + base "municipios" por cima), para a localidade das OS sem localidade
            DB::statement('DROP TABLE IF EXISTS ap_mun, ap_os, ap_novo');   // dentro de outra transacao o ON COMMIT ainda nao rodou
            DB::statement('CREATE TEMP TABLE ap_mun (cod TEXT PRIMARY KEY, nome TEXT) ON COMMIT DROP');
            $mun = config('spark_municipios', []);
            foreach (json_decode((string) DB::table('legado_bruto')->where('entidade', 'municipios')->value('dados'), true) ?: [] as $m) {
                if (empty($m['excluido']) && trim((string) ($m['codigo'] ?? '')) !== '' && trim((string) ($m['nome'] ?? '')) !== '') {
                    $mun[trim($m['codigo'])] = trim($m['nome']);
                }
            }
            foreach (array_chunk(array_map(fn ($c, $n) => ['cod' => (string) $c, 'nome' => $n], array_keys($mun), $mun), 500) as $l) {
                DB::table('ap_mun')->insert($l);
            }
            // o "antes" de cada OS, para contar quem mudou
            DB::statement("CREATE TEMP TABLE ap_os ON COMMIT DROP AS SELECT o.id, o.loc, o.loc_origem, o.loc_aproximada, o.localidade, o.localidade_por_poste,
                    o.poste_tipo, o.poste_area_local, o.poste_conjunto, o.poste_loc, o.poste_mun,
                    p.cod_id AS p_id, p.tipo AS p_tipo, p.area_local AS p_area, p.conjunto AS p_conj, p.loc AS p_loc, p.municipio AS p_mun,
                    v.loc AS v_loc, m.nome AS mun_nome
                FROM os o LEFT JOIN postes p ON p.cod_id = o.poste_id
                LEFT JOIN vera v ON v.id_vera = o.id_vera AND v.loc IS NOT NULL
                LEFT JOIN ap_mun m ON m.cod = p.municipio
                WHERE o.origem = 'SGM'");
            $st['posteEncontrado'] = (int) DB::selectOne('SELECT count(*) AS n FROM ap_os WHERE p_id IS NOT NULL')->n;
            // XY = posicao atual que veio da grid (nao aproximada, sem origem ou origem XY)
            DB::statement("CREATE TEMP TABLE ap_novo ON COMMIT DROP AS SELECT a.*,
                    CASE WHEN v_loc IS NOT NULL THEN 'VERA'
                         WHEN loc IS NOT NULL AND NOT loc_aproximada AND (loc_origem IS NULL OR loc_origem = 'XY') THEN 'XY'
                         WHEN p_loc IS NOT NULL THEN 'POSTE' END AS res
                FROM ap_os a");
            $st['viraramVera'] = (int) DB::selectOne("SELECT count(*) AS n FROM ap_novo WHERE res = 'VERA'")->n;
            $st['viraramPoste'] = (int) DB::selectOne("SELECT count(*) AS n FROM ap_novo WHERE res = 'POSTE'")->n;
            $st['localidadePorPoste'] = (int) DB::selectOne("SELECT count(*) AS n FROM ap_novo WHERE p_id IS NOT NULL AND mun_nome IS NOT NULL
                AND (coalesce(localidade, '') = '' OR localidade_por_poste)")->n;
            $st['osAtualizadas'] = DB::update("UPDATE os o SET
                    poste_tipo = CASE WHEN n.p_id IS NOT NULL THEN n.p_tipo ELSE o.poste_tipo END,
                    poste_area_local = CASE WHEN n.p_id IS NOT NULL THEN n.p_area ELSE o.poste_area_local END,
                    poste_conjunto = CASE WHEN n.p_id IS NOT NULL THEN n.p_conj ELSE o.poste_conjunto END,
                    poste_loc = CASE WHEN n.p_id IS NOT NULL THEN n.p_loc ELSE o.poste_loc END,
                    poste_mun = CASE WHEN n.p_id IS NOT NULL THEN n.p_mun ELSE o.poste_mun END,
                    localidade = CASE WHEN n.p_id IS NOT NULL AND n.mun_nome IS NOT NULL AND (coalesce(o.localidade, '') = '' OR o.localidade_por_poste) THEN n.mun_nome ELSE o.localidade END,
                    localidade_por_poste = CASE WHEN n.p_id IS NOT NULL AND n.mun_nome IS NOT NULL AND (coalesce(o.localidade, '') = '' OR o.localidade_por_poste) THEN true ELSE o.localidade_por_poste END,
                    loc = CASE n.res WHEN 'VERA' THEN ST_SetSRID(ST_MakePoint(round(ST_X(n.v_loc)::numeric, 6), round(ST_Y(n.v_loc)::numeric, 6)), 4326)
                                     WHEN 'POSTE' THEN ST_SetSRID(ST_MakePoint(round(ST_X(n.p_loc)::numeric, 6), round(ST_Y(n.p_loc)::numeric, 6)), 4326) ELSE o.loc END,
                    loc_aproximada = CASE WHEN n.res IN ('VERA', 'POSTE') THEN false ELSE o.loc_aproximada END,
                    loc_origem = CASE WHEN n.res IS NOT NULL THEN n.res WHEN o.loc_aproximada THEN 'CIDADE' ELSE o.loc_origem END,
                    atualizado_em = now()
                FROM ap_novo n WHERE n.id = o.id AND (n.p_id IS NOT NULL OR n.res IN ('VERA', 'POSTE')
                    OR (n.res = 'XY' AND n.loc_origem IS DISTINCT FROM 'XY') OR (n.res IS NULL AND o.loc_aproximada AND o.loc_origem IS DISTINCT FROM 'CIDADE'))");

            return $st;
        });
    }

    // ------------------------------------------------------------------ Equipamentos

    /** "45744789755289990ET" -> [E, N] em metros (UTM). null se o PAC nao for de coordenada. */
    public static function decodePac(string $s): ?array
    {
        $L = strlen($s);
        if ($L < 12 || ! ctype_alpha($s[$L - 1]) || ! ctype_alpha($s[$L - 2])) {
            return null;
        }
        $dl = $L - 2;
        if ($dl < 10 || $dl > 18 || ! ctype_digit(substr($s, 0, $dl))) {
            return null;
        }
        $n = (int) substr($s, $dl - 9, 9) / 100.0;
        $e = (int) substr($s, 0, $dl - 9) / 100.0;

        return $e > 100000.0 && $e < 1300000.0 && $n > 6500000.0 && $n < 8300000.0 ? [$e, $n] : null;
    }

    /** UTM (SIRGAS 2000 / GRS80) hemisferio sul, meridiano central -51 -> [lat, lng] (mesma serie de Kruger do legado) */
    public static function utmSul(float $E, float $N, float $lon0 = -51.0): array
    {
        $a = 6378137.0;
        $f = 1.0 / 298.257222101;
        $k0 = 0.9996;
        $n1 = $f / (2.0 - $f);
        $n2 = $n1 * $n1;
        $n3 = $n2 * $n1;
        $n4 = $n3 * $n1;
        $A = $a / (1.0 + $n1) * (1.0 + $n2 / 4.0 + $n4 / 64.0);
        $xi1 = ($N - 10000000.0) / ($k0 * $A);
        $eta1 = ($E - 500000.0) / ($k0 * $A);
        $b1 = $n1 / 2.0 - 2.0 * $n2 / 3.0 + 37.0 * $n3 / 96.0;
        $b2 = $n2 / 48.0 + $n3 / 15.0;
        $b3 = 17.0 * $n3 / 480.0;
        $xi = $xi1 - ($b1 * sin(2 * $xi1) * cosh(2 * $eta1) + $b2 * sin(4 * $xi1) * cosh(4 * $eta1) + $b3 * sin(6 * $xi1) * cosh(6 * $eta1));
        $eta = $eta1 - ($b1 * cos(2 * $xi1) * sinh(2 * $eta1) + $b2 * cos(4 * $xi1) * sinh(4 * $eta1) + $b3 * cos(6 * $xi1) * sinh(6 * $eta1));
        $chi = asin(sin($xi) / cosh($eta));
        $d1 = 2.0 * $n1 - 2.0 * $n2 / 3.0 - 2.0 * $n3;
        $d2 = 7.0 * $n2 / 3.0 - 8.0 * $n3 / 5.0;
        $d3 = 56.0 * $n3 / 15.0;
        $la = $chi + $d1 * sin(2 * $chi) + $d2 * sin(4 * $chi) + $d3 * sin(6 * $chi);

        return [$la * 180.0 / M_PI, $lon0 + atan2(sinh($eta), cos($xi)) * 180.0 / M_PI];
    }

    public function equipamentos(array $arquivos, string $usuario): array
    {
        $nomesRes = [];
        $nomesIgn = [];
        foreach ($arquivos as $nome => $caminho) {
            if (! str_ends_with(strtolower($nome), '.xlsx')) {
                continue;
            }
            $n = strtolower($nome);
            $camada = preg_match('/transformer|trafo|xfrmr/', $n) ? 'trafos' : (str_contains($n, 'isolat') ? 'protecoes' : null);
            if (! $camada) {
                $nomesIgn[] = $nome;

                continue;
            }
            $nomesRes[] = $this->nomesXlsx($nome, $caminho, $camada);
        }
        $temDbf = (bool) array_filter(array_keys($arquivos), fn ($n) => preg_match('/\.(dbf|zip)$/i', $n));
        if (! $temDbf) {
            if (! $nomesRes) {
                throw new RuntimeException("Nao reconheci o Excel. O nome precisa conter 'Transformer' (trafos) ou 'Isolating' (chaves/protecoes).");
            }

            return ['camadas' => [], 'ignorados' => [], 'nomes' => $nomesRes, 'nomesIgnorados' => $nomesIgn];
        }
        if (! DB::table('postes')->exists()) {
            throw new RuntimeException("Importe primeiro a base de Postes (PONNOT) - e' ela que liga cada equipamento ao poste.");
        }
        $dbfs = $this->abrirArquivos(array_filter($arquivos, fn ($n) => preg_match('/\.(dbf|zip)$/i', $n), ARRAY_FILTER_USE_KEY), ['dbf']);
        if (! $dbfs) {
            throw new RuntimeException('Nao encontrei nenhum .dbf (UNTRMT, UNSEMT, UNREMT ou UNCRMT) no que foi enviado.');
        }
        $res = [];
        $ign = [];
        $feitos = 0;
        foreach ($dbfs as $nome => $caminho) {
            $camada = null;
            foreach (self::EQUIP as $k => $c) {
                if (str_contains(strtoupper($nome), $c['dbf'])) {
                    $camada = $k;
                    break;
                }
            }
            if (! $camada) {
                $ign[] = $nome;

                continue;
            }
            $feitos++;
            $this->aviso(['fase' => 'gravando', 'arquivo' => "lendo {$nome} e achando o poste de cada equipamento", 'percentual' => min(90, 15 + 20 * $feitos)]);
            $res[] = $this->umDbf($camada, $nome, $caminho, $usuario);
        }
        if (! $res) {
            throw new RuntimeException("Nenhum dos arquivos e' de equipamento conhecido. Os nomes precisam conter UNTRMT, UNSEMT, UNREMT ou UNCRMT.");
        }

        return ['camadas' => $res, 'ignorados' => $ign, 'nomes' => $nomesRes, 'nomesIgnorados' => $nomesIgn];
    }

    private function umDbf(string $camada, string $nome, string $arq, string $usuario): array
    {
        $cfg = self::EQUIP[$camada];
        [$h, $nRec, , $recLen, $cols] = self::abrirDbf($arq);
        if (! isset($cols['COD_ID'])) {
            throw new RuntimeException('O .dbf não tem a coluna COD_ID.');
        }
        if (! isset($cols['PAC_1']) && ! isset($cols['PAC_2'])) {
            throw new RuntimeException('O .dbf não tem PAC_1/PAC_2 (é preciso para achar o poste).');
        }
        $campo = fn (string $reg, string $c) => ($c !== '' && isset($cols[$c])) ? self::texto(substr($reg, $cols[$c][0], $cols[$c][1])) : '';
        $r = ['camada' => $camada, 'arquivo' => $nome, 'total' => 0, 'comPoste' => 0, 'semPoste' => 0, 'semPosicao' => 0, 'apagados' => 0, 'porTipo' => []];
        $pdo = DB::connection()->getPdo();
        $esc = fn ($v) => ($v === null || $v === '') ? '@@NULO@@' : strtr((string) $v, ["\\" => '\\\\', "\t" => ' ', "\n" => ' ', "\r" => ' ']);
        DB::transaction(function () use ($h, $nRec, $recLen, $campo, $cfg, $camada, &$r, $pdo, $esc) {
            DB::table('equipamentos')->where('camada', $camada)->delete();
            $vistos = [];
            $buf = [];
            $flush = function () use (&$buf, $pdo) {
                $buf && $pdo->pgsqlCopyFromArray('equipamentos', $buf, "\t", '@@NULO@@', 'camada,cod_id,loc,ctmt,conj,v0,v1,v2,v3,v4');
                $buf = [];
            };
            for ($i = 0; $i < $nRec; $i++) {
                $reg = fread($h, $recLen);
                if (strlen($reg) < $recLen) {
                    break;
                }
                if ($reg[0] === '*') {
                    $r['apagados']++;

                    continue;
                }
                $cod = $campo($reg, 'COD_ID');
                $pac = self::decodePac($campo($reg, 'PAC_1')) ?? self::decodePac($campo($reg, 'PAC_2'));
                if ($cod === '' || ! $pac) {
                    $r['semPosicao']++;

                    continue;
                }
                [$lat, $lng] = self::utmSul($pac[0], $pac[1]);
                $v = array_map(fn ($c) => $campo($reg, $c), $cfg['campos']);
                $tipo = $v[$cfg['tipo']];
                $r['total']++;
                $r['porTipo'][$tipo] = ($r['porTipo'][$tipo] ?? 0) + 1;
                if (isset($vistos[$cod])) {
                    continue;
                }
                $vistos[$cod] = true;
                $buf[] = implode("\t", array_map($esc, array_merge([$camada, $cod, sprintf('SRID=4326;POINT(%.6F %.6F)', $lng, $lat), $campo($reg, 'CTMT'), $campo($reg, 'CONJ')], $v)))."\n";
                count($buf) >= 20000 && $flush();
            }
            $flush();
            // poste do PONNOT mais proximo a ate 8 m (mesma regua do legado: x = dLng*111320*cos(lat), y = dLat*111320);
            // achou -> o equipamento fica na posicao do poste
            DB::update("UPDATE equipamentos e SET poste = x.cod_id, loc = x.ploc FROM (
                    SELECT DISTINCT ON (e2.cod_id) e2.cod_id AS eq, n.cod_id, n.loc AS ploc FROM equipamentos e2
                    CROSS JOIN LATERAL (SELECT p.cod_id, p.loc, sqrt(((ST_X(p.loc) - ST_X(e2.loc)) * 111320 * cos(radians(ST_Y(e2.loc)))) ^ 2 + ((ST_Y(p.loc) - ST_Y(e2.loc)) * 111320) ^ 2) AS d
                        FROM postes p ORDER BY p.loc <-> e2.loc LIMIT 3) n
                    WHERE e2.camada = ? AND n.d <= 8 ORDER BY e2.cod_id, n.d) x
                WHERE e.camada = ? AND e.cod_id = x.eq AND e.poste IS NULL", [$camada, $camada]);
            // nomes operativos (o Excel do Smallworld pode ter vindo antes)
            DB::update('UPDATE equipamentos e SET nome_operativo = coalesce(nullif(n.nome, \'\'), n.alias) FROM equip_nomes n WHERE e.camada = ? AND n.camada = e.camada AND n.cod_id = e.cod_id', [$camada]);
        });
        fclose($h);
        $r['comPoste'] = (int) DB::table('equipamentos')->where('camada', $camada)->whereNotNull('poste')->count();
        $r['semPoste'] = $r['total'] - $r['comPoste'];
        ksort($r['porTipo'], SORT_STRING);
        $pt = [];
        foreach ($r['porTipo'] as $k => $v) {
            $pt[$k === '' ? '(vazio)' : $k] = $v;
        }
        $r['porTipo'] = $pt;
        $meta = array_values(array_filter(json_decode((string) DB::table('legado_bruto')->where('entidade', 'equip_meta')->value('dados'), true) ?: [], fn ($m) => ($m['camada'] ?? '') !== $camada));
        $meta[] = array_diff_key($r, ['apagados' => 1]) + ['atualizadoEm' => now()->toIso8601String(), 'atualizadoPor' => $usuario];
        DB::table('legado_bruto')->upsert([['entidade' => 'equip_meta', 'dados' => json_encode($meta, JSON_UNESCAPED_UNICODE), 'importado_em' => now()]], ['entidade'], ['dados', 'importado_em']);

        return $r;
    }

    /** Excel do Smallworld (Id, Name, Alias): SOMA aos nomes da camada e atualiza os equipamentos ja gravados. */
    private function nomesXlsx(string $nome, string $arq, string $camada): array
    {
        $leitor = new LeitorXlsx($arq, ['Id', 'Name', 'Alias']);
        $lidas = $semChave = 0;
        $itens = [];
        foreach ($leitor->linhas(fn ($l, $t) => $this->aviso(['fase' => 'lendo', 'arquivo' => $nome, 'linha' => $l] + ($t ? ['total' => $t, 'percentual' => min(99, round(100 * $l / $t, 1))] : []))) as $l) {
            $lidas++;
            $id = trim((string) ($l['Id'] ?? ''));
            if (str_ends_with($id, '.0')) {
                $id = substr($id, 0, -2);
            }
            $limpo = fn ($v) => trim(str_replace(["\t", "\r", "\n"], ' ', (string) $v));
            $nm = $limpo($l['Name'] ?? '');
            $al = $limpo($l['Alias'] ?? '');
            if ($id === '' || $id === '0' || ($nm === '' && $al === '')) {
                $semChave++;

                continue;
            }
            $itens[$id] = ['camada' => $camada, 'cod_id' => $id, 'nome' => $nm, 'alias' => $al];
        }
        if (! in_array('Id', $leitor->encontradas, true) || ! in_array('Name', $leitor->encontradas, true)) {
            throw new RuntimeException("Nao achei as colunas Id e Name em {$nome} (achei: ".implode(', ', $leitor->cabecalhos).').');
        }
        DB::transaction(function () use ($itens, $camada) {
            foreach (array_chunk(array_values($itens), 1000) as $lote) {
                DB::table('equip_nomes')->upsert($lote, ['camada', 'cod_id'], ['nome', 'alias']);
            }
            DB::update('UPDATE equipamentos e SET nome_operativo = coalesce(nullif(n.nome, \'\'), n.alias) FROM equip_nomes n WHERE e.camada = ? AND n.camada = e.camada AND n.cod_id = e.cod_id', [$camada]);
        });

        return ['arquivo' => $nome, 'lidas' => $lidas, 'lidos' => count($itens), 'semChave' => $semChave,
            'totalGravado' => DB::table('equip_nomes')->where('camada', $camada)->count(), 'camada' => $camada];
    }
}
