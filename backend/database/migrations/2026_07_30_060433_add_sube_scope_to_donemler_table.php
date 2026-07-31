<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('donemler', function (Blueprint $table) {
            $table->boolean('tum_subeler')->default(true)->after('status');
        });

        Schema::create('donem_sube', function (Blueprint $table) {
            $table->id();
            $table->foreignId('donem_id')->constrained('donemler')->cascadeOnDelete();
            $table->foreignId('sube_id')->constrained('subeler')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['donem_id', 'sube_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('donem_sube');

        Schema::table('donemler', function (Blueprint $table) {
            $table->dropColumn('tum_subeler');
        });
    }
};
