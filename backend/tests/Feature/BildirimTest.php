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
use App\Notifications\SistemBildirimi;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Uygulama içi bildirimler: akışın iki tarafı da karşı tarafın ne yaptığını
 * uygulamaya girmeden değil, girdiğinde çan ikonundan görür.
 *
 * Bildirimlerin kapsamı da veri kapsamı kadar önemli: bir şube başka şubenin
 * gönderimine dair bildirim almamalı, birim yöneticisi de başka birimin
 * dönemine dair bildirim almamalı.
 */
class BildirimTest extends TestCase
{
    use RefreshDatabase;

    private Birim $teskilat;
    private Birim $genc;
    private Sube $ankara;
    private Sube $izmir;
    private User $superadmin;
    private User $teskilatYoneticisi;
    private User $gencYoneticisi;
    private User $ankaraYoneticisi;
    private User $izmirYoneticisi;
    private Donem $donem;
    private DonemAy $ay;
    private Faaliyet $faaliyet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teskilat = Birim::create(['name' => 'Teşkilatlanma', 'status' => 'active']);
        $this->genc = Birim::create(['name' => 'GENÇ MÜSİAD', 'status' => 'active']);

        $this->ankara = Sube::create(['name' => 'MÜSİAD Ankara', 'status' => 'active', 'uye_sayisi' => 100]);
        $this->izmir = Sube::create(['name' => 'MÜSİAD İzmir', 'status' => 'active', 'uye_sayisi' => 100]);

        $this->superadmin = User::factory()->create(['role' => 'superadmin']);
        $this->teskilatYoneticisi = User::factory()->create([
            'role' => 'birim_yoneticisi', 'birim_id' => $this->teskilat->id,
        ]);
        $this->gencYoneticisi = User::factory()->create([
            'role' => 'birim_yoneticisi', 'birim_id' => $this->genc->id,
        ]);
        $this->ankaraYoneticisi = User::factory()->create([
            'role' => 'sube_yoneticisi', 'sube_id' => $this->ankara->id,
        ]);
        $this->izmirYoneticisi = User::factory()->create([
            'role' => 'sube_yoneticisi', 'sube_id' => $this->izmir->id,
        ]);

        $start = now()->startOfMonth();

        $this->donem = Donem::create([
            'name' => 'Bildirim Donemi', 'birim_id' => $this->teskilat->id,
            'start_date' => $start, 'end_date' => $start->copy()->endOfMonth(),
            'status' => 'active', 'tum_subeler' => true,
        ]);

        $this->ay = DonemAy::create([
            'donem_id' => $this->donem->id, 'sira' => 1, 'name' => 'Ay 1',
            'start_date' => $start, 'end_date' => $start->copy()->endOfMonth(),
        ]);

        $this->faaliyet = Faaliyet::create([
            'title' => 'Kriter', 'donem_id' => $this->donem->id, 'kriter_turu' => 'sayi',
            'puan' => 10, 'hedef' => 2, 'durum' => 'active',
        ]);

