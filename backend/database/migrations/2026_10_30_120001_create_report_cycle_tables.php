<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Monthly report-card cycle.
 *
 * Two levels on purpose: the PERIOD is opened by the principal, while every
 * teacher owns an independent SUBMISSION row. That is what keeps rule 7 true —
 * finalizing one teacher's cards must not wait for (or move) anyone else.
 *
 * Status split (the seven names asked for in the spec):
 *   report_periods.status             draft → open
 *   teacher_report_submissions.status open → submitted → revision_required
 *                                            → approved → finalized → archived
 * 'approved' is deliberately NOT 'finalized': approving is a review verdict,
 * finalizing is the separate, irreversible order that locks and archives — so
 * finalize() writes both stamps, and the row rests in 'archived'.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_periods', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_year_id')->constrained()->cascadeOnDelete();
            // Jalali month number (1=فروردین … ۱۲=بهمن) — the app labels it.
            $table->unsignedTinyInteger('month');
            $table->string('title')->nullable();
            $table->string('status')->default('draft'); // draft|open
            $table->timestampTz('due_at')->nullable();
            $table->foreignId('opened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('opened_at')->nullable();
            $table->timestampsTz();
            $table->unique(['school_id', 'academic_year_id', 'month']);
            $table->index(['school_id', 'status']);
        });

        DB::statement("alter table report_periods add constraint report_periods_status_check check (status in ('draft', 'open'))");
        DB::statement('alter table report_periods add constraint report_periods_month_check check (month between 1 and 12)');

        Schema::create('teacher_report_submissions', function (Blueprint $table): void {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('report_period_id')->constrained()->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->string('status')->default('open');
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampTz('reviewed_at')->nullable();
            $table->timestampTz('returned_at')->nullable();
            $table->foreignId('returned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('return_note')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->timestampTz('finalized_at')->nullable();
            $table->timestampTz('archived_at')->nullable();
            // Rule 9: an archived submission reopens only with a reason.
            $table->timestampTz('reopened_at')->nullable();
            $table->foreignId('reopened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reopen_reason')->nullable();
            $table->timestampsTz();
            $table->unique(['report_period_id', 'teacher_id']);
            $table->index(['school_id', 'status']);
            $table->index(['teacher_id', 'status']);
        });

        DB::statement("alter table teacher_report_submissions add constraint teacher_report_submissions_status_check check (status in ('open', 'submitted', 'revision_required', 'approved', 'finalized', 'archived'))");

        Schema::create('student_report_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('teacher_report_submission_id')->constrained('teacher_report_submissions')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('classroom_subject_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('score')->nullable();
            $table->unsignedSmallInteger('max_score')->default(20);
            $table->string('evaluation')->nullable(); // descriptive verdict (خیلی‌خوب …)
            $table->text('notes')->nullable();         // teacher's remark for the family
            $table->timestampsTz();
            $table->unique(['teacher_report_submission_id', 'student_id', 'classroom_subject_id'], 'student_report_entries_unique_line');
            $table->index(['school_id', 'student_id']);
        });

        DB::statement('alter table student_report_entries add constraint student_report_entries_score_check check (score is null or score <= max_score)');

        Schema::create('report_activity_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('report_period_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('teacher_report_submission_id')->nullable()->constrained('teacher_report_submissions')->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->jsonb('detail')->nullable();
            $table->text('reason')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['report_period_id', 'created_at']);
        });

        // The domain trail is append-only, like audit_logs and grade_changes.
        DB::statement('create trigger report_activity_logs_append_only before update or delete on report_activity_logs for each row execute function app_forbid_mutation()');

        // Rule 6 at the database level: even a bug in the app cannot rewrite a
        // finalized teacher's entries.
        DB::statement(<<<'SQL'
            create or replace function app_forbid_mutation_finalized_report_entry() returns trigger as $$
            declare
                submission_id bigint;
            begin
                submission_id := case when TG_OP = 'DELETE' then OLD.teacher_report_submission_id
                                       else NEW.teacher_report_submission_id end;
                if exists (select 1 from teacher_report_submissions
                           where id = submission_id and status in ('finalized', 'archived')) then
                    raise exception 'کارنامه ثبت‌نهایی‌شده غیرقابل تغییر است';
                end if;

                return case when TG_OP = 'DELETE' then OLD else NEW end;
            end
            $$ language plpgsql
        SQL);
        DB::statement('create trigger student_report_entries_finalized_guard before insert or update or delete on student_report_entries for each row execute function app_forbid_mutation_finalized_report_entry()');
    }

    public function down(): void
    {
        DB::statement('drop trigger if exists student_report_entries_finalized_guard on student_report_entries');
        DB::statement('drop function if exists app_forbid_mutation_finalized_report_entry()');
        DB::statement('drop trigger if exists report_activity_logs_append_only on report_activity_logs');
        Schema::dropIfExists('report_activity_logs');
        Schema::dropIfExists('student_report_entries');
        Schema::dropIfExists('teacher_report_submissions');
        Schema::dropIfExists('report_periods');
    }
};
