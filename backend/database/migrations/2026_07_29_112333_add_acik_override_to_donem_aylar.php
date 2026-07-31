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
        Schema::table('donem_aylar', function (Blueprint $table) {
            // null = otomatik (bulunduğumuz aya göre sistem karar verir), true/false = birim yöneticisi tarafından manuel zorlandı
            $table->boolean('acik_override')->nullable()->after('end_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('donem_aylar', function (Blueprint $table) {
            $table->dropColumn('acik_override');
        });
    }
};
