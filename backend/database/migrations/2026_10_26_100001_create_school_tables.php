<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schools', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->string('name');
            $table->string('level');
            $table->string('grading_type');
            $table->boolean('student_has_account')->default(true);
            $table->string('timezone')->default('Asia/Tehran');
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        DB::statement("alter table schools add constraint schools_level_check check (level in ('elementary', 'middle', 'high'))");
        DB::statement("alter table schools add constraint schools_grading_type_check check (grading_type in ('numeric', 'descriptive'))");

        Schema::table('roles', function (Blueprint $table): void {
            $table->foreign('school_id')->references('id')->on('schools')->nullOnDelete();
        });

        Schema::create('school_settings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->jsonb('value')->nullable();
            $table->timestampsTz();
            $table->unique(['school_id', 'key']);
        });

        Schema::create('academic_years', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->boolean('is_current')->default(false);
            $table->timestampTz('archived_at')->nullable();
            $table->timestampsTz();
            $table->index(['school_id', 'starts_on']);
        });

        // Exactly one current academic year per school.
        DB::statement('create unique index academic_years_one_current_per_school on academic_years (school_id) where is_current');
        DB::statement('alter table academic_years add constraint academic_years_range_check check (ends_on > starts_on)');

        Schema::create('terms', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_year_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->timestampsTz();
            $table->index(['school_id', 'academic_year_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('terms');
        Schema::dropIfExists('academic_years');
        Schema::dropIfExists('school_settings');
        Schema::table('roles', function (Blueprint $table): void {
            $table->dropForeign(['school_id']);
        });
        Schema::dropIfExists('schools');
    }
};
