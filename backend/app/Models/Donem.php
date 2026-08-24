<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Donem extends Model
{
    use SoftDeletes;

    protected $table = 'donemler';

    protected $fillable = [
        'name', 'start_date', 'end_date', 'status', 'tum_subeler',
    ];

    protected $casts = [
        'start_date'  => 'date',
        'end_date'    => 'date',
        'tum_subeler' => 'boolean',
    ];

    protected $appends = ['periyot_tipi'];

    public function getPeriyotTipiAttribute(): string
    {
        // Bazı sorgular Donem'i kısıtlı kolonlarla eager-load eder (ör.
        // Faaliyet::with('donem:id,name,status')) - bu durumda start_date/
        // end_date seçilmemiş olur ve null gelir. $appends serialize sırasında
        // bu accessor'ı koşulsuz çağırdığı için null-guard olmadan çöker.
        if (!$this->start_date || !$this->end_date) {
            return 'custom';
        }

        // Calendar-month count (not diffInMonths(), which measures fractional
        // day-based distance and never lands on a clean integer for whole-month
        // ranges - e.g. July 1 to July 31 same year/month must count as 1 ay).
        $ayCount = ($this->end_date->year - $this->start_date->year) * 12
            + ($this->end_date->month - $this->start_date->month) + 1;

        return match (true) {
            $ayCount <= 1 => 'monthly',
            $ayCount === 3 => 'quarterly',
            $ayCount === 6 => 'semi_annual',
            $ayCount === 12 => 'annual',
            default => 'custom',
        };
    }

    public function aylar(): HasMany
    {
        return $this->hasMany(DonemAy::class)->orderBy('sira');
    }

    public function faaliyetler(): HasMany
    {
        return $this->hasMany(Faaliyet::class);
    }

    public function subeler(): BelongsToMany
    {
        return $this->belongsToMany(Sube::class, 'donem_sube');
    }

    public function subeErisimVarMi(?int $subeId): bool
    {
        if ($this->tum_subeler) {
            return true;
        }

        if (!$subeId) {
            return false;
        }

        return $this->relationLoaded('subeler')
            ? $this->subeler->contains('id', $subeId)
            : $this->subeler()->where('subeler.id', $subeId)->exists();
    }
}
