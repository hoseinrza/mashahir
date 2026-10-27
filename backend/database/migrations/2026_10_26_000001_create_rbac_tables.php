<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('permissions', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique();
            $table->string('title');
            $table->string('group')->index();
            $table->timestamps();
        });

        Schema::create('roles', function (Blueprint $table): void {
            $table->id();
            // FK to schools is added once the schools table exists (core migrations).
            $table->unsignedBigInteger('school_id')->nullable()->index();
            $table->string('key');
            $table->string('title');
            $table->boolean('is_system')->default(false);
            $table->timestamps();
            $table->unique(['school_id', 'key']);
        });

        Schema::create('role_permissions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
            // Condition code (e.g. 'sh7') from the matrix; NULL = unconditional.
            $table->string('condition', 8)->nullable();
            $table->timestamps();
            $table->unique(['role_id', 'permission_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('permissions');
    }
};
