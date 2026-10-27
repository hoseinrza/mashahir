<?php

namespace App\Support\Rbac;

use App\Modules\Identity\Models\UserRole;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Resolves the effective grants of the ACTIVE role assignment, cached for the
 * duration of the request. Permission => condition code ('sh7') or null.
 *
 * Scope matching (which rows this role may touch) is the job of policies +
 * resolvers; the registrar only answers "does the active role hold X".
 */
final class PermissionRegistrar
{
    private ?UserRole $activeRole = null;

    /** @var Collection<string, string|null>|null */
    private ?Collection $grants = null;

    public function setActiveRole(UserRole $userRole): void
    {
        $this->activeRole = $userRole;
        $this->grants = null;
    }

    public function activeRole(): ?UserRole
    {
        return $this->activeRole;
    }

    /**
     * @return Collection<string, string|null> permission key => condition
     */
    public function grants(): Collection
    {
        if ($this->grants !== null) {
            return $this->grants;
        }

        if ($this->activeRole === null) {
            return $this->grants = collect();
        }

        $rows = DB::table('role_permissions')
            ->join('permissions', 'permissions.id', '=', 'role_permissions.permission_id')
            ->where('role_permissions.role_id', $this->activeRole->role_id)
            ->get(['permissions.key as key', 'role_permissions.condition as condition']);

        return $this->grants = $rows->pluck('condition', 'key');
    }

    public function allows(string $permissionKey): bool
    {
        return $this->grants()->has($permissionKey);
    }

    /**
     * Condition code attached to the grant, e.g. 'sh7' (reason + audit
     * mandatory) — the caller must honor it. NULL = unconditional.
     */
    public function conditionFor(string $permissionKey): ?string
    {
        return $this->grants()->get($permissionKey);
    }

    public function flush(): void
    {
        $this->grants = null;
    }
}
