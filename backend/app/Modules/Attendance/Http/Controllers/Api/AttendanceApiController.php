<?php

namespace App\Modules\Attendance\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Academic\Models\ClassSession;
use App\Modules\Academic\Models\ClassroomSubject;
use App\Modules\Attendance\Models\AttendanceRecord;
use App\Modules\Attendance\Services\AttendanceService;
use App\Modules\People\Models\Student;
use App\Modules\People\Services\GuardianAccessService;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AttendanceApiController extends Controller
{
    public function __construct(
        private readonly AttendanceService $service,
        private readonly ScopeResolver $resolver,
        private readonly GuardianAccessService $access,
    ) {
    }

    public function createSession(Request $request): JsonResponse
    {
        $this->authorize('attendance.record');

        $data = $request->validate([
            'classroom_subject_id' => ['required', 'integer'],
            'held_on' => ['required', 'date'],
            'period' => ['required', 'integer', 'min:1'],
        ]);

        $subject = ClassroomSubject::query()->findOrFail($data['classroom_subject_id']);
        $this->assertSubjectAccess($subject);

        $session = ClassSession::query()->firstOrCreate(
            ['classroom_subject_id' => $subject->id, 'held_on' => $data['held_on'], 'period' => $data['period']],
            ['attendance_status' => ClassSession::STATUS_NOT_TAKEN],
        );

        return response()->json($this->sessionPayload($session), 201);
    }

    public function indexSessions(Request $request): JsonResponse
    {
        $this->authorize('attendance.view');

        $data = $request->validate([
            'classroom_subject_id' => ['nullable', 'integer'],
            'held_on' => ['nullable', 'date'],
        ]);

        $query = ClassSession::query()->with('classroomSubject.subject');

        if ($data['classroom_subject_id'] ?? null) {
            $query->where('classroom_subject_id', $data['classroom_subject_id']);
        }
        if ($data['held_on'] ?? null) {
            $query->where('held_on', $data['held_on']);
        }

        // Teachers see only their own sessions (sh2).
        $classroomIds = $this->resolver->classroomIds();
        if ($classroomIds !== null) {
            $query->whereHas('classroomSubject', fn ($q) => $q->whereIn('classroom_id', $classroomIds ?: [0]));
        }

        return response()->json([
            'data' => $query->orderByDesc('held_on')->limit(200)->get()
                ->map(fn (ClassSession $s) => $this->sessionPayload($s)),
        ]);
    }

    public function showSession(Request $request, ClassSession $session): JsonResponse
    {
        $this->authorize('attendance.view');

        $this->assertSessionAccess($session);

        $records = $session->attendanceRecords()->with('student')->get()->keyBy('student_id');

        // The full roster with "not reviewed" for unrecorded students (FR-5).
        $roster = \App\Modules\Academic\Models\Enrollment::query()
            ->where('classroom_id', $session->classroomSubject->classroom_id)
            ->where('status', 'active')
            ->with('student')
            ->get();

        return response()->json([
            'session' => $this->sessionPayload($session),
            'data' => $roster->map(fn ($enrollment) => [
                'student_ulid' => $enrollment->student?->ulid,
                'student_name' => $enrollment->student?->fullName(),
                // Internal ids the roll-call UI needs: saveRecords posts
                // student_id, and correcting a finalized record needs record_id.
                'student_id' => $enrollment->student_id,
                'record_id' => $records->get($enrollment->student_id)?->id,
                'status' => $records->get($enrollment->student_id)->status ?? null,
                'late_minutes' => $records->get($enrollment->student_id)->late_minutes ?? null,
            ]),
        ]);
    }

    public function saveRecords(Request $request, ClassSession $session): JsonResponse
    {
        $this->authorize('attendance.record');
        $this->assertSessionAccess($session);

        $data = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.student_id' => ['required', 'integer'],
            'rows.*.status' => ['required', 'in:present,absent,late'],
            'rows.*.late_minutes' => ['nullable', 'integer', 'min:0', 'max:240'],
        ]);

        $count = $this->service->saveDraft($session, $data['rows'], $request->user());

        return response()->json(['saved' => $count, 'session' => $this->sessionPayload($session->fresh())]);
    }

    public function finalize(Request $request, ClassSession $session): JsonResponse
    {
        $this->authorize('attendance.record');
        $this->assertSessionAccess($session);

        $summary = $this->service->finalize($session, $request->user());

        return response()->json(['summary' => $summary, 'session' => $this->sessionPayload($session->fresh())]);
    }

    public function correct(Request $request, AttendanceRecord $record): JsonResponse
    {
        $this->authorize('attendance.correct');

        $data = $request->validate([
            'status' => ['required', 'in:present,absent,late'],
            'late_minutes' => ['nullable', 'integer', 'min:0', 'max:240'],
            'reason' => ['required', 'string', 'min:5'],
        ]);

        $change = $this->service->correct(
            $record,
            $data['status'],
            $data['late_minutes'] ?? null,
            $data['reason'],
            $request->user(),
        );

        return response()->json(['id' => $change->id, 'status' => $record->fresh()->status]);
    }

    /**
     * Student attendance timeline. A guardian passes only with an effective
     * can_view_attendance flag (sh3); students see themselves (sh4).
     */
    public function studentRecords(Request $request, Student $student): JsonResponse
    {
        $this->authorize('attendance.view');

        $roleKey = app(PermissionRegistrar::class)->activeRole()?->role->key;

        if ($roleKey === 'guardian' && ! $this->access->may($request->user()->id, $student->id, 'can_view_attendance')) {
            abort(404);
        }

        if ($roleKey === 'student' && $student->user_id !== $request->user()->id) {
            abort(404);
        }

        $records = AttendanceRecord::query()
            ->where('student_id', $student->id)
            ->with('classSession.classroomSubject.subject')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (AttendanceRecord $r) => [
                'date' => $r->classSession->held_on->toDateString(),
                'period' => $r->classSession->period,
                'subject' => $r->classSession->classroomSubject->subject?->title,
                'status' => $r->status,
                'late_minutes' => $r->late_minutes,
            ]);

        return response()->json(['student_ulid' => $student->ulid, 'data' => $records]);
    }

    /**
     * SMS status page (attendance.sms_status): per-delivery state + retries.
     */
    public function smsStatus(): JsonResponse
    {
        $this->authorize('attendance.sms_status');

        $rows = \App\Modules\Notifications\Models\NotificationDelivery::query()
            ->whereHas('notification', fn ($q) => $q->where('type', 'like', 'attendance.%'))
            ->with('notification')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn ($d) => [
                'id' => $d->id,
                'type' => $d->notification->type,
                'title' => $d->notification->title,
                'channel' => $d->channel,
                'status' => $d->status,
                'attempts' => $d->attempts,
                'last_error' => $d->last_error,
                'sent_at' => $d->sent_at?->toIso8601String(),
                'next_retry_at' => $d->next_retry_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $rows]);
    }

    private function assertSubjectAccess(ClassroomSubject $subject): void
    {
        $ids = $this->resolver->classroomIds();
        if ($ids !== null && ! in_array($subject->classroom_id, $ids, true)) {
            abort(404);
        }
    }

    private function assertSessionAccess(ClassSession $session): void
    {
        $this->assertSubjectAccess($session->classroomSubject);
    }

    private function sessionPayload(ClassSession $s): array
    {
        return [
            'id' => $s->id,
            'held_on' => $s->held_on->toDateString(),
            'period' => $s->period,
            'status' => $s->attendance_status,
            'subject' => $s->classroomSubject?->subject?->title,
            'classroom_subject_id' => $s->classroom_subject_id,
        ];
    }
}
