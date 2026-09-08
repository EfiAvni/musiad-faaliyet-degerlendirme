<?php

namespace Tests\Feature;

use App\Models\AyGonderim;
use App\Models\Donem;
use App\Models\DonemAy;
use App\Models\Faaliyet;
use App\Models\FaaliyetDegerlendirme;
use App\Models\FaaliyetKayit;
use App\Models\Sube;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Faaliyet bazlı doluluk oranı puan üzerinden hesaplanır.
 *
 * Adet tabanlı sayım yalnızca "sayi" türünde anlamlıydı: evet/hayır'da tek
 * şubenin üç kaydı oranı %300'e çıkarıyor, manuelde ise merkez tam puan verse
 * bile hiç kayıt olmadığı için %0 görünüyordu. Matris görünümü aynı sebeple
 * puana çevrilmişti; bu testler iki sekmenin ayrışmamasını sabitler.
 */
class FaaliyetDolulukOraniTest extends TestCase
{
    use RefreshDatabase;

    private Donem $donem;
    private DonemAy $ay;
    private Sube $subeA;
    private Sube $subeB;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $start = now()->startOfMonth();

        $this->donem = Donem::create([
            'name'        => 'Doluluk Donemi',
            'start_date'  => $start,
            'end_date'    => $start->copy()->endOfMonth(),
            'status'      => 'active',
            'tum_subeler' => true,
        ]);

        $this->ay = DonemAy::create([
            'donem_id'   => $this->donem->id,
            'sira'       => 1,
            'name'       => 'Ay 1',
            'start_date' => $start,
            'end_date'   => $start->copy()->endOfMonth(),
        ]);

