<?php

namespace App\Modules\Grades\Services;

use App\Modules\Academic\Models\AcademicYear;
use App\Modules\Academic\Models\ClassroomSubject;
use App\Modules\Academic\Models\Enrollment;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Grades\Models\ReportActivityLog;
use App\Modules\Grades\Models\ReportPeriod;
use App\Modules\Grades\Models\StudentReportEntry;
use App\Modules\Grades\Models\TeacherReportSubmission;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The monthly report-card cycle.
 *
 * Every rule of the spec is enforced HERE (server side), never in the UI:
 *  1. nothing is writable while the period is still draft — only the principal opens it;
 *  2. a teacher writes only his own lesson-classes (sh2) and only active students;
 *  3. after submit the teacher is locked out until the principal returns it;
 *  5+6. only the principal finalizes, and the DB trigger then refuses any write;
 *  7. finalize/archive acts on ONE submission row, so teachers never wait for each other;
 *  8. every order lands in report_activity_logs and audit_logs;
 *  9. reopening an archived one needs a reason.
 */
final class ReportCycleService
{
    public function __construct(
        private readonly AuditService $audit,
    ) {
    }

    // ── Principal: the period ─────────────────────────────────────────────

    public function createPeriod(int $academicYearId, int $month, ?string $title, ?Carbon $dueAt): ReportPeriod
    {
        $year = AcademicYear::query()->findOrFail($academicYearId);

        if (ReportPeriod::query()->where('academic_year_id', $year->id)->where('month', $month)->exists()) {
            throw ValidationException::withMessages([
                'month' => 'برای این ماه از سال تحصیلی انتخابی قبلاً دوره کارنامه تعریف شده است.',
            ]);
        }

        $period = ReportPeriod::query()->create([
            'academic_year_id' => $year->id,
            'month' => $month,
            'title' => $title,
            'status' => ReportPeriod::STATUS_DRAFT,
            'due_at' => $dueAt,
        ]);

        $this->activity($period, null, 'report_period.created', [
            'month' => $month, 'academic_year_id' => $year->id, 'due_at' => $dueAt?->toIso8601String(),
        ]);
        $this->audit->log('report_period.created', $period, new: ['month' => $month, 'title' => $title]);

        return $period;
    }

    /**
     * Open the period. An empty teacher list means every teacher of the school;
     * a populated one limits the cycle to the chosen teachers.
     */
    public function openPeriod(ReportPeriod $period, array $teacherIds, int $actorId): ReportPeriod
    {
        if ($period->status !== ReportPeriod::STATUS_DRAFT) {
            throw ValidationException::withMessages([
                'status' => 'این دوره پیش‌تر باز شده است.',
            ]);
        }

        $teacherIds = $teacherIds === [] ? $this->schoolTeacherIds() : $this->assertTeachersOfSchool($teacherIds);

        if ($teacherIds === []) {
            throw ValidationException::withMessages([
                'teachers' => 'هیچ معلمی در این مدرسه برای باز کردن دوره وجود ندارد.',
            ]);
        }

        return DB::transaction(function () use ($period, $teacherIds, $actorId): ReportPeriod {
            $period->forceFill([
                'status' => ReportPeriod::STATUS_OPEN,
                'opened_by' => $actorId,
                'opened_at' => now(),
            ])->save();

            $existing = TeacherReportSubmission::query()
                ->where('report_period_id', $period->id)
                ->pluck('teacher_id')
                ->all();

            $missing = array_values(array_diff($teacherIds, $existing));

            if ($missing !== []) {
                TeacherReportSubmission::query()->insert(
                    collect($missing)->map(fn (int $id) => [
                        'school_id' => $period->school_id,
                        'report_period_id' => $period->id,
                        'teacher_id' => $id,
                        'ulid' => (string) \Illuminate\Support\Str::ulid(),
                        'status' => TeacherReportSubmission::STATUS_OPEN,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ])->all()
                );
            }

            $this->activity($period, null, 'report_period.opened', ['teachers' => count($teacherIds)]);
            $this->audit->log('report_period.opened', $period, new: [
                'teachers' => count($teacherIds),
                'due_at' => $period->due_at?->toIso8601String(),
            ]);

            return $period->fresh();
        });
    }

    // ── Teacher: entries ──────────────────────────────────────────────────

