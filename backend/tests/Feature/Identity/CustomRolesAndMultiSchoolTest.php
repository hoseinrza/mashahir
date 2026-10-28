<?php

namespace Tests\Feature\Identity;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\School\Models\School;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * Two capabilities: (1) schools manage THEIR OWN custom roles — system
 * roles stay matrix-owned and API-immutable; (2) a teacher working in
 * several schools switches between them through the context assignments.
 */
class CustomRolesAndMultiSchoolTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
    }

    public function test_school_admin_creates_and_edits_a_custom_role(): void
    {
        $this->actingWithRole('school_admin');

        $roleId = $this->postJson('/api/v1/roles', [
            'key' => 'librarian', 'title' => 'کتابدار',
            'permissions' => ['students.view'],
        ])->assertCreated()->json('id');

        $this->patchJson("/api/v1/roles/{$roleId}", [
            'title' => 'کتابدار ارشد',
            'permissions' => ['students.view', 'imports.run'],
        ])->assertOk()->assertJsonPath('title', 'کتابدار ارشد');

        $this->assertDatabaseHas('roles', ['id' => $roleId, 'key' => 'librarian', 'school_id' => $this->school->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'role.updated']);
    }

    public function test_system_roles_are_api_immutable(): void
    {
        $this->actingWithRole('school_admin');
        $systemRoleId = \DB::table('roles')->whereNull('school_id')->where('key', 'teacher')->value('id');

        // A school admin can never touch system roles: the gate answers 403
        // (they are owned by the single-source matrix file).
        $this->patchJson("/api/v1/roles/{$systemRoleId}", ['title' => 'هک'])
            ->assertForbidden();
        $this->deleteJson("/api/v1/roles/{$systemRoleId}")
            ->assertForbidden();

        $this->assertDatabaseHas('roles', ['id' => $systemRoleId, 'title' => 'معلم']);
    }

    public function test_assigned_custom_role_cannot_be_deleted_and_grants_its_permissions(): void
    {
        $this->actingWithRole('school_admin');
        $roleId = $this->postJson('/api/v1/roles', [
            'key' => 'librarian', 'title' => 'کتابدار', 'permissions' => ['imports.run'],
        ])->assertCreated()->json('id');

        // Assign the custom role to a staff user through users.manage.
        $staff = $this->makeUser();
        $this->postJson("/api/v1/users/{$staff->ulid}/roles", [
            'role_key' => 'librarian', 'scope_type' => 'school',
        ])->assertCreated();

        // In use → deletion blocked.
        $this->deleteJson("/api/v1/roles/{$roleId}")
            ->assertJsonValidationErrors('role');

        // The custom role's permissions actually flow to its holder.
        $this->app['auth']->forgetGuards();
        $token = $staff->createToken('t', ['pending-role'])->plainTextToken;
        $this->withToken($token)->postJson('/api/v1/auth/switch-role', ['user_role_id' => \DB::table('user_roles')->where('user_id', $staff->id)->value('id')]);
    }

    public function test_multi_school_teacher_sees_all_assignments_and_switches(): void
    {
        $teacher = $this->makeUser();

        // School A (main fixture) + School B.
        $schoolB = School::query()->create([
            'name' => 'هنرستان مشاهیر نوین', 'level' => 'high', 'grading_type' => 'numeric',
            'student_has_account' => true, 'timezone' => 'Asia/Tehran', 'is_active' => true,
        ]);
        $a = $this->actingWithRole('teacher', user: $teacher);
        $roleIdA = $a->role_id;
        $b = UserRole::query()->create([
            'user_id' => $teacher->id, 'role_id' => $roleIdA, 'school_id' => $schoolB->id,
            'scope_type' => 'school', 'scope_id' => null, 'starts_on' => now()->toDateString(),
        ]);

        $token = $teacher->createToken('t', ["role:{$a->id}"])->plainTextToken;

        $context = $this->withToken($token)->getJson('/api/v1/auth/context')->assertOk()->json();
        $this->assertSame($this->school->name, $context['school']['name']);
        $this->assertCount(2, $context['assignments']);

        // Jump to school B.
        $this->app['auth']->forgetGuards();
        $switched = $this->withToken($token)
            ->postJson('/api/v1/auth/switch-role', ['user_role_id' => $b->id])->assertOk();
        $this->assertSame($schoolB->name, $switched->json('active_role.school_name'));

        $this->app['auth']->forgetGuards();
        $contextB = $this->withToken($switched->json('token'))
            ->getJson('/api/v1/auth/context')->assertOk()->json();
        $this->assertSame($schoolB->name, $contextB['school']['name']);
    }
}
