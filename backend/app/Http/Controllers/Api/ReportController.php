<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Donem;
use App\Models\Faaliyet;
use App\Support\BirimKapsami;
use App\Support\DonemPuanlama;
use App\Support\KriterKategorileri;
use App\Support\PuanHesaplayici;
use App\Support\RaporFiltresi;
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

        $donem->loadMissing('aylar');

        return response()->json($this->buildReport($donem, RaporFiltresi::istekten($request, $donem)));
    }

    public function pdf(Request $request, Donem $donem): Response
    {
        $this->assertErisim($request, $donem);

        Carbon::setLocale('tr');
        $donem->loadMissing('aylar');

        // PDF ekrandakiyle aynı filtreyi kullanır: kullanıcı Mart-Temmuz'u
        // süzüp indirdiğinde eline dönemin tamamı geçmemeli.
        $report = $this->buildReport($donem, RaporFiltresi::istekten($request, $donem));
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

    /** Dönem genelinde kategori bazlı performans - tüm şubelerin toplamı. */
    private function kategoriBazli(DonemPuanlama $puanlama): array
    {
        $toplamlar = [];

        foreach ($puanlama->subeler as $sube) {
            foreach ($puanlama->kategoriKirilimi($sube) as $k) {
                $anahtar = $k['kategori'];
                if (!isset($toplamlar[$anahtar])) {
                    $toplamlar[$anahtar] = ['puan' => 0, 'max_puan' => 0];
                }
                $toplamlar[$anahtar]['puan'] += $k['puan'];
                $toplamlar[$anahtar]['max_puan'] += $k['max_puan'];
            }
        }

        return KriterKategorileri::kirilim($toplamlar);
    }

    private function buildReport(Donem $donem, ?RaporFiltresi $filtre = null): array
    {
        $donem->loadMissing(['aylar', 'subeler:id,name']);
        $filtre ??= new RaporFiltresi();

        // Şube listesi, kriterler, kayıt adetleri ve merkezin verdiği manuel
        // puanlar tek kaynaktan gelir; bu rapor onları yalnızca sunar.
        $puanlama = new DonemPuanlama($donem, null, $filtre);

        $subeler = $puanlama->subeler;
        $faaliyetler = $puanlama->faaliyetler;
        $kayitlar = $puanlama->kayitlar;
        $subeSayisi = $subeler->count();
        $maxPuanToplam = $puanlama->maxPuanToplam;

        $faaliyetToplamAdet = [];
        foreach ($faaliyetler as $f) {
            $faaliyetToplamAdet[$f->id] = $kayitlar->where('faaliyet_id', $f->id)->count();
        }

        // Faaliyet bazlı özet puan üzerinden kurulur. Adet tabanlı sayım
        // yalnızca "sayi" türünde anlamlıydı: evet/hayır'da tek şubenin üç
        // kaydı oranı %300'e çıkarıyor, manuelde ise merkez tam puan verse
        // bile hiç kayıt olmadığı için %0 görünüyordu. Matris görünümü aynı
        // sebeple puana çevrilmişti; iki sekme artık aynı şeyi söylüyor.
        // Şube × faaliyet puanı tek geçişte hesaplanır; şube özeti, faaliyet
        // özeti ve matris üçü de buradan beslenir. Önceden her biri kendi
        // döngüsünü kurup aynı puanı üç kez hesaplıyordu.
        $subeBazliHam = [];
        $faaliyetToplamPuan = [];
        $faaliyetPuanAlanSube = [];
        $subeFaaliyetMatrisi = [];

        foreach ($subeler as $sube) {
            $subeToplamPuan = 0;
            $subeKayitSayisi = 0;

            foreach ($faaliyetler as $f) {
                $adet = $puanlama->adet($sube, $f);
                $katki = $puanlama->faaliyetPuani($sube, $f);
                $maxPuan = $puanlama->maxPuan($f);

                $subeToplamPuan += $katki;
                $subeKayitSayisi += $adet;

                $faaliyetToplamPuan[$f->id] = ($faaliyetToplamPuan[$f->id] ?? 0) + $katki;
                if ($katki > 0) {
                    $faaliyetPuanAlanSube[$f->id] = ($faaliyetPuanAlanSube[$f->id] ?? 0) + 1;
                }

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

            $subeBazliHam[] = [
                'sube_id'          => $sube->id,
                'sube_adi'         => $sube->name,
                'toplam_puan'      => $subeToplamPuan,
                'max_puan'         => $maxPuanToplam,
                'tamamlanma_orani' => $maxPuanToplam > 0 ? round($subeToplamPuan / $maxPuanToplam, 4) : 0,
                'kayit_sayisi'     => $subeKayitSayisi,
            ];
        }

        $subeBazli = collect($subeBazliHam)->sortByDesc('toplam_puan')->values();

        $faaliyetBazli = $faaliyetler->map(function (Faaliyet $f) use ($puanlama, $faaliyetToplamAdet, $faaliyetToplamPuan, $faaliyetPuanAlanSube, $subeSayisi) {
            $toplamPuan = $faaliyetToplamPuan[$f->id] ?? 0;
            $maxPuan = $puanlama->maxPuan($f);
            $beklenenPuan = $subeSayisi * $maxPuan;

            return [
                'faaliyet_id'          => $f->id,
                'title'                => $f->title,
                'kriter_turu'          => $f->kriter_turu,
                'kategori'             => KriterKategorileri::anahtar($f->kategori),
                'puan'                 => $f->puan,
                // Ay aralığı seçiliyse hedef orantılanmış olanıdır; tablo
                // dönemin tam hedefini gösterirse oran anlaşılmaz olur.
                'hedef'                => PuanHesaplayici::hedef($f, $puanlama->donemOrani),
                'donem_hedefi'         => $f->hedef,
                'max_puan'             => $maxPuan,
                'toplam_kayit'         => $faaliyetToplamAdet[$f->id] ?? 0,
                'toplam_puan'          => $toplamPuan,
                // Kayıt giren şube değil puan alan şube: manuel kriterde şube
                // hiç kayıt girmeden merkezin verdiği puanla yer alabiliyor.
                'katilan_sube_sayisi'  => $faaliyetPuanAlanSube[$f->id] ?? 0,
                'doluluk_orani'        => $beklenenPuan > 0 ? round($toplamPuan / $beklenenPuan, 4) : 0,
            ];
        })->sortByDesc('toplam_puan')->values();

        // Trend dönemin bütün aylarını gösterir; seçili aralık işaretlidir,
        // böylece "hangi aylar rapora giriyor" grafikte de okunur.
        $secililer = $filtre->ayIds;

        $aylikTrend = $donem->aylar->map(fn ($ay) => [
            'ay_id'        => $ay->id,
            'ay'           => $ay->name,
            'sira'         => $ay->sira,
            'kayit_sayisi' => $kayitlar->where('donem_ay_id', $ay->id)->count(),
            'secili'       => $secililer === null || in_array($ay->id, $secililer, true),
        ])->values();

        $enIyiSube = $subeBazli->first();

        $genel = [
            'toplam_sube'          => $subeSayisi,
            'toplam_faaliyet'      => $faaliyetler->count(),
            'toplam_hedef'         => (int) $faaliyetler->sum(
                fn (Faaliyet $f) => PuanHesaplayici::hedef($f, $puanlama->donemOrani)
            ),
            'toplam_kayit'         => $kayitlar->count(),
            'ortalama_tamamlanma'  => $subeBazli->count() > 0 ? round($subeBazli->avg('tamamlanma_orani'), 4) : 0,
            'en_iyi_sube_adi'      => $enIyiSube['sube_adi'] ?? null,
            'en_iyi_sube_orani'    => $enIyiSube['tamamlanma_orani'] ?? null,
            // Oran tipi kriter varken üye sayısı girilmemiş şubeler: bu
            // şubelerde oransal kriterler sıfır puan üretir ve sebebi rapora
            // bakan kişi için görünmez kalırdı.
            'uye_sayisi_eksik'     => $puanlama->uyeSayisiEksikSubeler(),
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
                // Ay seçicisinin kaynağı: arayüz ayrıca dönem detayı çekmesin.
                'aylar'        => $donem->aylar->map(fn ($ay) => [
                    'id' => $ay->id, 'name' => $ay->name, 'sira' => $ay->sira,
                ])->values(),
            ],
            // Uygulanan filtre geri döner: arayüz neyi süzdüğünü gösterir ve
            // orantılı hedef kullanıldığını bildirir.
            'filtre' => $filtre->ozet() + [
                'donem_orani'   => round($puanlama->donemOrani, 4),
                'hedef_orantili' => $filtre->ayAraligiVarMi(),
            ],
            'genel'                 => $genel,
            'sube_bazli'            => $subeBazli,
            'faaliyet_bazli'        => $faaliyetBazli,
            'aylik_trend'           => $aylikTrend,
            'sube_faaliyet_matrisi' => $subeFaaliyetMatrisi,
            // Doküman bölüm 7-8: hangi konuda başarılı, hangi konuda eksik.
            'kategori_bazli'        => $this->kategoriBazli($puanlama),
        ];
    }
}
