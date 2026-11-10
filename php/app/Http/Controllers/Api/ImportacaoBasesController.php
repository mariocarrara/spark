<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Importacao de Bases pequenas (tela "Importação de Bases"): o NAVEGADOR le a planilha e manda as linhas.
 *   POST /api/importacao/validar   {base, linhas}  -> pre-visualizacao + erros linha a linha (nao grava)
 *   POST /api/importacao/confirmar {base, linhas, arquivoOrigem} -> grava pela chave unica (sem duplicar)
 * Contrato de routes/importacao.ps1 + lib/Validacao.ps1 ($Script:ImportSchemas, Get-PosProcessarDaBase).
 * Diferencas: Equipes nao reativa equipe desativada (regra v3.5.2 do legado, que so valia no outro caminho);
 * Metas repetidas no mesmo arquivo (mesma equipe+tipo+mes) -> vale a PRIMEIRA linha (a que a tela do legado mostra; o legado gravava todas).
 * Vao, Protecao e VERA tem importacao propria (arquivos grandes) e ficam para depois.
 */
class ImportacaoBasesController extends Controller
{
    /** coluna, tipo, obrigatorio, apelidos (ImportSchemas do legado). */
    private const SCHEMAS = [
        'Metas' => [['CodigoEquipe', 'texto', true], ['AnoMes', 'anomes', true], ['MetaMensal', 'numero', true], ['Servico', 'texto', false]],
        'Equipes' => [['CodigoEquipe', 'texto', true], ['TipoEquipe', 'texto', true], ['Polo', 'texto', true], ['Regional', 'texto', true],
            ['Departamento', 'texto', true], ['ProprioTerceiro', 'texto', true], ['EquipePoda', 'booleano', true], ['BaseLat', 'numero', false], ['BaseLng', 'numero', false]],
        'Prefeituras' => [['Municipio', 'texto', true], ['ContatoNome', 'texto', true], ['Email', 'email', true], ['Telefone', 'texto', false]],
        'PrioridadeEW' => [['Prioridade', 'texto', true], ['Grupo Recurso', 'texto', true], ['Prioridade EW', 'texto', true], ['Chave', 'texto', false],
            ['Tensão', 'texto', false], ['Regional', 'texto', false]],
        'Esquemas' => [['CODIGO', 'texto', true, ['Código', 'CÓDIGO', 'Codigo']],
            ['DESCRICAO ESQUEMA', 'texto', true, ['DESCRIÇÃO ESQUEMA', 'Descrição Esquema', 'Descricao Esquema', 'DescEsquema']], ['TIPO', 'texto', false, ['Tipo']]],
        'Conjuntos' => [['Alimentador', 'texto', true, ['ALIMENTADOR', 'alimentador']],
            ['Nome Conjunto', 'texto', true, ['NOME CONJUNTO', 'NomeConjunto', 'Nome do Conjunto', 'Conjunto Nome', 'Nome_Conjunto']]],
        'Localidades' => [['COD LOCALIDADE', 'texto', true], ['POLO', 'texto', true], ['LOCALIDADE', 'texto', true], ['POSTO OPERACIONAL', 'texto', false],
            ['POLO2', 'texto', false], ['REGIONAL', 'texto', false], ['COORDENADOR RESPONSÁVEL', 'texto', false], ['SUPERVISOR RESPONSÁVEL', 'texto', false],
            ['PONTO FOCAL RESPONSÁVEL', 'texto', false], ['COD LOCALIDADE2', 'texto', false]],
    ];

    private const GRANDES = ['Vao', 'Protecao', 'VERA'];

    public function validar(Request $r): JsonResponse
    {
        $base = (string) $r->input('base', '');
        if ($x = $this->baseInvalida($base)) {
            return $x;
        }
        $linhas = array_values((array) $r->input('linhas', []));
        [$validas, $erros] = self::validarLinhas($base, $linhas);

        return response()->json(['base' => $base, 'totalLinhas' => count($linhas), 'validas' => count($validas), 'totalErros' => count($erros),
            'erros' => array_slice($erros, 0, 500), 'preVisualizacao' => array_slice($validas, 0, 20)]);
    }

