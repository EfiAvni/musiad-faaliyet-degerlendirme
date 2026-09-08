<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
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

    /** Pasif faaliyet artık kullanılmayan bir kriterdir; puanlamanın dışındadır. */
    public function pasifMi(): bool
    {
        return $this->durum === 'passive';
    }

    /**
     * Değerlendirmeye giren kriterler.
     *
     * Pasif yapılan bir kriter ne puan üretir ne de tavana eklenir - dönem
     * raporu, şube puan özeti ve yıllık rapor bu kapıdan geçer. Payda tüm
     * şubeler için aynı daraldığından karşılaştırma bozulmaz; silinemeyen
     * (kaydı olan) bir kriteri değerlendirmeden çıkarmanın tek yolu budur.
     */
    public function scopeDegerlendirmeye(Builder $query): Builder
    {
        return $query->where('durum', '!=', 'passive');
    }

    /** Kriter türüne göre değişir; hesap PuanHesaplayici'da tek yerde durur. */
    public function getMaxPuanAttribute(): int
    {
        return PuanHesaplayici::maxPuan($this);
    }
}
