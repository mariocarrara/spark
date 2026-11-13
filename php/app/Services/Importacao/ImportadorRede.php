<?php

namespace App\Services\Importacao;

use App\Services\RedeGeo;
use RuntimeException;

/**
 * Rede MT/BT/AT por Shapefile (.shp + .dbf [+ .prj], soltos ou num .zip) e Reserva Legal / APP por KMZ
 * (um .kmz por alimentador) — porte de lib/ShapefileImporter.ps1 e lib/KmzImporter.ps1.
 * Grava em rede_feicoes via RedeGeo, um alimentador por vez: base INCREMENTAL (so os alimentadores do arquivo mudam).
 */
class ImportadorRede
{
    /** @var callable|null */
    private $avisar;

    public function __construct(?callable $avisar = null)
    {
        $this->avisar = $avisar;
    }

    private function aviso(array $p): void
    {
        if ($this->avisar) {
            ($this->avisar)($p);
        }
    }

    /** Mesma limpeza do Get-NomeArquivoSeguro: sem caracteres de controle nem \ / : * ? " < > | */
    public static function chaveSegura(?string $t): string
    {
        $t = preg_replace('/[\x00-\x1F\x7F]/', '', (string) $t);
        $t = preg_replace('/[\\\\\/:*?"<>|]/', '_', $t);
        $t = rtrim(trim($t), '.');

        return preg_match('/^(CON|PRN|AUX|NUL|COM\d|LPT\d)$/i', $t) ? "_$t" : $t;
    }

    // ------------------------------------------------------------------ Shapefile (rede)

    /** @param array<string,string> $arquivos nome original => caminho temporario */
    public function shapefile(string $camada, array $arquivos): array
    {
        $shp = $dbf = $prj = null;
        foreach ($arquivos as $nome => $caminho) {
            $ext = strtolower(pathinfo($nome, PATHINFO_EXTENSION));
            if ($ext === 'zip') {
                $z = new \ZipArchive;
                if ($z->open($caminho) !== true) {
                    throw new RuntimeException("Não consegui abrir o .zip {$nome}.");
                }
                for ($i = 0; $i < $z->numFiles; $i++) {
                    $n = strtolower($z->getNameIndex($i));
                    if (str_ends_with($n, '.shp')) {
                        $shp = $z->getFromIndex($i);
                    } elseif (str_ends_with($n, '.dbf')) {
                        $dbf = $z->getFromIndex($i);
                    } elseif (str_ends_with($n, '.prj')) {
                        $prj = $z->getFromIndex($i);
                    }
                }
                $z->close();
            } elseif ($ext === 'shp') {
                $shp = file_get_contents($caminho);
            } elseif ($ext === 'dbf') {
                $dbf = file_get_contents($caminho);
            } elseif ($ext === 'prj') {
                $prj = file_get_contents($caminho);
            }
        }
        if ($shp === null || $dbf === null) {
            throw new RuntimeException('Faltam arquivos — preciso do .shp e do .dbf juntos (ou de um .zip com eles dentro).');
        }
        $avisoProjecao = ($prj !== null && str_contains($prj, 'PROJCS') && ! str_contains($prj, 'GEOGCS'))
            ? 'O .prj indica um sistema de coordenadas PROJETADO (metros), não geográfico (graus). As coordenadas precisam ser convertidas antes de plotar no Leaflet.' : null;

        $geos = $this->lerShp($shp);
        unset($shp);
        $porAlim = [];
        $rejeitados = 0;
        $i = 0;
        foreach ($this->lerDbf($dbf) as $attr) {
            $geo = $geos[$i] ?? null;
            $i++;
            if (! $geo || $attr['__excluido'] || count($geo) < 2) {
                $rejeitados++;

                continue;
            }
            $ctmt = self::chaveSegura($attr['CTMT'] ?? '');
            if ($ctmt === '') {
                $ctmt = RedeGeo::SEM_ALIMENTADOR;
            }
            $nome = '';
            foreach (['CT_COD_OP', 'NOM_ALIM', 'NOME'] as $c) {
                if (trim((string) ($attr[$c] ?? '')) !== '') {
                    $nome = trim($attr[$c]);
                    break;
                }
            }
            $comp = is_numeric($attr['COMP'] ?? null) ? (float) $attr['COMP'] : 0.0;
            $porAlim[$ctmt][] = ['type' => 'Feature', 'properties' => ['COD_ID' => (string) ($attr['COD_ID'] ?? ''), 'CTMT' => $ctmt,
                'NOM_ALIM' => $nome === '' ? null : $nome, 'CT_COD_OP' => $nome === '' ? null : $nome, 'SUB' => (string) ($attr['SUB'] ?? ''),
                'FAS_CON' => (string) ($attr['FAS_CON'] ?? ''), 'TIP_CND' => (string) ($attr['TIP_CND'] ?? ''), 'COMP' => $comp],
                'geometry' => ['type' => 'LineString', 'coordinates' => $geo]];
            if ($i % 20000 === 0) {
                $this->aviso(['fase' => 'cruzando', 'linha' => $i, 'total' => count($geos), 'percentual' => min(99, round(100 * $i / max(1, count($geos)), 1))]);
            }
        }
        unset($geos);
        $c = RedeGeo::CAMADAS[$camada];
        $n = 0;
        $trechos = 0;
        $total = count($porAlim);
        foreach ($porAlim as $ctmt => $features) {
            $nomes = [];
            $metros = 0.0;
            foreach ($features as $f) {
                $metros += $f['properties']['COMP'];
                if ($f['properties']['CT_COD_OP'] !== null) {
                    $nomes[$f['properties']['CT_COD_OP']] = true;
                }
            }
            $nomes = array_keys($nomes);
            sort($nomes, SORT_STRING);
            $primeiro = null;
            foreach ($features as $f) {
                if ($f['properties']['CT_COD_OP'] !== null) {
                    $primeiro = $f['properties']['CT_COD_OP'];
                    break;
                }
            }
            $r = RedeGeo::gravarAlimentador($c, (string) $ctmt, $features, $primeiro ?? (string) $ctmt, $nomes, round($metros, 1));
            $trechos += $r['trechos'];
            $n++;
            $this->aviso(['fase' => 'gravando', 'arquivo' => "$n de $total alimentadores", 'linha' => $n, 'total' => $total, 'percentual' => min(99, round(100 * $n / max(1, $total), 1))]);
        }

        return ['alimentadores' => $n, 'trechos' => $trechos, 'rejeitados' => $rejeitados, 'errosDetalhe' => null, 'avisoProjecao' => $avisoProjecao, 'particionado' => true];
    }

