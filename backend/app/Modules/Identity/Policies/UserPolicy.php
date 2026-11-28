<?php

namespace App\Modules\Identity\Policies;

use App\Modules\Identity\Models\User;
use App\Support\Rbac\PermissionRegistrar;

class UserPolicy
{
    /** sh1: office staff may never create or edit managerial roles. */
    public const MANAGERIAL_ROLES = ['school_admin', 'academic_deputy', 'discipline_deputy'];

    public function __construct(private readonly PermissionRegistrar $registrar)
    {
    }

    public function viewAny(User $user): bool
    {
        return $this->registrar->allows('users.view');
    }

    public function view(User $user): bool
    {
        return $this->registrar->allows('users.view');
    }

    public function create(User $user): bool
    {
        return $this->registrar->allows('users.manage');
    }

    public function update(User $user): bool
    {
        return $this->registrar->allows('users.manage');
    }

    /**
     * sh1: the office manager cannot assign managerial roles.
     */
    public function assignRole(User $user, string $targetRoleKey): bool
    {
        if (! $this->registrar->allows('users.manage')) {
            return false;
        }

        // The student role is minted only by the student-record flow with a
        // student scope — the personnel role form can never hand it out.
        if ($targetRoleKey === 'student') {
            return false;
        }

        // The guardian role is minted only next to the student it belongs to
        // (the student modal adds the parent and links it in one step), so a
        // parent account is never a bare role assignment.
        if ($targetRoleKey === 'guardian') {
            return false;
        }

        // The platform role is minted only from the platform context: a
        // school-scoped role can never create or hand out a platform admin.
        if ($targetRoleKey === 'platform_admin'
            && $this->registrar->activeRole()?->role?->key !== 'platform_admin') {
            return false;
        }

        if ($this->registrar->conditionFor('users.manage') === 'sh1'
            && in_array($targetRoleKey, self::MANAGERIAL_ROLES, true)) {
            return false;
        }

        return true;
    }

    public function endRole(User $user): bool
    {
        return $this->registrar->allows('users.manage');
    }

    /**
     * Deleting a user is a managerial action: the office manager (sh1) never
     * deletes; the school admin and the platform admin do.
     */
    public function destroy(User $user): bool
    {
        return $this->registrar->allows('users.manage')
            && $this->registrar->conditionFor('users.manage') !== 'sh1';
    }

    /**
     * sh7 (school_admin, office_manager) / sh10 (support): phone changes are
     * reason-logged. The condition code is surfaced to the controller.
     */
    public function updatePhone(User $user): bool
    {
        return $this->registrar->allows('users.update_phone');
    }

    /**
     * Same sh7/sh10 conditions as updatePhone — setting or replacing a
     * login password is equally sensitive and reason-logged in the controller.
     */
    public function setPassword(User $user): bool
    {
        return $this->registrar->allows('users.set_password');
    }
}
