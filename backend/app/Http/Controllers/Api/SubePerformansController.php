<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AyGonderim;
use App\Models\Donem;
use App\Models\Faaliyet;
use App\Models\Sube;
use App\Models\User;
use App\Support\DonemPuanlama;
use App\Support\KriterKategorileri;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Doküman bölüm 4: şube "önceki dönemlerde girdiği bilgileri görüntüleyebilmeli"
 * ve "kendi performans sonuçlarını görüntüleyebilmelidir". Bölüm 13 buna geçmiş
 * dönemleri ve önceki yıl performansını ekliyor.
 *
 * Merkezin /raporlar uçları şubeye açılmadı: onlar tüm şubelerin puanlarını ve
 * sıralamasını içeriyor. Karşılaştırma dokümanda (bölüm 8, 10) merkez işi olarak
 * tanımlı. Buradaki uçlar yalnızca çağıran kullanıcının kendi şubesini döner ve
 * şube id'sini istekten değil oturumdan alır - istemcinin başka bir şubeyi
 * sorabileceği bir parametre bilerek yok.
 */
class SubePerformansController extends Controller
{
    /** Tek bir dönemde şubenin kendi puanı ve faaliyet kırılımı. */
    public function ozet(Request $request): JsonResponse
    {
        $sube = $this->kendiSubesi($request->user());
        $donem = $this->erisilebilirDonem($request, $sube);

        if (!$donem) {
            return response()->json(['donem' => null, 'faaliyetler' => [], 'kategori_kirilimi' => [], 'genel' => null]);
        }

        $puanlama = new DonemPuanlama($donem, $sube->id);

        $faaliyetler = $puanlama->faaliyetler->map(fn (Faaliyet $f) => [
            'faaliyet_id'   => $f->id,
            'title'         => $f->title,
            'kriter_turu'   => $f->kriter_turu,
            'kategori'      => KriterKategorileri::anahtar($f->kategori),
            'kategori_adi'  => KriterKategorileri::etiket($f->kategori),
            'hedef'         => $f->hedef,
            'kayit_sayisi'  => $puanlama->adetMatrisi[$sube->id][$f->id] ?? 0,
            'puan'          => $puanlama->faaliyetPuani($sube, $f),
            'max_puan'      => $f->max_puan,
        ])->values();

        $toplam = $puanlama->subeToplamPuani($sube);

        return response()->json([
            'donem' => [
                'id'         => $donem->id,
                'name'       => $donem->name,
                'birim_adi'  => $donem->birim?->name,
                'start_date' => $donem->start_date,
                'end_date'   => $donem->end_date,
                'status'     => $donem->status,
            ],
            'genel' => [
                'toplam_puan'  => $toplam,
                'max_puan'     => $puanlama->maxPuanToplam,
                'basari_orani' => $puanlama->maxPuanToplam > 0 ? round($toplam / $puanlama->maxPuanToplam, 4) : 0,
                'kayit_sayisi' => array_sum($puanlama->adetMatrisi[$sube->id] ?? []),
            ],
            'faaliyetler'       => $faaliyetler,
            'kategori_kirilimi' => $puanlama->kategoriKirilimi($sube),
            // Bölüm 11-12: şube ayın merkezde hangi aşamada olduğunu görmeli.
            'ay_durumlari'      => $this->ayDurumlari($donem, $sube),
        ]);
    }

    /** Doküman bölüm 13: "önceki yıl performansı" - şubenin kendi dönemleri. */
    public function yillik(Request $request): JsonResponse
    {
        $sube = $this->kendiSubesi($request->user());
        $yil = $request->integer('yil') ?: (int) now()->format('Y');

        $donemler = $this->subeninDonemleri($sube)
            ->whereYear('start_date', $yil)
            ->orderBy('start_date')
            ->with('birim:id,name')
            ->get();

        $satirlar = [];
        $kategoriToplamlari = [];
        $toplamPuan = 0;
        $toplamMax = 0;

        foreach ($donemler as $donem) {
            $puanlama = new DonemPuanlama($donem, $sube->id);

            // Dönem kapsamı şube listesini boş bırakabilir (şube pasifse veya
            // dönemin seçili şubeleri arasında değilse); o dönem satıra girmez.
            if ($puanlama->subeler->isEmpty()) {
                continue;
            }

            $puan = $puanlama->subeToplamPuani($sube);
            $toplamPuan += $puan;
            $toplamMax += $puanlama->maxPuanToplam;

            $satirlar[] = [
                'donem_id'   => $donem->id,
                'donem_adi'  => $donem->name,
                'birim_adi'  => $donem->birim?->name,
                'puan'       => $puan,
                'max_puan'   => $puanlama->maxPuanToplam,
                'oran'       => $puanlama->maxPuanToplam > 0 ? round($puan / $puanlama->maxPuanToplam, 4) : 0,
                'tamamlandi' => $donem->status === 'completed',
            ];

            foreach ($puanlama->kategoriKirilimi($sube) as $k) {
                $anahtar = $k['kategori'];
                if (!isset($kategoriToplamlari[$anahtar])) {
                    $kategoriToplamlari[$anahtar] = ['puan' => 0, 'max_puan' => 0];
                }
                $kategoriToplamlari[$anahtar]['puan'] += $k['puan'];
                $kategoriToplamlari[$anahtar]['max_puan'] += $k['max_puan'];
            }
        }

        $donemSayisi = count($satirlar);

        return response()->json([
            'yil'               => $yil,
            'sube_adi'          => $sube->name,
            'donem_puanlari'    => $satirlar,
            'kategori_kirilimi' => KriterKategorileri::kirilim($kategoriToplamlari),
            'genel'             => [
                'donem_sayisi'      => $donemSayisi,
                'tamamlanan_donem'  => count(array_filter($satirlar, fn ($s) => $s['tamamlandi'])),
                'toplam_puan'       => $toplamPuan,
                'max_puan'          => $toplamMax,
                'ortalama_puan'     => $donemSayisi > 0 ? round($toplamPuan / $donemSayisi, 1) : 0,
                'basari_orani'      => $toplamMax > 0 ? round($toplamPuan / $toplamMax, 4) : 0,
            ],
        ]);
    }

