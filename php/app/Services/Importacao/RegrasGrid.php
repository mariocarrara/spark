<?php

namespace App\Services\Importacao;

/**
 * Regras das grids de OS, portadas 1:1 de lib/PodasImporter.ps1, lib/XlsxReader.ps1, lib/Postes.ps1,
 * lib/Validacao.ps1 e lib/PodasHistorico.ps1 do legado. Funcoes puras (sem banco).
 */
class RegrasGrid
{
    /** "218-5264100" -> "5264100" (COD_ID do poste no PONNOT). Vazio -> null. */
    public static function posteDoComplemento($t): ?string
    {
        $t = trim((string) $t);
        if ($t === '') {
            return null;
        }
        if (str_starts_with($t, '218-')) {
            $t = trim(substr($t, 4));
        }

        return $t === '' ? null : $t;
    }

    /** v3.21 - criticidade do SGM (Prioridade / CodPrioridade): MAIUSCULAS, sem espacos nas pontas; vazio ou #N/A -> null (Get-PrioridadeSgm). */
    public static function prioridadeSgm($v): ?string
    {
        $t = mb_strtoupper(trim((string) $v));

        return ($t === '' || $t === '#N/A') ? null : $t;
    }

    public static function textoOuNulo($v): ?string
    {
        $t = trim((string) $v);

        return ($t === '' || $t === '#N/A') ? null : $t;
    }

    /** Texto da Observacao; desfaz acentuacao quebrada (UTF-8 lido como Windows-1252) so se der UTF-8 valido. */
    public static function textoCorrigido($v): ?string
    {
        $t = self::textoOuNulo($v);
        if ($t === null) {
            return null;
        }
        if (preg_match('/[\x{00C2}\x{00C3}]/u', $t)) {
            $bytes = @mb_convert_encoding($t, 'Windows-1252', 'UTF-8');
            if ($bytes !== false && mb_check_encoding($bytes, 'UTF-8') && mb_convert_encoding($bytes, 'UTF-8', 'Windows-1252') === $t) {
                return $bytes;
            }
        }

        return $t;
    }

    public static function trecho($v): ?string
    {
        $t = self::textoOuNulo($v);

        return $t === null ? null : mb_strtoupper($t);
    }

    public static function statusExecutado($osFechada): string
    {
        return mb_strtoupper(trim((string) $osFechada)) === 'SIM' ? 'Executada' : 'Despachada';
    }

    public static function statusPendente($codEstado): string
    {
        return match (mb_strtoupper(trim((string) $codEstado))) {
            'A REPROGRAMAR' => 'A reprogramar',
            'REPROGRAMADA', 'PROGRAMADA' => 'Programada',
            'DESPACHADA' => 'Despachada',
            default => 'Pendente',
        };
    }

    /** "COEC-GRLV1 000123456" -> "COEC-GRLV1" (equipe = tudo antes do primeiro espaco). */
    public static function equipeDoNumeroOS(?string $os): ?string
    {
        if ($os === null || trim($os) === '') {
            return null;
        }

        return preg_match('/^(\S+)\s/', $os, $m) ? $m[1] : null;
    }

    /** Maiusculas, sem acento, travessoes viram "-", espacos repetidos viram 1. */
    public static function chaveEsquema(?string $t): string
    {
        if ($t === null || trim($t) === '') {
            return '';
        }
        if (class_exists(\Normalizer::class)) {
            $t = \Normalizer::normalize($t, \Normalizer::FORM_D) ?: $t;
            $t = preg_replace('/\p{Mn}/u', '', $t);
        } else {
            $t = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $t) ?: $t;
        }
        $t = mb_strtoupper($t);
        $t = preg_replace('/[\x{2010}-\x{2015}\x{2212}]/u', '-', $t);
        $t = preg_replace('/\s+/u', ' ', $t);

