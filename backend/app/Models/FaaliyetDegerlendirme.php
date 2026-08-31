<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Merkezin bir gönderim içindeki tek bir faaliyete verdiği puan
 * (gereksinim dokümanı bölüm 5). Yalnızca kriter türü "manuel" olan
 * faaliyetlerde kullanılır; diğer türler otomatik hesaplanır.
 */
class FaaliyetDegerlendirme extends Model
{
    protected $table = 'faaliyet_degerlendirmeleri';

    protected $fillable = [
        'ay_gonderim_id', 'faaliyet_id', 'puan', 'not', 'degerlendiren_id',
    ];

    protected $casts = [
        'puan' => 'integer',
    ];

    public function gonderim(): BelongsTo
    {
        return $this->belongsTo(AyGonderim::class, 'ay_gonderim_id');
    }

    public function faaliyet(): BelongsTo
    {
        return $this->belongsTo(Faaliyet::class);
    }

    public function degerlendiren(): BelongsTo
    {
        return $this->belongsTo(User::class, 'degerlendiren_id');
    }
}
