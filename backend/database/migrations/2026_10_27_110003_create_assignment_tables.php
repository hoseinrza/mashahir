<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignments', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('classroom_subject_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestampTz('due_at');
            $table->unsignedSmallInteger('max_score')->default(100);
            // Multiple classrooms from one definition share this group.
            $table->ulid('group_ulid')->nullable()->index();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestampsTz();
            $table->index(['school_id', 'due_at']);
        });

        Schema::create('assignment_files', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('file_id')->constrained()->cascadeOnDelete();
            $table->timestampsTz();
            $table->unique(['assignment_id', 'file_id']);
        });

        Schema::create('submissions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->text('text')->nullable();
            $table->string('status')->default('submitted'); // submitted|late|graded
            $table->timestampTz('submitted_at');
            $table->unsignedSmallInteger('score')->nullable();
            $table->text('feedback')->nullable();
            $table->foreignId('graded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('graded_at')->nullable();
            $table->timestampsTz();
            $table->unique(['assignment_id', 'student_id']);
            $table->index(['school_id', 'student_id']);
        });

        DB::statement("alter table submissions add constraint submissions_status_check check (status in ('submitted', 'late', 'graded'))");
        DB::statement('alter table submissions add constraint submissions_score_check check (score is null or score >= 0)');

        Schema::create('submission_files', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('submission_id')->constrained()->cascadeOnDelete();
            $table->foreignId('file_id')->constrained()->cascadeOnDelete();
            $table->timestampsTz();
            $table->unique(['submission_id', 'file_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_files');
        Schema::dropIfExists('submissions');
        Schema::dropIfExists('assignment_files');
        Schema::dropIfExists('assignments');
    }
};
