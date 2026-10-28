<?php

namespace App\Modules\Notifications\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Notifications\Models\Announcement;
use App\Modules\Notifications\Models\AnnouncementTarget;
use App\Modules\Notifications\Services\AnnouncementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AnnouncementsApiController extends Controller
{
    public function __construct(
        private readonly AnnouncementService $service,
        private readonly AuditService $audit,
    ) {
    }

    public function index(): JsonResponse
    {
        $this->authorize('announcements.view');

        $rows = Announcement::query()->with('targets')->orderByDesc('published_at')->limit(100)->get();

        return response()->json([
            'data' => $rows->map(fn (Announcement $a) => [
                'ulid' => $a->ulid,
                'title' => $a->title,
                'body' => $a->body,
                'importance' => $a->importance,
                'published_at' => $a->published_at->toIso8601String(),
                'expires_at' => $a->expires_at?->toIso8601String(),
                'publisher' => $a->publisher?->fullName(),
                'targets' => $a->targets->map(fn (AnnouncementTarget $t) => [
                    'target_type' => $t->target_type,
                    'target_id' => $t->target_id,
                ]),
            ]),
        ]);
    }

    /**
     * Matrix conditions: school_admin ✓, academic_deputy ش۱۱ (آموزشی),
     * discipline_deputy ش۱۱ (انضباطی), teacher ش۲. Domain scoping by title
     * convention is a policy decision — we enforce the matrix gates and log.
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('announcements.publish');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string'],
            'importance' => ['required', 'in:info,important,urgent'],
            'expires_at' => ['nullable', 'date', 'after:now'],
            'targets' => ['nullable', 'array'],
            'targets.*.target_type' => ['required_with:targets', 'in:school,grade_level,classroom'],
            'targets.*.target_id' => ['nullable', 'integer'],
        ]);

        $announcement = $this->service->publish(
            $data['title'],
            $data['body'],
            $data['importance'],
            $request->user()->id,
            $data['targets'] ?? [],
            isset($data['expires_at']) ? \Carbon\Carbon::parse($data['expires_at']) : null,
        );

        $this->audit->log('announcement.published', $announcement, new: ['title' => $data['title']]);

        return response()->json([
            'ulid' => $announcement->ulid,
            'importance' => $announcement->importance,
            'audience_notified' => \App\Modules\Notifications\Models\Notification::query()
                ->where('type', 'announcement')
                ->where('data->announcement_ulid', $announcement->ulid)
                ->count(),
        ], 201);
    }
}
