<?php

namespace Tests\Feature\Rbac;

use App\Modules\Identity\Models\Permission;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\School\Models\School;
use App\Support\Rbac\PermissionMatrix;
use App\Support\Rbac\PermissionRegistrar;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

/**
 * The acceptance gate: every (role, permission) pair in the matrix gets one
 * ALLOWED assertion, every absence gets one DENIED assertion — both generated
 * from the same single-source file the seeder reads.
 */
class MatrixCoverageTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_matrix_grant_allows_and_every_absence_denies(): void
    {
        $this->seed(PermissionSeeder::class);

        $school = School::query()->create([
            'name' => 'دبیرستان مشاهیر', 'level' => 'high', 'grading_type' => 'numeric',
            'student_has_account' => true, 'timezone' => 'Asia/Tehran', 'is_active' => true,
        ]);

        $registrar = app(PermissionRegistrar::class);
        $assignments = [];

        foreach (PermissionMatrix::roles() as $roleKey => $role) {
            $user = User::factory()->create();
            $roleId = DB::table('roles')->whereNull('school_id')->where('key', $roleKey)->value('id');

            $assignments[$roleKey] = [
                'user' => $user,
                'assignment' => UserRole::query()->create([
                    'user_id' => $user->id,
                    'role_id' => $roleId,
                    'school_id' => $school->id,
                    'scope_type' => 'school',
                    'scope_id' => null,
                ]),
            ];
        }

        $checked = 0;

        // Role-outer loop keeps the registrar cache effective per role.
        foreach ($assignments as $roleKey => $fixture) {
            $registrar->setActiveRole($fixture['assignment']);

            foreach (PermissionMatrix::matrix() as $permissionKey => $grants) {
                $expected = array_key_exists($roleKey, $grants);
                $actual = Gate::forUser($fixture['user'])->allows($permissionKey);

                $this->assertSame(
                    $expected,
                    $actual,
                    "Matrix mismatch: {$permissionKey} for role {$roleKey} should be "
                    .($expected ? 'ALLOWED' : 'DENIED').'.',
                );
                $checked++;
            }
        }

        $this->assertSame(
            count(PermissionMatrix::roles()) * count(PermissionMatrix::matrix()),
            $checked,
        );
    }

    public function test_permission_granted_to_nobody_is_open_to_nobody(): void
    {
        $this->seed(PermissionSeeder::class);

        $school = School::query()->create([
            'name' => 'دبیرستان مشاهیر', 'level' => 'high', 'grading_type' => 'numeric',
            'student_has_account' => true, 'timezone' => 'Asia/Tehran', 'is_active' => true,
        ]);

        $registrar = app(PermissionRegistrar::class);

        foreach (PermissionMatrix::roles() as $roleKey => $role) {
            $user = User::factory()->create();
            $roleId = DB::table('roles')->whereNull('school_id')->where('key', $roleKey)->value('id');

            $registrar->setActiveRole(UserRole::query()->create([
                'user_id' => $user->id,
                'role_id' => $roleId,
                'school_id' => $school->id,
                'scope_type' => 'school',
                'scope_id' => null,
            ]));

            // A brand-new permission no role has ever received.
            $future = Permission::query()->create([
                'key' => "future.{$roleKey}", 'title' => 'مجوز آینده', 'group' => 'system',
            ]);

            $this->assertFalse(
                $registrar->allows($future->key),
                "Un-granted permission {$future->key} leaked to {$roleKey}.",
            );
            $this->assertFalse(
                Gate::forUser($user)->allows($future->key),
                "Gate opened for un-granted permission {$future->key} to {$roleKey}.",
            );
        }
    }
}
