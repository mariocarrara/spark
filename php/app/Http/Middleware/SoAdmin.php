<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Acoes so de administrador (equivale ao Test-Administrador do legado). */
class SoAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->isAdmin()) {
            return response()->json(['erro' => 'Apenas administradores.'], 403);
        }

        return $next($request);
    }
}
