<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Donem;
use App\Models\Faaliyet;
use App\Models\FaaliyetDegerlendirme;
use App\Models\FaaliyetKayit;
use App\Models\Sube;
use App\Support\BirimKapsami;
use App\Support\PuanHesaplayici;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    public function show(Request $request, Donem $donem): JsonResponse
    {
        $this->assertErisim($request, $donem);

        return response()->json($this->buildReport($donem));
    }

    public function pdf(Request $request, Donem $donem): Response
    {
        $this->assertErisim($request, $donem);

        Carbon::setLocale('tr');

        $report = $this->buildReport($donem);
        $logoPath = resource_path('images/musiad-logo.png');
        $logoBase64 = is_file($logoPath) ? base64_encode(file_get_contents($logoPath)) : null;

        $pdf = Pdf::loadView('pdf.donem-raporu', [
            'donem'           => $report['donem'],
            'genel'           => $report['genel'],
            'subeBazli'       => $report['sube_bazli'],
            'faaliyetBazli'   => $report['faaliyet_bazli'],
            'aylikTrend'      => $report['aylik_trend'],
            'logoBase64'      => $logoBase64,
            'olusturmaTarihi' => now()->format('d.m.Y H:i'),
        ])->setPaper('a4', 'portrait');

        $dosyaAdi = 'MUSIAD-' . Str::slug($donem->name) . '-raporu.pdf';

        return $pdf->download($dosyaAdi);
    }

    /** Dönem tek bir birime ait olduğu için rapor da o birimin verisidir; şube filtresi gerekmez. */
    private function assertErisim(Request $request, Donem $donem): void
    {
        if (!BirimKapsami::donemeErisebilirMi($request->user(), $donem)) {
            abort(403, 'Bu dönem sizin biriminizin kapsamında değil.');
        }
    }

    /**
     * Merkezin elle puanladığı faaliyetlerin dönem toplamı: [sube_id][faaliyet_id] => puan.
     *
     * Değerlendirme ay bazında yapılır; dönem raporunda aylık puanlar toplanır ve
     * PuanHesaplayici tarafından faaliyetin tavanında kesilir - "sayi" türünde
     * kayıtların birikip hedefte tavanlanmasıyla aynı mantık.
     *
     * @return array<int, array<int, int>>
     */
    private function manuelPuanlar(Donem $donem, $faaliyetIds): array
    {
        $satirlar = FaaliyetDegerlendirme::query()
            ->join('ay_gonderimleri', 'ay_gonderimleri.id', '=', 'faaliyet_degerlendirmeleri.ay_gonderim_id')
            ->join('donem_aylar', 'donem_aylar.id', '=', 'ay_gonderimleri.donem_ay_id')
            ->where('donem_aylar.donem_id', $donem->id)
            ->whereNull('ay_gonderimleri.deleted_at')
            ->whereIn('faaliyet_degerlendirmeleri.faaliyet_id', $faaliyetIds)
            ->groupBy('ay_gonderimleri.sube_id', 'faaliyet_degerlendirmeleri.faaliyet_id')
            ->selectRaw('ay_gonderimleri.sube_id, faaliyet_degerlendirmeleri.faaliyet_id, SUM(faaliyet_degerlendirmeleri.puan) as toplam')
            ->get();

        $harita = [];
        foreach ($satirlar as $satir) {
            $harita[(int) $satir->sube_id][(int) $satir->faaliyet_id] = (int) $satir->toplam;
        }

        return $harita;
    }

    private function buildReport(Donem $donem): array
    {
        $donem->loadMissing(['aylar', 'subeler:id,name']);

        $subeQuery = $donem->tum_subeler ? Sube::query() : $donem->subeler();

        // uye_sayisi oran tipi kriterlerde şube büyüklüğüne göre normalize etmek için gerekli.
        $subeler = $subeQuery->where('subeler.status', 'active')
            ->orderBy('subeler.name')
            ->get(['subeler.id', 'subeler.name', 'subeler.uye_sayisi']);
        $subeIds = $subeler->pluck('id');
        $subeSayisi = $subeler->count();

        $faaliyetler = Faaliyet::where('donem_id', $donem->id)->get();
        $faaliyetIds = $faaliyetler->pluck('id');
        $maxPuanToplam = (int) $faaliyetler->sum(fn (Faaliyet $f) => $f->max_puan);

        $kayitlar = FaaliyetKayit::whereIn('faaliyet_id', $faaliyetIds)
            ->whereIn('sube_id', $subeIds)
            ->get(['id', 'faaliyet_id', 'sube_id', 'donem_ay_id']);

        $manuelPuanlar = $this->manuelPuanlar($donem, $faaliyetIds);

        // Tek geçişte [sube_id][faaliyet_id] => adet haritası - şube/faaliyet
        // bazlı özetler ve matris görünümü hepsi buradan O(1) okur.
        $adetMatrisi = [];
        foreach ($kayitlar as $k) {
            $adetMatrisi[$k->sube_id][$k->faaliyet_id] = ($adetMatrisi[$k->sube_id][$k->faaliyet_id] ?? 0) + 1;
        }

        $faaliyetToplamAdet = [];
        $faaliyetSubeSayisi = [];
        foreach ($adetMatrisi as $subeAdetleri) {
            foreach ($subeAdetleri as $faaliyetId => $adet) {
                $faaliyetToplamAdet[$faaliyetId] = ($faaliyetToplamAdet[$faaliyetId] ?? 0) + $adet;
                $faaliyetSubeSayisi[$faaliyetId] = ($faaliyetSubeSayisi[$faaliyetId] ?? 0) + 1;
            }
        }

        $subeBazli = $subeler->map(function (Sube $sube) use ($faaliyetler, $adetMatrisi, $maxPuanToplam, $manuelPuanlar) {
            $subeAdetleri = $adetMatrisi[$sube->id] ?? [];
            $toplamPuan = 0;
            $kayitSayisi = 0;
            foreach ($faaliyetler as $f) {
                $adet = $subeAdetleri[$f->id] ?? 0;
                $toplamPuan += PuanHesaplayici::puan(
                    $f,
                    $adet,
                    $sube->uye_sayisi,
                    $manuelPuanlar[$sube->id][$f->id] ?? null,
                );
                $kayitSayisi += $adet;
            }

            return [
                'sube_id'          => $sube->id,
                'sube_adi'         => $sube->name,
                'toplam_puan'      => $toplamPuan,
                'max_puan'         => $maxPuanToplam,
                'tamamlanma_orani' => $maxPuanToplam > 0 ? round($toplamPuan / $maxPuanToplam, 4) : 0,
                'kayit_sayisi'     => $kayitSayisi,
            ];
        })->sortByDesc('toplam_puan')->values();

        $faaliyetBazli = $faaliyetler->map(function (Faaliyet $f) use ($faaliyetToplamAdet, $faaliyetSubeSayisi, $subeSayisi) {
            $toplamKayit = $faaliyetToplamAdet[$f->id] ?? 0;
            $beklenenToplam = $subeSayisi * max($f->hedef, 1);

            return [
                'faaliyet_id'          => $f->id,
                'title'                => $f->title,
                'puan'                 => $f->puan,
                'hedef'                => $f->hedef,
                'max_puan'             => $f->max_puan,
                'toplam_kayit'         => $toplamKayit,
                'katilan_sube_sayisi'  => $faaliyetSubeSayisi[$f->id] ?? 0,
                'doluluk_orani'        => $beklenenToplam > 0 ? round($toplamKayit / $beklenenToplam, 4) : 0,
            ];
        })->sortByDesc('toplam_kayit')->values();

        $subeFaaliyetMatrisi = [];
        foreach ($subeler as $sube) {
            $subeAdetleri = $adetMatrisi[$sube->id] ?? [];
            foreach ($faaliyetler as $f) {
                $adet = $subeAdetleri[$f->id] ?? 0;
                $katki = PuanHesaplayici::puan($f, $adet, $sube->uye_sayisi, $manuelPuanlar[$sube->id][$f->id] ?? null);
                $maxPuan = $f->max_puan;

                $subeFaaliyetMatrisi[] = [
                    'sube_id'       => $sube->id,
                    'faaliyet_id'   => $f->id,
                    'adet'          => $adet,
                    'puan_katkisi'  => $katki,
                    // Doluluk artık puan üzerinden: adet tabanlı oran evet/hayır
                    // ve manuel gibi türlerde anlamsız kalıyordu.
                    'doluluk_orani' => $maxPuan > 0 ? round($katki / $maxPuan, 4) : 0,
                ];
            }
        }

        $aylikTrend = $donem->aylar->map(fn ($ay) => [
            'ay_id'        => $ay->id,
            'ay'           => $ay->name,
            'sira'         => $ay->sira,
            'kayit_sayisi' => $kayitlar->where('donem_ay_id', $ay->id)->count(),
        ])->values();

        $enIyiSube = $subeBazli->first();

        $genel = [
            'toplam_sube'          => $subeSayisi,
            'toplam_faaliyet'      => $faaliyetler->count(),
            'toplam_hedef'         => (int) $faaliyetler->sum('hedef'),
            'toplam_kayit'         => $kayitlar->count(),
            'ortalama_tamamlanma'  => $subeBazli->count() > 0 ? round($subeBazli->avg('tamamlanma_orani'), 4) : 0,
            'en_iyi_sube_adi'      => $enIyiSube['sube_adi'] ?? null,
            'en_iyi_sube_orani'    => $enIyiSube['tamamlanma_orani'] ?? null,
        ];

        return [
            'donem' => [
                'id'           => $donem->id,
                'name'         => $donem->name,
                'start_date'   => $donem->start_date,
                'end_date'     => $donem->end_date,
                'status'       => $donem->status,
                'tum_subeler'  => $donem->tum_subeler,
                'subeler'      => $donem->subeler,
                'periyot_tipi' => $donem->periyot_tipi,
            ],
            'genel'                 => $genel,
            'sube_bazli'            => $subeBazli,
            'faaliyet_bazli'        => $faaliyetBazli,
            'aylik_trend'           => $aylikTrend,
            'sube_faaliyet_matrisi' => $subeFaaliyetMatrisi,
        ];
    }
}
