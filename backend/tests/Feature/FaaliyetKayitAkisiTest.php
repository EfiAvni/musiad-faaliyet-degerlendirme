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
 * Faaliyet kaydı girişi sistemin en çok kullanılan işlemi: her şube yöneticisi
 * her ay bunu yapar. Arkasında on ayrı iş kuralı var ve bu kurallar sessizce
 * bozulursa ay kapanana kadar kimse fark etmez - bu yüzden yazma uçlarının
 * (store / update / destroy) tamamı burada kapsanıyor.
 */
class FaaliyetKayitAkisiTest extends TestCase
{
    use RefreshDatabase;

    private Birim $birim;
    private Sube $ankara;
    private Sube $izmir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->birim = Birim::create(['name' => 'Teşkilatlanma', 'status' => 'active']);
        $this->ankara = Sube::create(['name' => 'MÜSİAD Ankara', 'uye_sayisi' => 10, 'status' => 'active']);
        $this->izmir = Sube::create(['name' => 'MÜSİAD İzmir', 'uye_sayisi' => 20, 'status' => 'active']);
    }

    private function subeYoneticisi(?Sube $sube = null): User
    {
        return User::factory()->create([
            'role'    => 'sube_yoneticisi',
            'sube_id' => ($sube ?? $this->ankara)->id,
        ]);
    }

    private function donem(string $durum = 'active', bool $tumSubeler = true): Donem
    {
        return Donem::create([
            'name'        => 'Dönem ' . uniqid(),
            'birim_id'    => $this->birim->id,
            'start_date'  => now()->startOfMonth(),
            'end_date'    => now()->endOfMonth(),
            'status'      => $durum,
            'tum_subeler' => $tumSubeler,
        ]);
    }

    /** Varsayılan olarak bugünü kapsayan, yani açık olan bir ay üretir. */
    private function ay(Donem $donem, ?string $baslangic = null, ?string $bitis = null): DonemAy
    {
        return DonemAy::create([
            'donem_id'   => $donem->id,
            'sira'       => 1,
            'name'       => 'Değerlendirme Ayı',
            'start_date' => $baslangic ?? now()->startOfMonth(),
            'end_date'   => $bitis ?? now()->endOfMonth(),
        ]);
    }

    private function faaliyet(Donem $donem, bool $tarihGerekli = false): Faaliyet
    {
        return Faaliyet::create([
            'title'         => 'Üye Ziyareti',
            'detay'         => 'Ziyaret sayısı',
            'puan'          => 10,
            'hedef'         => 5,
            'tarih_gerekli' => $tarihGerekli,
            'donem_id'      => $donem->id,
            'durum'         => 'active',
        ]);
    }

    // ─── Mutlu yol ────────────────────────────────────────────────────────────

    public function test_sube_yoneticisi_acik_ayda_kayit_ekleyebilir(): void
    {
        $donem = $this->donem();
        $ay = $this->ay($donem);
        $faaliyet = $this->faaliyet($donem);

        $user = $this->subeYoneticisi();
        Sanctum::actingAs($user);

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id,
            'deger'       => '3',
            'aciklama'    => 'Üç üye ziyaret edildi',
        ])->assertCreated();

        $this->assertDatabaseHas('faaliyet_kayitlari', [
            'faaliyet_id' => $faaliyet->id,
            'sube_id'     => $this->ankara->id,
            'donem_ay_id' => $ay->id,
            'deger'       => '3',
            'created_by'  => $user->id,
        ]);
    }

    public function test_kayit_daima_kullanicinin_kendi_subesine_yazilir(): void
    {
        $donem = $this->donem();
        $this->ay($donem);
        $faaliyet = $this->faaliyet($donem);

        Sanctum::actingAs($this->subeYoneticisi());

        // İstemci başka bir şube göndermeye çalışsa bile dikkate alınmamalı.
        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id,
            'deger'       => '1',
            'sube_id'     => $this->izmir->id,
        ])->assertCreated();

        $this->assertSame($this->ankara->id, FaaliyetKayit::first()->sube_id);
    }

    // ─── Kim kayıt girebilir ──────────────────────────────────────────────────

    public function test_birim_yoneticisi_kayit_ekleyemez(): void
    {
        $donem = $this->donem();
        $this->ay($donem);
        $faaliyet = $this->faaliyet($donem);

        Sanctum::actingAs(User::factory()->create([
            'role' => 'birim_yoneticisi', 'birim_id' => $this->birim->id,
        ]));

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id, 'deger' => '1',
        ])->assertStatus(422)->assertJsonValidationErrors('sube_id');
    }

    public function test_subesiz_sube_yoneticisi_kayit_ekleyemez(): void
    {
        $donem = $this->donem();
        $this->ay($donem);
        $faaliyet = $this->faaliyet($donem);

        Sanctum::actingAs(User::factory()->create(['role' => 'sube_yoneticisi', 'sube_id' => null]));

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id, 'deger' => '1',
        ])->assertStatus(422)->assertJsonValidationErrors('sube_id');
    }

    // ─── Dönem durumu ve kapsamı ──────────────────────────────────────────────

    public function test_aktif_olmayan_donemin_faaliyetine_kayit_eklenemez(): void
    {
        foreach (['pending', 'completed'] as $durum) {
            $donem = $this->donem($durum);
            $this->ay($donem);
            $faaliyet = $this->faaliyet($donem);

            Sanctum::actingAs($this->subeYoneticisi());

            $this->postJson('/api/faaliyet-kayitlari', [
                'faaliyet_id' => $faaliyet->id, 'deger' => '1',
            ])->assertStatus(422)->assertJsonValidationErrors('faaliyet_id');
        }

        $this->assertSame(0, FaaliyetKayit::count());
    }

    public function test_sube_donemin_kapsaminda_degilse_kayit_eklenemez(): void
    {
        // Yalnızca İzmir için açılmış bir dönem.
        $donem = $this->donem('active', false);
        $donem->subeler()->sync([$this->izmir->id]);
        $this->ay($donem);
        $faaliyet = $this->faaliyet($donem);

        Sanctum::actingAs($this->subeYoneticisi());

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id, 'deger' => '1',
        ])->assertStatus(422)->assertJsonValidationErrors('faaliyet_id');
    }

    public function test_kapsamdaki_sube_belirli_subeli_doneme_kayit_ekleyebilir(): void
    {
        $donem = $this->donem('active', false);
        $donem->subeler()->sync([$this->ankara->id]);
        $this->ay($donem);
        $faaliyet = $this->faaliyet($donem);

        Sanctum::actingAs($this->subeYoneticisi());

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id, 'deger' => '1',
        ])->assertCreated();
    }

    // ─── Açık ay penceresi ────────────────────────────────────────────────────

    public function test_acik_ay_yoksa_kayit_eklenemez(): void
    {
        $donem = $this->donem();
        // Geçmişte kalmış, dolayısıyla kapalı bir ay.
        $this->ay($donem, now()->subMonths(3)->startOfMonth()->toDateString(), now()->subMonths(3)->endOfMonth()->toDateString());
        $faaliyet = $this->faaliyet($donem);

        Sanctum::actingAs($this->subeYoneticisi());

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id, 'deger' => '1',
        ])->assertStatus(422)->assertJsonValidationErrors('donem_ay_id');
    }

    public function test_elle_acilan_gecmis_ay_kayit_kabul_eder(): void
    {
        $donem = $this->donem();
        $ay = $this->ay($donem, now()->subMonths(3)->startOfMonth()->toDateString(), now()->subMonths(3)->endOfMonth()->toDateString());
        $ay->update(['acik_override' => true]);
        $faaliyet = $this->faaliyet($donem);

        Sanctum::actingAs($this->subeYoneticisi());

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id, 'deger' => '1',
        ])->assertCreated();
    }

    public function test_elle_kapatilan_gunun_ayi_kayit_kabul_etmez(): void
    {
        $donem = $this->donem();
        $ay = $this->ay($donem);
        $ay->update(['acik_override' => false]);
        $faaliyet = $this->faaliyet($donem);

        Sanctum::actingAs($this->subeYoneticisi());

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id, 'deger' => '1',
        ])->assertStatus(422)->assertJsonValidationErrors('donem_ay_id');
    }

    // ─── Tarih kuralları ──────────────────────────────────────────────────────

    public function test_tarih_gerektiren_faaliyette_tarih_zorunlu(): void
    {
        $donem = $this->donem();
        $this->ay($donem);
        $faaliyet = $this->faaliyet($donem, tarihGerekli: true);

        Sanctum::actingAs($this->subeYoneticisi());

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id, 'deger' => '1',
        ])->assertStatus(422)->assertJsonValidationErrors('tarih');
    }

    public function test_ay_araligi_disindaki_tarih_reddedilir(): void
    {
        $donem = $this->donem();
        $this->ay($donem);
        $faaliyet = $this->faaliyet($donem, tarihGerekli: true);

        Sanctum::actingAs($this->subeYoneticisi());

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id,
            'deger'       => '1',
            'tarih'       => now()->addMonths(2)->startOfMonth()->toDateString(),
        ])->assertStatus(422)->assertJsonValidationErrors('tarih');
    }

    public function test_ay_araligi_icindeki_tarih_kabul_edilir(): void
    {
        $donem = $this->donem();
        $ay = $this->ay($donem);
        $faaliyet = $this->faaliyet($donem, tarihGerekli: true);

        Sanctum::actingAs($this->subeYoneticisi());

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id,
            'deger'       => '1',
            'tarih'       => $ay->start_date->toDateString(),
        ])->assertCreated();
    }

    public function test_deger_alani_zorunlu(): void
    {
        $donem = $this->donem();
        $this->ay($donem);
        $faaliyet = $this->faaliyet($donem);

        Sanctum::actingAs($this->subeYoneticisi());

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $faaliyet->id,
        ])->assertStatus(422)->assertJsonValidationErrors('deger');
    }

    // ─── Düzenleme ve silme ───────────────────────────────────────────────────

    /** Açık ayda, Ankara şubesine ait bir kayıt üretir. */
    private function acikKayit(): FaaliyetKayit
    {
        $donem = $this->donem();
        $ay = $this->ay($donem);

        return FaaliyetKayit::create([
            'faaliyet_id' => $this->faaliyet($donem)->id,
            'sube_id'     => $this->ankara->id,
            'donem_ay_id' => $ay->id,
            'deger'       => '1',
        ]);
    }

    public function test_acik_aydaki_kendi_kaydi_duzenlenebilir_ve_silinebilir(): void
    {
        $kayit = $this->acikKayit();
        Sanctum::actingAs($this->subeYoneticisi());

        $this->putJson("/api/faaliyet-kayitlari/{$kayit->id}", ['deger' => '7'])->assertOk();
        $this->assertSame('7', $kayit->fresh()->deger);

        $this->deleteJson("/api/faaliyet-kayitlari/{$kayit->id}")->assertNoContent();
        $this->assertNull(FaaliyetKayit::find($kayit->id));
        $this->assertNotNull(FaaliyetKayit::withTrashed()->find($kayit->id));
    }

    public function test_baska_subenin_kaydi_duzenlenemez_ve_silinemez(): void
    {
        $kayit = $this->acikKayit();

        // İzmir şubesinin yöneticisi Ankara'nın kaydına dokunamaz.
        Sanctum::actingAs($this->subeYoneticisi($this->izmir));

        $this->putJson("/api/faaliyet-kayitlari/{$kayit->id}", ['deger' => '99'])->assertStatus(403);
        $this->deleteJson("/api/faaliyet-kayitlari/{$kayit->id}")->assertStatus(403);

        $this->assertSame('1', $kayit->fresh()->deger);
    }

    public function test_kapali_aydaki_kayit_duzenlenemez_ve_silinemez(): void
    {
        $kayit = $this->acikKayit();
        $kayit->donemAy->update(['acik_override' => false]);

        Sanctum::actingAs($this->subeYoneticisi());

        $this->putJson("/api/faaliyet-kayitlari/{$kayit->id}", ['deger' => '99'])
            ->assertStatus(422)->assertJsonValidationErrors('donem_ay_id');

        $this->deleteJson("/api/faaliyet-kayitlari/{$kayit->id}")
            ->assertStatus(422)->assertJsonValidationErrors('donem_ay_id');

        $this->assertSame('1', $kayit->fresh()->deger);
        $this->assertNotNull(FaaliyetKayit::find($kayit->id));
    }

    public function test_duzenlemede_ay_araligi_disindaki_tarih_reddedilir(): void
    {
        $kayit = $this->acikKayit();
        Sanctum::actingAs($this->subeYoneticisi());

        $this->putJson("/api/faaliyet-kayitlari/{$kayit->id}", [
            'tarih' => now()->addMonths(2)->startOfMonth()->toDateString(),
        ])->assertStatus(422)->assertJsonValidationErrors('tarih');
    }

    // ─── Listeleme ────────────────────────────────────────────────────────────

    public function test_sube_yoneticisi_yalnizca_kendi_kayitlarini_listeler(): void
    {
        $kayit = $this->acikKayit();

        $donem = $this->donem();
        FaaliyetKayit::create([
            'faaliyet_id' => $this->faaliyet($donem)->id,
            'sube_id'     => $this->izmir->id,
            'donem_ay_id' => $this->ay($donem)->id,
            'deger'       => '1',
        ]);

        Sanctum::actingAs($this->subeYoneticisi());

        $this->getJson('/api/faaliyet-kayitlari')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $kayit->id);
    }
}
