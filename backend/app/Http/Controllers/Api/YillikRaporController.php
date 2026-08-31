<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Donem;
use App\Support\BirimKapsami;
use App\Support\DonemPuanlama;
use App\Support\KriterKategorileri;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gereksinim dokümanı bölüm 9: "Aylık değerlendirmeler yıl içerisinde birikerek
 * yıllık performansın oluşmasını sağlamalıdır." Bölüm 10 ise şube başına toplam
 * puan, ortalama, tamamlanan dönem sayısı ve başarılı/geliştirilmesi gereken
 * kriterleri istiyor.
 *
 * Dönemler yılın hangi ayında başladığına göre gruplanır; her dönem kendi
 * puanlamasıyla hesaplanıp toplanır.
 */
class YillikRaporController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $yil = $request->integer('yil') ?: (int) now()->format('Y');

        $donemQuery = Donem::whereYear('start_date', $yil)->orderBy('start_date');
        BirimKapsami::donemSorgusu($donemQuery, $request->user());

        $donemler = $donemQuery->with('birim:id,name')->get();

        if ($donemler->isEmpty()) {
            return response()->json([
                'yil'         => $yil,
                'donemler'    => [],
                'sube_bazli'  => [],
                'kategori_bazli' => [],
                'genel'       => $this->bosGenel(),
            ]);
        }

        // Her dönem kendi puanlamasını kurar; şube listesi dönemden döneme
        // değişebilir (bazı dönemler yalnızca belirli şubeler için açılır).
        $puanlamalar = $donemler->map(fn (Donem $d) => new DonemPuanlama($d));

        $subeBazli = $this->subeBazli($donemler, $puanlamalar);
        $kategoriBazli = $this->kategoriBazli($puanlamalar);

        return response()->json([
            'yil'            => $yil,
            'donemler'       => $donemler->map(fn (Donem $d) => [
                'id'         => $d->id,
                'name'       => $d->name,
                'birim_adi'  => $d->birim?->name,
                'start_date' => $d->start_date,
                'end_date'   => $d->end_date,
                'status'     => $d->status,
            ])->values(),
            'sube_bazli'     => $subeBazli,
            'kategori_bazli' => $kategoriBazli,
            'genel'          => $this->genel($donemler, $subeBazli),
        ]);
    }

    /**
     * Doküman bölüm 9-10: her şubenin dönem dönem puanı, yıllık toplamı,
     * ortalaması ve tamamladığı dönem sayısı.
     */
    private function subeBazli($donemler, $puanlamalar): array
    {
        // Yıl içindeki tüm şubeler - bir şube yalnızca bazı dönemlerde yer alabilir.
        $subeler = [];
        foreach ($puanlamalar as $p) {
            foreach ($p->subeler as $s) {
                $subeler[$s->id] = $s;
            }
        }

        $satirlar = [];

        foreach ($subeler as $sube) {
            $donemPuanlari = [];
            $toplamPuan = 0;
            $toplamMax = 0;
            $katildigiDonem = 0;

            foreach ($puanlamalar as $i => $p) {
                $donem = $donemler[$i];

                // Şube bu dönemin kapsamında değilse satırda yer almaz.
                if (!$p->subeler->contains('id', $sube->id)) {
                    continue;
                }

                $puan = $p->subeToplamPuani($sube);
                $donemPuanlari[] = [
                    'donem_id'   => $donem->id,
                    'donem_adi'  => $donem->name,
                    'puan'       => $puan,
                    'max_puan'   => $p->maxPuanToplam,
                    'oran'       => $p->maxPuanToplam > 0 ? round($puan / $p->maxPuanToplam, 4) : 0,
                    'tamamlandi' => $donem->status === 'completed',
                ];

                $toplamPuan += $puan;
                $toplamMax += $p->maxPuanToplam;
                $katildigiDonem++;

                // Kategori kırılımı yalnızca son durum için gerekli; her dönemde
                // yeniden hesaplamak yerine yıl toplamını aşağıda topluyoruz.
            }

            if ($katildigiDonem === 0) {
                continue;
            }

            $tamamlanan = collect($donemPuanlari)->where('tamamlandi', true)->count();

            $satirlar[] = [
                'sube_id'           => $sube->id,
                'sube_adi'          => $sube->name,
                'donem_puanlari'    => $donemPuanlari,
                'toplam_puan'       => $toplamPuan,
                'max_puan'          => $toplamMax,
                'ortalama_puan'     => round($toplamPuan / $katildigiDonem, 1),
                'basari_orani'      => $toplamMax > 0 ? round($toplamPuan / $toplamMax, 4) : 0,
                'katildigi_donem'   => $katildigiDonem,
                'tamamlanan_donem'  => $tamamlanan,
                'kategori_kirilimi' => $this->subeKategoriKirilimi($sube, $puanlamalar),
            ];
        }

        usort($satirlar, fn ($a, $b) => $b['toplam_puan'] <=> $a['toplam_puan']);

        return $satirlar;
    }

    /** Şubenin yıl geneli kategori kırılımı - dönemler toplanır. */
    private function subeKategoriKirilimi($sube, $puanlamalar): array
    {
        $toplamlar = [];

        foreach ($puanlamalar as $p) {
            if (!$p->subeler->contains('id', $sube->id)) {
                continue;
            }

            foreach ($p->kategoriKirilimi($sube) as $k) {
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

    /** Tüm şubelerin toplamı - birimin hangi alanda zayıf olduğunu gösterir. */
    private function kategoriBazli($puanlamalar): array
    {
        $toplamlar = [];

        foreach ($puanlamalar as $p) {
            foreach ($p->subeler as $sube) {
                foreach ($p->kategoriKirilimi($sube) as $k) {
                    $anahtar = $k['kategori'];
                    if (!isset($toplamlar[$anahtar])) {
                        $toplamlar[$anahtar] = ['puan' => 0, 'max_puan' => 0];
                    }
                    $toplamlar[$anahtar]['puan'] += $k['puan'];
                    $toplamlar[$anahtar]['max_puan'] += $k['max_puan'];
                }
            }
        }

        return KriterKategorileri::kirilim($toplamlar);
    }

    private function genel($donemler, array $subeBazli): array
    {
        $enIyi = $subeBazli[0] ?? null;
        $enDusuk = $subeBazli ? end($subeBazli) : null;

        return [
            'donem_sayisi'        => $donemler->count(),
            'tamamlanan_donem'    => $donemler->where('status', 'completed')->count(),
            'sube_sayisi'         => count($subeBazli),
            'ortalama_basari'     => $subeBazli
                ? round(collect($subeBazli)->avg('basari_orani'), 4)
                : 0,
            'en_iyi_sube_adi'     => $enIyi['sube_adi'] ?? null,
            'en_iyi_sube_puani'   => $enIyi['toplam_puan'] ?? null,
            'en_dusuk_sube_adi'   => $enDusuk['sube_adi'] ?? null,
            'en_dusuk_sube_puani' => $enDusuk['toplam_puan'] ?? null,
        ];
    }

    private function bosGenel(): array
    {
        return [
            'donem_sayisi' => 0, 'tamamlanan_donem' => 0, 'sube_sayisi' => 0,
            'ortalama_basari' => 0, 'en_iyi_sube_adi' => null, 'en_iyi_sube_puani' => null,
            'en_dusuk_sube_adi' => null, 'en_dusuk_sube_puani' => null,
        ];
    }
}
