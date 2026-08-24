<?php

namespace Tests\Feature;

use App\Models\Birim;
use App\Models\Sube;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function kullanici(array $ozellikler = []): User
    {
        return User::factory()->create(array_merge([
            'email'    => 'test@musiad.org.tr',
            'password' => Hash::make('dogru-parola'),
            'role'     => 'sube_yoneticisi',
        ], $ozellikler));
    }

    private function hataliGiris(string $email = 'test@musiad.org.tr'): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/auth/login', [
            'email'    => $email,
            'password' => 'yanlis-parola',
        ]);
    }

    public function test_hatali_girisler_bes_denemeden_sonra_kilitlenir(): void
    {
        $this->kullanici();

        for ($i = 1; $i <= 5; $i++) {
            $this->hataliGiris()->assertStatus(422);
        }

        $this->hataliGiris()
            ->assertStatus(429)
            ->assertJsonPath('errors.email.0', fn (string $mesaj) => str_contains($mesaj, 'Çok fazla hatalı deneme'));
    }

    public function test_kilit_dogru_parolayi_da_engeller(): void
    {
        $this->kullanici();

        for ($i = 1; $i <= 5; $i++) {
            $this->hataliGiris();
        }

        $this->postJson('/api/auth/login', [
            'email'    => 'test@musiad.org.tr',
            'password' => 'dogru-parola',
        ])->assertStatus(429);
    }

    public function test_basarili_giris_sayaci_sifirlar(): void
    {
        $this->kullanici();

        $this->hataliGiris()->assertStatus(422);
        $this->hataliGiris()->assertStatus(422);

        $this->postJson('/api/auth/login', [
            'email'    => 'test@musiad.org.tr',
            'password' => 'dogru-parola',
        ])->assertOk();

        // Sayaç sıfırlandığı için beş hak yeniden baştan verilmeli.
        for ($i = 1; $i <= 5; $i++) {
            $this->hataliGiris()->assertStatus(422);
        }
    }

    public function test_kilit_baska_kullaniciyi_etkilemez(): void
    {
        $this->kullanici();
        $this->kullanici(['email' => 'diger@musiad.org.tr']);

        for ($i = 1; $i <= 6; $i++) {
            $this->hataliGiris();
        }

        $this->postJson('/api/auth/login', [
            'email'    => 'diger@musiad.org.tr',
            'password' => 'dogru-parola',
        ])->assertOk();
    }

    public function test_giris_yaniti_parola_icermez_ve_birim_sube_adini_dondurur(): void
    {
        $birim = Birim::create(['name' => 'Teşkilatlanma', 'status' => 'active']);
        $sube = Sube::create(['name' => 'Ankara Şubesi', 'birim_id' => $birim->id, 'uye_sayisi' => 0, 'status' => 'active']);

        $this->kullanici([
            'name'     => 'Muhammet Avni Küçük',
            'birim_id' => $birim->id,
            'sube_id'  => $sube->id,
        ]);

        $yanit = $this->postJson('/api/auth/login', [
            'email'    => 'test@musiad.org.tr',
            'password' => 'dogru-parola',
        ])->assertOk();

        $yanit->assertJsonPath('user.birim_adi', 'Teşkilatlanma')
            ->assertJsonPath('user.sube_adi', 'Ankara Şubesi')
            ->assertJsonPath('user.initials', 'MK');

        $this->assertArrayNotHasKey('password', $yanit->json('user'));
        $this->assertArrayNotHasKey('remember_token', $yanit->json('user'));
    }

    public function test_yeni_giris_onceki_jetonlari_gecersiz_kilar(): void
    {
        $user = $this->kullanici();
        $eskiJeton = $user->createToken('eski')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$eskiJeton}")
            ->getJson('/api/auth/me')
            ->assertOk();

        $this->postJson('/api/auth/login', [
            'email'    => 'test@musiad.org.tr',
            'password' => 'dogru-parola',
        ])->assertOk();

        $this->assertSame(1, $user->tokens()->count(), 'Girişten sonra yalnızca yeni jeton kalmalı.');

        // Guard, aynı test süreci içinde çözümlediği kullanıcıyı önbellekte tutar;
        // gerçek bir sonraki istekte olduğu gibi jetonun yeniden doğrulanması için
        // önbelleği boşaltıyoruz.
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', "Bearer {$eskiJeton}")
            ->getJson('/api/auth/me')
            ->assertStatus(401);
    }
}
