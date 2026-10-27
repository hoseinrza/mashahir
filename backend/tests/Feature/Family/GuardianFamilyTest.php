<?php

namespace Tests\Feature\Family;

use App\Modules\People\Models\CourtOrder;
use App\Modules\People\Models\GuardianLink;
use App\Modules\People\Models\PickupAuthorization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class GuardianFamilyTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $guardianA;

    private $guardianB;

    private $child;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();

        // Two separated guardians of the SAME child, two independent links.
        $this->guardianA = $this->makeUser();
        $this->guardianB = $this->makeUser();
        $this->child = $this->makeStudent();

        $this->makeLink($this->guardianA, ['can_view_grades' => true, 'can_pickup' => false]);
        $this->makeLink($this->guardianB, ['can_view_grades' => false, 'can_pickup' => true]);
    }

    private function makeLink($guardian, array $flags, array $attributes = []): GuardianLink
    {
        return GuardianLink::query()->create([
            'guardian_user_id' => $guardian->id,
            'student_id' => $this->child->id,
            'link_type' => 'separated_joint',
            'status' => 'active',
            'approved_at' => now(),
            ...$flags,
            ...$attributes,
        ]);
    }

    public function test_separated_guardians_see_only_their_own_link(): void
    {
        $this->actingWithRole('guardian', user: $this->guardianA);

        $links = $this->getJson('/api/v1/guardian-links')->assertOk()->json('data');

        $this->assertCount(1, $links);
        $this->assertSame($this->child->ulid, $links[0]['student_ulid']);
        // A guardian never sees the other guardian's identity.
        $this->assertArrayNotHasKey('guardian', $links[0]);
    }

    public function test_flags_are_per_link_not_inherited(): void
    {
        $this->actingWithRole('guardian', user: $this->guardianA);
        $aFlags = collect($this->getJson('/api/v1/my/children')->assertOk()->json('data'))
            ->firstWhere('student_ulid', $this->child->ulid)['effective_flags'];

        $this->app['auth']->forgetGuards();

        $this->actingWithRole('guardian', user: $this->guardianB);
        $bFlags = collect($this->getJson('/api/v1/my/children')->assertOk()->json('data'))
            ->firstWhere('student_ulid', $this->child->ulid)['effective_flags'];

        $this->assertTrue($aFlags['can_view_grades']);
        $this->assertFalse($aFlags['can_pickup']);
        $this->assertFalse($bFlags['can_view_grades']);
        $this->assertTrue($bFlags['can_pickup']);
    }

    public function test_pickup_list_follows_the_guardian_flag(): void
    {
        PickupAuthorization::query()->create([
            'student_id' => $this->child->id,
            'full_name' => 'مادربزرگ',
            'phone' => '09123334444',
        ]);

        // Guardian B has can_pickup → sees the list.
        $this->actingWithRole('guardian', user: $this->guardianB);
        $this->getJson("/api/v1/pickup/{$this->child->ulid}")->assertOk()
            ->assertJsonCount(1, 'data');

        // Guardian A lacks can_pickup → the list does not exist for them.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $this->guardianA);
        $this->getJson("/api/v1/pickup/{$this->child->ulid}")->assertNotFound();
    }

    public function test_request_then_school_approval_activates_the_link_sh15(): void
    {
        $guardian = $this->makeUser();
        $this->actingWithRole('guardian', user: $guardian);

        $this->postJson('/api/v1/guardian-links/request', [
            'student_ulid' => $this->child->ulid,
        ])->assertCreated();

        // Pending: no children yet.
        $this->getJson('/api/v1/my/children')->assertOk()->assertJsonCount(0, 'data');

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('office_manager');
        $pendingId = GuardianLink::query()
            ->where('guardian_user_id', $guardian->id)
            ->where('status', 'pending')
            ->value('id');

        $this->postJson("/api/v1/guardian-links/{$pendingId}/approve", [
            'can_view_grades' => true,
            'reason' => 'تأیید بر اساس مدارک ثبت‌نام',
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $guardian);
        $children = $this->getJson('/api/v1/my/children')->assertOk()->json('data');
        $this->assertCount(1, $children);
        $this->assertTrue($children[0]['effective_flags']['can_view_grades']);
    }

    public function test_flag_change_requires_reason_and_is_audited(): void
    {
        $this->actingWithRole('office_manager');
        $linkId = GuardianLink::query()->where('guardian_user_id', $this->guardianA->id)->value('id');

        $this->patchJson("/api/v1/guardian-links/{$linkId}", ['can_pickup' => true])
            ->assertJsonValidationErrors('reason');

        $this->patchJson("/api/v1/guardian-links/{$linkId}", [
            'can_pickup' => true, 'reason' => 'بر اساس توافق کتبی والدین',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'guardian_link.updated',
        ]);
    }

    public function test_ending_a_link_cuts_access_immediately(): void
    {
        $this->actingWithRole('office_manager');
        $linkId = GuardianLink::query()->where('guardian_user_id', $this->guardianB->id)->value('id');

        $this->postJson("/api/v1/guardian-links/{$linkId}/end", [
            'reason' => 'حکم دادگاه',
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $this->guardianB);

        $this->getJson('/api/v1/my/children')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/v1/pickup/{$this->child->ulid}")->assertNotFound();
    }

    public function test_court_order_overrides_link_flags(): void
    {
        // B may pick up — but a court order says no.
        $this->actingWithRole('office_manager');
        $this->postJson('/api/v1/court-orders', [
            'student_ulid' => $this->child->ulid,
            'restrictions' => ['can_pickup' => false],
            'valid_from' => now()->toDateString(),
            'valid_to' => now()->addDays(30)->toDateString(),
            'reason' => 'حکم دادگاه خانواده',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $this->guardianB);

        $flags = collect($this->getJson('/api/v1/my/children')->json('data'))
            ->firstWhere('student_ulid', $this->child->ulid)['effective_flags'];
        $this->assertFalse($flags['can_pickup'], 'court order must veto the link flag');

        $this->getJson("/api/v1/pickup/{$this->child->ulid}")->assertNotFound();

        // After the order expires, the flag is effective again.
        $this->travel(31)->days();

        $this->getJson("/api/v1/pickup/{$this->child->ulid}")->assertOk();
    }

    public function test_discipline_deputy_pickup_changes_are_suggestions_sh13(): void
    {
        $this->actingWithRole('discipline_deputy');

        $created = $this->postJson("/api/v1/pickup/{$this->child->ulid}", [
            'full_name' => 'عموی موقت',
            'phone' => '09125556666',
            'reason' => 'درخواست تلفنی ولی',
        ])->assertCreated()->json();

        $this->assertTrue($created['suggestion_only']);
        $this->assertSame('inactive', $created['status']);

        // The office confirms it (sh7 for staff).
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('office_manager');
        $this->patchJson("/api/v1/pickup/authorizations/{$created['id']}", [
            'status' => 'active', 'reason' => 'تأیید دفتر پس از احراز',
        ])->assertOk();

        $this->assertDatabaseHas('pickup_authorizations', ['id' => $created['id'], 'status' => 'active']);
    }

    public function test_teacher_cannot_see_pickup_list(): void
    {
        $this->actingWithRole('teacher');
        $this->getJson("/api/v1/pickup/{$this->child->ulid}")->assertNotFound();
    }

    public function test_discipline_deputy_sees_court_order_summary_only_sh16(): void
    {
        $this->actingWithRole('office_manager');
        $orderId = $this->postJson('/api/v1/court-orders', [
            'student_ulid' => $this->child->ulid,
            'restrictions' => ['can_pickup' => false],
            'reason' => 'حکم دادگاه',
        ])->assertCreated()->json('id');

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('discipline_deputy');
        $row = collect($this->getJson('/api/v1/court-orders')->assertOk()->json('data'))
            ->firstWhere('id', $orderId);

        $this->assertArrayHasKey('restrictions', $row);
        $this->assertNull($row['file']);
        $this->assertTrue($this->getJson('/api/v1/court-orders')->json('summary_only'));
    }
}
