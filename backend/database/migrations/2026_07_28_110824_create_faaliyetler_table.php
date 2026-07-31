<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('faaliyetler', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('kategori');
            $table->foreignId('donem_id')->constrained('donemler')->cascadeOnDelete();
            $table->enum('durum', ['active', 'completed', 'passive'])->default('active');
            $table->boolean('zorunlu')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('faaliyetler');
    }
};
