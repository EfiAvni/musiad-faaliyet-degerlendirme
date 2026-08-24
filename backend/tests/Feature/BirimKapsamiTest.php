<?php

namespace Tests\Feature;

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
 * Rol kontrolü hangi uç noktanın çağrılabileceğini belirler; bu testler hangi
 * KAYITLARIN görülebileceğini doğrular. İkisi ayrı olduğu için birim yöneticisi
 * eskiden tüm birimlerin şubelerini görebiliyordu.
 */
class BirimKapsamiTest extends TestCase
{
    use RefreshDatabase;

    private Birim $birimA;
    private Birim $birimB;
    private Sube $subeA;
    private Sube $subeB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->birimA = Birim::create(['name' => 'Teşkilatlanma', 'status' => 'active']);
        $this->birimB = Birim::create(['name' => 'GENÇ MÜSİAD', 'status' => 'active']);

        $this->subeA = Sube::create(['name' => 'Ankara Şubesi', 'birim_id' => $this->birimA->id, 'uye_sayisi' => 10, 'status' => 'active']);
        $this->subeB = Sube::create(['name' => 'İzmir Şubesi', 'birim_id' => $this->birimB->id, 'uye_sayisi' => 20, 'status' => 'active']);
    }

    private function yoneticiA(): User
    {
        return User::factory()->create(['role' => 'birim_yoneticisi', 'birim_id' => $this->birimA->id]);
    }

    private function kayitOlustur(Sube $sube): FaaliyetKayit
    {
        $donem = Donem::create([
            'name' => 'Dönem ' . $sube->id, 'start_date' => now()->startOfMonth(),
            'end_date' => now()->endOfMonth(), 'status' => 'active', 'tum_subeler' => true,
        ]);
        $ay = DonemAy::create([
            'donem_id' => $donem->id, 'sira' => 1, 'name' => 'Ay',
            'start_date' => now()->startOfMonth(), 'end_date' => now()->endOfMonth(),
        ]);
        $faaliyet = Faaliyet::create([
            'title' => 'Faaliyet', 'puan' => 10, 'hedef' => 1,
            'tarih_gerekli' => false, 'donem_id' => $donem->id, 'durum' => 'active',
        ]);

        return FaaliyetKayit::create([
            'faaliyet_id' => $faaliyet->id, 'sube_id' => $sube->id,
            'donem_ay_id' => $ay->id, 'deger' => '1',
        ]);
    }

    public function test_birim_yoneticisi_yalnizca_kendi_biriminin_subelerini_gorur(): void
    {
        Sanctum::actingAs($this->yoneticiA());

        $this->getJson('/api/subeler')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Ankara Şubesi');
    }

    public function test_superadmin_tum_subeleri_gorur(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $this->getJson('/api/subeler')->assertOk()->assertJsonCount(2);
    }

    public function test_birimsiz_birim_yoneticisi_hicbir_sube_gormez(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'birim_yoneticisi', 'birim_id' => null]));

        $this->getJson('/api/subeler')->assertOk()->assertJsonCount(0);
    }

    public function test_baska_birimin_subesi_goruntulenemez(): void
    {
        Sanctum::actingAs($this->yoneticiA());

        $this->getJson("/api/subeler/{$this->subeB->id}")->assertStatus(403);
        $this->getJson("/api/subeler/{$this->subeA->id}")->assertOk();
    }

    public function test_baska_birimin_subesi_duzenlenemez_ve_silinemez(): void
    {
        Sanctum::actingAs($this->yoneticiA());

        $this->putJson("/api/subeler/{$this->subeB->id}", ['name' => 'Ele Geçirildi'])->assertStatus(403);
        $this->deleteJson("/api/subeler/{$this->subeB->id}")->assertStatus(403);

        $this->assertSame('İzmir Şubesi', $this->subeB->fresh()->name);
    }

    public function test_baska_birimin_puan_ozeti_alinamaz(): void
    {
        Sanctum::actingAs($this->yoneticiA());

        $this->getJson("/api/subeler/{$this->subeB->id}/puan-ozeti")->assertStatus(403);
        $this->getJson("/api/subeler/{$this->subeA->id}/puan-ozeti")->assertOk();
    }

    public function test_birim_yoneticisi_baska_birime_sube_tanimlayamaz(): void
    {
        Sanctum::actingAs($this->yoneticiA());

        $this->postJson('/api/subeler', [
            'name' => 'Kaçak Şube', 'birim_id' => $this->birimB->id,
        ])->assertStatus(403);
    }

    public function test_birim_belirtilmeden_acilan_sube_kendi_birimine_dusar(): void
    {
        Sanctum::actingAs($this->yoneticiA());

        $this->postJson('/api/subeler', ['name' => 'Yeni Şube'])
            ->assertCreated()
            ->assertJsonPath('birim_id', $this->birimA->id);
    }

    public function test_ice_aktarilan_subeler_kendi_birimine_baglanir(): void
    {
        Sanctum::actingAs($this->yoneticiA());

        $this->postJson('/api/subeler/import', [
            'subeler' => [['name' => 'Bursa Şubesi', 'uye_sayisi' => 5]],
        ])->assertOk();

        $this->assertSame($this->birimA->id, Sube::where('name', 'Bursa Şubesi')->value('birim_id'));
    }

    public function test_faaliyet_kayitlari_yalnizca_kendi_biriminden_gelir(): void
    {
        $kayitA = $this->kayitOlustur($this->subeA);
        $this->kayitOlustur($this->subeB);

        Sanctum::actingAs($this->yoneticiA());

        $this->getJson('/api/faaliyet-kayitlari')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $kayitA->id);
    }

    public function test_rapor_yalnizca_kendi_biriminin_subelerini_icerir(): void
    {
        $kayit = $this->kayitOlustur($this->subeA);
        $donemId = $kayit->faaliyet->donem_id;

        Sanctum::actingAs($this->yoneticiA());

        $this->getJson("/api/raporlar/{$donemId}")
            ->assertOk()
            ->assertJsonPath('genel.toplam_sube', 1)
            ->assertJsonPath('sube_bazli.0.sube_adi', 'Ankara Şubesi');
    }

    public function test_baska_birime_ozel_donemin_ayi_acilip_kapatilamaz(): void
    {
        $donem = Donem::create([
            'name' => 'B Birimi Dönemi', 'start_date' => now()->startOfMonth(),
            'end_date' => now()->endOfMonth(), 'status' => 'active', 'tum_subeler' => false,
        ]);
        $donem->subeler()->sync([$this->subeB->id]);

        $ay = DonemAy::create([
            'donem_id' => $donem->id, 'sira' => 1, 'name' => 'Ay',
            'start_date' => now()->startOfMonth(), 'end_date' => now()->endOfMonth(),
        ]);

        Sanctum::actingAs($this->yoneticiA());

        $this->patchJson("/api/donem-aylar/{$ay->id}", ['acik_override' => true])->assertStatus(403);
        $this->assertNull($ay->fresh()->acik_override);
    }

    public function test_tum_subeleri_kapsayan_donemin_ayi_her_birim_tarafindan_yonetilebilir(): void
    {
        $donem = Donem::create([
            'name' => 'Ortak Dönem', 'start_date' => now()->startOfMonth(),
            'end_date' => now()->endOfMonth(), 'status' => 'active', 'tum_subeler' => true,
        ]);
        $ay = DonemAy::create([
            'donem_id' => $donem->id, 'sira' => 1, 'name' => 'Ay',
            'start_date' => now()->startOfMonth(), 'end_date' => now()->endOfMonth(),
        ]);

        Sanctum::actingAs($this->yoneticiA());

        $this->patchJson("/api/donem-aylar/{$ay->id}", ['acik_override' => true])->assertOk();
    }
}
