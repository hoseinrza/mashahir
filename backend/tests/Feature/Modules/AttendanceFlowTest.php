<?php

namespace Tests\Feature\Modules;

use App\Modules\Academic\Models\ClassSession;
use App\Modules\Attendance\Models\AttendanceChange;
use App\Modules\Attendance\Models\AttendanceRecord;
use App\Modules\People\Models\GuardianLink;
use App\Support\Sms\SmsManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class AttendanceFlowTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $teacher;

    private $classroom;

    private $studentWithSms;

    private $studentWithoutSms;

    private $guardian;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
        SmsManager::fake();

        $this->teacher = $this->makeUser();
        $this->classroom = $this->makeClassroom();
        $this->assignTeacher($this->teacher, $this->classroom, $this->makeSubject());

        $this->studentWithSms = $this->makeStudent();
        $this->studentWithoutSms = $this->makeStudent();
        $this->enroll($this->studentWithSms, $this->classroom);
        $this->enroll($this->studentWithoutSms, $this->classroom);

        $this->guardian = $this->makeUser();

        // Guardian A: SMS on. Another link without the SMS flag.
        GuardianLink::query()->create([
            'guardian_user_id' => $this->guardian->id,
            'student_id' => $this->studentWithSms->id,
            'link_type' => 'primary', 'status' => 'active', 'approved_at' => now(),
            'can_receive_sms' => true,
        ]);

        $otherGuardian = $this->makeUser();
        GuardianLink::query()->create([
            'guardian_user_id' => $otherGuardian->id,
            'student_id' => $this->studentWithoutSms->id,
            'link_type' => 'primary', 'status' => 'active', 'approved_at' => now(),
            'can_receive_sms' => false,
        ]);
    }

    private function createSession(): ClassSession
    {
        $subjectId = \App\Modules\Academic\Models\ClassroomSubject::query()
            ->where('classroom_id', $this->classroom->id)->value('id');

        return ClassSession::query()->create([
            'school_id' => $this->school->id,
            'classroom_subject_id' => $subjectId,
            'held_on' => now()->toDateString(),
            'period' => 1,
        ]);
    }

    public function test_teacher_records_draft_and_finalize_queues_sms_only_to_flagged_guardians(): void
    {
        $this->actingWithRole('teacher', user: $this->teacher);
        $session = $this->createSession();

        $this->postJson("/api/v1/attendance/sessions/{$session->id}/records", [
            'rows' => [
                ['student_id' => $this->studentWithSms->id, 'status' => 'absent'],
                ['student_id' => $this->studentWithoutSms->id, 'status' => 'present'],
            ],
        ])->assertOk()->assertJsonPath('saved', 2);

        $summary = $this->postJson("/api/v1/attendance/sessions/{$session->id}/finalize")
            ->assertOk()->json('summary');

        $this->assertSame(1, $summary['absent']);
        $this->assertSame(1, $summary['present']);
        // Second student of the roster has no row → not reviewed (FR-5 logic).
        $this->assertSame(0, $summary['unchecked']);

        // In-app notifications to both flagged links? Only SMS-enabled one:
        // absence alert to the guardian with can_receive_sms (in_app + sms).
        $this->assertDatabaseHas('notifications', [
            'type' => 'attendance.absence',
            'user_id' => $this->guardian->id,
        ]);
        $this->assertDatabaseMissing('notifications', [
            'type' => 'attendance.absence',
            'student_id' => $this->studentWithoutSms->id,
        ]);

        $this->assertDatabaseHas('notification_deliveries', ['channel' => 'sms', 'status' => 'queued']);

        // The queue worker sends via the driver to the flagged guardian only.
        $sent = app(\App\Modules\Notifications\Services\NotificationService::class)->dispatchQueued();

        if ($sent !== 1) {
            $this->fail('dispatch failed: '.\DB::table('notification_deliveries')->where('channel', 'sms')->value('last_error'));
        }

        $this->assertCount(1, SmsManager::sent());
        $this->assertStringContainsString('غیبت', SmsManager::sent()[0]['message']);
    }

    public function test_correction_same_day_by_teacher_sh9_then_admin_only_sh7(): void
    {
        $this->actingWithRole('teacher', user: $this->teacher);
        $session = $this->createSession();

        $this->postJson("/api/v1/attendance/sessions/{$session->id}/records", [
            'rows' => [['student_id' => $this->studentWithSms->id, 'status' => 'absent']],
        ])->assertOk();
        $this->postJson("/api/v1/attendance/sessions/{$session->id}/finalize")->assertOk();

        $recordId = AttendanceRecord::query()->where('class_session_id', $session->id)->value('id');

        // Same day: teacher corrects freely with a reason (sh9).
        $this->postJson("/api/v1/attendance/records/{$recordId}/correct", [
            'status' => 'late', 'late_minutes' => 15, 'reason' => 'ورود با تاخیر گزارش معلم',
        ])->assertOk();

        $this->assertDatabaseHas('attendance_changes', [
            'attendance_record_id' => $recordId, 'old_status' => 'absent', 'new_status' => 'late',
        ]);
        $this->assertSame('late', AttendanceRecord::query()->find($recordId)->status);

        // Next day: the teacher is locked out; the admin (sh7) still can.
        $this->travel(1)->days();

        $this->postJson("/api/v1/attendance/records/{$recordId}/correct", [
            'status' => 'present', 'reason' => 'تست رد معلم',
        ])->assertJsonValidationErrors('session');

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin');

        $this->postJson("/api/v1/attendance/records/{$recordId}/correct", [
            'status' => 'present', 'reason' => 'خطای ثبت اعلامی ولی',
        ])->assertOk();

        $this->assertSame('present', AttendanceRecord::query()->find($recordId)->status);
        $this->assertSame(2, AttendanceChange::query()->where('attendance_record_id', $recordId)->count());
    }

    public function test_teacher_cannot_touch_another_teachers_session(): void
    {
        $otherTeacher = $this->makeUser();
        $otherClassroom = $this->makeClassroom();
        $this->assignTeacher($otherTeacher, $otherClassroom);

        $subjectId = \App\Modules\Academic\Models\ClassroomSubject::query()
            ->where('classroom_id', $otherClassroom->id)->value('id');
        $session = ClassSession::query()->create([
            'school_id' => $this->school->id,
            'classroom_subject_id' => $subjectId,
            'held_on' => now()->toDateString(), 'period' => 1,
        ]);

        $this->actingWithRole('teacher', user: $this->teacher);

        $this->postJson("/api/v1/attendance/sessions/{$session->id}/records", [
            'rows' => [['student_id' => $this->studentWithSms->id, 'status' => 'present']],
        ])->assertNotFound();
    }
}
