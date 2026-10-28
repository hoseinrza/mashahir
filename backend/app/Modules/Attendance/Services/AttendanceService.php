<?php

namespace App\Modules\Attendance\Services;

use App\Modules\Academic\Models\ClassSession;
use App\Modules\Attendance\Models\AttendanceChange;
use App\Modules\Attendance\Models\AttendanceRecord;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Models\Notification;
use App\Modules\People\Services\GuardianAccessService;
use App\Modules\People\Models\GuardianLink;
use App\Modules\Notifications\Services\NotificationService;
use App\Support\AppendOnlyViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Attendance lifecycle: draft -> finalize -> (same-day corrections | sh7).
 * Finalization fans out absence/late alerts to guardians whose links carry
 * can_receive_sms — mandatory school messages (sh14).
 */
final class AttendanceService
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly GuardianAccessService $access,
        private readonly AuditService $audit,
    ) {
    }

    /**
     * Save (or replace) the draft rows of a session. Unmentioned students
     * stay "not reviewed" — never implicitly present (FR-5).
     *
     * @param array<int, array{student_id: int, status: string, late_minutes?: ?int}> $rows
     */
    public function saveDraft(ClassSession $session, array $rows, User $recorder): int
    {
        if ($session->attendance_status === ClassSession::STATUS_FINALIZED) {
            throw ValidationException::withMessages(['session' => 'جلسه نهایی شده است؛ از اصلاح استفاده کنید.']);
        }

        return DB::transaction(function () use ($session, $rows, $recorder) {
            foreach ($rows as $row) {
                AttendanceRecord::query()->updateOrCreate(
                    ['class_session_id' => $session->id, 'student_id' => $row['student_id']],
                    [
                        'school_id' => $session->school_id,
                        'status' => $row['status'],
                        'late_minutes' => $row['late_minutes'] ?? null,
                        'source' => 'manual',
                        'recorded_by' => $recorder->id,
                        'recorded_at' => now(),
                    ],
                );
            }

            $session->forceFill(['attendance_status' => ClassSession::STATUS_DRAFT])->save();

            return count($rows);
        });
    }

    /**
     * FR-7/FR-8: finalize with a summary, then queue guardian alerts.
     *
     * @return array{present: int, absent: int, late: int, unchecked: int}
     */
    public function finalize(ClassSession $session, User $finalizer): array
    {
        if ($session->attendance_status === ClassSession::STATUS_FINALIZED) {
            throw ValidationException::withMessages(['session' => 'این جلسه از قبل نهایی شده است.']);
        }

        $records = $session->attendanceRecords()->get();

        $summary = [
            'present' => $records->where('status', AttendanceRecord::STATUS_PRESENT)->count(),
            'absent' => $records->where('status', AttendanceRecord::STATUS_ABSENT)->count(),
            'late' => $records->where('status', AttendanceRecord::STATUS_LATE)->count(),
            'unchecked' => 0, // filled below from the enrollment roster
        ];

        $enrolledCount = DB::table('enrollments')
            ->where('classroom_id', $session->classroomSubject->classroom_id)
            ->where('status', 'active')
            ->count();

        $summary['unchecked'] = max(0, $enrolledCount - $records->count());

        DB::transaction(function () use ($session, $finalizer, $summary) {
            $session->forceFill([
                'attendance_status' => ClassSession::STATUS_FINALIZED,
                'finalized_by' => $finalizer->id,
                'finalized_at' => now(),
            ])->save();

            $this->queueGuardianAlerts($session);
        });

        $this->audit->log('attendance.finalized', $session, new: $summary);

        return $summary;
    }

    /**
     * Absence/late alerts to every guardian holding an effective
     * can_receive_sms flag — per-link, never shared between guardians.
     */
    private function queueGuardianAlerts(ClassSession $session): void
    {
        $records = $session->attendanceRecords()
            ->whereIn('status', [AttendanceRecord::STATUS_ABSENT, AttendanceRecord::STATUS_LATE])
            ->with('student')
            ->get();

        foreach ($records as $record) {
            $links = GuardianLink::query()
                ->where('student_id', $record->student_id)
                ->usable()
                ->with('guardian')
                ->get();

            foreach ($links as $link) {
                if (! $this->access->effectiveFlags($link)['can_receive_sms']) {
                    continue;
                }

                $guardian = $link->guardian;
                if ($guardian === null) {
                    continue;
                }

                $type = $record->status === AttendanceRecord::STATUS_ABSENT
                    ? 'attendance.absence'
                    : 'attendance.late';

                $this->notifications->notify(
                    $guardian,
                    $record->student_id,
                    $type,
                    $record->status === AttendanceRecord::STATUS_ABSENT
                        ? "غیبت: {$record->student->fullName()}"
                        : "تأخیر ({$record->late_minutes} دقیقه): {$record->student->fullName()}",
                    "جلسه {$session->held_on->toDateString()} - زنگ {$session->period}",
                    '/attendance',
                    Notification::IMPORTANCE_IMPORTANT,
                    ['in_app', 'sms'],
                    ['class_session_id' => $session->id],
                );
            }
        }
    }

    /**
     * sh9: free correction until the end of the session day; afterwards only
     * the school admin with a logged reason (sh7).
     */
    public function correct(AttendanceRecord $record, string $newStatus, ?int $lateMinutes, string $reason, User $actor): AttendanceChange
    {
        $session = $record->classSession;

        if ($session->attendance_status !== ClassSession::STATUS_FINALIZED) {
            throw ValidationException::withMessages(['session' => 'اصلاح فقط پس از نهایی‌سازی معنا دارد.']);
        }

        $isSameDay = $session->held_on->toDateString() === now()->toDateString();
        $isAdmin = $actor->can('attendance.correct') && app(\App\Support\Rbac\PermissionRegistrar::class)->conditionFor('attendance.correct') === 'sh7';

        if (! $isSameDay && ! $isAdmin) {
            throw ValidationException::withMessages([
                'session' => 'مهلت اصلاح این جلسه تمام شده است؛ فقط مدیر مدرسه با ثبت دلیل می‌تواند اصلاح کند.',
            ]);
        }

        $oldStatus = $record->status;

        $change = DB::transaction(function () use ($record, $newStatus, $lateMinutes, $reason, $actor) {
            $change = AttendanceChange::query()->create([
                'school_id' => $record->school_id,
                'attendance_record_id' => $record->id,
                'old_status' => $record->status,
                'new_status' => $newStatus,
                'reason' => $reason,
                'changed_by' => $actor->id,
            ]);

            $record->forceFill([
                'status' => $newStatus,
                'late_minutes' => $newStatus === AttendanceRecord::STATUS_LATE ? ($lateMinutes ?? 0) : null,
                'recorded_by' => $actor->id,
                'recorded_at' => now(),
            ])->save();

            return $change;
        });

        $this->audit->log('attendance.corrected', $record, old: ['status' => $oldStatus], new: ['status' => $newStatus], reason: $reason);

        return $change;
    }
}