        FaaliyetKayit::create([
            'faaliyet_id' => $this->faaliyet->id, 'sube_id' => $this->ankara->id,
            'donem_ay_id' => $this->ay->id,
        ]);
    }

    private function gonder(): AyGonderim
    {
        Sanctum::actingAs($this->ankaraYoneticisi);
        $this->postJson("/api/donem-aylar/{$this->ay->id}/gonder")->assertSuccessful();

        return AyGonderim::firstOrFail();
    }

    /** @return array<int, string> */
    private function turler(User $user): array
    {
        return $user->notifications()->get()->map(fn ($b) => $b->data['tur'])->all();
    }

    // ─── Şube → merkez ────────────────────────────────────────────────────────

    public function test_ay_gonderilince_merkez_bildirim_alir(): void
    {
        $this->gonder();

        $this->assertContains(SistemBildirimi::AY_GONDERILDI, $this->turler($this->teskilatYoneticisi));
        $this->assertContains(SistemBildirimi::AY_GONDERILDI, $this->turler($this->superadmin));

        $bildirim = $this->teskilatYoneticisi->notifications()->firstOrFail();
        $this->assertStringContainsString('MÜSİAD Ankara', $bildirim->data['baslik']);
        $this->assertSame('gonderimler', $bildirim->data['sayfa']);
    }

    public function test_baska_birimin_yoneticisi_gonderim_bildirimi_almaz(): void
    {
        $this->gonder();

        $this->assertSame([], $this->turler($this->gencYoneticisi));
    }

    public function test_gonderen_sube_kendi_gonderimi_icin_bildirim_almaz(): void
    {
        $this->gonder();

        $this->assertSame([], $this->turler($this->ankaraYoneticisi));
    }

    // ─── Merkez → şube ────────────────────────────────────────────────────────

    public function test_onaylaninca_sube_bildirim_alir(): void
    {
        $gonderim = $this->gonder();

        Sanctum::actingAs($this->superadmin);
        $this->postJson("/api/gonderimler/{$gonderim->id}/onayla")->assertSuccessful();

        $this->assertContains(SistemBildirimi::ONAYLANDI, $this->turler($this->ankaraYoneticisi));
        $this->assertSame([], $this->turler($this->izmirYoneticisi));
    }

    public function test_duzeltme_istenince_sube_merkez_notunu_bildirimde_gorur(): void
    {
        $gonderim = $this->gonder();

        Sanctum::actingAs($this->superadmin);
        $this->postJson("/api/gonderimler/{$gonderim->id}/duzeltme-iste", [
            'merkez_notu' => 'Ziyaret tarihleri eksik.',
        ])->assertSuccessful();

        $bildirim = $this->ankaraYoneticisi->notifications()->firstOrFail();

        $this->assertSame(SistemBildirimi::DUZELTME_ISTENDI, $bildirim->data['tur']);
        $this->assertStringContainsString('Ziyaret tarihleri eksik.', $bildirim->data['mesaj']);
        $this->assertSame('faaliyetlerim', $bildirim->data['sayfa']);
    }

    public function test_donem_aktiflesince_kapsamdaki_subeler_bildirim_alir(): void
    {
        $start = now()->startOfMonth()->addYear();

        $yeni = Donem::create([
            'name' => 'Gelecek Donem', 'birim_id' => $this->genc->id,
            'start_date' => $start, 'end_date' => $start->copy()->endOfMonth(),
            'status' => 'pending', 'tum_subeler' => true,
        ]);

        Sanctum::actingAs($this->superadmin);
        $this->postJson("/api/donemler/{$yeni->id}/activate")->assertSuccessful();

        $this->assertContains(SistemBildirimi::DONEM_ACILDI, $this->turler($this->ankaraYoneticisi));
        $this->assertContains(SistemBildirimi::DONEM_ACILDI, $this->turler($this->izmirYoneticisi));

        // Dönemi açan merkez kendine bildirim göndermez.
        $this->assertSame([], $this->turler($this->superadmin));
    }

    public function test_secili_subeli_donemde_kapsam_disi_sube_bildirim_almaz(): void
    {
        $start = now()->startOfMonth()->addYear();

        $yeni = Donem::create([
            'name' => 'Secili Subeli Donem', 'birim_id' => $this->genc->id,
            'start_date' => $start, 'end_date' => $start->copy()->endOfMonth(),
            'status' => 'pending', 'tum_subeler' => false,
        ]);
        $yeni->subeler()->sync([$this->ankara->id]);

        Sanctum::actingAs($this->superadmin);
        $this->postJson("/api/donemler/{$yeni->id}/activate")->assertSuccessful();

        $this->assertContains(SistemBildirimi::DONEM_ACILDI, $this->turler($this->ankaraYoneticisi));
        $this->assertSame([], $this->turler($this->izmirYoneticisi));
    }

    // ─── Okuma uçları ─────────────────────────────────────────────────────────

    public function test_kullanici_yalnizca_kendi_bildirimlerini_gorur(): void
    {
        $this->gonder();

        Sanctum::actingAs($this->teskilatYoneticisi);
        $merkez = $this->getJson('/api/bildirimler')->assertOk()->json();

        $this->assertSame(1, $merkez['okunmamis']);
        $this->assertCount(1, $merkez['liste']);

        Sanctum::actingAs($this->izmirYoneticisi);
        $bos = $this->getJson('/api/bildirimler')->assertOk()->json();

        $this->assertSame(0, $bos['okunmamis']);
        $this->assertSame([], $bos['liste']);
    }

    public function test_bildirim_okundu_isaretlenir(): void
    {
        $this->gonder();

        Sanctum::actingAs($this->teskilatYoneticisi);
        $id = $this->getJson('/api/bildirimler')->json('liste.0.id');

        $this->postJson("/api/bildirimler/{$id}/okundu")
            ->assertOk()
            ->assertJsonPath('okunmamis', 0);

        $this->assertTrue($this->getJson('/api/bildirimler')->json('liste.0.okundu'));
    }

    public function test_baskasinin_bildirimi_okundu_isaretlenemez(): void
    {
        $this->gonder();

        $id = $this->teskilatYoneticisi->notifications()->firstOrFail()->id;

        Sanctum::actingAs($this->izmirYoneticisi);
        $this->postJson("/api/bildirimler/{$id}/okundu")->assertNotFound();

        $this->assertNull($this->teskilatYoneticisi->notifications()->firstOrFail()->read_at);
    }

    public function test_tumu_okundu_isaretlenir(): void
    {
        $gonderim = $this->gonder();

        Sanctum::actingAs($this->superadmin);
        $this->postJson("/api/gonderimler/{$gonderim->id}/duzeltme-iste", [
            'merkez_notu' => 'Eksik var, tamamlayin.',
        ])->assertSuccessful();
        $this->gonder();

        Sanctum::actingAs($this->teskilatYoneticisi);
        $this->assertSame(2, $this->getJson('/api/bildirimler')->json('okunmamis'));

        $this->postJson('/api/bildirimler/okundu')->assertOk()->assertJsonPath('okunmamis', 0);
        $this->assertSame(0, $this->getJson('/api/bildirimler')->json('okunmamis'));
    }

    public function test_bildirim_ucu_giris_gerektirir(): void
    {
        $this->getJson('/api/bildirimler')->assertUnauthorized();
    }
}
