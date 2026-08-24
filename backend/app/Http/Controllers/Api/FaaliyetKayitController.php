<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DonemAy;
use App\Models\Faaliyet;
use App\Models\FaaliyetKayit;
use App\Support\BirimKapsami;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class FaaliyetKayitController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = FaaliyetKayit::with([
            'faaliyet:id,title,puan,hedef,donem_id',
            'donemAy:id,name,sira,start_date,end_date,acik_override,donem_id',
            'sube:id,name',
        ])->orderByDesc('created_at');

        // Şube yöneticisi tüm birimlere kayıt girer ama yalnızca kendi şubesine;
        // birim yöneticisi tüm şubeleri görür ama yalnızca kendi biriminin
        // dönemlerindeki faaliyetler için.
        if (BirimKapsami::subeIleSinirliMi($user)) {
            if (!$user->sube_id) {
                return response()->json([]);
            }
            $query->where('sube_id', $user->sube_id);
        } elseif ($request->filled('sube_id')) {
            $query->where('sube_id', $request->integer('sube_id'));
        }

        BirimKapsami::donemIliskisineGore($query, $user, 'faaliyet.donem');

        if ($request->filled('faaliyet_id')) {
            $query->where('faaliyet_id', $request->integer('faaliyet_id'));
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'sube_yoneticisi' || !$user->sube_id) {
            throw ValidationException::withMessages([
                'sube_id' => 'Bu işlem yalnızca bir şubeye bağlı şube yöneticileri tarafından yapılabilir.',
            ]);
        }

        $data = $request->validate([
            'faaliyet_id' => 'required|exists:faaliyetler,id',
            'tarih'       => 'nullable|date',
            'deger'       => 'required|string',
            'aciklama'    => 'nullable|string',
        ]);

        $faaliyet = Faaliyet::with(['donem.aylar', 'donem.subeler'])->findOrFail($data['faaliyet_id']);

        if (!$faaliyet->donem || $faaliyet->donem->status !== 'active') {
            throw ValidationException::withMessages([
                'faaliyet_id' => 'Bu faaliyet aktif bir döneme ait değil, kayıt eklenemez.',
            ]);
        }

        if (!$faaliyet->donem->subeErisimVarMi($user->sube_id)) {
            throw ValidationException::withMessages([
                'faaliyet_id' => 'Bu faaliyet şubenizin kapsamında olan bir döneme ait değil.',
            ]);
        }

        if ($faaliyet->tarih_gerekli && empty($data['tarih'])) {
            throw ValidationException::withMessages([
                'tarih' => 'Bu faaliyet için tarih seçimi zorunludur.',
            ]);
        }

        $acikAy = $faaliyet->donem->aylar->first(fn ($ay) => $ay->acik);

        if (!$acikAy) {
            throw ValidationException::withMessages([
                'donem_ay_id' => 'Şu anda açık bir değerlendirme ayı bulunmuyor. Birim yöneticinizle iletişime geçin.',
            ]);
        }

        $this->assertTarihAyIcinde($acikAy, $data['tarih'] ?? null);

        $kayit = FaaliyetKayit::create([
            'faaliyet_id' => $faaliyet->id,
            'sube_id'     => $user->sube_id,
            'donem_ay_id' => $acikAy->id,
            'tarih'       => $data['tarih'] ?? null,
            'deger'       => $data['deger'],
            'aciklama'    => $data['aciklama'] ?? null,
            'created_by'  => $user->id,
        ]);

        return response()->json($kayit->load(['donemAy:id,name,sira,start_date,end_date,acik_override,donem_id', 'faaliyet:id,title,puan,hedef,donem_id']), 201);
    }

    public function update(Request $request, FaaliyetKayit $kayit): JsonResponse
    {
        $user = $request->user();
        if ($kayit->sube_id !== $user->sube_id) {
            abort(403, 'Bu kaydı düzenleme yetkiniz yok.');
        }
        if (!$kayit->donemAy->acik) {
            throw ValidationException::withMessages([
                'donem_ay_id' => 'Bu kaydın ait olduğu değerlendirme ayı artık kapalı, düzenlenemez.',
            ]);
        }

        $data = $request->validate([
            'tarih'    => 'nullable|date',
            'deger'    => 'sometimes|string',
            'aciklama' => 'nullable|string',
        ]);

        if (array_key_exists('tarih', $data)) {
            $this->assertTarihAyIcinde($kayit->donemAy, $data['tarih']);
        }

        $kayit->update($data);
        return response()->json($kayit->fresh()->load(['donemAy:id,name,sira,start_date,end_date,acik_override,donem_id', 'faaliyet:id,title,puan,hedef,donem_id']));
    }

    public function destroy(Request $request, FaaliyetKayit $kayit): JsonResponse
    {
        $user = $request->user();
        if ($kayit->sube_id !== $user->sube_id) {
            abort(403, 'Bu kaydı silme yetkiniz yok.');
        }
        if (!$kayit->donemAy->acik) {
            throw ValidationException::withMessages([
                'donem_ay_id' => 'Bu kaydın ait olduğu değerlendirme ayı artık kapalı, silinemez.',
            ]);
        }

        $kayit->delete();
        return response()->json(null, 204);
    }

    private function assertTarihAyIcinde(DonemAy $ay, ?string $tarih): void
    {
        if (!$tarih) {
            return;
        }

        $secilen = Carbon::parse($tarih)->startOfDay();
        $start = $ay->start_date->copy()->startOfDay();
        $end = $ay->end_date->copy()->endOfDay();

        if ($secilen->lt($start) || $secilen->gt($end)) {
            throw ValidationException::withMessages([
                'tarih' => "Seçilen tarih {$ay->name} ayı aralığının (" . $start->format('d.m.Y') . ' - ' . $end->format('d.m.Y') . ') dışında olamaz.',
            ]);
        }
    }
}
