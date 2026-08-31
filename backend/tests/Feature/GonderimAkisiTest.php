<?php

namespace Tests\Feature;

use App\Models\AyGonderim;
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
 * Doküman bölüm 11-12: şube ayı merkeze gönderir, merkez inceler, onaylar veya
 * düzeltme ister; sonuçlanan ayda keyfî değişiklik engellenir.
 */
class GonderimAkisiTest extends TestCase
{
    use RefreshDatabase;

    private Birim $birim;
    private Sube $ankara;
    private Sube $izmir;
    private Donem $donem;
    private DonemAy $ay;
    private Faaliyet $faaliyet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->birim = Birim::create(['name' => 'Teşkilatlanma', 'status' => 'active']);
        $this->ankara = Sube::create(['name' => 'MÜSİAD Ankara', 'uye_sayisi' => 10, 'status' => 'active']);
        $this->izmir = Sube::create(['name' => 'MÜSİAD İzmir', 'uye_sayisi' => 20, 'status' => 'active']);

        $this->donem = Donem::create([
            'name' => '2026 Değerlendirme', 'birim_id' => $this->birim->id,
            'start_date' => now()->startOfMonth(), 'end_date' => now()->endOfMonth(),
            'status' => 'active', 'tum_subeler' => true,
        ]);

        $this->ay = DonemAy::create([
            'donem_id' => $this->donem->id, 'sira' => 1, 'name' => 'Ağustos 2026',
            'start_date' => now()->startOfMonth(), 'end_date' => now()->endOfMonth(),
        ]);

