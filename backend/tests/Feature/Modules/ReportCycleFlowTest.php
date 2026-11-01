<?php

namespace Tests\Feature\Modules;

use App\Modules\Grades\Models\ReportActivityLog;
use App\Modules\Grades\Models\ReportPeriod;
use App\Modules\Grades\Models\StudentReportEntry;
use App\Modules\Grades\Models\TeacherReportSubmission;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * The monthly report-card cycle. Each test below is one of the rules the spec
 * requires the BACKEND to enforce — the panels only ever show what these
 * endpoints already refuse.
 */
class ReportCycleFlowTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $teacherA;

    private $teacherB;

    private $classroomA;

    private $subjectA;

    private $subjectB;

    private $studentA;

    private $studentB;

    private $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();

        $this->teacherA = $this->makeUser();
        $this->teacherB = $this->makeUser();
        $this->admin = $this->makeUser();

        $this->classroomA = $this->makeClassroom();
        $otherClass = $this->makeClassroom();

        $this->subjectA = $this->assignTeacher($this->teacherA, $this->classroomA, $this->makeSubject(['title' => 'ریاضی']));
        $this->subjectB = $this->assignTeacher($this->teacherB, $otherClass, $this->makeSubject(['title' => 'فیزیک']));

        $this->studentA = $this->makeStudent();
        $this->studentB = $this->makeStudent();
        $this->enroll($this->studentA, $this->classroomA);
        $this->enroll($this->studentB, $otherClass);
    }

    /** The principal's turn: create آبان and open it for the whole school. */
    private function openAban(?string $dueAt = null): ReportPeriod
    {
        $this->actingWithRole('school_admin', user: $this->admin);

        $this->postJson('/api/v1/report-periods', [
            'academic_year_id' => $this->makeAcademicYear()->id,
            'month' => 8,
            'title' => 'کارنامه آبان',
            'due_at' => $dueAt,
        ])->assertCreated();

        $period = ReportPeriod::query()->firstOrFail();

        $this->postJson("/api/v1/report-periods/{$period->ulid}/open")->assertOk();

        return $period->fresh();
    }

    private function submissionOf($teacher): TeacherReportSubmission
    {
        return TeacherReportSubmission::query()
            ->where('teacher_id', $teacher->id)
            ->where('report_period_id', ReportPeriod::query()->firstOrFail()->id)
            ->firstOrFail();
    }

    private function teacherWrites(TeacherReportSubmission $submission, int $score = 18): \Illuminate\Testing\TestResponse
    {
        return $this->putJson("/api/v1/report-cycle/{$submission->ulid}/entries", [
            'entries' => [[
                'student_ulid' => $this->studentA->ulid,
                'classroom_subject_id' => $this->subjectA->id,
                'score' => $score,
                'max_score' => 20,
                'evaluation' => 'خیلی‌خوب',
                'notes' => 'تکالیف منظم',
            ]],
        ]);
    }

    // ── Rule 1: nothing is writable until the principal opens the period ───

    public function test_teacher_has_no_period_before_the_principal_opens_it(): void
    {
        $this->actingWithRole('school_admin', user: $this->admin);
        $this->postJson('/api/v1/report-periods', [
            'academic_year_id' => $this->makeAcademicYear()->id,
            'month' => 8,
        ])->assertCreated();

        // A created-but-not-opened period gives teachers nothing to write into.
        $this->assertSame(ReportPeriod::STATUS_DRAFT, ReportPeriod::query()->firstOrFail()->status);
        $this->assertSame(0, TeacherReportSubmission::query()->count());

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $this->getJson('/api/v1/report-cycle/mine')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_teacher_cannot_open_a_period(): void
    {
        $period = $this->openAban();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $this->postJson("/api/v1/report-periods/{$period->ulid}/open")->assertForbidden();
    }

    // ── Rule 2: only the teacher's own classes and active students ─────────

    public function test_teacher_sees_and_writes_only_assigned_students(): void
    {
        $this->openAban();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $submission = $this->submissionOf($this->teacherA);

        $groups = $this->getJson("/api/v1/report-cycle/{$submission->ulid}/entries")
            ->assertOk()
            ->assertJsonPath('data.groups.0.classroom_subject_id', $this->subjectA->id)
            ->assertJsonCount(1, 'data.groups')
            ->json('data.groups');

        // studentB belongs to teacherB's class — never offered to teacherA.
        $this->assertContains($this->studentA->ulid, collect($groups[0]['rows'])->pluck('student_ulid')->all());
        $this->assertNotContains($this->studentB->ulid, collect($groups[0]['rows'])->pluck('student_ulid')->all());

        // A forged line pointing at another teacher's lesson-class is a 404.
        $this->putJson("/api/v1/report-cycle/{$submission->ulid}/entries", [
            'entries' => [[
                'student_ulid' => $this->studentB->ulid,
                'classroom_subject_id' => $this->subjectB->id,
                'score' => 20,
            ]],
        ])->assertNotFound();

        $this->assertSame(0, StudentReportEntry::query()->count());
    }

    public function test_line_is_refused_when_the_enrollment_is_not_active(): void
    {
        $this->openAban();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $submission = $this->submissionOf($this->teacherA);

        DB::table('enrollments')->where('student_id', $this->studentA->id)->update(['status' => 'transferred']);

        $this->teacherWrites($submission)->assertNotFound();
    }

    public function test_one_teachers_submission_is_not_readable_by_another(): void
    {
        $this->openAban();

        $foreign = $this->submissionOf($this->teacherB);

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $this->getJson("/api/v1/report-cycle/{$foreign->ulid}/entries")->assertNotFound();
    }

    // ── The acceptance scenario, end to end ────────────────────────────────

    public function test_full_cycle_open_submit_return_revise_approve_finalize(): void
    {
        $period = $this->openAban();

        // 1) teacher completes and submits
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $submission = $this->submissionOf($this->teacherA);

        $this->teacherWrites($submission)->assertOk()->assertJsonPath('data.entry_count', 1);
        $this->postJson("/api/v1/report-cycle/{$submission->ulid}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', TeacherReportSubmission::STATUS_SUBMITTED);

        // 2) principal asks for a correction, with a note
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin', user: $this->admin);
        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/return", [
            'note' => 'نمره ریاضی با برگه مطابقت ندارد.',
        ])->assertOk()->assertJsonPath('data.status', TeacherReportSubmission::STATUS_REVISION_REQUIRED);

        // 3) teacher sees the note, fixes and resubmits
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $this->getJson("/api/v1/report-cycle/{$submission->ulid}/entries")
            ->assertOk()
            ->assertJsonPath('data.return_note', 'نمره ریاضی با برگه مطابقت ندارد.')
            ->assertJsonPath('data.editable', true);

        $this->teacherWrites($submission, 19)->assertOk();
        $this->postJson("/api/v1/report-cycle/{$submission->ulid}/submit")->assertOk();

        // 4) approve, then the separate final order
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin', user: $this->admin);
        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', TeacherReportSubmission::STATUS_APPROVED);

        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/finalize")
            ->assertOk()
            ->assertJsonPath('data.status', TeacherReportSubmission::STATUS_ARCHIVED);

        $fresh = $submission->fresh();
        $this->assertNotNull($fresh->approved_at, 'approving is its own order');
        $this->assertNotNull($fresh->finalized_at, 'finalizing is its own order');
        $this->assertNotNull($fresh->archived_at);

        // 5) the teacher's view of that month is now read-only
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $this->teacherWrites($fresh, 20)->assertStatus(422);

        $this->assertSame(19, StudentReportEntry::query()->firstOrFail()->score);
    }

    // ── Rule 3: submit locks the teacher out until the principal returns it ─

    public function test_submitted_report_is_not_writable_by_its_own_teacher(): void
    {
        $this->openAban();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $submission = $this->submissionOf($this->teacherA);

        $this->teacherWrites($submission)->assertOk();
        $this->postJson("/api/v1/report-cycle/{$submission->ulid}/submit")->assertOk();

        $this->teacherWrites($submission, 20)
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
        $this->postJson("/api/v1/report-cycle/{$submission->ulid}/submit")->assertStatus(422);

        $this->assertSame(18, StudentReportEntry::query()->firstOrFail()->score);
    }

    public function test_submit_needs_at_least_one_card(): void
    {
        $this->openAban();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $submission = $this->submissionOf($this->teacherA);

        $this->postJson("/api/v1/report-cycle/{$submission->ulid}/submit")
            ->assertStatus(422)
            ->assertJsonValidationErrors('entries');
    }

    // ── approved ≠ finalized ───────────────────────────────────────────────

    public function test_approved_is_not_finalized_and_finalizing_needs_approval(): void
    {
        $period = $this->openAban();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $submission = $this->submissionOf($this->teacherA);
        $this->teacherWrites($submission)->assertOk();
        $this->postJson("/api/v1/report-cycle/{$submission->ulid}/submit")->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin', user: $this->admin);

        // Finalizing straight after submitting is refused: approval comes first.
        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/finalize")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/approve")->assertOk();

        $approved = $submission->fresh();
        $this->assertSame(TeacherReportSubmission::STATUS_APPROVED, $approved->status);
        $this->assertNull($approved->finalized_at);
        $this->assertNull($approved->archived_at);
    }

    // ── Rule 4 + 7: the principal decides, per teacher ─────────────────────

    public function test_finalizing_one_teacher_leaves_the_others_alone(): void
    {
        $period = $this->openAban();

        $this->app['auth']->forgetGuards();
        foreach ([[$this->teacherA, $this->studentA], [$this->teacherB, $this->studentB]] as [$teacher, $student]) {
            $this->actingWithRole('teacher', user: $teacher);
            $submission = $this->submissionOf($teacher);

            $this->putJson("/api/v1/report-cycle/{$submission->ulid}/entries", [
                'entries' => [[
                    'student_ulid' => $student->ulid,
                    'classroom_subject_id' => $teacher === $this->teacherA ? $this->subjectA->id : $this->subjectB->id,
                    'score' => 17,
                ]],
            ])->assertOk();

            $this->postJson("/api/v1/report-cycle/{$submission->ulid}/submit")->assertOk();
        }

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin', user: $this->admin);

        foreach ([$this->submissionOf($this->teacherA), $this->submissionOf($this->teacherB)] as $s) {
            $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$s->ulid}/approve")->assertOk();
        }

        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$this->submissionOf($this->teacherA)->ulid}/finalize")->assertOk();

        $this->assertSame(
            TeacherReportSubmission::STATUS_ARCHIVED,
            $this->submissionOf($this->teacherA)->fresh()->status,
        );
        $this->assertSame(
            TeacherReportSubmission::STATUS_APPROVED,
            $this->submissionOf($this->teacherB)->fresh()->status,
            'teacher B must not wait for, or inherit, teacher A finalization',
        );

        // The period list reports the split, so the panel can show it.
        $this->getJson('/api/v1/report-periods')
            ->assertOk()
            ->assertJsonPath('data.0.stats.archived', 1)
            ->assertJsonPath('data.0.stats.approved', 1);
    }

    public function test_teacher_cannot_approve_or_finalize(): void
    {
        $period = $this->openAban();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $submission = $this->submissionOf($this->teacherA);
        $this->teacherWrites($submission)->assertOk();
        $this->postJson("/api/v1/report-cycle/{$submission->ulid}/submit")->assertOk();

        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/approve")->assertForbidden();
        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/finalize")->assertForbidden();
    }

    // ── Rule 6: after the final order nothing changes, not even from the DB ─

    public function test_finalized_entries_are_immutable_even_below_the_application(): void
    {
        $period = $this->openAban();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $submission = $this->submissionOf($this->teacherA);
        $this->teacherWrites($submission)->assertOk();
        $this->postJson("/api/v1/report-cycle/{$submission->ulid}/submit")->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin', user: $this->admin);
        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/approve")->assertOk();
        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/finalize")->assertOk();

        // Raw query, no model hooks: the trigger still refuses.
        $this->expectException(QueryException::class);
        DB::table('student_report_entries')->where('teacher_report_submission_id', $submission->id)->update(['score' => 20]);
    }

    public function test_returning_an_archived_report_is_refused(): void
    {
        $period = $this->openAban();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $submission = $this->submissionOf($this->teacherA);
        $this->teacherWrites($submission)->assertOk();
        $this->postJson("/api/v1/report-cycle/{$submission->ulid}/submit")->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin', user: $this->admin);
        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/approve")->assertOk();
        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/finalize")->assertOk();

        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/return", [
            'note' => 'Attempt to unwind without the reopen order.',
        ])->assertStatus(422);
    }

    // ── Rule 9: reopening needs the permission AND a reason ────────────────

    public function test_reopen_requires_a_reason_and_reopens_for_correction(): void
    {
        $period = $this->openAban();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $submission = $this->submissionOf($this->teacherA);
        $this->teacherWrites($submission)->assertOk();
        $this->postJson("/api/v1/report-cycle/{$submission->ulid}/submit")->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin', user: $this->admin);
        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/approve")->assertOk();
        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/finalize")->assertOk();

        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/reopen", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');

        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/reopen", [
            'reason' => 'ثبت نمره اشتباه در یک درس، طبق مصوبه شورای آموزش.',
        ])->assertOk()->assertJsonPath('data.status', TeacherReportSubmission::STATUS_REVISION_REQUIRED);

        // The archived row is writable again, and the reason is visible + traced.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $this->teacherWrites($this->submissionOf($this->teacherA), 20)->assertOk();
        $this->assertSame(20, StudentReportEntry::query()->firstOrFail()->score);

        $this->assertDatabaseHas('report_activity_logs', [
            'action' => 'report_submission.reopened',
            'reason' => 'ثبت نمره اشتباه در یک درس، طبق مصوبه شورای آموزش.',
        ]);
    }

    // ── Rule 8: every order leaves a trail ─────────────────────────────────

    public function test_every_order_is_traced_in_both_logs(): void
    {
        $period = $this->openAban();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $submission = $this->submissionOf($this->teacherA);
        $this->teacherWrites($submission)->assertOk();
        $this->postJson("/api/v1/report-cycle/{$submission->ulid}/submit")->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin', user: $this->admin);
        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/approve")->assertOk();
        $this->postJson("/api/v1/report-periods/{$period->ulid}/submissions/{$submission->ulid}/finalize")->assertOk();

        $actions = ReportActivityLog::query()->where('report_period_id', $period->id)->pluck('action')->all();

        foreach ([
            'report_period.created', 'report_period.opened', 'report_entries.saved',
            'report_submission.submitted', 'report_submission.approved',
            'report_submission.finalized', 'report_submission.archived',
        ] as $action) {
            $this->assertContains($action, $actions);
        }

        $this->assertDatabaseHas('audit_logs', ['action' => 'report_submission.finalized']);

        // The panel reads the trail back with actor and label.
        $this->getJson("/api/v1/report-periods/{$period->ulid}")
            ->assertOk()
            ->assertJsonPath('data.activity.0.action_title', 'بایگانی')
            ->assertJsonStructure(['data' => ['activity' => [['action', 'actor', 'created_at']]]]);
    }

    // ── the deadline is the principals order, too ──────────────────────────

    public function test_expired_deadline_blocks_the_teacher(): void
    {
        $this->openAban('2020-01-01');

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $submission = $this->submissionOf($this->teacherA);

        $this->teacherWrites($submission)
            ->assertStatus(422)
            ->assertJsonValidationErrors('due_at');
    }

    public function test_period_can_open_for_selected_teachers_only(): void
    {
        $this->actingWithRole('school_admin', user: $this->admin);
        $this->postJson('/api/v1/report-periods', [
            'academic_year_id' => $this->makeAcademicYear()->id,
            'month' => 8,
        ])->assertCreated();

        $period = ReportPeriod::query()->firstOrFail();

        $this->postJson("/api/v1/report-periods/{$period->ulid}/open", [
            'teacher_ulids' => [$this->teacherA->ulid],
        ])->assertOk()->assertJsonPath('data.stats.total', 1);

        $this->assertSame(1, TeacherReportSubmission::query()->count());
        $this->assertSame($this->teacherA->id, TeacherReportSubmission::query()->firstOrFail()->teacher_id);
    }

    public function test_teacher_picker_offers_the_school_teachers(): void
    {
        $this->actingWithRole('school_admin', user: $this->admin);

        // /report-periods/teachers must not be swallowed by the {period} binding.
        $response = $this->getJson('/api/v1/report-periods/teachers')->assertOk();

        $ulids = collect($response->json('data'))->pluck('ulid')->all();
        $this->assertEqualsCanonicalizing([$this->teacherA->ulid, $this->teacherB->ulid], $ulids);

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->teacherA);
        $this->getJson('/api/v1/report-periods/teachers')->assertForbidden();
    }

    public function test_same_month_cannot_be_opened_twice(): void
    {
        $this->openAban();

        $this->actingWithRole('school_admin', user: $this->admin);
        $this->postJson('/api/v1/report-periods', [
            'academic_year_id' => $this->makeAcademicYear()->id,
            'month' => 8,
        ])->assertStatus(422)->assertJsonValidationErrors('month');
    }
}
