<?php

namespace App\Modules\Identity\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Models\Role;
use App\Support\Rbac\PermissionRegistrar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Custom role management. System roles are owned by the single-source
 * matrix (seeder-synced, API-immutable); schools manage THEIR OWN custom
 * roles, the platform admin manages everything.
 */
class RolesApiController extends Controller
{
    public function __construct(
        private readonly PermissionRegistrar $registrar,
        private readonly AuditService $audit,
    ) {
    }

    /**
     * Platform-wide manage = roles.manage; a school_admin manages only the
     * custom roles of his own school.
     */
    private function assertCanManage(?Role $role = null): bool
    {
        $isPlatform = $this->registrar->allows('roles.manage');

        $isSchoolAdmin = $this->registrar->activeRole()?->role->key === 'school_admin'
            && $this->registrar->allows('schools.settings');

        if ($role !== null) {
            // System roles: platform only. Custom roles: own school or platform.
            if ($role->is_system || $role->school_id === null) {
                return $isPlatform;
            }

            return $isPlatform || (int) $role->school_id === (int) app(\App\Support\SchoolContext::class)->schoolId();
        }

        return $isPlatform || $isSchoolAdmin;
    }

    public function index(): JsonResponse
    {
        if (! $this->assertCanManage()) {
            abort(403);
        }

        $isPlatform = $this->registrar->allows('roles.manage');

        $roles = Role::query()
            ->with('permissions')
            ->whereNull('school_id')
            ->when(! $isPlatform, fn ($q) => $q->orWhere('school_id', app(\App\Support\SchoolContext::class)->schoolId()))
            ->orderBy('school_id')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $roles->map(fn (Role $role) => $this->payload($role)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->assertCanManage()) {
            abort(403);
        }

        $data = $request->validate([
            'key' => ['required', 'string', 'regex:/^[a-z0-9_]+$/', 'max:50'],
            'title' => ['required', 'string', 'max:100'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string'],
        ]);

        $schoolId = $this->registrar->allows('roles.manage')
            ? ($data['school_id'] ?? app(\App\Support\SchoolContext::class)->schoolId())
            : app(\App\Support\SchoolContext::class)->schoolId();

        if (Role::query()->where('school_id', $schoolId)->where('key', $data['key'])->exists()) {
            throw ValidationException::withMessages(['key' => 'نقشی با این کلید در این مدرسه هست.']);
        }

        $role = Role::query()->create([
            'school_id' => $schoolId,
            'key' => $data['key'],
            'title' => $data['title'],
            'is_system' => false,
        ]);

        $this->syncPermissions($role, $data['permissions'] ?? []);
        $this->audit->log('role.created', $role, new: ['key' => $role->key, 'title' => $role->title]);

        return response()->json($this->payload($role->fresh('permissions')), 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        if (! $this->assertCanManage($role)) {
            abort(403, 'نقش‌های سیستمی فقط از فایل ماتریس تغییر می‌کنند.');
        }

        if ($role->is_system) {
            throw ValidationException::withMessages(['role' => 'نقش‌های سیستمی از طریق فایل ماتریس مدیریت می‌شوند، نه API.']);
        }

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:100'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string'],
        ]);

        if (isset($data['title'])) {
            $role->update(['title' => $data['title']]);
        }

        if (array_key_exists('permissions', $data)) {
            $this->syncPermissions($role, $data['permissions']);
        }

        $this->audit->log('role.updated', $role, new: $data);

        return response()->json($this->payload($role->fresh('permissions')));
    }

    public function destroy(Role $role): JsonResponse
    {
        if (! $this->assertCanManage($role)) {
            abort(403);
        }

        if ($role->is_system) {
            throw ValidationException::withMessages(['role' => 'نقش‌های سیستمی حذف نمی‌شوند.']);
        }

        $inUse = \DB::table('user_roles')->where('role_id', $role->id)->count();
        if ($inUse > 0) {
            throw ValidationException::withMessages(['role' => "این نقش به {$inUse} کاربر تخصیص یافته؛ اول تخصیص‌ها را پایان دهید."]);
        }

        $this->audit->log('role.deleted', $role, old: ['key' => $role->key, 'title' => $role->title]);
        $role->delete();

        return response()->noContent();
    }

    private function syncPermissions(Role $role, array $permissionKeys): void
    {
        $ids = \DB::table('permissions')->whereIn('key', $permissionKeys)->pluck('id');
        $role->permissions()->sync($ids);
    }

    private function payload(Role $role): array
    {
        return [
            'id' => $role->id,
            'key' => $role->key,
            'title' => $role->title,
            'school_id' => $role->school_id,
            'is_system' => $role->is_system,
            'permissions' => $role->permissions->map(fn ($p) => [
                'key' => $p->key, 'title' => $p->title,
            ]),
        ];
    }
}
