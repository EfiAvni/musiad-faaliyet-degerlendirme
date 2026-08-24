<?php

namespace Tests\Feature;

use App\Models\Birim;
use App\Models\Donem;
use App\Models\DonemAy;
use App\Models\Faaliyet;
use App\Models\FaaliyetKayit;
use App\Models\Sube;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Tüm yabancı anahtarlar cascade tanımlı olduğu için tek bir kalıcı silme,
 * bağlı geçmiş kayıtları da götürüyordu. Bu testler hem silme engellerinin
 * çalıştığını hem de izin verilen silmelerin yumuşak silme olduğunu doğrular.
 */
class SilmeKorumasiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Silme kurallarını test ediyoruz, birim kapsamını değil - kapsamın
     * araya girmemesi için süper admin kullanıyoruz (kapsam kuralları
     * BirimKapsamiTest'te ayrıca doğrulanıyor).
     */
    private function yonetici(): User
    {
        return User::factory()->create(['role' => 'superadmin']);
    }

    /** Kayıt girilmiş, dolayısıyla silinmemesi gereken bir kurulum üretir. */
    private function kayitliKurulum(): array
    {
        $birim = Birim::create(['name' => 'Teşkilatlanma', 'status' => 'active']);
        $sube = Sube::create(['name' => 'Ankara Şubesi', 'uye_sayisi' => 0, 'status' => 'active']);

        $donem = Donem::create([
            'name'        => '2026 Birinci Yarı',
            'birim_id'    => $birim->id,
            'start_date'  => now()->startOfMonth(),
            'end_date'    => now()->endOfMonth(),
            'status'      => 'completed',
            'tum_subeler' => true,
        ]);

        $ay = DonemAy::create([
            'donem_id'   => $donem->id,
            'sira'       => 1,
            'name'       => 'Ocak 2026',
            'start_date' => now()->startOfMonth(),
            'end_date'   => now()->endOfMonth(),
        ]);

        $faaliyet = Faaliyet::create([
            'title' => 'Üye Ziyareti', 'puan' => 10, 'hedef' => 5,
            'tarih_gerekli' => false, 'donem_id' => $donem->id, 'durum' => 'active',
        ]);

        $kayit = FaaliyetKayit::create([
            'faaliyet_id' => $faaliyet->id,
            'sube_id'     => $sube->id,
            'donem_ay_id' => $ay->id,
            'deger'       => '1',
        ]);

        return compact('birim', 'sube', 'donem', 'faaliyet', 'kayit');
    }

    public function test_kayitli_sube_silinemez(): void
    {
        $k = $this->kayitliKurulum();
        Sanctum::actingAs($this->yonetici());

        $this->deleteJson("/api/subeler/{$k['sube']->id}")->assertStatus(422);

        $this->assertDatabaseHas('subeler', ['id' => $k['sube']->id, 'deleted_at' => null]);
        $this->assertDatabaseHas('faaliyet_kayitlari', ['id' => $k['kayit']->id, 'deleted_at' => null]);
    }

    public function test_kayitli_faaliyet_silinemez(): void
    {
        $k = $this->kayitliKurulum();
        Sanctum::actingAs($this->yonetici());

        $this->deleteJson("/api/faaliyetler/{$k['faaliyet']->id}")->assertStatus(422);

        $this->assertDatabaseHas('faaliyetler', ['id' => $k['faaliyet']->id, 'deleted_at' => null]);
    }

    public function test_tamamlanmis_donem_kayit_varsa_silinemez(): void
    {
        $k = $this->kayitliKurulum();
        Sanctum::actingAs($this->yonetici());

        $this->deleteJson("/api/donemler/{$k['donem']->id}")->assertStatus(422);

        $this->assertDatabaseHas('donemler', ['id' => $k['donem']->id, 'deleted_at' => null]);
        $this->assertDatabaseHas('faaliyet_kayitlari', ['id' => $k['kayit']->id, 'deleted_at' => null]);
    }

    public function test_aktif_donem_silinemez(): void
    {
        $donem = Donem::create([
            'name' => 'Aktif Dönem', 'start_date' => now()->startOfMonth(),
            'end_date' => now()->endOfMonth(), 'status' => 'active', 'tum_subeler' => true,
        ]);
        Sanctum::actingAs($this->yonetici());

        $this->deleteJson("/api/donemler/{$donem->id}")->assertStatus(422);
    }

    public function test_donemi_olan_birim_silinemez(): void
    {
        $k = $this->kayitliKurulum();
        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        // Birimi silmek dönemlerini, faaliyetlerini ve tüm kayıtlarını götürürdü.
        $this->deleteJson("/api/birimler/{$k['birim']->id}")->assertStatus(422);

        $this->assertDatabaseHas('birimler', ['id' => $k['birim']->id, 'deleted_at' => null]);
    }

    public function test_bos_sube_yumusak_silinir(): void
    {
        $sube = Sube::create(['name' => 'Boş Şube', 'uye_sayisi' => 0, 'status' => 'active']);
        Sanctum::actingAs($this->yonetici());

        $this->deleteJson("/api/subeler/{$sube->id}")->assertNoContent();

        // Satır tabloda kalmalı, yalnızca sorgulardan düşmeli.
        $this->assertDatabaseHas('subeler', ['id' => $sube->id]);
        $this->assertNotNull(Sube::withTrashed()->find($sube->id)->deleted_at);
        $this->assertNull(Sube::find($sube->id));

        $this->getJson('/api/subeler')->assertOk()->assertJsonMissing(['name' => 'Boş Şube']);
    }

    public function test_bos_donem_silinince_faaliyetleri_de_duser(): void
    {
        $donem = Donem::create([
            'name' => 'Kayıtsız Dönem', 'start_date' => now()->startOfMonth(),
            'end_date' => now()->endOfMonth(), 'status' => 'completed', 'tum_subeler' => true,
        ]);
        $faaliyet = Faaliyet::create([
            'title' => 'Kayıtsız Faaliyet', 'puan' => 5, 'hedef' => 1,
            'tarih_gerekli' => false, 'donem_id' => $donem->id, 'durum' => 'active',
        ]);
        Sanctum::actingAs($this->yonetici());

        $this->deleteJson("/api/donemler/{$donem->id}")->assertNoContent();

        $this->assertNull(Donem::find($donem->id));
        $this->assertNull(Faaliyet::find($faaliyet->id), 'Dönem silinince faaliyetleri de sorgulardan düşmeli.');
        $this->assertNotNull(Faaliyet::withTrashed()->find($faaliyet->id));
    }

    public function test_silinmis_sube_ayni_isimle_iceri_aktarilinca_geri_gelir(): void
    {
        $sube = Sube::create(['name' => 'Bursa Şubesi', 'uye_sayisi' => 10, 'status' => 'active']);
        $sube->delete();

        Sanctum::actingAs($this->yonetici());

        $this->postJson('/api/subeler/import', [
            'subeler' => [['name' => 'Bursa Şubesi', 'uye_sayisi' => 25]],
        ])->assertOk()->assertJsonPath('created', 1);

        // Yeni satır açılmamalı, eski kayıt geri getirilmeli.
        $this->assertSame(1, Sube::withTrashed()->where('name', 'Bursa Şubesi')->count());
        $this->assertNotNull(Sube::find($sube->id));
    }
}
