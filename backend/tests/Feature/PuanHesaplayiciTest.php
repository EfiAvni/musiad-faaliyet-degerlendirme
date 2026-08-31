<?php

namespace Tests\Feature;

use App\Models\Birim;
use App\Models\Donem;
use App\Models\Faaliyet;
use App\Support\PuanHesaplayici;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Gereksinim dokümanı bölüm 6: her kriter kendi mantığına göre sonuç üretmeli.
 * Bu testler beş türün de doğru puanladığını ve tavanlarını aşmadığını doğrular.
 */
class PuanHesaplayiciTest extends TestCase
{
    use RefreshDatabase;

    private Donem $donem;

    protected function setUp(): void
    {
        parent::setUp();

        $birim = Birim::create(['name' => 'Teşkilatlanma', 'status' => 'active']);
        $this->donem = Donem::create([
            'name' => '2026', 'birim_id' => $birim->id,
            'start_date' => now()->startOfMonth(), 'end_date' => now()->endOfMonth(),
            'status' => 'active', 'tum_subeler' => true,
        ]);
    }

    private function faaliyet(array $ozellikler = []): Faaliyet
    {
        return Faaliyet::create(array_merge([
            'title' => 'Kriter', 'puan' => 10, 'hedef' => 5,
            'tarih_gerekli' => false, 'donem_id' => $this->donem->id, 'durum' => 'active',
            'kriter_turu' => PuanHesaplayici::SAYI,
        ], $ozellikler));
    }

    // ─── sayi (mevcut davranış) ───────────────────────────────────────────────

    public function test_sayi_kriteri_adet_basina_puan_verir_ve_hedefte_tavanlanir(): void
    {
        $f = $this->faaliyet(['puan' => 10, 'hedef' => 5]);

        $this->assertSame(0, PuanHesaplayici::puan($f, 0));
        $this->assertSame(30, PuanHesaplayici::puan($f, 3));
        $this->assertSame(50, PuanHesaplayici::puan($f, 5));
        $this->assertSame(50, PuanHesaplayici::puan($f, 9), 'Hedefin üstü tavanı aşmamalı.');
        $this->assertSame(50, PuanHesaplayici::maxPuan($f));
    }

    public function test_kriter_turu_belirtilmezse_sayi_gibi_davranir(): void
    {
        $f = $this->faaliyet();

        $this->assertSame(PuanHesaplayici::SAYI, $f->kriter_turu);
        $this->assertSame(20, PuanHesaplayici::puan($f, 2));
    }

    // ─── evet_hayir ───────────────────────────────────────────────────────────

    public function test_evet_hayir_kriteri_tek_kayitta_tam_puan_verir(): void
    {
        $f = $this->faaliyet(['kriter_turu' => PuanHesaplayici::EVET_HAYIR, 'puan' => 25, 'hedef' => 5]);

        $this->assertSame(0, PuanHesaplayici::puan($f, 0));
        $this->assertSame(25, PuanHesaplayici::puan($f, 1));
        $this->assertSame(25, PuanHesaplayici::puan($f, 8), 'Fazla kayıt ek puan getirmemeli.');
        $this->assertSame(25, PuanHesaplayici::maxPuan($f), 'Hedef alanı bu türde tavanı etkilememeli.');
    }

    // ─── oran ─────────────────────────────────────────────────────────────────

    public function test_oran_kriteri_uye_sayisina_gore_normalize_eder(): void
    {
        // hedef = %20: 100 üyeli şubeden 20 kayıt bekleniyor.
        $f = $this->faaliyet(['kriter_turu' => PuanHesaplayici::ORAN, 'puan' => 40, 'hedef' => 20]);

        $this->assertSame(40, PuanHesaplayici::puan($f, 20, uyeSayisi: 100), 'Hedefe ulaşan tam puan almalı.');
        $this->assertSame(20, PuanHesaplayici::puan($f, 10, uyeSayisi: 100), 'Yarısı yarı puan almalı.');
        $this->assertSame(0, PuanHesaplayici::puan($f, 0, uyeSayisi: 100));
        $this->assertSame(40, PuanHesaplayici::puan($f, 50, uyeSayisi: 100), 'Hedefin üstü tavanı aşmamalı.');
    }

