<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gereksinim dokümanı bölüm 6: "Bütün kriterlerin aynı şekilde değerlendirilmesi
 * zorunlu değildir. Her kriter kendi belirlenen değerlendirme mantığına göre
 * sonuç üretmelidir."
 *
 * Sistemde tek hesap vardı (kayıt sayısı × puan, hedefte tavanlanır). Bu alan
 * faaliyetin hangi mantıkla puanlanacağını belirler; mevcut faaliyetler
 * varsayılan olarak eski davranışı ('sayi') sürdürür.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('faaliyetler', function (Blueprint $table) {
            $table->string('kriter_turu', 24)->default('sayi')->after('hedef');

            // Yalnızca kademeli kriterlerde kullanılır:
            // [{"esik": 5, "puan": 10}, {"esik": 10, "puan": 20}]
            $table->json('kademeler')->nullable()->after('kriter_turu');
        });
    }

    public function down(): void
    {
        Schema::table('faaliyetler', function (Blueprint $table) {
            $table->dropColumn(['kriter_turu', 'kademeler']);
        });
    }
};
