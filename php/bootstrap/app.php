<?php

use App\Http\Middleware\ExigePermissao;
use App\Http\Middleware\SoAdmin;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // front-end sem o grupo "web" (nao precisa de sessao/cookie: a API usa token Bearer)
        then: fn () => Illuminate\Support\Facades\Route::middleware([])->group(__DIR__.'/../routes/web.php'),
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'perm' => ExigePermissao::class,
            'admin' => SoAdmin::class,
        ]);
        // API e stateless (token Bearer): nunca redirecionar para tela de login.
        $middleware->redirectGuestsTo(fn (Request $r) => $r->is('api/*') ? null : '/');
        // Render (e qualquer hospedagem com proxy na frente): sem isso o IP de todo mundo seria o do proxy
        // e o bloqueio por IP (Login::bloqueado) trancaria o login de todos juntos.
        $middleware->trustProxies(at: env('SPARK_PROXIES_CONFIAVEIS', '*'));
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(fn (Request $r) => $r->is('api/*') || $r->expectsJson());

        // Mesmo formato de erro do legado: {"erro": "..."}
        $exceptions->render(function (AuthenticationException $e, Request $r) {
            if ($r->is('api/*')) {
                return response()->json(['erro' => 'Não autenticado. Faça login novamente.'], 401);
            }
        });
        $exceptions->render(function (HttpExceptionInterface $e, Request $r) {
            if ($r->is('api/*')) {
                // metodo nao suportado numa rota que existe (ex.: POST em modulo ainda so com leitura): ainda nao migrado
                if ($e->getStatusCode() === 405) {
                    return response()->json(['erro' => 'Esta função ainda não foi migrada para o sistema novo.'], 404);
                }
                $msg = match ($e->getStatusCode()) {
                    404 => 'Rota não encontrada.',
                    429 => 'Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.',
                    default => $e->getMessage() ?: 'Erro na requisição.',
                };

                return response()->json(['erro' => $msg], $e->getStatusCode());
            }
        });
    })->create();
