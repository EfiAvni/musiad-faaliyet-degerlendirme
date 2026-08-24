<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Donem;
use App\Models\Faaliyet;
use App\Models\FaaliyetKayit;
use App\Models\Sube;
use App\Models\User;
use App\Support\BirimKapsami;
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
        return response()->json($this->buildReport($donem, $request->user()));
    }

    public function pdf(Request $request, Donem $donem): Response
    {
        Carbon::setLocale('tr');

        $report = $this->buildReport($donem, $request->user());
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

    private function buildReport(Donem $donem, User $user): array
    {
        $donem->loadMissing(['aylar', 'subeler:id,name']);

        $subeQuery = $donem->tum_subeler ? Sube::query() : $donem->subeler();

        // Rapor yalnızca kullanıcının kapsamındaki şubeleri içerir; birim
        // yöneticisi başka birimlerin performansını görmemeli.
        BirimKapsami::subeIdKolonunaGore($subeQuery, $user, 'subeler.id');

        $subeler = $subeQuery->where('subeler.status', 'active')
            ->orderBy('subeler.name')
            ->get(['subeler.id', 'subeler.name']);
        $subeIds = $subeler->pluck('id');
        $subeSayisi = $subeler->count();

        $faaliyetler = Faaliyet::where('donem_id', $donem->id)->get();
        $faaliyetIds = $faaliyetler->pluck('id');
        $maxPuanToplam = (int) $faaliyetler->sum(fn (Faaliyet $f) => $f->max_puan);

        $kayitlar = FaaliyetKayit::whereIn('faaliyet_id', $faaliyetIds)
            ->whereIn('sube_id', $subeIds)
            ->get(['id', 'faaliyet_id', 'sube_id', 'donem_ay_id']);

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

        $subeBazli = $subeler->map(function (Sube $sube) use ($faaliyetler, $adetMatrisi, $maxPuanToplam) {
            $subeAdetleri = $adetMatrisi[$sube->id] ?? [];
            $toplamPuan = 0;
            $kayitSayisi = 0;
            foreach ($faaliyetler as $f) {
                $adet = $subeAdetleri[$f->id] ?? 0;
                $toplamPuan += min($adet * $f->puan, $f->max_puan);
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
                $subeFaaliyetMatrisi[] = [
                    'sube_id'       => $sube->id,
                    'faaliyet_id'   => $f->id,
                    'adet'          => $adet,
                    'puan_katkisi'  => min($adet * $f->puan, $f->max_puan),
                    'doluluk_orani' => $f->hedef > 0 ? round(min($adet, $f->hedef) / $f->hedef, 4) : 0,
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
