<?php

namespace Tests\Feature\Modules;

use App\Modules\Files\Models\File;
use App\Modules\Identity\Models\UserRole;
use App\Modules\People\Models\GuardianLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * Closes the family-domain payload gaps: court orders carry ruling metadata
 * (hidden under sh16), guardian links carry the verification document and the
 * office note (never visible to guardians), the pickup list identifies a
 * person by national id, the users index exposes active roles for "end role",
 * and the students index names the current classroom. The notification wiring
 * of the newer modules (counseling, PTA, bus absence) is covered here too.
 */
class FamilyDomainFieldsTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
    }

    private function activeGuardianLink($guardian, $student, array $flags = []): GuardianLink
    {
        return GuardianLink::query()->create([
            'guardian_user_id' => $guardian->id,
            'student_id' => $student->id,
            'link_type' => 'primary',
            'status' => 'active',
            'approved_at' => now(),
            ...$flags,
        ]);
    }

    public function test_court_order_keeps_ruling_metadata_and_hides_the_narrative_under_sh16(): void
    {
        $student = $this->makeStudent();

        $this->actingWithRole('school_admin');
        $id = $this->postJson('/api/v1/court-orders', [
            'student_ulid' => $student->ulid,
            'ruling_number' => '۱۴۰۵/۲۴/۹۹۲',
            'issuing_authority' => 'شعبهٔ ۲۴ دادگاه خانوادهٔ تهران',
            'description' => 'سلب حق ترخیص از ولی جداشده تا اطلاع ثانوی',
            'restrictions' => ['can_pickup' => false],
            'reason' => 'ابلاغ دادنامهٔ دادگاه خانواده به مدرسه',
        ])->assertCreated()->json('id');

        $rows = $this->getJson('/api/v1/court-orders')->assertOk()->json('data');
        $row = collect($rows)->firstWhere('id', $id);
        $this->assertSame('۱۴۰۵/۲۴/۹۹۲', $row['ruling_number']);
        $this->assertSame('شعبهٔ ۲۴ دادگاه خانوادهٔ تهران', $row['issuing_authority']);
        $this->assertSame('سلب حق ترخیص از ولی جداشده تا اطلاع ثانوی', $row['description']);

        // sh16 (discipline deputy): the restriction summary only.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('discipline_deputy');
        $row = collect($this->getJson('/api/v1/court-orders')->assertOk()->json('data'))->firstWhere('id', $id);
        $this->assertTrue($this->getJson('/api/v1/court-orders')->json('summary_only'));
        $this->assertSame('۱۴۰۵/۲۴/۹۹۲', $row['ruling_number']);
        $this->assertNull($row['description']);
        $this->assertNull($row['file']);
    }

    public function test_guardian_link_approval_keeps_verification_material_staff_only(): void
    {
        $student = $this->makeStudent();
        $guardian = $this->makeUser();

        $this->actingWithRole('guardian', user: $guardian);
        $linkId = $this->postJson('/api/v1/guardian-links/request', [
            'student_ulid' => $student->ulid,
        ])->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin');
        $file = File::query()->create([
            'disk' => 'local',
            'path' => 'verification/deed.pdf',
            'original_name' => 'سند.pdf',
            'mime' => 'application/pdf',
            'size' => 1024,
            'checksum' => 'deadbeef',
            'uploaded_by' => $this->actor->id,
        ]);
        $this->postJson("/api/v1/guardian-links/{$linkId}/approve", [
            'link_type' => 'primary',
            'can_view_grades' => true,
            'verification_file_id' => $file->id,
            'admin_note' => 'اصل حکم در پروندهٔ دبیرستان ملاحظه شد.',
            'reason' => 'اسناد هویتی و سند سرپرستی بررسی شد.',
        ])->assertOk();

        // Staff sees the verification material.
        $row = collect($this->getJson('/api/v1/guardian-links')->json('data'))
            ->firstWhere('id', $linkId);
        $this->assertSame($file->ulid, $row['verification_file_ulid']);
        $this->assertSame('اصل حکم در پروندهٔ دبیرستان ملاحظه شد.', $row['admin_note']);

        // The guardian's own view never carries the office note.
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('guardian', user: $guardian);
        $row = collect($this->getJson('/api/v1/guardian-links')->json('data'))
            ->firstWhere('id', $linkId);
        $this->assertArrayNotHasKey('admin_note', $row);
        $this->assertArrayNotHasKey('verification_file_ulid', $row);
    }

    public function test_pickup_authorization_carries_a_national_id(): void
    {
        $student = $this->makeStudent();

        $this->actingWithRole('school_admin');
        $this->postJson("/api/v1/pickup/{$student->ulid}", [
            'full_name' => 'علی احمدی',
            'phone' => '09121112233',
            'national_id' => '1234567890',
            'relation' => 'عمو',
            'reason' => 'معرفی کتبی ولی اولیا برای تحویل‌گیری.',
        ])->assertCreated();

        $rows = $this->getJson("/api/v1/pickup/{$student->ulid}")->assertOk()->json('data');
        $this->assertSame('1234567890', $rows[0]['national_id']);
    }

    public function test_users_index_exposes_active_roles_and_end_role_cuts_them(): void
    {
        $this->actingWithRole('school_admin');
        $teacher = $this->makeUser();
        $this->postJson("/api/v1/users/{$teacher->ulid}/roles", [
            'role_key' => 'teacher',
            'scope_type' => 'school',
        ])->assertCreated();

        $row = collect($this->getJson('/api/v1/users')->json('data'))
            ->firstWhere('ulid', $teacher->ulid);
        $this->assertNotEmpty($row['roles']);
        $assignment = $row['roles'][0];
        $this->assertSame('teacher', $assignment['role_key']);
        $this->assertSame(
            \DB::table('roles')->where('key', 'teacher')->value('title'),
            $assignment['role_title'],
        );

        $this->deleteJson("/api/v1/users/{$teacher->ulid}/roles/{$assignment['user_role_id']}", [
            'reason' => 'پایان همکاری دبیر با مدرسه.',
        ])->assertOk();

        $row = collect($this->getJson('/api/v1/users')->json('data'))
            ->firstWhere('ulid', $teacher->ulid);
        $this->assertSame([], $row['roles']);
        $this->assertNotNull(UserRole::query()->find($assignment['user_role_id'])->ends_on);
    }

    public function test_students_index_names_the_current_classroom(): void
    {
        $enrolled = $this->makeStudent();
        $classroom = $this->makeClassroom();
        $this->enroll($enrolled, $classroom);
        $freeAgent = $this->makeStudent();

        $this->actingWithRole('school_admin');
        $rows = collect($this->getJson('/api/v1/students')->json('data'));

        $this->assertSame($classroom->title, $rows->firstWhere('ulid', $enrolled->ulid)['classroom_title']);
        $this->assertNull($rows->firstWhere('ulid', $freeAgent->ulid)['classroom_title']);
    }

    public function test_a_counseling_request_rings_the_staff_who_manage_counseling(): void
    {
        $studentUser = $this->makeUser();
        $student = $this->makeStudent();
        $student->forceFill(['user_id' => $studentUser->id])->save();

        $counselor = $this->makeUser();
        $this->actingWithRole('support', user: $counselor);
        $admin = $this->makeUser();
        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin', user: $admin);
        $outsider = $this->makeUser();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('student', user: $studentUser);
        $this->postJson('/api/v1/counseling/appointments', [
            'student_ulid' => $student->ulid,
            'topic' => 'اضطراب پیش از آزمون',
        ])->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $counselor->id,
            'student_id' => $student->id,
            'type' => 'counseling.requested',
            'link' => '/counseling',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $admin->id,
            'type' => 'counseling.requested',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $outsider->id,
            'type' => 'counseling.requested',
        ]);
    }

    public function test_new_pta_meeting_and_survey_reach_every_active_guardian(): void
    {
        $student = $this->makeStudent();
        $guardian = $this->makeUser();
        $this->activeGuardianLink($guardian, $student);
        $stranger = $this->makeUser();

        $this->actingWithRole('school_admin');
        $this->postJson('/api/v1/pta/meetings', [
            'title' => 'جلسهٔ ماهانهٔ انجمن',
            'held_at' => now()->addWeek()->toIso8601String(),
            'location' => 'سالن اجتماعات',
        ])->assertCreated();
        $this->postJson('/api/v1/pta/surveys', [
            'title' => 'نظرسنجی برنامهٔ اردو',
            'options' => [['text' => 'شمال'], ['text' => 'جنوب']],
            'closes_at' => now()->addDays(5)->toIso8601String(),
        ])->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $guardian->id,
            'type' => 'pta.meeting_created',
            'link' => '/pta',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $guardian->id,
            'type' => 'pta.survey_created',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $stranger->id,
            'type' => 'pta.meeting_created',
        ]);
    }

    public function test_a_missed_morning_bus_alerts_the_guardian_over_sms(): void
    {
        $student = $this->makeStudent();
        $guardian = $this->makeUser();
        $this->activeGuardianLink($guardian, $student, ['can_receive_sms' => true]);
        $noSmsGuardian = $this->makeUser();
        $this->activeGuardianLink($noSmsGuardian, $student, ['can_receive_sms' => false]);

        $this->actingWithRole('office_manager');
        $driver = $this->makeUser();
        $route = $this->postJson('/api/v1/transport/routes', [
            'code' => 'خط ۱',
            'title' => 'مسیر مرکز',
            'driver_ulid' => $driver->ulid,
        ])->assertCreated()->json();
        $this->postJson("/api/v1/transport/routes/{$route['ulid']}/students", [
            'student_ulid' => $student->ulid,
        ])->assertCreated();

        // Boarded = nothing to report.
        $this->actingAsBusDriver($driver);
        $this->postJson('/api/v1/transport/boardings', [
            'route_ulid' => $route['ulid'],
            'student_ulid' => $student->ulid,
            'direction' => 'in',
            'status' => 'boarded',
        ])->assertOk();

        $this->assertDatabaseMissing('notifications', [
            'user_id' => $guardian->id,
            'type' => 'transport.bus_absent',
        ]);

        // Did not board → the safety alert, school-mandatory, sms queued.
        $this->postJson('/api/v1/transport/boardings', [
            'route_ulid' => $route['ulid'],
            'student_ulid' => $student->ulid,
            'direction' => 'in',
            'status' => 'absent',
        ])->assertOk();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $guardian->id,
            'student_id' => $student->id,
            'type' => 'transport.bus_absent',
            'importance' => 'important',
        ]);
        $delivery = \DB::table('notification_deliveries as d')
            ->join('notifications as n', 'n.id', '=', 'd.notification_id')
            ->where('n.user_id', $guardian->id)
            ->where('n.type', 'transport.bus_absent')
            ->where('d.channel', 'sms')
            ->exists();
        $this->assertTrue($delivery, 'the absence alert must be queued for SMS');

        // The sms-off guardian follows the attendance semantics: no bus
        // alert at all — the flag gates the whole alert, not just SMS.
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $noSmsGuardian->id,
            'type' => 'transport.bus_absent',
        ]);
    }

    /** رانندهٔ سرویس نقش سیستمی نیست؛ مدرسه یک نقش سفارشی با transport.board می‌سازد. */
    private function actingAsBusDriver($driver): void
    {
        $roleId = \DB::table('roles')->insertGetId([
            'school_id' => $this->school->id,
            'key' => 'bus_driver',
            'title' => 'راننده سرویس',
            'is_system' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $permissionId = \DB::table('permissions')->where('key', 'transport.board')->value('id');

        \DB::table('role_permissions')->insert([
            'role_id' => $roleId,
            'permission_id' => $permissionId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $assignment = UserRole::query()->create([
            'user_id' => $driver->id,
            'role_id' => $roleId,
            'school_id' => $this->school->id,
            'scope_type' => 'school',
            'scope_id' => null,
        ]);

        $this->app['auth']->forgetGuards();
        $token = $driver->createToken('test', ["role:{$assignment->id}"])->plainTextToken;
        $this->withToken($token);
    }
}
