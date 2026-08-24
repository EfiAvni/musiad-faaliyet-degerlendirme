<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Donem;
use App\Models\Faaliyet;
use App\Support\BirimKapsami;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FaaliyetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Faaliyet::with('donem:id,name,status,birim_id')->orderByDesc('created_at');

        if ($request->filled('donem_id')) {
            $query->where('donem_id', $request->integer('donem_id'));
        }

        $user = $request->user();

        // Birim yöneticisi yalnızca kendi biriminin dönemlerindeki faaliyetleri
        // görür; şube yöneticisi tüm birimleri görür ama yalnızca şubesinin
        // kapsamına giren dönemlerden.
        BirimKapsami::donemIliskisineGore($query, $user);

        if (BirimKapsami::subeIleSinirliMi($user)) {
            $query->whereHas('donem', function ($q) use ($user) {
                $q->where('tum_subeler', true);
                if ($user->sube_id) {
                    $q->orWhereHas('subeler', fn ($sq) => $sq->where('subeler.id', $user->sube_id));
                }
            });
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'         => 'required|string|max:255',
            'detay'         => 'nullable|string',
            'puan'          => 'nullable|integer|min:0',
            'hedef'         => 'nullable|integer|min:0',
            'aciklama'      => 'nullable|string',
            'tarih_gerekli' => 'nullable|boolean',
            'donem_id'      => 'required|exists:donemler,id',
            'durum'         => ['nullable', Rule::in(['active', 'completed', 'passive'])],
        ]);

        $donem = Donem::findOrFail($data['donem_id']);

        if (!BirimKapsami::donemeErisebilirMi($request->user(), $donem)) {
            abort(403, 'Bu dönem sizin biriminizin kapsamında değil.');
        }

        if ($donem->status === 'completed') {
            throw ValidationException::withMessages([
                'donem_id' => 'Tamamlanmış bir döneme yeni faaliyet eklenemez.',
            ]);
        }

        $data['puan'] = $data['puan'] ?? 0;
        $data['hedef'] = $data['hedef'] ?? 0;
        $data['tarih_gerekli'] = $data['tarih_gerekli'] ?? false;
        $data['durum'] = $data['durum'] ?? 'active';

        $faaliyet = Faaliyet::create($data);
        return response()->json($faaliyet->load('donem:id,name,status'), 201);
    }

    public function show(Request $request, Faaliyet $faaliyet): JsonResponse
    {
        $this->assertErisim($request, $faaliyet);

        return response()->json($faaliyet->load('donem:id,name,status'));
    }

    public function update(Request $request, Faaliyet $faaliyet): JsonResponse
    {
        $this->assertErisim($request, $faaliyet);

        $data = $request->validate([
            'title'         => 'sometimes|string|max:255',
            'detay'         => 'nullable|string',
            'puan'          => 'sometimes|integer|min:0',
            'hedef'         => 'sometimes|integer|min:0',
            'aciklama'      => 'nullable|string',
            'tarih_gerekli' => 'sometimes|boolean',
            'donem_id'      => 'sometimes|exists:donemler,id',
            'durum'         => ['sometimes', Rule::in(['active', 'completed', 'passive'])],
        ]);

        $this->assertPuanlamaDegistirilebilir($faaliyet, $data);

        if (isset($data['donem_id']) && $data['donem_id'] !== $faaliyet->donem_id) {
            $hedefDonem = Donem::findOrFail($data['donem_id']);

            if (!BirimKapsami::donemeErisebilirMi($request->user(), $hedefDonem)) {
                abort(403, 'Faaliyeti başka bir birimin dönemine taşıyamazsınız.');
            }
        }

        $faaliyet->update($data);
        return response()->json($faaliyet->fresh()->load('donem:id,name,status'));
    }

    public function destroy(Request $request, Faaliyet $faaliyet): JsonResponse
    {
        $this->assertErisim($request, $faaliyet);

        $kayitSayisi = $faaliyet->kayitlar()->count();

        if ($kayitSayisi > 0) {
            throw ValidationException::withMessages([
                'faaliyet_id' => "Bu faaliyete {$kayitSayisi} şube kaydı girilmiş, silinemez. Faaliyeti kapatmak için durumunu Pasif yapın.",
            ]);
        }

        $faaliyet->delete();
        return response()->json(null, 204);
    }

    private function assertErisim(Request $request, Faaliyet $faaliyet): void
    {
        if (!BirimKapsami::donemeErisebilirMi($request->user(), $faaliyet->donem)) {
            abort(403, 'Bu faaliyet sizin biriminizin kapsamında değil.');
        }
    }

    /**
     * Puanlar kayıt anında dondurulmaz, her raporda yeniden hesaplanır. Bu
     * yüzden kayıt girilmiş bir faaliyetin puanını veya hedefini değiştirmek
     * geçmişe dönük olarak tüm şubelerin skorunu sessizce değiştirir; dönem
     * taşımak ise kayıtların ay bağlantısını tutarsız bırakır.
     */
    private function assertPuanlamaDegistirilebilir(Faaliyet $faaliyet, array $data): void
    {
        $kilitliAlanlar = array_filter(
            ['puan', 'hedef', 'donem_id'],
            fn (string $alan) => array_key_exists($alan, $data) && $data[$alan] != $faaliyet->{$alan}
        );

        if (!$kilitliAlanlar) {
            return;
        }

        $kayitSayisi = $faaliyet->kayitlar()->count();

        if ($kayitSayisi > 0) {
            throw ValidationException::withMessages([
                'puan' => "Bu faaliyete {$kayitSayisi} kayıt girilmiş; puan, hedef ve dönem artık değiştirilemez. Değişiklik geçmiş skorları da etkilerdi. Yeni bir faaliyet tanımlayıp bunu Pasif yapabilirsiniz.",
            ]);
        }
    }
}
