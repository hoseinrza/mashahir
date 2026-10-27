<?php

namespace App\Modules\People\Policies;

use App\Modules\Identity\Models\User;
use App\Modules\People\Models\GuardianLink;
use App\Support\Rbac\PermissionRegistrar;

class GuardianLinkPolicy
{
    public function __construct(private readonly PermissionRegistrar $registrar)
    {
    }

    public function viewAny(User $user): bool
    {
        return $this->registrar->allows('guardian_links.view');
    }

    /**
     * A guardian sees his own link rows only (sh4); everyone else needs the
     * manage-level view of the whole school.
     */
    public function view(User $user, GuardianLink $link): bool
    {
        if (! $this->registrar->allows('guardian_links.view')) {
            return false;
        }

        if ($this->registrar->activeRole()?->role->key === 'guardian') {
            return $link->guardian_user_id === $user->id;
        }

        return true;
    }

    public function request(User $user): bool
    {
        return $this->registrar->allows('guardian_links.request');
    }

    public function manage(User $user): bool
    {
        return $this->registrar->allows('guardian_links.manage');
    }
}
