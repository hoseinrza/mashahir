<?php

namespace Tests\Feature\Modules;

use App\Modules\People\Models\Student;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * Removing a student from the roster: a reason-logged soft delete (sh7). The
 * row leaves every list but stays in the table, because attendance, marks and
 * enrolments are history the school must be able to restore or audit.
 */
class StudentRemovalTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
        $this->actingWithRole('school_admin');
    }

    public function test_the_office_removes_a_student_but_the_history_stays(): void
    {
        $student = $this->makeStudent(['student_code' => 'S9001']);
        $this->enroll($student, $this->makeClassroom());

        $this->deleteJson("/api/v1/students/{$student->ulid}", [
            'reason' => 'ثبت اشتباه در فهرست',
        ])->assertOk();

        // Gone from the roster…
        $this->getJson('/api/v1/students')
            ->assertOk()
            ->assertJsonMissing(['ulid' => $student->ulid]);

        // …but the row and its enrolment are still there for a restore.
        $this->assertSoftDeleted('students', ['id' => $student->id]);
        $this->assertDatabaseHas('enrollments', ['student_id' => $student->id]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'student.deleted',
            'subject_id' => $student->id,
            'reason' => 'ثبت اشتباه در فهرست',
        ]);
    }

    public function test_a_removed_students_code_can_be_issued_again(): void
    {
        $student = $this->makeStudent(['student_code' => 'S9002']);

        $this->deleteJson("/api/v1/students/{$student->ulid}", [
            'reason' => 'ثبت اشتباه در فهرست',
        ])->assertOk();

        $this->postJson('/api/v1/students', [
            'student_code' => 'S9002',
            'first_name' => 'دانش',
            'last_name' => 'آموز تازه',
        ])->assertCreated();
    }

    public function test_removal_ends_the_student_role_and_keeps_the_account(): void
    {
        $this->postJson('/api/v1/students', [
            'student_code' => 'S9003',
            'first_name' => 'پارسا',
            'last_name' => 'رادمنش',
            'phone' => '09127770009',
        ])->assertCreated();

        $student = Student::query()->where('student_code', 'S9003')->firstOrFail();
        $role = \DB::table('user_roles')
            ->where('scope_type', 'student')
            ->where('scope_id', $student->id)
            ->firstOrFail();
        $this->assertNull($role->ends_on);

        $this->deleteJson("/api/v1/students/{$student->ulid}", [
            'reason' => 'انتقال به مدرسهٔ دیگر',
        ])->assertOk();

        $this->assertNotNull(\DB::table('user_roles')->where('id', $role->id)->value('ends_on'));
        // The number may serve a family; only this student's role ended.
        $this->assertDatabaseHas('users', ['id' => $student->user_id]);
    }

    public function test_a_short_reason_is_rejected(): void
    {
        $student = $this->makeStudent();

        $this->deleteJson("/api/v1/students/{$student->ulid}", ['reason' => 'بد'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['reason']);

        $this->assertNotSoftDeleted('students', ['id' => $student->id]);
    }

    public function test_a_role_without_students_manage_cannot_remove(): void
    {
        $student = $this->makeStudent();

        $this->actingWithRole('teacher');

        $this->deleteJson("/api/v1/students/{$student->ulid}", [
            'reason' => 'ثبت اشتباه در فهرست',
        ])->assertForbidden();

        $this->assertNotSoftDeleted('students', ['id' => $student->id]);
    }

    public function test_a_foreign_school_student_is_404(): void
    {
        $otherSchool = \DB::table('schools')->insertGetId([
            'ulid' => '01JOTHERSCHOOL000000000002', 'name' => 'مدرسه دوم', 'level' => 'high',
            'grading_type' => 'numeric', 'student_has_account' => true, 'timezone' => 'Asia/Tehran',
            'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);
        \DB::table('students')->insert([
            'ulid' => '01JFOREIGNSTUDENT000000002', 'school_id' => $otherSchool,
            'student_code' => 'X3', 'first_name' => 'بیرونی', 'last_name' => 'غیرمجاز',
            'status' => 'active', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->deleteJson('/api/v1/students/01JFOREIGNSTUDENT000000002', [
            'reason' => 'ثبت اشتباه در فهرست',
        ])->assertNotFound();
    }
}
