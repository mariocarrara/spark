<?php

namespace App\Providers;

use App\Services\SessaoToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Guard "api": token Bearer validado na tabela `sessoes` (ver SessaoToken).
        Auth::viaRequest('spark-token', fn (Request $request) => SessaoToken::resolver($request->bearerToken()));
    }
}
