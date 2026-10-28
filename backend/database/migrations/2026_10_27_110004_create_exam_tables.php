<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exams', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('classroom_subject_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->timestampTz('opens_at');
            $table->timestampTz('closes_at');
            $table->unsignedSmallInteger('duration_minutes');
            $table->boolean('shuffle_questions')->default(false);
            // Teacher decides per exam when the student sees the score (sh6).
            $table->string('result_visibility'); // immediately|after_grading|manual
            $table->string('status')->default('draft'); // draft|published|closed
            $table->timestampTz('results_released_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestampsTz();
            $table->index(['school_id', 'status']);
        });

        DB::statement("alter table exams add constraint exams_status_check check (status in ('draft', 'published', 'closed'))");
        DB::statement("alter table exams add constraint exams_visibility_check check (result_visibility in ('immediately', 'after_grading', 'manual'))");
        DB::statement('alter table exams add constraint exams_window_check check (closes_at > opens_at)');

        // Circular pair (question <-> option): the correct_option FK is added
        // after both tables exist.
        Schema::create('exam_questions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // mcq|descriptive
            $table->unsignedSmallInteger('position');
            $table->text('body');
            $table->unsignedSmallInteger('points')->default(1);
            $table->unsignedBigInteger('correct_option_id')->nullable();
            $table->timestampsTz();
            $table->unique(['exam_id', 'position']);
        });

        DB::statement("alter table exam_questions add constraint exam_questions_type_check check (type in ('mcq', 'descriptive'))");

        Schema::create('exam_options', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('question_id')->constrained('exam_questions')->cascadeOnDelete();
            $table->unsignedSmallInteger('position');
            $table->text('body');
            $table->timestampsTz();
            $table->unique(['question_id', 'position']);
        });

        Schema::table('exam_questions', function (Blueprint $table): void {
            $table->foreign('correct_option_id')->references('id')->on('exam_options')->nullOnDelete();
        });

        Schema::create('exam_attempts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->timestampTz('started_at');
            // Server clock only — the client device has no say (FR-16).
            $table->timestampTz('server_deadline');
            $table->string('status')->default('in_progress'); // in_progress|submitted|expired
            $table->timestampTz('submitted_at')->nullable();
            $table->unsignedSmallInteger('auto_score')->nullable();
            $table->timestampsTz();
            $table->index(['exam_id', 'student_id']);
        });

        DB::statement("alter table exam_attempts add constraint exam_attempts_status_check check (status in ('in_progress', 'submitted', 'expired'))");
        DB::statement("create unique index exam_attempts_one_active_per_student on exam_attempts (exam_id, student_id) where status = 'in_progress'");

        Schema::create('attempt_answers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attempt_id')->constrained('exam_attempts')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('exam_questions')->cascadeOnDelete();
            $table->foreignId('option_id')->nullable()->constrained('exam_options')->nullOnDelete();
            $table->text('text')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->boolean('flagged')->default(false);
            $table->timestampTz('saved_at');
            $table->timestampsTz();
            $table->unique(['attempt_id', 'question_id']);
        });

        Schema::create('answer_grades', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('answer_id')->constrained('attempt_answers')->cascadeOnDelete();
            $table->unsignedSmallInteger('score');
            $table->text('comment')->nullable();
            $table->foreignId('graded_by')->constrained('users')->cascadeOnDelete();
            $table->timestampTz('graded_at')->useCurrent();
            $table->unique('answer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('answer_grades');
        Schema::dropIfExists('attempt_answers');
        Schema::dropIfExists('exam_attempts');
        Schema::dropIfExists('exam_options');
        Schema::dropIfExists('exam_questions');
        Schema::dropIfExists('exams');
    }
};
