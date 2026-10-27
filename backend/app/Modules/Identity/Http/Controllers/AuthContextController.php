<?php

namespace App\Modules\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\School\Models\School;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Bootstrap payload for the frontend after login/role switch: who am I,
 * which school am I working in, which role is active, what can it do.
 */
class AuthContextController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $registrar = app(PermissionRegistrar::class);
        $userRole = $registrar->activeRole();
        $school = School::query()->find(app(SchoolContext::class)->schoolId());

        return response()->json([
            'user' => [
                'ulid' => $user->ulid,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'phone' => $user->phone, // decrypted for the owner only
            ],
            'school' => $school ? ['ulid' => $school->ulid, 'name' => $school->name] : null,
            'active_role' => $userRole ? [
                'key' => $userRole->role->key,
                'title' => $userRole->role->title,
                'scope_type' => $userRole->scope_type,
            ] : null,
            'permissions' => $registrar->grants()
                ->map(fn ($condition, $key) => ['key' => $key, 'condition' => $condition])
                ->values(),
        ]);
    }
}
