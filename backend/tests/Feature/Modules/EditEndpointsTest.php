<?php

namespace Tests\Feature\Modules;

use App\Modules\Assignments\Models\Assignment;
use App\Modules\Grades\Models\GradeItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * «هر چیزی که ایجاد می‌شود قابل ادیت است» — every created entity has an
 * edit path, guarded by the same matrix permissions and scope rules as its
 * create endpoint, and frozen only where the workflow demands it
 * (published exams / published grades).
 */
class EditEndpointsTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $teacher;

    private $classroom;

    private $subjectId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();

        $this->teacher = $this->makeUser();
        $this->classroom = $this->makeClassroom();
        $this->subjectId = $this->assignTeacher($this->teacher, $this->classroom, $this->makeSubject())->id;
    }

    public function test_assignment_is_editable_by_its_teacher_only(): void
    {
        $this->actingWithRole('teacher', user: $this->teacher);
        $ulid = $this->postJson('/api/v1/assignments', [
            'classroom_subject_id' => $this->subjectId,
            'title' => 'نسخه اول', 'due_at' => now()->addDays(2)->toIso8601String(),
        ])->assertCreated()->json('ulid');

        $this->patchJson("/api/v1/assignments/{$ulid}", [
            'title' => 'نسخه ویرایش‌شده', 'max_score' => 50,
        ])->assertOk()->assertJsonPath('title', 'نسخه ویرایش‌شده')
            ->assertJsonPath('max_score', 50);

        $this->assertDatabaseHas('assignments', ['ulid' => $ulid, 'max_score' => 50]);

        // Another teacher's scope never sees this assignment.
        $other = $this->makeUser();
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $other);
        $this->patchJson("/api/v1/assignments/{$ulid}", ['title' => 'X'])->assertNotFound();
    }

    public function test_exam_is_editable_only_in_draft_and_questions_replaceable(): void
    {
        $this->actingWithRole('teacher', user: $this->teacher);
        $ulid = $this->postJson('/api/v1/exams', [
            'classroom_subject_id' => $this->subjectId,
            'title' => 'پیش‌نویس آزمون', 'opens_at' => now()->addDay()->toIso8601String(),
            'closes_at' => now()->addDays(2)->toIso8601String(),
            'duration_minutes' => 20, 'result_visibility' => 'after_grading',
            'questions' => [
                ['type' => 'mcq', 'body' => 'س۱', 'points' => 1, 'options' => ['الف', 'ب'], 'correct_position' => 1],
            ],
        ])->assertCreated()->json('ulid');

        $this->patchJson("/api/v1/exams/{$ulid}", ['title' => 'عنوان جدید', 'duration_minutes' => 45])
            ->assertOk();

        $this->putJson("/api/v1/exams/{$ulid}/questions", [
            'questions' => [
                ['type' => 'descriptive', 'body' => 'سع جدید', 'points' => 4],
                ['type' => 'mcq', 'body' => 'س۲', 'points' => 2, 'options' => ['۱', '۲', '۳'], 'correct_position' => 3],
            ],
        ])->assertOk()->assertJsonPath('questions', 2);

        // Published → frozen.
        $this->postJson("/api/v1/exams/{$ulid}/publish")->assertOk();

        $this->patchJson("/api/v1/exams/{$ulid}", ['title' => 'X'])
            ->assertJsonValidationErrors('status');
        $this->putJson("/api/v1/exams/{$ulid}/questions", [
            'questions' => [['type' => 'mcq', 'body' => 'X', 'options' => ['الف', 'ب'], 'correct_position' => 1]],
        ])->assertJsonValidationErrors('status');
    }

    public function test_draft_grade_edit_returns_approved_items_to_draft(): void
    {
        $this->actingWithRole('teacher', user: $this->teacher);
        $student = $this->makeStudent();
        $termId = $this->makeTerm()->id;

        $itemId = $this->postJson('/api/v1/grades', [
            'student_ulid' => $student->ulid, 'classroom_subject_id' => $this->subjectId,
            'term_id' => $termId, 'score' => 70, 'source_type' => 'manual', 'delivery' => 'in_person',
        ])->assertCreated()->json('id');

        $this->patchJson("/api/v1/grades/{$itemId}", ['score' => 85])
            ->assertOk()->assertJsonPath('score', 85);

        // Approve → edit → back to draft for re-approval.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('academic_deputy');
        $this->postJson("/api/v1/grades/{$itemId}/approve")->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacher);
        $this->patchJson("/api/v1/grades/{$itemId}", ['score' => 90])
            ->assertOk()->assertJsonPath('status', 'draft');

        $this->assertDatabaseHas('grade_items', ['id' => $itemId, 'status' => 'draft', 'approved_by' => null]);
    }

    public function test_consent_announcement_and_court_order_are_editable(): void
    {
        $student = $this->makeStudent();

        $this->actingWithRole('school_admin');
        $consentUlid = $this->postJson('/api/v1/consents', [
            'student_ulid' => $student->ulid, 'title' => 'اردو', 'policy' => 'one_parent',
        ])->assertCreated()->json('ulid');

        $this->patchJson("/api/v1/consents/{$consentUlid}", [
            'title' => 'اردوی دو روزه', 'due_at' => now()->addDays(7)->toIso8601String(),
        ])->assertOk()->assertJsonPath('title', 'اردوی دو روزه');

        $announcementUlid = $this->postJson('/api/v1/announcements', [
            'title' => 'اطلاعیه اول', 'body' => 'متن اول', 'importance' => 'info',
        ])->assertCreated()->json('ulid');

        $this->patchJson("/api/v1/announcements/{$announcementUlid}", [
            'title' => 'اطلاعیه ویرایش‌شده', 'importance' => 'important',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', ['action' => 'announcement.updated']);

        $orderId = $this->postJson('/api/v1/court-orders', [
            'student_ulid' => $student->ulid,
            'restrictions' => ['can_pickup' => false],
            'reason' => 'حکم اولیه',
        ])->assertCreated()->json('id');

        // sh7: no reason → rejected; with reason → edited + audited.
        $this->patchJson("/api/v1/court-orders/{$orderId}", ['restrictions' => ['can_pickup' => true]])
            ->assertJsonValidationErrors('reason');

        $this->patchJson("/api/v1/court-orders/{$orderId}", [
            'restrictions' => ['can_pickup' => true], 'reason' => 'حکم بدل به ابلاغ دادگاه',
        ])->assertOk()->assertJsonPath('restrictions.can_pickup', true);

        $this->assertDatabaseHas('audit_logs', ['action' => 'court_order.updated']);
    }

    public function test_timetable_and_grade_level_edits_detect_duplicates(): void
    {
        $this->actingWithRole('academic_deputy');
        $slotId = $this->postJson('/api/v1/timetable', [
            'classroom_subject_id' => $this->subjectId, 'weekday' => 1, 'period' => 1,
            'starts_at' => '08:00', 'ends_at' => '09:30',
        ])->assertCreated()->json('id');

        $this->patchJson("/api/v1/timetable/{$slotId}", [
            'starts_at' => '08:30', 'ends_at' => '10:00',
        ])->assertOk()->assertJsonPath('starts_at', '08:30');

        $this->postJson('/api/v1/timetable', [
            'classroom_subject_id' => $this->subjectId, 'weekday' => 1, 'period' => 2,
            'starts_at' => '10:00', 'ends_at' => '11:00',
        ])->assertCreated();

        // Move slot 1 onto slot 2's period → duplicate error.
        $this->patchJson("/api/v1/timetable/{$slotId}", ['period' => 2])
            ->assertJsonValidationErrors('period');

        // makeClassroom() already created order 10 in setUp — use a fresh one.
        $this->postJson('/api/v1/academic/grade-levels', ['title' => 'یازدهم', 'order' => 11])->assertCreated();
        $gradeId = \DB::table('grade_levels')->where('order', 11)->value('id');

        $this->patchJson("/api/v1/academic/grade-levels/{$gradeId}", ['order' => 10])
            ->assertJsonValidationErrors('order');

        $this->patchJson("/api/v1/academic/grade-levels/{$gradeId}", ['title' => 'پایه دهم'])
            ->assertOk();
    }
}
