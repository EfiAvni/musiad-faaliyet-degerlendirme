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
use App\Support\PuanHesaplayici;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Doküman bölüm 5: merkez kriterlere göre değerlendirme yapıp puan verebilmeli.
 * Otomatik sayılamayan kriterler için merkez puanı kendisi belirler.
 */
class ManuelPuanlamaTest extends TestCase
{
    use RefreshDatabase;

    private Birim $birim;
    private Sube $ankara;
    private Donem $donem;
    private DonemAy $ay;

    protected function setUp(): void
    {
        parent::setUp();

        $this->birim = Birim::create(['name' => 'Teşkilatlanma', 'status' => 'active']);
        $this->ankara = Sube::create(['name' => 'MÜSİAD Ankara', 'uye_sayisi' => 100, 'status' => 'active']);

        $this->donem = Donem::create([
            'name' => '2026', 'birim_id' => $this->birim->id,
            'start_date' => now()->startOfMonth(), 'end_date' => now()->endOfMonth(),
            'status' => 'active', 'tum_subeler' => true,
        ]);

        $this->ay = DonemAy::create([
            'donem_id' => $this->donem->id, 'sira' => 1, 'name' => 'Ağustos',
            'start_date' => now()->startOfMonth(), 'end_date' => now()->endOfMonth(),
        ]);
    }

    private function merkez(): User
    {
        return User::factory()->create(['role' => 'birim_yoneticisi', 'birim_id' => $this->birim->id]);
    }

    private function faaliyet(array $ozellikler = []): Faaliyet
    {
        return Faaliyet::create(array_merge([
            'title' => 'Teşkilat Değerlendirmesi', 'puan' => 30, 'hedef' => 0,
            'tarih_gerekli' => false, 'donem_id' => $this->donem->id, 'durum' => 'active',
            'kriter_turu' => PuanHesaplayici::MANUEL,
        ], $ozellikler));
    }

    /** Ankara'nın gönderilmiş ayı. */
    private function gonderim(Faaliyet $faaliyet): AyGonderim
    {
        FaaliyetKayit::create([
            'faaliyet_id' => $faaliyet->id, 'sube_id' => $this->ankara->id,
            'donem_ay_id' => $this->ay->id, 'deger' => '1',
        ]);

        return AyGonderim::create([
            'donem_ay_id' => $this->ay->id, 'sube_id' => $this->ankara->id,
            'durum' => AyGonderim::GONDERILDI, 'gonderildi_at' => now(),
        ]);
    }

    public function test_merkez_manuel_faaliyete_puan_verebilir(): void
    {
        $faaliyet = $this->faaliyet(['puan' => 30]);
        $gonderim = $this->gonderim($faaliyet);
        $merkez = $this->merkez();
        Sanctum::actingAs($merkez);

        $this->postJson("/api/gonderimler/{$gonderim->id}/puanla", [
            'faaliyet_id' => $faaliyet->id,
            'puan'        => 22,
            'not'         => 'Teşkilat çalışmaları yeterli düzeyde.',
        ])->assertOk()->assertJsonPath('puan', 22);

        $this->assertDatabaseHas('faaliyet_degerlendirmeleri', [
            'ay_gonderim_id'   => $gonderim->id,
            'faaliyet_id'      => $faaliyet->id,
            'puan'             => 22,
            'degerlendiren_id' => $merkez->id,
        ]);
    }

    public function test_ayni_faaliyet_yeniden_puanlaninca_ustune_yazilir(): void
    {
        $faaliyet = $this->faaliyet();
        $gonderim = $this->gonderim($faaliyet);
        Sanctum::actingAs($this->merkez());

        $this->postJson("/api/gonderimler/{$gonderim->id}/puanla", ['faaliyet_id' => $faaliyet->id, 'puan' => 10]);
        $this->postJson("/api/gonderimler/{$gonderim->id}/puanla", ['faaliyet_id' => $faaliyet->id, 'puan' => 25])->assertOk();

        $this->assertSame(1, $gonderim->degerlendirmeler()->count());
        $this->assertSame(25, $gonderim->degerlendirmeler()->first()->puan);
    }

    public function test_tavanin_ustunde_puan_verilemez(): void
    {
        $faaliyet = $this->faaliyet(['puan' => 30]);
        $gonderim = $this->gonderim($faaliyet);
        Sanctum::actingAs($this->merkez());

        $this->postJson("/api/gonderimler/{$gonderim->id}/puanla", [
            'faaliyet_id' => $faaliyet->id, 'puan' => 31,
        ])->assertStatus(422)->assertJsonValidationErrors('puan');
    }

    public function test_otomatik_puanlanan_faaliyete_elle_puan_verilemez(): void
    {
        $otomatik = $this->faaliyet(['kriter_turu' => PuanHesaplayici::SAYI, 'hedef' => 5]);
        $gonderim = $this->gonderim($otomatik);
        Sanctum::actingAs($this->merkez());

        $this->postJson("/api/gonderimler/{$gonderim->id}/puanla", [
            'faaliyet_id' => $otomatik->id, 'puan' => 10,
        ])->assertStatus(422)->assertJsonValidationErrors('faaliyet_id');
    }

