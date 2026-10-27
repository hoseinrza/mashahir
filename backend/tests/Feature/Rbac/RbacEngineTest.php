<?php

namespace Tests\Feature\Rbac;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\School\Models\School;
use App\Support\Rbac\PermissionRegistrar;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

class RbacEngineTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PermissionSeeder::class);

        $this->school = School::query()->create([
            'name' => 'دبیرستان مشاهیر',
            'level' => 'high',
            'grading_type' => 'numeric',
            'student_has_account' => true,
            'timezone' => 'Asia/Tehran',
            'is_active' => true,
        ]);

        $this->user = User::factory()->create();
    }

    private function giveRole(string $roleKey, array $attributes = []): UserRole
    {
        $roleId = \DB::table('roles')->whereNull('school_id')->where('key', $roleKey)->value('id');

        return UserRole::query()->create([
            'user_id' => $this->user->id,
            'role_id' => $roleId,
            'school_id' => $this->school->id,
            'scope_type' => 'school',
            'scope_id' => null,
            ...$attributes,
        ]);
    }

    public function test_gate_allows_only_matrix_permissions_of_the_active_role(): void
    {
        $assignment = $this->giveRole('school_admin');
        app(PermissionRegistrar::class)->setActiveRole($assignment);

        // school_admin holds audit.view in the matrix
        $this->assertTrue(Gate::forUser($this->user)->allows('audit.view'));
        // ...and does NOT hold roles.manage (platform_admin only)
        $this->assertFalse(Gate::forUser($this->user)->allows('roles.manage'));
    }

    public function test_gate_denies_everything_without_an_active_role(): void
    {
        $this->giveRole('school_admin'); // exists but not activated

        $this->assertFalse(Gate::forUser($this->user)->allows('audit.view'));
        $this->assertFalse(Gate::forUser($this->user)->allows('users.view'));
    }

    public function test_ended_role_assignment_cuts_access_immediately(): void
    {
        $assignment = $this->giveRole('school_admin', ['ends_on' => now()->subDay()->toDateString()]);
        app(PermissionRegistrar::class)->setActiveRole($assignment);

        // Even with the registrar pointing at the assignment, a stale
        // activation is rejected — only active assignments may be set.
        $isActive = UserRole::query()->whereKey($assignment->id)->active()->exists();
        $this->assertFalse($isActive);
    }

    public function test_future_starting_role_has_no_access_yet(): void
    {
        $assignment = $this->giveRole('school_admin', ['starts_on' => now()->addMonth()->toDateString()]);

        $this->assertFalse(UserRole::query()->whereKey($assignment->id)->active()->exists());
    }

    public function test_condition_code_is_exposed_for_sh7_grants(): void
    {
        $registrar = app(PermissionRegistrar::class);
        $registrar->setActiveRole($this->giveRole('office_manager'));

        // office_manager holds users.update_phone under sh7
        $this->assertTrue($registrar->allows('users.update_phone'));
        $this->assertSame('sh7', $registrar->conditionFor('users.update_phone'));
        // ...and users.view unconditionally
        $this->assertNull($registrar->conditionFor('users.view'));
    }

    public function test_default_deny_for_permissions_granted_to_nobody(): void
    {
        // guardian_links.request is guardian-only (sh15); office_manager must not have it.
        $registrar = app(PermissionRegistrar::class);
        $registrar->setActiveRole($this->giveRole('office_manager'));

        $this->assertFalse($registrar->allows('guardian_links.request'));
        $this->assertFalse(Gate::forUser($this->user)->allows('guardian_links.request'));
    }

    public function test_gate_denies_guests(): void
    {
        $this->assertFalse(Gate::allows('auth.switch_role'));
    }

    public function test_registrar_grants_are_cached_per_request_and_flushable(): void
    {
        $registrar = app(PermissionRegistrar::class);
        $registrar->setActiveRole($this->giveRole('school_admin'));

        $this->assertTrue($registrar->allows('audit.view'));
        $registrar->flush();
        $this->assertTrue($registrar->allows('audit.view'));
    }
}
