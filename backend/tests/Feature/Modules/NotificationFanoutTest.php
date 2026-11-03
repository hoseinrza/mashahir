<?php

namespace Tests\Feature\Modules;

use App\Modules\Notifications\Models\Notification;
use App\Modules\People\Models\GuardianLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * Personal events ring personal bells: publishing an exam or defining an
 * assignment notifies the classroom's learners in their own bell, and a new
 * trip consent reaches every active guardian link of that learner.
 */
class NotificationFanoutTest extends TestCase
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

    private function learnerWithAccount(): array
    {
        $student = $this->makeStudent();
        $user = $this->makeUser();
        $student->forceFill(['user_id' => $user->id])->save();
        $this->enroll($student, $this->classroom);

        return [$student, $user];
    }

    public function test_publishing_an_exam_notifies_the_classroom_learners(): void
    {
        [$studentA, $userA] = $this->learnerWithAccount();
        [$studentB] = $this->learnerWithAccount();

        $this->actingWithRole('teacher', user: $this->teacher);
        $exam = $this->postJson('/api/v1/exams', [
            'classroom_subject_id' => $this->subjectId,
            'title' => 'آزمون میان‌ترم فیزیک',
            'opens_at' => now()->subMinutes(5)->toIso8601String(),
            'closes_at' => now()->addHours(2)->toIso8601String(),
            'duration_minutes' => 30,
            'result_visibility' => 'after_grading',
            'questions' => [
                ['type' => 'mcq', 'body' => '۲+۲؟', 'points' => 2,
                 'options' => ['۳', '۴', '۵'], 'correct_position' => 2],
                ['type' => 'descriptive', 'body' => 'قضیهٔ فیثاغورس را اثبات کنید.', 'points' => 3],
            ],
        ])->assertCreated()->json();

        $this->postJson("/api/v1/exams/{$exam['ulid']}/publish")->assertOk();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $userA->id,
            'student_id' => $studentA->id,
            'type' => 'exam.published',
            'link' => '/exams',
        ]);
        // The school auto-creates an account per learner, so every classmate
        // gets a personal reminder — one personal bell each, no shared board.
        $this->assertSame(2, Notification::query()->where('type', 'exam.published')->count());
        $this->assertDatabaseHas('notifications', [
            'user_id' => $userA->id,
            'student_id' => $studentA->id,
            'type' => 'exam.published',
            'link' => '/exams',
        ]);
    }

    public function test_creating_an_assignment_notifies_the_classroom_learners(): void
    {
        [$student, $user] = $this->learnerWithAccount();

        $this->actingWithRole('teacher', user: $this->teacher);
        $this->postJson('/api/v1/assignments', [
            'classroom_subject_id' => $this->subjectId,
            'title' => 'گزارش آزمایش آونگ',
            'due_at' => now()->addDays(3)->toIso8601String(),
        ])->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'student_id' => $student->id,
            'type' => 'assignment.created',
            'link' => '/assignments',
        ]);
    }

    public function test_a_new_trip_consent_reaches_the_guardians_of_that_learner(): void
    {
        [$student, $studentUser] = $this->learnerWithAccount();
        $guardian = $this->makeUser();
        GuardianLink::query()->create([
            'guardian_user_id' => $guardian->id,
            'student_id' => $student->id,
            'link_type' => 'primary',
            'status' => 'active',
            'approved_at' => now(),
            'can_approve_consent' => true,
        ]);
        $stranger = $this->makeUser(); // a guardian with no link to this learner

        $this->actingWithRole('school_admin');
        $this->postJson('/api/v1/consents', [
            'student_ulid' => $student->ulid,
            'title' => 'رضایت‌نامهٔ اردوی شمال',
            'body' => 'اردوی یک‌روزهٔ علمی — حرکت با اتوبوس مدرسه',
            'due_at' => now()->addDays(4)->toIso8601String(),
        ])->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $guardian->id,
            'student_id' => $student->id,
            'type' => 'consent.request',
            'link' => '/consent-forms',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $stranger->id,
            'type' => 'consent.request',
        ]);
        // the learner's own bell is not the guardians' channel
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $studentUser->id,
            'type' => 'consent.request',
        ]);
    }
}
