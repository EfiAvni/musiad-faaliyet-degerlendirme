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
 * Veri modeli: şubeler tüm birimler için ortaktır (MÜSİAD Ankara hem
 * Teşkilatlanma'nın hem GENÇ'in şubesidir), ayrışma dönem seviyesinde olur.
 *
 *   Birim yöneticisi : tüm şubeler, yalnızca kendi biriminin dönemleri
 *   Şube yöneticisi  : tüm birimlerin dönemleri, yalnızca kendi şubesinin kayıtları
 */
class BirimKapsamiTest extends TestCase
{
    use RefreshDatabase;

    private Birim $teskilat;
    private Birim $genc;
    private Sube $ankara;
    private Sube $izmir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teskilat = Birim::create(['name' => 'Teşkilatlanma', 'status' => 'active']);
        $this->genc = Birim::create(['name' => 'GENÇ MÜSİAD', 'status' => 'active']);

        $this->ankara = Sube::create(['name' => 'MÜSİAD Ankara', 'uye_sayisi' => 10, 'status' => 'active']);
        $this->izmir = Sube::create(['name' => 'MÜSİAD İzmir', 'uye_sayisi' => 20, 'status' => 'active']);
    }

    private function teskilatYoneticisi(): User
    {
        return User::factory()->create(['role' => 'birim_yoneticisi', 'birim_id' => $this->teskilat->id]);
    }

    private function ankaraYoneticisi(): User
    {
        return User::factory()->create(['role' => 'sube_yoneticisi', 'sube_id' => $this->ankara->id]);
    }

    private function donem(Birim $birim, string $ad, string $durum = 'active'): Donem
    {
        return Donem::create([
            'name'        => $ad,
            'birim_id'    => $birim->id,
            'start_date'  => now()->startOfMonth(),
            'end_date'    => now()->endOfMonth(),
            'status'      => $durum,
            'tum_subeler' => true,
        ]);
    }

    private function ay(Donem $donem): DonemAy
    {
        return DonemAy::create([
            'donem_id' => $donem->id, 'sira' => 1, 'name' => 'Ay',
            'start_date' => now()->startOfMonth(), 'end_date' => now()->endOfMonth(),
        ]);
    }

    private function faaliyet(Donem $donem, string $baslik = 'Üye Ziyareti'): Faaliyet
    {
        return Faaliyet::create([
            'title' => $baslik, 'puan' => 10, 'hedef' => 5,
            'tarih_gerekli' => false, 'donem_id' => $donem->id, 'durum' => 'active',
        ]);
    }

    // ─── Şubeler ortak ────────────────────────────────────────────────────────

    public function test_subeler_tum_birimler_icin_ortaktir(): void
    {
        Sanctum::actingAs($this->teskilatYoneticisi());
        $this->getJson('/api/subeler')->assertOk()->assertJsonCount(2);

        Sanctum::actingAs(User::factory()->create(['role' => 'birim_yoneticisi', 'birim_id' => $this->genc->id]));
        $this->getJson('/api/subeler')->assertOk()->assertJsonCount(2);

        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));
        $this->getJson('/api/subeler')->assertOk()->assertJsonCount(2);
    }

    // ─── Dönem kapsamı ────────────────────────────────────────────────────────

    public function test_birim_yoneticisi_yalnizca_kendi_biriminin_donemlerini_gorur(): void
    {
        $this->donem($this->teskilat, 'Teşkilat 2026');
        $this->donem($this->genc, 'GENÇ 2026');

        Sanctum::actingAs($this->teskilatYoneticisi());

        $this->getJson('/api/donemler')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Teşkilat 2026');
    }

    public function test_sube_yoneticisi_tum_birimlerin_donemlerini_gorur(): void
    {
        $this->donem($this->teskilat, 'Teşkilat 2026');
        $this->donem($this->genc, 'GENÇ 2026');

        Sanctum::actingAs($this->ankaraYoneticisi());

        $this->getJson('/api/donemler')->assertOk()->assertJsonCount(2);
    }

    public function test_birimsiz_birim_yoneticisi_hicbir_donem_gormez(): void
    {
        $this->donem($this->teskilat, 'Teşkilat 2026');

        Sanctum::actingAs(User::factory()->create(['role' => 'birim_yoneticisi', 'birim_id' => null]));

        $this->getJson('/api/donemler')->assertOk()->assertJsonCount(0);
    }

    public function test_baska_birimin_donemi_goruntulenemez_ve_yonetilemez(): void
    {
        $gencDonem = $this->donem($this->genc, 'GENÇ 2026', 'pending');

        Sanctum::actingAs($this->teskilatYoneticisi());

        $this->getJson("/api/donemler/{$gencDonem->id}")->assertStatus(403);
        $this->putJson("/api/donemler/{$gencDonem->id}", ['name' => 'Ele Geçirildi'])->assertStatus(403);
        $this->postJson("/api/donemler/{$gencDonem->id}/activate")->assertStatus(403);
        $this->deleteJson("/api/donemler/{$gencDonem->id}")->assertStatus(403);

        $this->assertSame('GENÇ 2026', $gencDonem->fresh()->name);
    }

    public function test_birim_yoneticisi_baska_birime_donem_acamaz(): void
    {
        Sanctum::actingAs($this->teskilatYoneticisi());

        $this->postJson('/api/donemler', [
            'name' => 'Kaçak Dönem', 'birim_id' => $this->genc->id,
            'start_date' => '2026-01-01', 'end_date' => '2026-03-31',
        ])->assertStatus(403);
    }

    public function test_birim_belirtilmeden_acilan_donem_kendi_birimine_dusar(): void
    {
        Sanctum::actingAs($this->teskilatYoneticisi());

        $this->postJson('/api/donemler', [
            'name' => 'Yeni Dönem', 'start_date' => '2026-01-01', 'end_date' => '2026-03-31',
        ])->assertCreated()->assertJsonPath('birim_id', $this->teskilat->id);
    }

    public function test_superadmin_donem_acarken_birim_secmek_zorunda(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $this->postJson('/api/donemler', [
            'name' => 'Birimsiz Dönem', 'start_date' => '2026-01-01', 'end_date' => '2026-03-31',
        ])->assertStatus(422)->assertJsonValidationErrors('birim_id');
    }

    public function test_her_birim_kendi_aktif_donemine_sahip_olabilir(): void
    {
        $teskilatDonem = $this->donem($this->teskilat, 'Teşkilat 2026', 'pending');
        $gencDonem = $this->donem($this->genc, 'GENÇ 2026', 'pending');

        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $this->postJson("/api/donemler/{$teskilatDonem->id}/activate")->assertOk();
        $this->postJson("/api/donemler/{$gencDonem->id}/activate")->assertOk();
    }

    public function test_ayni_birimde_ikinci_donem_aktif_edilemez(): void
    {
        $this->donem($this->teskilat, 'Zaten Aktif', 'active');
        $ikinci = $this->donem($this->teskilat, 'İkinci Dönem', 'pending');

        Sanctum::actingAs($this->teskilatYoneticisi());

        $this->postJson("/api/donemler/{$ikinci->id}/activate")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    // ─── Faaliyetler ──────────────────────────────────────────────────────────

    public function test_faaliyetler_donem_birimine_gore_suzulur(): void
    {
        $this->faaliyet($this->donem($this->teskilat, 'Teşkilat 2026'), 'Teşkilat Faaliyeti');
        $this->faaliyet($this->donem($this->genc, 'GENÇ 2026'), 'GENÇ Faaliyeti');

        Sanctum::actingAs($this->teskilatYoneticisi());

        $this->getJson('/api/faaliyetler')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.title', 'Teşkilat Faaliyeti');
    }

    public function test_sube_yoneticisi_tum_birimlerin_faaliyetlerini_gorur(): void
    {
        $this->faaliyet($this->donem($this->teskilat, 'Teşkilat 2026'), 'Teşkilat Faaliyeti');
        $this->faaliyet($this->donem($this->genc, 'GENÇ 2026'), 'GENÇ Faaliyeti');

        Sanctum::actingAs($this->ankaraYoneticisi());

        $this->getJson('/api/faaliyetler')->assertOk()->assertJsonCount(2);
    }

    public function test_baska_birimin_donemine_faaliyet_eklenemez(): void
    {
        $gencDonem = $this->donem($this->genc, 'GENÇ 2026');

        Sanctum::actingAs($this->teskilatYoneticisi());

        $this->postJson('/api/faaliyetler', [
            'title' => 'Kaçak Faaliyet', 'donem_id' => $gencDonem->id,
        ])->assertStatus(403);
    }

    // ─── Kayıtlar ─────────────────────────────────────────────────────────────

    public function test_sube_yoneticisi_tum_birimlerdeki_kendi_kayitlarini_gorur(): void
    {
        foreach ([$this->teskilat, $this->genc] as $birim) {
            $donem = $this->donem($birim, "Dönem {$birim->id}");
            FaaliyetKayit::create([
                'faaliyet_id' => $this->faaliyet($donem)->id, 'sube_id' => $this->ankara->id,
                'donem_ay_id' => $this->ay($donem)->id, 'deger' => '1',
            ]);
        }

        // Başka şubenin kaydı görünmemeli.
        $baskaDonem = $this->donem($this->teskilat, 'Diğer');
        FaaliyetKayit::create([
            'faaliyet_id' => $this->faaliyet($baskaDonem)->id, 'sube_id' => $this->izmir->id,
            'donem_ay_id' => $this->ay($baskaDonem)->id, 'deger' => '1',
        ]);

        Sanctum::actingAs($this->ankaraYoneticisi());

        $this->getJson('/api/faaliyet-kayitlari')->assertOk()->assertJsonCount(2);
    }

    public function test_birim_yoneticisi_tum_subeleri_ama_yalnizca_kendi_birimini_gorur(): void
    {
        $teskilatDonem = $this->donem($this->teskilat, 'Teşkilat 2026');
        $teskilatFaaliyet = $this->faaliyet($teskilatDonem);
        $teskilatAy = $this->ay($teskilatDonem);

        foreach ([$this->ankara, $this->izmir] as $sube) {
            FaaliyetKayit::create([
                'faaliyet_id' => $teskilatFaaliyet->id, 'sube_id' => $sube->id,
                'donem_ay_id' => $teskilatAy->id, 'deger' => '1',
            ]);
        }

        $gencDonem = $this->donem($this->genc, 'GENÇ 2026');
        FaaliyetKayit::create([
            'faaliyet_id' => $this->faaliyet($gencDonem)->id, 'sube_id' => $this->ankara->id,
            'donem_ay_id' => $this->ay($gencDonem)->id, 'deger' => '1',
        ]);

        Sanctum::actingAs($this->teskilatYoneticisi());

        // İki şube × Teşkilatlanma; GENÇ kaydı gelmemeli.
        $this->getJson('/api/faaliyet-kayitlari')->assertOk()->assertJsonCount(2);
    }

    // ─── Rapor ve dönem ayı ───────────────────────────────────────────────────

    public function test_baska_birimin_raporu_alinamaz(): void
    {
        $teskilatDonem = $this->donem($this->teskilat, 'Teşkilat 2026');
        $gencDonem = $this->donem($this->genc, 'GENÇ 2026');

        Sanctum::actingAs($this->teskilatYoneticisi());

        $this->getJson("/api/raporlar/{$gencDonem->id}")->assertStatus(403);
        $this->getJson("/api/raporlar/{$teskilatDonem->id}")->assertOk();
    }

    public function test_baska_birimin_donem_ayi_acilip_kapatilamaz(): void
    {
        $gencAy = $this->ay($this->donem($this->genc, 'GENÇ 2026'));
        $teskilatAy = $this->ay($this->donem($this->teskilat, 'Teşkilat 2026'));

        Sanctum::actingAs($this->teskilatYoneticisi());

        $this->patchJson("/api/donem-aylar/{$gencAy->id}", ['acik_override' => true])->assertStatus(403);
        $this->patchJson("/api/donem-aylar/{$teskilatAy->id}", ['acik_override' => true])->assertOk();

        $this->assertNull($gencAy->fresh()->acik_override);
    }
}
