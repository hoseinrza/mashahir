<?php

namespace Database\Seeders;

use App\Support\Rbac\RbacSync;
use Illuminate\Database\Seeder;

/**
 * Syncs the database RBAC tables from the single-source permission matrix.
 * The logic lives in RbacSync so `db:seed` and `rbac:sync` share one code path.
 */
class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        RbacSync::run();
    }
}
