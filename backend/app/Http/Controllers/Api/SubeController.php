<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Donem;
use App\Models\Faaliyet;
use App\Models\FaaliyetKayit;
use App\Models\Sube;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SubeController extends Controller
{
    public function index(): JsonResponse
    {
        $subeler = Sube::with('birim:id,name')->orderBy('name')->get();
        return response()->json($subeler);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'       => 'required|string|max:255|unique:subeler',
            'birim_id'   => 'nullable|exists:birimler,id',
            'uye_sayisi' => 'nullable|integer|min:0',
            'status'     => ['nullable', Rule::in(['active', 'passive'])],
        ]);

        $sube = Sube::create($data);
        return response()->json($sube->load('birim:id,name'), 201);
    }

    public function show(Sube $sube): JsonResponse
    {
        return response()->json($sube->load('birim:id,name'));
    }

    public function update(Request $request, Sube $sube): JsonResponse
    {
        $data = $request->validate([
            'name'       => ['sometimes', 'string', 'max:255', Rule::unique('subeler')->ignore($sube->id)],
            'birim_id'   => 'nullable|exists:birimler,id',
            'uye_sayisi' => 'nullable|integer|min:0',
            'status'     => ['nullable', Rule::in(['active', 'passive'])],
        ]);

        $sube->update($data);
        return response()->json($sube->load('birim:id,name'));
    }

    public function destroy(Sube $sube): JsonResponse
    {
        $sube->delete();
        return response()->json(null, 204);
    }

    public function puanOzeti(Request $request, Sube $sube): JsonResponse
    {
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

            if (Sube::where('name', $name)->exists()) {
                $skipped[] = $name;
                continue;
            }

            Sube::create([
                'name'       => $name,
                'uye_sayisi' => $item['uye_sayisi'] ?? 0,
                'birim_id'   => $item['birim_id'] ?? null,
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
