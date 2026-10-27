<?php

namespace App\Modules\People\Policies;

use App\Modules\Identity\Models\User;
use App\Support\Rbac\PermissionRegistrar;

class CourtOrderPolicy
{
    public function __construct(private readonly PermissionRegistrar $registrar)
    {
    }

    public function viewAny(User $user): bool
    {
        return $this->registrar->allows('court_orders.view');
    }

    public function create(User $user): bool
    {
        return $this->registrar->allows('court_orders.manage');
    }
}
