<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_profiles', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('job_title')->nullable();
            $table->string('personnel_code')->nullable();
            $table->string('status')->default('active');
            $table->timestampsTz();
            $table->unique(['school_id', 'user_id']);
        });

        DB::statement("alter table staff_profiles add constraint staff_profiles_status_check check (status in ('active', 'suspended', 'left'))");

        Schema::create('students', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            // Optional: elementary students may have no account (phase 2 hook).
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('student_code');
            $table->string('first_name');
            $table->string('last_name');
            $table->date('birth_date')->nullable();
            // Encrypted at rest; readable only under students.view_national_code (sh7).
            $table->text('national_code')->nullable();
            $table->string('status')->default('active');
            $table->date('left_on')->nullable();
            $table->timestampTz('anonymized_at')->nullable();
            $table->timestampsTz();
            $table->unique(['school_id', 'student_code']);
            $table->index(['school_id', 'status']);
        });

        DB::statement("alter table students add constraint students_status_check check (status in ('active', 'left', 'graduated'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('students');
        Schema::dropIfExists('staff_profiles');
    }
};
