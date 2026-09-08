<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ters vekil arkasında gerçek istemci IP'si X-Forwarded-For başlığında gelir.
 *
 * Güven tanımlanmazsa Laravel her isteğin vekilden geldiğini sanar; giriş
 * ekranındaki IP başına hız sınırı tüm kullanıcılar için tek bir kovaya düşer
 * ve başarısız giriş kayıtlarına vekilin IP'si yazılır.
 *
 * Ters yönde de tehlikeli: her IP'ye güvenilirse herkes kendi adresini
 * uydurabilir ve kendine ait kilidi atlatabilir.
 */
class VekilGuveniTest extends TestCase
{
    use RefreshDatabase;

    private function istekIpsi(string $uzakAdres, ?string $forwardedFor): ?string
    {
        $sunucu = ['REMOTE_ADDR' => $uzakAdres];

        if ($forwardedFor !== null) {
            $sunucu['HTTP_X_FORWARDED_FOR'] = $forwardedFor;
        }

        $istek = \Illuminate\Http\Request::create('/api/donemler', 'GET', [], [], [], $sunucu);

        // Uygulamanın middleware yığınından geçir; güven ayarı orada uygulanır.
        $this->app->make(\Illuminate\Contracts\Http\Kernel::class)->handle($istek);

        return $istek->ip();
    }

    public function test_guvenilen_vekilin_ilettigi_ip_kullanilir(): void
    {
        $this->assertSame(
            '203.0.113.9',
            $this->istekIpsi('127.0.0.1', '203.0.113.9'),
            'Yerel vekilden gelen X-Forwarded-For dikkate alınmalı.',
        );
    }

    public function test_guvenilmeyen_kaynagin_ilettigi_ip_yok_sayilir(): void
    {
        $this->assertSame(
            '198.51.100.7',
            $this->istekIpsi('198.51.100.7', '203.0.113.9'),
            'Vekil olmayan bir adres kendi IP\'sini uyduramamalı.',
        );
    }

    public function test_baslik_yokken_uzak_adres_kullanilir(): void
    {
        $this->assertSame('127.0.0.1', $this->istekIpsi('127.0.0.1', null));
    }
}
