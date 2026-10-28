<?php

namespace Tests\Feature\Modules;

use App\Modules\Exams\Models\AttemptAnswer;
use App\Modules\Exams\Models\Exam;
use App\Modules\Exams\Models\ExamAttempt;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class ExamsFlowTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $teacher;

    private $classroom;

    private $studentUser;

    private $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();

        $this->teacher = $this->makeUser();
        $this->classroom = $this->makeClassroom();
        $subjectId = $this->assignTeacher($this->teacher, $this->classroom, $this->makeSubject())->id;

        $this->student = $this->makeStudent();
        $this->studentUser = $this->makeUser();
        $this->student->forceFill(['user_id' => $this->studentUser->id])->save();
        $this->enroll($this->student, $this->classroom);

        $this->actingWithRole('teacher', user: $this->teacher);
        $this->exam = $this->postJson('/api/v1/exams', $this->examPayload($subjectId))->assertCreated()->json();
        $this->postJson("/api/v1/exams/{$this->exam['ulid']}/publish")->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $this->studentUser);
    }

    private function examPayload(int $subjectId): array
    {
        return [
            'classroom_subject_id' => $subjectId,
            'title' => 'آزمون میان‌ترم ریاضی',
            'opens_at' => now()->subMinutes(5)->toIso8601String(),
            'closes_at' => now()->addHours(2)->toIso8601String(),
            'duration_minutes' => 30,
            'result_visibility' => 'after_grading',
            'questions' => [
                ['type' => 'mcq', 'body' => '۲+۲؟', 'points' => 2,
                 'options' => ['۳', '۴', '۵'], 'correct_position' => 2],
                ['type' => 'descriptive', 'body' => 'قضیه فیثاغورس را اثبات کنید.', 'points' => 3],
            ],
        ];
    }

    public function test_start_resume_submit_with_mcq_autoscore(): void
    {
        $first = $this->postJson("/api/v1/exams/{$this->exam['ulid']}/start")->assertOk()->json();
        $this->assertSame('in_progress', $first['status']);

        // FR-21: re-entry resumes the SAME attempt.
        $second = $this->postJson("/api/v1/exams/{$this->exam['ulid']}/start")->assertOk()->json();
        $this->assertSame($first['attempt_id'], $second['attempt_id']);

        // FR-17: autosave with versioning; a stale version is rejected.
        $question = $this->getJson("/api/v1/exams/{$this->exam['ulid']}")->json('questions.0');
        $mcqId = $question['id'];
        $firstOptionId = $question['options'][0]['id'];
        $correctOptionId = $question['options'][1]['id']; // correct_position = 2

        $this->postJson("/api/v1/exams/attempts/{$first['attempt_id']}/answers", [
            'question_id' => $mcqId, 'option_id' => $firstOptionId, 'version' => 1,
        ])->assertOk()->assertJsonPath('accepted', true);

        // Same version again → stale, server state wins.
        $this->postJson("/api/v1/exams/attempts/{$first['attempt_id']}/answers", [
            'question_id' => $mcqId, 'option_id' => $firstOptionId, 'version' => 1,
        ])->assertOk()->assertJsonPath('accepted', false);

        // An option from another question is a friendly 422, never a 500.
        $this->postJson("/api/v1/exams/attempts/{$first['attempt_id']}/answers", [
            'question_id' => $mcqId, 'option_id' => 999999, 'version' => 2,
        ])->assertJsonValidationErrors('option_id');

        $this->postJson("/api/v1/exams/attempts/{$first['attempt_id']}/answers", [
            'question_id' => $mcqId, 'option_id' => $correctOptionId, 'version' => 3,
        ])->assertOk()->assertJsonPath('accepted', true);

        $submitted = $this->postJson("/api/v1/exams/attempts/{$first['attempt_id']}/submit")->assertOk()->json();
        $this->assertSame(2, $submitted['auto_score'], 'MCQ auto-score must count the correct option (2 points)');

        // sh6: after_grading visibility → hidden until released.
        $this->getJson("/api/v1/exams/{$this->exam['ulid']}/result")
            ->assertOk()->assertJsonPath('visible', false);
    }

    public function test_visibility_immediately_and_release(): void
    {
        // immediately → visible right after submit.
        $subjectId = \App\Modules\Academic\Models\ClassroomSubject::query()
            ->where('classroom_id', $this->classroom->id)->value('id');

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacher);
        $payload = $this->examPayload($subjectId);
        $payload['title'] = 'آزمون فوری';
        $payload['result_visibility'] = 'immediately';
        $immediate = $this->postJson('/api/v1/exams', $payload)->assertCreated()->json();
        $this->postJson("/api/v1/exams/{$immediate['ulid']}/publish")->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $this->studentUser);

        $attempt = $this->postJson("/api/v1/exams/{$immediate['ulid']}/start")->assertOk()->json();
        $this->postJson("/api/v1/exams/attempts/{$attempt['attempt_id']}/submit")->assertOk();

        $this->getJson("/api/v1/exams/{$immediate['ulid']}/result")
            ->assertOk()->assertJsonPath('visible', true);

        // after_grading → visible only after release (sh6 manual release).
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacher);
        Exam::query()->where('ulid', $this->exam['ulid'])->first()
            ->forceFill(['results_released_at' => now()])->save();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $this->studentUser);
        $this->getJson("/api/v1/exams/{$this->exam['ulid']}/result")
            ->assertOk()->assertJsonPath('visible', true);
    }

    public function test_descriptive_grading_by_assigned_corrector_only_sh5(): void
    {
        $attempt = $this->postJson("/api/v1/exams/{$this->exam['ulid']}/start")->assertOk()->json();

        // Answer the descriptive question before submitting.
        $descriptiveId = $this->getJson("/api/v1/exams/{$this->exam['ulid']}")->json('questions.1.id');
        $this->postJson("/api/v1/exams/attempts/{$attempt['attempt_id']}/answers", [
            'question_id' => $descriptiveId, 'text' => 'اثبات به روش مربع‌ها', 'version' => 1,
        ])->assertOk();

        $this->postJson("/api/v1/exams/attempts/{$attempt['attempt_id']}/submit")->assertOk();

        $answer = AttemptAnswer::query()->where('attempt_id', $attempt['attempt_id'])->first();
        $exam = Exam::query()->where('ulid', $this->exam['ulid'])->first();

        // An UNASSIGNED corrector → 404 (sh5).
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('corrector');
        $corrector = $this->actor;
        $this->postJson("/api/v1/exams/answers/{$answer->id}/grade", ['score' => 2])
            ->assertNotFound();

        // The exam's teacher (exams.manage) assigns the corrector → allowed.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacher);
        $exam = Exam::query()->where('ulid', $this->exam['ulid'])->first();
        $this->postJson("/api/v1/exams/{$exam->ulid}/correctors", ['user_ulid' => $corrector->ulid])->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('corrector', user: $corrector);
        $this->postJson("/api/v1/exams/answers/{$answer->id}/grade", [
            'score' => 5, // > points 3
        ])->assertJsonValidationErrors('score');

        $this->postJson("/api/v1/exams/answers/{$answer->id}/grade", [
            'score' => 3, 'comment' => 'اثبات کامل',
        ])->assertOk()->assertJsonPath('score', 3);
    }

    public function test_server_deadline_expires_the_attempt(): void
    {
        $attempt = $this->postJson("/api/v1/exams/{$this->exam['ulid']}/start")->assertOk()->json();

        ExamAttempt::query()->whereKey($attempt['attempt_id'])
            ->update(['server_deadline' => now()->subMinute()]);

        $this->postJson("/api/v1/exams/attempts/{$attempt['attempt_id']}/answers", [
            'question_id' => 1, 'version' => 1,
        ])->assertJsonValidationErrors('attempt');
    }
}
