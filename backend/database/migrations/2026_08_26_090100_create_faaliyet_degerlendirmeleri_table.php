<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gereksinim dokümanı bölüm 5: "Kriterlere göre değerlendirme yapabilmeli,
 * puan verebilmeli." Bazı kriterler otomatik sayılamaz - merkez şubenin
 * girdiğine bakıp puanı kendisi belirler.
 *
 * Değerlendirme gönderime bağlanır: gönderim zaten (şube × ay) çiftini
 * tanımlıyor ve puanlama incelemenin bir parçası olarak yapılıyor.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('faaliyet_degerlendirmeleri', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ay_gonderim_id')->constrained('ay_gonderimleri')->cascadeOnDelete();
            $table->foreignId('faaliyet_id')->constrained('faaliyetler')->cascadeOnDelete();

            $table->unsignedInteger('puan');
            $table->text('not')->nullable();

            $table->foreignId('degerlendiren_id')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            // Bir gönderimde bir faaliyet için tek değerlendirme olur.
            $table->unique(['ay_gonderim_id', 'faaliyet_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('faaliyet_degerlendirmeleri');
    }
};