    public function test_oran_kriteri_kucuk_subeyi_cezalandirmaz(): void
    {
        $f = $this->faaliyet(['kriter_turu' => PuanHesaplayici::ORAN, 'puan' => 40, 'hedef' => 20]);

        // 50 üyeli şube 10 kayıtla %20'ye ulaşır; 500 üyeli şube aynı puan için 100 kayıt girmeli.
        $this->assertSame(40, PuanHesaplayici::puan($f, 10, uyeSayisi: 50));
        $this->assertSame(4, PuanHesaplayici::puan($f, 10, uyeSayisi: 500));
    }

    public function test_uye_sayisi_bilinmiyorsa_oran_puani_verilmez(): void
    {
        $f = $this->faaliyet(['kriter_turu' => PuanHesaplayici::ORAN, 'puan' => 40, 'hedef' => 20]);

        $this->assertSame(0, PuanHesaplayici::puan($f, 10, uyeSayisi: null));
        $this->assertSame(0, PuanHesaplayici::puan($f, 10, uyeSayisi: 0));
    }

    // ─── kademeli ─────────────────────────────────────────────────────────────

    public function test_kademeli_kriter_esigi_gecilen_en_yuksek_kademeyi_verir(): void
    {
        $f = $this->faaliyet([
            'kriter_turu' => PuanHesaplayici::KADEMELI,
            'kademeler' => [
                ['esik' => 3,  'puan' => 10],
                ['esik' => 7,  'puan' => 25],
                ['esik' => 15, 'puan' => 50],
            ],
        ]);

        $this->assertSame(0, PuanHesaplayici::puan($f, 2), 'İlk eşiğin altı puan almamalı.');
        $this->assertSame(10, PuanHesaplayici::puan($f, 3));
        $this->assertSame(10, PuanHesaplayici::puan($f, 6));
        $this->assertSame(25, PuanHesaplayici::puan($f, 7));
        $this->assertSame(50, PuanHesaplayici::puan($f, 15));
        $this->assertSame(50, PuanHesaplayici::puan($f, 99), 'En üst kademe tavandır.');
        $this->assertSame(50, PuanHesaplayici::maxPuan($f));
    }

    public function test_kademeler_sirasiz_tanimlanabilir(): void
    {
        $f = $this->faaliyet([
            'kriter_turu' => PuanHesaplayici::KADEMELI,
            'kademeler' => [
                ['esik' => 15, 'puan' => 50],
                ['esik' => 3,  'puan' => 10],
                ['esik' => 7,  'puan' => 25],
            ],
        ]);

        $this->assertSame(25, PuanHesaplayici::puan($f, 8));
        $this->assertSame(50, PuanHesaplayici::maxPuan($f));
    }

    public function test_kademesiz_kademeli_kriter_puan_uretmez(): void
    {
        $f = $this->faaliyet(['kriter_turu' => PuanHesaplayici::KADEMELI, 'kademeler' => null]);

        $this->assertSame(0, PuanHesaplayici::puan($f, 10));
        $this->assertSame(0, PuanHesaplayici::maxPuan($f));
    }

    // ─── manuel ───────────────────────────────────────────────────────────────

    public function test_manuel_kriter_merkezin_verdigi_puani_kullanir(): void
    {
        $f = $this->faaliyet(['kriter_turu' => PuanHesaplayici::MANUEL, 'puan' => 30]);

        $this->assertTrue(PuanHesaplayici::manuelMi($f));
        $this->assertSame(0, PuanHesaplayici::puan($f, 5, manuelPuan: null), 'Merkez puanlamadıysa 0.');
        $this->assertSame(18, PuanHesaplayici::puan($f, 5, manuelPuan: 18));
        $this->assertSame(30, PuanHesaplayici::puan($f, 0, manuelPuan: 30), 'Kayıt sayısı manuel puanı etkilemez.');
        $this->assertSame(30, PuanHesaplayici::puan($f, 5, manuelPuan: 99), 'Tavan aşılamaz.');
        $this->assertSame(30, PuanHesaplayici::maxPuan($f));
    }

    public function test_yalnizca_manuel_tur_elle_puanlanir(): void
    {
        $this->assertFalse(PuanHesaplayici::manuelMi($this->faaliyet()));
        $this->assertFalse(PuanHesaplayici::manuelMi($this->faaliyet(['kriter_turu' => PuanHesaplayici::EVET_HAYIR])));
        $this->assertTrue(PuanHesaplayici::manuelMi($this->faaliyet(['kriter_turu' => PuanHesaplayici::MANUEL])));
    }
}
