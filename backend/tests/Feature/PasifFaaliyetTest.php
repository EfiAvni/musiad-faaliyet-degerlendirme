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
 * Pasif faaliyet = değerlendirmeden çıkarılmış kriter.
 *
 * Kaydı olan bir faaliyet silinemiyor; kullanıcıya "durumunu Pasif yapın"
 * deniyor. Bu testler o talimatın gerçekten bir karşılığı olduğunu sabitler:
 * pasif kriter ne puan üretir, ne tavana eklenir, ne de şubeye görünür.
 */
class PasifFaaliyetTest extends TestCase
{
    use RefreshDatabase;

    private Donem $donem;
    private DonemAy $ay;
    private Sube $sube;

    protected function setUp(): void
    {
        parent::setUp();

        $start = now()->startOfMonth();

        $this->donem = Donem::create([
            'name'        => 'Pasif Testi Donemi',
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

        $this->sube = Sube::create(['name' => 'Pasif Test Subesi', 'status' => 'active', 'uye_sayisi' => 100]);
    }

    private function faaliyet(array $ozellikler = []): Faaliyet
    {
        return Faaliyet::create(array_merge([
            'title'       => 'Kriter',
            'donem_id'    => $this->donem->id,
            'puan'        => 10,
            'hedef'       => 2,
            'durum'       => 'active',
            'kriter_turu' => 'sayi',
        ], $ozellikler));
    }

    private function kayitEkle(Faaliyet $faaliyet, int $adet): void
    {
        for ($i = 0; $i < $adet; $i++) {
            FaaliyetKayit::create([
                'faaliyet_id' => $faaliyet->id,
                'sube_id'     => $this->sube->id,
                'donem_ay_id' => $this->ay->id,
            ]);
        }
    }

    public function test_pasif_faaliyet_puana_da_tavana_da_girmez(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $aktif = $this->faaliyet(['title' => 'Aktif kriter']);
        $pasif = $this->faaliyet(['title' => 'Pasif kriter', 'durum' => 'passive']);

        $this->kayitEkle($aktif, 2);
        $this->kayitEkle($pasif, 2);

        $rapor = $this->getJson("/api/raporlar/{$this->donem->id}")->assertOk()->json();

        $subeSatiri = $rapor['sube_bazli'][0];

        // Yalnızca aktif kriter: 2 kayıt × 10 puan = 20, tavan 10 × 2 = 20.
        $this->assertSame(20, $subeSatiri['toplam_puan']);
        $this->assertSame(20, $subeSatiri['max_puan']);
        $this->assertSame(1.0, (float) $subeSatiri['tamamlanma_orani']);

        $baslıklar = array_column($rapor['faaliyet_bazli'], 'title');
        $this->assertSame(['Aktif kriter'], $baslıklar);
        $this->assertSame(1, $rapor['genel']['toplam_faaliyet']);
    }

    public function test_pasif_faaliyet_sube_puan_ozetinde_yer_almaz(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $aktif = $this->faaliyet(['title' => 'Aktif kriter']);
        $pasif = $this->faaliyet(['title' => 'Pasif kriter', 'durum' => 'passive']);

        $this->kayitEkle($aktif, 1);
        $this->kayitEkle($pasif, 1);

        $ozet = $this->getJson("/api/subeler/{$this->sube->id}/puan-ozeti?donem_id={$this->donem->id}")
            ->assertOk()
            ->json();

        $this->assertSame(10, $ozet['toplam_puan']);
        $this->assertSame(['Aktif kriter'], array_column($ozet['detaylar'], 'title'));
    }

    public function test_pasif_faaliyete_yeni_kayit_eklenemez(): void
    {
        $subeYoneticisi = User::factory()->create([
            'role'    => 'sube_yoneticisi',
            'sube_id' => $this->sube->id,
        ]);
        Sanctum::actingAs($subeYoneticisi);

        $pasif = $this->faaliyet(['durum' => 'passive']);

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $pasif->id,
            'deger'       => '1',
        ])->assertStatus(422)->assertJsonValidationErrors('faaliyet_id');

        $this->assertSame(0, FaaliyetKayit::where('faaliyet_id', $pasif->id)->count());
    }

    public function test_pasif_faaliyet_sube_listesinde_gorunmez(): void
    {
        $subeYoneticisi = User::factory()->create([
            'role'    => 'sube_yoneticisi',
            'sube_id' => $this->sube->id,
        ]);
        Sanctum::actingAs($subeYoneticisi);

        $this->faaliyet(['title' => 'Aktif kriter']);
        $this->faaliyet(['title' => 'Pasif kriter', 'durum' => 'passive']);

        $liste = $this->getJson("/api/faaliyetler?donem_id={$this->donem->id}")->assertOk()->json();

        $this->assertSame(['Aktif kriter'], array_column($liste, 'title'));
    }

    public function test_merkez_pasif_faaliyeti_gormeye_devam_eder(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $this->faaliyet(['title' => 'Aktif kriter']);
        $this->faaliyet(['title' => 'Pasif kriter', 'durum' => 'passive']);

        $liste = $this->getJson("/api/faaliyetler?donem_id={$this->donem->id}")->assertOk()->json();

        $this->assertCount(2, $liste);
    }

    public function test_pasif_faaliyet_yillik_rapora_girmez(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $aktif = $this->faaliyet(['title' => 'Aktif kriter']);
        $pasif = $this->faaliyet(['title' => 'Pasif kriter', 'durum' => 'passive']);

        $this->kayitEkle($aktif, 2);
        $this->kayitEkle($pasif, 2);

        $yil = $this->donem->start_date->format('Y');
        $rapor = $this->getJson("/api/raporlar/yillik?yil={$yil}")->assertOk()->json();

        $satir = collect($rapor['sube_bazli'])->firstWhere('sube_id', $this->sube->id);

        $this->assertSame(20, $satir['toplam_puan']);
        $this->assertSame(20, $satir['max_puan']);
    }

    public function test_manuel_puan_pasif_faaliyette_sayilmaz(): void
    {
        $merkez = User::factory()->create(['role' => 'superadmin']);
        Sanctum::actingAs($merkez);

        $manuel = $this->faaliyet([
            'title'       => 'Manuel kriter',
            'kriter_turu' => 'manuel',
            'puan'        => 40,
            'hedef'       => 0,
        ]);

        $gonderim = AyGonderim::create([
            'donem_ay_id'   => $this->ay->id,
            'sube_id'       => $this->sube->id,
            'durum'         => AyGonderim::GONDERILDI,
            'gonderildi_at' => now(),
        ]);

        FaaliyetDegerlendirme::create([
            'ay_gonderim_id'   => $gonderim->id,
            'faaliyet_id'      => $manuel->id,
            'puan'             => 40,
            'degerlendiren_id' => $merkez->id,
        ]);

        $this->assertSame(
            40,
            $this->getJson("/api/raporlar/{$this->donem->id}")->json('sube_bazli.0.toplam_puan'),
        );

        $manuel->update(['durum' => 'passive']);

        $rapor = $this->getJson("/api/raporlar/{$this->donem->id}")->assertOk()->json();

        $this->assertSame(0, $rapor['sube_bazli'][0]['toplam_puan']);
        $this->assertSame(0, $rapor['sube_bazli'][0]['max_puan']);
    }
}
