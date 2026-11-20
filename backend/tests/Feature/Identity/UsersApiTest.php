<?php

namespace Tests\Feature\Identity;

use App\Modules\Audit\Models\AuditLog;
use App\Modules\Identity\Models\StaffProfile;
use App\Modules\Identity\Models\User;
use App\Modules\School\Models\School;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class UsersApiTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
    }

    public function test_users_list_requires_the_permission(): void
    {
        $this->actingWithRole('teacher');

        $this->getJson('/api/v1/users')->assertForbidden();
    }

    public function test_school_admin_lists_only_own_school_users(): void
    {
        $this->actingWithRole('school_admin');
        $this->makeUser(); // in our school

        $otherSchool = School::query()->create([
            'name' => 'مدرسه دیگر', 'level' => 'high', 'grading_type' => 'numeric',
            'student_has_account' => true, 'timezone' => 'Asia/Tehran', 'is_active' => true,
        ]);
        $foreignUser = User::factory()->create();
        \DB::table('user_roles')->insert([
            'user_id' => $foreignUser->id,
            'role_id' => \DB::table('roles')->where('key', 'teacher')->value('id'),
            'school_id' => $otherSchool->id,
            'scope_type' => 'school', 'scope_id' => null,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $ulids = collect($this->getJson('/api/v1/users')->assertOk()->json('data'))
            ->pluck('ulid');

        $this->assertContains($this->actor->ulid, $ulids);
        $this->assertNotContains($foreignUser->ulid, $ulids);
    }

    public function test_support_sees_minimal_user_data(): void
    {
        $this->actingWithRole('support');

        $row = collect($this->getJson('/api/v1/users')->assertOk()->json('data'))->first();

        $this->assertArrayNotHasKey('phone', $row);
        $this->assertArrayHasKey('first_name', $row);
    }

    public function test_office_manager_creates_user(): void
    {
        $this->actingWithRole('office_manager');

        $this->postJson('/api/v1/users', [
            'first_name' => 'علی', 'last_name' => 'محمدی', 'phone' => '09121110000',
        ])->assertCreated()->assertJsonPath('data.first_name', 'علی');
    }

    public function test_created_user_is_listed_before_holding_any_role(): void
    {
        $this->actingWithRole('school_admin');

        $this->postJson('/api/v1/users', [
            'first_name' => 'سارا', 'last_name' => 'کریمی', 'phone' => '09123330000',
        ])->assertCreated();

        $created = User::query()->where('first_name', 'سارا')->firstOrFail();

        // The account holds no role yet — the membership alone lists it,
        // otherwise its role could never be assigned from the table.
        $ulids = collect($this->getJson('/api/v1/users')->assertOk()->json('data'))->pluck('ulid');

        $this->assertContains($created->ulid, $ulids);
        $this->assertDatabaseHas('staff_profiles', [
            'user_id' => $created->id,
            'school_id' => $this->school->id,
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.created', 'subject_id' => $created->id]);
    }

    public function test_existing_platform_account_is_attached_to_this_school(): void
    {
        // Self-registered or already a member of another school: attaching is
        // membership only, never a permission grant.
        $existing = User::factory()->create(['phone' => '09124440000']);

        $this->actingWithRole('school_admin');

        $this->postJson('/api/v1/users', [
            'first_name' => 'رضا', 'last_name' => 'مرادی', 'phone' => '09124440000',
        ])->assertOk();

        $this->assertDatabaseHas('staff_profiles', [
            'user_id' => $existing->id,
            'school_id' => $this->school->id,
        ]);
        $this->assertContains(
            $existing->ulid,
            collect($this->getJson('/api/v1/users')->assertOk()->json('data'))->pluck('ulid'),
        );
    }

    public function test_duplicate_membership_in_the_same_school_is_rejected(): void
    {
        $this->actingWithRole('school_admin');

        $payload = ['first_name' => 'مینا', 'last_name' => 'نادری', 'phone' => '09125550000'];
        $this->postJson('/api/v1/users', $payload)->assertCreated();

        $this->postJson('/api/v1/users', $payload)->assertJsonValidationErrors('phone');
    }

    public function test_member_of_another_school_without_roles_here_is_not_listed(): void
    {
        $this->actingWithRole('school_admin');

        $otherSchool = School::query()->create([
            'name' => 'مدرسه دیگر', 'level' => 'high', 'grading_type' => 'numeric',
            'student_has_account' => true, 'timezone' => 'Asia/Tehran', 'is_active' => true,
        ]);
        $foreign = User::factory()->create();
        // school_id is not mass-assignable (context hook owns it) — force it.
        StaffProfile::forceCreate(['user_id' => $foreign->id, 'school_id' => $otherSchool->id]);

        $this->assertNotContains(
            $foreign->ulid,
            collect($this->getJson('/api/v1/users')->assertOk()->json('data'))->pluck('ulid'),
        );
    }

    public function test_phone_change_requires_reason_and_is_audited(): void
    {
        $this->actingWithRole('school_admin');
        $target = $this->makeUser();

        $this->postJson("/api/v1/users/{$target->ulid}/phone", ['phone' => '09122220000'])
            ->assertJsonValidationErrors('reason');

        $this->postJson("/api/v1/users/{$target->ulid}/phone", [
            'phone' => '09122220000', 'reason' => 'شماره قبلی در دسترس نیست',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.phone_changed',
            'actor_id' => $this->actor->id,
            'subject_id' => $target->id,
        ]);
    }

    public function test_office_manager_cannot_assign_managerial_roles_sh1(): void
    {
        $this->actingWithRole('office_manager');
        $target = $this->makeUser();

        $this->postJson("/api/v1/users/{$target->ulid}/roles", [
            'role_key' => 'school_admin', 'scope_type' => 'school',
        ])->assertForbidden();

        $this->postJson("/api/v1/users/{$target->ulid}/roles", [
            'role_key' => 'teacher', 'scope_type' => 'school',
        ])->assertCreated();
    }

    public function test_ending_a_role_cuts_access_immediately(): void
    {
        // A staff member holding a school_admin assignment.
        $staff = $this->makeUser();
        $assignment = $this->actingWithRole('school_admin', user: $staff);
        $staffToken = $staff->createToken('t', ["role:{$assignment->id}"])->plainTextToken;

        // The office manager (users.manage) ends that assignment.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('office_manager');
        $this->deleteJson("/api/v1/users/{$staff->ulid}/roles/{$assignment->id}", [
            'reason' => 'پایان همکاری',
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($staffToken)->getJson('/api/v1/auth/context')->assertNotFound();
    }
}
