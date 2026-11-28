<?php

namespace App\Modules\People\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\People\Http\Resources\GuardianLinkResource;
use App\Modules\People\Models\GuardianLink;
use App\Modules\People\Models\Student;
use App\Modules\People\Services\GuardianAccessService;
use App\Support\Rbac\PermissionRegistrar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class GuardianLinksApiController extends Controller
{
    public function __construct(
        private readonly GuardianAccessService $access,
        private readonly \App\Support\Rbac\ScopeResolver $resolver,
        private readonly AuditService $audit,
    ) {
    }

    public function index(Request $request)
    {
        $this->authorize('viewAny', GuardianLink::class);

        $query = GuardianLink::query()->with(['student', 'guardian']);

        if (app(PermissionRegistrar::class)->activeRole()?->role->key === 'guardian') {
            // sh4: a guardian sees only his own links.
            $query->where('guardian_user_id', $request->user()->id);
        }

        return GuardianLinkResource::collection($query->orderByDesc('id')->get());
    }

    /**
     * sh15: a guardian requests the connection; it stays pending until the
     * school approves.
     */
    public function requestLink(Request $request): JsonResponse
    {
        $this->authorize('request', GuardianLink::class);

        $data = $request->validate([
            'student_ulid' => ['required', 'string'],
        ]);

        $student = \App\Modules\People\Models\Student::query()
            ->where('ulid', $data['student_ulid'])
            ->firstOrFail();

        $exists = GuardianLink::query()
            ->where('guardian_user_id', $request->user()->id)
            ->where('student_id', $student->id)
            ->whereIn('status', [GuardianLink::STATUS_PENDING, GuardianLink::STATUS_ACTIVE])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['student_ulid' => 'پیوند فعال یا در انتظار تأیید از قبل وجود دارد.']);
        }

        $link = GuardianLink::query()->create([
            'guardian_user_id' => $request->user()->id,
            'student_id' => $student->id,
            'link_type' => GuardianLink::TYPE_PRIMARY,
            'status' => GuardianLink::STATUS_PENDING,
        ]);

        $this->audit->log('guardian_link.requested', $link->student, new: ['guardian_link_id' => $link->id]);

        return (new GuardianLinkResource($link->fresh(['student', 'guardian'])))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * School approval activates the link. Flags come from the school, never
     * from the guardian.
     */
    public function approve(Request $request, GuardianLink $link): GuardianLinkResource
    {
        $this->authorize('manage', $link);

        $data = $request->validate([
            'link_type' => ['sometimes', Rule::in(array_keys($this->linkTypes()))],
            'can_view_grades' => ['sometimes', 'boolean'],
            'can_view_attendance' => ['sometimes', 'boolean'],
            'can_approve_consent' => ['sometimes', 'boolean'],
            'can_pickup' => ['sometimes', 'boolean'],
            'can_receive_sms' => ['sometimes', 'boolean'],
            'ends_on' => ['sometimes', 'nullable', 'date'],
            'verification_file_id' => ['sometimes', 'nullable', 'integer'],
            'admin_note' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'reason' => ['required', 'string', 'min:5'],
        ]);

        if ($link->status === GuardianLink::STATUS_ACTIVE) {
            throw ValidationException::withMessages(['status' => 'این پیوند از قبل فعال است.']);
        }

        $link->forceFill([
            ...collect($data)->except(['reason'])->filter(fn ($v) => $v !== null)->all(),
            'status' => GuardianLink::STATUS_ACTIVE,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ])->save();

        $this->audit->log('guardian_link.approved', $link->student, new: $data, reason: $data['reason']);

        return new GuardianLinkResource($link->fresh(['student', 'guardian']));
    }

    /**
     * Flag/type changes are always reason-logged (family rules §5.6 / sh7).
     */
    public function update(Request $request, GuardianLink $link): GuardianLinkResource
    {
        $this->authorize('manage', $link);

        $data = $request->validate([
            'link_type' => ['sometimes', Rule::in(array_keys($this->linkTypes()))],
            'can_view_grades' => ['sometimes', 'boolean'],
            'can_view_attendance' => ['sometimes', 'boolean'],
            'can_approve_consent' => ['sometimes', 'boolean'],
            'can_pickup' => ['sometimes', 'boolean'],
            'can_receive_sms' => ['sometimes', 'boolean'],
            'verification_file_id' => ['sometimes', 'nullable', 'integer'],
            'admin_note' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'reason' => ['required', 'string', 'min:5'],
        ]);

        $old = $link->only([...GuardianAccessService::FLAG_KEYS, 'link_type']);

        $link->forceFill(collect($data)->except(['reason'])->all())->save();

        $this->audit->log(
            'guardian_link.updated',
            $link->student,
            old: $old,
            new: collect($data)->except(['reason'])->all(),
            reason: $data['reason'],
        );

        return new GuardianLinkResource($link->fresh(['student', 'guardian']));
    }

    /**
     * Ending a link cuts access immediately (ends_on yesterday) and keeps
     * history.
     */
    public function end(Request $request, GuardianLink $link): GuardianLinkResource
    {
        $this->authorize('manage', $link);

        $data = $request->validate(['reason' => ['required', 'string', 'min:5']]);

        $link->forceFill([
            'status' => GuardianLink::STATUS_ENDED,
            'ends_on' => now()->subDay()->toDateString(),
        ])->save();

        $this->audit->log(
            'guardian_link.ended',
            $link->student,
            old: ['status' => $link->getOriginal('status')],
            new: ['status' => GuardianLink::STATUS_ENDED],
            reason: $data['reason'],
        );

        return new GuardianLinkResource($link->fresh(['student', 'guardian']));
    }

    /**
     * Guardian self-view of his children with effective flags (sh3).
     */
    public function myChildren(Request $request): JsonResponse
    {
        $links = $this->resolver->myGuardianLinks(); // active links of the guardian

        return response()->json([
            'data' => $links->map(fn (GuardianLink $link) => [
                'student_ulid' => $link->student?->ulid,
                'student_name' => $link->student?->fullName(),
                'link_type' => $link->link_type,
                'link_label' => self::linkTypes()[$link->link_type] ?? $link->link_type,
                'effective_flags' => $this->access->effectiveFlags($link),
            ])->values(),
        ]);
    }

    private function linkTypes(): array
    {
        return GuardianLink::typeLabels();
    }
}
