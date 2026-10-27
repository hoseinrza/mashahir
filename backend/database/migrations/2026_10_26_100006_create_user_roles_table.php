<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_roles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('scope_type');
            $table->unsignedBigInteger('scope_id')->nullable();
            $table->date('starts_on')->nullable();
            // Checked on every request: an expired grant cuts access immediately.
            $table->date('ends_on')->nullable();
            $table->timestampsTz();
            $table->index(['user_id', 'school_id']);
            $table->index(['school_id', 'role_id']);
        });

        DB::statement("alter table user_roles add constraint user_roles_scope_check check ((scope_type = 'school' and scope_id is null) or (scope_type in ('classroom', 'student') and scope_id is not null))");
    }

    public function down(): void
    {
        Schema::dropIfExists('user_roles');
    }
};
