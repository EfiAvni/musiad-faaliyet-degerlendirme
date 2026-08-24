<?php

use App\Models\Birim;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Birimler arası ayrışma dönem seviyesinde olur: şubeler tüm birimler için
 * ortaktır (MÜSİAD Ankara hem Teşkilatlanma'nın hem GENÇ'in şubesidir), ama
 * her dönem tek bir birime aittir ve o birimin dönemleri diğerlerine görünmez.
 *
 * Bu yüzden yetki kapsamı subeler.birim_id üzerinden değil, donemler.birim_id
 * üzerinden kurulur.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('donemler', function (Blueprint $table) {
            $table->foreignId('birim_id')->nullable()->after('name')->constrained('birimler')->cascadeOnDelete();
        });

        // Mevcut dönemler birim ayrımı olmadan açılmıştı; ilk birime bağlanırlar.
        $varsayilanBirimId = Birim::orderBy('id')->value('id');

        if ($varsayilanBirimId) {
            DB::table('donemler')->whereNull('birim_id')->update(['birim_id' => $varsayilanBirimId]);
        }
    }

    public function down(): void
    {
        Schema::table('donemler', function (Blueprint $table) {
            $table->dropForeign(['birim_id']);
            $table->dropColumn('birim_id');
        });
    }
};
