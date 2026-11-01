<?php

namespace Tests\Feature\Modules;

use App\Modules\OnlineClasses\Models\OnlineClass;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * کلاس آنلاین بر بستر اسکای‌روم با درایور fake — جریان کامل معلم و دانش‌آموز.
 */
class OnlineClassesTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $teacher;

    private $subjectId;

    private $studentUser;

    private $classroom;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();

        $this->teacher = $this->makeUser();
        $this->classroom = $this->makeClassroom();
        $this->subjectId = $this->assignTeacher($this->teacher, $this->classroom, $this->makeSubject())->id;

        $this->studentUser = $this->makeUser();
        $student = $this->makeStudent();
        $student->forceFill(['user_id' => $this->studentUser->id])->save();
        $this->enroll($student, $this->classroom);
    }

    public function test_teacher_creates_class_and_students_get_entry_urls(): void
    {
        $this->actingWithRole('teacher', user: $this->teacher);

        $ulid = $this->postJson('/api/v1/online-classes', [
            'classroom_subject_id' => $this->subjectId,
            'title' => 'کلاس آنلاین ریاضی — فصل ۲',
        ])->assertCreated()->json('ulid');

        $this->assertDatabaseHas('online_classes', ['ulid' => $ulid, 'status' => 'active']);
        $this->assertNotNull(OnlineClass::query()->where('ulid', $ulid)->value('skyroom_room_id'));

        // The teacher gets a PRESENTER link (access=2).
        $enter = $this->getJson("/api/v1/online-classes/{$ulid}/enter")->assertOk()->json('url');
        $this->assertStringContainsString('access/2', $enter);

        // The enrolled student gets a REGULAR link (access=1).
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $this->studentUser);

        $studentUrl = $this->getJson("/api/v1/online-classes/{$ulid}/enter")->assertOk()->json('url');
        $this->assertStringContainsString('access/1', $studentUrl);
        $this->assertNotSame($enter, $studentUrl);
    }

    public function test_out_of_scope_teacher_sees_nothing(): void
    {
        $this->actingWithRole('teacher', user: $this->teacher);
        $ulid = $this->postJson('/api/v1/online-classes', [
            'classroom_subject_id' => $this->subjectId, 'title' => 'کلاس من',
        ])->assertCreated()->json('ulid');

        $other = $this->makeUser();
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $other);

        $ulids = collect($this->getJson('/api/v1/online-classes')->assertOk()->json('data'))->pluck('ulid');
        $this->assertNotContains($ulid, $ulids);
        $this->getJson("/api/v1/online-classes/{$ulid}/enter")->assertNotFound();
    }

    /** دانش‌آموز کلاسِ دیگر با دانستن شناسه کلاس هم وارد نمی‌شود — همان قاعده‌ی محدوده. */
    public function test_student_of_another_classroom_cannot_enter(): void
    {
        $this->actingWithRole('teacher', user: $this->teacher);
        $ulid = $this->postJson('/api/v1/online-classes', [
            'classroom_subject_id' => $this->subjectId, 'title' => 'کلاس درس ما',
        ])->assertCreated()->json('ulid');

        $otherStudentUser = $this->makeUser();
        $otherStudent = $this->makeStudent();
        $otherStudent->forceFill(['user_id' => $otherStudentUser->id])->save();
        $this->enroll($otherStudent, $this->makeClassroom());

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $otherStudentUser);

        $this->getJson("/api/v1/online-classes/{$ulid}/enter")->assertNotFound();
    }

    public function test_admin_closes_and_deletes_class(): void
    {
        $this->actingWithRole('teacher', user: $this->teacher);
        $ulid = $this->postJson('/api/v1/online-classes', [
            'classroom_subject_id' => $this->subjectId, 'title' => 'کلاس موقت',
        ])->assertCreated()->json('ulid');

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('academic_deputy');

        $this->postJson("/api/v1/online-classes/{$ulid}/close")->assertOk()->assertJsonPath('status', 'closed');

        // Closed classes refuse entry.
        $this->getJson("/api/v1/online-classes/{$ulid}/enter")->assertJsonValidationErrors('class');

        $this->deleteJson("/api/v1/online-classes/{$ulid}")->assertNoContent();
        $this->assertDatabaseMissing('online_classes', ['ulid' => $ulid]);
    }

    /** ورود فقط داخل پنجره‌ی زمانی کلاس: قبل از شروع ممنوع، داخل پنجره آزاد، بعد از پایان ممنوع. */
    public function test_scheduled_class_only_admits_inside_its_time_window(): void
    {
        $this->actingWithRole('teacher', user: $this->teacher);

        // Future class: created, listed as scheduled, entry refused.
        $future = $this->postJson('/api/v1/online-classes', [
            'classroom_subject_id' => $this->subjectId,
            'title' => 'کلاس فردا',
            'starts_at' => now()->addHour()->toIso8601String(),
            'ends_at' => now()->addHours(2)->toIso8601String(),
        ])->assertCreated()->json('ulid');

        $this->getJson("/api/v1/online-classes/{$future}/enter")->assertJsonValidationErrors('class');
        $this->getJson('/api/v1/online-classes')->assertOk()
            ->assertJsonPath('data.0.availability', 'scheduled');

        // Live window: entry allowed and reported open.
        OnlineClass::query()->where('ulid', $future)->firstOrFail()->forceFill([
            'starts_at' => now()->subMinutes(10),
            'ends_at' => now()->addHour(),
        ])->save();
        $this->getJson("/api/v1/online-classes/{$future}/enter")->assertOk();
        $this->getJson('/api/v1/online-classes')->assertOk()
            ->assertJsonPath('data.0.availability', 'open');

        // Past window: entry refused and reported ended.
        OnlineClass::query()->where('ulid', $future)->firstOrFail()->forceFill([
            'starts_at' => now()->subHours(2),
            'ends_at' => now()->subHour(),
        ])->save();
        $this->getJson("/api/v1/online-classes/{$future}/enter")->assertJsonValidationErrors('class');
        $this->getJson('/api/v1/online-classes')->assertOk()
            ->assertJsonPath('data.0.availability', 'ended');

        // No schedule = old behavior: always enterable while active.
        $unscheduled = $this->postJson('/api/v1/online-classes', [
            'classroom_subject_id' => $this->subjectId, 'title' => 'کلاس بی زمان',
        ])->assertCreated()->json('ulid');
        $this->getJson("/api/v1/online-classes/{$unscheduled}/enter")->assertOk();
    }
}
