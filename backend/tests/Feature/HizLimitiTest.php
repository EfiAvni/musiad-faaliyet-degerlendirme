<?php

namespace Tests\Feature;

use App\Models\Donem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Giriş ekranının kendi kilidi ayrıdır (AuthController). Buradakiler kimliği
 * doğrulanmış kullanıcılar için: jetonu ele geçirilmiş ya da hatalı bir
 * istemci sistemi meşgul edemesin diye.
 */
class HizLimitiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('kullanici:1');
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => 'superadmin']);
    }

    public function test_genel_sinir_asilinca_429_doner(): void
    {
        config(['guvenlik.limit.genel' => 3]);
        Sanctum::actingAs($this->superadmin());

        for ($i = 0; $i < 3; $i++) {
            $this->getJson('/api/donemler')->assertOk();
        }

        $this->getJson('/api/donemler')->assertStatus(429);
    }

    public function test_sinir_yaniti_kalan_hakki_bildirir(): void
    {
        config(['guvenlik.limit.genel' => 5]);
        Sanctum::actingAs($this->superadmin());

        $yanit = $this->getJson('/api/donemler')->assertOk();

        $this->assertSame('5', $yanit->headers->get('X-RateLimit-Limit'));
        $this->assertSame('4', $yanit->headers->get('X-RateLimit-Remaining'));
    }

    /** Raporlar pahalı olduğu için genel sınırın altında ayrı bir sınıra tabi. */
    public function test_raporlar_kendi_dar_sinirina_tabi(): void
    {
        config(['guvenlik.limit.genel' => 100, 'guvenlik.limit.raporlar' => 2]);
        Sanctum::actingAs($this->superadmin());

        $donem = Donem::create([
            'name' => 'Sinir Donemi', 'start_date' => now()->startOfMonth(),
            'end_date' => now()->endOfMonth(), 'status' => 'active', 'tum_subeler' => true,
        ]);

        $this->getJson("/api/raporlar/{$donem->id}")->assertOk();
        $this->getJson("/api/raporlar/{$donem->id}")->assertOk();
        $this->getJson("/api/raporlar/{$donem->id}")->assertStatus(429);

        // Rapor sınırı dolsa da diğer uçlar çalışmaya devam eder.
        $this->getJson('/api/donemler')->assertOk();
    }

    /** Sınır kullanıcı başına: bir hesabın taşkınlığı diğerini etkilemez. */
    public function test_sinir_kullanici_basina_tutulur(): void
    {
        config(['guvenlik.limit.genel' => 2]);

        $birinci = $this->superadmin();
        $ikinci = $this->superadmin();

        Sanctum::actingAs($birinci);
        $this->getJson('/api/donemler')->assertOk();
        $this->getJson('/api/donemler')->assertOk();
        $this->getJson('/api/donemler')->assertStatus(429);

        Sanctum::actingAs($ikinci);
        $this->getJson('/api/donemler')->assertOk();
    }
}