    /** Geometrias do .shp: Polyline/Polygon (todas as partes em sequencia, como o legado) e Point; [lng, lat] com 6 casas. */
    private function lerShp(string $b): array
    {
        $tam = unpack('N', substr($b, 24, 4))[1] * 2;
        $pos = 100;
        $saida = [];
        $len = min($tam, strlen($b));
        while ($pos + 8 <= $len) {
            $conteudo = unpack('N', substr($b, $pos + 4, 4))[1] * 2;
            $ini = $pos + 8;
            $tipo = unpack('V', substr($b, $ini, 4))[1];
            $geo = null;
            if (in_array($tipo, [3, 5, 13, 15, 23, 25], true)) {
                $p = $ini + 4 + 32;
                [$nParts, $nPts] = array_values(unpack('V2', substr($b, $p, 8)));
                $p += 8 + 4 * $nParts;
                $xy = unpack('e'.(2 * $nPts), substr($b, $p, 16 * $nPts));
                $geo = [];
                for ($k = 1; $k <= 2 * $nPts; $k += 2) {
                    $geo[] = [round($xy[$k], 6), round($xy[$k + 1], 6)];
                }
            } elseif (in_array($tipo, [1, 11, 21], true)) {
                $xy = unpack('e2', substr($b, $ini + 4, 16));
                $geo = [[round($xy[1], 6), round($xy[2], 6)]];
            }
            $saida[] = $geo;
            $pos = $ini + $conteudo;
        }

        return $saida;
    }

    /** Registros do .dbf (Latin-1 -> UTF-8, aparados); __excluido = marcado com '*'. */
    private function lerDbf(string $b): \Generator
    {
        $n = unpack('V', substr($b, 4, 4))[1];
        $cab = unpack('v', substr($b, 8, 2))[1];
        $reg = unpack('v', substr($b, 10, 2))[1];
        $campos = [];
        for ($pos = 32; $pos < strlen($b) && $b[$pos] !== "\x0D"; $pos += 32) {
            $campos[] = [rtrim(explode("\0", substr($b, $pos, 11))[0]), ord($b[$pos + 16])];
        }
        for ($i = 0, $off = $cab; $i < $n && $off + $reg <= strlen($b); $i++, $off += $reg) {
            $v = ['__excluido' => $b[$off] === '*'];
            $p = $off + 1;
            foreach ($campos as [$nome, $t]) {
                $v[$nome] = trim(mb_convert_encoding(substr($b, $p, $t), 'UTF-8', 'ISO-8859-1'));
                $p += $t;
            }
            yield $v;
        }
    }

    // ------------------------------------------------------------------ KMZ (Reserva Legal / APP)

