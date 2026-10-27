<?php

namespace App\Modules\Audit\Policies;

use App\Modules\Identity\Models\User;
use App\Support\Rbac\PermissionRegistrar;

class AuditLogPolicy
{
    public function __construct(private readonly PermissionRegistrar $registrar)
    {
    }

    public function viewAny(User $user): bool
    {
        return $this->registrar->allows('audit.view');
    }
}
