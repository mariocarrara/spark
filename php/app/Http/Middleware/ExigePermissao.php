<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Uso na rota: ->middleware('perm:programacao,editar'). Roda depois de auth:api.
 */
class ExigePermissao
{
    public function handle(Request $request, Closure $next, string $modulo, string $acao): Response
    {
        $usuario = $request->user();
        if (! $usuario || ! $usuario->pode($modulo, $acao)) {
            return response()->json(['erro' => 'Sem permissão para esta ação.'], 403);
        }

        return $next($request);
    }
}
