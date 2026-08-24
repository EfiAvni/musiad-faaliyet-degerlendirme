<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Birim;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class BirimController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Birim::withCount('subeler')->orderBy('name')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'         => 'required|string|max:255|unique:birimler,name',
            'status'       => 'nullable|in:active,passive',
            'created_year' => 'nullable|integer|min:1900|max:2099',
        ]);

        $data['status'] = $data['status'] ?? 'active';

        $birim = Birim::create($data);
        return response()->json($this->fresh($birim->id), 201);
    }

    public function show(int $birim): JsonResponse
    {
        return response()->json($this->fresh($birim) ?? abort(404));
    }

    public function update(Request $request, int $birim): JsonResponse
    {
        $record = Birim::findOrFail($birim);

        $data = $request->validate([
            'name'         => 'sometimes|string|max:255|unique:birimler,name,' . $birim,
            'status'       => 'sometimes|in:active,passive',
            'created_year' => 'nullable|integer|min:1900|max:2099',
        ]);

        $record->update($data);
        return response()->json($this->fresh($birim));
    }

    public function destroy(int $birim): JsonResponse
    {
        $record = Birim::findOrFail($birim);

        $subeSayisi = $record->subeler()->count();

        if ($subeSayisi > 0) {
            throw ValidationException::withMessages([
                'birim_id' => "Bu birime bağlı {$subeSayisi} şube var, birim silinemez. Önce şubeleri başka bir birime taşıyın.",
            ]);
        }

        $kullaniciSayisi = User::where('birim_id', $record->id)->count();

        if ($kullaniciSayisi > 0) {
            throw ValidationException::withMessages([
                'birim_id' => "Bu birime atanmış {$kullaniciSayisi} kullanıcı var, birim silinemez.",
            ]);
        }

        $record->delete();
        return response()->json(null, 204);
    }

    private function fresh(int $id): ?array
    {
        $b = Birim::find($id);
        if (!$b) return null;
        return [
            'id'            => $b->id,
            'name'          => $b->name,
            'yonetici_id'   => $b->yonetici_id,
            'status'        => $b->status,
            'created_year'  => $b->created_year,
            'subeler_count' => $b->subeler()->count(),
            'created_at'    => (string) $b->created_at,
            'updated_at'    => (string) $b->updated_at,
        ];
    }
}
