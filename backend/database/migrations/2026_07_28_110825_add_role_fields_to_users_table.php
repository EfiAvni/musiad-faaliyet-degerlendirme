<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreign('birim_id')->references('id')->on('birimler')->nullOnDelete();
            $table->foreign('sube_id')->references('id')->on('subeler')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['birim_id']);
            $table->dropForeign(['sube_id']);
        });
    }
};
