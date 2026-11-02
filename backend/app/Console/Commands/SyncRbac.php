<?php

namespace App\Console\Commands;

use App\Support\Rbac\RbacSync;
use Illuminate\Console\Command;

class SyncRbac extends Command
{
    protected $signature = 'rbac:sync';

    protected $description = 'Re-sync roles, permissions and system-role grants from the permission matrix (idempotent; custom school roles untouched)';

    public function handle(): int
    {
        $counts = RbacSync::run();

        $this->info('RBAC همگام شد — نقش‌ها: '.$counts['roles'].'، مجوزها: '.$counts['permissions'].'، انتساب‌ها: '.$counts['grants']);

        return self::SUCCESS;
    }
}
