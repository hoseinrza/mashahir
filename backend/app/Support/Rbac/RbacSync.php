<?php

namespace App\Support\Rbac;

use App\Modules\Identity\Models\Permission;
use App\Modules\Identity\Models\Role;
use Illuminate\Support\Facades\DB;

/**
 * Rebuilds the database RBAC tables from the single-source permission matrix.
 * Runs whenever the matrix file has moved ahead of the database — after a pull,
 * a new module, or a review change — so code and data never drift apart.
 * Custom (non-system) school roles are never touched.
 */
final class RbacSync
{
    /** @return array{roles: int, permissions: int, grants: int} */
    public static function run(): array
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
                    'condition' => self::conditionColumn($value),
                ];
            }
        }

        $systemRoleIdsList = $systemRoleIds->values()->all();

        // Pivot rows of system roles are fully owned by the matrix file.
        DB::table('role_permissions')->whereIn('role_id', $systemRoleIdsList)->delete();
        DB::table('role_permissions')->insert($desired);

        return [
            'roles' => count(PermissionMatrix::roles()),
            'permissions' => $permissionIds->count(),
            'grants' => count($desired),
        ];
    }

    private static function conditionColumn(mixed $value): ?string
    {
        if (is_array($value)) {
            return implode(',', $value); // e.g. "sh3,sh6" — ALL must hold
        }

        return is_string($value) ? $value : null;
    }
}