    public function confirmar(Request $r): JsonResponse
    {
        $base = (string) $r->input('base', '');
        if ($x = $this->baseInvalida($base)) {
            return $x;
        }
        $eu = $r->user();
        $modulo = ['Metas' => 'metas', 'Prefeituras' => 'prefeituras'][$base] ?? 'manutencao';
        if (! $eu->pode($modulo, 'importar')) {
            return response()->json(['erro' => "Sem permissão para importar $base."], 403);
        }
        [$validas, $erros] = self::validarLinhas($base, array_values((array) $r->input('linhas', [])));
        DB::transaction(fn () => $this->{'gravar'.$base}($validas, $eu));

        $log = ['id' => (string) Str::uuid(), 'base' => $base, 'usuarioId' => $eu->id, 'dataHora' => Carbon::now()->toIso8601String(),
            'registrosProcessados' => count($validas), 'registrosComErro' => count($erros), 'arquivoOrigem' => $r->input('arquivoOrigem')];
        DB::table('importacoes_log')->insert(['id' => $log['id'], 'data_hora' => now(), 'usuario_id' => $eu->id, 'base' => $base,
            'arquivo_origem' => $log['arquivoOrigem'], 'registros_processados' => $log['registrosProcessados'], 'registros_com_erro' => $log['registrosComErro']]);
        Auditoria::registrar('importar', 'bases', $base, $eu->id, ['validas' => count($validas), 'erros' => count($erros), 'arquivo' => $log['arquivoOrigem']], $r->ip());

        return response()->json(['processados' => count($validas), 'erros' => $erros, 'log' => $log]);
    }

    private function baseInvalida(string $base): ?JsonResponse
    {
        if (in_array($base, self::GRANDES, true)) {
            return response()->json(['erro' => "A importação de $base ainda não foi migrada para o sistema novo."], 400);
        }

        return isset(self::SCHEMAS[$base]) ? null : response()->json(['erro' => "Base de importação desconhecida: $base"], 400);
    }

    /** Test-ImportRows: [linhas validas, erros {numeroLinha, coluna, motivo}]. Linha 1 = cabecalho. */
    public static function validarLinhas(string $base, array $linhas): array
    {
        $validas = [];
        $erros = [];
        foreach ($linhas as $i => $row) {
            $row = (array) $row;
            $ok = true;
            foreach (self::SCHEMAS[$base] as $col) {
                [$nome, $tipo, $obrig] = $col;
                $v = self::campo($row, $nome);
                if (self::vazio($v)) {
                    foreach ($col[3] ?? [] as $alias) {
                        $va = self::campo($row, $alias);
                        if (! self::vazio($va)) {
                            $v = $va;
                            break;
                        }
                    }
                }
                if ($obrig && ! self::valorOk($tipo, $v)) {
                    $erros[] = ['numeroLinha' => $i + 2, 'coluna' => $nome, 'motivo' => "$nome ausente ou fora do formato esperado ($tipo)"];
                    $ok = false;
                }
            }
            if ($ok) {
                $validas[] = $row;
            }
        }

        return [$validas, $erros];
    }

    // ------------------------------------------------------------------ gravacao por base

    private function gravarMetas(array $linhas, $eu): void
    {
        $feriados = DB::table('feriados')->pluck('data')->map(fn ($d) => substr((string) $d, 0, 10))->flip();
        $porChave = [];
        foreach ($linhas as $row) {
            $equipe = trim((string) self::campo($row, 'CodigoEquipe'));
            $anoMes = trim((string) self::campo($row, 'AnoMes'));
            $tipo = preg_match('/faixa|limpeza/i', (string) self::campo($row, 'Servico')) ? 'faixa' : 'poda';
            $mensal = (float) str_replace(',', '.', (string) self::campo($row, 'MetaMensal'));
            $dias = self::diasUteis($anoMes, $feriados);
            // repetida no mesmo arquivo: vale a PRIMEIRA (a que a tela do legado usa) - regra a confirmar com o Mario
            $porChave["$equipe|$tipo|$anoMes"] ??= ['equipe_id' => $equipe, 'tipo' => $tipo, 'ano_mes' => $anoMes, 'meta_mensal' => $mensal, 'dias_uteis' => $dias,
                'meta_diaria' => $dias > 0 ? round($mensal / $dias, 2) : 0, 'origem' => 'Importado', 'atualizado_por' => $eu->nome, 'atualizado_em' => now()];
        }
        foreach ($porChave as $m) {
            $id = DB::table('metas')->where('equipe_id', $m['equipe_id'])->where('tipo', $m['tipo'])->where('ano_mes', $m['ano_mes'])->value('id');
            if ($id) {
                DB::table('metas')->where('id', $id)->update($m);
            } else {
                DB::table('metas')->insert($m + ['id' => (string) Str::uuid()]);
            }
        }
    }

