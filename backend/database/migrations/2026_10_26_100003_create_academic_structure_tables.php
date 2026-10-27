<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grade_levels', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('title'); // دهم، یازدهم، دوازدهم
            $table->unsignedSmallInteger('order');
            $table->timestampsTz();
            $table->unique(['school_id', 'order']);
        });

        Schema::create('classrooms', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_year_id')->constrained()->cascadeOnDelete();
            $table->foreignId('grade_level_id')->constrained()->restrictOnDelete();
            $table->string('title');
            $table->foreignId('homeroom_staff_id')->nullable()->constrained('staff_profiles')->nullOnDelete();
            $table->timestampsTz();
            $table->unique(['academic_year_id', 'title']);
            $table->index(['school_id', 'academic_year_id']);
        });

        Schema::create('subjects', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('code')->nullable();
            $table->timestampsTz();
            $table->unique(['school_id', 'code']);
        });

        // Root of teacher authorization: teacher scope resolves from here.
        Schema::create('classroom_subjects', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('classroom_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained()->restrictOnDelete();
            $table->foreignId('teacher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->unique(['classroom_id', 'subject_id']);
            $table->index(['school_id', 'teacher_id']);
        });

        Schema::create('enrollments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('classroom_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->string('status')->default('active');
            $table->timestampsTz();
            $table->index(['school_id', 'student_id']);
            $table->index(['classroom_id', 'student_id']);
        });

        DB::statement("alter table enrollments add constraint enrollments_status_check check (status in ('active', 'transferred', 'ended'))");
        DB::statement('alter table enrollments add constraint enrollments_range_check check (ends_on is null or ends_on >= starts_on)');
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollments');
        Schema::dropIfExists('classroom_subjects');
        Schema::dropIfExists('subjects');
        Schema::dropIfExists('classrooms');
        Schema::dropIfExists('grade_levels');
    }
};
