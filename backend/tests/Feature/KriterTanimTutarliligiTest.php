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
 * Eksik tanımlanmış bir kriter sessizce sıfır puan üretir ve bu ancak dönem
 * sonunda fark edilir. En sık kullanılan tür olan "sayı" bu denetimin dışında
 * kalmıştı: hedefi sıfır bırakılan kriter hem puan hem tavan olarak sıfır
 * çıkıyor, yani rapora hiç yansımadan görünmez oluyordu.
 */
class KriterTanimTutarliligiTest extends TestCase
{
    use RefreshDatabase;

    private Donem $donem;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create(['role' => 'superadmin']));

        $start = now()->startOfMonth();

        $this->donem = Donem::create([
            'name'        => 'Kriter Tanim Donemi',
            'start_date'  => $start,
            'end_date'    => $start->copy()->endOfMonth(),
            'status'      => 'active',
            'tum_subeler' => true,
        ]);
    }

    private function olustur(array $ozellikler = [])
    {
        return $this->postJson('/api/faaliyetler', array_merge([
            'title'       => 'Sayi kriteri',
            'donem_id'    => $this->donem->id,
            'kriter_turu' => 'sayi',
            'puan'        => 10,
            'hedef'       => 3,
        ], $ozellikler));
    }

    public function test_sayi_kriteri_hedefsiz_olusturulamaz(): void
    {
        $this->olustur(['hedef' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors('hedef');

        $this->assertSame(0, Faaliyet::count());
    }

    public function test_sayi_kriteri_hedef_alani_hic_gonderilmezse_de_reddedilir(): void
    {
        $this->postJson('/api/faaliyetler', [
            'title'       => 'Hedefsiz',
            'donem_id'    => $this->donem->id,
            'kriter_turu' => 'sayi',
            'puan'        => 10,
        ])->assertStatus(422)->assertJsonValidationErrors('hedef');
    }

    public function test_sayi_kriteri_puansiz_olusturulamaz(): void
    {
        $this->olustur(['puan' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors('puan');
    }

    public function test_gecerli_sayi_kriteri_olusturulur(): void
    {
        $this->olustur()->assertCreated();

        $faaliyet = Faaliyet::firstOrFail();

        $this->assertSame(10, $faaliyet->puan);
        $this->assertSame(3, $faaliyet->hedef);
        $this->assertSame(30, $faaliyet->max_puan);
    }

    public function test_kriter_turu_belirtilmezse_sayi_kurallari_uygulanir(): void
    {
        $this->postJson('/api/faaliyetler', [
            'title'    => 'Turu belirtilmemis',
            'donem_id' => $this->donem->id,
            'puan'     => 5,
        ])->assertStatus(422)->assertJsonValidationErrors('hedef');
    }

    public function test_puanlamaya_dokunmayan_guncelleme_eski_kriteri_kilitlemez(): void
    {
        // Kural sıkılaşmadan önce oluşmuş, hedefi sıfır kalmış bir kriter.
        $eski = Faaliyet::create([
            'title'       => 'Eski kriter',
            'donem_id'    => $this->donem->id,
            'kriter_turu' => 'sayi',
            'puan'        => 0,
            'hedef'       => 0,
            'durum'       => 'active',
        ]);

        $sube = Sube::create(['name' => 'Sube', 'status' => 'active']);
        $ay = DonemAy::create([
            'donem_id'   => $this->donem->id,
            'sira'       => 1,
            'name'       => 'Ay 1',
            'start_date' => $this->donem->start_date,
            'end_date'   => $this->donem->end_date,
        ]);
        FaaliyetKayit::create([
            'faaliyet_id' => $eski->id,
            'sube_id'     => $sube->id,
            'donem_ay_id' => $ay->id,
        ]);

        // Puan ve hedef kaydı olan faaliyette zaten kilitli; başlık düzeltmek
        // yine de mümkün olmalı.
        $this->putJson("/api/faaliyetler/{$eski->id}", ['title' => 'Duzeltilmis baslik'])
            ->assertOk();

        $this->assertSame('Duzeltilmis baslik', $eski->fresh()->title);
    }

    public function test_puanlamaya_dokunan_guncelleme_denetlenir(): void
    {
        $faaliyet = Faaliyet::create([
            'title'       => 'Kayitsiz kriter',
            'donem_id'    => $this->donem->id,
            'kriter_turu' => 'sayi',
            'puan'        => 10,
            'hedef'       => 2,
            'durum'       => 'active',
        ]);

        $this->putJson("/api/faaliyetler/{$faaliyet->id}", ['hedef' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors('hedef');

        $this->assertSame(2, $faaliyet->fresh()->hedef);
    }
}
