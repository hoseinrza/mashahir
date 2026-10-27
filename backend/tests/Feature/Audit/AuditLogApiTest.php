<?php

namespace Tests\Feature\Audit;

use App\Modules\Audit\Services\AuditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class AuditLogApiTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
    }

    public function test_school_admin_reads_school_audit_log(): void
    {
        $this->actingWithRole('school_admin');
        $this->be($this->actor); // AuditService records auth()->id() as actor
        $user = $this->makeUser();

        app(AuditService::class)->log('guardian_link.updated', $user, new: ['a' => 1], reason: 'تغییر پرچم');

        // be() bypasses sanctum via the web guard; clear it so the HTTP call
        // authenticates through the bearer token again.
        $this->app['auth']->forgetGuards();

        $rows = $this->getJson('/api/v1/audit-logs')->assertOk()->json('data');

        $this->assertNotEmpty($rows);
        $this->assertSame('guardian_link.updated', $rows[0]['action']);
        $this->assertSame('تغییر پرچم', $rows[0]['reason']);
        $this->assertSame($this->actor->fullName(), $rows[0]['actor']['name']);
    }

    public function test_action_filter_narrows_results(): void
    {
        $this->actingWithRole('school_admin');
        $user = $this->makeUser();
        app(AuditService::class)->log('guardian_link.updated', $user, reason: 'الف');
        app(AuditService::class)->log('user.phone_changed', $user, reason: 'ب');

        $rows = $this->getJson('/api/v1/audit-logs?action=guardian_link')->assertOk()->json('data');

        $this->assertNotEmpty($rows);
        $this->assertSame('guardian_link.updated', $rows[0]['action']);
    }

    public function test_roles_without_audit_view_are_forbidden(): void
    {
        $this->actingWithRole('discipline_deputy');

        $this->getJson('/api/v1/audit-logs')->assertForbidden();
    }
}
