<?php

namespace Tests\Feature\Audit;

use App\Modules\Audit\Models\AuditLog;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Models\User;
use App\Support\AppendOnlyViolationException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class AuditAppendOnlyTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
    }

    public function test_audit_writes_survive_but_mutations_are_blocked_at_db_level(): void
    {
        app(AuditService::class)->log(
            'test.event',
            subject: $this->makeUser(),
            new: ['k' => 'v'],
            reason: 'تست append',
        );

        $this->assertDatabaseCount('audit_logs', 1);

        // Raw UPDATE — the trigger must reject it for ANY role, including the owner.
        $this->expectException(QueryException::class);
        DB::table('audit_logs')->update(['reason' => 'tampered']);
    }

    public function test_audit_delete_is_blocked_at_db_level(): void
    {
        $user = $this->makeUser();
        app(AuditService::class)->log('test.event', subject: $user);

        $this->expectException(QueryException::class);
        DB::table('audit_logs')->delete();
    }

    public function test_audit_model_rejects_update_and_delete(): void
    {
        $user = $this->makeUser();
        $entry = app(AuditService::class)->log('test.event', subject: $user);
        $entry = AuditLog::query()->withoutGlobalScopes()->findOrFail($entry->id);

        $entry->reason = 'tampered';

        $this->expectException(AppendOnlyViolationException::class);
        $entry->save();
    }

    public function test_audit_rows_carry_actor_ip_and_reason(): void
    {
        $user = $this->makeUser();
        $entry = app(AuditService::class)->log(
            'sh7.operation',
            subject: $user,
            old: ['a' => 1],
            new: ['a' => 2],
            reason: 'دلیل الزامی ش۷',
        );

        $this->assertSame('sh7.operation', $entry->action);
        $this->assertSame(['a' => 2], $entry->new);
        $this->assertSame('دلیل الزامی ش۷', $entry->reason);
        $this->assertNotNull($entry->ip);
        $this->assertNull($entry->updated_at ?? null, 'append-only rows have no updated_at');
    }
}
