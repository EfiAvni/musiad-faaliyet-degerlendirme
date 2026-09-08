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
 * Düzeltme sonrası yeniden gönderimde merkezin verdiği manuel puanlar düşer.
 *
 * Yeniden gönderim değerlendiren ve tarih bilgisini temizliyordu ama manuel
 * puan satırlarına dokunmuyordu: merkez düzeltme isteyip şube veriyi
 * değiştirdiğinde, artık geçerli olmayan bir aya ait puan raporda sessizce
 * geçerli kalıyordu.
 */
class YenidenGonderimTest extends TestCase
{
    use RefreshDatabase;

    private Donem $donem;
    private DonemAy $ay;
    private Sube $sube;
    private Faaliyet $manuel;
    private User $merkez;
    private User $subeYoneticisi;

    protected function setUp(): void
    {
        parent::setUp();

        $start = now()->startOfMonth();

        $this->donem = Donem::create([
            'name'        => 'Yeniden Gonderim Donemi',
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

        $this->sube = Sube::create(['name' => 'Gonderim Subesi', 'status' => 'active', 'uye_sayisi' => 100]);

        $this->manuel = Faaliyet::create([
            'title'       => 'Merkez degerlendirmesi',
            'donem_id'    => $this->donem->id,
            'kriter_turu' => 'manuel',
            'puan'        => 50,
            'hedef'       => 0,
            'durum'       => 'active',
        ]);

        $this->merkez = User::factory()->create(['role' => 'superadmin']);
        $this->subeYoneticisi = User::factory()->create([
            'role'    => 'sube_yoneticisi',
            'sube_id' => $this->sube->id,
        ]);

        FaaliyetKayit::create([
            'faaliyet_id' => $this->manuel->id,
            'sube_id'     => $this->sube->id,
            'donem_ay_id' => $this->ay->id,
        ]);
    }

    private function gonder(): void
    {
        Sanctum::actingAs($this->subeYoneticisi);
        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder")->assertSuccessful();
    }

    public function test_duzeltme_sonrasi_yeniden_gonderimde_manuel_puan_silinir(): void
    {
        $this->gonder();

        $gonderim = AyGonderim::firstOrFail();

        Sanctum::actingAs($this->merkez);
        $this->postJson("/api/gonderimler/{$gonderim->id}/puanla", [
            'faaliyet_id' => $this->manuel->id,
            'puan'        => 50,
        ])->assertSuccessful();

        $this->assertSame(50, $this->getJson("/api/raporlar/{$this->donem->id}")->json('sube_bazli.0.toplam_puan'));

        $this->postJson("/api/gonderimler/{$gonderim->id}/duzeltme-iste", [
            'merkez_notu' => 'Kayitlari gozden gecirin.',
        ])->assertSuccessful();

        // Şube düzeltip yeniden gönderir: merkezin eski puanı geçerliliğini yitirir.
        $this->gonder();

        $this->assertSame(0, FaaliyetDegerlendirme::where('ay_gonderim_id', $gonderim->id)->count());

        Sanctum::actingAs($this->merkez);
        $this->assertSame(0, $this->getJson("/api/raporlar/{$this->donem->id}")->json('sube_bazli.0.toplam_puan'));
    }

    public function test_merkez_yeniden_puanlayabilir(): void
    {
        $this->gonder();
        $gonderim = AyGonderim::firstOrFail();

        Sanctum::actingAs($this->merkez);
        $this->postJson("/api/gonderimler/{$gonderim->id}/puanla", [
            'faaliyet_id' => $this->manuel->id, 'puan' => 50,
        ])->assertSuccessful();
        $this->postJson("/api/gonderimler/{$gonderim->id}/duzeltme-iste", [
            'merkez_notu' => 'Eksik var.',
        ])->assertSuccessful();

        $this->gonder();

        Sanctum::actingAs($this->merkez);
        $this->postJson("/api/gonderimler/{$gonderim->id}/puanla", [
            'faaliyet_id' => $this->manuel->id, 'puan' => 20,
        ])->assertSuccessful();

        $this->assertSame(20, $this->getJson("/api/raporlar/{$this->donem->id}")->json('sube_bazli.0.toplam_puan'));
    }

    /**
     * Kayıt eklemek açık ay gerektirir, gönderim gerektirmez: ay kapandıktan
     * sonra geç gönderim mümkündür - yoksa unutulan bir ay merkeze hiç
     * ulaşamazdı. Kural yazılı olmadığı için burada sabitleniyor.
     */
    public function test_ay_kapandiktan_sonra_gec_gonderim_yapilabilir(): void
    {
        $this->ay->update(['acik_override' => false]);

        $this->gonder();

        $this->assertSame(AyGonderim::GONDERILDI, AyGonderim::firstOrFail()->durum);
    }

    /** Ay kapalıyken yeni kayıt yine de eklenemez. */
    public function test_kapali_aya_kayit_eklenemez(): void
    {
        $this->ay->update(['acik_override' => false]);

        Sanctum::actingAs($this->subeYoneticisi);

        $this->postJson('/api/faaliyet-kayitlari', [
            'faaliyet_id' => $this->manuel->id,
            'deger'       => '1',
        ])->assertStatus(422)->assertJsonValidationErrors('donem_ay_id');
    }
}
