<?php

namespace App\Http\Controllers;

use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Serve o front-end do legado (pasta view/) pelo proprio Laravel, no mesmo endereco da API.
 * Pasta configuravel em SPARK_FRONT_DIR (padrao: ../legado-powershell/view).
 * So entrega arquivos de DENTRO da pasta (bloqueia ../ e caminhos absolutos).
 */
class FrontController extends Controller
{
    private const TIPOS = [
        'html' => 'text/html; charset=utf-8', 'js' => 'application/javascript; charset=utf-8',
        'css' => 'text/css; charset=utf-8', 'json' => 'application/json; charset=utf-8',
        'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
        'gif' => 'image/gif', 'ico' => 'image/x-icon', 'webp' => 'image/webp',
        'woff' => 'font/woff', 'woff2' => 'font/woff2', 'ttf' => 'font/ttf', 'map' => 'application/json',
        'txt' => 'text/plain; charset=utf-8', 'pdf' => 'application/pdf',
    ];

    public function __invoke(string $caminho = ''): Response
    {
        $raiz = realpath(config('spark.front_dir'));
        if ($raiz === false) {
            return response('Pasta do front nao encontrada (SPARK_FRONT_DIR).', 500);
        }
        $caminho = $caminho === '' ? 'index.html' : $caminho;
        $arquivo = realpath($raiz.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $caminho));

        if ($arquivo === false || ! str_starts_with($arquivo, $raiz.DIRECTORY_SEPARATOR) || ! is_file($arquivo)) {
            abort(404);
        }
        $ext = strtolower(pathinfo($arquivo, PATHINFO_EXTENSION));
        if (! isset(self::TIPOS[$ext])) {
            abort(404); // so tipos conhecidos (nada de .ps1, .bat etc.)
        }

        $r = new BinaryFileResponse($arquivo, 200, ['Content-Type' => self::TIPOS[$ext]]);
        // index.html sem cache (puxa o ?v= novo); o resto pode ficar em cache (tem ?v= na URL)
        $r->headers->set('Cache-Control', $ext === 'html' ? 'no-cache' : 'public, max-age=86400');
        $r->headers->set('X-Content-Type-Options', 'nosniff');

        return $r;
    }
}
