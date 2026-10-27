<?php

namespace App\Modules\People\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\People\Models\CourtOrder;
use App\Modules\People\Models\GuardianLink;
use App\Modules\People\Models\Student;
use App\Modules\People\Services\GuardianAccessService;
use App\Support\Rbac\PermissionRegistrar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CourtOrdersApiController extends Controller
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly GuardianAccessService $access,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', CourtOrder::class);

        $data = $request->validate([
            'student_ulid' => ['nullable', 'string'],
        ]);

        $query = CourtOrder::query()->with('student')->orderByDesc('id');

        if ($data['student_ulid'] ?? null) {
            $student = Student::query()->where('ulid', $data['student_ulid'])->firstOrFail();
            $query->where('student_id', $student->id);
        }

        // sh16: the discipline deputy sees the restriction summary only,
        // never the court document reference.
        $summaryOnly = app(PermissionRegistrar::class)->conditionFor('court_orders.view') === 'sh16';

        return response()->json([
            'data' => $query->get()->map(fn (CourtOrder $order) => [
                'id' => $order->id,
                'student_ulid' => $order->student?->ulid,
                'restrictions' => $order->restrictions,
                'valid_from' => $order->valid_from?->toDateString(),
                'valid_to' => $order->valid_to?->toDateString(),
                // sh16: summary only — the document reference stays hidden.
                'file' => $summaryOnly ? null : $order->file?->ulid,
            ]),
            'summary_only' => $summaryOnly,
        ]);
    }

    /**
     * sh7: registering or changing a court order requires a reason and is
     * always audited.
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', CourtOrder::class);

        $data = $request->validate([
            'student_ulid' => ['required', 'string'],
            'guardian_link_id' => ['nullable', 'integer'],
            'restrictions' => ['nullable', 'array'],
            'restrictions.*' => ['boolean'],
            'file_id' => ['nullable', 'integer'],
            'valid_from' => ['nullable', 'date'],
            'valid_to' => ['nullable', 'date', 'after_or_equal:valid_from'],
            'reason' => ['required', 'string', 'min:5'],
        ]);

        $student = Student::query()->where('ulid', $data['student_ulid'])->firstOrFail();

        if (($data['guardian_link_id'] ?? null) !== null) {
            $linkExists = GuardianLink::query()
                ->whereKey($data['guardian_link_id'])
                ->where('student_id', $student->id)
                ->exists();

            if (! $linkExists) {
                throw ValidationException::withMessages(['guardian_link_id' => 'پیوند به این دانش‌آموز تعلق ندارد.']);
            }
        }

        $order = CourtOrder::query()->create([
            'student_id' => $student->id,
            'guardian_link_id' => $data['guardian_link_id'] ?? null,
            'restrictions' => $data['restrictions'] ?? null,
            'file_id' => $data['file_id'] ?? null,
            'valid_from' => $data['valid_from'] ?? null,
            'valid_to' => $data['valid_to'] ?? null,
            'registered_by' => $request->user()->id,
        ]);

        $this->audit->log('court_order.registered', $student, new: $data, reason: $data['reason']);

        return response()->json(['id' => $order->id, 'restrictions' => $order->restrictions], 201);
    }
}
