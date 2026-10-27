<?php

namespace Tests\Feature;

use App\Modules\Identity\Models\Permission;
use App\Modules\Identity\Models\Role;
use App\Support\Rbac\PermissionMatrix;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PermissionSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_exactly_the_matrix_roles_and_permissions(): void
    {
        $this->seed(PermissionSeeder::class);

        $this->assertSame(count(PermissionMatrix::roles()), Role::query()->whereNull('school_id')->count());
        $this->assertSame(count(PermissionMatrix::permissions()), Permission::query()->count());
    }

    public function test_seeded_grants_match_the_matrix_exactly(): void
    {
        $this->seed(PermissionSeeder::class);

        $roleIds = Role::query()->whereNull('school_id')->pluck('id', 'key');
        $permissionIds = Permission::query()->pluck('id', 'key');

        foreach (PermissionMatrix::matrix() as $permissionKey => $grants) {
            foreach ($grants as $roleKey => $value) {
                $condition = is_array($value) ? implode(',', $value) : (is_string($value) ? $value : null);

                $this->assertDatabaseHas('role_permissions', [
                    'role_id' => $roleIds[$roleKey],
                    'permission_id' => $permissionIds[$permissionKey],
                    'condition' => $condition,
                ]);
            }
        }
    }

    public function test_system_roles_have_no_grant_beyond_the_matrix(): void
    {
        $this->seed(PermissionSeeder::class);

        $roleIds = Role::query()->whereNull('school_id')->pluck('id', 'key');
        $permissionIds = Permission::query()->pluck('id', 'key');

        foreach (PermissionMatrix::matrix() as $permissionKey => $grants) {
            foreach ($roleIds as $roleKey => $roleId) {
                if (isset($grants[$roleKey])) {
                    continue;
                }

                $exists = DB::table('role_permissions')
                    ->where('role_id', $roleId)
                    ->where('permission_id', $permissionIds[$permissionKey])
                    ->exists();

                $this->assertFalse(
                    $exists,
                    "Role [{$roleKey}] holds an un-granted permission [{$permissionKey}].",
                );
            }
        }
    }

    public function test_seeder_is_idempotent(): void
    {
        $this->seed(PermissionSeeder::class);
        $first = DB::table('role_permissions')->count();
        $rolesFirst = DB::table('roles')->count();

        $this->seed(PermissionSeeder::class);

        $this->assertSame($first, DB::table('role_permissions')->count());
        $this->assertSame($rolesFirst, DB::table('roles')->count());
    }

    public function test_custom_school_roles_survive_reseeding(): void
    {
        $this->seed(PermissionSeeder::class);

        $schoolId = DB::table('schools')->insertGetId([
            'ulid' => '01JCUSTOMSCHOOL00000000000',
            'name' => 'مدرسه آزمایشی',
            'level' => 'high',
            'grading_type' => 'numeric',
            'student_has_account' => true,
            'timezone' => 'Asia/Tehran',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $custom = Role::query()->create([
            'school_id' => $schoolId,
            'key' => 'librarian',
            'title' => 'کتابدار',
            'is_system' => false,
        ]);
        $somePermission = Permission::query()->first();
        DB::table('role_permissions')->insert([
            'role_id' => $custom->id,
            'permission_id' => $somePermission->id,
            'condition' => null,
        ]);

        $this->seed(PermissionSeeder::class);

        $this->assertDatabaseHas('roles', ['id' => $custom->id, 'key' => 'librarian']);
        $this->assertDatabaseHas('role_permissions', ['role_id' => $custom->id]);
    }
}
