<?php

namespace App\Modules\People\Policies;

use App\Modules\Identity\Models\User;
use App\Modules\People\Models\Student;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\Rbac\ScopeResolver;

class StudentPolicy
{
    public function __construct(
        private readonly PermissionRegistrar $registrar,
        private readonly ScopeResolver $resolver,
    ) {
    }

    public function viewAny(User $user): bool
    {
        return $this->registrar->allows('students.view');
    }

    public function view(User $user, Student $student): bool
    {
        if (! $this->registrar->allows('students.view')) {
            return false;
        }

        $ids = $this->resolver->studentIds();

        // null = school-wide role; sh8 (support) is field-limited in the resource.
        return $ids === null || in_array($student->id, $ids, true);
    }

    public function create(User $user): bool
    {
        return $this->registrar->allows('students.manage');
    }

    public function update(User $user, Student $student): bool
    {
        return $this->registrar->allows('students.manage');
    }

    /**
     * sh7: national code reveal requires the dedicated permission AND a
     * logged reason; the controller enforces the reason + audit write.
     */
    public function viewNationalCode(User $user, Student $student): bool
    {
        return $this->registrar->allows('students.view_national_code');
    }
}
