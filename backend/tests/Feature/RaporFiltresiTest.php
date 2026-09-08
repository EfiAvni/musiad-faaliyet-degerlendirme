<?php

namespace Tests\Feature;

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
 * Dönem raporunun ay aralığı, şube, kategori ve kriter türü filtreleri.
 *
 * Ay aralığında en kritik davranış hedefin orantılanması: 12 aylık dönemde
 * hedefi 12 olan bir kriterde Mart-Temmuz arası 5 kayıt girmiş şube, tam
 * hedefe göre %42 görünürdü - oysa o beş ayda beklenen zaten 5'tir.
 */
class RaporFiltresiTest extends TestCase
{
    use RefreshDatabase;

    private Donem $donem;
    /** @var array<int, DonemAy> */
    private array $aylar = [];
    private Sube $ankara;
    private Sube $izmir;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $start = now()->startOfYear();

        $this->donem = Donem::create([
            'name'        => 'Yillik Donem',
            'start_date'  => $start,
            'end_date'    => $start->copy()->addMonths(11)->endOfMonth(),
            'status'      => 'active',
            'tum_subeler' => true,
        ]);

        // 12 ay: 1..12
        for ($i = 1; $i <= 12; $i++) {
            $ayBasi = $start->copy()->addMonths($i - 1);
            $this->aylar[$i] = DonemAy::create([
                'donem_id'   => $this->donem->id,
                'sira'       => $i,
                'name'       => "Ay {$i}",
                'start_date' => $ayBasi,
                'end_date'   => $ayBasi->copy()->endOfMonth(),
            ]);
        }

