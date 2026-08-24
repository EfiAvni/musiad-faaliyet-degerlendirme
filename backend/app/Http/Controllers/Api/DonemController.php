<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Donem;
use App\Models\DonemAy;
use App\Models\FaaliyetKayit;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DonemController extends Controller
{
    private const AY_ADLARI = [
        1 => 'Ocak', 2 => 'Şubat', 3 => 'Mart', 4 => 'Nisan',
        5 => 'Mayıs', 6 => 'Haziran', 7 => 'Temmuz', 8 => 'Ağustos',
        9 => 'Eylül', 10 => 'Ekim', 11 => 'Kasım', 12 => 'Aralık',
    ];

    public function index(Request $request): JsonResponse
    {
        $query = Donem::withCount(['aylar', 'faaliyetler'])
            ->with('subeler:id,name')
            ->orderByDesc('start_date');

        $this->scopeToSube($query, $request->user());

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:255|unique:donemler',
            'start_date'  => 'required|date',
            'end_date'    => 'required|date|after_or_equal:start_date',
            'tum_subeler' => 'sometimes|boolean',
            'sube_ids'    => 'sometimes|array',
            'sube_ids.*'  => 'integer|exists:subeler,id',
        ]);

        $tumSubeler = $data['tum_subeler'] ?? true;
        $subeIds = $data['sube_ids'] ?? [];

        if (!$tumSubeler && empty($subeIds)) {
            throw ValidationException::withMessages([
                'sube_ids' => 'Belirli şubeler seçtiğinizde en az bir şube seçmelisiniz.',
            ]);
        }

        $start = Carbon::parse($data['start_date'])->startOfMonth();
        $end = Carbon::parse($data['end_date'])->startOfMonth();
        $this->assertAyAraligiGecerli($start, $end);

        $donem = DB::transaction(function () use ($data, $start, $end, $tumSubeler, $subeIds) {
            $donem = Donem::create([
                'name'        => $data['name'],
                'start_date'  => $start,
                'end_date'    => $end->copy()->endOfMonth(),
                'status'      => 'pending',
                'tum_subeler' => $tumSubeler,
            ]);

            if (!$tumSubeler) {
                $donem->subeler()->sync($subeIds);
            }

            $this->generateAylar($donem, $start, $end);

            return $donem;
        });

        return response()->json($donem->load(['aylar', 'subeler:id,name']), 201);
    }

    public function show(Request $request, Donem $donem): JsonResponse
    {
        $user = $request->user();
        if ($user->role === 'sube_yoneticisi' && !$donem->subeErisimVarMi($user->sube_id)) {
            abort(403, 'Bu döneme erişim yetkiniz yok.');
        }

        return response()->json(
            $donem->load(['aylar', 'subeler:id,name'])->loadCount('faaliyetler')
        );
    }

    public function update(Request $request, Donem $donem): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['sometimes', 'string', 'max:255', Rule::unique('donemler')->ignore($donem->id)],
            'start_date'  => 'sometimes|date',
            'end_date'    => 'sometimes|date',
            'tum_subeler' => 'sometimes|boolean',
            'sube_ids'    => 'sometimes|array',
            'sube_ids.*'  => 'integer|exists:subeler,id',
        ]);

        $tarihDegisiyor = array_key_exists('start_date', $data) || array_key_exists('end_date', $data);
        $kapsamDegisiyor = array_key_exists('tum_subeler', $data) || array_key_exists('sube_ids', $data);

        if (($tarihDegisiyor || $kapsamDegisiyor) && $donem->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => 'Sadece taslak (henüz aktif edilmemiş) dönemlerin tarih aralığı ve şube kapsamı değiştirilebilir.',
            ]);
        }

        if ($kapsamDegisiyor) {
            $tumSubeler = $data['tum_subeler'] ?? $donem->tum_subeler;
            $subeIds = $data['sube_ids'] ?? [];

            if (!$tumSubeler && empty($subeIds)) {
                throw ValidationException::withMessages([
                    'sube_ids' => 'Belirli şubeler seçtiğinizde en az bir şube seçmelisiniz.',
                ]);
            }
        }

        if ($tarihDegisiyor) {
            $start = isset($data['start_date'])
                ? Carbon::parse($data['start_date'])->startOfMonth()
                : $donem->start_date->copy()->startOfMonth();
            $end = isset($data['end_date'])
                ? Carbon::parse($data['end_date'])->startOfMonth()
                : $donem->end_date->copy()->startOfMonth();

            if ($end->lt($start)) {
                throw ValidationException::withMessages([
                    'end_date' => 'Bitiş ayı başlangıç ayından önce olamaz.',
                ]);
            }
            $this->assertAyAraligiGecerli($start, $end);

            DB::transaction(function () use ($donem, $data, $start, $end, $kapsamDegisiyor) {
                $donem->update([
                    'name'        => $data['name'] ?? $donem->name,
                    'start_date'  => $start,
                    'end_date'    => $end->copy()->endOfMonth(),
                    'tum_subeler' => $data['tum_subeler'] ?? $donem->tum_subeler,
                ]);

                if ($kapsamDegisiyor) {
                    $donem->subeler()->sync($donem->tum_subeler ? [] : ($data['sube_ids'] ?? []));
                }

                $donem->aylar()->delete();
                $this->generateAylar($donem, $start, $end);
            });
        } else {
            DB::transaction(function () use ($donem, $data, $kapsamDegisiyor) {
                if (array_key_exists('name', $data)) {
                    $donem->update(['name' => $data['name']]);
                }

                if ($kapsamDegisiyor) {
                    $donem->update(['tum_subeler' => $data['tum_subeler'] ?? $donem->tum_subeler]);
                    $donem->subeler()->sync($donem->tum_subeler ? [] : ($data['sube_ids'] ?? []));
                }
            });
        }

        return response()->json($donem->fresh()->load(['aylar', 'subeler:id,name']));
    }

    public function destroy(Donem $donem): JsonResponse
    {
        if ($donem->status === 'active') {
            throw ValidationException::withMessages([
                'status' => 'Aktif dönem silinemez. Önce dönemi tamamlayın, sonra silin.',
            ]);
        }

        $kayitSayisi = FaaliyetKayit::whereIn('faaliyet_id', $donem->faaliyetler()->select('id'))->count();

        if ($kayitSayisi > 0) {
            throw ValidationException::withMessages([
                'status' => "Bu döneme ait {$kayitSayisi} faaliyet kaydı var, dönem silinemez. Geçmiş dönem verileri raporlama için korunur.",
            ]);
        }

        // Dönem silinince ona bağlı faaliyetler de sorgulardan düşmeli; yumuşak
        // silme zincirleme çalışmadığı için burada açıkça yapıyoruz.
        DB::transaction(function () use ($donem) {
            $donem->faaliyetler()->delete();
            $donem->delete();
        });

        return response()->json(null, 204);
    }

    public function activate(Donem $donem): JsonResponse
    {
        if ($donem->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => 'Sadece taslak dönemler aktif edilebilir. Tamamlanmış bir dönem tekrar aktif edilemez.',
            ]);
        }

        $donem->update(['status' => 'active']);

        return response()->json($donem->fresh()->load('aylar'));
    }

    public function complete(Donem $donem): JsonResponse
    {
        if ($donem->status !== 'active') {
            throw ValidationException::withMessages([
                'status' => 'Sadece aktif dönem tamamlanabilir.',
            ]);
        }

        $donem->update(['status' => 'completed']);

        return response()->json($donem->fresh()->load('aylar'));
    }

    public function updateAy(Request $request, DonemAy $ay): JsonResponse
    {
        $data = $request->validate([
            'acik_override' => 'present|nullable|boolean',
        ]);

        $ay->update(['acik_override' => $data['acik_override']]);

        return response()->json($ay->fresh());
    }

    private function scopeToSube($query, $user): void
    {
        if ($user->role !== 'sube_yoneticisi') {
            return;
        }

        $query->where(function ($q) use ($user) {
            $q->where('tum_subeler', true);
            if ($user->sube_id) {
                $q->orWhereHas('subeler', fn ($sq) => $sq->where('subeler.id', $user->sube_id));
            }
        });
    }

    private function generateAylar(Donem $donem, Carbon $start, Carbon $end): void
    {
        $ayStart = $start->copy();
        $sira = 1;

        while ($ayStart->lte($end)) {
            DonemAy::create([
                'donem_id'   => $donem->id,
                'sira'       => $sira,
                'name'       => self::AY_ADLARI[$ayStart->month] . ' ' . $ayStart->year,
                'start_date' => $ayStart->copy(),
                'end_date'   => $ayStart->copy()->endOfMonth(),
            ]);

            $ayStart->addMonth();
            $sira++;
        }
    }

    private function assertAyAraligiGecerli(Carbon $start, Carbon $end): void
    {
        $ayFarki = $start->diffInMonths($end) + 1;

        if ($ayFarki > 60) {
            throw ValidationException::withMessages([
                'end_date' => 'Dönem aralığı en fazla 60 ay (5 yıl) olabilir.',
            ]);
        }
    }
}
