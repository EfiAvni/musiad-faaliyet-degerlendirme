<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('faaliyetler', function (Blueprint $table) {
            $table->dropColumn(['kategori', 'zorunlu']);
            $table->text('detay')->nullable()->after('title');
            $table->unsignedInteger('puan')->default(0)->after('detay');
            $table->unsignedInteger('hedef_puan')->default(0)->after('puan');
            $table->text('aciklama')->nullable()->after('hedef_puan');
            $table->boolean('tarih_gerekli')->default(false)->after('aciklama');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('faaliyetler', function (Blueprint $table) {
            $table->dropColumn(['detay', 'puan', 'hedef_puan', 'aciklama', 'tarih_gerekli']);
            $table->string('kategori')->default('');
            $table->boolean('zorunlu')->default(false);
        });
    }
};
