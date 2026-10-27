<?php

namespace App\Modules\Academic\Policies;

use App\Modules\Academic\Models\Enrollment;
use App\Modules\Identity\Models\User;
use App\Support\Rbac\PermissionRegistrar;

class EnrollmentPolicy
{
    public function __construct(private readonly PermissionRegistrar $registrar)
    {
    }

    public function create(User $user): bool
    {
        return $this->registrar->allows('enrollments.manage');
    }

    public function end(User $user, Enrollment $enrollment): bool
    {
        return $this->registrar->allows('enrollments.manage');
    }
}
