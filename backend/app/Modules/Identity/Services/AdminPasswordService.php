<?php

namespace App\Modules\Identity\Services;

use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Models\User;

/**
 * A manager sets or replaces somebody else's login password. The reason is
 * mandatory (sh7/sh10) and the audit trail stores masked values only — the
 * password itself never reaches a log.
 */
final class AdminPasswordService
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function set(User $user, string $password, string $reason): User
    {
        $user->forceFill(['password' => $password])->save();

        $this->audit->log(
            'user.password_changed',
            $user,
            old: ['password' => '***masked***'],
            new: ['password' => '***masked***'],
            reason: $reason,
        );

        return $user->fresh();
    }
}
