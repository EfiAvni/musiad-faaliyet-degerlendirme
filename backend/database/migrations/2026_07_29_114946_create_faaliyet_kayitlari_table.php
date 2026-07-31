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
        Schema::create('faaliyet_kayitlari', function (Blueprint $table) {
            $table->id();
            $table->foreignId('faaliyet_id')->constrained('faaliyetler')->cascadeOnDelete();
            $table->foreignId('sube_id')->constrained('subeler')->cascadeOnDelete();
            $table->foreignId('donem_ay_id')->constrained('donem_aylar')->cascadeOnDelete();
            $table->date('tarih')->nullable();
            $table->text('aciklama');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('faaliyet_kayitlari');
    }
};
