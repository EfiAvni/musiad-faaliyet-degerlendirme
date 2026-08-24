<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Donem;
use App\Models\Faaliyet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FaaliyetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Faaliyet::with('donem:id,name,status')->orderByDesc('created_at');

        if ($request->filled('donem_id')) {
            $query->where('donem_id', $request->integer('donem_id'));
        }

        $user = $request->user();
        if ($user->role === 'sube_yoneticisi') {
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

    public function show(Faaliyet $faaliyet): JsonResponse
    {
        return response()->json($faaliyet->load('donem:id,name,status'));
    }

    public function update(Request $request, Faaliyet $faaliyet): JsonResponse
    {
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

        $faaliyet->update($data);
        return response()->json($faaliyet->fresh()->load('donem:id,name,status'));
    }

    public function destroy(Faaliyet $faaliyet): JsonResponse
    {
        $kayitSayisi = $faaliyet->kayitlar()->count();

        if ($kayitSayisi > 0) {
            throw ValidationException::withMessages([
                'faaliyet_id' => "Bu faaliyete {$kayitSayisi} şube kaydı girilmiş, silinemez. Faaliyeti kapatmak için durumunu Pasif yapın.",
            ]);
        }

        $faaliyet->delete();
        return response()->json(null, 204);
    }
}