    private function gravarEquipes(array $linhas): void
    {
        foreach ($linhas as $row) {
            $id = trim((string) self::campo($row, 'CodigoEquipe'));
            $ativaTxt = mb_strtolower(trim((string) (self::campo($row, 'Ativa') ?? self::campo($row, 'Ativo') ?? '')));
            $existe = DB::table('equipes')->where('id', $id)->first(['ativo']);
            $ativo = $ativaTxt !== '' ? ! preg_match('/^(false|0|n[aã]o|inativ[oa]|n)$/u', $ativaTxt) : ($existe ? (bool) $existe->ativo : true);
            $dados = ['nome' => $id, 'tipo_equipe' => self::texto(self::campo($row, 'TipoEquipe')), 'polo' => self::texto(self::campo($row, 'Polo')),
                'regional' => self::texto(self::campo($row, 'Regional')), 'departamento' => self::texto(self::campo($row, 'Departamento')),
                'proprio_terceiro' => self::texto(self::campo($row, 'ProprioTerceiro')),
                'equipe_poda' => in_array(mb_strtolower(trim((string) self::campo($row, 'EquipePoda'))), ['true', 'sim', '1'], true), 'ativo' => $ativo];
            DB::table('equipes')->updateOrInsert(['id' => $id], $dados);
            $lat = self::numero(self::campo($row, 'BaseLat'));
            $lng = self::numero(self::campo($row, 'BaseLng'));
            DB::update('UPDATE equipes SET base = '.($lat !== null && $lng !== null ? 'ST_SetSRID(ST_MakePoint(?, ?), 4326)' : 'NULL').' WHERE id = ?',
                $lat !== null && $lng !== null ? [$lng, $lat, $id] : [$id]);
        }
    }

    private function gravarPrioridadeEW(array $linhas): void
    {
        foreach ($linhas as $row) {
            $pri = self::campo($row, 'Prioridade');
            $grp = self::campo($row, 'Grupo Recurso');
            $ten = self::campo($row, 'Tensão');
            $reg = self::campo($row, 'Regional');
            $ch = self::campo($row, 'Chave');
            if (self::vazio($ch)) {
                $ch = "$ten-$pri-$grp-$reg";
            }
            DB::table('prioridade_ew')->updateOrInsert(['chave' => (string) $ch], ['grupo_recurso' => self::texto($grp), 'prioridade_ew' => self::texto(self::campo($row, 'Prioridade EW')),
                'prioridade' => self::texto($pri), 'regional' => self::texto($reg), 'tensao' => self::texto($ten)]);
        }
    }

    private function gravarEsquemas(array $linhas): void
    {
        foreach ($linhas as $row) {
            $cod = trim((string) self::comAlias($row, ['CODIGO', 'Código', 'CÓDIGO', 'Codigo']));
            DB::table('esquemas')->updateOrInsert(['codigo' => $cod], [
                'descricao' => trim((string) self::comAlias($row, ['DESCRICAO ESQUEMA', 'DESCRIÇÃO ESQUEMA', 'Descrição Esquema', 'Descricao Esquema', 'DescEsquema'])),
                'tipo' => trim((string) self::comAlias($row, ['TIPO', 'Tipo']))]);
        }
    }

    private function gravarConjuntos(array $linhas): void
    {
        foreach ($linhas as $row) {
            $alim = mb_strtoupper(trim((string) self::porCabecalho($row, ['alimentador'])));
            $tens = self::porPrefixo($row, 'tens');   // 2 colunas: a 1a numerica (13,8) e a 2a faixa (11,4/13,8)
            DB::table('conjuntos')->where('alimentador', $alim)->delete();
            DB::table('conjuntos')->insert(['alimentador' => $alim,
                'cod_conjunto' => trim((string) self::porCabecalho($row, ['conjunto', 'codconjunto', 'codigoconjunto', 'codigodoconjunto', 'cdconjunto'])),
                'nome_conjunto' => trim((string) self::porCabecalho($row, ['nomeconjunto', 'nomedoconjunto', 'conjuntonome'])),
                'regional' => trim((string) self::porCabecalho($row, ['regional'])), 'sigla' => trim((string) self::porCabecalho($row, ['sigla'])),
                'tensao_nominal' => count($tens) >= 2 ? trim((string) $tens[0]) : '', 'tensao' => count($tens) >= 2 ? trim((string) $tens[1]) : trim((string) ($tens[0] ?? ''))]);
        }
    }

    /** Sem tabela propria ainda: lista intacta no legado_bruto (como veio do sistema antigo), pela chave. */
    private function gravarPrefeituras(array $linhas): void
    {
        $this->gravarNoBruto('prefeituras', 'municipio', array_map(fn ($row) => ['municipio' => self::campo($row, 'Municipio'),
            'contatoNome' => self::campo($row, 'ContatoNome'), 'email' => self::campo($row, 'Email'), 'telefone' => self::campo($row, 'Telefone'), 'ativo' => true], $linhas));
    }

