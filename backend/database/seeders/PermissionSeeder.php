<?php

namespace Database\Seeders;

use App\Modules\Identity\Models\Permission;
use App\Modules\Identity\Models\Role;
use App\Support\Rbac\PermissionMatrix;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Syncs the database RBAC tables from the single-source permission matrix.
 * Custom (non-system) school roles are never touched.
 */
class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $matrix = PermissionMatrix::load();

        foreach (PermissionMatrix::roles() as $key => $role) {
            Role::updateOrCreate(
                ['key' => $key, 'school_id' => null],
                ['title' => $role['title'], 'is_system' => $role['is_system'] ?? true],
            );
        }

        foreach (PermissionMatrix::permissions() as $permission) {
            Permission::updateOrCreate(
                ['key' => $permission['key']],
                ['title' => $permission['title'], 'group' => $permission['group']],
            );
        }

        $permissionIds = Permission::query()->pluck('id', 'key');
        $systemRoleIds = Role::query()->whereNull('school_id')->whereIn('key', array_keys(PermissionMatrix::roles()))->pluck('id', 'key');

        $desired = [];

        foreach (PermissionMatrix::matrix() as $permissionKey => $grants) {
            foreach ($grants as $roleKey => $value) {
                $desired[] = [
                    'role_id' => $systemRoleIds[$roleKey],
                    'permission_id' => $permissionIds[$permissionKey],
                    'condition' => $this->conditionColumn($value),
                ];
            }
        }

        $systemRoleIdsList = $systemRoleIds->values()->all();

        // Pivot rows of system roles are fully owned by the matrix file.
        DB::table('role_permissions')->whereIn('role_id', $systemRoleIdsList)->delete();
        DB::table('role_permissions')->insert($desired);
    }

    private function conditionColumn(mixed $value): ?string
    {
        if (is_array($value)) {
            return implode(',', $value); // e.g. "sh3,sh6" — ALL must hold
        }

        return is_string($value) ? $value : null;
    }
}
