<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
        ]);

        /*
         * Ters vekil arkasında gerçek istemci IP'si X-Forwarded-For başlığında
         * gelir. Bu güven tanımlanmazsa Laravel her isteğin vekilden geldiğini
         * sanar; giriş ekranındaki IP başına hız sınırı tüm kullanıcılar için
         * tek bir kovaya düşer ve başarısız giriş kayıtlarına vekilin IP'si
         * yazılır.
         *
         * Varsayılan, aynı makinedeki nginx/Apache kurulumunu kapsar. Vekil
         * başka bir sunucudaysa ya da bir yük dengeleyici varsa TRUSTED_PROXIES
         * ile adresleri (veya "*") verilmelidir.
         *
         * "*" yalnızca uygulamaya SADECE vekil üzerinden erişilebiliyorsa
         * güvenlidir: aksi halde herkes kendi IP'sini uydurabilir.
         */
        $middleware->trustProxies(
            at: array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', '127.0.0.1,::1'))),
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO,
        );

        // Güvenlik başlıkları her yanıtta, API dışı rotalarda da olsun.
        $middleware->append(\App\Http\Middleware\GuvenlikBasliklari::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
