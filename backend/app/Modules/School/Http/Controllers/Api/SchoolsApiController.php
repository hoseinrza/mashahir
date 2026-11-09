<?php

namespace App\Modules\School\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Models\Role;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\School\Models\School;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * دفتر مدارس پلتفرم: ساخت مدرسه، فهرست مدارس و تخصیص مدیر مدرسه.
 * فقط schools.manage (مدیر پلتفرم) به این کنترلر می‌رسد؛ کارکنان یک مدرسه
 * هیچ‌گاه مدارس دیگر را نمی‌بینند.
 */
class SchoolsApiController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(): JsonResponse
    {
        $this->authorize('schools.manage');

        $schools = School::query()->orderBy('name')->get();

        return response()->json([
            'data' => $schools->map(fn (School $school) => $this->payload($school)),
        ]);
    }

    /**
     * جست‌وجوی سراسری کاربران برای انتخاب مدیر مدرسه (فقط مدیر پلتفرم).
     * نام با like و شمارهٔ موبایل با phone_hash (رمزنگاری‌شده) تطبیق می‌یابد.
     */
    public function candidates(Request $request): JsonResponse
    {
        $this->authorize('schools.manage');

        $query = trim((string) $request->query('q', ''));

        if (mb_strlen($query) < 2) {
            return response()->json(['data' => []]);
        }

        $users = User::query()
            ->where(function ($builder) use ($query): void {
                $builder
                    ->where('first_name', 'like', "%{$query}%")
                    ->orWhere('last_name', 'like', "%{$query}%")
                    ->orWhere('phone_hash', \App\Support\PhoneHash::of($query));
            })
            ->orderBy('last_name')
            ->limit(10)
            ->get();

        return response()->json([
            'data' => $users->map(fn (User $user) => [
                'ulid' => $user->ulid,
                'name' => $user->fullName(),
            ]),
        ]);
    }

    public function show(School $school): JsonResponse
    {        $this->authorize('schools.manage');

        $principals = UserRole::query()
            ->where('school_id', $school->id)
            ->whereHas('role', fn ($query) => $query->where('key', 'school_admin'))
            ->active()
            ->with('user')
            ->get()
            ->map(fn (UserRole $assignment) => [
                'user_ulid' => $assignment->user?->ulid,
                'name' => $assignment->user?->fullName(),
                'user_role_id' => $assignment->id,
                'starts_on' => $assignment->starts_on?->toDateString(),
            ]);

        return response()->json([
            ...$this->payload($school),
            'principals' => $principals,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('schools.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'level' => ['required', Rule::in([School::LEVEL_ELEMENTARY, School::LEVEL_MIDDLE, School::LEVEL_HIGH])],
            'grading_type' => ['required', Rule::in(['numeric', 'descriptive'])],
            'student_has_account' => ['sometimes', 'boolean'],
            'timezone' => ['sometimes', 'string', 'max:64'],
        ]);

        $school = School::query()->create([
            'name' => $data['name'],
            'level' => $data['level'],
            'grading_type' => $data['grading_type'],
            'student_has_account' => $data['student_has_account'] ?? true,
            'timezone' => $data['timezone'] ?? 'Asia/Tehran',
            'is_active' => true,
        ]);

        $this->audit->log('school.created', $school, new: [
            'name' => $school->name,
            'level' => $school->level,
        ]);

        return response()->json($this->payload($school), 201);
    }

    public function update(Request $request, School $school): JsonResponse
    {
        $this->authorize('schools.manage');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:200'],
            'level' => ['sometimes', Rule::in([School::LEVEL_ELEMENTARY, School::LEVEL_MIDDLE, School::LEVEL_HIGH])],
            'grading_type' => ['sometimes', Rule::in(['numeric', 'descriptive'])],
            'student_has_account' => ['sometimes', 'boolean'],
            'timezone' => ['sometimes', 'string', 'max:64'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $old = $school->only(array_keys($data));
        $school->update($data);

        $this->audit->log('school.updated', $school, old: $old, new: $data);

        return response()->json($this->payload($school->fresh()));
    }

    /**
     * تخصیص مدیر: کاربر موجود به نقش school_admin در همین مدرسه ارتقا می‌یابد.
     * یک کاربر می‌تواند مدیر چند مدرسه باشد؛ تخصیص تکراری رد می‌شود.
     */
    public function assignPrincipal(Request $request, School $school): JsonResponse
    {
        $this->authorize('schools.manage');

        $data = $request->validate([
            'user_ulid' => ['required', 'string', 'size:26'],
        ]);

        $user = User::query()->where('ulid', $data['user_ulid'])->firstOrFail();

        $role = Role::query()->whereNull('school_id')->where('key', 'school_admin')->first();

        if ($role === null) {
            throw ValidationException::withMessages(['role' => 'نقش «مدیر مدرسه» در ماتریس مجوزها یافت نشد.']);
        }

        $exists = UserRole::query()
            ->where('user_id', $user->id)
            ->where('role_id', $role->id)
            ->where('school_id', $school->id)
            ->active()
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['user_ulid' => 'این کاربر از قبل مدیر همین مدرسه است.']);
        }

        $assignment = UserRole::query()->create([
            'user_id' => $user->id,
            'role_id' => $role->id,
            'school_id' => $school->id,
            'scope_type' => UserRole::SCOPE_SCHOOL,
            'scope_id' => null,
            'starts_on' => now()->toDateString(),
        ]);

        $this->audit->log('school.principal_assigned', $school, new: [
            'user_ulid' => $user->ulid,
            'user_role_id' => $assignment->id,
        ]);

        return response()->json([
            'school_ulid' => $school->ulid,
            'user_ulid' => $user->ulid,
            'user_role_id' => $assignment->id,
        ], 201);
    }

    private function payload(School $school): array
    {
        return [
            'ulid' => $school->ulid,
            'name' => $school->name,
            'level' => $school->level,
            'grading_type' => $school->grading_type,
            'student_has_account' => (bool) $school->student_has_account,
            'timezone' => $school->timezone,
            'is_active' => (bool) $school->is_active,
            'created_at' => $school->created_at?->toIso8601String(),
        ];
    }
}
