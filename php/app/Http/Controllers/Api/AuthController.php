<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use App\Services\Login;
use App\Services\SessaoToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/** /api/auth/* — mesmo contrato do legado (routes/usuarios.ps1, Invoke-AuthRoute). */
class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $email = $request->input('email');
        $senha = $request->input('senha');
        if (! is_string($email) || ! is_string($senha) || $email === '' || $senha === '') {
            return response()->json(['erro' => 'Informe e-mail e senha.'], 400);
        }

        $r = Login::tentar($email, $senha, $request->ip(), $request->userAgent());

        return response()->json($r['body'], $r['status']);
    }

    public function logout(Request $request): JsonResponse
    {
        $usuario = $request->user();
        SessaoToken::revogar($request->bearerToken());
        Auditoria::registrar('logout', 'auth', $usuario->id, $usuario->id, [], $request->ip());

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user()->paraFront());
    }

    public function trocarSenha(Request $request): JsonResponse
    {
        $usuario = $request->user();
        $atual = (string) $request->input('senhaAtual', '');
        $nova = (string) $request->input('senhaNova', '');

        if (! Login::senhaConfere($usuario, $atual)) {
            return response()->json(['erro' => 'Senha atual incorreta.'], 401);
        }
        $min = config('spark.senha_min');
        if (mb_strlen($nova) < $min) {
            return response()->json(['erro' => "A nova senha precisa ter pelo menos {$min} caracteres."], 400);
        }

        $usuario->senha_hash = Hash::make($nova);
        $usuario->senha_legada = null;
        $usuario->save();
        SessaoToken::revogarTodas($usuario->id, $request->bearerToken());
        Auditoria::registrar('trocar_senha', 'usuarios', $usuario->id, $usuario->id, [], $request->ip());

        return response()->json(['ok' => true]);
    }
}
