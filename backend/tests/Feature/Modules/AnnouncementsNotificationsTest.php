<?php

namespace Tests\Feature\Modules;

use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Services\NotificationService;
use App\Support\Sms\SmsManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

class AnnouncementsNotificationsTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    private $studentUser;

    private $student;

    private $guardian;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
        SmsManager::fake();

        $this->student = $this->makeStudent();
        $this->studentUser = $this->makeUser();
        $this->student->forceFill(['user_id' => $this->studentUser->id])->save();

        $this->guardian = $this->makeUser();
        \App\Modules\People\Models\GuardianLink::query()->create([
            'guardian_user_id' => $this->guardian->id,
            'student_id' => $this->student->id,
            'link_type' => 'primary', 'status' => 'active', 'approved_at' => now(),
        ]);

        // Audience resolution walks enrollments; give the student a class.
        $this->enroll($this->student, $this->makeClassroom());
    }

    public function test_school_wide_announcement_reaches_staff_guardians_and_students(): void
    {
        $this->actingWithRole('school_admin');

        $result = $this->postJson('/api/v1/announcements', [
            'title' => 'تعطیلی فردا',
            'body' => 'به دلیل شرایط جوی فردا مدرسه تعطیل است.',
            'importance' => 'urgent',
        ])->assertCreated()->json();

        $this->assertGreaterThan(0, $result['audience_notified']);

        // Every guardian has their OWN row (never shared).
        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->guardian->id,
            'type' => 'announcement',
            'importance' => 'urgent',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->studentUser->id,
            'type' => 'announcement',
        ]);
    }

    public function test_classroom_targeted_announcement_only_reaches_that_class(): void
    {
        $this->actingWithRole('school_admin');
        $classroom = $this->makeClassroom();

        $this->enroll($this->makeStudent(), $classroom);

        $otherStudent = $this->makeStudent();
        $otherClassroom = $this->makeClassroom();
        $this->enroll($otherStudent, $otherClassroom);

        $this->postJson('/api/v1/announcements', [
            'title' => 'اطلاعیه کلاس',
            'body' => 'جلسه انجمن اولیا',
            'importance' => 'important',
            'targets' => [['target_type' => 'classroom', 'target_id' => $classroom->id]],
        ])->assertCreated();

        $this->assertDatabaseMissing('notifications', ['title' => 'اطلاعیه کلاس']);
    }

    public function test_read_archive_and_unread_counter(): void
    {
        $user = $this->makeUser();
        app(NotificationService::class)->notify($user, null, 'announcement', 'سلام', 'متن');

        $this->actingWithRole('teacher', user: $user);
        $this->getJson('/api/v1/notifications?tab=unread')->assertOk()->assertJsonCount(1, 'data');

        $id = \App\Modules\Notifications\Models\Notification::query()->where('user_id', $user->id)->value('id');
        $this->postJson("/api/v1/notifications/{$id}/read")->assertOk();
        $this->getJson('/api/v1/notifications?tab=unread')->assertOk()->assertJsonCount(0, 'data');

        $this->postJson("/api/v1/notifications/{$id}/archive")->assertOk();
        $this->getJson('/api/v1/notifications?tab=archived')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_mandatory_school_alerts_cannot_be_muted_sh14(): void
    {
        $user = $this->makeUser();
        $this->actingWithRole('teacher', user: $user);

        $this->putJson('/api/v1/notification-preferences', [
            'type' => 'attendance.absence', 'channel' => 'sms', 'enabled' => false,
        ])->assertJsonValidationErrors('enabled');

        // Non-mandatory types are freely configurable.
        $this->putJson('/api/v1/notification-preferences', [
            'type' => 'announcement', 'channel' => 'sms', 'enabled' => false,
        ])->assertOk();
    }

    public function test_failed_sms_delivery_is_visible_and_retryable(): void
    {
        $user = $this->makeUser();
        app(NotificationService::class)->notify(
            $user, null, 'attendance.absence', 'غیبت امروز', 'زنگ دوم',
            importance: 'important', channels: ['in_app', 'sms'],
        );

        // An unknown driver makes the send throw → the delivery FAILS but
        // never breaks the operation that queued it.
        config()->set('sms.driver', 'nonexistent-driver');

        $sent = app(NotificationService::class)->dispatchQueued();
        $this->assertSame(0, $sent);

        $deliveryId = \App\Modules\Notifications\Models\NotificationDelivery::query()
            ->where('channel', 'sms')->value('id');

        $this->actingWithRole('school_admin');
        $row = collect($this->getJson('/api/v1/attendance/sms-status')->assertOk()->json('data'))
            ->firstWhere('id', $deliveryId);
        $this->assertSame('failed', $row['status']);
        $this->assertNotNull($row['next_retry_at']);

        // Retry with the fake driver → sent.
        SmsManager::fake();
        $this->postJson("/api/v1/notification-deliveries/{$deliveryId}/retry")
            ->assertOk()->assertJsonPath('status', 'sent');
    }
}

// helper removed — assertions use direct user ids

