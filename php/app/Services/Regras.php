<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Regras de importacao editaveis (lib/Regras.ps1, v3.33.0): QUANDO (condicoes) + ENTAO (acoes com formula).
 * Ficam na tabela `regras` (historico em `regras_historico`). Usadas pelo importador das grids SGM
 * (executada e pendente) e pela tela Configuracao > Regras de importacao (validar / simular).
 * Formulas: numeros (virgula decimal), [Campo], + - * / ( ), > < >= <= = <>, SE, SOMA, ARREDONDAR, MAXIMO, MINIMO, ABS; argumentos com ";".
 */
class Regras
{
    public const CAMPOS = [
        ['chave' => 'esquema', 'rotulo' => 'Esquema', 'tipo' => 'texto', 'leitura' => true],
        ['chave' => 'tipoServico', 'rotulo' => 'Tipo de serviço', 'tipo' => 'texto', 'leitura' => false],
        ['chave' => 'previstoPoda', 'rotulo' => 'Previsto poda', 'tipo' => 'num', 'leitura' => false],
        ['chave' => 'previstoLimpeza', 'rotulo' => 'Previsto limpeza', 'tipo' => 'num', 'leitura' => false],
        ['chave' => 'previstoEstrutura', 'rotulo' => 'Previsto estrutura', 'tipo' => 'num', 'leitura' => false],
        ['chave' => 'realizadoPoda', 'rotulo' => 'Realizado poda', 'tipo' => 'num', 'leitura' => false],
        ['chave' => 'realizadoLimpeza', 'rotulo' => 'Realizado limpeza', 'tipo' => 'num', 'leitura' => false],
        ['chave' => 'realizadoEstrutura', 'rotulo' => 'Realizado estrutura', 'tipo' => 'num', 'leitura' => false],
        ['chave' => 'previstoTotal', 'rotulo' => 'Previsto total', 'tipo' => 'num', 'leitura' => true],
        ['chave' => 'realizadoTotal', 'rotulo' => 'Realizado total', 'tipo' => 'num', 'leitura' => true],
        ['chave' => 'vaoKm', 'rotulo' => 'Vão (km)', 'tipo' => 'num', 'leitura' => true],
        ['chave' => 'soPrevisto', 'rotulo' => 'Só previsto (sem MO executada)', 'tipo' => 'num', 'leitura' => true],
    ];

    public const FUNCOES = [
        ['nome' => 'SE', 'ajuda' => 'SE(condição; valor se verdadeiro; valor se falso)'],
        ['nome' => 'SOMA', 'ajuda' => 'SOMA(a; b; ...)'],
        ['nome' => 'ARREDONDAR', 'ajuda' => 'ARREDONDAR(valor; casas)'],
        ['nome' => 'MAXIMO', 'ajuda' => 'MAXIMO(a; b; ...)'],
        ['nome' => 'MINIMO', 'ajuda' => 'MINIMO(a; b; ...)'],
        ['nome' => 'ABS', 'ajuda' => 'ABS(valor)'],
    ];

    public const OPERADORES = ['contem', 'naoContem', 'igual', 'diferente', 'maior', 'menor', 'maiorIgual', 'menorIgual', 'vazio', 'naoVazio'];

    private static array $astCache = [];

