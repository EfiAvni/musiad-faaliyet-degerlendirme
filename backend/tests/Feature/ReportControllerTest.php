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

class ReportControllerTest extends TestCase
{
    use RefreshDatabase;

    private function superadmin(): User
    {
        return User::factory()->create(['role' => 'superadmin']);
    }

    private function donemWithAyCount(int $ayCount): Donem
    {
        $start = now()->startOfMonth();
        $end = (clone $start)->addMonths($ayCount - 1)->endOfMonth();

        return Donem::create([
            'name'        => "Test Donem {$ayCount}",
            'start_date'  => $start,
            'end_date'    => $end,
            'status'      => 'active',
            'tum_subeler' => true,
        ]);
    }

    public function test_periyot_tipi_resolves_from_month_count(): void
    {
        $this->assertSame('monthly', $this->donemWithAyCount(1)->periyot_tipi);
        $this->assertSame('quarterly', $this->donemWithAyCount(3)->periyot_tipi);
        $this->assertSame('semi_annual', $this->donemWithAyCount(6)->periyot_tipi);
        $this->assertSame('annual', $this->donemWithAyCount(12)->periyot_tipi);
        $this->assertSame('custom', $this->donemWithAyCount(4)->periyot_tipi);
    }

    public function test_sube_faaliyet_matrisi_matches_seeded_records(): void
    {
        Sanctum::actingAs($this->superadmin());

        $donem = $this->donemWithAyCount(3);
        $ay = DonemAy::create([
            'donem_id'   => $donem->id,
            'sira'       => 1,
            'name'       => 'Ay 1',
            'start_date' => $donem->start_date,
            'end_date'   => $donem->start_date->copy()->endOfMonth(),
        ]);

        $sube = Sube::create(['name' => 'Test Sube', 'status' => 'active']);
        $faaliyet = Faaliyet::create([
            'title'    => 'Test Faaliyet',
            'donem_id' => $donem->id,
            'puan'     => 10,
            'hedef'    => 2,
            'durum'    => 'active',
        ]);

        FaaliyetKayit::create(['faaliyet_id' => $faaliyet->id, 'sube_id' => $sube->id, 'donem_ay_id' => $ay->id]);
        FaaliyetKayit::create(['faaliyet_id' => $faaliyet->id, 'sube_id' => $sube->id, 'donem_ay_id' => $ay->id]);

        $response = $this->getJson("/api/raporlar/{$donem->id}");

        $response->assertOk();
        $response->assertJsonPath('sube_faaliyet_matrisi.0.sube_id', $sube->id);
        $response->assertJsonPath('sube_faaliyet_matrisi.0.faaliyet_id', $faaliyet->id);
        $response->assertJsonPath('sube_faaliyet_matrisi.0.adet', 2);
        $response->assertJsonPath('sube_faaliyet_matrisi.0.puan_katkisi', 20);
        $response->assertJsonPath('sube_bazli.0.kayit_sayisi', 2);
        $response->assertJsonPath('donem.periyot_tipi', 'quarterly');
    }

    public function test_pdf_export_returns_pdf(): void
    {
        Sanctum::actingAs($this->superadmin());

        $donem = $this->donemWithAyCount(1);
        DonemAy::create([
            'donem_id'   => $donem->id,
            'sira'       => 1,
            'name'       => 'Ay 1',
            'start_date' => $donem->start_date,
            'end_date'   => $donem->end_date,
        ]);
        Sube::create(['name' => 'PDF Sube', 'status' => 'active']);
        Faaliyet::create([
            'title' => 'PDF Faaliyet', 'donem_id' => $donem->id,
            'puan' => 5, 'hedef' => 1, 'durum' => 'active',
        ]);

        $response = $this->get("/api/raporlar/{$donem->id}/pdf");

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
    }

    public function test_report_routes_reject_unauthorized_roles(): void
    {
        $donem = $this->donemWithAyCount(1);

        Sanctum::actingAs(User::factory()->create(['role' => 'sube_yoneticisi']));

        $this->getJson("/api/raporlar/{$donem->id}")->assertForbidden();
        $this->get("/api/raporlar/{$donem->id}/pdf")->assertForbidden();
    }
}
