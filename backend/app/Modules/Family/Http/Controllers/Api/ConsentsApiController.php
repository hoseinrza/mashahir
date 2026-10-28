<?php

namespace App\Modules\Family\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Family\Models\ConsentRequest;
use App\Modules\Family\Models\ConsentResponse;
use App\Modules\People\Models\Student;
use App\Modules\People\Services\GuardianAccessService;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ConsentsApiController extends Controller
{
    public function __construct(private readonly GuardianAccessService $access)
    {
    }

    /**
     * FR: consent policy comes from school_settings (per-school decision).
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('consents.manage');

        $data = $request->validate([
            'student_ulid' => ['required', 'string'],
            'title' => ['required', 'string', 'max:200'],
            'body' => ['nullable', 'string'],
            'due_at' => ['nullable', 'date', 'after:now'],
            // Defaults to the school's setting; explicit override allowed.
            'policy' => ['nullable', 'in:one_parent,both_parents'],
        ]);

        $student = Student::query()->where('ulid', $data['student_ulid'])->firstOrFail();

        $school = \App\Modules\School\Models\School::query()->find(app(SchoolContext::class)->schoolId());
        $policy = $data['policy'] ?? $school?->consentPolicy() ?? ConsentRequest::POLICY_ONE_PARENT;

        $request2 = ConsentRequest::query()->create([
            'student_id' => $student->id,
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'policy' => $policy,
            'due_at' => $data['due_at'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        // The teacher only ever gets NOTIFIED that his class has a trip —
        // he never manages or views consents (client decision, 1405-08-06).
        $enrollment = \App\Modules\Academic\Models\Enrollment::query()
            ->where('student_id', $student->id)
            ->where('status', 'active')
            ->first();

        if ($enrollment !== null) {
            $teacherIds = \App\Modules\Academic\Models\ClassroomSubject::query()
                ->where('classroom_id', $enrollment->classroom_id)
                ->whereNotNull('teacher_id')
                ->pluck('teacher_id')
                ->unique();

            foreach ($teacherIds as $teacherId) {
                $teacher = \App\Modules\Identity\Models\User::query()->find($teacherId);
                if ($teacher === null) {
                    continue;
                }

                app(\App\Modules\Notifications\Services\NotificationService::class)->notify(
                    $teacher,
                    $student->id,
                    'consent.request',
                    "«{$data['title']}» برای کلاس شما",
                    'رضایتنامه برای دانش‌آموز ' . $student->fullName() . ' ثبت شد؛ اولیا تا مهلت مقرر پاسخ می‌دهند.',
                    '/notifications',
                    \App\Modules\Notifications\Models\Notification::IMPORTANCE_IMPORTANT,
                    ['in_app'],
                );
            }
        }

        return response()->json(['ulid' => $request2->ulid, 'policy' => $request2->policy], 201);
    }

    /**
     * Staff see results (consents.view_results); a guardian only sees the
     * children flagged can_approve_consent (sh3).
     */
    public function index(Request $request): JsonResponse
    {
        $roleKey = app(\App\Support\Rbac\PermissionRegistrar::class)->activeRole()?->role->key;

        if ($roleKey === 'guardian') {
            if (! app(\App\Support\Rbac\PermissionRegistrar::class)->allows('consents.respond')) {
                abort(403);
            }

            $childrenIds = collect(app(\App\Support\Rbac\ScopeResolver::class)->studentIds() ?? [])
                ->filter(fn ($sid) => $this->access->may($request->user()->id, $sid, 'can_approve_consent'));

            $rows = ConsentRequest::query()
                ->whereIn('student_id', $childrenIds ?: [0])
                ->with(['responses', 'student'])
                ->orderByDesc('id')->limit(100)->get();
        } else {
            $this->authorize('consents.view_results');
            $rows = ConsentRequest::query()->with(['responses', 'student'])->orderByDesc('id')->limit(100)->get();
        }

        return response()->json([
            'data' => $rows->map(fn (ConsentRequest $c) => [
                'ulid' => $c->ulid,
                'title' => $c->title,
                'body' => $c->body,
                'policy' => $c->policy,
                'due_at' => $c->due_at?->toIso8601String(),
                'student_ulid' => $c->student?->ulid,
                'student_name' => $c->student?->fullName(),
                'satisfied' => $c->isSatisfied(),
                'my_decision' => $c->responses->firstWhere('guardian_user_id', $request->user()->id)?->decision,
                'responses' => $c->responses->map(fn (ConsentResponse $r) => [
                    'guardian_ulid' => $r->guardian?->ulid,
                    'decision' => $r->decision,
                    'decided_at' => $r->decided_at->toIso8601String(),
                ]),
            ]),
        ]);
    }

    /**
     * sh3: the response right lives on the LINK's can_approve_consent flag;
     * the court order can veto it.
     */
    public function respond(Request $request, ConsentRequest $consent): JsonResponse
    {
        $this->authorize('consents.respond');

        $data = $request->validate(['decision' => ['required', 'in:approved,rejected']]);

        $guardianId = $request->user()->id;

        $link = \App\Modules\People\Models\GuardianLink::query()
            ->where('guardian_user_id', $guardianId)
            ->where('student_id', $consent->student_id)
            ->usable()
            ->first();

        if ($link === null || ! $this->access->effectiveFlags($link)['can_approve_consent']) {
            abort(404);
        }

        $response = ConsentResponse::query()->updateOrCreate(
            ['consent_request_id' => $consent->id, 'student_id' => $consent->student_id, 'guardian_user_id' => $guardianId],
            ['decision' => $data['decision'], 'decided_at' => now()],
        );

        return response()->json([
            'decision' => $response->decision,
            'satisfied' => $consent->fresh('responses')->isSatisfied(),
        ]);
    }
}
