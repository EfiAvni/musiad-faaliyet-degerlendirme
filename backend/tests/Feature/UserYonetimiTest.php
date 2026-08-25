<?php

namespace Tests\Feature;

use App\Models\Birim;
use App\Models\Sube;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserYonetimiTest extends TestCase
{
    use RefreshDatabase;

    private function superadmin(): User
    {
        return User::factory()->create(['role' => 'superadmin']);
    }

    private function birim(): Birim
    {
        return Birim::create(['name' => 'Teşkilatlanma', 'status' => 'active']);
    }

    private function sube(?Birim $birim = null): Sube
    {
        return Sube::create([
            'name' => 'Ankara Şubesi', 'birim_id' => $birim?->id,
            'uye_sayisi' => 0, 'status' => 'active',
        ]);
    }

    public function test_yalnizca_superadmin_kullanicilari_listeleyebilir(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'birim_yoneticisi']));
        $this->getJson('/api/users')->assertStatus(403);

        Sanctum::actingAs($this->superadmin());
        $this->getJson('/api/users')->assertOk();
    }

    public function test_liste_parola_alani_dondurmez(): void
    {
        Sanctum::actingAs($this->superadmin());

        $yanit = $this->getJson('/api/users')->assertOk();

        foreach ($yanit->json() as $kullanici) {
            $this->assertArrayNotHasKey('password', $kullanici);
            $this->assertArrayNotHasKey('remember_token', $kullanici);
            $this->assertArrayHasKey('birim_adi', $kullanici);
            $this->assertArrayHasKey('initials', $kullanici);
        }
    }

    public function test_birim_yoneticisi_birimsiz_olusturulamaz(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->postJson('/api/users', [
            'name' => 'Test', 'email' => 'yeni@musiad.org.tr',
            'password' => 'guclu-parola', 'role' => 'birim_yoneticisi',
        ])->assertStatus(422)->assertJsonValidationErrors('birim_id');
    }

    public function test_sube_yoneticisi_subesiz_olusturulamaz(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->postJson('/api/users', [
            'name' => 'Test', 'email' => 'yeni@musiad.org.tr',
            'password' => 'guclu-parola', 'role' => 'sube_yoneticisi',
        ])->assertStatus(422)->assertJsonValidationErrors('sube_id');
    }

    public function test_kisa_parola_reddedilir(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->postJson('/api/users', [
            'name' => 'Test', 'email' => 'yeni@musiad.org.tr',
            'password' => 'kisa', 'role' => 'superadmin',
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_rol_degisince_uyumsuz_kapsam_temizlenir(): void
    {
        $birim = $this->birim();
        $sube = $this->sube($birim);
        Sanctum::actingAs($this->superadmin());

        $kullanici = User::factory()->create([
            'role' => 'sube_yoneticisi', 'birim_id' => $birim->id, 'sube_id' => $sube->id,
        ]);

        $this->putJson("/api/users/{$kullanici->id}", [
            'role' => 'birim_yoneticisi', 'birim_id' => $birim->id,
        ])->assertOk()->assertJsonPath('sube_id', null);

        $this->assertNull($kullanici->fresh()->sube_id);
    }

    public function test_superadmin_yapilinca_birim_ve_sube_temizlenir(): void
    {
        $birim = $this->birim();
        $sube = $this->sube($birim);
        Sanctum::actingAs($this->superadmin());

        $kullanici = User::factory()->create([
            'role' => 'sube_yoneticisi', 'birim_id' => $birim->id, 'sube_id' => $sube->id,
        ]);

        $this->putJson("/api/users/{$kullanici->id}", ['role' => 'superadmin'])
            ->assertOk()
            ->assertJsonPath('birim_id', null)
            ->assertJsonPath('sube_id', null);
    }

    public function test_kullanici_kendi_hesabini_silemez(): void
    {
        $admin = $this->superadmin();
        Sanctum::actingAs($admin);

        $this->deleteJson("/api/users/{$admin->id}")->assertStatus(422);

        $this->assertNotNull(User::find($admin->id));
    }

    public function test_son_superadmin_silinemez(): void
    {
        $admin = $this->superadmin();
        $digerAdmin = $this->superadmin();
        Sanctum::actingAs($admin);

        // İki süper admin varken silinebilir.
        $this->deleteJson("/api/users/{$digerAdmin->id}")->assertNoContent();

        // Tek kalan süper admini silmeye çalışan başka bir hesap da engellenmeli.
        $birim = $this->birim();
        $yonetici = User::factory()->create(['role' => 'birim_yoneticisi', 'birim_id' => $birim->id]);
        Sanctum::actingAs($yonetici);
        $this->deleteJson("/api/users/{$admin->id}")->assertStatus(403);
    }

    public function test_son_superadmin_baska_role_tasinamaz(): void
    {
        $admin = $this->superadmin();
        $birim = $this->birim();
        Sanctum::actingAs($admin);

        $this->putJson("/api/users/{$admin->id}", [
            'role' => 'birim_yoneticisi', 'birim_id' => $birim->id,
        ])->assertStatus(422)->assertJsonValidationErrors('role');
    }

    public function test_silinen_kullanici_yumusak_silinir_ve_oturumu_kapanir(): void
    {
        $admin = $this->superadmin();
        $hedef = User::factory()->create(['role' => 'superadmin']);
        $hedefJeton = $hedef->createToken('test')->plainTextToken;

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/users/{$hedef->id}")->assertNoContent();

        $this->assertNull(User::find($hedef->id));
        $this->assertNotNull(User::withTrashed()->find($hedef->id));
        $this->assertSame(0, $hedef->tokens()->count());

        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', "Bearer {$hedefJeton}")
            ->getJson('/api/auth/me')
            ->assertStatus(401);
    }

    public function test_parola_sifirlaninca_kullanicinin_oturumlari_kapanir(): void
    {
        $hedef = User::factory()->create(['role' => 'superadmin', 'password' => Hash::make('eski-parola')]);
        $hedefJeton = $hedef->createToken('telefon')->plainTextToken;

        Sanctum::actingAs($this->superadmin());

        $this->putJson("/api/users/{$hedef->id}", ['password' => 'yeni-guclu-parola'])->assertOk();

        $this->assertSame(0, $hedef->tokens()->count());
        $this->assertTrue(Hash::check('yeni-guclu-parola', $hedef->fresh()->password));

        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', "Bearer {$hedefJeton}")
            ->getJson('/api/auth/me')
            ->assertStatus(401);
    }

    public function test_kendi_parolasini_degistiren_admin_oturumda_kalir(): void
    {
        $admin = User::factory()->create(['role' => 'superadmin', 'password' => Hash::make('eski-parola')]);
        $baskaCihaz = $admin->createToken('eski-cihaz')->plainTextToken;

        // Sanctum::actingAs kalıcı olmayan bir jeton üretir; "işlemi yapan
        // oturum ayakta kalsın" kuralı gerçek bir Bearer jetonuyla sınanmalı.
        $buCihaz = $admin->createToken('bu-cihaz')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$buCihaz}")
            ->putJson("/api/users/{$admin->id}", ['password' => 'yeni-guclu-parola'])
            ->assertOk();

        // Diğer cihazlar düşer, işlemi yapan oturum ayakta kalır.
        $this->assertSame(1, $admin->tokens()->count());

        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', "Bearer {$baskaCihaz}")
            ->getJson('/api/auth/me')
            ->assertStatus(401);
    }

    public function test_parola_degistirmeden_guncelleme_parolayi_bozmaz(): void
    {
        Sanctum::actingAs($this->superadmin());

        $kullanici = User::factory()->create([
            'role'     => 'superadmin',
            'password' => Hash::make('eski-parola'),
        ]);

        $this->putJson("/api/users/{$kullanici->id}", ['name' => 'Yeni Ad'])->assertOk();

        $this->assertTrue(Hash::check('eski-parola', $kullanici->fresh()->password));
    }
}
