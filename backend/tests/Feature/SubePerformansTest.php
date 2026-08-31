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
use App\Support\KriterKategorileri;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Doküman bölüm 4: şube "önceki dönemlerde girdiği bilgileri görüntüleyebilmeli"
 * ve "kendi performans sonuçlarını görüntüleyebilmelidir". Bölüm 13 geçmiş
 * dönemleri ve önceki yıl performansını ekliyor.
 *
 * Bölüm 4 aynı zamanda sınırı çiziyor: "Şube başka bir şubenin verilerini
 * değiştirememeli veya kendi yetkisi dışındaki verilere müdahale edememelidir."
 */
class SubePerformansTest extends TestCase
{
    use RefreshDatabase;

    private Birim $teskilat;
    private Sube $ankara;
    private Sube $izmir;
    private User $ankaraYoneticisi;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teskilat = Birim::create(['name' => 'Teşkilatlanma', 'status' => 'active']);
        $this->ankara = Sube::create(['name' => 'MÜSİAD Ankara', 'uye_sayisi' => 100, 'status' => 'active']);
        $this->izmir = Sube::create(['name' => 'MÜSİAD İzmir', 'uye_sayisi' => 100, 'status' => 'active']);

        $this->ankaraYoneticisi = User::factory()->create([
            'role' => 'sube_yoneticisi', 'sube_id' => $this->ankara->id,
        ]);
    }

    private function donem(string $ad, string $baslangic, string $durum = 'active', ?Birim $birim = null): Donem
    {
        return Donem::create([
            'name' => $ad, 'birim_id' => ($birim ?? $this->teskilat)->id,
            'start_date' => $baslangic, 'end_date' => date('Y-m-t', strtotime($baslangic)),
            'status' => $durum, 'tum_subeler' => true,
        ]);
    }

    private function faaliyet(Donem $donem, int $puan = 10, int $hedef = 5, ?string $kategori = null): Faaliyet
    {
        return Faaliyet::create([
            'title' => 'Kriter ' . uniqid(), 'puan' => $puan, 'hedef' => $hedef,
            'tarih_gerekli' => false, 'donem_id' => $donem->id, 'durum' => 'active',
            'kriter_turu' => 'sayi', 'kategori' => $kategori,
        ]);
    }

    private function ay(Donem $donem, int $sira = 1): DonemAy
    {
        return DonemAy::create([
            'donem_id' => $donem->id, 'sira' => $sira, 'name' => "Ay {$sira}",
            'start_date' => $donem->start_date, 'end_date' => $donem->end_date,
        ]);
    }

    private function kayit(Faaliyet $f, Sube $sube, DonemAy $ay, int $adet): void
    {
        for ($i = 0; $i < $adet; $i++) {
            FaaliyetKayit::create([
                'faaliyet_id' => $f->id, 'sube_id' => $sube->id,
                'donem_ay_id' => $ay->id, 'deger' => '1',
            ]);
        }
    }

    // ─── Dönem özeti (bölüm 4) ────────────────────────────────────────────────

    public function test_sube_kendi_donem_puanini_gorur(): void
    {
        $donem = $this->donem('Ocak', '2026-01-01');
        $f = $this->faaliyet($donem);
        $ay = $this->ay($donem);
        $this->kayit($f, $this->ankara, $ay, 3);

        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson("/api/performansim?donem_id={$donem->id}")
            ->assertOk()
            ->assertJsonPath('donem.name', 'Ocak')
            ->assertJsonPath('genel.toplam_puan', 30)
            ->assertJsonPath('genel.max_puan', 50)
            ->assertJsonPath('genel.kayit_sayisi', 3)
            ->assertJsonPath('faaliyetler.0.kayit_sayisi', 3)
            ->assertJsonPath('faaliyetler.0.puan', 30);
    }

    public function test_ozet_baska_subenin_puanini_icermez(): void
    {
        $donem = $this->donem('Ocak', '2026-01-01');
        $f = $this->faaliyet($donem);
        $ay = $this->ay($donem);
        $this->kayit($f, $this->ankara, $ay, 2);
        $this->kayit($f, $this->izmir, $ay, 5);

        Sanctum::actingAs($this->ankaraYoneticisi);

        $yanit = $this->getJson("/api/performansim?donem_id={$donem->id}")->assertOk();

        // Yalnızca kendi puanı; İzmir'in 50 puanı hiçbir alana sızmamalı.
        $yanit->assertJsonPath('genel.toplam_puan', 20);
        $this->assertStringNotContainsString('İzmir', $yanit->getContent());
    }

    public function test_donem_belirtilmezse_aktif_donem_gelir(): void
    {
        $this->donem('Gecmis', '2025-01-01', 'completed');
        $aktif = $this->donem('Simdiki', '2026-01-01', 'active');

        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson('/api/performansim')
            ->assertOk()
            ->assertJsonPath('donem.id', $aktif->id);
    }

    public function test_aktif_donem_yoksa_en_son_donem_gelir(): void
    {
        $this->donem('Eski', '2025-01-01', 'completed');
        $son = $this->donem('Yeni', '2026-01-01', 'completed');

        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson('/api/performansim')
            ->assertOk()
            ->assertJsonPath('donem.id', $son->id);
    }

    public function test_hic_donem_yoksa_bos_doner(): void
    {
        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson('/api/performansim')
            ->assertOk()
            ->assertJsonPath('donem', null)
            ->assertJsonPath('genel', null);
    }

    // ─── Geçmiş dönem erişimi (bölüm 13) ──────────────────────────────────────

    public function test_sube_tamamlanmis_donemi_gorebilir(): void
    {
        $gecmis = $this->donem('Gecen Yil', '2025-01-01', 'completed');
        $f = $this->faaliyet($gecmis);
        $this->kayit($f, $this->ankara, $this->ay($gecmis), 4);

        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson("/api/performansim?donem_id={$gecmis->id}")
            ->assertOk()
            ->assertJsonPath('donem.status', 'completed')
            ->assertJsonPath('genel.toplam_puan', 40);
    }

    public function test_kapsam_disi_donem_403_doner(): void
    {
        $ozelDonem = $this->donem('Sadece Izmir', '2026-01-01');
        $ozelDonem->update(['tum_subeler' => false]);
        $ozelDonem->subeler()->sync([$this->izmir->id]);

        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson("/api/performansim?donem_id={$ozelDonem->id}")->assertStatus(403);
    }

    public function test_olmayan_donem_de_403_doner(): void
    {
        Sanctum::actingAs($this->ankaraYoneticisi);

        // Var olmayan id ile kapsam dışı id aynı yanıtı vermeli; aksi halde şube
        // 404/403 farkından başka şubelere özel dönemlerin varlığını çıkarabilir.
        $this->getJson('/api/performansim?donem_id=999999')->assertStatus(403);
    }

    public function test_sube_baska_birimin_donemini_de_gorur(): void
    {
        // Şube tek hesapla tüm birimlere çalışır; birim ayrımı merkez tarafında.
        $genc = Birim::create(['name' => 'GENÇ MÜSİAD', 'status' => 'active']);
        $donem = $this->donem('GENÇ Ocak', '2026-01-01', 'active', $genc);
        $this->kayit($this->faaliyet($donem), $this->ankara, $this->ay($donem), 2);

        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson("/api/performansim?donem_id={$donem->id}")
            ->assertOk()
            ->assertJsonPath('donem.birim_adi', 'GENÇ MÜSİAD')
            ->assertJsonPath('genel.toplam_puan', 20);
    }

    // ─── Yıllık performans (bölüm 13) ─────────────────────────────────────────

    public function test_yillik_kendi_donemlerini_toplar(): void
    {
        $ocak = $this->donem('Ocak', '2026-01-01', 'completed');
        $this->kayit($this->faaliyet($ocak), $this->ankara, $this->ay($ocak), 3);   // 30

        $subat = $this->donem('Şubat', '2026-02-01', 'active');
        $this->kayit($this->faaliyet($subat), $this->ankara, $this->ay($subat), 2); // 20

        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson('/api/performansim/yillik?yil=2026')
            ->assertOk()
            ->assertJsonPath('sube_adi', 'MÜSİAD Ankara')
            ->assertJsonPath('genel.toplam_puan', 50)
            ->assertJsonPath('genel.donem_sayisi', 2)
            ->assertJsonPath('genel.tamamlanan_donem', 1)
            ->assertJsonPath('genel.ortalama_puan', 25)
            ->assertJsonPath('donem_puanlari.0.donem_adi', 'Ocak')
            ->assertJsonPath('donem_puanlari.0.puan', 30)
            ->assertJsonPath('donem_puanlari.1.puan', 20);
    }

    public function test_yillik_baska_yili_karistirmaz(): void
    {
        $bu = $this->donem('2026', '2026-01-01');
        $this->kayit($this->faaliyet($bu), $this->ankara, $this->ay($bu), 3);

        $gecen = $this->donem('2025', '2025-01-01');
        $this->kayit($this->faaliyet($gecen), $this->ankara, $this->ay($gecen), 5);

        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson('/api/performansim/yillik?yil=2025')
            ->assertOk()
            ->assertJsonPath('genel.donem_sayisi', 1)
            ->assertJsonPath('genel.toplam_puan', 50);
    }

    public function test_yillik_kapsam_disi_donemi_saymaz(): void
    {
        $ortak = $this->donem('Ortak', '2026-01-01');
        $this->kayit($this->faaliyet($ortak), $this->ankara, $this->ay($ortak), 2); // 20

        $izmirOzel = $this->donem('Sadece Izmir', '2026-02-01');
        $izmirOzel->update(['tum_subeler' => false]);
        $izmirOzel->subeler()->sync([$this->izmir->id]);
        $this->kayit($this->faaliyet($izmirOzel), $this->izmir, $this->ay($izmirOzel), 5);

        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson('/api/performansim/yillik?yil=2026')
            ->assertOk()
            ->assertJsonPath('genel.donem_sayisi', 1)
            ->assertJsonPath('genel.toplam_puan', 20)
            ->assertJsonPath('genel.max_puan', 50);
    }

    public function test_yillik_kategori_kirilimi_en_zayiftan_siralanir(): void
    {
        $ocak = $this->donem('Ocak', '2026-01-01');
        $ay = $this->ay($ocak);
        $this->kayit($this->faaliyet($ocak, 10, 5, KriterKategorileri::UYE_CALISMALARI), $this->ankara, $ay, 5);
        $this->faaliyet($ocak, 10, 5, KriterKategorileri::TESKILATLANMA); // kayıt yok

        Sanctum::actingAs($this->ankaraYoneticisi);

        $kirilim = $this->getJson('/api/performansim/yillik?yil=2026')->json('kategori_kirilimi');

        $this->assertSame(KriterKategorileri::TESKILATLANMA, $kirilim[0]['kategori']);
        $this->assertSame(KriterKategorileri::UYE_CALISMALARI, $kirilim[1]['kategori']);
    }

    public function test_yillar_listesi_sadece_donemi_olan_yillari_verir(): void
    {
        $this->donem('A', '2026-01-01');
        $this->donem('B', '2026-06-01');
        $this->donem('C', '2024-01-01');

        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson('/api/performansim/yillar')
            ->assertOk()
            ->assertExactJson([2026, 2024]);
    }

    public function test_yillar_listesi_baska_subeye_ozel_yili_sizdirmaz(): void
    {
        $this->donem('Ortak', '2026-01-01');

        $izmirOzel = $this->donem('Sadece Izmir', '2023-01-01');
        $izmirOzel->update(['tum_subeler' => false]);
        $izmirOzel->subeler()->sync([$this->izmir->id]);

        Sanctum::actingAs($this->ankaraYoneticisi);

        // Yıl listesinde 2023 çıkarsa şube, kendisine kapalı bir dönemin
        // varlığını öğrenmiş olur. Bu uçta DonemPuanlama gibi ikinci bir kapsam
        // katmanı yok; kapsam yalnızca subeninDonemleri sorgusundan geliyor.
        $this->getJson('/api/performansim/yillar')
            ->assertOk()
            ->assertExactJson([2026]);
    }

    public function test_yillik_kapsam_disi_donemin_adini_sizdirmaz(): void
    {
        $izmirOzel = $this->donem('Sadece Izmir', '2026-03-01');
        $izmirOzel->update(['tum_subeler' => false]);
        $izmirOzel->subeler()->sync([$this->izmir->id]);

        Sanctum::actingAs($this->ankaraYoneticisi);

        $yanit = $this->getJson('/api/performansim/yillik?yil=2026')->assertOk();

        $this->assertStringNotContainsString('Sadece Izmir', $yanit->getContent());
        $yanit->assertJsonCount(0, 'donem_puanlari');
    }

    // ─── Geçmiş kayıtların listelenmesi (bölüm 4) ─────────────────────────────

    public function test_kayitlar_donem_id_ile_filtrelenir(): void
    {
        $eski = $this->donem('Eski', '2025-01-01', 'completed');
        $this->kayit($this->faaliyet($eski), $this->ankara, $this->ay($eski), 2);

        $yeni = $this->donem('Yeni', '2026-01-01');
        $this->kayit($this->faaliyet($yeni), $this->ankara, $this->ay($yeni), 3);

        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson('/api/faaliyet-kayitlari')->assertOk()->assertJsonCount(5);
        $this->getJson("/api/faaliyet-kayitlari?donem_id={$eski->id}")->assertOk()->assertJsonCount(2);
        $this->getJson("/api/faaliyet-kayitlari?donem_id={$yeni->id}")->assertOk()->assertJsonCount(3);
    }

    public function test_donem_filtresi_baska_subenin_kayitlarini_getirmez(): void
    {
        $donem = $this->donem('Ocak', '2026-01-01');
        $f = $this->faaliyet($donem);
        $ay = $this->ay($donem);
        $this->kayit($f, $this->ankara, $ay, 1);
        $this->kayit($f, $this->izmir, $ay, 4);

        Sanctum::actingAs($this->ankaraYoneticisi);

        // Filtre kapsamı daraltır, genişletmez.
        $this->getJson("/api/faaliyet-kayitlari?donem_id={$donem->id}")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.sube_id', $this->ankara->id);
    }

    // ─── Ay durumları (bölüm 11-12) ───────────────────────────────────────────

    public function test_ozet_ay_gonderim_durumlarini_dondurur(): void
    {
        $donem = $this->donem('Ocak', '2026-01-01');
        $ay1 = $this->ay($donem, 1);
        $ay2 = $this->ay($donem, 2);

        AyGonderim::create([
            'donem_ay_id' => $ay1->id, 'sube_id' => $this->ankara->id,
            'durum' => AyGonderim::GONDERILDI,
        ]);

        Sanctum::actingAs($this->ankaraYoneticisi);

        $durumlar = collect($this->getJson("/api/performansim?donem_id={$donem->id}")->json('ay_durumlari'))
            ->pluck('durum', 'ay_id');

        $this->assertSame(AyGonderim::GONDERILDI, $durumlar[$ay1->id]);
        // Gönderim satırı yoksa durum "taslak" - bu değer tabloda tutulmuyor.
        $this->assertSame(AyGonderim::TASLAK, $durumlar[$ay2->id]);
    }

    public function test_ay_durumlari_baska_subenin_gonderimini_gostermez(): void
    {
        $donem = $this->donem('Ocak', '2026-01-01');
        $ay = $this->ay($donem);

        AyGonderim::create([
            'donem_ay_id' => $ay->id, 'sube_id' => $this->izmir->id,
            'durum' => AyGonderim::ONAYLANDI,
        ]);

        Sanctum::actingAs($this->ankaraYoneticisi);

        $this->getJson("/api/performansim?donem_id={$donem->id}")
            ->assertOk()
            ->assertJsonPath('ay_durumlari.0.durum', AyGonderim::TASLAK);
    }

    // ─── Yetki sınırları (bölüm 4) ────────────────────────────────────────────

    public function test_birim_yoneticisi_performansim_ucuna_erisemez(): void
    {
        // sube_id bilerek dolu: aksi halde test rota korumasını değil, controller
        // içindeki "şubesi yok" kontrolünü sınamış olurdu ve rol middleware'i
        // kaldırılsa bile geçerdi.
        Sanctum::actingAs(User::factory()->create([
            'role' => 'birim_yoneticisi', 'birim_id' => $this->teskilat->id, 'sube_id' => $this->ankara->id,
        ]));

        $this->getJson('/api/performansim')->assertStatus(403);
        $this->getJson('/api/performansim/yillik')->assertStatus(403);
        $this->getJson('/api/performansim/yillar')->assertStatus(403);
    }

    public function test_superadmin_de_performansim_ucuna_erisemez(): void
    {
        // Süper admin her şeyi görür ama "benim şubem" onun için tanımsız;
        // merkez verisi /raporlar üzerinden gelir.
        Sanctum::actingAs(User::factory()->create([
            'role' => 'superadmin', 'sube_id' => $this->ankara->id,
        ]));

        $this->getJson('/api/performansim')->assertStatus(403);
    }

    public function test_subesiz_sube_yoneticisi_403_alir(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'sube_yoneticisi', 'sube_id' => null]));

        $this->getJson('/api/performansim')->assertStatus(403);
    }

    public function test_giris_yapmamis_kullanici_erisemez(): void
    {
        $this->getJson('/api/performansim')->assertStatus(401);
    }

    public function test_sube_merkez_raporlarina_hala_erisemez(): void
    {
        $donem = $this->donem('Ocak', '2026-01-01');

        Sanctum::actingAs($this->ankaraYoneticisi);

        // Bu uçlar tüm şubelerin puanını ve sıralamasını içeriyor; bölüm 8 ve 10
        // karşılaştırmayı merkez işi olarak tanımlıyor.
        $this->getJson("/api/raporlar/{$donem->id}")->assertStatus(403);
        $this->getJson('/api/raporlar/yillik?yil=2026')->assertStatus(403);
        $this->getJson("/api/subeler/{$this->ankara->id}/puan-ozeti")->assertStatus(403);
    }
}
