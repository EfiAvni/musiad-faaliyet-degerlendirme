<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /** Sistemdeki geçerli roller - doğrulama kuralları buradan beslenir. */
    public const ROLLER = ['superadmin', 'birim_yoneticisi', 'sube_yoneticisi'];

    protected $fillable = [
        'name', 'email', 'password', 'role', 'birim_id', 'sube_id',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
        ];
    }

    public function birim()
    {
        return $this->belongsTo(Birim::class);
    }

    public function sube()
    {
        return $this->belongsTo(Sube::class);
    }
}
