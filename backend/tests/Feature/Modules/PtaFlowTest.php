<?php

namespace Tests\Feature\Modules;

use App\Modules\People\Models\GuardianLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * انجمن اولیا: جلسه با صورت‌جلسه و نظرسنجی با سیاست ضدتکرار رأی.
 */
class PtaFlowTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
    }

    public function test_an_admin_opens_a_meeting_and_a_guardian_reads_it(): void
    {
        $this->actingWithRole('school_admin');

        $this->postJson('/api/v1/pta/meetings', [
            'title' => 'جلسهٔ آبان انجمن اولیا',
            'held_at' => now()->addDays(3)->toIso8601String(),
            'location' => 'سالن اجتماعات',
            'agenda' => ['بررسی بودجهٔ اردوها', 'انتخاب نمایندهٔ پایه دهم'],
        ])->assertCreated()->assertJsonPath('status', 'upcoming');

        $guardian = $this->makeUser();
        $student = $this->makeStudent();
        $this->linkGuardian($guardian, $student);

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $guardian);

        $rows = $this->getJson('/api/v1/pta/meetings')->assertOk()->json('data');

        $this->assertCount(1, $rows);
        $this->assertSame('جلسهٔ آبان انجمن اولیا', $rows[0]['title']);
        $this->assertCount(2, $rows[0]['agenda']);
    }

    public function test_a_guardian_votes_once_and_the_counts_are_honest(): void
    {
        $surveyUlid = $this->createSurvey('per_guardian');

        $first = $this->makeUser();
        $this->linkGuardian($first, $this->makeStudent());

        $this->actingWithRole('guardian', user: $first);

        $this->postJson("/api/v1/pta/surveys/{$surveyUlid}/vote", ['option_id' => 'a'])
            ->assertOk()
            ->assertJsonPath('total_votes', 1)
            ->assertJsonPath('my_vote', 'a');

        // Second ballot from the same account is refused.
        $this->postJson("/api/v1/pta/surveys/{$surveyUlid}/vote", ['option_id' => 'b'])
            ->assertStatus(422);

        // Another guardian's ballot counts independently.
        $second = $this->makeUser();
        $this->linkGuardian($second, $this->makeStudent());

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $second);

        $this->postJson("/api/v1/pta/surveys/{$surveyUlid}/vote", ['option_id' => 'b'])
            ->assertOk()
            ->assertJsonPath('total_votes', 2);
    }

    public function test_per_family_policy_allows_one_ballot_per_family(): void
    {
        $surveyUlid = $this->createSurvey('per_family');

        $student = $this->makeStudent();
        $mother = $this->makeUser();
        $father = $this->makeUser();
        $this->linkGuardian($mother, $student);
        $this->linkGuardian($father, $student, 'second');

        $this->actingWithRole('guardian', user: $mother);
        $this->postJson("/api/v1/pta/surveys/{$surveyUlid}/vote", ['option_id' => 'a'])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $father);

        $this->postJson("/api/v1/pta/surveys/{$surveyUlid}/vote", ['option_id' => 'b'])
            ->assertStatus(422);
    }

    public function test_a_teacher_cannot_vote(): void
    {
        $surveyUlid = $this->createSurvey('per_guardian');

        $this->actingWithRole('teacher');

        $this->postJson("/api/v1/pta/surveys/{$surveyUlid}/vote", ['option_id' => 'a'])
            ->assertForbidden();
    }

    private function createSurvey(string $policy): string
    {
        $this->actingWithRole('school_admin');

        return $this->postJson('/api/v1/pta/surveys', [
            'title' => 'نظرسنجی ساعت شروع کلاس‌ها',
            'options' => [
                ['id' => 'a', 'text' => 'هفت و سی دقیقه'],
                ['id' => 'b', 'text' => 'هشت صبح'],
            ],
            'policy' => $policy,
        ])->assertCreated()->json('ulid');
    }

    private function linkGuardian($guardian, $student, string $type = 'primary'): void
    {
        GuardianLink::query()->create([
            'guardian_user_id' => $guardian->id,
            'student_id' => $student->id,
            'link_type' => $type,
            'can_view_grades' => true,
            'can_view_attendance' => true,
            'can_approve_consent' => true,
            'can_pickup' => true,
            'can_receive_sms' => true,
            'status' => 'active',
        ]);
    }
}
