<?php

namespace App\Providers;

use App\Modules\Identity\Models\User;
use App\Support\Rbac\PermissionMatrix;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\SchoolContext;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(SchoolContext::class);
        $this->app->singleton(PermissionRegistrar::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // One Gate per matrix permission. Everything not granted to the
        // active role is denied by default — no definition, no access.
        foreach (PermissionMatrix::matrix() as $permissionKey => $grants) {
            Gate::define($permissionKey, fn (?User $user) => $user !== null
                && app(PermissionRegistrar::class)->allows($permissionKey));
        }

        // Module models live outside App\Models, so policies are registered
        // explicitly.
        Gate::policy(\App\Modules\Identity\Models\User::class, \App\Modules\Identity\Policies\UserPolicy::class);
        Gate::policy(\App\Modules\People\Models\Student::class, \App\Modules\People\Policies\StudentPolicy::class);
        Gate::policy(\App\Modules\Academic\Models\Classroom::class, \App\Modules\Academic\Policies\ClassroomPolicy::class);
        Gate::policy(\App\Modules\Academic\Models\Enrollment::class, \App\Modules\Academic\Policies\EnrollmentPolicy::class);
        Gate::policy(\App\Modules\People\Models\GuardianLink::class, \App\Modules\People\Policies\GuardianLinkPolicy::class);
        Gate::policy(\App\Modules\People\Models\CourtOrder::class, \App\Modules\People\Policies\CourtOrderPolicy::class);
        Gate::policy(\App\Modules\People\Models\PickupAuthorization::class, \App\Modules\People\Policies\PickupPolicy::class);
        Gate::policy(\App\Modules\Audit\Models\AuditLog::class, \App\Modules\Audit\Policies\AuditLogPolicy::class);
    }
}
