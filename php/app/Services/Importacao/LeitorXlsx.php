<?php

namespace App\Services\Importacao;

use RuntimeException;
use XMLReader;
use ZipArchive;

/**
 * Le um .xlsx em STREAMING (linha a linha), so as colunas pedidas — mesma regra do SparkXlsxStream do legado
 * (lib/XlsxReader.ps1):
 *  - planilha: xl/worksheets/sheet1.xml (senao a primeira em ordem alfabetica);
 *  - linha 1 = cabecalho; nomes comparados sem diferenca de maiusculas, acento decomposto, espaco duro,
 *    espacos nas pontas ou repetidos;
 *  - valor = o texto da celula como gravado (data = numero serial do Excel; texto compartilhado resolvido).
 * Coluna pedida que nao existe na planilha vem como null.
 */
class LeitorXlsx
{
    /** Linhas de dados estimadas (pelo <dimension> da planilha), 0 se nao houver. */
    public int $totalEstimado = 0;

    public int $linhasLidas = 0;

    /** @var string[] colunas pedidas que existem na planilha */
    public array $encontradas = [];

    /** @var string[] cabecalhos reais (diagnostico) */
    public array $cabecalhos = [];

    public function __construct(private string $arquivo, private array $colunas)
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException('O PHP está sem a extensão "zip" (necessária para ler .xlsx). Ligue extension=zip no php.ini.');
        }
    }

    public static function norm(?string $t): string
    {
        if ($t === null) {
            return '';
        }
        if (class_exists(\Normalizer::class)) {
            $t = \Normalizer::normalize($t, \Normalizer::FORM_C) ?: $t;
        }
        $t = trim(str_replace("\u{00A0}", ' ', $t));
        $t = preg_replace('/ {2,}/', ' ', $t);

        return mb_strtolower($t);
    }

    /**
     * @param  callable|null  $progresso  fn(int $lidas, int $total) chamado a cada 2.000 linhas
     * @return \Generator<int, array<string, ?string>>
     */
    public function linhas(?callable $progresso = null): \Generator
    {
        $zip = new ZipArchive;
        if ($zip->open($this->arquivo) !== true) {
            throw new RuntimeException('Não consegui abrir o arquivo (não é um .xlsx válido?).');
        }
        $folha = 'xl/worksheets/sheet1.xml';
        if ($zip->locateName($folha) === false) {
            $nomes = [];
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $n = $zip->getNameIndex($i);
                if (preg_match('#^xl/worksheets/sheet[^/]*\.xml$#', $n)) {
                    $nomes[] = $n;
                }
            }
            sort($nomes, SORT_STRING);
            $folha = $nomes[0] ?? throw new RuntimeException('Não encontrei nenhuma planilha (xl/worksheets/*.xml) dentro do arquivo.');
        }
        $compart = $this->textosCompartilhados($zip);
        $zip->close();

        $r = new XMLReader;
        if (! $r->open('zip://'.$this->arquivo.'#'.$folha, null, LIBXML_NONET | LIBXML_COMPACT | LIBXML_PARSEHUGE)) {
            throw new RuntimeException('Não consegui ler a planilha do arquivo.');
        }
        $pedidas = [];
        foreach ($this->colunas as $c) {
            $pedidas[self::norm($c)][] = $c;
        }
        $posDaColuna = null; // indice da coluna (0-based) => [nomes pedidos]
        try {
            while ($r->read()) {
                if ($r->nodeType !== XMLReader::ELEMENT) {
                    continue;
                }
                if ($r->localName === 'dimension') {
                    $ref = (string) $r->getAttribute('ref');
                    if (preg_match('/:[A-Z]+(\d+)$/i', $ref, $m)) {
                        $this->totalEstimado = max(0, (int) $m[1] - 1);
                    }

                    continue;
                }
                if ($r->localName !== 'row') {
                    continue;
                }
                $celulas = $this->lerLinha($r, $compart);
                if ($posDaColuna === null) {
                    $posDaColuna = [];
                    ksort($celulas);
                    foreach ($celulas as $idx => $v) {
                        $this->cabecalhos[] = (string) $v;
                        $k = self::norm($v);
                        if ($k !== '' && isset($pedidas[$k]) && ! in_array($k, array_map([self::class, 'norm'], $this->encontradas), true)) {
                            $posDaColuna[$idx] = $pedidas[$k];
                            array_push($this->encontradas, ...$pedidas[$k]);
                        }
                    }

                    continue;
                }
                $linha = array_fill_keys($this->colunas, null);
                foreach ($posDaColuna as $idx => $nomes) {
                    if (isset($celulas[$idx])) {
                        foreach ($nomes as $n) {
                            $linha[$n] = $celulas[$idx];
                        }
                    }
                }
                $this->linhasLidas++;
                if ($progresso && $this->linhasLidas % 2000 === 0) {
                    $progresso($this->linhasLidas, $this->totalEstimado);
                }
                yield $linha;
            }
        } finally {
            $r->close();
        }
    }

    /** Le um <row> inteiro: [indice da coluna => texto]. */
    private function lerLinha(XMLReader $r, array $compart): array
    {
        $celulas = [];
        if ($r->isEmptyElement) {
            return $celulas;
        }
        $prof = $r->depth;
        $ultimo = -1;
        while ($r->read()) {
            if ($r->nodeType === XMLReader::END_ELEMENT && $r->depth === $prof) {
                break;
            }
            if ($r->nodeType !== XMLReader::ELEMENT || $r->localName !== 'c') {
                continue;
            }
            $ref = $r->getAttribute('r');
            $idx = $ref !== null ? self::indiceColuna($ref) : $ultimo + 1;
            $ultimo = $idx;
            $tipo = $r->getAttribute('t');
            $v = null;
            if (! $r->isEmptyElement) {
                $pc = $r->depth;
                $inline = $tipo === 'inlineStr';
                while ($r->read()) {
                    if ($r->nodeType === XMLReader::END_ELEMENT && $r->depth === $pc) {
                        break;
                    }
                    if ($r->nodeType === XMLReader::ELEMENT && ($r->localName === 'v' || $r->localName === 't')) {
                        $tx = $r->readString();
                        $v = ($v === null || ! $inline) ? $tx : $v.$tx;
                    }
                }
            }
            if ($tipo === 's' && $v !== null && $v !== '' && ctype_digit($v)) {
                $v = $compart[(int) $v] ?? $v;
            }
            $celulas[$idx] = $v;
        }

        return $celulas;
    }

    private function textosCompartilhados(ZipArchive $zip): array
    {
        $xml = $zip->getStream('xl/sharedStrings.xml');
        if (! $xml) {
            return [];
        }
        fclose($xml);
        $lista = [];
        $r = new XMLReader;
        $r->open('zip://'.$this->arquivo.'#xl/sharedStrings.xml', null, LIBXML_NONET | LIBXML_COMPACT | LIBXML_PARSEHUGE);
        while ($r->read()) {
            if ($r->nodeType !== XMLReader::ELEMENT || $r->localName !== 'si') {
                continue;
            }
            if ($r->isEmptyElement) {
                $lista[] = '';

                continue;
            }
            $prof = $r->depth;
            $txt = '';
            while ($r->read()) {
                if ($r->nodeType === XMLReader::END_ELEMENT && $r->depth === $prof) {
                    break;
                }
                // junta todos os <t> do item (texto com formatacao vem em pedacos), como o legado
                if ($r->nodeType === XMLReader::ELEMENT && $r->localName === 't') {
                    $txt .= $r->readString();
                }
            }
            $lista[] = $txt;
        }
        $r->close();

        return $lista;
    }

    private static function indiceColuna(string $ref): int
    {
        $col = 0;
        $n = strlen($ref);
        for ($i = 0; $i < $n; $i++) {
            $c = ord($ref[$i]) | 0x20; // minuscula
            if ($c < 97 || $c > 122) {
                break;
            }
            $col = $col * 26 + ($c - 96);
        }

        return $col - 1;
    }
}
