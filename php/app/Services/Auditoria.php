<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Grava na tabela `auditoria`. NUNCA passe senha, token ou dado sensivel em $detalhes.
 */
class Auditoria
{
    private const CHAVES_PROIBIDAS = ['senha', 'senhaatual', 'senhanova', 'password', 'token', 'senha_hash', 'senha_legada'];

    public static function registrar(string $acao, string $entidade, ?string $registroId = null, ?string $usuarioId = null, array $detalhes = [], ?string $ip = null): void
    {
        DB::table('auditoria')->insert([
            'momento' => now(),
            'usuario_id' => $usuarioId,
            'acao' => $acao,
            'entidade' => $entidade,
            'registro_id' => $registroId,
            'ip' => $ip,
            'detalhes' => $detalhes ? json_encode(self::limpar($detalhes), JSON_UNESCAPED_UNICODE) : null,
        ]);
    }

    private static function limpar(array $dados): array
    {
        foreach ($dados as $k => $v) {
            if (in_array(strtolower((string) $k), self::CHAVES_PROIBIDAS, true)) {
                unset($dados[$k]);
            } elseif (is_array($v)) {
                $dados[$k] = self::limpar($v);
            }
        }

        return $dados;
    }
}
