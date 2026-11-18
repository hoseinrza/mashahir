<?php

namespace App\Modules\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Models\UserRole;
use App\Modules\School\Models\School;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Bootstrap payload for the frontend after login/role switch: who am I,
 * which school am I working in, which role is active, what can it do —
 * plus EVERY active assignment across schools so a multi-school teacher
 * can jump between them (header switcher).
 */
class AuthContextController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $registrar = app(PermissionRegistrar::class);
        $userRole = $registrar->activeRole();
        $school = School::query()->find(app(SchoolContext::class)->schoolId());

        $assignments = $user->userRoles()->active()
            ->with(['role', 'school'])
            ->get()
            ->map(fn (UserRole $assignment) => [
                'id' => $assignment->id,
                'role_key' => $assignment->role->key,
                'role_title' => $assignment->role->title,
                'scope_type' => $assignment->scope_type,
                'school_ulid' => $assignment->school?->ulid,
                'school_name' => $assignment->school?->name,
            ])
            ->values();

        return response()->json([
            'user' => [
                'ulid' => $user->ulid,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'phone' => $user->phone, // decrypted for the owner only
                'has_password' => $user->password !== null,
            ],
            'school' => $school ? ['ulid' => $school->ulid, 'name' => $school->name] : null,
            'active_role' => $userRole ? [
                'id' => $userRole->id,
                'key' => $userRole->role->key,
                'title' => $userRole->role->title,
                'scope_type' => $userRole->scope_type,
            ] : null,
            'assignments' => $assignments,
            'permissions' => $registrar->grants()
                ->map(fn ($condition, $key) => ['key' => $key, 'condition' => $condition])
                ->values(),
        ]);
    }
}
