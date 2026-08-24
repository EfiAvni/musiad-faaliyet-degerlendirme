<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * İstemciye dönen tek kullanıcı gösterimi. Hem oturum uçları (/auth/login,
 * /auth/me) hem kullanıcı yönetimi (/users) bunu kullanır - böylece arayüzde
 * tek bir User tipi yeterli olur ve baş harf gibi türetilmiş alanlar iki yerde
 * ayrı ayrı hesaplanmaz.
 */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing(['birim:id,name', 'sube:id,name']);

        return [
            'id'        => $this->id,
            'name'      => $this->name,
            'email'     => $this->email,
            'role'      => $this->role,
            'birim_id'  => $this->birim_id,
            'sube_id'   => $this->sube_id,
            'birim_adi' => $this->birim?->name,
            'sube_adi'  => $this->sube?->name,
            'initials'  => self::basHarfler($this->name),
        ];
    }

    /** Ad ve soyadın baş harfleri - ikinci adlar atlanır (Muhammet Avni Küçük → MK). */
    public static function basHarfler(string $name): string
    {
        $parcalar = preg_split('/\s+/u', trim($name), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        if (!$parcalar) {
            return '?';
        }

        $secilen = count($parcalar) === 1
            ? [$parcalar[0]]
            : [$parcalar[0], end($parcalar)];

        return Str::upper(collect($secilen)
            ->map(fn (string $p) => Str::substr($p, 0, 1))
            ->implode(''));
    }
}
