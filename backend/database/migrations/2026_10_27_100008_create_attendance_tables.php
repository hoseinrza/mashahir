<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A real class meeting, derived from the weekly timetable.
        Schema::create('class_sessions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('classroom_subject_id')->constrained()->cascadeOnDelete();
            $table->date('held_on');
            $table->unsignedSmallInteger('period')->default(1);
            $table->string('attendance_status')->default('not_taken');
            $table->foreignId('finalized_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('finalized_at')->nullable();
            $table->timestampsTz();
            $table->unique(['classroom_subject_id', 'held_on', 'period']);
            $table->index(['school_id', 'held_on']);
        });

        DB::statement("alter table class_sessions add constraint class_sessions_status_check check (attendance_status in ('not_taken', 'draft', 'finalized'))");

        Schema::create('attendance_records', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('class_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            // No row = not reviewed (default per FR-5).
            $table->string('status');
            $table->unsignedSmallInteger('late_minutes')->nullable();
            // source keeps the phase-2 online-class hook (FR: منبع ثبت).
            $table->string('source')->default('manual');
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();
            $table->timestampTz('recorded_at')->useCurrent();
            $table->timestampsTz();
            $table->unique(['class_session_id', 'student_id']);
            $table->index(['school_id', 'student_id']);
        });

        DB::statement("alter table attendance_records add constraint attendance_records_status_check check (status in ('present', 'absent', 'late'))");
        DB::statement("alter table attendance_records add constraint attendance_records_late_minutes_check check ((status = 'late' and late_minutes is not null) or (status <> 'late' and late_minutes is null))");

        // Append-only history of post-finalization corrections (FR-9).
        Schema::create('attendance_changes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attendance_record_id')->constrained()->cascadeOnDelete();
            $table->string('old_status');
            $table->string('new_status');
            $table->text('reason');
            $table->foreignId('changed_by')->constrained('users')->cascadeOnDelete();
            $table->timestampTz('changed_at')->useCurrent();
            $table->index(['school_id', 'attendance_record_id']);
        });

        DB::statement('create trigger attendance_changes_append_only before update or delete on attendance_changes for each row execute function app_forbid_mutation()');
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_changes');
        Schema::dropIfExists('attendance_records');
        Schema::dropIfExists('class_sessions');
    }
};
