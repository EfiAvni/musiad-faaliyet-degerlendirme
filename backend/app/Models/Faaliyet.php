<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Faaliyet extends Model
{
    use SoftDeletes;

    protected $table = 'faaliyetler';

    protected $fillable = [
        'title', 'detay', 'puan', 'hedef', 'aciklama',
        'tarih_gerekli', 'donem_id', 'durum',
    ];

    protected $casts = [
        'puan'          => 'integer',
        'hedef'         => 'integer',
        'tarih_gerekli' => 'boolean',
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

    public function getMaxPuanAttribute(): int
    {
        return $this->puan * $this->hedef;
    }
}
