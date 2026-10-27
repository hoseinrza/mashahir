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
}
