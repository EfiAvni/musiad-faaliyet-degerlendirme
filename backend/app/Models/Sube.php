<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Sube extends Model
{
    use SoftDeletes;

    protected $table = 'subeler';

    // Şubeler tüm birimler için ortaktır; birim ayrışması dönem seviyesinde
    // yapılır (donemler.birim_id), şubede birim alanı tutulmaz.
    protected $fillable = [
        'name', 'yonetici_id', 'uye_sayisi', 'status',
    ];

    protected $casts = [
        'uye_sayisi' => 'integer',
    ];

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
