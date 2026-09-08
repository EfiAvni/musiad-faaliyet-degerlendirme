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
 * Kaydın hangi aya yazıldığı tahmin edilmez.
 *
 * Önceden ay hiç sorulmuyor, "sıradaki ilk açık ay" seçiliyordu. Birim
 * yöneticisi acik_override ile iki ayı birden açtığında kayıtlar sessizce
 * yanlış aya gidiyordu.
 */
class KayitAySecimiTest extends TestCase
{
    use RefreshDatabase;

    private Donem $donem;
    private Sube $sube;
    private Faaliyet $faaliyet;

    protected function setUp(): void
    {
        parent::setUp();

        $start = now()->startOfMonth();

        $this->donem = Donem::create([
            'name'        => 'Ay Secimi Donemi',
            'start_date'  => $start,
            'end_date'    => $start->copy()->addMonth()->endOfMonth(),
            'status'      => 'active',
            'tum_subeler' => true,
        ]);

        $this->sube = Sube::create(['name' => 'Ay Secimi Subesi', 'status' => 'active', 'uye_sayisi' => 50]);

        $this->faaliyet = Faaliyet::create([
            'title'       => 'Kriter',
            'donem_id'    => $this->donem->id,
            'kriter_turu' => 'sayi',
            'puan'        => 10,
            'hedef'       => 3,
            'durum'       => 'active',
        ]);

        Sanctum::actingAs(User::factory()->create([
            'role'    => 'sube_yoneticisi',
            'sube_id' => $this->sube->id,
        ]));
    }

    /** Tarih aralığına göre kapalı, yalnızca acik_override ile açılabilen ay. */
    private function ay(int $sira, ?bool $acikOverride = null): DonemAy
    {
        $baslangic = now()->startOfMonth()->addMonths($sira - 1);

        return DonemAy::create([
            'donem_id'      => $this->donem->id,
            'sira'          => $sira,
            'name'          => "Ay {$sira}",
            'start_date'    => $baslangic,
            'end_date'      => $baslangic->copy()->endOfMonth(),
            'acik_override' => $acikOverride,
        ]);
    }

    private function kayitEkle(array $ekAlanlar = [])
    {
        return $this->postJson('/api/faaliyet-kayitlari', array_merge([
            'faaliyet_id' => $this->faaliyet->id,
            'deger'       => '1',
        ], $ekAlanlar));
    }

    public function test_tek_acik_ay_varsa_ay_belirtmeye_gerek_yok(): void
    {
        $ay = $this->ay(1, true);
        $this->ay(2, false);

        $this->kayitEkle()->assertCreated();

        $this->assertSame($ay->id, FaaliyetKayit::firstOrFail()->donem_ay_id);
    }

    public function test_birden_fazla_ay_acikken_ay_belirtilmeden_kayit_reddedilir(): void
    {
        $this->ay(1, true);
        $this->ay(2, true);

        $this->kayitEkle()
            ->assertStatus(422)
            ->assertJsonValidationErrors('donem_ay_id');

        $this->assertSame(0, FaaliyetKayit::count());
    }

    public function test_birden_fazla_ay_acikken_secilen_aya_yazilir(): void
    {
        $this->ay(1, true);
        $ikinci = $this->ay(2, true);

        $this->kayitEkle(['donem_ay_id' => $ikinci->id])->assertCreated();

        $this->assertSame($ikinci->id, FaaliyetKayit::firstOrFail()->donem_ay_id);
    }

    public function test_kapali_ay_secilemez(): void
    {
        $this->ay(1, true);
        $kapali = $this->ay(2, false);

        $this->kayitEkle(['donem_ay_id' => $kapali->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('donem_ay_id');
    }

    public function test_baska_donemin_ayi_secilemez(): void
    {
        $this->ay(1, true);

        $baskaDonem = Donem::create([
            'name'        => 'Baska Donem',
            'start_date'  => now()->startOfMonth(),
            'end_date'    => now()->endOfMonth(),
            'status'      => 'active',
            'tum_subeler' => true,
        ]);

        $yabanciAy = DonemAy::create([
            'donem_id'      => $baskaDonem->id,
            'sira'          => 1,
            'name'          => 'Yabanci Ay',
            'start_date'    => now()->startOfMonth(),
            'end_date'      => now()->endOfMonth(),
            'acik_override' => true,
        ]);

        $this->kayitEkle(['donem_ay_id' => $yabanciAy->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('donem_ay_id');
    }

    public function test_hic_acik_ay_yoksa_kayit_eklenemez(): void
    {
        $this->ay(1, false);

        $this->kayitEkle()
            ->assertStatus(422)
            ->assertJsonValidationErrors('donem_ay_id');
    }
}
