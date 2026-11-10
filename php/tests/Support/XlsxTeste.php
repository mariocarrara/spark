<?php

namespace Tests\Support;

use ZipArchive;

/** Gera um .xlsx minimo (sheet1 + sharedStrings) para testes. Numero vira celula numerica; texto vira texto compartilhado. */
class XlsxTeste
{
    public static function criar(array $linhas): string
    {
        $arq = tempnam(sys_get_temp_dir(), 'xlsx').'.xlsx';
        $sst = [];
        $xmlLinhas = '';
        foreach ($linhas as $i => $linha) {
            $r = $i + 1;
            $xmlLinhas .= "<row r=\"$r\">";
            foreach (array_values($linha) as $j => $v) {
                if ($v === null) {
                    continue;
                }
                $ref = self::coluna($j).$r;
                if (is_int($v) || is_float($v)) {
                    $xmlLinhas .= "<c r=\"$ref\"><v>$v</v></c>";
                } else {
                    $sst[] = $v;
                    $xmlLinhas .= "<c r=\"$ref\" t=\"s\"><v>".(count($sst) - 1).'</v></c>';
                }
            }
            $xmlLinhas .= '</row>';
        }
        $ultima = self::coluna(max(array_map('count', $linhas)) - 1).count($linhas);
        $z = new ZipArchive;
        $z->open($arq, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $z->addFromString('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
        $z->addFromString('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>');
        $z->addFromString('xl/worksheets/sheet1.xml', '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            ."<dimension ref=\"A1:$ultima\"/><sheetData>$xmlLinhas</sheetData></worksheet>");
        $si = implode('', array_map(fn ($t) => '<si><t xml:space="preserve">'.htmlspecialchars($t, ENT_XML1).'</t></si>', $sst));
        $z->addFromString('xl/sharedStrings.xml', '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'.count($sst).'">'.$si.'</sst>');
        $z->close();

        return $arq;
    }

    /** "2026-03-10" -> numero serial do Excel. */
    public static function serial(string $data): int
    {
        return (int) round((strtotime($data.' 00:00:00 UTC') - strtotime('1899-12-30 00:00:00 UTC')) / 86400);
    }

    private static function coluna(int $i): string
    {
        $s = '';
        for ($i++; $i > 0; $i = intdiv($i - 1, 26)) {
            $s = chr(65 + ($i - 1) % 26).$s;
        }

        return $s;
    }
}