    /**
     * Upsert the teacher's lines. Each line is checked against sh2 (the lesson
     * class must be his) and against an ACTIVE enrollment, so a crafted
     * student_id can never put a score into another teacher's cycle.
     *
     * @param list<array<string, mixed>> $lines
     */
    public function saveEntries(TeacherReportSubmission $submission, array $lines, int $actorId): TeacherReportSubmission
    {
        $submission = $this->assertTeacherMayWrite($submission, $actorId);

        if ($lines === []) {
            throw ValidationException::withMessages(['entries' => 'هیچ رکوردی برای ثبت ارسال نشده است.']);
        }

        return DB::transaction(function () use ($submission, $lines): TeacherReportSubmission {
            foreach ($lines as $index => $line) {
                $this->assertLineIsOwned($submission, $line, $index);

                $maxScore = (int) ($line['max_score'] ?? 20);
                $score = isset($line['score']) && $line['score'] !== '' ? (int) $line['score'] : null;

                if ($score !== null && ($score < 0 || $score > $maxScore)) {
                    throw ValidationException::withMessages([
                        "entries.{$index}" => "نمره باید عددی بین ۰ تا {$maxScore} باشد.",
                    ]);
                }

                StudentReportEntry::query()->updateOrCreate(
                    [
                        'teacher_report_submission_id' => $submission->id,
                        'student_id' => (int) $line['student_id'],
                        'classroom_subject_id' => (int) $line['classroom_subject_id'],
                    ],
                    [
                        'score' => $score,
                        'max_score' => $maxScore,
                        'evaluation' => $this->text($line['evaluation'] ?? null),
                        'notes' => $this->text($line['notes'] ?? null),
                    ],
                );
            }

            $this->activity($submission->period, $submission, 'report_entries.saved', ['lines' => count($lines)]);
            $this->audit->log('report_entries.saved', $submission, new: ['lines' => count($lines)]);

            return $submission->fresh();
        });
    }

    public function submit(TeacherReportSubmission $submission, int $actorId): TeacherReportSubmission
    {
        $submission = $this->assertTeacherMayWrite($submission, $actorId);

        $count = StudentReportEntry::query()->where('teacher_report_submission_id', $submission->id)->count();

        if ($count === 0) {
            throw ValidationException::withMessages([
                'entries' => 'هنوز کارنامه‌ای ثبت نشده که قابل ارسال باشد.',
            ]);
        }

        $submission->forceFill([
            'status' => TeacherReportSubmission::STATUS_SUBMITTED,
            'submitted_at' => now(),
        ])->save();

        $this->activity($submission->period, $submission, 'report_submission.submitted', ['lines' => $count]);
        $this->audit->log('report_submission.submitted', $submission, new: ['status' => $submission->status]);

        return $submission->fresh();
    }

    // ── Principal: review, approve, finalize, reopen ──────────────────────

    public function returnForRevision(ReportPeriod $period, TeacherReportSubmission $submission, string $note, int $actorId): TeacherReportSubmission
    {
        $note = trim($note);

        if ($note === '') {
            throw ValidationException::withMessages([
                'note' => 'برگشت کارنامه برای اصلاح باید با توضیح همراه باشد.',
            ]);
        }

        $this->assertSubmissionOfPeriod($period, $submission);

        if (! in_array($submission->status, [
            TeacherReportSubmission::STATUS_SUBMITTED,
            TeacherReportSubmission::STATUS_APPROVED,
        ], true)) {
            throw ValidationException::withMessages([
                'status' => 'فقط کارنامه ارسال‌شده یا تأییدشده قابل برگشت برای اصلاح است.',
            ]);
        }

        $submission->forceFill([
            'status' => TeacherReportSubmission::STATUS_REVISION_REQUIRED,
            'reviewed_at' => now(),
            'returned_at' => now(),
            'returned_by' => $actorId,
            'return_note' => $note,
        ])->save();

        $this->activity($period, $submission, 'report_submission.returned', null, $note);
        $this->audit->log('report_submission.returned', $submission, new: ['status' => $submission->status], reason: $note);

        return $submission->fresh();
    }