    public static function semAcento(?string $t): string
    {
        if ($t === null || $t === '') {
            return '';
        }
        if (class_exists(\Normalizer::class)) {
            $t = \Normalizer::normalize($t, \Normalizer::FORM_D);

            return preg_replace('/\p{Mn}/u', '', $t);
        }

        return strtr($t, ['á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'é' => 'e', 'ê' => 'e', 'í' => 'i', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ú' => 'u', 'ç' => 'c',
            'Á' => 'A', 'À' => 'A', 'Â' => 'A', 'Ã' => 'A', 'É' => 'E', 'Ê' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ô' => 'O', 'Õ' => 'O', 'Ú' => 'U', 'Ç' => 'C']);
    }

    private static function campo(string $chave): ?array
    {
        foreach (self::CAMPOS as $c) {
            if ($c['chave'] === $chave) {
                return $c;
            }
        }

        return null;
    }

    private static function mapaCampos(): array
    {
        $m = [];
        foreach (self::CAMPOS as $c) {
            $m[mb_strtolower(self::semAcento($c['rotulo']))] = $c['chave'];
            $m[mb_strtolower($c['chave'])] = $c['chave'];
        }

        return $m;
    }

    // ------------------------------------------------------------------ formulas

    private static function tokens(string $t): array
    {
        $saida = [];
        $ch = preg_split('//u', $t, -1, PREG_SPLIT_NO_EMPTY);
        $n = count($ch);
        $dig = fn ($c) => $c !== null && ctype_digit($c);
        for ($i = 0; $i < $n;) {
            $c = $ch[$i];
            if (trim($c) === '') {
                $i++;

                continue;
            }
            if ($c === '[') {
                $j = array_search(']', array_slice($ch, $i + 1, null, true), true);
                if ($j === false) {
                    throw new RuntimeException("Falta fechar o colchete ']' do campo.");
                }
                $saida[] = ['k' => 'fld', 'v' => trim(implode('', array_slice($ch, $i + 1, $j - $i - 1)))];
                $i = $j + 1;

                continue;
            }
            if ($c === '"') {
                $j = array_search('"', array_slice($ch, $i + 1, null, true), true);
                if ($j === false) {
                    throw new RuntimeException('Falta fechar as aspas do texto.');
                }
                $saida[] = ['k' => 'str', 'v' => implode('', array_slice($ch, $i + 1, $j - $i - 1))];
                $i = $j + 1;

                continue;
            }
            if ($dig($c) || (($c === ',' || $c === '.') && $dig($ch[$i + 1] ?? null))) {
                $j = $i;
                while ($j < $n && ($dig($ch[$j]) || $ch[$j] === ',' || $ch[$j] === '.')) {
                    $j++;
                }
                $s = str_replace(',', '.', implode('', array_slice($ch, $i, $j - $i)));
                if (! is_numeric($s)) {
                    throw new RuntimeException("Número inválido: $s");
                }
                $saida[] = ['k' => 'num', 'v' => (float) $s];
                $i = $j;

                continue;
            }
            if (preg_match('/\p{L}/u', $c)) {
                $j = $i;
                while ($j < $n && (preg_match('/[\p{L}\p{N}_]/u', $ch[$j]))) {
                    $j++;
                }
                $saida[] = ['k' => 'id', 'v' => mb_strtoupper(self::semAcento(implode('', array_slice($ch, $i, $j - $i))))];
                $i = $j;

                continue;
            }
            $dois = $c.($ch[$i + 1] ?? '');
            if (in_array($dois, ['>=', '<=', '<>'], true)) {
                $saida[] = ['k' => 'op', 'v' => $dois];
                $i += 2;

                continue;
            }
            if (str_contains('+-*/()=<>;', $c)) {
                $saida[] = ['k' => 'op', 'v' => $c];
                $i++;

                continue;
            }
            throw new RuntimeException("Caractere não reconhecido: '$c'");
        }

        return $saida;
    }

    /** Texto da formula -> arvore (com cache). Lanca RuntimeException com a mensagem em portugues. */
    public static function ast(string $formula): array
    {
        if (isset(self::$astCache[$formula])) {
            return self::$astCache[$formula];
        }
        if (trim($formula) === '') {
            throw new RuntimeException('Fórmula vazia.');
        }
        $tok = self::tokens($formula);
        $mapa = self::mapaCampos();
        $p = 0;
        $peek = function () use (&$p, $tok) {
            return $tok[$p] ?? null;
        };
        $ehOp = function (string $o) use ($peek) {
            $x = $peek();

            return $x !== null && $x['k'] === 'op' && $x['v'] === $o;
        };
        $expr = null;
        $prim = function () use (&$p, $peek, $ehOp, &$expr, $mapa) {
            $x = $peek();
            if ($x === null) {
                throw new RuntimeException('A fórmula terminou antes da hora.');
            }
            $p++;
            switch ($x['k']) {
                case 'num': return ['t' => 'num', 'v' => $x['v']];
                case 'str': return ['t' => 'str', 'v' => $x['v']];
                case 'fld':
                    $ch = $mapa[mb_strtolower(self::semAcento($x['v']))] ?? null;
                    if (! $ch) {
                        throw new RuntimeException("Campo desconhecido: [{$x['v']}]");
                    }

                    return ['t' => 'fld', 'k' => $ch];
                case 'id':
                    if (! $ehOp('(')) {
                        throw new RuntimeException("Depois de {$x['v']} falta '('.");
                    }
                    $p++;
                    $lista = [];
                    if (! $ehOp(')')) {
                        $lista[] = $expr();
                        while ($ehOp(';')) {
                            $p++;
                            $lista[] = $expr();
                        }
                    }
                    if (! $ehOp(')')) {
                        throw new RuntimeException("Falta fechar o parêntese de {$x['v']}.");
                    }
                    $p++;
                    $nome = $x['v'];
                    if (! in_array($nome, ['SE', 'SOMA', 'ARREDONDAR', 'MAXIMO', 'MINIMO', 'ABS'], true)) {
                        throw new RuntimeException("Função desconhecida: {$x['v']}");
                    }
                    $q = count($lista);
                    if ($nome === 'SE' && $q !== 3) {
                        throw new RuntimeException('SE precisa de 3 partes: SE(condição; se verdadeiro; se falso).');
                    }
                    if ($nome === 'ARREDONDAR' && $q !== 2) {
                        throw new RuntimeException('ARREDONDAR precisa de 2 partes: ARREDONDAR(valor; casas).');
                    }
                    if ($nome === 'ABS' && $q !== 1) {
                        throw new RuntimeException('ABS precisa de 1 valor.');
                    }
                    if (in_array($nome, ['SOMA', 'MAXIMO', 'MINIMO'], true) && $q < 1) {
                        throw new RuntimeException("$nome precisa de ao menos 1 valor.");
                    }

                    return ['t' => 'fn', 'n' => $nome, 'a' => $lista];
                case 'op':
                    if ($x['v'] === '(') {
                        $e = $expr();
                        if (! $ehOp(')')) {
                            throw new RuntimeException('Falta fechar o parêntese.');
                        }
                        $p++;

                        return $e;
                    }
            }
            throw new RuntimeException("Não esperava '{$x['v']}' aqui.");
        };
        $un = null;
        $un = function () use (&$p, $ehOp, $prim, &$un) {
            if ($ehOp('-')) {
                $p++;

                return ['t' => 'neg', 'e' => $un()];
            }

            return $prim();
        };
        $mul = function () use (&$p, $ehOp, $peek, $un) {
            $l = $un();
            while ($ehOp('*') || $ehOp('/')) {
                $o = $peek()['v'];
                $p++;
                $l = ['t' => 'bin', 'o' => $o, 'l' => $l, 'r' => $un()];
            }

            return $l;
        };
        $add = function () use (&$p, $ehOp, $peek, $mul) {
            $l = $mul();
            while ($ehOp('+') || $ehOp('-')) {
                $o = $peek()['v'];
                $p++;
                $l = ['t' => 'bin', 'o' => $o, 'l' => $l, 'r' => $mul()];
            }

            return $l;
        };
        $expr = function () use (&$p, $peek, $add) {
            $l = $add();
            $x = $peek();
            if ($x !== null && $x['k'] === 'op' && in_array($x['v'], ['>', '<', '>=', '<=', '=', '<>'], true)) {
                $p++;
                $l = ['t' => 'bin', 'o' => $x['v'], 'l' => $l, 'r' => $add()];
            }

            return $l;
        };
        $ast = $expr();
        if ($p < count($tok)) {
            throw new RuntimeException("Sobrou algo no fim da fórmula: '{$tok[$p]['v']}'");
        }

        return self::$astCache[$formula] = $ast;
    }

    public static function camposDoAst(array $n): array
    {
        $r = [];
        $visita = function ($n) use (&$visita, &$r) {
            match ($n['t']) {
                'fld' => $r[] = $n['k'],
                'neg' => $visita($n['e']),
                'bin' => [$visita($n['l']), $visita($n['r'])],
                'fn' => array_map($visita, $n['a']),
                default => null,
            };
        };
        $visita($n);

        return array_values(array_unique($r));
    }

    public static function avaliar(array $n, array $ctx)
    {
        switch ($n['t']) {
            case 'num': return (float) $n['v'];
            case 'str': return (string) $n['v'];
            case 'fld':
                if (! array_key_exists($n['k'], $ctx) || $ctx[$n['k']] === null) {
                    throw new RuntimeException("O campo '{$n['k']}' não tem valor neste registro.");
                }

                return $ctx[$n['k']];
            case 'neg': return -1.0 * (float) self::avaliar($n['e'], $ctx);
            case 'bin':
                $a = self::avaliar($n['l'], $ctx);
                $b = self::avaliar($n['r'], $ctx);
                $o = $n['o'];
                if ($o === '=' || $o === '<>') {
                    $igual = (is_string($a) || is_string($b))
                        ? mb_strtoupper(self::semAcento((string) $a)) === mb_strtoupper(self::semAcento((string) $b))
                        : abs((float) $a - (float) $b) < 1e-9;

                    return ($o === '=') === $igual ? 1.0 : 0.0;
                }
                $x = (float) $a;
                $y = (float) $b;

                return match ($o) {
                    '+' => $x + $y, '-' => $x - $y, '*' => $x * $y,
                    '/' => $y == 0.0 ? throw new RuntimeException('Divisão por zero.') : $x / $y,
                    '>' => $x > $y ? 1.0 : 0.0, '<' => $x < $y ? 1.0 : 0.0, '>=' => $x >= $y ? 1.0 : 0.0, '<=' => $x <= $y ? 1.0 : 0.0,
                };
            case 'fn':
                if ($n['n'] === 'SE') {
                    return (float) self::avaliar($n['a'][0], $ctx) != 0.0 ? self::avaliar($n['a'][1], $ctx) : self::avaliar($n['a'][2], $ctx);
                }
                $v = array_map(fn ($a) => (float) self::avaliar($a, $ctx), $n['a']);

                return match ($n['n']) {
                    'SOMA' => (float) array_sum($v), 'MAXIMO' => (float) max($v), 'MINIMO' => (float) min($v), 'ABS' => abs($v[0]),
                    'ARREDONDAR' => round($v[0], (int) $v[1], PHP_ROUND_HALF_UP),
                };
        }
        throw new RuntimeException('Expressão inválida.');
    }

    public static function validarFormula(string $f): array
    {
        try {
            return ['ok' => true, 'campos' => self::camposDoAst(self::ast($f))];
        } catch (\Throwable $e) {
            return ['ok' => false, 'erro' => $e->getMessage()];
        }
    }

    // ------------------------------------------------------------------ condicoes / aplicacao

    public static function condicao(array $c, array $ctx): bool
    {
        $v = $ctx[(string) ($c['campo'] ?? '')] ?? null;
        $op = (string) ($c['op'] ?? '');
        if ($op === 'vazio') {
            return $v === null || (string) $v === '';
        }
        if ($op === 'naoVazio') {
            return $v !== null && (string) $v !== '';
        }
        if ($v === null) {
            return false;
        }
        $ref = (string) ($c['valor'] ?? '');
        $campo = self::campo((string) $c['campo']);
        if ($campo && $campo['tipo'] === 'texto') {
            $a = trim(mb_strtoupper(self::semAcento((string) $v)));
            $b = trim(mb_strtoupper(self::semAcento($ref)));

            return match ($op) { 'contem' => str_contains($a, $b), 'naoContem' => ! str_contains($a, $b), 'igual' => $a === $b, 'diferente' => $a !== $b, default => false };
        }
        $x = str_replace(',', '.', (string) $v);
        $y = str_replace(',', '.', $ref);
        if (! is_numeric($x) || ! is_numeric($y)) {
            return false;
        }
        $x = (float) $x;
        $y = (float) $y;

        return match ($op) {
            'igual' => abs($x - $y) < 1e-9, 'diferente' => abs($x - $y) >= 1e-9, 'maior' => $x > $y, 'menor' => $x < $y,
            'maiorIgual' => $x >= $y, 'menorIgual' => $x <= $y, default => false,
        };
    }

    public static function totais(array &$ctx): void
    {
        $ctx['previstoTotal'] = (float) $ctx['previstoPoda'] + (float) $ctx['previstoLimpeza'] + (float) $ctx['previstoEstrutura'];
        $ctx['realizadoTotal'] = (float) $ctx['realizadoPoda'] + (float) $ctx['realizadoLimpeza'] + (float) $ctx['realizadoEstrutura'];
    }

    /** Aplica as regras em $ctx. As formulas de uma regra veem a FOTO de antes dela. -> [aplicadas (nomes), ignoradas [{nome, motivo}]] */
    public static function aplicarNoCtx(array $regras, array &$ctx): array
    {
        $aplicadas = [];
        $ignoradas = [];
        foreach ($regras as $r) {
            self::totais($ctx);
            foreach ((array) ($r['condicoes'] ?? []) as $c) {
                if (! self::condicao($c, $ctx)) {
                    continue 2;
                }
            }
            $foto = $ctx;
            $novos = [];
            try {
                foreach ((array) ($r['acoes'] ?? []) as $a) {
                    $cp = self::campo((string) ($a['campo'] ?? ''));
                    if (! $cp || $cp['leitura']) {
                        throw new RuntimeException("O campo '{$a['campo']}' não pode ser alterado.");
                    }
                    $novos[$a['campo']] = $cp['tipo'] === 'texto' ? (string) $a['valor'] : (float) self::avaliar(self::ast((string) $a['valor']), $foto);
                }
            } catch (\Throwable $e) {
                $ignoradas[] = ['nome' => (string) $r['nome'], 'motivo' => $e->getMessage()];

                continue;
            }
            foreach ($novos as $k => $v) {
                $ctx[$k] = $v;
            }
            $aplicadas[] = (string) $r['nome'];
        }
        self::totais($ctx);

        return [$aplicadas, $ignoradas];
    }

    /** Erros de uma regra vinda da tela (vazio = ok). */
    public static function validar(array $r): array
    {
        $erros = [];
        if (trim((string) ($r['nome'] ?? '')) === '') {
            $erros[] = 'Dê um nome à regra.';
        }
        if (! array_intersect((array) ($r['aplicaEm'] ?? []), ['executada', 'pendente'])) {
            $erros[] = 'Escolha onde a regra se aplica (grid executada e/ou pendente).';
        }
        foreach ((array) ($r['condicoes'] ?? []) as $c) {
            $cp = self::campo((string) ($c['campo'] ?? ''));
            if (! $cp) {
                $erros[] = 'Condição com campo desconhecido: '.($c['campo'] ?? '');

                continue;
            }
            if (! in_array($c['op'] ?? '', self::OPERADORES, true)) {
                $erros[] = 'Condição com operador desconhecido: '.($c['op'] ?? '');
            }
            if (! in_array($c['op'] ?? '', ['vazio', 'naoVazio'], true) && trim((string) ($c['valor'] ?? '')) === '') {
                $erros[] = "Condição em '{$cp['rotulo']}' sem valor.";
            }
        }
        $acoes = (array) ($r['acoes'] ?? []);
        if (! $acoes) {
            $erros[] = 'Adicione ao menos uma ação (ENTÃO).';
        }
        foreach ($acoes as $a) {
            $cp = self::campo((string) ($a['campo'] ?? ''));
            if (! $cp) {
                $erros[] = 'Ação com campo desconhecido: '.($a['campo'] ?? '');

                continue;
            }
            if ($cp['leitura']) {
                $erros[] = "O campo '{$cp['rotulo']}' só pode ser lido, não alterado.";

                continue;
            }
            if ($cp['tipo'] === 'num') {
                $t = self::validarFormula((string) ($a['valor'] ?? ''));
                if (! $t['ok']) {
                    $erros[] = "Fórmula de '{$cp['rotulo']}': {$t['erro']}";
                }
            } elseif (trim((string) ($a['valor'] ?? '')) === '') {
                $erros[] = "Ação em '{$cp['rotulo']}' sem valor.";
            }
        }

        return $erros;
    }

    /** Normaliza o que veio da tela (mesmo formato do ConvertTo-RegraHash). */
    public static function normalizar(array $b, string $id): array
    {
        return [
            'id' => $id, 'nome' => trim((string) ($b['nome'] ?? '')), 'descricao' => trim((string) ($b['descricao'] ?? '')),
            'ativa' => filter_var($b['ativa'] ?? false, FILTER_VALIDATE_BOOLEAN), 'ordem' => (int) ($b['ordem'] ?? 0),
            'aplicaEm' => array_values(array_map('strval', (array) ($b['aplicaEm'] ?? []))),
            'condicoes' => array_values(array_map(fn ($c) => ['campo' => (string) ($c['campo'] ?? ''), 'op' => (string) ($c['op'] ?? ''), 'valor' => (string) ($c['valor'] ?? '')], (array) ($b['condicoes'] ?? []))),
            'acoes' => array_values(array_map(fn ($a) => ['campo' => (string) ($a['campo'] ?? ''), 'valor' => (string) ($a['valor'] ?? '')], (array) ($b['acoes'] ?? []))),
        ];
    }

    // ------------------------------------------------------------------ armazenamento

    /** As duas regras de Poda linear que antes eram fixas no codigo (mesmo conteudo do Get-RegrasPadrao). */
    public static function padrao(): array
    {
        $agora = now()->format('Y-m-d\TH:i:s');

        return [
            ['id' => 'poda-linear-executada', 'nome' => 'Poda linear — grid executada',
                'descricao' => 'Zera os recursos da MO e a limpeza de faixa vem do vão do poste (km × 15.000 m²). Só vale para OS que tem MO executada.',
                'ativa' => true, 'ordem' => 1, 'aplicaEm' => ['executada'],
                'condicoes' => [['campo' => 'esquema', 'op' => 'contem', 'valor' => 'PODA LINEAR'], ['campo' => 'soPrevisto', 'op' => 'igual', 'valor' => '0']],
                'acoes' => [['campo' => 'realizadoPoda', 'valor' => '0'], ['campo' => 'realizadoEstrutura', 'valor' => '0'], ['campo' => 'previstoPoda', 'valor' => '0'],
                    ['campo' => 'previstoLimpeza', 'valor' => '0'], ['campo' => 'previstoEstrutura', 'valor' => '0'], ['campo' => 'realizadoLimpeza', 'valor' => '[Vão (km)] * 15000'],
                    ['campo' => 'tipoServico', 'valor' => 'Limpeza de Faixa']],
                'atualizadoPor' => 'sistema', 'atualizadoEm' => $agora],
            ['id' => 'poda-linear-pendente', 'nome' => 'Poda linear — grid pendente',
                'descricao' => 'Previsto = vão × 15.000 m². Se a OS já tinha execução, o realizado é igual ao previsto.',
                'ativa' => true, 'ordem' => 2, 'aplicaEm' => ['pendente'],
                'condicoes' => [['campo' => 'esquema', 'op' => 'contem', 'valor' => 'PODA LINEAR']],
                'acoes' => [['campo' => 'previstoPoda', 'valor' => '0'], ['campo' => 'previstoEstrutura', 'valor' => '0'], ['campo' => 'realizadoPoda', 'valor' => '0'],
                    ['campo' => 'realizadoEstrutura', 'valor' => '0'], ['campo' => 'previstoLimpeza', 'valor' => '[Vão (km)] * 15000'],
                    ['campo' => 'realizadoLimpeza', 'valor' => 'SE([Realizado total] > 0; [Vão (km)] * 15000; 0)'], ['campo' => 'tipoServico', 'valor' => 'Limpeza de Faixa']],
                'atualizadoPor' => 'sistema', 'atualizadoEm' => $agora],
        ];
    }

    /** Todas, pela ordem. Primeira vez (nenhuma regra e nunca semeado): grava as padrao. */
    public static function todas(): array
    {
        if (! DB::table('configuracoes')->where('chave', 'regras_semeadas')->exists()) {
            DB::transaction(function () {
                if (! DB::table('regras')->exists()) {
                    foreach (self::padrao() as $r) {
                        DB::table('regras')->insert(['id' => $r['id'], 'ordem' => $r['ordem'], 'dados' => json_encode($r, JSON_UNESCAPED_UNICODE)]);
                    }
                }
                DB::table('configuracoes')->insertOrIgnore(['chave' => 'regras_semeadas', 'valor' => 'true', 'atualizado_em' => now()]);
            });
        }

        return DB::table('regras')->orderBy('ordem')->orderBy('id')->pluck('dados')->map(fn ($d) => json_decode($d, true))->all();
    }

    public static function ativas(string $base): array
    {
        return array_values(array_filter(self::todas(), fn ($r) => ! empty($r['ativa']) && in_array($base, (array) ($r['aplicaEm'] ?? []), true)));
    }

    public static function historico(string $regraId, string $nome, string $acao, ?array $antes, ?array $depois, string $usuario): void
    {
        DB::table('regras_historico')->insert(['em' => now(), 'usuario' => $usuario, 'regra_id' => $regraId, 'nome' => $nome, 'acao' => $acao,
            'antes' => $antes ? json_encode($antes, JSON_UNESCAPED_UNICODE) : null, 'depois' => $depois ? json_encode($depois, JSON_UNESCAPED_UNICODE) : null]);
    }

    // ------------------------------------------------------------------ uso pelo importador das grids

    /**
     * Aplica as regras numa OS. $qReal/$qPrev = ['poda','limpeza','estrutura']; $vaoKm = null se o Vao nao foi importado
     * (regras que usam [Vão (km)] ficam ignoradas). Atualiza $resumo (regrasAplicadas, regrasIgnoradas, podaLinear).
     * -> [qReal, qPrev, tipoServico, aplicou]
     */
    public static function naImportacao(array $regras, string $esquema, string $tipoServico, array $qReal, array $qPrev, ?float $vaoKm, bool $soPrevisto, array &$resumo): array
    {
        $ctx = ['esquema' => $esquema, 'tipoServico' => $tipoServico,
            'previstoPoda' => (float) $qPrev['poda'], 'previstoLimpeza' => (float) $qPrev['limpeza'], 'previstoEstrutura' => (float) $qPrev['estrutura'],
            'realizadoPoda' => (float) $qReal['poda'], 'realizadoLimpeza' => (float) $qReal['limpeza'], 'realizadoEstrutura' => (float) $qReal['estrutura'],
            'vaoKm' => $vaoKm, 'soPrevisto' => $soPrevisto ? 1.0 : 0.0];
        [$aplicadas, $ignoradas] = self::aplicarNoCtx($regras, $ctx);
        foreach ($aplicadas as $nome) {
            $resumo['regrasAplicadas'][$nome] = ($resumo['regrasAplicadas'][$nome] ?? 0) + 1;
        }
        if ($aplicadas && preg_grep('/Poda linear/', $aplicadas)) {
            $resumo['podaLinear'] = ($resumo['podaLinear'] ?? 0) + 1;
        }
        foreach ($ignoradas as $ig) {
            $resumo['regrasIgnoradas'][$ig['nome']] = $ig['motivo'];
        }
        if (! $aplicadas) {
            return [$qReal, $qPrev, $tipoServico, false];
        }

        return [['poda' => $ctx['realizadoPoda'], 'limpeza' => $ctx['realizadoLimpeza'], 'estrutura' => $ctx['realizadoEstrutura']],
            ['poda' => $ctx['previstoPoda'], 'limpeza' => $ctx['previstoLimpeza'], 'estrutura' => $ctx['previstoEstrutura']], (string) $ctx['tipoServico'], true];
    }
}
