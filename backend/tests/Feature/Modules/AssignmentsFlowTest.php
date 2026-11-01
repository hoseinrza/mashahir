<?php

namespace Tests\Feature\Modules;

use App\Modules\Assignments\Models\Submission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class AssignmentsFlowTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $teacher;

    private $classroom;

    private $studentUser;

    private $student;

    private $guardian;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();

        $this->teacher = $this->makeUser();
        $this->classroom = $this->makeClassroom();
        $this->assignTeacher($this->teacher, $this->classroom, $this->makeSubject());

        $this->student = $this->makeStudent();
        $this->studentUser = $this->makeUser();
        $this->student->forceFill(['user_id' => $this->studentUser->id])->save();
        $this->enroll($this->student, $this->classroom);

        $this->guardian = $this->makeUser();
        \App\Modules\People\Models\GuardianLink::query()->create([
            'guardian_user_id' => $this->guardian->id,
            'student_id' => $this->student->id,
            'link_type' => 'primary', 'status' => 'active', 'approved_at' => now(),
        ]);
    }

    private function createAssignment(string $dueOffset = '+2 days'): array
    {
        $this->actingWithRole('teacher', user: $this->teacher);

        $subjectId = \App\Modules\Academic\Models\ClassroomSubject::query()
            ->where('classroom_id', $this->classroom->id)->value('id');

        return $this->postJson('/api/v1/assignments', [
            'classroom_subject_id' => $subjectId,
            'title' => 'تم ریاضی فصل ۱',
            'description' => 'تمرین‌های ۱ تا ۵',
            'due_at' => now()->modify($dueOffset)->toIso8601String(),
        ])->assertCreated()->json();
    }

    public function test_teacher_creates_for_own_class_only(): void
    {
        $assignment = $this->createAssignment();
        $this->assertNotEmpty($assignment['ulid']);

        // A foreign classroom subject → 404 for this teacher (sh2).
        $other = $this->makeClassroom();
        $otherSubjectId = \App\Modules\Academic\Models\ClassroomSubject::query()
            ->create(['school_id' => $this->school->id, 'classroom_id' => $other->id, 'subject_id' => $this->makeSubject()->id])->id;

        $this->postJson('/api/v1/assignments', [
            'classroom_subject_id' => $otherSubjectId,
            'title' => 'X', 'due_at' => now()->addDay()->toIso8601String(),
        ])->assertNotFound();
    }

    public function test_student_submits_on_time_and_late(): void
    {
        $assignment = $this->createAssignment();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $this->studentUser);

        $this->postJson("/api/v1/assignments/{$assignment['ulid']}/submissions", [
            'text' => 'پاسخ تمرین‌ها...',
        ])->assertCreated()->assertJsonPath('status', 'submitted');

        // After the deadline the same student resubmits → late.
        $this->travel(3)->days();
        $this->postJson("/api/v1/assignments/{$assignment['ulid']}/submissions", [
            'text' => 'پاسخ دیرهنگام',
        ])->assertCreated()->assertJsonPath('status', 'late');
    }

    public function test_teacher_grades_and_guardian_sees_readonly(): void
    {
        $assignment = $this->createAssignment();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $this->studentUser);
        $this->postJson("/api/v1/assignments/{$assignment['ulid']}/submissions", ['text' => 'پاسخ'])
            ->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacher);

        $submissionId = Submission::query()->value('id');

        $this->postJson("/api/v1/submissions/{$submissionId}/grade", [
            'score' => 1000, // > max_score 100
        ])->assertJsonValidationErrors('score');

        $this->postJson("/api/v1/submissions/{$submissionId}/grade", [
            'score' => 85, 'feedback' => 'خوب بود',
        ])->assertOk()->assertJsonPath('status', 'graded');

        // Guardian views read-only (submissions.view ش۳).
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $this->guardian);

        $row = collect($this->getJson("/api/v1/assignments/{$assignment['ulid']}/submissions")->assertOk()->json('data'))->first();

        $this->assertSame('graded', $row['status']);
        $this->assertSame(85, $row['score']);
        $this->assertSame('خوب بود', $row['feedback']);
    }

    public function test_submissions_endpoint_embeds_assignment_attachments(): void
    {
        $assignment = $this->createAssignment();

        $file = \App\Modules\Files\Models\File::query()->create([
            'school_id' => $this->school->id,
            'disk' => 'local',
            'path' => 'schools/1/files/demo-sheet.pdf',
            'original_name' => 'برگه سؤالات.pdf',
            'mime' => 'application/pdf',
            'size' => 128,
            'checksum' => hash('sha256', 'demo'),
            'uploaded_by' => $this->teacher->id,
        ]);

        \App\Modules\Assignments\Models\Assignment::query()
            ->where('ulid', $assignment['ulid'])
            ->firstOrFail()
            ->files()->attach($file->id);

        // The embedded assignment must carry its attachments even though the
        // route does not eager-load the relation.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacher);

        $this->getJson("/api/v1/assignments/{$assignment['ulid']}/submissions")
            ->assertOk()
            ->assertJsonPath('assignment.files.0.original_name', 'برگه سؤالات.pdf');
    }
}
