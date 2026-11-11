<?php

namespace App\Modules\Counseling\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Counseling\Models\CounselingAppointment;
use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Services\NotificationService;
use App\Modules\People\Models\Student;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * مشاورهٔ مدرسه: دانش‌آموز یا ولی نوبت درخواست می‌کند، مشاور زمان‌بندی و
 * تکمیل می‌کند. یادداشت محرمانه فقط در دامنهٔ counseling.manage دیده می‌شود.
 */
class CounselingApiController extends Controller
{
    public function __construct(
        private readonly ScopeResolver $resolver,
        private readonly PermissionRegistrar $registrar,
        private readonly AuditService $audit,
        private readonly NotificationService $notifications,
    ) {
    }

    public function index(): JsonResponse
    {
        $this->authorize('counseling.view');

        $query = CounselingAppointment::query()->with(['student', 'counselor', 'requester']);

        $roleKey = $this->registrar->activeRole()?->role->key;
        $canManage = $this->registrar->allows('counseling.manage');

        if (in_array($roleKey, ['student', 'guardian'], true)) {
            // sh3/sh4: only the learner's own records (or his children's).
            $ids = $this->resolver->studentIds() ?? [];
            $query->whereIn('student_id', $ids ?: [0]);
        } elseif (! $canManage) {
            // A counselor without the manage grant sees only his own bench.
            $query->where('counselor_user_id', auth()->id());
        }

        return response()->json([
            'data' => $query->orderByDesc('id')->limit(100)->get()
                ->map(fn (CounselingAppointment $appointment) => $this->payload($appointment, $canManage)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('counseling.request');

        $data = $request->validate([
            'student_ulid' => ['required', 'string'],
            'topic' => ['required', 'string', 'min:3', 'max:500'],
            'type' => ['sometimes', Rule::in([CounselingAppointment::TYPE_IN_PERSON, CounselingAppointment::TYPE_ONLINE])],
            'preferred_at' => ['nullable', 'date', 'after:now'],
        ]);

        $student = Student::query()->where('ulid', $data['student_ulid'])->firstOrFail();

        // Default deny + scope: a learner may only book for himself, a guardian
        // only for his active links; staff with manage may book for anyone.
        if (! $this->registrar->allows('counseling.manage')) {
            $ids = array_map('intval', $this->resolver->studentIds() ?? []);

            if (! in_array((int) $student->id, $ids, true)) {
                abort(404);
            }
        }

        $appointment = CounselingAppointment::query()->create([
            'student_id' => $student->id,
            'requester_user_id' => $request->user()->id,
            'topic' => $data['topic'],
            'type' => $data['type'] ?? CounselingAppointment::TYPE_IN_PERSON,
            'status' => CounselingAppointment::STATUS_REQUESTED,
            'scheduled_at' => $data['preferred_at'] ?? null,
        ]);

        $this->audit->log('counseling.requested', $student, new: ['appointment_id' => $appointment->id]);

        // Every staff member whose active role holds counseling.manage follows
        // the request bench (school_admin + support, plus any custom role).
        $counselors = User::query()
            ->whereHas('userRoles', fn ($q) => $q->active()
                ->where('school_id', $student->school_id)
                ->whereHas('role.permissions', fn ($p) => $p->where('key', 'counseling.manage')))
            ->get();

        foreach ($counselors as $counselor) {
            if ($counselor->id === $request->user()->id) {
                continue;
            }

            $this->notifications->notify(
                $counselor,
                $student->id,
                'counseling.requested',
                "درخواست مشاورهٔ جدید: {$student->fullName()}",
                $data['topic'],
                '/counseling',
                Notification::IMPORTANCE_IMPORTANT,
            );
        }

        return response()->json(
            $this->payload($appointment->fresh(['student', 'counselor', 'requester']), false),
            201,
        );
    }

    public function update(Request $request, CounselingAppointment $appointment): JsonResponse
    {
        $this->authorize('counseling.manage');

        $data = $request->validate([
            'counselor_ulid' => ['sometimes', 'nullable', 'string', 'size:26'],
            'scheduled_at' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', Rule::in([
                CounselingAppointment::STATUS_REQUESTED,
                CounselingAppointment::STATUS_SCHEDULED,
                CounselingAppointment::STATUS_COMPLETED,
                CounselingAppointment::STATUS_CANCELLED,
            ])],
            'type' => ['sometimes', Rule::in([CounselingAppointment::TYPE_IN_PERSON, CounselingAppointment::TYPE_ONLINE])],
            'shared_summary' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'confidential_notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'follow_up_plan' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ]);

        if (array_key_exists('counselor_ulid', $data)) {
            if ($data['counselor_ulid'] === null) {
                $data['counselor_user_id'] = null;
            } else {
                $counselorId = User::query()->where('ulid', $data['counselor_ulid'])->value('id');

                if ($counselorId === null) {
                    throw ValidationException::withMessages(['counselor_ulid' => 'مشاور یافت نشد.']);
                }

                $data['counselor_user_id'] = $counselorId;
            }

            unset($data['counselor_ulid']);
        }

        $old = $appointment->only([
            'counselor_user_id', 'scheduled_at', 'status', 'shared_summary', 'follow_up_plan',
        ]);

        $appointment->update($data);

        $this->audit->log('counseling.updated', $appointment, old: $old, new: $data);

        return response()->json(
            $this->payload($appointment->fresh(['student', 'counselor', 'requester']), true),
        );
    }

    private function payload(CounselingAppointment $appointment, bool $canManage): array
    {
        return [
            'ulid' => $appointment->ulid,
            'topic' => $appointment->topic,
            'type' => $appointment->type,
            'status' => $appointment->status,
            'student_ulid' => $appointment->student?->ulid,
            'student_name' => $appointment->student?->fullName(),
            'requester_name' => $appointment->requester?->fullName(),
            'counselor_ulid' => $appointment->counselor?->ulid,
            'counselor_name' => $appointment->counselor?->fullName(),
            'scheduled_at' => $appointment->scheduled_at?->toIso8601String(),
            'shared_summary' => $appointment->shared_summary,
            'follow_up_plan' => $appointment->follow_up_plan,
            // Confidential notes never leave the manage scope.
            'confidential_notes' => $canManage ? $appointment->confidential_notes : null,
            'created_at' => $appointment->created_at?->toIso8601String(),
        ];
    }
}
