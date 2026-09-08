<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Arayüz jeton başlığı gönderdiği için tarayıcı istekleri "basit" saymaz ve
 * her API çağrısından önce bir OPTIONS isteği atar. max_age sıfırken bu tur
 * hiç önbelleklenmiyordu; yani her istek iki tura çıkıyordu.
 */
class CorsPreflightTest extends TestCase
{
    private function preflight(string $origin = 'http://localhost:5173')
    {
        return $this->call('OPTIONS', '/api/donemler', [], [], [], [
            'HTTP_ORIGIN'                         => $origin,
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD'  => 'GET',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'authorization',
        ]);
    }

    public function test_preflight_onbellek_suresi_bildirilir(): void
    {
        $yanit = $this->preflight();

        $yanit->assertNoContent(204);
        $this->assertSame('86400', $yanit->headers->get('Access-Control-Max-Age'));
    }

    public function test_preflight_suresi_ayarlanabilir(): void
    {
        config(['cors.max_age' => 600]);

        $this->assertSame('600', $this->preflight()->headers->get('Access-Control-Max-Age'));
    }

    /**
     * Üretim dışında localhost portları kabul edilir; geliştirme sunucusunun
     * portu değiştiğinde CORS sessizce kırılmasın diye.
     */
    public function test_yerel_gelistirme_kaynagi_kabul_edilir(): void
    {
        $this->assertSame(
            'http://localhost:5173',
            $this->preflight()->headers->get('Access-Control-Allow-Origin'),
        );
    }

    /** İzinli listede olmayan bir kaynak preflight'tan izin almaz. */
    public function test_yabanci_kaynak_izin_almaz(): void
    {
        $yanit = $this->preflight('https://baska-site.example');

        $this->assertNull($yanit->headers->get('Access-Control-Allow-Origin'));
    }
}
