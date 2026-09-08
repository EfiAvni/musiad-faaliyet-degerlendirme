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
 * Raporun sessizce veri kaybetmemesi ve puanlanamayan durumu göstermesi.
 *
 * Şube listesi yalnızca aktif şubelerden kuruluyordu: dönem ortasında pasife
 * alınan bir şube raporun tamamından siliniyor, ortalama da o şube hiç yokmuş
 * gibi çıkıyordu. Oran tipi kriterlerde ise üye sayısı bilinmeyen şube sıfır
 * puan alıyor ve sebebi rapora bakan kişi için görünmez kalıyordu.
 */
class RaporKapsamUyarilariTest extends TestCase
{
    use RefreshDatabase;

    private Donem $donem;
    private DonemAy $ay;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $start = now()->startOfMonth();

        $this->donem = Donem::create([
            'name'        => 'Kapsam Donemi',
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

    private function rapor(): array
    {
        return $this->getJson("/api/raporlar/{$this->donem->id}")->assertOk()->json();
    }

    public function test_donem_ortasinda_pasiflesen_sube_raporda_kalir(): void
    {
        $aktif = Sube::create(['name' => 'Aktif Sube', 'status' => 'active', 'uye_sayisi' => 100]);
        $ayrilan = Sube::create(['name' => 'Ayrilan Sube', 'status' => 'active', 'uye_sayisi' => 100]);

        $faaliyet = Faaliyet::create([
            'title' => 'Kriter', 'donem_id' => $this->donem->id, 'kriter_turu' => 'sayi',
            'puan' => 10, 'hedef' => 2, 'durum' => 'active',
        ]);

        $this->kayitEkle($faaliyet, $aktif, 2);
        $this->kayitEkle($faaliyet, $ayrilan, 1);

        $ayrilan->update(['status' => 'passive']);

        $rapor = $this->rapor();

        $adlar = array_column($rapor['sube_bazli'], 'sube_adi');
        $this->assertContains('Ayrilan Sube', $adlar);
        $this->assertSame(2, $rapor['genel']['toplam_sube']);

        $satir = collect($rapor['sube_bazli'])->firstWhere('sube_adi', 'Ayrilan Sube');
        $this->assertSame(10, $satir['toplam_puan']);
        $this->assertSame(1, $satir['kayit_sayisi']);

        // Ortalama iki şube üzerinden: (1.0 + 0.5) / 2
        $this->assertSame(0.75, (float) $rapor['genel']['ortalama_tamamlanma']);
    }

    public function test_kaydi_olmayan_pasif_sube_rapora_girmez(): void
    {
        Sube::create(['name' => 'Aktif Sube', 'status' => 'active', 'uye_sayisi' => 100]);
        Sube::create(['name' => 'Hic Katilmayan', 'status' => 'passive', 'uye_sayisi' => 100]);

        Faaliyet::create([
            'title' => 'Kriter', 'donem_id' => $this->donem->id, 'kriter_turu' => 'sayi',
            'puan' => 10, 'hedef' => 2, 'durum' => 'active',
        ]);

        $adlar = array_column($this->rapor()['sube_bazli'], 'sube_adi');

        $this->assertSame(['Aktif Sube'], $adlar);
    }

    public function test_uye_sayisi_eksik_subeler_uyari_olarak_doner(): void
    {
        Sube::create(['name' => 'Uye Sayisi Var', 'status' => 'active', 'uye_sayisi' => 200]);
        Sube::create(['name' => 'Uye Sayisi Yok', 'status' => 'active', 'uye_sayisi' => 0]);

        Faaliyet::create([
            'title' => 'Uye ziyareti', 'donem_id' => $this->donem->id, 'kriter_turu' => 'oran',
            'puan' => 30, 'hedef' => 20, 'durum' => 'active',
        ]);

        $uyarilar = $this->rapor()['genel']['uye_sayisi_eksik'];

        $this->assertSame(['Uye Sayisi Yok'], array_column($uyarilar, 'sube_adi'));
    }

    public function test_oran_kriteri_yoksa_uye_sayisi_uyarisi_verilmez(): void
    {
        Sube::create(['name' => 'Uye Sayisi Yok', 'status' => 'active', 'uye_sayisi' => 0]);

        Faaliyet::create([
            'title' => 'Sayi kriteri', 'donem_id' => $this->donem->id, 'kriter_turu' => 'sayi',
            'puan' => 10, 'hedef' => 2, 'durum' => 'active',
        ]);

        $this->assertSame([], $this->rapor()['genel']['uye_sayisi_eksik']);
    }

    public function test_pasif_kriter_uye_sayisi_uyarisini_tetiklemez(): void
    {
        Sube::create(['name' => 'Uye Sayisi Yok', 'status' => 'active', 'uye_sayisi' => 0]);

        Faaliyet::create([
            'title' => 'Kaldirilan oran kriteri', 'donem_id' => $this->donem->id, 'kriter_turu' => 'oran',
            'puan' => 30, 'hedef' => 20, 'durum' => 'passive',
        ]);

        $this->assertSame([], $this->rapor()['genel']['uye_sayisi_eksik']);
    }

    public function test_sube_puan_ozeti_rapordaki_puanla_ayni_ciker(): void
    {
        $sube = Sube::create(['name' => 'Karsilastirma Subesi', 'status' => 'active', 'uye_sayisi' => 100]);

        $sayi = Faaliyet::create([
            'title' => 'Sayi', 'donem_id' => $this->donem->id, 'kriter_turu' => 'sayi',
            'puan' => 10, 'hedef' => 3, 'durum' => 'active',
        ]);
        $oran = Faaliyet::create([
            'title' => 'Oran', 'donem_id' => $this->donem->id, 'kriter_turu' => 'oran',
            'puan' => 30, 'hedef' => 20, 'durum' => 'active',
        ]);

        $this->kayitEkle($sayi, $sube, 2);
        $this->kayitEkle($oran, $sube, 10);

        $raporPuani = collect($this->rapor()['sube_bazli'])
            ->firstWhere('sube_id', $sube->id)['toplam_puan'];

        $ozetPuani = $this->getJson("/api/subeler/{$sube->id}/puan-ozeti?donem_id={$this->donem->id}")
            ->assertOk()
            ->json('toplam_puan');

        $this->assertSame($raporPuani, $ozetPuani);
    }
}
