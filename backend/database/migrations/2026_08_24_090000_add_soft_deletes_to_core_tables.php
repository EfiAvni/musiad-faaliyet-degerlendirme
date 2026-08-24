<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Çekirdek tabloların tamamı zincirleme silme (cascade) ile bağlı olduğu için
     * tek bir kalıcı silme, bağlı tüm geçmiş kayıtları da götürüyordu. Yumuşak
     * silme bu zinciri devre dışı bırakır: satır tabloda kalır, sorgulardan düşer.
     *
     * donem_aylar bilinçli olarak dışarıda: taslak dönemin ay aralığı
     * değiştirildiğinde aylar silinip yeniden üretiliyor ve bu kalıcı olmalı.
     */
    private const TABLOLAR = [
        'birimler',
        'subeler',
        'donemler',
        'faaliyetler',
        'faaliyet_kayitlari',
        // Kullanıcı silinince faaliyet_kayitlari.created_by boşalıyor ve kaydı
        // kimin girdiği kalıcı olarak kayboluyordu.
        'users',
    ];

    public function up(): void
    {
        foreach (self::TABLOLAR as $tablo) {
            if (Schema::hasColumn($tablo, 'deleted_at')) {
                continue;
            }

            Schema::table($tablo, function (Blueprint $table) {
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLOLAR as $tablo) {
            if (!Schema::hasColumn($tablo, 'deleted_at')) {
                continue;
            }

            Schema::table($tablo, function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }
};
