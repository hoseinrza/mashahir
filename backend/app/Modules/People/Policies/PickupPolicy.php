<?php

namespace App\Modules\People\Policies;

use App\Modules\Identity\Models\User;
use App\Modules\People\Models\PickupAuthorization;
use App\Modules\People\Services\GuardianAccessService;
use App\Support\Rbac\PermissionRegistrar;

class PickupPolicy
{
    public function __construct(
        private readonly PermissionRegistrar $registrar,
        private readonly GuardianAccessService $access,
    ) {
    }

    /**
     * pickup.view is school-wide for staff; a guardian only passes with an
     * effective can_pickup flag (sh3, court-order aware).
     */
    public function viewForStudent(User $user, int $studentId): bool
    {
        if (! $this->registrar->allows('pickup.view')) {
            return false;
        }

        if ($this->registrar->activeRole()?->role->key === 'guardian') {
            return $this->access->may($user->id, $studentId, 'can_pickup');
        }

        return true;
    }

    public function create(User $user): bool
    {
        return $this->registrar->allows('pickup.manage');
    }

    public function update(User $user, PickupAuthorization $authorization): bool
    {
        return $this->registrar->allows('pickup.manage') && ! $authorization->locked;
    }
}
