<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Bir şubenin bir değerlendirme ayını merkeze göndermesi ve merkezin bunu
 * incelemesi. Doküman bölüm 11-12'deki akış:
 *
 *   taslak ──gönder──> gonderildi ──onayla──> onaylandi
 *                          │                      │
 *                   düzeltme iste             geri aç
 *                          ↓                      │
 *                  duzeltme_bekliyor <────────────┘
 *                          │
 *                     tekrar gönder ──> gonderildi
 *
 * "taslak" veritabanında satır olarak tutulmaz: gönderim kaydı yoksa o ay
 * taslaktır. Böylece her ay × her şube için önceden satır açmak gerekmez.
 */
class AyGonderim extends Model
{
    use SoftDeletes;

    protected $table = 'ay_gonderimleri';

    public const TASLAK = 'taslak';
    public const GONDERILDI = 'gonderildi';
    public const DUZELTME_BEKLIYOR = 'duzeltme_bekliyor';
    public const ONAYLANDI = 'onaylandi';

    /** Şubenin kayıt girip değiştirebildiği durumlar. */
    public const DUZENLENEBILIR_DURUMLAR = [self::TASLAK, self::DUZELTME_BEKLIYOR];

    protected $fillable = [
        'donem_ay_id', 'sube_id', 'durum',
        'gonderildi_at', 'gonderen_id',
        'degerlendirildi_at', 'degerlendiren_id',
        'merkez_notu',
    ];

    protected $casts = [
        'gonderildi_at'      => 'datetime',
        'degerlendirildi_at' => 'datetime',
    ];

    public function donemAy(): BelongsTo
    {
        return $this->belongsTo(DonemAy::class, 'donem_ay_id');
    }

    public function sube(): BelongsTo
    {
        return $this->belongsTo(Sube::class);
    }

    public function gonderen(): BelongsTo
    {
        return $this->belongsTo(User::class, 'gonderen_id');
    }

    public function degerlendiren(): BelongsTo
    {
        return $this->belongsTo(User::class, 'degerlendiren_id');
    }

    /** Şube bu ayda hâlâ kayıt ekleyip değiştirebilir mi? */
    public function subeDuzenleyebilirMi(): bool
    {
        return in_array($this->durum, self::DUZENLENEBILIR_DURUMLAR, true);
    }

    /**
     * Gönderim kaydı olmayan ay taslaktır. Kayıt yoksa null döner, çağıran
     * taraf bunu "taslak" olarak yorumlar - bu yardımcı o yorumu tek yerde tutar.
     */
    public static function durumFor(?self $gonderim): string
    {
        return $gonderim?->durum ?? self::TASLAK;
    }

    public static function subeDuzenleyebilirMiFor(?self $gonderim): bool
    {
        return in_array(self::durumFor($gonderim), self::DUZENLENEBILIR_DURUMLAR, true);
    }
}
