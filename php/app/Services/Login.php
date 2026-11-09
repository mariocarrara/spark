<?php

namespace App\Services;

use App\Models\Usuario;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Regra de login (backend): bloqueio por tentativas, senha nova (bcrypt) ou legada
 * (convertida para hash no 1o login), status da conta e auditoria.
 */
class Login
{
    /**
     * @return array{status:int, body:array}
     */
    public static function tentar(string $email, string $senha, ?string $ip, ?string $userAgent): array
    {
        $email = mb_strtolower(trim($email));

        if (self::bloqueado($email, $ip)) {
            Auditoria::registrar('login_bloqueado', 'auth', null, null, ['email' => $email], $ip);

            return ['status' => 429, 'body' => ['erro' => 'Muitas tentativas erradas. Aguarde '.config('spark.login_janela_minutos').' minutos e tente de novo.']];
        }

        $usuario = $email === '' ? null : Usuario::whereRaw('lower(email) = ?', [$email])->first();

        if (! $usuario || ! self::senhaConfere($usuario, $senha)) {
            self::anotarTentativa($email, $ip, false);
            Auditoria::registrar('login_falhou', 'auth', $usuario?->id, $usuario?->id, ['email' => $email], $ip);

            return ['status' => 401, 'body' => ['erro' => 'E-mail ou senha inválidos.']];
        }

        if ($usuario->status_conta === 'PendenteAprovacao') {
            return ['status' => 403, 'body' => ['erro' => 'Cadastro pendente de liberação por um administrador.']];
        }
        if (! $usuario->ativo()) {
            return ['status' => 403, 'body' => ['erro' => 'Usuário bloqueado. Fale com um administrador.']];
        }

        self::anotarTentativa($email, $ip, true);
        $usuario->ultimo_login = now();
        $usuario->save();
        $token = SessaoToken::criar($usuario, $ip, $userAgent);
        Auditoria::registrar('login', 'auth', $usuario->id, $usuario->id, [], $ip);

        return ['status' => 200, 'body' => ['token' => $token, 'usuario' => $usuario->paraFront()]];
    }

    /** Confere a senha; se veio do legado ou o hash esta velho, regrava com password_hash. */
    public static function senhaConfere(Usuario $usuario, string $senha): bool
    {
        if (! empty($usuario->senha_hash)) {
            if (! Hash::check($senha, $usuario->senha_hash)) {
                return false;
            }
            if (Hash::needsRehash($usuario->senha_hash)) {
                $usuario->senha_hash = Hash::make($senha);
                $usuario->save();
            }

            return true;
        }

        if (! empty($usuario->senha_legada)) {
            if (! SenhaLegada::confere($senha, $usuario->senha_legada)) {
                return false;
            }
            $usuario->senha_hash = Hash::make($senha);
            $usuario->senha_legada = null;
            $usuario->save();
            Auditoria::registrar('senha_convertida', 'usuarios', $usuario->id, $usuario->id);

            return true;
        }

        // sem senha cadastrada / e-mail inexistente: gasta o mesmo tempo de um bcrypt
        static $falso = null;
        $falso ??= Hash::make(bin2hex(random_bytes(8)));
        Hash::check($senha, $falso);

        return false;
    }

    private static function bloqueado(string $email, ?string $ip): bool
    {
        $desde = now()->subMinutes(config('spark.login_janela_minutos'));

        if ($email !== '') {
            $ultimoSucesso = DB::table('tentativas_login')->whereRaw('lower(email) = ?', [$email])->where('sucesso', true)->max('momento');
            $q = DB::table('tentativas_login')->whereRaw('lower(email) = ?', [$email])->where('sucesso', false)->where('momento', '>', $desde);
            if ($ultimoSucesso) {
                $q->where('momento', '>', $ultimoSucesso);
            }
            if ($q->count() >= config('spark.login_max_falhas_email')) {
                return true;
            }
        }

        if ($ip) {
            $falhasIp = DB::table('tentativas_login')->where('ip', $ip)->where('sucesso', false)->where('momento', '>', $desde)->count();
            if ($falhasIp >= config('spark.login_max_falhas_ip')) {
                return true;
            }
        }

        return false;
    }

    private static function anotarTentativa(string $email, ?string $ip, bool $sucesso): void
    {
        DB::table('tentativas_login')->insert(['email' => $email, 'ip' => $ip, 'momento' => now(), 'sucesso' => $sucesso]);
    }
}
