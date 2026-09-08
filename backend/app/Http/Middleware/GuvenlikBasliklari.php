<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tarayıcıya ne yapmasına izin verildiğini söyleyen yanıt başlıkları.
 *
 * Laravel bunları kendiliğinden göndermez. Yokluklarında tarayıcı varsayılan
 * olarak en gevşek davranışı seçer: sayfa görünmez bir çerçeveye alınabilir,
 * içerik türü tahmin edilebilir, bir kez http'ye düşen bağlantı https'e geri
 * dönmez.
 *
 * Bu uygulama yalnızca JSON API sunar (arayüz ayrı bir web sunucusundan
 * gelir), bu yüzden politika olabildiğince dar tutuldu.
 */
class GuvenlikBasliklari
{
    public function handle(Request $request, Closure $next): Response
    {
        $yanit = $next($request);

        // PHP sürümünü dışarıya duyurmanın kimseye faydası yok; saldırgana
        // hangi açıkları deneyeceğini söyler.
        $yanit->headers->remove('X-Powered-By');
        header_remove('X-Powered-By');

        $yanit->headers->set('X-Content-Type-Options', 'nosniff');
        $yanit->headers->set('X-Frame-Options', 'DENY');
        $yanit->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $yanit->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

        // API hiçbir şey yüklemez ve hiçbir yere gömülmez. frame-ancestors,
        // X-Frame-Options'ın modern karşılığı; ikisi birlikte eski ve yeni
        // tarayıcıları kapsar.
        $yanit->headers->set(
            'Content-Security-Policy',
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        );

        // HSTS yalnızca https üzerinden anlamlı: http yanıtında tarayıcı zaten
        // yok sayar, ama göndermemek niyeti daha açık kılar. Süre ve alt alan
        // kapsamı dağıtıma göre değişebilsin diye ayardan okunur.
        if ($request->secure() && config('guvenlik.hsts.aktif')) {
            $deger = 'max-age=' . (int) config('guvenlik.hsts.sure');

            if (config('guvenlik.hsts.alt_alanlar')) {
                $deger .= '; includeSubDomains';
            }

            $yanit->headers->set('Strict-Transport-Security', $deger);
        }

        return $yanit;
    }
}