    public function approve(ReportPeriod $period, TeacherReportSubmission $submission, int $actorId): TeacherReportSubmission
    {
        $this->assertSubmissionOfPeriod($period, $submission);

        if ($submission->status !== TeacherReportSubmission::STATUS_SUBMITTED) {
            throw ValidationException::withMessages([
                'status' => 'فقط کارنامه ارسال‌شده قابل تأیید است.',
            ]);
        }

        $submission->forceFill([
            'status' => TeacherReportSubmission::STATUS_APPROVED,
            'reviewed_at' => now(),
            'approved_at' => now(),
        ])->save();

        $this->activity($period, $submission, 'report_submission.approved');
        $this->audit->log('report_submission.approved', $submission, new: ['status' => $submission->status]);

        return $submission->fresh();
    }

    /**
     * The separate, irreversible order (rule 5). It stamps 'finalized' and then
     * immediately archives the same row (step 5 of the workflow), so both
     * moments live in the activity trail while the row rests in 'archived'.
     * One submission only — other teachers keep their own state (rule 7).
     */
    public function finalize(ReportPeriod $period, TeacherReportSubmission $submission, int $actorId): TeacherReportSubmission
    {
        $this->assertSubmissionOfPeriod($period, $submission);

        if ($submission->status !== TeacherReportSubmission::STATUS_APPROVED) {
            throw ValidationException::withMessages([
                'status' => 'ثبت نهایی فقط پس از تأیید کارنامه همان معلم امکان‌پذیر است.',
            ]);
        }

        return DB::transaction(function () use ($period, $submission, $actorId): TeacherReportSubmission {
            $submission->forceFill([
                'status' => TeacherReportSubmission::STATUS_FINALIZED,
                'finalized_at' => now(),
            ])->save();

            $this->activity($period, $submission, 'report_submission.finalized');
            $this->audit->log('report_submission.finalized', $submission, new: ['status' => $submission->status]);

            $submission->forceFill([
                'status' => TeacherReportSubmission::STATUS_ARCHIVED,
                'archived_at' => now(),
            ])->save();

            $this->activity($period, $submission, 'report_submission.archived');
            $this->audit->log('report_submission.archived', $submission, new: ['status' => $submission->status]);

            return $submission->fresh();
        });
    }

    /** Rule 9: an archived cycle reopens only with a reason, and it is logged. */
    public function reopen(ReportPeriod $period, TeacherReportSubmission $submission, string $reason, int $actorId): TeacherReportSubmission
    {
        $reason = trim($reason);

        if ($reason === '') {
            throw ValidationException::withMessages([
                'reason' => 'بازگشایی کارنامه بایگانی‌شده باید با دلیل ثبت شود.',
            ]);
        }

        $this->assertSubmissionOfPeriod($period, $submission);

        if (! $submission->isLocked()) {
            throw ValidationException::withMessages([
                'status' => 'این کارنامه هنوز ثبت نهایی نشده که نیاز به بازگشایی داشته باشد.',
            ]);
        }

        if (! $period->isOpen()) {
            throw ValidationException::withMessages([
                'status' => 'برای ویرایش مجدد، دوره همان ماه باید باز باشد.',
            ]);
        }

        $submission->forceFill([
            'status' => TeacherReportSubmission::STATUS_REVISION_REQUIRED,
            'reopened_at' => now(),
            'reopened_by' => $actorId,
            'reopen_reason' => $reason,
            'return_note' => $reason,
            'returned_at' => now(),
            'returned_by' => $actorId,
        ])->save();

        $this->activity($period, $submission, 'report_submission.reopened', [
            'from' => TeacherReportSubmission::STATUS_ARCHIVED,
        ], $reason);
        $this->audit->log('report_submission.reopened', $submission, new: ['status' => $submission->status], reason: $reason);

        return $submission->fresh();
    }

    // ── Guards ────────────────────────────────────────────────────────────

