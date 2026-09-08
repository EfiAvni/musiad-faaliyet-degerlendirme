<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->hizLimitleri();
    }

    /**
     * Kimliği doğrulanmış uçların hız sınırları.
     *
     * Giriş ekranının kendi kilidi ayrı (AuthController: e-posta + IP başına 5
     * deneme). Buradakiler oturum açmış kullanıcılar için: jetonu ele geçirilmiş
     * ya da hatalı bir istemci sistemi meşgul edemesin diye.
     *
     * Sınır kullanıcı kimliğine göre tutulur; oturum yoksa IP'ye düşer. IP'ye
     * düşen dal yalnızca kimlik doğrulaması başarısız isteklerde devreye girer,
     * çünkü bu uçlar zaten auth:sanctum arkasında.
     */
    private function hizLimitleri(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(
            (int) config('guvenlik.limit.genel')
        )->by($this->anahtar($request)));

        // Raporlar en pahalı uçlar: tek bir yıllık rapor isteği yüzlerce
        // milisaniye sunucu zamanı harcar. Bu yüzden ayrı ve dar bir sınır.
        RateLimiter::for('raporlar', fn (Request $request) => Limit::perMinute(
            (int) config('guvenlik.limit.raporlar')
        )->by($this->anahtar($request)));
    }

    private function anahtar(Request $request): string
    {
        return $request->user()?->id
            ? 'kullanici:' . $request->user()->id
            : 'ip:' . $request->ip();
    }
}