    public function test_baska_donemin_faaliyetine_puan_verilemez(): void
    {
        $faaliyet = $this->faaliyet();
        $gonderim = $this->gonderim($faaliyet);

        $baskaDonem = Donem::create([
            'name' => 'Diğer', 'birim_id' => $this->birim->id,
            'start_date' => now()->startOfMonth(), 'end_date' => now()->endOfMonth(),
            'status' => 'active', 'tum_subeler' => true,
        ]);
        $yabanci = Faaliyet::create([
            'title' => 'Yabancı', 'puan' => 20, 'hedef' => 0, 'tarih_gerekli' => false,
            'donem_id' => $baskaDonem->id, 'durum' => 'active',
            'kriter_turu' => PuanHesaplayici::MANUEL,
        ]);

        Sanctum::actingAs($this->merkez());

        $this->postJson("/api/gonderimler/{$gonderim->id}/puanla", [
            'faaliyet_id' => $yabanci->id, 'puan' => 10,
        ])->assertStatus(422)->assertJsonValidationErrors('faaliyet_id');
    }

    public function test_sube_yoneticisi_puan_veremez(): void
    {
        $faaliyet = $this->faaliyet();
        $gonderim = $this->gonderim($faaliyet);

        Sanctum::actingAs(User::factory()->create([
            'role' => 'sube_yoneticisi', 'sube_id' => $this->ankara->id,
        ]));

        $this->postJson("/api/gonderimler/{$gonderim->id}/puanla", [
            'faaliyet_id' => $faaliyet->id, 'puan' => 30,
        ])->assertStatus(403);
    }

    public function test_manuel_puan_rapora_yansir(): void
    {
        $faaliyet = $this->faaliyet(['puan' => 30]);
        $gonderim = $this->gonderim($faaliyet);
        Sanctum::actingAs($this->merkez());

        // Puan verilmeden önce sıfır.
        $this->getJson("/api/raporlar/{$this->donem->id}")
            ->assertOk()
            ->assertJsonPath('sube_bazli.0.toplam_puan', 0);

        $this->postJson("/api/gonderimler/{$gonderim->id}/puanla", [
            'faaliyet_id' => $faaliyet->id, 'puan' => 24,
        ])->assertOk();

        $this->getJson("/api/raporlar/{$this->donem->id}")
            ->assertOk()
            ->assertJsonPath('sube_bazli.0.toplam_puan', 24)
            ->assertJsonPath('sube_bazli.0.max_puan', 30);
    }

    public function test_manuel_puan_sube_puan_ozetine_yansir(): void
    {
        $faaliyet = $this->faaliyet(['puan' => 30]);
        $gonderim = $this->gonderim($faaliyet);
        Sanctum::actingAs($this->merkez());

        $this->postJson("/api/gonderimler/{$gonderim->id}/puanla", [
            'faaliyet_id' => $faaliyet->id, 'puan' => 18,
        ])->assertOk();

        $this->getJson("/api/subeler/{$this->ankara->id}/puan-ozeti?donem_id={$this->donem->id}")
            ->assertOk()
            ->assertJsonPath('toplam_puan', 18)
            ->assertJsonPath('detaylar.0.puan_katkisi', 18)
            ->assertJsonPath('detaylar.0.kriter_turu', PuanHesaplayici::MANUEL);
    }

    public function test_oran_kriteri_raporda_uye_sayisini_kullanir(): void
    {
        // %20 hedef, 100 üye → 20 kayıt tam puan.
        $faaliyet = $this->faaliyet([
            'kriter_turu' => PuanHesaplayici::ORAN, 'puan' => 40, 'hedef' => 20,
        ]);

        for ($i = 0; $i < 10; $i++) {
            FaaliyetKayit::create([
                'faaliyet_id' => $faaliyet->id, 'sube_id' => $this->ankara->id,
                'donem_ay_id' => $this->ay->id, 'deger' => '1',
            ]);
        }

        Sanctum::actingAs($this->merkez());

        // 10/100 = %10, hedefin yarısı → 20 puan.
        $this->getJson("/api/raporlar/{$this->donem->id}")
            ->assertOk()
            ->assertJsonPath('sube_bazli.0.toplam_puan', 20);
    }

    public function test_kademeli_kriter_raporda_dogru_puanlanir(): void
    {
        $faaliyet = $this->faaliyet([
            'kriter_turu' => PuanHesaplayici::KADEMELI,
            'kademeler' => [['esik' => 2, 'puan' => 15], ['esik' => 5, 'puan' => 40]],
        ]);

        for ($i = 0; $i < 3; $i++) {
            FaaliyetKayit::create([
                'faaliyet_id' => $faaliyet->id, 'sube_id' => $this->ankara->id,
                'donem_ay_id' => $this->ay->id, 'deger' => '1',
            ]);
        }

        Sanctum::actingAs($this->merkez());

        // 3 kayıt → ilk kademe (eşik 2) → 15 puan; tavan en üst kademe 40.
        $this->getJson("/api/raporlar/{$this->donem->id}")
            ->assertOk()
            ->assertJsonPath('sube_bazli.0.toplam_puan', 15)
            ->assertJsonPath('sube_bazli.0.max_puan', 40);
    }

    public function test_kademeli_faaliyet_kademesiz_olusturulamaz(): void
    {
        Sanctum::actingAs($this->merkez());

        $this->postJson('/api/faaliyetler', [
            'title' => 'Kademesiz', 'donem_id' => $this->donem->id,
            'kriter_turu' => PuanHesaplayici::KADEMELI, 'puan' => 10,
        ])->assertStatus(422)->assertJsonValidationErrors('kademeler');
    }

    public function test_oran_faaliyeti_hedefsiz_olusturulamaz(): void
    {
        Sanctum::actingAs($this->merkez());

        $this->postJson('/api/faaliyetler', [
            'title' => 'Hedefsiz oran', 'donem_id' => $this->donem->id,
            'kriter_turu' => PuanHesaplayici::ORAN, 'puan' => 10, 'hedef' => 0,
        ])->assertStatus(422)->assertJsonValidationErrors('hedef');
    }
}
