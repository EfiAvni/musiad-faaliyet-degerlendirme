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
            $table->renameColumn('hedef_puan', 'hedef');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('faaliyetler', function (Blueprint $table) {
            $table->renameColumn('hedef', 'hedef_puan');
        });
    }
};
