<?php

namespace App\Modules\OnlineClasses\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Academic\Models\ClassroomSubject;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Models\User;
use App\Modules\OnlineClasses\Models\OnlineClass;
use App\Modules\OnlineClasses\Services\SkyroomManager;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * کلاس آنلاین بر بستر اسکای‌روم: معلم/مدیر اتاق را برای درس-کلاس می‌سازد،
 * همه ذی‌نفعانِ دارای مجوز با لینک مستقیم وارد می‌شوند (بدون لاگین اسکای‌روم).
 */
class OnlineClassesApiController extends Controller
{
    public function __construct(
        private readonly ScopeResolver $resolver,
        private readonly AuditService $audit,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorize('online_classes.view');

        $roleKey = app(PermissionRegistrar::class)->activeRole()?->role->key;
        $query = OnlineClass::query()->with(['classroomSubject.subject', 'classroomSubject.classroom']);

        if ($roleKey === 'teacher') {
            $ids = $this->resolver->classroomIds() ?? [];
            $query->whereHas('classroomSubject', fn ($q) => $q->whereIn('classroom_id', $ids ?: [0]));
        } elseif ($roleKey === 'student') {
            $selfIds = $this->resolver->studentIds() ?? [];
            $classroomIds = \App\Modules\Academic\Models\Enrollment::query()
                ->whereIn('student_id', $selfIds)->where('status', 'active')->pluck('classroom_id');
            $query->whereHas('classroomSubject', fn ($q) => $q->whereIn('classroom_id', $classroomIds ?: [0]));
        }

        return response()->json([
            'data' => $query->orderByDesc('id')->limit(100)->get()->map(fn (OnlineClass $c) => $this->payload($c)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('online_classes.create');

        $data = $request->validate([
            'classroom_subject_id' => ['required', 'integer'],
            'title' => ['required', 'string', 'max:200'],
        ]);

        $subject = ClassroomSubject::query()->findOrFail($data['classroom_subject_id']);
        $ids = $this->resolver->classroomIds();
        if ($ids !== null && ! in_array($subject->classroom_id, $ids, true)) {
            abort(404);
        }

        $class = OnlineClass::query()->create([
            'classroom_subject_id' => $subject->id,
            'title' => $data['title'],
            'created_by' => $request->user()->id,
        ]);

        // Provision the Skyroom room lazily but immediately; a provider error
        // surfaces to the caller — no class row without a real room.
        $roomId = SkyroomManager::createRoom(SkyroomManager::roomName($class->ulid), $data['title']);
        $class->forceFill([
            'skyroom_room_id' => $roomId,
            'skyroom_name' => SkyroomManager::roomName($class->ulid),
        ])->save();

        $this->audit->log('online_class.created', null, new: ['title' => $data['title']]);

        return response()->json($this->payload($class->fresh()), 201);
    }

    /**
     * لینک ورود مستقیم اسکای‌روم برای کاربر فعلی — نقش معلم = ارائه‌دهنده (۲)،
     * بقیه = کاربر عادی (۱). شناسه اسکای‌روم کاربر یک‌بار ساخته و کش می‌شود.
     */
    public function enter(Request $request, OnlineClass $class): JsonResponse
    {
        $this->authorize('online_classes.view');

        if ($class->status !== OnlineClass::STATUS_ACTIVE) {
            throw ValidationException::withMessages(['class' => 'این کلاس بسته شده است.']);
        }

        $roleKey = app(PermissionRegistrar::class)->activeRole()?->role->key;

        if ($roleKey === 'teacher') {
            $ids = $this->resolver->classroomIds() ?? [];
            if (! in_array($class->classroomSubject->classroom_id, $ids, true)) {
                abort(404);
            }
        }

        $user = $request->user();

        if ($user->skyroom_user_id === null) {
            $user->forceFill([
                'skyroom_user_id' => SkyroomManager::createUser('u' . $user->id, $user->fullName()),
            ])->save();
        }

        $access = in_array($roleKey, ['teacher', 'school_admin', 'academic_deputy'], true) ? 2 : 1;

        $url = SkyroomManager::createLoginUrl(
            (int) $class->skyroom_room_id,
            (string) $user->skyroom_user_id,
            $user->fullName(),
            $access,
        );

        return response()->json(['url' => $url]);
    }

    public function close(Request $request, OnlineClass $class): JsonResponse
    {
        $this->authorize('online_classes.manage');

        $class->forceFill(['status' => OnlineClass::STATUS_CLOSED])->save();
        $this->audit->log('online_class.closed', null, new: ['title' => $class->title]);

        return response()->json(['ulid' => $class->ulid, 'status' => $class->status]);
    }

    public function destroy(Request $request, OnlineClass $class): \Illuminate\Http\Response
    {
        $this->authorize('online_classes.manage');

        $this->audit->log('online_class.deleted', null, old: ['title' => $class->title]);

        try {
            SkyroomManager::deleteRoom((int) $class->skyroom_room_id);
        } catch (\Throwable $e) {
            // the local record still closes even if the provider is unreachable
        }

        $class->delete();

        return response()->noContent();
    }

    private function payload(OnlineClass $c): array
    {
        return [
            'ulid' => $c->ulid,
            'title' => $c->title,
            'subject' => $c->classroomSubject?->subject?->title,
            'classroom' => $c->classroomSubject?->classroom?->title,
            'status' => $c->status,
            'created_by' => $c->created_by,
        ];
    }
}
