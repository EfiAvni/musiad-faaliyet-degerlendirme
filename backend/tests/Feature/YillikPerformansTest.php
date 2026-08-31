<?php

namespace Tests\Feature;

use App\Models\Birim;
use App\Models\Donem;
use App\Models\DonemAy;
use App\Models\Faaliyet;
use App\Models\FaaliyetKayit;
use App\Models\Sube;
use App\Models\User;
use App\Support\KriterKategorileri;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Doküman bölüm 9: aylık değerlendirmeler yıl içinde birikerek yıllık
 * performansı oluşturmalı. Bölüm 10: şube başına toplam, ortalama, tamamlanan
 * dönem sayısı ve kriter kırılımı. Bölüm 7-8: hangi konuda başarılı, hangi
 * konuda eksik.
 */
class YillikPerformansTest extends TestCase
{
    use RefreshDatabase;

    private Birim $birim;
    private Sube $ankara;
    private Sube $izmir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->birim = Birim::create(['name' => 'Teşkilatlanma', 'status' => 'active']);
        $this->ankara = Sube::create(['name' => 'MÜSİAD Ankara', 'uye_sayisi' => 100, 'status' => 'active']);
        $this->izmir = Sube::create(['name' => 'MÜSİAD İzmir', 'uye_sayisi' => 100, 'status' => 'active']);
    }

    private function merkez(): User
    {
        return User::factory()->create(['role' => 'birim_yoneticisi', 'birim_id' => $this->birim->id]);
    }

    private function donem(string $ad, string $baslangic, string $durum = 'completed', ?Birim $birim = null): Donem
    {
        return Donem::create([
            'name' => $ad, 'birim_id' => ($birim ?? $this->birim)->id,
            'start_date' => $baslangic, 'end_date' => date('Y-m-t', strtotime($baslangic)),
            'status' => $durum, 'tum_subeler' => true,
        ]);
    }

    private function faaliyetVeKayit(Donem $donem, Sube $sube, int $adet, ?string $kategori = null, int $puan = 10, int $hedef = 5): Faaliyet
    {
        $f = Faaliyet::create([
            'title' => 'Kriter ' . uniqid(), 'puan' => $puan, 'hedef' => $hedef,
            'tarih_gerekli' => false, 'donem_id' => $donem->id, 'durum' => 'active',
            'kriter_turu' => 'sayi', 'kategori' => $kategori,
        ]);

        $ay = DonemAy::create([
            'donem_id' => $donem->id, 'sira' => 1, 'name' => 'Ay',
            'start_date' => $donem->start_date, 'end_date' => $donem->end_date,
        ]);

        for ($i = 0; $i < $adet; $i++) {
            FaaliyetKayit::create([
                'faaliyet_id' => $f->id, 'sube_id' => $sube->id,
                'donem_ay_id' => $ay->id, 'deger' => '1',
            ]);
        }

        return $f;
    }

    public function test_yillik_rapor_donemleri_toplar(): void
    {
        // Ocak: 3 kayıt = 30 puan. Şubat: 5 kayıt = 50 puan (hedefte tavan).
        $ocak = $this->donem('Ocak 2026', '2026-01-01');
        $this->faaliyetVeKayit($ocak, $this->ankara, 3);

        $subat = $this->donem('Şubat 2026', '2026-02-01');
        $this->faaliyetVeKayit($subat, $this->ankara, 9);

        Sanctum::actingAs($this->merkez());

        $yanit = $this->getJson('/api/raporlar/yillik?yil=2026')->assertOk();

        $yanit->assertJsonPath('yil', 2026)
            ->assertJsonPath('genel.donem_sayisi', 2)
            ->assertJsonPath('sube_bazli.0.sube_adi', 'MÜSİAD Ankara')
            ->assertJsonPath('sube_bazli.0.toplam_puan', 80)
            ->assertJsonPath('sube_bazli.0.max_puan', 100)
            ->assertJsonPath('sube_bazli.0.katildigi_donem', 2);

        // Doküman bölüm 9'daki "Ocak 82, Şubat 76" tablosu.
        $puanlar = collect($yanit->json('sube_bazli.0.donem_puanlari'))->pluck('puan', 'donem_adi');
        $this->assertSame(30, $puanlar['Ocak 2026']);
        $this->assertSame(50, $puanlar['Şubat 2026']);
    }

    public function test_ortalama_ve_tamamlanan_donem_sayisi(): void
    {
        $this->faaliyetVeKayit($this->donem('Ocak', '2026-01-01', 'completed'), $this->ankara, 2);   // 20
        $this->faaliyetVeKayit($this->donem('Şubat', '2026-02-01', 'completed'), $this->ankara, 4);  // 40
        $this->faaliyetVeKayit($this->donem('Mart', '2026-03-01', 'active'), $this->ankara, 3);      // 30

        Sanctum::actingAs($this->merkez());

        $this->getJson('/api/raporlar/yillik?yil=2026')
            ->assertOk()
            ->assertJsonPath('sube_bazli.0.toplam_puan', 90)
            ->assertJsonPath('sube_bazli.0.ortalama_puan', 30)
            ->assertJsonPath('sube_bazli.0.katildigi_donem', 3)
            ->assertJsonPath('sube_bazli.0.tamamlanan_donem', 2)
            ->assertJsonPath('genel.tamamlanan_donem', 2);
    }

    public function test_subeler_toplam_puana_gore_siralanir(): void
    {
        $ocak = $this->donem('Ocak', '2026-01-01');
        $f = $this->faaliyetVeKayit($ocak, $this->ankara, 2);

        // İzmir aynı faaliyete daha çok kayıt girer.
        $ay = DonemAy::where('donem_id', $ocak->id)->first();
        for ($i = 0; $i < 5; $i++) {
            FaaliyetKayit::create([
                'faaliyet_id' => $f->id, 'sube_id' => $this->izmir->id,
                'donem_ay_id' => $ay->id, 'deger' => '1',
            ]);
        }

        Sanctum::actingAs($this->merkez());

        $this->getJson('/api/raporlar/yillik?yil=2026')
            ->assertOk()
            ->assertJsonPath('sube_bazli.0.sube_adi', 'MÜSİAD İzmir')
            ->assertJsonPath('sube_bazli.1.sube_adi', 'MÜSİAD Ankara')
            ->assertJsonPath('genel.en_iyi_sube_adi', 'MÜSİAD İzmir');
    }

    public function test_baska_yilin_donemleri_dahil_edilmez(): void
    {
        $this->faaliyetVeKayit($this->donem('2026 Ocak', '2026-01-01'), $this->ankara, 3);
        $this->faaliyetVeKayit($this->donem('2027 Ocak', '2027-01-01'), $this->ankara, 5);

        Sanctum::actingAs($this->merkez());

        $this->getJson('/api/raporlar/yillik?yil=2026')
            ->assertOk()
            ->assertJsonPath('genel.donem_sayisi', 1)
            ->assertJsonPath('sube_bazli.0.toplam_puan', 30);
    }

    public function test_donemsiz_yil_bos_doner(): void
    {
        Sanctum::actingAs($this->merkez());

        $this->getJson('/api/raporlar/yillik?yil=2020')
            ->assertOk()
            ->assertJsonPath('genel.donem_sayisi', 0)
            ->assertJsonCount(0, 'sube_bazli');
    }

    public function test_baska_birimin_donemleri_gorunmez(): void
    {
        $digerBirim = Birim::create(['name' => 'GENÇ MÜSİAD', 'status' => 'active']);

        $this->faaliyetVeKayit($this->donem('Teşkilat Ocak', '2026-01-01'), $this->ankara, 3);
        $this->faaliyetVeKayit($this->donem('GENÇ Ocak', '2026-01-01', 'completed', $digerBirim), $this->ankara, 5);

        Sanctum::actingAs($this->merkez());

        // Teşkilatlanma yöneticisi yalnızca kendi dönemini görür.
        $this->getJson('/api/raporlar/yillik?yil=2026')
            ->assertOk()
            ->assertJsonPath('genel.donem_sayisi', 1)
            ->assertJsonPath('sube_bazli.0.toplam_puan', 30);
    }

    // ─── Kategori kırılımı (bölüm 7-8) ────────────────────────────────────────

    public function test_kategori_kirilimi_hangi_konuda_basarili_gosterir(): void
    {
        $ocak = $this->donem('Ocak', '2026-01-01');

        // Üye çalışmalarında tam puan, teşkilatlanmada sıfır.
        $this->faaliyetVeKayit($ocak, $this->ankara, 5, KriterKategorileri::UYE_CALISMALARI);
        $this->faaliyetVeKayit($ocak, $this->ankara, 0, KriterKategorileri::TESKILATLANMA);

        Sanctum::actingAs($this->merkez());

        $kirilim = collect($this->getJson('/api/raporlar/yillik?yil=2026')->json('sube_bazli.0.kategori_kirilimi'))
            ->keyBy('kategori');

        $this->assertSame(1.0, (float) $kirilim[KriterKategorileri::UYE_CALISMALARI]['oran']);
        $this->assertSame(0.0, (float) $kirilim[KriterKategorileri::TESKILATLANMA]['oran']);
        $this->assertSame('Üye Çalışmaları', $kirilim[KriterKategorileri::UYE_CALISMALARI]['etiket']);
    }

    public function test_kategorisiz_faaliyetler_siniflandirilmamis_altinda_toplanir(): void
    {
        $ocak = $this->donem('Ocak', '2026-01-01');
        $this->faaliyetVeKayit($ocak, $this->ankara, 3, null);

        Sanctum::actingAs($this->merkez());

        $kirilim = collect($this->getJson('/api/raporlar/yillik?yil=2026')->json('sube_bazli.0.kategori_kirilimi'))
            ->keyBy('kategori');

        $this->assertArrayHasKey(KriterKategorileri::SINIFLANDIRILMAMIS, $kirilim->all());
        $this->assertSame(30, $kirilim[KriterKategorileri::SINIFLANDIRILMAMIS]['puan']);
    }

    public function test_donem_raporu_da_kategori_kirilimi_dondurur(): void
    {
        $ocak = $this->donem('Ocak', '2026-01-01', 'active');
        $this->faaliyetVeKayit($ocak, $this->ankara, 5, KriterKategorileri::SEKTOREL);

        Sanctum::actingAs($this->merkez());

        $this->getJson("/api/raporlar/{$ocak->id}")
            ->assertOk()
            ->assertJsonPath('kategori_bazli.0.kategori', KriterKategorileri::SEKTOREL)
            ->assertJsonPath('kategori_bazli.0.etiket', 'Sektörel Çalışmalar');
    }

    public function test_gecersiz_kategori_ile_faaliyet_olusturulamaz(): void
    {
        $ocak = $this->donem('Ocak', '2026-01-01', 'active');
        Sanctum::actingAs($this->merkez());

        $this->postJson('/api/faaliyetler', [
            'title' => 'Hatalı', 'donem_id' => $ocak->id, 'kategori' => 'olmayan_kategori',
        ])->assertStatus(422)->assertJsonValidationErrors('kategori');
    }

    public function test_kategori_kirilimi_en_zayif_kategoriden_baslar(): void
    {
        $ocak = $this->donem('Ocak', '2026-01-01');

        $this->faaliyetVeKayit($ocak, $this->ankara, 5, KriterKategorileri::UYE_CALISMALARI);      // tam
        $this->faaliyetVeKayit($ocak, $this->ankara, 2, KriterKategorileri::SEKTOREL);             // kısmi
        $this->faaliyetVeKayit($ocak, $this->ankara, 0, KriterKategorileri::TESKILATLANMA);        // sıfır

        Sanctum::actingAs($this->merkez());

        $yanit = $this->getJson('/api/raporlar/yillik?yil=2026')->assertOk();

        $beklenen = [
            KriterKategorileri::TESKILATLANMA,
            KriterKategorileri::SEKTOREL,
            KriterKategorileri::UYE_CALISMALARI,
        ];

        // Şube raporunda "geliştirilmesi gereken" listesi doğrudan baştan okunur.
        $this->assertSame($beklenen, collect($yanit->json('sube_bazli.0.kategori_kirilimi'))->pluck('kategori')->all());

        // Birim geneli aynı yönde olmalı; iki liste ters sıralanırsa ekranda
        // "en zayıf" başlığı altında birinde en güçlü kategori çıkar.
        $this->assertSame($beklenen, collect($yanit->json('kategori_bazli'))->pluck('kategori')->all());
    }

    public function test_donem_raporunda_kategori_sirasi_ayni_yonde(): void
    {
        $ocak = $this->donem('Ocak', '2026-01-01', 'active');
        $this->faaliyetVeKayit($ocak, $this->ankara, 5, KriterKategorileri::ETKINLIK);
        $this->faaliyetVeKayit($ocak, $this->ankara, 0, KriterKategorileri::HEDEF_GERCEKLESTIRME);

        Sanctum::actingAs($this->merkez());

        $sira = collect($this->getJson("/api/raporlar/{$ocak->id}")->json('kategori_bazli'))
            ->pluck('kategori')->all();

        $this->assertSame([KriterKategorileri::HEDEF_GERCEKLESTIRME, KriterKategorileri::ETKINLIK], $sira);
    }

    public function test_donem_kapsaminda_olmayan_sube_o_donemi_saymaz(): void
    {
        // Ocak herkese açık, Şubat yalnızca Ankara'ya.
        $ocak = $this->donem('Ocak', '2026-01-01');
        $f = $this->faaliyetVeKayit($ocak, $this->izmir, 3);
        $ay = DonemAy::where('donem_id', $ocak->id)->first();
        FaaliyetKayit::create([
            'faaliyet_id' => $f->id, 'sube_id' => $this->ankara->id,
            'donem_ay_id' => $ay->id, 'deger' => '1',
        ]);

        $subat = $this->donem('Şubat', '2026-02-01');
        $subat->update(['tum_subeler' => false]);
        $subat->subeler()->sync([$this->ankara->id]);
        $this->faaliyetVeKayit($subat, $this->ankara, 4);

        Sanctum::actingAs($this->merkez());

        $satirlar = collect($this->getJson('/api/raporlar/yillik?yil=2026')->json('sube_bazli'))
            ->keyBy('sube_adi');

        // İzmir Şubat'ta yok: ne puanı ne de max_puanı yıl toplamına girer.
        $this->assertSame(1, $satirlar['MÜSİAD İzmir']['katildigi_donem']);
        $this->assertSame(50, $satirlar['MÜSİAD İzmir']['max_puan']);
        $this->assertSame(2, $satirlar['MÜSİAD Ankara']['katildigi_donem']);
        $this->assertSame(100, $satirlar['MÜSİAD Ankara']['max_puan']);

        // Ortalama katıldığı dönem üzerinden alınır, yılın dönem sayısı üzerinden değil.
        $this->assertSame(30.0, (float) $satirlar['MÜSİAD İzmir']['ortalama_puan']);
    }

    public function test_sube_yoneticisi_yillik_rapora_erisemez(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role' => 'sube_yoneticisi', 'sube_id' => $this->ankara->id,
        ]));

        $this->getJson('/api/raporlar/yillik?yil=2026')->assertStatus(403);
    }
}