        return trim($t);
    }

    public static function tipoEsquema(?string $tipo): string
    {
        $t = self::chaveEsquema($tipo);
        if ($t === '') {
            return '';
        }
        if (str_contains($t, 'ESTRUT')) {
            return 'estrutura';
        }
        if (str_contains($t, 'LIMP') || str_contains($t, 'FAIXA')) {
            return 'limpeza';
        }

        return str_contains($t, 'PODA') ? 'poda' : '';
    }

    /** Prioridade EW (tabela "PRIORIDADE|GRUPO" => bool; sem tabela, a regra padrao). */
    public static function prioridadeEW($cod, float $poda, float $limpeza, float $estrutura, string $tipoServico, array $tabela): bool
    {
        $p = mb_strtoupper(trim((string) $cod));
        $grupos = [];
        if ($poda > 0) {
            $grupos[] = 'PODA';
        }
        if ($limpeza > 0) {
            $grupos[] = 'LIMPEZA DE FAIXA';
        }
        if ($estrutura > 0) {
            $grupos[] = 'ESTRUTURA';
        }
        if (! $grupos) {
            $ts = mb_strtolower($tipoServico);
            $grupos = [str_contains($ts, 'faixa') || str_contains($ts, 'limpeza') ? 'LIMPEZA DE FAIXA' : (str_contains($ts, 'estrutura') ? 'ESTRUTURA' : 'PODA')];
        }
        foreach ($grupos as $g) {
            if ($tabela) {
                if (($tabela["$p|$g"] ?? null) === true) {
                    return true;
                }
            } else {
                if ($p === 'URGENTE' || $p === 'EMERGENCIAL') {
                    return true;
                }
                if ($p === 'ALTA' && $g !== 'ESTRUTURA') {
                    return true;
                }
            }
        }

        return false;
    }

    /** "GUARAPUAVA 6001-218" -> "GUARAPUAVA". */
    public static function nomeLocalidadeSemCodigo($t): ?string
    {
        if ($t === null) {
            return null;
        }
        $t = mb_strtoupper(trim((string) $t));
        if ($t === '') {
            return null;
        }
        $n = preg_replace('/\s+[0-9].*$/u', '', $t);

        return trim($n) === '' ? null : $n;
    }

    public static function mediana(array $v): float
    {
        sort($v, SORT_NUMERIC);
        $n = count($v);

        return $n % 2 === 1 ? $v[intdiv($n - 1, 2)] : ($v[intdiv($n, 2) - 1] + $v[intdiv($n, 2)]) / 2.0;
    }

    /** Numero serial do Excel ou "dd/MM/yyyy[ HH:mm:ss]" -> "yyyy-MM-dd". */
    public static function serialParaData($v): ?string
    {
        $t = trim((string) $v);
        if ($t === '') {
            return null;
        }
        if (is_numeric($t) && (float) $t > 0) {
            // .NET AddDays arredonda para o milissegundo; o dia e a parte inteira disso
            $diasInteiros = (int) floor(round((float) $t * 86400000) / 86400000);
            $base = new \DateTimeImmutable('1899-12-30', new \DateTimeZone('UTC'));

            return $base->modify("+{$diasInteiros} days")->format('Y-m-d');
        }
        foreach (['d/m/Y H:i:s', 'd/m/Y'] as $f) {
            $d = \DateTimeImmutable::createFromFormat('!'.$f, $t);
            if ($d && $d->format($f) === $t) {
                return $d->format('Y-m-d');
            }
        }

        return null;
    }

    /** "1.234,5" / "1234.5" -> float; invalido -> null (ConvertTo-DoubleSeguro). */
    public static function doubleSeguro($v): ?float
    {
        $t = trim((string) $v);
        if ($t === '') {
            return null;
        }
        $t = str_replace(',', '.', $t);

        return is_numeric($t) ? (float) $t : null;
    }

    /** Numero estrito do .NET (TryParse invariant): aceita "123", "1.5", "1e3", " 12 "; recusa "1,5". */
    public static function numeroInvariante($v): ?float
    {
        $t = trim((string) $v);

        return ($t !== '' && is_numeric($t)) ? (float) $t : null;
    }

    /**
     * UTM (zona 22, hemisferio sul, SIRGAS2000) -> lat/lng — formula de Snyder igual ao Power Query da planilha.
     * Fora da regiao de atuacao (lat -26..-19.5, lng -53.2..-43.5) devolve null.
     */
    public static function utmParaLatLng(float $leste, float $norte, int $zona = 22): ?array
    {
        $a = 6378137.0;
        $f = 1.0 / 298.257222101;
        $b = $a * (1 - $f);
        $e = sqrt($a ** 2 - $b ** 2) / $a;
        $en = sqrt($a ** 2 - $b ** 2) / $b;
        $e1 = (1 - sqrt(1 - $e ** 2)) / (1 + sqrt(1 - $e ** 2));
        $M = ($norte - 10000000.0) / 0.9996;
        $mu = $M / ($a * (1 - $e ** 2 / 4 - 3 * $e ** 4 / 64 - 5 * $e ** 6 / 256));
        $phi1 = $mu + sin(2 * $mu) * ((3 * $e1) / 2 - 27 * $e1 ** 3 / 32) + sin(4 * $mu) * ((21 * $e1 ** 2) / 16 - 55 * $e1 ** 4 / 32)
            + sin(6 * $mu) * ((151 * $e1 ** 3) / 96) + sin(8 * $mu) * ((1097 * $e1 ** 4) / 512);
        $c1 = $en ** 2 * cos($phi1) ** 2;
        $t1 = tan($phi1) ** 2;
        $n1 = $a / sqrt(1 - $e ** 2 * sin($phi1) ** 2);
        $r1 = $n1 * (1 - $e ** 2) / (1 - $e ** 2 * sin($phi1) ** 2);
        $d = ($leste - 500000.0) / ($n1 * 0.9996);
        $phi = $phi1 - ($n1 * tan($phi1) / $r1) * (($d ** 2 / 2) - ($d ** 4 * (5 + 3 * $t1 + 10 * $c1 - 4 * $c1 ** 2 - 9 * $en ** 2) / 24)
            + ($d ** 6 * (61 + 90 * $t1 + 298 * $c1 + 45 * $t1 ** 2 - 3 * $c1 ** 2) / 720));
        $lambda = ($d - ($d ** 3 * (1 + 2 * $t1 + $c1) / 6) + ($d ** 5 * (5 - 2 * $c1 + 28 * $t1 - 3 * $c1 ** 2 + 24 * $t1 ** 2 + 8 * $en ** 2) / 120)) / cos($phi1);
        $zcm = 3 + (6 * ($zona - 1)) - 180;
        $lat = $phi * 180.0 / M_PI;
        $lng = $zcm + ($lambda * 180.0 / M_PI);
        if ($lat < -26.0 || $lat > -19.5 || $lng < -53.2 || $lng > -43.5) {
            return null;
        }

        return ['lat' => $lat, 'lng' => $lng];
    }

    /** Coordenada UTM X/Y das grids SGM (texto) -> lat/lng ou null. */
    public static function latLngDaGrid($x, $y): ?array
    {
        $xv = self::numeroInvariante($x);
        $yv = self::numeroInvariante($y);
        if ($xv === null || $yv === null || $xv == 0 || $yv == 0) {
            return null;
        }

        return self::utmParaLatLng($xv, $yv, 22);
    }

    /** "CODIGO DA ARVORE" da grid -> id da VERA. Vazio, "-" ou "0" -> null. */
    public static function idVeraDaGrid($v): ?string
    {
        $t = trim((string) $v);
        if ($t === '' || $t === '-' || $t === '0') {
            return null;
        }
        if (str_starts_with($t, '=')) {
            $t = trim(ltrim($t, '='), '"');
        }
        if (preg_match('/^\d+\.0+$/', $t)) {
            $t = substr($t, 0, strpos($t, '.'));
        }

        return $t;
    }

    /** "yyyy-mm-dd" -> numero do plano (nov/dez contam no ano seguinte). */
    public static function planoDaData(?string $iso): ?int
    {
        if ($iso && preg_match('/^(\d{4})-(\d{2})-\d{2}/', $iso, $m)) {
            return (int) $m[2] >= 11 ? (int) $m[1] + 1 : (int) $m[1];
        }

        return null;
    }

    public static function intervaloPlano(int $plano): array
    {
        return ['inicio' => sprintf('%d-11-01', $plano - 1), 'fim' => sprintf('%d-10-31', $plano)];
    }

    /** "88976420.0" -> "88976420" (numero lido como decimal). */
    public static function semPontoZero(string $t): string
    {
        return preg_match('/^(\d+)\.0+$/', $t, $m) ? $m[1] : $t;
    }
}
