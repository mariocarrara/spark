<?php

namespace App\Services;

use App\Models\Usuario;
use Illuminate\Support\Facades\DB;

/**
 * Token opaco de sessao (header "Authorization: Bearer <token>", igual ao legado).
 * No banco fica so o SHA-256 do token (tabela `sessoes`); quem le o banco nao consegue se logar.
 */
class SessaoToken
{
    public static function criar(Usuario $usuario, ?string $ip, ?string $userAgent): string
    {
        $token = bin2hex(random_bytes(32));
        DB::table('sessoes')->insert([
            'token_hash' => hash('sha256', $token),
            'usuario_id' => $usuario->id,
            'criado_em' => now(),
            'expira_em' => now()->addHours(config('spark.sessao_horas')),
            'ip' => $ip,
            'user_agent' => $userAgent !== null ? mb_substr($userAgent, 0, 500) : null,
        ]);

        return $token;
    }

    /** Devolve o usuario ativo dono do token, ou null. Renova a validade (janela deslizante). */
    public static function resolver(?string $token): ?Usuario
    {
        if ($token === null || ! preg_match('/^[a-f0-9]{64}$/', $token)) {
            return null;
        }
        $hash = hash('sha256', $token);
        $sessao = DB::table('sessoes')->where('token_hash', $hash)->where('expira_em', '>', now())->first();
        if (! $sessao) {
            return null;
        }
        $usuario = Usuario::find($sessao->usuario_id);
        if (! $usuario || ! $usuario->ativo()) {
            return null;
        }
        DB::table('sessoes')->where('token_hash', $hash)->update(['expira_em' => now()->addHours(config('spark.sessao_horas'))]);

        return $usuario;
    }

    public static function revogar(?string $token): void
    {
        if ($token) {
            DB::table('sessoes')->where('token_hash', hash('sha256', $token))->delete();
        }
    }

    /** Derruba todas as sessoes do usuario (troca de senha, bloqueio). Pode manter a atual. */
    public static function revogarTodas(string $usuarioId, ?string $exceto = null): void
    {
        $q = DB::table('sessoes')->where('usuario_id', $usuarioId);
        if ($exceto) {
            $q->where('token_hash', '<>', hash('sha256', $exceto));
        }
        $q->delete();
    }

    public static function limparExpiradas(): int
    {
        return DB::table('sessoes')->where('expira_em', '<=', now())->delete();
    }
}