    /** @param array<string,string> $arquivos nome original => caminho temporario */
    public function kmz(string $camada, array $arquivos): array
    {
        $kmz = array_filter($arquivos, fn ($n) => str_ends_with(strtolower($n), '.kmz'), ARRAY_FILTER_USE_KEY);
        if (! $kmz) {
            throw new RuntimeException("Nenhum arquivo .kmz recebido. Envie um ou mais arquivos '.kmz' (um por alimentador).");
        }
        $c = RedeGeo::CAMADAS[$camada];
        $ok = 0;
        $poligonos = 0;
        $rejeitados = 0;
        $erros = [];
        $i = 0;
        foreach ($kmz as $nome => $caminho) {
            $i++;
            $this->aviso(['fase' => 'lendo-kmz', 'arquivo' => $i, 'total' => count($kmz), 'percentual' => min(99, round(100 * $i / count($kmz), 1))]);
            try {
                [$alim, $features, $contagens] = $this->lerKmz($nome, $caminho);
                $alim = self::chaveSegura($alim);
                if (! $features) {
                    throw new RuntimeException("Nenhum polígono válido encontrado ($contagens).");
                }
                if ($alim === '') {
                    throw new RuntimeException('Código do alimentador ficou vazio depois de limpar caracteres inválidos.');
                }
                RedeGeo::gravarAlimentador($c, $alim, $features, $alim);
                $poligonos += count($features);
                $ok++;
            } catch (\Throwable $e) {
                $rejeitados++;
                $erros[] = ['arquivo' => $nome, 'motivo' => $e->getMessage()];
            }
        }

        return ['alimentadores' => $ok, 'trechos' => $poligonos, 'rejeitados' => $rejeitados, 'errosDetalhe' => $erros, 'avisoProjecao' => null, 'particionado' => true];
    }

    private function lerKmz(string $nome, string $caminho): array
    {
        $z = new \ZipArchive;
        if ($z->open($caminho) !== true) {
            throw new RuntimeException("Não consegui abrir o .kmz '{$nome}'.");
        }
        $kml = null;
        for ($k = 0; $k < $z->numFiles; $k++) {
            if (str_ends_with(strtolower($z->getNameIndex($k)), '.kml')) {
                $kml = $z->getFromIndex($k);
                break;
            }
        }
        $z->close();
        if ($kml === null) {
            throw new RuntimeException("Não encontrei nenhum .kml dentro do .kmz '{$nome}'.");
        }
        $doc = new \DOMDocument;
        if (! @$doc->loadXML($kml, LIBXML_NONET | LIBXML_COMPACT | LIBXML_PARSEHUGE)) {
            throw new RuntimeException("O .kml dentro de '{$nome}' não é um XML válido.");
        }
        $x = new \DOMXPath($doc);
        $alim = null;
        if (preg_match('/Trecho[_-](.+?)[_-](APP|RL)\.kmz$/i', $nome, $m)) {
            $alim = $m[1];
        } else {
            $d = $x->query("//*[local-name()='Document']")->item(0);
            $cand = $d ? ($d->getAttribute('id') ?: (($n = $x->query("*[local-name()='name']", $d)->item(0)) ? $n->textContent : '')) : '';
            if ($cand !== '' && preg_match('/Trecho[_-](.+?)[_-](APP|RL)$/i', $cand, $m)) {
                $alim = $m[1];
            }
        }
        if ($alim === null || trim($alim) === '') {
            throw new RuntimeException("Não consegui identificar o alimentador no arquivo '{$nome}' — nomeie o .kmz como 'Trecho_<ALIMENTADOR>_APP.kmz' ou '..._RL.kmz' (mesmo padrão dos arquivos de exemplo).");
        }
        $features = [];
        $pms = $x->query("//*[local-name()='Placemark']");
        foreach ($pms as $pm) {
            $props = [];
            $nm = $x->query("*[local-name()='name']", $pm)->item(0);
            if ($nm && trim($nm->textContent) !== '') {
                $props['NOME'] = $nm->textContent;
            }
            $desc = $x->query("*[local-name()='description']", $pm)->item(0);
            if ($desc && preg_match_all('/<td>\s*([^<]*?)\s*<\/td>\s*<td[^>]*>\s*([^<]*?)\s*<\/td>/', $desc->textContent, $pares, PREG_SET_ORDER)) {
                foreach ($pares as $p) {
                    $k = trim($p[1]);
                    if ($k !== '' && ! array_key_exists($k, $props)) {
                        $props[$k] = trim($p[2]);
                    }
                }
            }
            foreach ($x->query(".//*[local-name()='Polygon']", $pm) as $poly) {
                $co = $x->query("*[local-name()='outerBoundaryIs']/*[local-name()='LinearRing']/*[local-name()='coordinates']", $poly)->item(0);
                if (! $co || trim($co->textContent) === '') {
                    continue;
                }
                $anel = [];
                foreach (preg_split('/\s+/', trim($co->textContent)) as $tok) {
                    $pt = explode(',', $tok);
                    if (count($pt) >= 2 && is_numeric($pt[0]) && is_numeric($pt[1])) {
                        $anel[] = [(float) $pt[0], (float) $pt[1]];
                    }
                }
                if (count($anel) >= 3) {
                    if ($anel[0] !== end($anel)) {
                        $anel[] = $anel[0];   // o PostGIS exige anel fechado
                    }
                    $features[] = ['type' => 'Feature', 'properties' => $props, 'geometry' => ['type' => 'Polygon', 'coordinates' => [$anel]]];
                }
            }
        }
        $cont = 'Placemark: '.$pms->length.'; Polygon: '.$x->query("//*[local-name()='Polygon']")->length.'; LineString: '.$x->query("//*[local-name()='LineString']")->length
            .'; Point: '.$x->query("//*[local-name()='Point']")->length;

        return [$alim, $features, $cont];
    }
}
