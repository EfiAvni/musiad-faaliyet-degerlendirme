<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Yanıt başlıkları tarayıcıya ne yapmasına izin verildiğini söyler. Laravel
 * bunları kendiliğinden göndermez ve yokluklarında tarayıcı en gevşek
 * davranışı seçer.
 */
class GuvenlikBasliklariTest extends TestCase
{
    use RefreshDatabase;

    private function istek()
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        return $this->getJson('/api/donemler');
    }

    public function test_temel_basliklar_gonderilir(): void
    {
        $yanit = $this->istek()->assertOk();

        $this->assertSame('nosniff', $yanit->headers->get('X-Content-Type-Options'));
        $this->assertSame('DENY', $yanit->headers->get('X-Frame-Options'));
        $this->assertSame('strict-origin-when-cross-origin', $yanit->headers->get('Referrer-Policy'));
        $this->assertNotNull($yanit->headers->get('Permissions-Policy'));
    }

    /** API hiçbir kaynak yüklemez ve hiçbir yere gömülmez. */
    public function test_icerik_guvenlik_politikasi_dar(): void
    {
        $csp = $this->istek()->headers->get('Content-Security-Policy');

        $this->assertStringContainsString("default-src 'none'", $csp);
        $this->assertStringContainsString("frame-ancestors 'none'", $csp);
    }

    public function test_php_surumu_sizdirilmaz(): void
    {
        $this->assertNull($this->istek()->headers->get('X-Powered-By'));
    }

    /** HSTS yalnızca https üzerinden anlamlıdır. */
    public function test_hsts_http_uzerinden_gonderilmez(): void
    {
        $this->assertNull($this->istek()->headers->get('Strict-Transport-Security'));
    }

    public function test_hsts_https_uzerinden_gonderilir(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $yanit = $this->getJson('https://localhost/api/donemler')->assertOk();

        $this->assertSame('max-age=31536000', $yanit->headers->get('Strict-Transport-Security'));
    }

    /**
     * Alt alan kapsamı varsayılan olarak kapalı: https'e geçmemiş bir alt alan
     * varsa includeSubDomains onu erişilemez kılar.
     */
    public function test_alt_alan_kapsami_acilabilir(): void
    {
        config(['guvenlik.hsts.alt_alanlar' => true]);
        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $this->assertStringContainsString(
            'includeSubDomains',
            (string) $this->getJson('https://localhost/api/donemler')->headers->get('Strict-Transport-Security'),
        );
    }

    public function test_hsts_kapatilabilir(): void
    {
        config(['guvenlik.hsts.aktif' => false]);
        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $this->assertNull(
            $this->getJson('https://localhost/api/donemler')->headers->get('Strict-Transport-Security'),
        );
    }

    /** Giriş ekranı gibi kimlik doğrulaması olmayan yanıtlarda da geçerli. */
    public function test_basliklar_kimlik_dogrulamasiz_yanitlarda_da_var(): void
    {
        $yanit = $this->postJson('/api/auth/login', ['email' => 'yok@ornek.com', 'password' => 'yanlis']);

        $this->assertSame('nosniff', $yanit->headers->get('X-Content-Type-Options'));
    }
}
