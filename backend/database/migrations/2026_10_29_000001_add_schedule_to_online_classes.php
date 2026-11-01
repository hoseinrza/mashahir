<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('online_classes', function (Blueprint $table): void {
            // پنجره‌ی برگزاری: null یعنی بدون زمان‌بندی (همان رفتار قدیمی).
            $table->timestampTz('starts_at')->nullable()->index();
            $table->timestampTz('ends_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('online_classes', function (Blueprint $table): void {
            $table->dropIndex(['starts_at']);
            $table->dropColumn(['starts_at', 'ends_at']);
        });
    }
};
