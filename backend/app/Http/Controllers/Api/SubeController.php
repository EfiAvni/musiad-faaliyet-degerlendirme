<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Donem;
use App\Models\Faaliyet;
use App\Models\FaaliyetKayit;
use App\Models\Sube;
use App\Support\BirimKapsami;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SubeController extends Controller
{
    // Şubeler tüm birimler için ortak bir ana listedir - MÜSİAD Ankara hem
    // Teşkilatlanma'nın hem GENÇ MÜSİAD'ın şubesidir. Bu yüzden şube uçlarında
    // birim kapsamı uygulanmaz; ayrışma dönem seviyesinde olur.
    public function index(): JsonResponse
    {
        return response()->json(Sube::orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'       => 'required|string|max:255|unique:subeler',
            'uye_sayisi' => 'nullable|integer|min:0',
            'status'     => ['nullable', Rule::in(['active', 'passive'])],
        ]);

        return response()->json(Sube::create($data), 201);
    }

    public function show(Sube $sube): JsonResponse
    {
        return response()->json($sube);
    }

    public function update(Request $request, Sube $sube): JsonResponse
    {
        $data = $request->validate([
            'name'       => ['sometimes', 'string', 'max:255', Rule::unique('subeler')->ignore($sube->id)],
            'uye_sayisi' => 'nullable|integer|min:0',
            'status'     => ['nullable', Rule::in(['active', 'passive'])],
        ]);

        $sube->update($data);
        return response()->json($sube);
    }

    public function destroy(Sube $sube): JsonResponse
    {
        $kayitSayisi = $sube->kayitlar()->count();

        if ($kayitSayisi > 0) {
            throw ValidationException::withMessages([
                'sube_id' => "Bu şubenin {$kayitSayisi} faaliyet kaydı var, silinemez. Şubeyi kullanım dışı bırakmak için durumunu Pasif yapın.",
            ]);
        }

        if ($sube->donemler()->exists()) {
            throw ValidationException::withMessages([
                'sube_id' => 'Bu şube bir veya daha fazla dönemin kapsamında, silinemez. Önce şubeyi dönem kapsamından çıkarın.',
            ]);
        }

        $sube->delete();
        return response()->json(null, 204);
    }

    public function puanOzeti(Request $request, Sube $sube): JsonResponse
    {
        $user = $request->user();

        // Dönem birime ait olduğu için "aktif dönem" kullanıcının birimine göre
        // değişir; açıkça bir dönem istenmişse erişim yetkisi kontrol edilir.
        if ($istenenId = $request->integer('donem_id')) {
            $donem = Donem::find($istenenId);

            if (!BirimKapsami::donemeErisebilirMi($user, $donem)) {
                abort(403, 'Bu dönem sizin biriminizin kapsamında değil.');
            }
        } else {
            $donem = BirimKapsami::donemSorgusu(Donem::where('status', 'active'), $user)->first();
        }

        if (!$donem) {
            return response()->json(['donem_id' => null, 'toplam_puan' => 0, 'detaylar' => []]);
        }

        $donemId = $donem->id;
        $faaliyetler = Faaliyet::where('donem_id', $donemId)->get();

        $kayitSayilari = FaaliyetKayit::where('sube_id', $sube->id)
            ->whereIn('faaliyet_id', $faaliyetler->pluck('id'))
            ->selectRaw('faaliyet_id, count(*) as adet')
            ->groupBy('faaliyet_id')
            ->pluck('adet', 'faaliyet_id');

        $toplam = 0;
        $detaylar = $faaliyetler->map(function ($f) use ($kayitSayilari, &$toplam) {
            $adet = (int) ($kayitSayilari[$f->id] ?? 0);
            $katki = min($adet * $f->puan, $f->max_puan);
            $toplam += $katki;

            return [
                'faaliyet_id'  => $f->id,
                'title'        => $f->title,
                'kayit_sayisi' => $adet,
                'puan'         => $f->puan,
                'hedef'        => $f->hedef,
                'max_puan'     => $f->max_puan,
                'puan_katkisi' => $katki,
            ];
        })->values();

        return response()->json([
            'donem_id'    => (int) $donemId,
            'toplam_puan' => $toplam,
            'detaylar'    => $detaylar,
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'subeler'              => 'required|array|min:1',
            'subeler.*.name'       => 'required|string|max:255',
            'subeler.*.uye_sayisi' => 'nullable|integer|min:0',
        ]);

        $created = 0;
        $skipped = [];

        foreach ($request->subeler as $item) {
            $name = trim($item['name']);
            if (!$name) continue;

            // withTrashed: silinmiş bir şube aynı isimle tekrar yüklenirse yeni
            // kayıt açmak yerine eskisini geri getiriyoruz - isim alanı benzersiz
            // olduğu için aksi halde kayıt veritabanı hatasıyla düşerdi.
            $mevcut = Sube::withTrashed()->where('name', $name)->first();

            if ($mevcut) {
                if ($mevcut->trashed()) {
                    $mevcut->restore();
                    $created++;
                } else {
                    $skipped[] = $name;
                }
                continue;
            }

            Sube::create([
                'name'       => $name,
                'uye_sayisi' => $item['uye_sayisi'] ?? 0,
                'status'     => 'active',
            ]);
            $created++;
        }

        return response()->json([
            'created' => $created,
            'skipped' => $skipped,
            'message' => "{$created} şube eklendi" . (count($skipped) ? ', ' . count($skipped) . ' atlandı (zaten mevcut)' : ''),
        ]);
    }

}
