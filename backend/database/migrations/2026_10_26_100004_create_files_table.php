<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // All uploads flow through this table; access happens via signed URLs only.
        Schema::create('files', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('disk');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime');
            $table->unsignedBigInteger('size');
            $table->string('checksum')->nullable();
            $table->foreignId('uploaded_by')->constrained('users')->cascadeOnDelete();
            $table->timestampTz('scanned_at')->nullable();
            $table->timestampsTz();
            $table->index(['school_id', 'uploaded_by']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('files');
    }
};
