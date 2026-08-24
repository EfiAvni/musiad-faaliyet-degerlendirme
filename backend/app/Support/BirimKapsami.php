<?php

namespace App\Support;

use App\Models\Donem;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Rol kontrolü "bu uç noktayı çağırabilir mi" sorusunu yanıtlar; bu sınıf
 * "hangi kayıtları görebilir" sorusunu yanıtlar.
 *
 * Veri modeli: şubeler tüm birimler için ortaktır - MÜSİAD Ankara hem
 * Teşkilatlanma'nın hem GENÇ MÜSİAD'ın şubesidir. Ayrışma dönem seviyesinde
 * olur: her dönem tek bir birime aittir.
 *
 *   Süper admin      : her şeyi görür.
 *   Birim yöneticisi : tüm şubeleri, ama yalnızca kendi biriminin dönemlerini.
 *   Şube yöneticisi  : tüm birimlerin dönemlerini, ama yalnızca kendi şubesine
 *                      ait kayıtları (tek hesapla her birime kayıt girer).
 */
class BirimKapsami
{
    /** Kullanıcı yalnızca tek bir birimin verisiyle mi sınırlı? */
    public static function birimIleSinirliMi(User $user): bool
    {
        return $user->role === 'birim_yoneticisi';
    }

    /** Kullanıcı yalnızca tek bir şubenin kayıtlarıyla mı sınırlı? */
    public static function subeIleSinirliMi(User $user): bool
    {
        return $user->role === 'sube_yoneticisi';
    }

    /** Dönem sorgusunu kullanıcının birimine daraltır. */
    public static function donemSorgusu(Builder $query, User $user): Builder
    {
        if (!self::birimIleSinirliMi($user)) {
            return $query;
        }

        return $user->birim_id
            ? $query->where('birim_id', $user->birim_id)
            : $query->whereRaw('1 = 0');
    }

    /** Dönem ilişkisi üzerinden dolaylı olarak daraltır (faaliyetler gibi). */
    public static function donemIliskisineGore(Builder $query, User $user, string $iliski = 'donem'): Builder
    {
        if (!self::birimIleSinirliMi($user)) {
            return $query;
        }

        return $user->birim_id
            ? $query->whereHas($iliski, fn (Builder $q) => $q->where('birim_id', $user->birim_id))
            : $query->whereRaw('1 = 0');
    }

    public static function donemeErisebilirMi(User $user, ?Donem $donem): bool
    {
        if (!$donem) {
            return false;
        }

        if (!self::birimIleSinirliMi($user)) {
            return true;
        }

        return $user->birim_id !== null && $donem->birim_id === $user->birim_id;
    }

    /**
     * Şube yöneticisi ayrıca dönemin kapsamında olmalı - bir dönem yalnızca
     * belirli şubeler için açılmış olabilir.
     */
    public static function donemKapsamindaMi(User $user, Donem $donem): bool
    {
        if (!self::subeIleSinirliMi($user)) {
            return self::donemeErisebilirMi($user, $donem);
        }

        return $donem->subeErisimVarMi($user->sube_id);
    }
}