    private function gravarLocalidades(array $linhas): void
    {
        $mapa = ['codLocalidade' => 'COD LOCALIDADE', 'polo' => 'POLO', 'localidade' => 'LOCALIDADE', 'postoOperacional' => 'POSTO OPERACIONAL', 'polo2' => 'POLO2',
            'regional' => 'REGIONAL', 'coordenadorResponsavel' => 'COORDENADOR RESPONSÁVEL', 'supervisorResponsavel' => 'SUPERVISOR RESPONSÁVEL',
            'pontoFocalResponsavel' => 'PONTO FOCAL RESPONSÁVEL', 'codLocalidade2' => 'COD LOCALIDADE2'];
        $this->gravarNoBruto('localidades', 'codLocalidade', array_map(function ($row) use ($mapa) {
            $r = [];
            foreach ($mapa as $campo => $col) {
                $r[$campo] = self::campo($row, $col);
            }

            return $r;
        }, $linhas));
    }

    private function gravarNoBruto(string $entidade, string $chave, array $novos): void
    {
        $atual = json_decode((string) DB::table('legado_bruto')->where('entidade', $entidade)->lockForUpdate()->value('dados'), true) ?: [];
        $porChave = [];
        foreach ($atual as $x) {
            $porChave[(string) ($x[$chave] ?? '')] = $x;
        }
        foreach ($novos as $x) {
            $porChave[(string) ($x[$chave] ?? '')] = $x;
        }
        DB::table('legado_bruto')->updateOrInsert(['entidade' => $entidade], ['dados' => json_encode(array_values($porChave), JSON_UNESCAPED_UNICODE), 'importado_em' => now()]);
    }

    // ------------------------------------------------------------------ apoio

    /** Campo da linha sem diferenca de maiusculas (como o PowerShell), valor como veio. */
    private static function campo(array $row, string $nome)
    {
        if (array_key_exists($nome, $row)) {
            return $row[$nome];
        }
        $n = mb_strtolower($nome);
        foreach ($row as $k => $v) {
            if (mb_strtolower((string) $k) === $n) {
                return $v;
            }
        }

        return null;
    }

    private static function comAlias(array $row, array $nomes)
    {
        foreach ($nomes as $n) {
            $v = self::campo($row, $n);
            if (! self::vazio($v)) {
                return $v;
            }
        }

        return null;
    }

    /** "Nome Conjunto" / "NOME_CONJUNTO" / "Tensão" -> "nomeconjunto" / "tensao". */
    private static function chaveCabecalho(string $t): string
    {
        if (class_exists(\Normalizer::class)) {
            $t = preg_replace('/\p{Mn}/u', '', \Normalizer::normalize($t, \Normalizer::FORM_D) ?: $t);
        } else {
            $t = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $t) ?: $t;
        }

        return mb_strtolower(preg_replace('/[^\p{L}\p{N}]/u', '', $t));
    }

    private static function porCabecalho(array $row, array $nomes)
    {
        foreach ($nomes as $n) {
            foreach ($row as $k => $v) {
                if (self::chaveCabecalho((string) $k) === $n && ! self::vazio($v)) {
                    return $v;
                }
            }
        }

        return null;
    }

    private static function porPrefixo(array $row, string $prefixo): array
    {
        $lista = [];
        foreach ($row as $k => $v) {
            if (str_starts_with(self::chaveCabecalho((string) $k), $prefixo)) {
                $lista[] = $v;
            }
        }

        return $lista;
    }

    private static function vazio($v): bool
    {
        return $v === null || (is_string($v) && trim($v) === '');
    }

    /** Test-CampoValor. */
    private static function valorOk(string $tipo, $v): bool
    {
        if (self::vazio($v) || is_array($v)) {
            return false;
        }
        $t = is_bool($v) ? ($v ? 'True' : 'False') : (string) $v;

        return match ($tipo) {
            'numero' => (bool) preg_match('/^-?\d+([.,]\d+)?$/', $t),
            'anomes' => (bool) preg_match('/^\d{4}-\d{2}$/', $t),
            'booleano' => (bool) preg_match('/^(true|false|sim|nao|não|1|0)$/iu', $t),
            'email' => (bool) preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $t),
            default => true,
        };
    }

    private static function texto($v): ?string
    {
        return self::vazio($v) ? null : mb_substr(trim((string) $v), 0, 500);
    }

    private static function numero($v): ?float
    {
        $t = str_replace(',', '.', trim((string) $v));

        return is_numeric($t) ? (float) $t : null;
    }

    /** Dias uteis do mes: sem sabado, domingo e feriados cadastrados. */
    public static function diasUteis(string $anoMes, $feriados): int
    {
        [$a, $m] = array_map('intval', explode('-', $anoMes));
        $n = (int) date('t', strtotime(sprintf('%04d-%02d-01', $a, $m)));
        $uteis = 0;
        for ($d = 1; $d <= $n; $d++) {
            $iso = sprintf('%04d-%02d-%02d', $a, $m, $d);
            $dow = (int) date('N', strtotime($iso));
            if ($dow < 6 && ! isset($feriados[$iso])) {
                $uteis++;
            }
        }

        return $uteis;
    }
}
