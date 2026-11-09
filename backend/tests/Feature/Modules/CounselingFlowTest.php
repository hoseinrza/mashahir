<?php

namespace Tests\Feature\Modules;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * مشاوره: درخواست دانش‌آموز، زمان‌بندی مشاور و محرمانگی یادداشت.
 */
class CounselingFlowTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $studentUser;

    private $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();

        $this->studentUser = $this->makeUser();
        $this->student = $this->makeStudent();
        $this->student->forceFill(['user_id' => $this->studentUser->id])->save();
    }

    public function test_a_learner_books_a_session_and_the_counselor_completes_it(): void
    {
        $this->actingWithRole('student', user: $this->studentUser);

        $ulid = $this->postJson('/api/v1/counseling/appointments', [
            'student_ulid' => $this->student->ulid,
            'topic' => 'اضطراب پیش از آزمون',
            'type' => 'online',
        ])->assertCreated()->json('ulid');

        $this->assertDatabaseHas('counseling_appointments', ['ulid' => $ulid, 'status' => 'requested']);

        $counselor = $this->makeUser();
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('support', user: $counselor);

        $this->patchJson("/api/v1/counseling/appointments/{$ulid}", [
            'counselor_ulid' => $counselor->ulid,
            'scheduled_at' => now()->addDay()->toIso8601String(),
            'status' => 'scheduled',
            'shared_summary' => 'جلسهٔ اول برگزار شد؛ تمرین تنفس پیشنهاد شد.',
            'confidential_notes' => 'یادداشت محرمانهٔ مشاور.',
        ])->assertOk()->assertJsonPath('status', 'scheduled');

        // The learner reads the shared summary, never the confidential note.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $this->studentUser);

        $rows = $this->getJson('/api/v1/counseling/appointments')->assertOk()->json('data');

        $this->assertCount(1, $rows);
        $this->assertSame('جلسهٔ اول برگزار شد؛ تمرین تنفس پیشنهاد شد.', $rows[0]['shared_summary']);
        $this->assertNull($rows[0]['confidential_notes']);
    }

    public function test_a_learner_cannot_book_for_another_learner(): void
    {
        $this->actingWithRole('student', user: $this->studentUser);

        $other = $this->makeStudent();

        $this->postJson('/api/v1/counseling/appointments', [
            'student_ulid' => $other->ulid,
            'topic' => 'درخواست غیرمجاز',
        ])->assertNotFound();
    }

    public function test_another_learner_sees_an_empty_bench(): void
    {
        $this->actingWithRole('student', user: $this->studentUser);
        $this->postJson('/api/v1/counseling/appointments', [
            'student_ulid' => $this->student->ulid,
            'topic' => 'موضوع من',
        ])->assertCreated();

        $otherUser = $this->makeUser();
        $otherStudent = $this->makeStudent();
        $otherStudent->forceFill(['user_id' => $otherUser->id])->save();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $otherUser);

        $rows = $this->getJson('/api/v1/counseling/appointments')->assertOk()->json('data');
        $this->assertCount(0, $rows);
    }

    public function test_a_guardian_books_only_for_his_linked_child(): void
    {
        $guardian = $this->makeUser();

        $linked = $this->makeStudent();
        $this->linkGuardian($guardian, $linked);

        $this->actingWithRole('guardian', user: $guardian);

        $this->postJson('/api/v1/counseling/appointments', [
            'student_ulid' => $linked->ulid,
            'topic' => 'نگرانی تحصیلی فرزند',
        ])->assertCreated();

        $stranger = $this->makeStudent();

        $this->postJson('/api/v1/counseling/appointments', [
            'student_ulid' => $stranger->ulid,
            'topic' => 'کودک دیگر',
        ])->assertNotFound();
    }

    private function linkGuardian($guardian, $student): void
    {
        \App\Modules\People\Models\GuardianLink::query()->create([
            'guardian_user_id' => $guardian->id,
            'student_id' => $student->id,
            'link_type' => 'primary',
            'can_view_grades' => true,
            'can_view_attendance' => true,
            'can_approve_consent' => true,
            'can_pickup' => true,
            'can_receive_sms' => true,
            'status' => 'active',
        ]);
    }
}