    /**
     * Rules 1, 3, 5, 6 in one place: the period must be open, the deadline must
     * not have passed, and only the owning teacher may write — and only while
     * the row is in an editable state.
     */
    private function assertTeacherMayWrite(TeacherReportSubmission $submission, int $actorId): TeacherReportSubmission
    {
        if ((int) $submission->teacher_id !== $actorId) {
            abort(404);
        }

        /** @var TeacherReportSubmission $locked */
        $locked = TeacherReportSubmission::query()->whereKey($submission->getKey())->lockForUpdate()->firstOrFail();
        $locked->loadMissing('period');

        if (! $locked->period->isOpen()) {
            throw ValidationException::withMessages([
                'status' => 'مدیر هنوز دوره این ماه را باز نکرده است؛ امکان ثبت کارنامه وجود ندارد.',
            ]);
        }

        $due = $locked->period->due_at;
        if ($due !== null && $due->isPast()) {
            throw ValidationException::withMessages([
                'due_at' => 'مهلت ثبت کارنامه این دوره به پایان رسیده است.',
            ]);
        }

        if (! $locked->isEditableByTeacher()) {
            throw ValidationException::withMessages([
                'status' => match ($locked->status) {
                    TeacherReportSubmission::STATUS_SUBMITTED => 'این کارنامه ارسال شده است؛ برای ویرایش باید مدیر آن را برای اصلاح برگرداند.',
                    TeacherReportSubmission::STATUS_APPROVED => 'این کارنامه تأیید شده و دیگر قابل ویرایش نیست.',
                    default => 'این کارنامه ثبت نهایی و بایگانی شده است؛ تغییر آن فقط با بازگشایی مدیر ممکن است.',
                },
            ]);
        }

        return $locked;
    }

    /** @param array<string, mixed> $line */
    private function assertLineIsOwned(TeacherReportSubmission $submission, array $line, int $index): void
    {
        $classroomSubject = ClassroomSubject::query()->find((int) ($line['classroom_subject_id'] ?? 0));

        if ($classroomSubject === null || (int) $classroomSubject->teacher_id !== (int) $submission->teacher_id) {
            abort(404, 'این درس و کلاس به معلم تخصیص داده نشده است.');
        }

        Enrollment::query()
            ->where('classroom_id', $classroomSubject->classroom_id)
            ->where('student_id', (int) ($line['student_id'] ?? 0))
            ->where('status', Enrollment::STATUS_ACTIVE)
            ->exists() || abort(404, 'دانش‌آموز در این کلاس فعال نیست.');
    }

    private function assertSubmissionOfPeriod(ReportPeriod $period, TeacherReportSubmission $submission): void
    {
        if ((int) $submission->report_period_id !== (int) $period->id) {
            abort(404);
        }
    }

    /** The teachers the "open period" picker offers — exactly the auto set. */
    public function teacherOptions(): array
    {
        $ids = $this->schoolTeacherIds();

        return User::query()->whereIn('id', $ids)
            ->orderBy('last_name')
            ->get(['id', 'ulid', 'first_name', 'last_name'])
            ->map(fn (User $u) => ['ulid' => $u->ulid, 'name' => $u->fullName()])
            ->all();
    }

    /** @return list<int> */
    private function schoolTeacherIds(): array
    {
        $viaAssignment = UserRole::query()
            ->where('school_id', $this->schoolId())
            ->active()
            ->whereHas('role', fn ($q) => $q->where('key', 'teacher'))
            ->pluck('user_id');

        $viaSubject = ClassroomSubject::query()->where('school_id', $this->schoolId())->pluck('teacher_id');

        return $viaAssignment->merge($viaSubject)->filter()->unique()->values()->all();
    }

    /** @param list<int> $teacherIds @return list<int> */
    private function assertTeachersOfSchool(array $teacherIds): array
    {
        $known = $this->schoolTeacherIds();
        $unknown = array_values(array_diff(array_map('intval', $teacherIds), $known));

        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'teachers' => 'معلمان انتخابی در این مدرسه یافت نشوند.',
            ]);
        }

        return array_values(array_unique(array_map('intval', $teacherIds)));
    }

    private function schoolId(): int
    {
        return (int) app(\App\Support\SchoolContext::class)->schoolId();
    }

    private function text(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function activity(
        ReportPeriod $period,
        ?TeacherReportSubmission $submission,
        string $action,
        ?array $detail = null,
        ?string $reason = null,
    ): void {
        ReportActivityLog::query()->create([
            'report_period_id' => $period->id,
            'teacher_report_submission_id' => $submission?->id,
            'actor_id' => auth()->id(),
            'action' => $action,
            'detail' => $detail,
            'reason' => $reason,
            'created_at' => now(),
        ]);
    }
}
