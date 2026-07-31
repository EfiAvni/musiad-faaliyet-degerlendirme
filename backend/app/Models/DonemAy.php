<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DonemAy extends Model
{
    protected $table = 'donem_aylar';

    protected $fillable = [
        'donem_id', 'sira', 'name', 'start_date', 'end_date', 'acik_override',
    ];

    protected $casts = [
        'start_date'    => 'date',
        'end_date'      => 'date',
        'acik_override' => 'boolean',
    ];

    protected $appends = ['acik'];

    public function donem(): BelongsTo
    {
        return $this->belongsTo(Donem::class);
    }

    public function getAcikAttribute(): bool
    {
        if (!is_null($this->acik_override)) {
            return $this->acik_override;
        }

        if (!$this->start_date || !$this->end_date) {
            return false;
        }

        $bugun = now()->startOfDay();
        return $bugun->between($this->start_date, $this->end_date);
    }
}
