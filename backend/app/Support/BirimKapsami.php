<?php

namespace App\Support;

use App\Models\Sube;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Rol kontrolü "bu uç noktayı çağırabilir mi" sorusunu yanıtlar; bu sınıf
 * "hangi kayıtları görebilir" sorusunu yanıtlar. İkisi ayrı: birim yöneticisi
 * şube listesini çağırabilir ama yalnızca kendi biriminin şubelerini görmeli.
 *
 * Süper admin her şeyi görür. Birim yöneticisi kendi biriminin şubelerini,
 * şube yöneticisi yalnızca kendi şubesini görür.
 */
class BirimKapsami
{
    /** Kullanıcının erişebildiği şube id'leri; null ise kısıt yok (süper admin). */
    public static function subeIdleri(User $user): ?array
    {
        return match ($user->role) {
            'superadmin' => null,
            'birim_yoneticisi' => $user->birim_id
                ? Sube::where('birim_id', $user->birim_id)->pluck('id')->all()
                : [],
            default => $user->sube_id ? [$user->sube_id] : [],
        };
    }

    /** Şube sorgusunu kullanıcının kapsamına daraltır. */
    public static function subeSorgusu(Builder $query, User $user): Builder
    {
        return match ($user->role) {
            'superadmin' => $query,
            'birim_yoneticisi' => $user->birim_id
                ? $query->where('birim_id', $user->birim_id)
                : $query->whereRaw('1 = 0'),
            default => $user->sube_id
                ? $query->whereKey($user->sube_id)
                : $query->whereRaw('1 = 0'),
        };
    }

    /** Bir sorguyu sube_id kolonu üzerinden kullanıcının kapsamına daraltır. */
    public static function subeIdKolonunaGore(Builder $query, User $user, string $kolon = 'sube_id'): Builder
    {
        $idler = self::subeIdleri($user);

        return $idler === null ? $query : $query->whereIn($kolon, $idler);
    }

    public static function subeyeErisebilirMi(User $user, ?int $subeId): bool
    {
        $idler = self::subeIdleri($user);

        if ($idler === null) {
            return true;
        }

        return $subeId !== null && in_array($subeId, $idler, true);
    }
}
