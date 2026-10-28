<?php

namespace Tests\Feature\Modules;

use App\Modules\Grades\Models\GradeChange;
use App\Modules\Grades\Models\GradeItem;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class GradesFlowTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $teacher;

    private $classroom;

    private $student;

    private $guardianWithGrades;

    private $guardianWithoutGrades;

    private $termId;

    private $subjectId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();

        $this->teacher = $this->makeUser();
        $this->classroom = $this->makeClassroom();
        $this->subjectId = $this->assignTeacher($this->teacher, $this->classroom, $this->makeSubject())->id;

        $this->student = $this->makeStudent();
        $this->enroll($this->student, $this->classroom);

        $this->guardianWithGrades = $this->makeUser();
        $this->guardianWithoutGrades = $this->makeUser();
        $this->makeLink($this->guardianWithGrades, ['can_view_grades' => true]);
        $this->makeLink($this->guardianWithoutGrades, ['can_view_grades' => false]);

        $this->termId = $this->makeTerm()->id;
    }

    private function makeLink($guardian, array $flags): void
    {
        \App\Modules\People\Models\GuardianLink::query()->create([
            'guardian_user_id' => $guardian->id,
            'student_id' => $this->student->id,
            'link_type' => 'primary', 'status' => 'active', 'approved_at' => now(),
            ...$flags,
        ]);
    }

    private function recordDraft(): GradeItem
    {
        $this->actingWithRole('teacher', user: $this->teacher);

        $this->postJson('/api/v1/grades', [
            'student_ulid' => $this->student->ulid,
            'classroom_subject_id' => $this->subjectId,
            'term_id' => $this->termId,
            'score' => 92,
            'source_type' => 'in_person_exam',
            'delivery' => 'in_person',
        ])->assertCreated();

        return GradeItem::query()->first();
    }

    public function test_full_workflow_draft_approve_publish_with_versions(): void
    {
        $item = $this->recordDraft();
        $this->assertSame('draft', $item->status);

        // Students/guardians see NOTHING before publication.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $this->guardianWithGrades);
        $this->getJson('/api/v1/grades')->assertOk()->assertJsonCount(0, 'data');

        // Deputy approves; admin publishes (in-person report card).
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('academic_deputy');
        $this->postJson("/api/v1/grades/{$item->id}/approve")->assertOk()->assertJsonPath('status', 'approved');

        $this->postJson('/api/v1/report-cards/publish', [
            'student_ulid' => $this->student->ulid,
            'term_id' => $this->termId,
            'kind' => 'in_person',
        ])->assertCreated()->assertJsonPath('version', 1);

        // The published item is now visible to the flagged guardian only.
        $this->app['auth']->forgetGuards();

        $this->actingWithRole('guardian', user: $this->guardianWithGrades);
        $this->getJson('/api/v1/grades')->assertOk()->assertJsonCount(1, 'data');

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $this->guardianWithoutGrades);
        $this->getJson('/api/v1/grades')->assertOk()->assertJsonCount(0, 'data');

        // A second publish supersedes v1.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin');
        $card2 = $this->postJson('/api/v1/report-cards/publish', [
            'student_ulid' => $this->student->ulid,
            'term_id' => $this->termId,
            'kind' => 'in_person',
        ]);
        // No NEW approved items → nothing to publish (still only v1 exists).
        $card2->assertJsonValidationErrors('items');

        $this->assertSame(1, \App\Modules\Grades\Models\ReportCard::query()->count());
    }

    public function test_published_grade_change_requires_reason_and_is_append_only(): void
    {
        $item = $this->recordDraft();
        $this->actingWithRole('academic_deputy');
        $this->postJson("/api/v1/grades/{$item->id}/approve")->assertOk();

        $this->actingWithRole('school_admin');
        $this->postJson('/api/v1/report-cards/publish', [
            'student_ulid' => $this->student->ulid, 'term_id' => $this->termId, 'kind' => 'in_person',
        ])->assertCreated();

        $published = GradeItem::query()->first();

        // Without reason → rejected.
        $this->postJson("/api/v1/grades/{$published->id}/change", ['score' => 88])
            ->assertJsonValidationErrors('reason');

        $this->postJson("/api/v1/grades/{$published->id}/change", [
            'score' => 88, 'reason' => 'اصلاح بر اساس برگه بازبینی‌شده',
        ])->assertOk();

        $this->assertDatabaseHas('grade_changes', [
            'grade_item_id' => $published->id, 'old_score' => 92, 'new_score' => 88,
        ]);

        // The history table is append-only at the DB level too.
        $this->expectException(QueryException::class);
        DB::table('grade_changes')->update(['reason' => 'tampered']);
    }
}
