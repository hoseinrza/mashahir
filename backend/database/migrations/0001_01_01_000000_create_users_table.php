<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->string('first_name');
            $table->string('last_name');
            // Encrypted at rest (Laravel `encrypted` cast); phone_hash is the
            // deterministic lookup/uniqueness key.
            $table->text('phone');
            $table->string('phone_hash')->unique();
            $table->string('status')->default('active');
            $table->timestampTz('last_login_at')->nullable();
            $table->timestampsTz();
        });

        DB::statement("alter table users add constraint users_status_check check (status in ('active', 'blocked'))");

        Schema::create('login_codes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('phone_hash')->index();
            $table->string('code_hash');
            $table->timestampTz('expires_at');
            $table->unsignedInteger('attempts')->default(0);
            $table->timestampTz('consumed_at')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestampsTz();
            $table->index(['phone_hash', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_codes');
        Schema::dropIfExists('users');
    }
};
