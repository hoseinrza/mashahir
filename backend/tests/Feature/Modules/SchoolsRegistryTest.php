<?php

namespace Tests\Feature\Modules;

use App\Modules\School\Models\School;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * دفتر مدارس پلتفرم: ساخت مدرسه و تخصیص مدیر فقط با schools.manage.
 */
class SchoolsRegistryTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
    }

    public function test_platform_admin_creates_a_school_and_assigns_its_principal(): void
    {
        $this->actingWithRole('platform_admin');

        $created = $this->postJson('/api/v1/schools', [
            'name' => 'دبیرستان نمونهٔ دوم',
            'level' => 'high',
            'grading_type' => 'numeric',
        ])->assertCreated()->json();

        $this->assertSame('دبیرستان نمونهٔ دوم', $created['name']);
        $this->assertTrue($created['is_active']);
        $this->assertDatabaseHas('schools', ['ulid' => $created['ulid'], 'level' => 'high']);

        $principal = $this->makeUser();

        $this->postJson("/api/v1/schools/{$created['ulid']}/principals", [
            'user_ulid' => $principal->ulid,
        ])->assertCreated()->assertJsonPath('user_ulid', $principal->ulid);

        $schoolId = School::query()->where('ulid', $created['ulid'])->value('id');

        $this->assertDatabaseHas('user_roles', [
            'user_id' => $principal->id,
            'school_id' => $schoolId,
            'scope_type' => 'school',
        ]);

        // A second identical assignment is refused, not duplicated.
        $this->postJson("/api/v1/schools/{$created['ulid']}/principals", [
            'user_ulid' => $principal->ulid,
        ])->assertStatus(422);
    }

    public function test_school_staff_cannot_reach_the_registry(): void
    {
        $this->actingWithRole('school_admin');

        $this->getJson('/api/v1/schools')->assertForbidden();

        $this->postJson('/api/v1/schools', [
            'name' => 'مدرسهٔ غیرمجاز',
            'level' => 'high',
            'grading_type' => 'numeric',
        ])->assertForbidden();

        $this->postJson("/api/v1/schools/{$this->school->ulid}/principals", [
            'user_ulid' => $this->makeUser()->ulid,
        ])->assertForbidden();
    }

    public function test_index_lists_schools_and_show_returns_the_principals(): void
    {
        $this->actingWithRole('platform_admin');

        $rows = $this->getJson('/api/v1/schools')->assertOk()->json('data');
        $this->assertGreaterThanOrEqual(1, count($rows));

        $principal = $this->makeUser();

        $this->postJson("/api/v1/schools/{$this->school->ulid}/principals", [
            'user_ulid' => $principal->ulid,
        ])->assertCreated();

        $detail = $this->getJson("/api/v1/schools/{$this->school->ulid}")->assertOk()->json();

        $this->assertSame($this->school->ulid, $detail['ulid']);
        $this->assertContains(
            $principal->ulid,
            collect($detail['principals'])->pluck('user_ulid')->all(),
        );
    }

    public function test_invalid_level_is_rejected(): void
    {
        $this->actingWithRole('platform_admin');

        $this->postJson('/api/v1/schools', [
            'name' => 'مدرسهٔ نامعتبر',
            'level' => 'university',
            'grading_type' => 'numeric',
        ])->assertStatus(422);
    }
}
