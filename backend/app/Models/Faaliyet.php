<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Support\PuanHesaplayici;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Faaliyet extends Model
{
    use SoftDeletes;

    protected $table = 'faaliyetler';

    protected $fillable = [
        'title', 'detay', 'puan', 'hedef', 'aciklama',
        'tarih_gerekli', 'donem_id', 'durum',
        'kriter_turu', 'kademeler', 'kategori',
    ];

    protected $casts = [
        'puan'          => 'integer',
        'hedef'         => 'integer',
        'tarih_gerekli' => 'boolean',
        'kademeler'     => 'array',
    ];

    protected $appends = ['max_puan'];

    public function donem(): BelongsTo
    {
        return $this->belongsTo(Donem::class);
    }

    public function kayitlar(): HasMany
    {
        return $this->hasMany(FaaliyetKayit::class);
    }

    /** Kriter türüne göre değişir; hesap PuanHesaplayici'da tek yerde durur. */
    public function getMaxPuanAttribute(): int
    {
        return PuanHesaplayici::maxPuan($this);
    }
}
