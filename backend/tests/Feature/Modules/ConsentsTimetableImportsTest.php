<?php

namespace Tests\Feature\Modules;

use App\Modules\Family\Models\ConsentRequest;
use App\Modules\People\Models\GuardianLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class ConsentsTimetableImportsTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $student;

    private $guardianA;

    private $guardianB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();

        $this->student = $this->makeStudent();
        $this->guardianA = $this->makeUser();
        $this->guardianB = $this->makeUser();
    }

    private function link($guardian, bool $canApprove = true): GuardianLink
    {
        return GuardianLink::query()->create([
            'guardian_user_id' => $guardian->id,
            'student_id' => $this->student->id,
            'link_type' => 'primary', 'status' => 'active', 'approved_at' => now(),
            'can_approve_consent' => $canApprove,
        ]);
    }

    private function makeConsent(string $policy = 'one_parent'): ConsentRequest
    {
        // consents.manage in the matrix: school_admin (deputy/teacher are ش۲-scoped).
        $this->actingWithRole('school_admin');

        $ulid = $this->postJson('/api/v1/consents', [
            'student_ulid' => $this->student->ulid,
            'title' => 'رضایتنامه اردوی یک‌روزه',
            'body' => 'شرط شرکت: امضای ولی',
            'policy' => $policy,
        ])->assertCreated()->json('ulid');

        return ConsentRequest::query()->where('ulid', $ulid)->first();
    }

    public function test_consent_respond_follows_the_link_flag_and_policy(): void
    {
        $this->link($this->guardianA, canApprove: true);
        $this->link($this->guardianB, canApprove: false);

        $consent = $this->makeConsent('one_parent');

        // Guardian B lacks can_approve_consent → 404 (sh3).
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $this->guardianB);
        $this->postJson("/api/v1/consents/{$consent->ulid}/respond", ['decision' => 'approved'])
            ->assertNotFound();

        // Guardian A approves → satisfied (one_parent).
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $this->guardianA);
        $this->postJson("/api/v1/consents/{$consent->ulid}/respond", ['decision' => 'approved'])
            ->assertOk()->assertJsonPath('satisfied', true);

        // staff results view.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('office_manager');
        $row = collect($this->getJson('/api/v1/consents')->assertOk()->json('data'))->first();
        $this->assertTrue($row['satisfied']);
        $this->assertCount(1, $row['responses']);
    }

    public function test_both_parents_policy_needs_two_approvals(): void
    {
        $this->link($this->guardianA);
        $this->link($this->guardianB);

        $consent = $this->makeConsent('both_parents');

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $this->guardianA);
        $this->postJson("/api/v1/consents/{$consent->ulid}/respond", ['decision' => 'approved'])
            ->assertOk()->assertJsonPath('satisfied', false);

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $this->guardianB);
        $this->postJson("/api/v1/consents/{$consent->ulid}/respond", ['decision' => 'approved'])
            ->assertOk()->assertJsonPath('satisfied', true);
    }

    public function test_court_order_can_veto_consent_approval(): void
    {
        $this->link($this->guardianA);
        $consent = $this->makeConsent('one_parent');

        $this->actingWithRole('office_manager');
        $this->postJson('/api/v1/court-orders', [
            'student_ulid' => $this->student->ulid,
            'restrictions' => ['can_approve_consent' => false],
            'reason' => 'حکم دادگاه خانواده',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $this->guardianA);
        $this->postJson("/api/v1/consents/{$consent->ulid}/respond", ['decision' => 'approved'])
            ->assertNotFound();
    }

    public function test_timetable_crud_and_teacher_scope(): void
    {
        $teacher = $this->makeUser();
        $classroom = $this->makeClassroom();
        $subjectId = $this->assignTeacher($teacher, $classroom, $this->makeSubject())->id;
        $otherSubject = \App\Modules\Academic\Models\ClassroomSubject::query()->create([
            'school_id' => $this->school->id, 'classroom_id' => $this->makeClassroom()->id,
            'subject_id' => $this->makeSubject()->id,
        ]);

        $this->actingWithRole('academic_deputy');
        $this->postJson('/api/v1/timetable', [
            'classroom_subject_id' => $subjectId, 'weekday' => 0, 'period' => 1,
            'starts_at' => '08:00', 'ends_at' => '09:30',
        ])->assertCreated();

        $this->postJson('/api/v1/timetable', [
            'classroom_subject_id' => $subjectId, 'weekday' => 0, 'period' => 1,
            'starts_at' => '10:00', 'ends_at' => '11:00',
        ])->assertJsonValidationErrors('period');

        // Teacher sees only his own slots (sh2).
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $teacher);
        $slots = $this->getJson('/api/v1/timetable')->assertOk()->json('data');
        $this->assertCount(1, $slots);
        $this->assertSame('08:00:00', $slots[0]['starts_at']);
    }

    public function test_csv_import_reports_row_errors(): void
    {
        $this->actingWithRole('office_manager');

        $csv = "student_code,first_name,last_name,national_code\n"
            ."5001,علی,کریمی,0023456789\n"
            ."5002,مریم,سعیدی,12345\n"
            ."5001,تکراری,ممنوع,\n";

        $tmp = tempnam(sys_get_temp_dir(), 'imp').'.csv';
        file_put_contents($tmp, $csv);

        $result = $this->postJson('/api/v1/imports/students', [
            'file' => new \Illuminate\Http\UploadedFile($tmp, 'students.csv', 'text/csv', null, true),
        ])->assertCreated()->json();

        $this->assertSame(3, $result['rows_total']);
        $this->assertSame(1, $result['rows_ok']);

        $detail = $this->getJson("/api/v1/imports/{$result['ulid']}")->assertOk()->json();
        $this->assertCount(2, $detail['errors']);
        $this->assertStringContainsString('۱۰ رقم', $detail['errors'][0]['message']);
    }
}
