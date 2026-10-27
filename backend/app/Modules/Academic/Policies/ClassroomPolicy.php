<?php

namespace App\Modules\Academic\Policies;

use App\Modules\Academic\Models\Classroom;
use App\Modules\Identity\Models\User;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\Rbac\ScopeResolver;

class ClassroomPolicy
{
    public function __construct(
        private readonly PermissionRegistrar $registrar,
        private readonly ScopeResolver $resolver,
    ) {
    }

    public function viewAny(User $user): bool
    {
        return $this->registrar->allows('academic.view');
    }

    public function view(User $user, Classroom $classroom): bool
    {
        if (! $this->registrar->allows('academic.view')) {
            return false;
        }

        $ids = $this->resolver->classroomIds();

        return $ids === null || in_array($classroom->id, $ids, true);
    }

    public function create(User $user): bool
    {
        return $this->registrar->allows('academic.manage');
    }

    public function assignSubject(User $user): bool
    {
        return $this->registrar->allows('academic.manage');
    }
}
