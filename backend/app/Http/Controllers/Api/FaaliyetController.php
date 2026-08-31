<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Donem;
use App\Models\Faaliyet;
use App\Support\BirimKapsami;
use App\Support\PuanHesaplayici;
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
            'title'           => 'required|string|max:255',
            'detay'           => 'nullable|string',
            'puan'            => 'nullable|integer|min:0',
            'hedef'           => 'nullable|integer|min:0',
            'aciklama'        => 'nullable|string',
            'tarih_gerekli'   => 'nullable|boolean',
            'donem_id'        => 'required|exists:donemler,id',
            'durum'           => ['nullable', Rule::in(['active', 'completed', 'passive'])],
            'kriter_turu'     => ['nullable', Rule::in(PuanHesaplayici::TURLER)],
            'kademeler'       => 'nullable|array',
            'kademeler.*.esik' => 'required_with:kademeler|integer|min:0',
            'kademeler.*.puan' => 'required_with:kademeler|integer|min:0',
        ]);

        $data['kriter_turu'] = $data['kriter_turu'] ?? PuanHesaplayici::SAYI;
        $this->assertKriterTutarli($data['kriter_turu'], $data);

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
            'title'           => 'sometimes|string|max:255',
            'detay'           => 'nullable|string',
            'puan'            => 'sometimes|integer|min:0',
            'hedef'           => 'sometimes|integer|min:0',
            'aciklama'        => 'nullable|string',
            'tarih_gerekli'   => 'sometimes|boolean',
            'donem_id'        => 'sometimes|exists:donemler,id',
            'durum'           => ['sometimes', Rule::in(['active', 'completed', 'passive'])],
            'kriter_turu'     => ['sometimes', Rule::in(PuanHesaplayici::TURLER)],
            'kademeler'       => 'nullable|array',
            'kademeler.*.esik' => 'required_with:kademeler|integer|min:0',
            'kademeler.*.puan' => 'required_with:kademeler|integer|min:0',
        ]);

        $this->assertPuanlamaDegistirilebilir($faaliyet, $data);
        $this->assertKriterTutarli($data['kriter_turu'] ?? $faaliyet->kriter_turu, $data + $faaliyet->toArray());

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

    /**
     * Her kriter türü kendi alanlarına ihtiyaç duyar; eksik tanımlanmış bir
     * kriter sessizce sıfır puan üretir ve bu ancak dönem sonunda fark edilir.
     */
    private function assertKriterTutarli(string $tur, array $data): void
    {
        if ($tur === PuanHesaplayici::KADEMELI && empty($data['kademeler'])) {
            throw ValidationException::withMessages([
                'kademeler' => 'Kademeli kriterde en az bir kademe tanımlamalısınız (eşik ve puan).',
            ]);
        }

        if ($tur === PuanHesaplayici::ORAN && (int) ($data['hedef'] ?? 0) <= 0) {
            throw ValidationException::withMessages([
                'hedef' => 'Oran tipi kriterde hedef yüzde belirtmelisiniz (örneğin üyelerin %20\'si için 20).',
            ]);
        }

        if (in_array($tur, [PuanHesaplayici::EVET_HAYIR, PuanHesaplayici::MANUEL, PuanHesaplayici::ORAN], true)
            && (int) ($data['puan'] ?? 0) <= 0) {
            throw ValidationException::withMessages([
                'puan' => 'Bu kriter türünde alınabilecek puan sıfırdan büyük olmalıdır.',
            ]);
        }
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
