<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Birim extends Model
{
    protected $table = 'birimler';

    protected $fillable = ['name', 'yonetici_id', 'status', 'created_year'];

    public function subeler(): HasMany
    {
        return $this->hasMany(Sube::class);
    }
}
