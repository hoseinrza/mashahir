<?php

namespace App\Modules\People\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\People\Models\PickupAuthorization;
use App\Modules\People\Models\Student;
use App\Support\PhoneHash;
use App\Support\Rbac\PermissionRegistrar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PickupApiController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(Request $request, Student $student): JsonResponse
    {
        if (! $request->user()->can('viewForStudent', [PickupAuthorization::class, (int) $student->id])) {
            // Foreign school students never resolve; out-of-scope guardians
            // also get 404 — the list simply does not exist for them.
            abort(404);
        }

        $rows = PickupAuthorization::query()
            ->where('student_id', $student->id)
            ->where('status', PickupAuthorization::STATUS_ACTIVE)
            ->orderBy('full_name')
            ->get()
            ->map(fn (PickupAuthorization $row) => [
                'id' => $row->id,
                'full_name' => $row->full_name,
                'relation' => $row->relation,
                'status' => $row->status,
                'locked' => $row->locked,
                'is_linked_guardian' => $row->guardian_user_id !== null,
            ]);

        return response()->json(['student_ulid' => $student->ulid, 'data' => $rows]);
    }

    /**
     * sh7 for school staff; sh13 (ناظم) creates INACTIVE rows — a suggestion
     * that the school must confirm before it becomes effective.
     */
    public function store(Request $request, Student $student): JsonResponse
    {
        if (! $request->user()->can('create', PickupAuthorization::class)) {
            abort(403);
        }

        if (! $request->user()->can('viewForStudent', [PickupAuthorization::class, (int) $student->id])) {
            abort(404);
        }

        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:200'],
            'phone' => ['required', 'string', 'min:10', 'max:20'],
            'relation' => ['nullable', 'string', 'max:100'],
            'guardian_ulid' => ['nullable', 'string'],
            'reason' => ['required', 'string', 'min:5'],
        ]);

        $guardianId = null;
        if ($data['guardian_ulid'] ?? null) {
            $guardianId = \App\Modules\Identity\Models\User::query()
                ->where('ulid', $data['guardian_ulid'])->value('id');
            if ($guardianId === null) {
                throw ValidationException::withMessages(['guardian_ulid' => 'ولی یافت نشد.']);
            }
        }

        $suggestionOnly = app(PermissionRegistrar::class)->conditionFor('pickup.manage') === 'sh13';

        $row = PickupAuthorization::query()->create([
            'student_id' => $student->id,
            'full_name' => $data['full_name'],
            'phone' => $data['phone'],
            'relation' => $data['relation'] ?? null,
            'guardian_user_id' => $guardianId,
            'status' => $suggestionOnly ? 'inactive' : 'active',
        ]);

        $this->audit->log('pickup.authorization_created', $student, new: [
            'id' => $row->id,
            'full_name' => $row->full_name,
            'status' => $row->status,
            'suggestion_only' => $suggestionOnly,
        ], reason: $data['reason']);

        return response()->json([
            'id' => $row->id,
            'status' => $row->status,
            'suggestion_only' => $suggestionOnly,
        ], 201);
    }

    public function update(Request $request, PickupAuthorization $authorization): JsonResponse
    {
        if (! $request->user()->can('update', $authorization)) {
            // A locked list (court order) is untouchable → treat as 404-level
            // denial for the caller's intent; 403 signals the lock explicitly.
            abort(403, 'این ردیف قفل است یا اجازه تغییر ندارید.');
        }

        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:200'],
            'phone' => ['sometimes', 'string', 'min:10', 'max:20'],
            'relation' => ['sometimes', 'nullable', 'string', 'max:100'],
            'status' => ['sometimes', 'in:active,inactive'],
            'locked' => ['sometimes', 'boolean'],
            'reason' => ['required', 'string', 'min:5'],
        ]);

        $old = $authorization->only(['full_name', 'relation', 'status', 'locked']);

        $authorization->forceFill(collect($data)->except(['reason'])->all())->save();

        $this->audit->log(
            'pickup.authorization_updated',
            $authorization->student,
            old: $old,
            new: collect($data)->except(['reason'])->all(),
            reason: $data['reason'],
        );

        return response()->json(['id' => $authorization->id, 'status' => $authorization->fresh()->status]);
    }
}
