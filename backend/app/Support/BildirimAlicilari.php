<?php

namespace App\Support;

use App\Models\Donem;
use App\Models\Sube;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Bir bildirimin kime gideceğini belirler.
 *
 * Kapsam kuralları BirimKapsami ile aynı mantığı izler: merkez tarafı bir
 * dönemin birimiyle sınırlı, şube tarafı kendi şubesiyle. Alıcı seçimi tek
 * yerde durur - yoksa her çağrı kendi sorgusunu kurar ve biri kapsam
 * dışındaki bir kullanıcıya bildirim göndermeye başlar.
 */
class BildirimAlicilari
{
    /**
     * Dönemi inceleyebilecek merkez kullanıcıları: dönemin birimine bağlı
     * birim yöneticileri ve tüm süper adminler.
     *
     * @return Collection<int, User>
     */
    public static function merkez(?Donem $donem): Collection
    {
        if (!$donem) {
            return new Collection();
        }

        return User::query()
            ->where(function ($q) use ($donem) {
                $q->where('role', 'superadmin')
                    ->orWhere(fn ($sq) => $sq->where('role', 'birim_yoneticisi')
                        ->where('birim_id', $donem->birim_id));
            })
            ->get();
    }

    /**
     * Bir şubenin yöneticileri.
     *
     * @return Collection<int, User>
     */
    public static function sube(?int $subeId): Collection
    {
        if (!$subeId) {
            return new Collection();
        }

        return User::where('role', 'sube_yoneticisi')->where('sube_id', $subeId)->get();
    }

    /**
     * Dönemin kapsamındaki tüm şubelerin yöneticileri.
     *
     * Pasif şubeye bildirim gitmez: kayıt giremeyeceği bir dönem için haber
     * vermenin anlamı yok.
     *
     * @return Collection<int, User>
     */
    public static function donemKapsamindakiSubeler(Donem $donem): Collection
    {
        $subeQuery = $donem->tum_subeler ? Sube::query() : $donem->subeler();

        $subeIds = (clone $subeQuery)->where('subeler.status', 'active')->pluck('subeler.id');

        if ($subeIds->isEmpty()) {
            return new Collection();
        }

        return User::where('role', 'sube_yoneticisi')->whereIn('sube_id', $subeIds)->get();
    }
}
