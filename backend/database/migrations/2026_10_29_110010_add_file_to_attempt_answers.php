<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Descriptive answers may be a photo/PDF of the handwritten paper.
        Schema::table('attempt_answers', function (Blueprint $table): void {
            $table->foreignId('file_id')->nullable()->constrained('files')->nullOnDelete()->after('text');
        });
    }

    public function down(): void
    {
        Schema::table('attempt_answers', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('file_id');
        });
    }
};
