<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class FaaliyetKayit extends Model
{
    use SoftDeletes;

    protected $table = 'faaliyet_kayitlari';

    protected $fillable = [
        'faaliyet_id', 'sube_id', 'donem_ay_id', 'tarih', 'deger', 'aciklama', 'created_by',
    ];

    protected $casts = [
        'tarih' => 'date',
    ];

    public function faaliyet(): BelongsTo
    {
        return $this->belongsTo(Faaliyet::class);
    }

    public function sube(): BelongsTo
    {
        return $this->belongsTo(Sube::class);
    }

    public function donemAy(): BelongsTo
    {
        return $this->belongsTo(DonemAy::class, 'donem_ay_id');
    }

    public function olusturan(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
