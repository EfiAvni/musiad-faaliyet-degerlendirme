<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AyGonderim;
use App\Models\DonemAy;
use App\Models\FaaliyetKayit;
use App\Support\BirimKapsami;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Şubenin ayı merkeze göndermesi ve merkezin incelemesi (doküman bölüm 11-12).
 *
 * Yetki: gönderme yalnızca şube yöneticisine, inceleme yalnızca merkeze
 * (süper admin + birim yöneticisi) açıktır. Rota tanımları bunu ayırır;
 * burada ek olarak kapsam kontrolü yapılır - birim yöneticisi yalnızca kendi
 * biriminin dönemlerine ait gönderimleri görebilir.
 */
class GonderimController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = AyGonderim::with([
            'sube:id,name',
            'donemAy:id,name,sira,start_date,end_date,acik_override,donem_id',
            'donemAy.donem:id,name,birim_id,status',
            'gonderen:id,name',
            'degerlendiren:id,name',
        ])->orderByDesc('gonderildi_at');

        if (BirimKapsami::subeIleSinirliMi($user)) {
            if (!$user->sube_id) {
                return response()->json([]);
            }
            $query->where('sube_id', $user->sube_id);
        } else {
            // Merkez: yalnızca kendi biriminin dönemlerine ait gönderimler.
            BirimKapsami::donemIliskisineGore($query, $user, 'donemAy.donem');

            if ($request->filled('sube_id')) {
                $query->where('sube_id', $request->integer('sube_id'));
            }
        }

        if ($request->filled('durum')) {
            $query->where('durum', $request->string('durum')->toString());
        }

        if ($request->filled('donem_id')) {
            $donemId = $request->integer('donem_id');
            $query->whereHas('donemAy', fn (Builder $q) => $q->where('donem_id', $donemId));
        }

        return response()->json($query->get());
    }

    /** Şube ayını merkeze gönderir; düzeltme istenmişse tekrar gönderir. */
    public function gonder(Request $request, DonemAy $ay): JsonResponse
    {
        $user = $request->user();

        if (!BirimKapsami::subeIleSinirliMi($user) || !$user->sube_id) {
            throw ValidationException::withMessages([
                'sube_id' => 'Dönemi yalnızca bir şubeye bağlı şube yöneticileri gönderebilir.',
            ]);
        }

        $donem = $ay->donem;

        if (!$donem || $donem->status !== 'active') {
            throw ValidationException::withMessages([
                'donem_ay_id' => 'Bu ay aktif bir döneme ait değil, gönderilemez.',
            ]);
        }

        if (!$donem->subeErisimVarMi($user->sube_id)) {
            abort(403, 'Bu dönem şubenizin kapsamında değil.');
        }

        $gonderim = AyGonderim::where('donem_ay_id', $ay->id)
            ->where('sube_id', $user->sube_id)
            ->first();

        if ($gonderim && !$gonderim->subeDuzenleyebilirMi()) {
            throw ValidationException::withMessages([
                'durum' => $gonderim->durum === AyGonderim::ONAYLANDI
                    ? 'Bu ay merkez tarafından onaylandı, tekrar gönderilemez.'
                    : 'Bu ay zaten merkeze gönderildi, inceleme bekleniyor.',
            ]);
        }

        // Boş ay göndermek merkezi gereksiz incelemeye sokar.
        $kayitSayisi = FaaliyetKayit::where('sube_id', $user->sube_id)
            ->where('donem_ay_id', $ay->id)
            ->count();

        if ($kayitSayisi === 0) {
            throw ValidationException::withMessages([
                'donem_ay_id' => 'Bu ay için hiç kayıt girilmemiş. Göndermeden önce en az bir faaliyet kaydı ekleyin.',
            ]);
        }

        $gonderim = AyGonderim::updateOrCreate(
            ['donem_ay_id' => $ay->id, 'sube_id' => $user->sube_id],
            [
                'durum'              => AyGonderim::GONDERILDI,
                'gonderildi_at'      => now(),
                'gonderen_id'        => $user->id,
                // Yeniden gönderimde önceki değerlendirme izleri temizlenir.
                'degerlendirildi_at' => null,
                'degerlendiren_id'   => null,
            ],
        );

        return response()->json($this->taze($gonderim), $gonderim->wasRecentlyCreated ? 201 : 200);
    }

    /** Merkez ayı onaylar; şube artık o ayda değişiklik yapamaz. */
    public function onayla(Request $request, AyGonderim $gonderim): JsonResponse
    {
        $this->assertMerkezErisimi($request, $gonderim);

        $data = $request->validate([
            'merkez_notu' => 'nullable|string|max:2000',
        ]);

        if ($gonderim->durum !== AyGonderim::GONDERILDI) {
            throw ValidationException::withMessages([
                'durum' => 'Yalnızca gönderilmiş ve inceleme bekleyen aylar onaylanabilir.',
            ]);
        }

        $gonderim->update([
            'durum'              => AyGonderim::ONAYLANDI,
            'degerlendirildi_at' => now(),
            'degerlendiren_id'   => $request->user()->id,
            'merkez_notu'        => $data['merkez_notu'] ?? null,
        ]);

        return response()->json($this->taze($gonderim));
    }

    /** Merkez düzeltme ister; şube düzeltip tekrar gönderebilir. */
    public function duzeltmeIste(Request $request, AyGonderim $gonderim): JsonResponse
    {
        $this->assertMerkezErisimi($request, $gonderim);

        // Şubenin neyi düzelteceğini bilmesi gerekir; açıklama zorunlu.
        $data = $request->validate([
            'merkez_notu' => 'required|string|min:5|max:2000',
        ], [], ['merkez_notu' => 'açıklama']);

        if (!in_array($gonderim->durum, [AyGonderim::GONDERILDI, AyGonderim::ONAYLANDI], true)) {
            throw ValidationException::withMessages([
                'durum' => 'Bu ay için zaten düzeltme bekleniyor.',
            ]);
        }

        $gonderim->update([
            'durum'              => AyGonderim::DUZELTME_BEKLIYOR,
            'degerlendirildi_at' => now(),
            'degerlendiren_id'   => $request->user()->id,
            'merkez_notu'        => $data['merkez_notu'],
        ]);

        return response()->json($this->taze($gonderim));
    }

    private function assertMerkezErisimi(Request $request, AyGonderim $gonderim): void
    {
        $donem = $gonderim->donemAy?->donem;

        if (!BirimKapsami::donemeErisebilirMi($request->user(), $donem)) {
            abort(403, 'Bu gönderim sizin biriminizin kapsamında değil.');
        }
    }

    private function taze(AyGonderim $gonderim): AyGonderim
    {
        return $gonderim->fresh([
            'sube:id,name',
            'donemAy:id,name,sira,start_date,end_date,acik_override,donem_id',
            'gonderen:id,name',
            'degerlendiren:id,name',
        ]);
    }
}
