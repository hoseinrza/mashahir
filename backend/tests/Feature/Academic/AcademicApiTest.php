<?php

namespace Tests\Feature\Academic;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class AcademicApiTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
    }

    public function test_academic_deputy_manages_grade_levels(): void
    {
        $this->actingWithRole('academic_deputy');

        $this->getJson('/api/v1/academic/grade-levels')->assertOk();

        $this->postJson('/api/v1/academic/grade-levels', ['title' => 'دهم', 'order' => 10])
            ->assertCreated();
    }

    public function test_academic_deputy_creates_years_and_the_first_one_auto_becomes_current(): void
    {
        $this->actingWithRole('academic_deputy');

        // The school has no year yet — the first creation becomes current
        // even without asking for it.
        $first = $this->postJson('/api/v1/academic/years', [
            'title' => '۱۴۰۵-۱۴۰۶',
            'starts_on' => '2026-09-01',
            'ends_on' => '2027-06-20',
        ])->assertCreated()->json();
        $this->assertTrue($first['is_current']);

        // A second year without is_current stays in the background.
        $second = $this->postJson('/api/v1/academic/years', [
            'title' => '۱۴۰۶-۱۴۰۷',
            'starts_on' => '2027-09-01',
            'ends_on' => '2028-06-20',
        ])->assertCreated()->json();
        $this->assertFalse($second['is_current']);

        // Promoting it demotes the first one — the partial unique index is
        // honoured through the controller, not a raw 500.
        $this->patchJson("/api/v1/academic/years/{$second['id']}", ['is_current' => true])->assertOk();

        $rows = collect($this->getJson('/api/v1/academic/years')->json('data'));
        $this->assertTrue($rows->firstWhere('id', $second['id'])['is_current']);
        $this->assertFalse($rows->firstWhere('id', $first['id'])['is_current']);
    }

    public function test_school_admin_renames_a_year_and_invalid_dates_are_rejected(): void
    {
        $this->actingWithRole('school_admin');

        $year = $this->postJson('/api/v1/academic/years', [
            'title' => 'سال قدیم',
            'starts_on' => '2026-09-01',
            'ends_on' => '2027-06-20',
        ])->assertCreated()->json();

        $this->patchJson("/api/v1/academic/years/{$year['id']}", ['title' => '۱۴۰۵-۱۴۰۶'])
            ->assertOk()
            ->assertJsonPath('title', '۱۴۰۵-۱۴۰۶');

        $this->patchJson("/api/v1/academic/years/{$year['id']}", [
            'starts_on' => '2027-09-01',
            'ends_on' => '2027-06-20', // ends before it starts
        ])->assertStatus(422);
    }

    public function test_teacher_cannot_create_years_or_subjects(): void
    {
        $this->actingWithRole('teacher');

        $this->postJson('/api/v1/academic/years', ['title' => '۱۴۰۶-۱۴۰۷'])->assertForbidden();
        $this->postJson('/api/v1/academic/subjects', ['title' => 'شیمی'])->assertForbidden();
    }

    public function test_duplicate_subject_code_is_a_friendly_validation_error(): void
    {
        $this->actingWithRole('school_admin');

        $this->postJson('/api/v1/academic/subjects', ['title' => 'ریاضی', 'code' => 'MATH'])->assertCreated();

        $this->postJson('/api/v1/academic/subjects', ['title' => 'ریاضی ۲', 'code' => 'MATH'])
            ->assertStatus(422)
            ->assertJsonPath('errors.code.0', 'این کد درس قبلاً ثبت شده است.');
    }


    public function test_teacher_cannot_manage_academic_structure(): void
    {
        $this->actingWithRole('teacher');

        $this->postJson('/api/v1/academic/grade-levels', ['title' => 'دهم', 'order' => 10])
            ->assertForbidden();
        $this->postJson('/api/v1/academic/classrooms', [
            'title' => 'X', 'academic_year_id' => 1, 'grade_level_id' => 1,
        ])->assertForbidden();
    }

    public function test_teacher_sees_only_his_classrooms(): void
    {
        $teacher = $this->makeUser();
        $mine = $this->makeClassroom();
        $other = $this->makeClassroom();
        $this->assignTeacher($teacher, $mine);

        $this->actingWithRole('teacher', user: $teacher);

        $titles = collect($this->getJson('/api/v1/academic/classrooms')->assertOk()->json('data'))
            ->pluck('title');

        $this->assertContains($mine->title, $titles);
        $this->assertNotContains($other->title, $titles);
    }

    public function test_academic_deputy_assigns_subject_teacher(): void
    {
        $this->actingWithRole('academic_deputy');
        $classroom = $this->makeClassroom();
        $subject = $this->makeSubject();
        $teacher = $this->makeUser();

        $this->postJson("/api/v1/academic/classrooms/{$classroom->ulid}/subjects", [
            'subject_id' => $subject->id, 'teacher_ulid' => $teacher->ulid,
        ])->assertCreated();

        $this->assertDatabaseHas('classroom_subjects', [
            'classroom_id' => $classroom->id, 'subject_id' => $subject->id, 'teacher_id' => $teacher->id,
        ]);
    }

    public function test_office_manager_enrolls_student(): void
    {
        $this->actingWithRole('office_manager');
        $student = $this->makeStudent();
        $classroom = $this->makeClassroom();

        $this->postJson('/api/v1/academic/enrollments', [
            'student_ulid' => $student->ulid, 'classroom_ulid' => $classroom->ulid,
            'starts_on' => '2026-09-01',
        ])->assertCreated();

        // Duplicate active enrollment is rejected.
        $this->postJson('/api/v1/academic/enrollments', [
            'student_ulid' => $student->ulid, 'classroom_ulid' => $classroom->ulid,
            'starts_on' => '2026-09-01',
        ])->assertJsonValidationErrors('student_ulid');
    }

    public function test_enrollment_for_foreign_school_student_is_404(): void
    {
        $this->actingWithRole('office_manager');
        $classroom = $this->makeClassroom();

        $otherSchool = \DB::table('schools')->insertGetId([
            'ulid' => '01JOTHERSCHOOL000000000000', 'name' => 'مدرسه دوم', 'level' => 'high',
            'grading_type' => 'numeric', 'student_has_account' => true, 'timezone' => 'Asia/Tehran',
            'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $foreignUlid = '01JFOREIGNSTUDENT000000000';
        \DB::table('students')->insert([
            'ulid' => $foreignUlid, 'school_id' => $otherSchool,
            'student_code' => 'X2', 'first_name' => 'بیرونی', 'last_name' => 'غیرمجاز',
            'status' => 'active', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->postJson('/api/v1/academic/enrollments', [
            'student_ulid' => $foreignUlid, 'classroom_ulid' => $classroom->ulid,
            'starts_on' => '2026-09-01',
        ])->assertNotFound();
    }

    public function test_ending_enrollment_closes_membership(): void
    {
        $this->actingWithRole('office_manager');
        $student = $this->makeStudent();
        $classroom = $this->makeClassroom();
        $enrollment = $this->enroll($student, $classroom);

        $this->postJson("/api/v1/academic/enrollments/{$enrollment->id}/end", [
            'ends_on' => now()->toDateString(), 'status' => 'transferred',
        ])->assertOk()->assertJsonPath('status', 'transferred');
    }

    public function test_subject_can_be_edited_and_deleted_while_unused(): void
    {
        $this->actingWithRole('school_admin');
        $subject = $this->makeSubject();

        $this->patchJson("/api/v1/academic/subjects/{$subject->id}", ['title' => 'شیمی پیشرفته'])
            ->assertOk()
            ->assertJsonPath('title', 'شیمی پیشرفته');
        $this->assertDatabaseHas('subjects', ['id' => $subject->id, 'title' => 'شیمی پیشرفته']);

        $this->deleteJson("/api/v1/academic/subjects/{$subject->id}")->assertOk();
        $this->assertDatabaseMissing('subjects', ['id' => $subject->id]);
    }

    public function test_subject_assigned_to_a_classroom_cannot_be_deleted(): void
    {
        $this->actingWithRole('academic_deputy');
        $classroom = $this->makeClassroom();
        $subject = $this->makeSubject();
        $teacher = $this->makeUser();

        $this->postJson("/api/v1/academic/classrooms/{$classroom->ulid}/subjects", [
            'subject_id' => $subject->id, 'teacher_ulid' => $teacher->ulid,
        ])->assertCreated();

        $this->deleteJson("/api/v1/academic/subjects/{$subject->id}")
            ->assertStatus(422)
            ->assertJsonPath('errors.subject.0', 'این درس به کلاس‌ها تخصیص یافته است؛ نخست تخصیص آن را از کلاس‌ها حذف کنید.');

        $this->assertDatabaseHas('subjects', ['id' => $subject->id]);
    }
}
