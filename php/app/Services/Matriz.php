<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Matriz de permissoes no formato do front legado: {"modulo": {"acao": true}}.
 * No banco: uma linha em `permissoes` por acao liberada.
 *
 * Caso especial "alertas.visualizar": o front aceita true/false explicito; sem valor, segue
 * manutencao.visualizar. Aqui a linha existe = true e a falta dela = false, e o GET sempre
 * devolve o booleano. Ao salvar sem valor explicito, aplica a regra do front.
 */
class Matriz
{
    public static function perfis(): array
    {
        return array_keys(config('spark.perfis'));
    }

    public static function perfilValido(?string $perfil): bool
    {
        return is_string($perfil) && in_array($perfil, self::perfis(), true);
    }

    /** Matriz do perfil-modelo, ja no formato do front. */
    public static function doPerfil(string $perfil): array
    {
        $modelo = config("spark.perfis.$perfil") ?? config('spark.perfis.Consulta');
        if ($modelo === '*') {
            $modelo = array_fill_keys(config('spark.modulos'), config('spark.acoes'));
        }
        $m = [];
        foreach ($modelo as $mod => $acoes) {
            foreach ($acoes as $a) {
                $m[$mod][$a] = true;
            }
        }

        return self::normalizar($m);
    }

    public static function ler(string $usuarioId): array
    {
        $m = [];
        foreach (DB::table('permissoes')->where('usuario_id', $usuarioId)->get(['modulo', 'acao']) as $p) {
            $m[$p->modulo][$p->acao] = true;
        }
        $m['alertas']['visualizar'] = ! empty($m['alertas']['visualizar']);

        return $m;
    }

    /** Troca a matriz inteira do usuario. Ignora modulo/acao desconhecidos. */
    public static function gravar(string $usuarioId, array $matriz): array
    {
        $m = self::normalizar($matriz);
        DB::transaction(function () use ($usuarioId, $m) {
            DB::table('permissoes')->where('usuario_id', $usuarioId)->delete();
            $linhas = [];
            foreach ($m as $mod => $acoes) {
                foreach ($acoes as $acao => $ok) {
                    if ($ok) {
                        $linhas[] = ['usuario_id' => $usuarioId, 'modulo' => $mod, 'acao' => $acao];
                    }
                }
            }
            if ($linhas) {
                DB::table('permissoes')->insert($linhas);
            }
        });

        return self::ler($usuarioId);
    }

    /** So mantem modulo/acao conhecidos e valores verdadeiros; resolve alertas.visualizar. */
    public static function normalizar(array $matriz): array
    {
        $mods = config('spark.modulos');
        $acoes = config('spark.acoes');
        $m = [];
        foreach ($matriz as $mod => $lista) {
            if (! in_array($mod, $mods, true) || ! is_array($lista)) {
                continue;
            }
            foreach ($lista as $acao => $ok) {
                if (in_array($acao, $acoes, true) && self::verdadeiro($ok)) {
                    $m[$mod][$acao] = true;
                }
            }
        }
        $alerta = $matriz['alertas']['visualizar'] ?? null;
        $m['alertas']['visualizar'] = is_bool($alerta) || is_int($alerta) ? self::verdadeiro($alerta) : ! empty($m['manutencao']['visualizar']);
        if (! $m['alertas']['visualizar']) {
            unset($m['alertas']['visualizar']);
        }
        if (empty($m['alertas'])) {
            unset($m['alertas']);
        }

        return $m;
    }

    private static function verdadeiro($v): bool
    {
        return $v === true || $v === 1 || $v === '1' || $v === 'true';
    }
}
