<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gereksinim dokümanı bölüm 7 kriterleri altı başlıkta topluyor ve bölüm 8
 * "hangi şube hangi konuda başarılı, hangi konuda gelişmeye ihtiyaç duyuyor?"
 * sorusuna cevap bekliyor. Faaliyet bazında kırılım vardı ama bu başlıklar
 * altında toplama yapılamıyordu.
 *
 * Kategori zorunlu değil: kategorisiz faaliyetler raporda "Sınıflandırılmamış"
 * altında görünür, böylece mevcut veriler bozulmaz.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('faaliyetler', function (Blueprint $table) {
            $table->string('kategori', 32)->nullable()->after('kademeler');
        });
    }

    public function down(): void
    {
        Schema::table('faaliyetler', function (Blueprint $table) {
            $table->dropColumn('kategori');
        });
    }
};
