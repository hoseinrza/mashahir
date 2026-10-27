<?php

namespace App\Modules\Audit\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Models\AuditLog;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogsApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', AuditLog::class);

        $data = $request->validate([
            'action' => ['nullable', 'string', 'max:100'],
            'actor_ulid' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        /** @var SchoolContext $context */
        $context = app(SchoolContext::class);

        $query = AuditLog::query()
            ->with('actor')
            ->where('school_id', $context->schoolId())
            ->orderByDesc('id');

        if ($data['action'] ?? null) {
            $query->where('action', 'like', $data['action'].'%');
        }

        if ($data['actor_ulid'] ?? null) {
            $actorId = \App\Modules\Identity\Models\User::query()->where('ulid', $data['actor_ulid'])->value('id');
            $query->where('actor_id', $actorId ?? 0);
        }

        $logs = $query->paginate(min($data['per_page'] ?? 50, 100));

        return response()->json([
            'data' => collect($logs->items())->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'actor' => $log->actor ? [
                    'ulid' => $log->actor->ulid,
                    'name' => $log->actor->fullName(),
                ] : null,
                'subject_type' => $log->subject_type,
                'subject_id' => $log->subject_id,
                'old' => $log->old,
                'new' => $log->new,
                'reason' => $log->reason,
                'ip' => $log->ip,
                'created_at' => $log->created_at?->toIso8601String(),
            ]),
            'links' => $logs->linkCollection(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