        $this->faaliyet = Faaliyet::create([
            'title' => 'Üye Ziyareti', 'puan' => 10, 'hedef' => 5,
            'tarih_gerekli' => false, 'donem_id' => $this->donem->id, 'durum' => 'active',
        ]);
    }

    private function subeYoneticisi(?Sube $sube = null): User
    {
        return User::factory()->create([
            'role' => 'sube_yoneticisi', 'sube_id' => ($sube ?? $this->ankara)->id,
        ]);
    }

    private function merkez(): User
    {
        return User::factory()->create(['role' => 'birim_yoneticisi', 'birim_id' => $this->birim->id]);
    }

    private function kayitEkle(?Sube $sube = null): FaaliyetKayit
    {
        return FaaliyetKayit::create([
            'faaliyet_id' => $this->faaliyet->id,
            'sube_id'     => ($sube ?? $this->ankara)->id,
            'donem_ay_id' => $this->ay->id,
            'deger'       => '1',
        ]);
    }

    /** Ankara şubesini gönderilmiş duruma getirir. */
    private function gonder(): AyGonderim
    {
        $this->kayitEkle();
        Sanctum::actingAs($this->subeYoneticisi());
        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder")->assertCreated();

        return AyGonderim::where('sube_id', $this->ankara->id)->firstOrFail();
    }

    // ─── Gönderme ─────────────────────────────────────────────────────────────

    public function test_sube_ayi_merkeze_gonderebilir(): void
    {
        $gonderim = $this->gonder();

        $this->assertSame(AyGonderim::GONDERILDI, $gonderim->durum);
        $this->assertNotNull($gonderim->gonderildi_at);
        $this->assertSame($this->ankara->id, $gonderim->sube_id);
    }

    public function test_kayitsiz_ay_gonderilemez(): void
    {
        Sanctum::actingAs($this->subeYoneticisi());

        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder")
            ->assertStatus(422)->assertJsonValidationErrors('donem_ay_id');

        $this->assertSame(0, AyGonderim::count());
    }

    public function test_ayni_ay_iki_kez_gonderilemez(): void
    {
        $this->gonder();

        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder")
            ->assertStatus(422)->assertJsonValidationErrors('durum');
    }

    public function test_merkez_kullanicisi_gonderim_yapamaz(): void
    {
        $this->kayitEkle();
        Sanctum::actingAs($this->merkez());

        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder")
            ->assertStatus(422)->assertJsonValidationErrors('sube_id');
    }

    public function test_kapsam_disindaki_donemin_ayi_gonderilemez(): void
    {
        // Yalnızca İzmir için açılmış bir dönem.
        $ozelDonem = Donem::create([
            'name' => 'İzmir Özel', 'birim_id' => $this->birim->id,
            'start_date' => now()->startOfMonth(), 'end_date' => now()->endOfMonth(),
            'status' => 'active', 'tum_subeler' => false,
        ]);
        $ozelDonem->subeler()->sync([$this->izmir->id]);
        $ozelAy = DonemAy::create([
            'donem_id' => $ozelDonem->id, 'sira' => 1, 'name' => 'Ay',
            'start_date' => now()->startOfMonth(), 'end_date' => now()->endOfMonth(),
        ]);

        Sanctum::actingAs($this->subeYoneticisi());

        $this->postJson("/api/donem-aylar/{$ozelAy->id}/gonder")->assertStatus(403);
    }

    // ─── Gönderildikten sonra kilit ───────────────────────────────────────────

    public function test_gonderilmis_ayda_kayit_eklenemez_duzenlenemez_silinemez(): void
    {
        $kayit = $this->kayitEkle();
        Sanctum::actingAs($this->subeYoneticisi());
        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder")->assertCreated();

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $this->faaliyet->id, 'deger' => '2',
        ])->assertStatus(422)->assertJsonValidationErrors('durum');

        $this->putJson("/api/faaliyet-kayitlari/{$kayit->id}", ['deger' => '9'])
            ->assertStatus(422)->assertJsonValidationErrors('durum');

        $this->deleteJson("/api/faaliyet-kayitlari/{$kayit->id}")
            ->assertStatus(422)->assertJsonValidationErrors('durum');

        $this->assertSame('1', $kayit->fresh()->deger);
    }

    public function test_gonderim_baska_subenin_kayitlarini_kilitlemez(): void
    {
        $this->gonder();

        // İzmir göndermedi; kendi ayında çalışmaya devam edebilmeli.
        Sanctum::actingAs($this->subeYoneticisi($this->izmir));

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $this->faaliyet->id, 'deger' => '1',
        ])->assertCreated();
    }

    // ─── Merkez incelemesi ────────────────────────────────────────────────────

    public function test_merkez_gonderimi_onaylayabilir(): void
    {
        $gonderim = $this->gonder();
        $merkez = $this->merkez();
        Sanctum::actingAs($merkez);

        $this->postJson("/api/gonderimler/{$gonderim->id}/onayla")
            ->assertOk()
            ->assertJsonPath('durum', AyGonderim::ONAYLANDI);

        $taze = $gonderim->fresh();
        $this->assertSame($merkez->id, $taze->degerlendiren_id);
        $this->assertNotNull($taze->degerlendirildi_at);
    }

    public function test_onaylanan_ayda_sube_degisiklik_yapamaz(): void
    {
        $kayit = $this->kayitEkle();
        Sanctum::actingAs($this->subeYoneticisi());
        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder");
        $gonderim = AyGonderim::firstOrFail();

        Sanctum::actingAs($this->merkez());
        $this->postJson("/api/gonderimler/{$gonderim->id}/onayla")->assertOk();

        Sanctum::actingAs($this->subeYoneticisi());
        $this->putJson("/api/faaliyet-kayitlari/{$kayit->id}", ['deger' => '9'])
            ->assertStatus(422)->assertJsonValidationErrors('durum');

        // Onaylanmış ay tekrar gönderilemez.
        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder")
            ->assertStatus(422)->assertJsonValidationErrors('durum');
    }

    public function test_merkez_duzeltme_isteyebilir_ve_aciklama_zorunlu(): void
    {
        $gonderim = $this->gonder();
        Sanctum::actingAs($this->merkez());

        // Açıklama olmadan reddedilmeli.
        $this->postJson("/api/gonderimler/{$gonderim->id}/duzeltme-iste")
            ->assertStatus(422)->assertJsonValidationErrors('merkez_notu');

        $this->postJson("/api/gonderimler/{$gonderim->id}/duzeltme-iste", [
            'merkez_notu' => 'Ziyaret sayısı belgelenmemiş, açıklama ekleyiniz.',
        ])->assertOk()->assertJsonPath('durum', AyGonderim::DUZELTME_BEKLIYOR);

        $this->assertSame(
            'Ziyaret sayısı belgelenmemiş, açıklama ekleyiniz.',
            $gonderim->fresh()->merkez_notu,
        );
    }

    public function test_duzeltme_istenince_sube_yeniden_duzenleyip_gonderebilir(): void
    {
        $kayit = $this->kayitEkle();
        Sanctum::actingAs($this->subeYoneticisi());
        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder");
        $gonderim = AyGonderim::firstOrFail();

        Sanctum::actingAs($this->merkez());
        $this->postJson("/api/gonderimler/{$gonderim->id}/duzeltme-iste", [
            'merkez_notu' => 'Eksik bilgi var, lütfen düzeltin.',
        ])->assertOk();

        Sanctum::actingAs($this->subeYoneticisi());

        // Kilit açılmalı.
        $this->putJson("/api/faaliyet-kayitlari/{$kayit->id}", ['deger' => '4'])->assertOk();
        $this->assertSame('4', $kayit->fresh()->deger);

        // Tekrar gönderilebilmeli; önceki değerlendirme izi temizlenmeli.
        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder")->assertOk();

        $taze = $gonderim->fresh();
        $this->assertSame(AyGonderim::GONDERILDI, $taze->durum);
        $this->assertNull($taze->degerlendiren_id);
    }

    public function test_merkez_onayladigi_ayi_geri_acabilir(): void
    {
        $gonderim = $this->gonder();
        Sanctum::actingAs($this->merkez());

        $this->postJson("/api/gonderimler/{$gonderim->id}/onayla")->assertOk();

        $this->postJson("/api/gonderimler/{$gonderim->id}/duzeltme-iste", [
            'merkez_notu' => 'Yeniden inceleme gerekti.',
        ])->assertOk()->assertJsonPath('durum', AyGonderim::DUZELTME_BEKLIYOR);
    }

    public function test_gonderilmemis_ay_onaylanamaz(): void
    {
        $gonderim = $this->gonder();
        Sanctum::actingAs($this->merkez());

        $this->postJson("/api/gonderimler/{$gonderim->id}/duzeltme-iste", [
            'merkez_notu' => 'Düzeltme gerekiyor.',
        ])->assertOk();

        // Artık düzeltme bekliyor; onaylanacak bir gönderim yok.
        $this->postJson("/api/gonderimler/{$gonderim->id}/onayla")
            ->assertStatus(422)->assertJsonValidationErrors('durum');
    }

    // ─── Yetki ve kapsam ──────────────────────────────────────────────────────

    public function test_sube_kendi_gonderimini_onaylayamaz(): void
    {
        $gonderim = $this->gonder();
        Sanctum::actingAs($this->subeYoneticisi());

        $this->postJson("/api/gonderimler/{$gonderim->id}/onayla")->assertStatus(403);
        $this->postJson("/api/gonderimler/{$gonderim->id}/duzeltme-iste", [
            'merkez_notu' => 'Kendi kendine onay denemesi.',
        ])->assertStatus(403);
    }

    public function test_baska_birimin_merkezi_gonderimi_inceleyemez(): void
    {
        $gonderim = $this->gonder();

        $digerBirim = Birim::create(['name' => 'GENÇ MÜSİAD', 'status' => 'active']);
        Sanctum::actingAs(User::factory()->create([
            'role' => 'birim_yoneticisi', 'birim_id' => $digerBirim->id,
        ]));

        $this->postJson("/api/gonderimler/{$gonderim->id}/onayla")->assertStatus(403);
    }

    // ─── Listeleme ────────────────────────────────────────────────────────────

    public function test_sube_yalnizca_kendi_gonderimlerini_gorur(): void
    {
        $this->gonder();

        // İzmir de gönderir.
        $this->kayitEkle($this->izmir);
        Sanctum::actingAs($this->subeYoneticisi($this->izmir));
        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder")->assertCreated();

        Sanctum::actingAs($this->subeYoneticisi());

        $this->getJson('/api/gonderimler')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.sube_id', $this->ankara->id);
    }

    public function test_merkez_kendi_biriminin_tum_gonderimlerini_gorur(): void
    {
        $this->gonder();
        $this->kayitEkle($this->izmir);
        Sanctum::actingAs($this->subeYoneticisi($this->izmir));
        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder");

        Sanctum::actingAs($this->merkez());

        $this->getJson('/api/gonderimler')->assertOk()->assertJsonCount(2);
        $this->getJson('/api/gonderimler?durum=gonderildi')->assertOk()->assertJsonCount(2);
        $this->getJson('/api/gonderimler?durum=onaylandi')->assertOk()->assertJsonCount(0);
    }

    public function test_baska_birimin_gonderimleri_listede_gorunmez(): void
    {
        $this->gonder();

        $digerBirim = Birim::create(['name' => 'GENÇ MÜSİAD', 'status' => 'active']);
        Sanctum::actingAs(User::factory()->create([
            'role' => 'birim_yoneticisi', 'birim_id' => $digerBirim->id,
        ]));

        $this->getJson('/api/gonderimler')->assertOk()->assertJsonCount(0);
    }
}
