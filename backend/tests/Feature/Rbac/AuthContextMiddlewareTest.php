<?php

namespace Tests\Feature\Rbac;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\School\Models\School;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\SchoolContext;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthContextMiddlewareTest extends TestCase
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

    private function assignment(string $roleKey, array $attributes = []): UserRole
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

    private function tokenFor(UserRole $assignment): string
    {
        return $this->user->createToken('test', ["role:{$assignment->id}"])->plainTextToken;
    }

    public function test_context_route_returns_active_school_role_and_grants(): void
    {
        $assignment = $this->assignment('school_admin');

        $response = $this->withToken($this->tokenFor($assignment))
            ->getJson('/api/v1/auth/context');

        $response->assertOk()
            ->assertJsonPath('school.name', 'دبیرستان مشاهیر')
            ->assertJsonPath('active_role.key', 'school_admin');

        $permissions = collect($response->json('permissions'))->pluck('condition', 'key');
        $this->assertTrue($permissions->has('audit.view'));
        $this->assertFalse($permissions->has('roles.manage'));
    }

    public function test_middleware_seeds_school_context(): void
    {
        $assignment = $this->assignment('school_admin');

        $this->withToken($this->tokenFor($assignment))->getJson('/api/v1/auth/context');

        $this->assertSame($this->school->id, app(SchoolContext::class)->schoolId());
    }

    public function test_ended_assignment_yields_404_on_any_contextual_route(): void
    {
        $assignment = $this->assignment('school_admin');
        $token = $this->user->createToken('test', ["role:{$assignment->id}"])->plainTextToken;

        // Access is cut right after the token was issued — no scheduler needed.
        $assignment->update(['ends_on' => now()->subDay()->toDateString()]);

        $this->withToken($token)->getJson('/api/v1/auth/context')->assertNotFound();
    }

    public function test_token_without_role_ability_is_forbidden(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/auth/context')->assertForbidden();
    }

    public function test_unauthenticated_request_is_401(): void
    {
        $this->getJson('/api/v1/auth/context')->assertUnauthorized();
    }

    public function test_platform_admin_gets_scope_override(): void
    {
        $assignment = $this->assignment('platform_admin');

        $this->withToken($this->tokenFor($assignment))->getJson('/api/v1/auth/context')->assertOk();

        $this->assertTrue(app(SchoolContext::class)->hasOverride());
        $this->assertNotNull(app(PermissionRegistrar::class)->activeRole());
    }
}
