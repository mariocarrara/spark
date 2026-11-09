<?php

use App\Http\Controllers\FrontController;
use Illuminate\Support\Facades\Route;

// Front-end do legado servido pelo Laravel (mesmo endereco da API: http://localhost:8000).
// As rotas /api/* ficam em routes/api.php e tem prioridade.
Route::get('/{caminho?}', FrontController::class)->where('caminho', '^(?!api/).*');