        $this->ankara = Sube::create(['name' => 'Ankara', 'status' => 'active', 'uye_sayisi' => 100]);
        $this->izmir = Sube::create(['name' => 'Izmir', 'status' => 'active', 'uye_sayisi' => 100]);
    }

    private function faaliyet(array $ozellikler = []): Faaliyet
    {
        return Faaliyet::create(array_merge([
            'title'       => 'Kriter ' . uniqid(),
            'donem_id'    => $this->donem->id,
            'kriter_turu' => 'sayi',
            'puan'        => 10,
            'hedef'       => 12,
            'durum'       => 'active',
        ], $ozellikler));
    }

    /** Belirtilen ay sıralarına birer kayıt ekler. */
    private function kayitlar(Faaliyet $f, Sube $sube, array $aySiralari): void
    {
        foreach ($aySiralari as $sira) {
            FaaliyetKayit::create([
                'faaliyet_id' => $f->id,
                'sube_id'     => $sube->id,
                'donem_ay_id' => $this->aylar[$sira]->id,
            ]);
        }
    }

    private function rapor(array $sorgu = []): array
    {
        $qs = http_build_query($sorgu);

        return $this->getJson("/api/raporlar/{$this->donem->id}" . ($qs ? "?{$qs}" : ''))
            ->assertOk()
            ->json();
    }

    /** Mart-Temmuz = 3,4,5,6,7 */
    private function martTemmuz(): string
    {
        return implode(',', array_map(fn ($s) => $this->aylar[$s]->id, [3, 4, 5, 6, 7]));
    }

    // ─── Ay aralığı ───────────────────────────────────────────────────────────

    public function test_ay_araligi_disindaki_kayitlar_sayilmaz(): void
    {
        $f = $this->faaliyet();
        $this->kayitlar($f, $this->ankara, [1, 2, 3, 4, 5]);

        $tam = $this->rapor();
        $this->assertSame(5, $tam['genel']['toplam_kayit']);

        // Mart-Temmuz aralığında yalnızca 3, 4 ve 5. aylar var.
        $aralik = $this->rapor(['ay_ids' => $this->martTemmuz()]);
        $this->assertSame(3, $aralik['genel']['toplam_kayit']);
    }

    public function test_hedef_ay_sayisina_gore_orantilanir(): void
    {
        $f = $this->faaliyet(['puan' => 10, 'hedef' => 12]);

        // Şube Mart-Temmuz arası her ay bir kez yapmış: beş ayda beş kayıt.
        $this->kayitlar($f, $this->ankara, [3, 4, 5, 6, 7]);

        $rapor = $this->rapor(['ay_ids' => $this->martTemmuz()]);

        // 5/12 oranında hedef: round(12 * 5/12) = 5 → tavan 10 * 5 = 50.
        $satir = collect($rapor['faaliyet_bazli'])->firstWhere('faaliyet_id', $f->id);
        $this->assertSame(5, $satir['hedef']);
        $this->assertSame(12, $satir['donem_hedefi']);
        $this->assertSame(50, $satir['max_puan']);

        // Beş kayıt × 10 puan = 50 → tam doluluk.
        $ankaraSatiri = collect($rapor['sube_bazli'])->firstWhere('sube_id', $this->ankara->id);
        $this->assertSame(50, $ankaraSatiri['toplam_puan']);
        $this->assertSame(50, $ankaraSatiri['max_puan']);
        $this->assertSame(1.0, (float) $ankaraSatiri['tamamlanma_orani']);
    }

    public function test_ay_araligi_yokken_tam_hedef_gecerli(): void
    {
        $f = $this->faaliyet(['puan' => 10, 'hedef' => 12]);
        $this->kayitlar($f, $this->ankara, [3, 4, 5, 6, 7]);

        $rapor = $this->rapor();

        $satir = collect($rapor['faaliyet_bazli'])->firstWhere('faaliyet_id', $f->id);
        $this->assertSame(12, $satir['hedef']);
        $this->assertSame(120, $satir['max_puan']);

        // Aynı beş kayıt, tam dönemde 50/120.
        $ankaraSatiri = collect($rapor['sube_bazli'])->firstWhere('sube_id', $this->ankara->id);
        $this->assertSame(round(50 / 120, 4), (float) $ankaraSatiri['tamamlanma_orani']);
    }

    public function test_evet_hayir_tavani_orantilanmaz(): void
    {
        $f = $this->faaliyet(['kriter_turu' => 'evet_hayir', 'puan' => 20, 'hedef' => 0]);
        $this->kayitlar($f, $this->ankara, [4]);

        $rapor = $this->rapor(['ay_ids' => $this->martTemmuz()]);
        $satir = collect($rapor['faaliyet_bazli'])->firstWhere('faaliyet_id', $f->id);

        // "Yapıldı mı" sorusunun tavanı aya bağlı değil.
        $this->assertSame(20, $satir['max_puan']);
        $this->assertSame(20, $satir['toplam_puan']);
    }

    public function test_oran_kriterinde_hedef_yuzdesi_de_orantilanir(): void
    {
        // 100 üye, hedef %12 → tam dönemde 12 ziyaret gerekir.
        $f = $this->faaliyet(['kriter_turu' => 'oran', 'puan' => 30, 'hedef' => 12]);
        $this->kayitlar($f, $this->ankara, [3, 4, 5, 6, 7]);

        $rapor = $this->rapor(['ay_ids' => $this->martTemmuz()]);
        $ankaraSatiri = collect($rapor['sube_bazli'])->firstWhere('sube_id', $this->ankara->id);

        // Orantılı hedef: round(12 * 5/12) = %5. Gerçekleşen 5/100 = %5 → tam puan.
        $this->assertSame(30, $ankaraSatiri['toplam_puan']);
    }

    public function test_kademeli_esikler_orantilanir(): void
    {
        $f = $this->faaliyet([
            'kriter_turu' => 'kademeli',
            'puan'        => 0,
            'hedef'       => 0,
            'kademeler'   => [['esik' => 6, 'puan' => 10], ['esik' => 12, 'puan' => 30]],
        ]);

        // Beş ayda 5 kayıt: tam dönemde ilk eşiği (6) bile geçmez.
        $this->kayitlar($f, $this->ankara, [3, 4, 5, 6, 7]);

        $tam = collect($this->rapor()['sube_bazli'])->firstWhere('sube_id', $this->ankara->id);
        $this->assertSame(0, $tam['toplam_puan']);

        // 5/12 oranında eşikler: round(6*5/12)=3 ve round(12*5/12)=5 → üst kademe.
        $aralik = collect($this->rapor(['ay_ids' => $this->martTemmuz()])['sube_bazli'])
            ->firstWhere('sube_id', $this->ankara->id);
        $this->assertSame(30, $aralik['toplam_puan']);
    }

    public function test_aylik_trend_secili_aylari_isaretler(): void
    {
        $this->faaliyet();

        $trend = $this->rapor(['ay_ids' => $this->martTemmuz()])['aylik_trend'];

        $secili = array_values(array_map(
            fn ($a) => $a['sira'],
            array_filter($trend, fn ($a) => $a['secili']),
        ));

        $this->assertSame([3, 4, 5, 6, 7], $secili);
        $this->assertCount(12, $trend, 'Trend dönemin tüm aylarını göstermeli.');
    }

    public function test_baska_donemin_ay_idsi_yok_sayilir(): void
    {
        $baska = Donem::create([
            'name' => 'Baska', 'start_date' => now()->addYear()->startOfMonth(),
            'end_date' => now()->addYear()->endOfMonth(), 'status' => 'pending', 'tum_subeler' => true,
        ]);
        $yabanciAy = DonemAy::create([
            'donem_id' => $baska->id, 'sira' => 1, 'name' => 'Yabanci',
            'start_date' => now()->addYear()->startOfMonth(), 'end_date' => now()->addYear()->endOfMonth(),
        ]);

        $f = $this->faaliyet();
        $this->kayitlar($f, $this->ankara, [1, 2, 3]);

        // Yabancı id süzülür; geriye geçerli ay kalmadığı için filtre uygulanmaz.
        $rapor = $this->rapor(['ay_ids' => (string) $yabanciAy->id]);

        $this->assertSame(3, $rapor['genel']['toplam_kayit']);
        $this->assertNull($rapor['filtre']['ay_ids']);
    }

    // ─── Diğer filtreler ──────────────────────────────────────────────────────

    public function test_sube_filtresi_raporu_daraltir(): void
    {
        $f = $this->faaliyet();
        $this->kayitlar($f, $this->ankara, [1]);
        $this->kayitlar($f, $this->izmir, [1]);

        $this->assertCount(2, $this->rapor()['sube_bazli']);

        $rapor = $this->rapor(['sube_ids' => (string) $this->ankara->id]);

        $this->assertSame(['Ankara'], array_column($rapor['sube_bazli'], 'sube_adi'));
        $this->assertSame(1, $rapor['genel']['toplam_sube']);
    }

    public function test_kategori_filtresi_raporu_daraltir(): void
    {
        $uye = $this->faaliyet(['title' => 'Uye kriteri', 'kategori' => 'uye_calismalari']);
        $this->faaliyet(['title' => 'Sektor kriteri', 'kategori' => 'sektorel']);
        $this->kayitlar($uye, $this->ankara, [1]);

        $rapor = $this->rapor(['kategoriler' => 'uye_calismalari']);

        $this->assertSame(['Uye kriteri'], array_column($rapor['faaliyet_bazli'], 'title'));
        $this->assertSame(1, $rapor['genel']['toplam_faaliyet']);
    }

    public function test_kriter_turu_filtresi_raporu_daraltir(): void
    {
        $this->faaliyet(['title' => 'Sayi kriteri']);
        $this->faaliyet(['title' => 'Evet hayir kriteri', 'kriter_turu' => 'evet_hayir', 'puan' => 20, 'hedef' => 0]);

        $rapor = $this->rapor(['kriter_turleri' => 'evet_hayir']);

        $this->assertSame(['Evet hayir kriteri'], array_column($rapor['faaliyet_bazli'], 'title'));
    }

    public function test_filtreler_birlikte_uygulanir(): void
    {
        $uye = $this->faaliyet(['title' => 'Uye kriteri', 'kategori' => 'uye_calismalari']);
        $sektor = $this->faaliyet(['title' => 'Sektor kriteri', 'kategori' => 'sektorel']);

        $this->kayitlar($uye, $this->ankara, [3, 4]);
        $this->kayitlar($uye, $this->izmir, [3]);
        $this->kayitlar($sektor, $this->ankara, [3]);

        $rapor = $this->rapor([
            'ay_ids'      => $this->martTemmuz(),
            'sube_ids'    => (string) $this->ankara->id,
            'kategoriler' => 'uye_calismalari',
        ]);

        $this->assertSame(['Uye kriteri'], array_column($rapor['faaliyet_bazli'], 'title'));
        $this->assertSame(['Ankara'], array_column($rapor['sube_bazli'], 'sube_adi'));
        $this->assertSame(2, $rapor['genel']['toplam_kayit']);
    }

    public function test_uygulanan_filtre_yanitta_geri_doner(): void
    {
        $this->faaliyet();

        $rapor = $this->rapor(['ay_ids' => $this->martTemmuz(), 'kategoriler' => 'uye_calismalari']);

        $this->assertCount(5, $rapor['filtre']['ay_ids']);
        $this->assertSame(['uye_calismalari'], $rapor['filtre']['kategoriler']);
        $this->assertTrue($rapor['filtre']['hedef_orantili']);
        $this->assertSame(round(5 / 12, 4), (float) $rapor['filtre']['donem_orani']);
    }

    public function test_filtresiz_raporda_orantilama_kapali(): void
    {
        $this->faaliyet();

        $filtre = $this->rapor()['filtre'];

        $this->assertNull($filtre['ay_ids']);
        $this->assertFalse($filtre['hedef_orantili']);
        $this->assertSame(1.0, (float) $filtre['donem_orani']);
    }

    public function test_gecersiz_kategori_yok_sayilir(): void
    {
        $this->faaliyet(['kategori' => 'uye_calismalari']);

        $rapor = $this->rapor(['kategoriler' => 'olmayan_kategori']);

        $this->assertNull($rapor['filtre']['kategoriler']);
        $this->assertSame(1, $rapor['genel']['toplam_faaliyet']);
    }

    public function test_pdf_ayni_filtreyle_uretilir(): void
    {
        $f = $this->faaliyet();
        $this->kayitlar($f, $this->ankara, [1, 2, 3]);

        $this->get("/api/raporlar/{$this->donem->id}/pdf?ay_ids=" . $this->martTemmuz())
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }
}
