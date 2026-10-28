<?php

namespace App\Http\Middleware;

use App\Modules\Identity\Models\UserRole;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\SchoolContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the active role assignment from the Sanctum token, verifies it is
 * still active (starts_on / ends_on are checked on EVERY request), and seeds
 * the request's SchoolContext + PermissionRegistrar.
 */
class SetAuthContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null) {
            return $next($request);
        }

        $token = $user->currentAccessToken();
        $roleAbility = collect($token?->abilities ?? [])->first(
            fn (string $ability) => str_starts_with($ability, 'role:'),
        );

        // A pending-role token (logged in, no role chosen yet) is a valid
        // guest session: authenticated but role-less. Context stays empty and
        // every scoped route answers with the default-deny errors.
        if ($roleAbility === null) {
            if (in_array('pending-role', $token?->abilities ?? [], true)) {
                $request->attributes->set('school_id', null);
                $request->attributes->set('user_role', null);

                return $next($request);
            }

            abort(403, 'No active role selected. Use auth.switch_role first.');
        }

        $userRole = UserRole::query()
            ->with('role')
            ->where('user_id', $user->id)
            ->active()
            ->find((int) substr($roleAbility, 5));

        // The assignment was ended, not started yet, or revoked: the context
        // is gone. 404 — it no longer exists for this user.
        if ($userRole === null) {
            abort(404, 'Active role is no longer available.');
        }

        app(PermissionRegistrar::class)->setActiveRole($userRole);
        app(SchoolContext::class)->set($userRole->school_id);

        $request->attributes->set('school_id', $userRole->school_id);
        $request->attributes->set('user_role', $userRole);

        // Platform admin is technical-only: school-scoped queries must be
        // explicit per operation; the scope never applies implicitly.
        if ($userRole->role->key === 'platform_admin') {
            app(SchoolContext::class)->override();
        }

        return $next($request);
    }
}