    /** Şubenin puan görebileceği yıllar - dönem açılmamış yılları listelemenin anlamı yok. */
    public function yillar(Request $request): JsonResponse
    {
        $sube = $this->kendiSubesi($request->user());

        $yillar = $this->subeninDonemleri($sube)
            ->orderByDesc('start_date')
            ->pluck('start_date')
            ->map(fn ($t) => (int) date('Y', strtotime((string) $t)))
            ->unique()
            ->values();

        return response()->json($yillar);
    }

    /**
     * Rol kontrolü rotada da var; burada tekrarlanması bilinçli. Bu uçların tek
     * güvenlik varsayımı "çağıran kendi şubesini soruyor" ve bu varsayım
     * yalnızca sube_id'nin varlığına dayandırılamaz: şema bir kullanıcıda hem
     * birim_id hem sube_id tutabiliyor (UserController yazarken temizliyor ama
     * doğrudan SQL veya eski satırlar bu güvenceyi vermiyor). Rol kontrolü
     * olmadan böyle bir satır başka bir şubenin verisini okuyabilirdi.
     */
    private function kendiSubesi(User $user): Sube
    {
        if ($user->role !== 'sube_yoneticisi' || !$user->sube_id) {
            abort(403, 'Bu sayfa şube yöneticileri içindir. Hesabınız bir şubeye bağlı değilse sistem yöneticinizle iletişime geçin.');
        }

        return Sube::findOrFail($user->sube_id);
    }

    /**
     * Şubenin kapsamında olan dönemler - tüm birimlerden, her durumdan.
     * Bölüm 13 geçmiş dönemleri açıkça istiyor, bu yüzden durum filtresi yok.
     */
    private function subeninDonemleri(Sube $sube)
    {
        return Donem::where(function ($q) use ($sube) {
            $q->where('tum_subeler', true)
                ->orWhereHas('subeler', fn ($sq) => $sq->where('subeler.id', $sube->id));
        });
    }

    private function erisilebilirDonem(Request $request, Sube $sube): ?Donem
    {
        $sorgu = $this->subeninDonemleri($sube)->with('birim:id,name');

        if ($istenenId = $request->integer('donem_id')) {
            $donem = (clone $sorgu)->find($istenenId);

            // Kapsam dışı bir dönem "yok" değil "yasak": şube başka bir şubeye
            // özel dönemin varlığını id deneyerek öğrenememeli, ama var olmayan
            // id ile kapsam dışı id arasındaki farkı da sızdırmamalıyız.
            if (!$donem) {
                abort(403, 'Bu dönem şubenizin kapsamında değil.');
            }

            return $donem;
        }

        return (clone $sorgu)->where('status', 'active')->orderByDesc('start_date')->first()
            ?? (clone $sorgu)->orderByDesc('start_date')->first();
    }

    /** Dönemin ayları ve şubenin o aydaki gönderim durumu. */
    private function ayDurumlari(Donem $donem, Sube $sube): array
    {
        $donem->loadMissing('aylar');

        $gonderimler = AyGonderim::where('sube_id', $sube->id)
            ->whereIn('donem_ay_id', $donem->aylar->pluck('id'))
            ->get()
            ->keyBy('donem_ay_id');

        return $donem->aylar->map(fn ($ay) => [
            'ay_id' => $ay->id,
            'ay'    => $ay->name,
            'sira'  => $ay->sira,
            'durum' => AyGonderim::durumFor($gonderimler->get($ay->id)),
        ])->values()->all();
    }
}
