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

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();

        $this->teacher = $this->makeUser();
        $this->subjectId = $this->assignTeacher($this->teacher, $this->makeClassroom(), $this->makeSubject())->id;

        $this->studentUser = $this->makeUser();
        $student = $this->makeStudent();
        $student->forceFill(['user_id' => $this->studentUser->id])->save();
        $this->enroll($student, $this->classroom ?? $this->makeClassroom());
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
}
