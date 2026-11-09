<?php

namespace App\Services;

/**
 * Le a senha do legado (Auth.ps1: XOR com chave fixa + Base64). Serve SO para
 * conferir no 1o login e trocar por password_hash; depois a coluna senha_legada e apagada.
 * A chave e publica no codigo do legado: nao protege nada, por isso o upgrade e obrigatorio.
 */
class SenhaLegada
{
    private const CHAVE = 'SPARK-ENERGISA-2026-v1';

    public static function decodificar(?string $ofuscada): ?string
    {
        if ($ofuscada === null || $ofuscada === '') {
            return null;
        }
        $bytes = base64_decode($ofuscada, true);
        if ($bytes === false) {
            return null;
        }
        $chave = self::CHAVE;
        $n = strlen($chave);
        $saida = '';
        for ($i = 0, $t = strlen($bytes); $i < $t; $i++) {
            $saida .= $bytes[$i] ^ $chave[$i % $n];
        }

        return $saida;
    }

    public static function confere(string $digitada, ?string $ofuscada): bool
    {
        $real = self::decodificar($ofuscada);

        return $real !== null && hash_equals($real, $digitada);
    }

    /** So para testes (gerar senha no formato antigo). */
    public static function ofuscar(string $texto): string
    {
        $chave = self::CHAVE;
        $n = strlen($chave);
        $saida = '';
        for ($i = 0, $t = strlen($texto); $i < $t; $i++) {
            $saida .= $texto[$i] ^ $chave[$i % $n];
        }

        return base64_encode($saida);
    }
}
