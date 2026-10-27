<?php

namespace Tests\Feature\People;

use App\Modules\Audit\Models\AuditLog;
use App\Modules\People\Models\GuardianLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class StudentsApiTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
    }

    public function test_school_admin_sees_all_school_students(): void
    {
        $this->actingWithRole('school_admin');
        $this->makeStudent();
        $this->makeStudent();

        $this->getJson('/api/v1/students')->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_teacher_sees_only_his_classrooms_students_sh2(): void
    {
        $teacher = $this->makeUser();
        $this->actingWithRole('teacher', user: $teacher);

        $mine = $this->makeClassroom();
        $other = $this->makeClassroom();

        $myStudent = $this->makeStudent();
        $enrolledElsewhere = $this->makeStudent();
        $unassigned = $this->makeStudent();

        $this->enroll($myStudent, $mine);
        $this->enroll($enrolledElsewhere, $other);

        $this->assignTeacher($teacher, $mine);

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $teacher);

        $ulids = collect($this->getJson('/api/v1/students')->assertOk()->json('data'))->pluck('ulid');

        $this->assertContains($myStudent->ulid, $ulids);
        $this->assertNotContains($enrolledElsewhere->ulid, $ulids);
        $this->assertNotContains($unassigned->ulid, $ulids);
    }

    public function test_student_role_sees_only_self_sh4(): void
    {
        $student = $this->makeStudent();
        $studentUser = $this->makeUser();
        $student->forceFill(['user_id' => $studentUser->id])->save();

        $this->makeStudent(); // someone else

        $this->actingWithRole('student', user: $studentUser);

        $this->getJson('/api/v1/students')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_guardian_sees_only_children_with_active_link_sh3(): void
    {
        $guardian = $this->makeUser();
        $child = $this->makeStudent();
        $stranger = $this->makeStudent();

        GuardianLink::query()->create([
            'guardian_user_id' => $guardian->id,
            'student_id' => $child->id,
            'link_type' => 'primary',
            'status' => 'active',
            'approved_at' => now(),
        ]);

        $this->actingWithRole('guardian', user: $guardian);

        $ulids = collect($this->getJson('/api/v1/students')->assertOk()->json('data'))->pluck('ulid');

        $this->assertContains($child->ulid, $ulids);
        $this->assertNotContains($stranger->ulid, $ulids);
    }

    public function test_direct_request_for_foreign_school_student_is_404(): void
    {
        $this->actingWithRole('school_admin');

        // A student in a second school, bypassing the request context.
        $otherSchool = \DB::table('schools')->insertGetId([
            'ulid' => '01JOTHERSCHOOL000000000000', 'name' => 'مدرسه دوم', 'level' => 'high',
            'grading_type' => 'numeric', 'student_has_account' => true, 'timezone' => 'Asia/Tehran',
            'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);
        \DB::table('students')->insert([
            'ulid' => '01JFOREIGNSTUDENT000000000', 'school_id' => $otherSchool,
            'student_code' => 'X1', 'first_name' => 'بیرونی', 'last_name' => 'غیرمجاز',
            'status' => 'active', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->getJson('/api/v1/students/01JFOREIGNSTUDENT000000000')->assertNotFound();
    }

    public function test_direct_request_for_out_of_scope_student_is_404(): void
    {
        $teacher = $this->makeUser();
        $mine = $this->makeClassroom();
        $other = $this->makeClassroom();
        $myStudent = $this->makeStudent();
        $otherStudent = $this->makeStudent();
        $this->enroll($myStudent, $mine);
        $this->enroll($otherStudent, $other);
        $this->assignTeacher($teacher, $mine);

        $this->actingWithRole('teacher', user: $teacher);

        $this->getJson("/api/v1/students/{$myStudent->ulid}")->assertOk();
        $this->getJson("/api/v1/students/{$otherStudent->ulid}")->assertNotFound();
    }

    public function test_office_manager_creates_student(): void
    {
        $this->actingWithRole('office_manager');

        $this->postJson('/api/v1/students', [
            'student_code' => 'S1001', 'first_name' => 'سارا', 'last_name' => 'کریمی',
            'national_code' => '0023456789',
        ])->assertCreated()->assertJsonPath('data.student_code', 'S1001')
            ->assertJsonMissing(['national_code' => '0023456789']);

        // Stored encrypted, never echoed back.
        $this->assertDatabaseHas('students', ['student_code' => 'S1001']);
        $this->assertDatabaseMissing('students', ['national_code' => '0023456789']);
    }

    public function test_national_code_reveal_requires_reason_and_is_audited(): void
    {
        $this->actingWithRole('office_manager');
        $student = $this->makeStudent(['national_code' => '0023456789']);

        $this->postJson("/api/v1/students/{$student->ulid}/national-code", [])
            ->assertJsonValidationErrors('reason');

        $this->postJson("/api/v1/students/{$student->ulid}/national-code", [
            'reason' => 'نیاز دفتر برای صدور بیمه',
        ])->assertOk()->assertJsonPath('national_code', '0023456789');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'student.national_code_viewed',
            'subject_id' => $student->id,
        ]);
    }

    public function test_teacher_cannot_reveal_national_code(): void
    {
        $teacher = $this->makeUser();
        $this->actingWithRole('teacher', user: $teacher);
        $student = $this->makeStudent();

        $this->postJson("/api/v1/students/{$student->ulid}/national-code", [
            'reason' => 'هر دلیلی',
        ])->assertNotFound();
    }

    public function test_support_gets_minimal_student_fields(): void
    {
        $this->actingWithRole('support');
        $student = $this->makeStudent(['birth_date' => '2008-05-10']);

        $row = collect($this->getJson('/api/v1/students')->assertOk()->json('data'))->first();

        $this->assertArrayNotHasKey('birth_date', $row);
        $this->assertArrayHasKey('student_code', $row);
    }
}
