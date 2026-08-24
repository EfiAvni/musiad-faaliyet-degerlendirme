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
    public function index(Request $request): JsonResponse
    {
        $query = BirimKapsami::subeSorgusu(Sube::query(), $request->user());

        return response()->json($query->with('birim:id,name')->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'       => 'required|string|max:255|unique:subeler',
            'birim_id'   => 'nullable|exists:birimler,id',
            'uye_sayisi' => 'nullable|integer|min:0',
            'status'     => ['nullable', Rule::in(['active', 'passive'])],
        ]);

        // Birim yöneticisi yalnızca kendi birimine şube açabilir; birim
        // belirtmezse kendi birimine düşer.
        $data['birim_id'] = $this->hedefBirimId($request, $data['birim_id'] ?? null);

        $sube = Sube::create($data);
        return response()->json($sube->load('birim:id,name'), 201);
    }

    public function show(Request $request, Sube $sube): JsonResponse
    {
        $this->assertErisim($request, $sube);

        return response()->json($sube->load('birim:id,name'));
    }

    public function update(Request $request, Sube $sube): JsonResponse
    {
        $this->assertErisim($request, $sube);

        $data = $request->validate([
            'name'       => ['sometimes', 'string', 'max:255', Rule::unique('subeler')->ignore($sube->id)],
            'birim_id'   => 'nullable|exists:birimler,id',
            'uye_sayisi' => 'nullable|integer|min:0',
            'status'     => ['nullable', Rule::in(['active', 'passive'])],
        ]);

        if (array_key_exists('birim_id', $data)) {
            $data['birim_id'] = $this->hedefBirimId($request, $data['birim_id']);
        }

        $sube->update($data);
        return response()->json($sube->load('birim:id,name'));
    }

    public function destroy(Request $request, Sube $sube): JsonResponse
    {
        $this->assertErisim($request, $sube);

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
        $this->assertErisim($request, $sube);

        $donemId = $request->integer('donem_id') ?: optional(Donem::where('status', 'active')->first())->id;

        if (!$donemId) {
            return response()->json(['donem_id' => null, 'toplam_puan' => 0, 'detaylar' => []]);
        }

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
            'subeler.*.birim_id'   => 'nullable|exists:birimler,id',
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
                'birim_id'   => $this->hedefBirimId($request, $item['birim_id'] ?? null),
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

    private function assertErisim(Request $request, Sube $sube): void
    {
        if (!BirimKapsami::subeyeErisebilirMi($request->user(), $sube->id)) {
            abort(403, 'Bu şube sizin biriminizin kapsamında değil.');
        }
    }

    /**
     * Birim yöneticisi başka bir birime şube yazamaz; birim belirtmezse kendi
     * birimine düşer. Süper admin istediği birimi seçebilir.
     */
    private function hedefBirimId(Request $request, ?int $istenen): ?int
    {
        $user = $request->user();

        if ($user->role === 'superadmin') {
            return $istenen;
        }

        if ($istenen !== null && $istenen !== $user->birim_id) {
            abort(403, 'Yalnızca kendi biriminize şube tanımlayabilirsiniz.');
        }

        return $user->birim_id;
    }
}
