<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sube extends Model
{
    protected $table = 'subeler';

    protected $fillable = [
        'name', 'birim_id', 'yonetici_id', 'uye_sayisi', 'status',
    ];

    protected $casts = [
        'uye_sayisi' => 'integer',
    ];

    public function birim(): BelongsTo
    {
        return $this->belongsTo(Birim::class);
    }

    public function yonetici(): BelongsTo
    {
        return $this->belongsTo(User::class, 'yonetici_id');
    }

    public function kayitlar(): HasMany
    {
        return $this->hasMany(FaaliyetKayit::class);
    }

    public function donemler(): BelongsToMany
    {
        return $this->belongsToMany(Donem::class, 'donem_sube');
    }
}
