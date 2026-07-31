<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('birimler', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedBigInteger('yonetici_id')->nullable();
            $table->enum('status', ['active', 'passive'])->default('active');
            $table->year('created_year')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('birimler');
    }
};
