<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subeler', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('birim_id')->nullable()->constrained('birimler')->nullOnDelete();
            $table->unsignedBigInteger('yonetici_id')->nullable();
            $table->unsignedInteger('uye_sayisi')->default(0);
            $table->enum('status', ['active', 'passive'])->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subeler');
    }
};
