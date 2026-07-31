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
        Schema::create('donem_aylar', function (Blueprint $table) {
            $table->id();
            $table->foreignId('donem_id')->constrained('donemler')->cascadeOnDelete();
            $table->unsignedTinyInteger('sira');
            $table->string('name');
            $table->date('start_date');
            $table->date('end_date');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('donem_aylar');
    }
};