        $this->subeA = Sube::create(['name' => 'A Subesi', 'status' => 'active', 'uye_sayisi' => 100]);
        $this->subeB = Sube::create(['name' => 'B Subesi', 'status' => 'active', 'uye_sayisi' => 100]);
    }

    private function kayitEkle(Faaliyet $faaliyet, Sube $sube, int $adet): void
    {
        for ($i = 0; $i < $adet; $i++) {
            FaaliyetKayit::create([
                'faaliyet_id' => $faaliyet->id,
                'sube_id'     => $sube->id,
                'donem_ay_id' => $this->ay->id,
            ]);
        }
    }

    private function faaliyetSatiri(int $faaliyetId): array
    {
        $rapor = $this->getJson("/api/raporlar/{$this->donem->id}")->assertOk()->json();

        return collect($rapor['faaliyet_bazli'])->firstWhere('faaliyet_id', $faaliyetId);
    }

    public function test_evet_hayir_kriterinde_fazla_kayit_oranı_yuzden_yukari_cikarmaz(): void
    {
        $faaliyet = Faaliyet::create([
            'title'       => 'Yillik genel kurul',
            'donem_id'    => $this->donem->id,
            'kriter_turu' => 'evet_hayir',
            'puan'        => 20,
            'hedef'       => 0,
            'durum'       => 'active',
        ]);

        // A şubesi üç kez kaydetmiş, B şubesi hiç. Evet/hayır'da fazlası puan
        // getirmediği için doluluk tam olarak yarım olmalı.
        $this->kayitEkle($faaliyet, $this->subeA, 3);

        $satir = $this->faaliyetSatiri($faaliyet->id);

        $this->assertSame(3, $satir['toplam_kayit']);
        $this->assertSame(20, $satir['toplam_puan']);
        $this->assertSame(1, $satir['katilan_sube_sayisi']);
        $this->assertSame(0.5, (float) $satir['doluluk_orani']);
    }

    public function test_manuel_kriterde_kayit_olmadan_verilen_puan_dolulukta_gorunur(): void
    {
        $merkez = User::factory()->create(['role' => 'superadmin']);

        $faaliyet = Faaliyet::create([
            'title'       => 'Merkez degerlendirmesi',
            'donem_id'    => $this->donem->id,
            'kriter_turu' => 'manuel',
            'puan'        => 50,
            'hedef'       => 0,
            'durum'       => 'active',
        ]);

        $gonderim = AyGonderim::create([
            'donem_ay_id'   => $this->ay->id,
            'sube_id'       => $this->subeA->id,
            'durum'         => AyGonderim::GONDERILDI,
            'gonderildi_at' => now(),
        ]);

        FaaliyetDegerlendirme::create([
            'ay_gonderim_id'   => $gonderim->id,
            'faaliyet_id'      => $faaliyet->id,
            'puan'             => 50,
            'degerlendiren_id' => $merkez->id,
        ]);

        $satir = $this->faaliyetSatiri($faaliyet->id);

        // Hiç kayıt yok ama merkez A şubesine tam puan verdi: eski adet tabanlı
        // hesapta bu satır %0 görünüyordu.
        $this->assertSame(0, $satir['toplam_kayit']);
        $this->assertSame(50, $satir['toplam_puan']);
        $this->assertSame(1, $satir['katilan_sube_sayisi']);
        $this->assertSame(0.5, (float) $satir['doluluk_orani']);
    }

    public function test_sayi_kriterinde_doluluk_hedefe_gore_hesaplanir(): void
    {
        $faaliyet = Faaliyet::create([
            'title'       => 'Uye ziyareti',
            'donem_id'    => $this->donem->id,
            'kriter_turu' => 'sayi',
            'puan'        => 10,
            'hedef'       => 4,
            'durum'       => 'active',
        ]);

        // Tavan şube başına 40, iki şube için 80. A hedefi tutturuyor (40),
        // B yarısında kalıyor (20) → 60 / 80.
        $this->kayitEkle($faaliyet, $this->subeA, 4);
        $this->kayitEkle($faaliyet, $this->subeB, 2);

        $satir = $this->faaliyetSatiri($faaliyet->id);

        $this->assertSame(6, $satir['toplam_kayit']);
        $this->assertSame(60, $satir['toplam_puan']);
        $this->assertSame(2, $satir['katilan_sube_sayisi']);
        $this->assertSame(0.75, (float) $satir['doluluk_orani']);
    }

    public function test_sayi_kriterinde_hedefin_uzeri_dolulugu_asmaz(): void
    {
        $faaliyet = Faaliyet::create([
            'title'       => 'Hedefi asan kriter',
            'donem_id'    => $this->donem->id,
            'kriter_turu' => 'sayi',
            'puan'        => 10,
            'hedef'       => 2,
            'durum'       => 'active',
        ]);

        $this->kayitEkle($faaliyet, $this->subeA, 10);
        $this->kayitEkle($faaliyet, $this->subeB, 2);

        $satir = $this->faaliyetSatiri($faaliyet->id);

        $this->assertSame(12, $satir['toplam_kayit']);
        $this->assertSame(1.0, (float) $satir['doluluk_orani']);
    }

    public function test_faaliyet_dolulugu_matris_ile_ayni_puani_kullanir(): void
    {
        $faaliyet = Faaliyet::create([
            'title'       => 'Kademeli kriter',
            'donem_id'    => $this->donem->id,
            'kriter_turu' => 'kademeli',
            'puan'        => 0,
            'hedef'       => 0,
            'kademeler'   => [['esik' => 2, 'puan' => 10], ['esik' => 5, 'puan' => 30]],
            'durum'       => 'active',
        ]);

        $this->kayitEkle($faaliyet, $this->subeA, 5);
        $this->kayitEkle($faaliyet, $this->subeB, 2);

        $rapor = $this->getJson("/api/raporlar/{$this->donem->id}")->assertOk()->json();

        $satir = collect($rapor['faaliyet_bazli'])->firstWhere('faaliyet_id', $faaliyet->id);
        $matrisPuani = collect($rapor['sube_faaliyet_matrisi'])
            ->where('faaliyet_id', $faaliyet->id)
            ->sum('puan_katkisi');

        $this->assertSame(40, $satir['toplam_puan']);
        $this->assertSame($satir['toplam_puan'], $matrisPuani);

        // Tavan en yüksek kademe: şube başına 30, iki şube için 60.
        $this->assertSame(round(40 / 60, 4), (float) $satir['doluluk_orani']);
    }

    public function test_faaliyetler_puana_gore_sirali_doner(): void
    {
        $dusuk = Faaliyet::create([
            'title' => 'Dusuk', 'donem_id' => $this->donem->id, 'kriter_turu' => 'sayi',
            'puan' => 1, 'hedef' => 10, 'durum' => 'active',
        ]);
        $yuksek = Faaliyet::create([
            'title' => 'Yuksek', 'donem_id' => $this->donem->id, 'kriter_turu' => 'sayi',
            'puan' => 50, 'hedef' => 2, 'durum' => 'active',
        ]);

        // Düşük kriterde daha çok kayıt var ama getirdiği puan daha az.
        $this->kayitEkle($dusuk, $this->subeA, 5);
        $this->kayitEkle($yuksek, $this->subeA, 1);

        $rapor = $this->getJson("/api/raporlar/{$this->donem->id}")->assertOk()->json();

        $this->assertSame(['Yuksek', 'Dusuk'], array_column($rapor['faaliyet_bazli'], 'title'));
    }
}
