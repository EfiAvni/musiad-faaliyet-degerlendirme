<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Şubeler tüm birimler için ortak bir ana listedir: MÜSİAD Ankara hem
 * Teşkilatlanma'nın hem GENÇ MÜSİAD'ın şubesidir. Tek bir birim_id bu ilişkiyi
 * yanlış modelliyordu ve alan zaten hiçbir kayıtta dolu değildi.
 *
 * Birim ayrışması artık donemler.birim_id üzerinden yürüyor.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('subeler', 'birim_id')) {
            return;
        }

        Schema::table('subeler', function (Blueprint $table) {
            $table->dropForeign(['birim_id']);
            $table->dropColumn('birim_id');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('subeler', 'birim_id')) {
            return;
        }

        Schema::table('subeler', function (Blueprint $table) {
            $table->foreignId('birim_id')->nullable()->after('name')->constrained('birimler')->nullOnDelete();
        });
    }
};
