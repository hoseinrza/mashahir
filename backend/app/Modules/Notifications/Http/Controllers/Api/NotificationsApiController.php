<?php

namespace App\Modules\Notifications\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationDelivery;
use App\Modules\Notifications\Models\NotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * FR-28: tabs all/unread/important/archived; FR-29 channel preferences
 * (sh14 mandatory school messages cannot be disabled).
 */
class NotificationsApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('notifications.view_own');

        $data = $request->validate([
            'tab' => ['nullable', 'in:all,unread,important,archived'],
            'student_ulid' => ['nullable', 'string'],
        ]);

        $query = Notification::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id');

        match ($data['tab'] ?? 'all') {
            'unread' => $query->whereNull('read_at')->whereNull('archived_at'),
            'important' => $query->whereIn('importance', [Notification::IMPORTANCE_IMPORTANT, Notification::IMPORTANCE_URGENT])->whereNull('archived_at'),
            'archived' => $query->whereNotNull('archived_at'),
            default => $query->whereNull('archived_at'),
        };

        if ($data['student_ulid'] ?? null) {
            $studentId = \App\Modules\People\Models\Student::query()
                ->where('ulid', $data['student_ulid'])->value('id');
            $query->where('student_id', $studentId ?? 0);
        }

        $rows = $query->limit(100)->get();

        return response()->json([
            'unread_count' => Notification::query()
                ->where('user_id', $request->user()->id)
                ->whereNull('read_at')->whereNull('archived_at')->count(),
            'data' => $rows->map(fn (Notification $n) => $this->payload($n)),
        ]);
    }

    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        $this->authorize('notifications.view_own');

        if ($notification->user_id !== $request->user()->id) {
            abort(404);
        }

        $notification->forceFill(['read_at' => now()])->save();

        return response()->json($this->payload($notification->fresh()));
    }

    public function archive(Request $request, Notification $notification): JsonResponse
    {
        $this->authorize('notifications.view_own');

        if ($notification->user_id !== $request->user()->id) {
            abort(404);
        }

        $notification->forceFill(['archived_at' => now()])->save();

        return response()->json($this->payload($notification->fresh()));
    }

    public function updatePreference(Request $request): JsonResponse
    {
        $this->authorize('notifications.preferences');

        $data = $request->validate([
            'type' => ['required', 'string', 'max:100'],
            'channel' => ['required', 'in:in_app,sms,push'],
            'enabled' => ['required', 'boolean'],
        ]);

        // sh14: mandatory school alerts are not mutable.
        if (in_array($data['type'], \App\Modules\Notifications\Services\NotificationService::MANDATORY_TYPES, true)
            && $data['enabled'] === false) {
            throw ValidationException::withMessages(['enabled' => 'پیام‌های اجباری مدرسه قابل غیرفعال‌سازی نیستند (ش۱۴).']);
        }

        NotificationPreference::query()->updateOrCreate(
            ['user_id' => $request->user()->id, 'type' => $data['type'], 'channel' => $data['channel']],
            ['enabled' => $data['enabled']],
        );

        return response()->json(['saved' => true]);
    }

    public function listPreferences(Request $request): JsonResponse
    {
        $this->authorize('notifications.preferences');

        return response()->json([
            'data' => NotificationPreference::query()
                ->where('user_id', $request->user()->id)
                ->get()
                ->map(fn (NotificationPreference $p) => [
                    'type' => $p->type, 'channel' => $p->channel, 'enabled' => $p->enabled,
                ]),
            'mandatory_types' => \App\Modules\Notifications\Services\NotificationService::MANDATORY_TYPES,
        ]);
    }

    /**
     * SMS retry button (attendance.sms_status scope reused for staff).
     */
    public function retryDelivery(Request $request, NotificationDelivery $delivery): JsonResponse
    {
        $this->authorize('attendance.sms_status');

        $delivery->forceFill([
            'status' => NotificationDelivery::STATUS_QUEUED,
            'next_retry_at' => now(),
        ])->save();

        $sent = app(\App\Modules\Notifications\Services\NotificationService::class)->dispatchQueued();

        return response()->json(['id' => $delivery->id, 'status' => $delivery->fresh()->status, 'dispatched' => $sent]);
    }

    private function payload(Notification $n): array
    {
        return [
            'id' => $n->id,
            'type' => $n->type,
            'importance' => $n->importance,
            'title' => $n->title,
            'body' => $n->body,
            'link' => $n->link,
            'student_ulid' => $n->student?->ulid,
            'read_at' => $n->read_at?->toIso8601String(),
            'archived_at' => $n->archived_at?->toIso8601String(),
            'created_at' => $n->created_at?->toIso8601String(),
        ];
    }
}
