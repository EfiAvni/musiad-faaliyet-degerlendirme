<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gereksinim dokümanının 12. bölümü: şube dönem bilgilerini tamamlayınca ilgili
 * dönemi merkeze gönderir, gönderilen dönem değerlendirme sürecine geçer,
 * sonuçlandıktan sonra keyfî değişiklik engellenir.
 *
 * Gönderim birimi (şube × dönem ayı): doküman temel dönemi aylık tanımlıyor
 * (bölüm 3) ve aylık sonuçların yıllık performansta birikmesini bekliyor
 * (bölüm 9). Şube zaten ay bazında kayıt giriyor.
 *
 * Satır tembel oluşturulur - şube ilk kez gönderene kadar o ay "taslak" sayılır.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ay_gonderimleri', function (Blueprint $table) {
            $table->id();
            $table->foreignId('donem_ay_id')->constrained('donem_aylar')->cascadeOnDelete();
            $table->foreignId('sube_id')->constrained('subeler')->cascadeOnDelete();

            $table->string('durum', 32)->default('gonderildi');

            $table->timestamp('gonderildi_at')->nullable();
            $table->foreignId('gonderen_id')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamp('degerlendirildi_at')->nullable();
            $table->foreignId('degerlendiren_id')->nullable()->constrained('users')->nullOnDelete();

            /** Merkezin şubeye ilettiği açıklama; düzeltme isteğinde zorunlu. */
            $table->text('merkez_notu')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Bir şubenin bir ay için tek gönderim kaydı olur.
            $table->unique(['donem_ay_id', 'sube_id']);

            // Merkez ekranı "bekleyen gönderimler" diye sorgulayacak.
            $table->index(['durum', 'donem_ay_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ay_gonderimleri');
    }
};
