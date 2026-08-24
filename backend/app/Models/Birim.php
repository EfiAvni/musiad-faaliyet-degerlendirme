<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Birim extends Model
{
    use SoftDeletes;

    protected $table = 'birimler';

    protected $fillable = ['name', 'yonetici_id', 'status', 'created_year'];

    public function subeler(): HasMany
    {
        return $this->hasMany(Sube::class);
    }
}
