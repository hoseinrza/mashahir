<?php

namespace Tests\Feature\People;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\People\Models\GuardianLink;
use App\Modules\People\Models\Student;
use App\Support\PhoneHash;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * A parent is registered next to his student (ش: ولی از فهرست نقش‌ها حذف و به
 * تب دانش‌آموزان منتقل شد): حساب ورود، نقش ولی در همان مدرسه و یک پیوند فعال
 * با همین دانش‌آموز، در همان درخواست.
 */
class StudentGuardiansTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
        $this->actingWithRole('school_admin');
    }

    public function test_registering_a_student_with_parents_creates_their_accounts_role_and_active_links(): void
    {
        $this->postJson('/api/v1/students', [
            'student_code' => 'S7001',
            'first_name' => 'پارسا',
            'last_name' => 'رادمنش',
            'guardians' => [
                ['first_name' => 'مسعود', 'last_name' => 'رادمنش', 'phone' => '09127771001', 'link_type' => 'primary'],
                ['first_name' => 'فریبا', 'last_name' => 'کریمی', 'phone' => '09127771002', 'link_type' => 'second'],
            ],
        ])->assertCreated();

        $student = Student::query()->where('student_code', 'S7001')->firstOrFail();
        $this->assertSame(2, GuardianLink::query()->where('student_id', $student->id)->where('status', 'active')->count());

        $guardianRoleId = \DB::table('roles')->whereNull('school_id')->where('key', 'guardian')->value('id');

        foreach (['09127771001', '09127771002'] as $phone) {
            $parent = User::query()->where('phone_hash', PhoneHash::of($phone))->firstOrFail();

            // The parent holds the guardian role in the student's school …
            $this->assertDatabaseHas('user_roles', [
                'user_id' => $parent->id,
                'role_id' => $guardianRoleId,
                'school_id' => $this->school->id,
                'scope_type' => 'school',
                'scope_id' => null,
            ]);

            // … and an ACTIVE link to exactly this student.
            $this->assertDatabaseHas('guardian_links', [
                'guardian_user_id' => $parent->id,
                'student_id' => $student->id,
                'status' => 'active',
                'approved_by' => $this->actor->id,
            ]);
        }

        // The audit trail names the link, never the phone number.
        $rows = $this->getJson('/api/v1/audit-logs?action=guardian_link.created')->assertOk()->json('data');
        $this->assertCount(2, $rows);
        $this->assertSame('***masked***', $rows[0]['new']['phone']);
    }

    public function test_the_parents_panel_opens_on_the_linked_student(): void
    {
        $this->postJson('/api/v1/students', [
            'student_code' => 'S7002',
            'first_name' => 'پارسا',
            'last_name' => 'رادمنش',
            'guardians' => [
                ['first_name' => 'مسعود', 'last_name' => 'رادمنش', 'phone' => '09127772001'],
            ],
        ])->assertCreated();

        $student = Student::query()->where('student_code', 'S7002')->firstOrFail();
        $parent = User::query()->where('phone_hash', PhoneHash::of('09127772001'))->firstOrFail();
        $assignment = UserRole::query()->where('user_id', $parent->id)->firstOrFail();

        $this->app['auth']->forgetGuards();
        $this->withToken($parent->createToken('test', ["role:{$assignment->id}"])->plainTextToken);

        $children = $this->getJson('/api/v1/my/children')->assertOk()->json('data');

        $this->assertSame($student->ulid, $children[0]['student_ulid']);
        // A default parent link sees grades/attendance and can pick the child up.
        $this->assertTrue($children[0]['effective_flags']['can_view_grades']);
        $this->assertTrue($children[0]['effective_flags']['can_pickup']);
    }

    public function test_a_parent_can_be_added_to_an_already_registered_student(): void
    {
        $student = $this->makeStudent(['student_code' => 'S7003']);

        $this->postJson("/api/v1/students/{$student->ulid}/guardians", [
            'first_name' => 'فریبا',
            'last_name' => 'کریمی',
            'phone' => '09127773001',
            'link_type' => 'legal_guardian',
        ])->assertCreated();

        $parent = User::query()->where('phone_hash', PhoneHash::of('09127773001'))->firstOrFail();

        $rows = $this->getJson("/api/v1/students/{$student->ulid}/guardians")->assertOk()->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame($parent->ulid, $rows[0]['guardian']['ulid']);
        $this->assertSame('legal_guardian', $rows[0]['link_type']);
    }

    public function test_the_same_phone_cannot_hold_two_links_to_one_student(): void
    {
        $student = $this->makeStudent(['student_code' => 'S7004']);

        $payload = [
            'first_name' => 'مسعود',
            'last_name' => 'رادمنش',
            'phone' => '09127774001',
        ];

        $this->postJson("/api/v1/students/{$student->ulid}/guardians", $payload)->assertCreated();
        $this->postJson("/api/v1/students/{$student->ulid}/guardians", $payload)
            ->assertStatus(422)
            ->assertJsonPath('errors.guardians.0', 'این شماره از قبل به همین دانش‌آموز پیوند فعال دارد.');
    }

    public function test_a_pickup_only_person_gets_only_the_delivery_flag(): void
    {
        $this->postJson('/api/v1/students', [
            'student_code' => 'S7005',
            'first_name' => 'پارسا',
            'last_name' => 'رادمنش',
            'guardians' => [
                ['first_name' => 'دایی', 'last_name' => 'احمدی', 'phone' => '09127775001', 'link_type' => 'pickup_only'],
            ],
        ])->assertCreated();

        $link = GuardianLink::query()->firstOrFail();

        $this->assertTrue($link->can_pickup);
        $this->assertFalse($link->can_view_grades);
        $this->assertFalse($link->can_view_attendance);
        $this->assertFalse($link->can_approve_consent);
    }

    public function test_persian_digits_in_the_parent_phone_are_normalized(): void
    {
        $student = $this->makeStudent(['student_code' => 'S7006']);

        $this->postJson("/api/v1/students/{$student->ulid}/guardians", [
            'first_name' => 'فریبا',
            'phone' => '۰۹۱۲۷۷۷۶۰۰۱',
        ])->assertCreated();

        $this->assertNotNull(User::query()->where('phone_hash', PhoneHash::of('09127776001'))->first());
    }

    public function test_an_invalid_parent_phone_leaves_no_half_registered_student(): void
    {
        $this->postJson('/api/v1/students', [
            'student_code' => 'S7007',
            'first_name' => 'پارسا',
            'last_name' => 'رادمنش',
            'guardians' => [
                ['first_name' => 'مسعود', 'phone' => '12345'],
            ],
        ])->assertStatus(422);

        $this->assertSame(0, Student::query()->where('student_code', 'S7007')->count());
        $this->assertSame(0, GuardianLink::query()->count());
    }

    public function test_parents_are_optional_for_a_student(): void
    {
        $this->postJson('/api/v1/students', [
            'student_code' => 'S7009',
            'first_name' => 'مينا',
            'last_name' => 'نادری',
        ])->assertCreated();

        // An empty list or no list at all is a valid registration.
        $student = Student::query()->where('student_code', 'S7009')->firstOrFail();
        $this->assertSame(0, GuardianLink::query()->where('student_id', $student->id)->count());

        $this->postJson('/api/v1/students', [
            'student_code' => 'S7010',
            'first_name' => 'سارا',
            'last_name' => 'موسوی',
            'guardians' => [],
        ])->assertCreated();
    }

    public function test_a_parent_account_is_not_a_staff_row(): void
    {
        $this->postJson('/api/v1/students', [
            'student_code' => 'S7011',
            'first_name' => 'پارسا',
            'last_name' => 'رادمنش',
            'guardians' => [
                ['first_name' => 'مسعود', 'last_name' => 'رادمنش', 'phone' => '09127779101'],
            ],
        ])->assertCreated();

        $parent = User::query()->where('phone_hash', PhoneHash::of('09127779101'))->firstOrFail();

        $ulids = collect($this->getJson('/api/v1/users')->assertOk()->json('data'))->pluck('ulid');
        $this->assertNotContains($parent->ulid, $ulids);
    }

    public function test_a_parent_who_is_also_staff_keeps_his_staff_row(): void
    {
        // The parent is a teacher of this school too: one account, two roles.
        $teacher = $this->makeUser(['phone' => '09127779201']);
        $teacherRoleId = \DB::table('roles')->whereNull('school_id')->where('key', 'teacher')->value('id');
        UserRole::query()->create([
            'user_id' => $teacher->id,
            'role_id' => $teacherRoleId,
            'school_id' => $this->school->id,
            'scope_type' => 'school',
            'scope_id' => null,
        ]);

        $student = $this->makeStudent(['student_code' => 'S7012']);

        $this->postJson("/api/v1/students/{$student->ulid}/guardians", [
            'first_name' => 'مسعود',
            'phone' => '09127779201',
        ])->assertCreated();

        $ulids = collect($this->getJson('/api/v1/users')->assertOk()->json('data'))->pluck('ulid');
        $this->assertContains($teacher->ulid, $ulids);
    }

    public function test_a_students_login_number_is_never_a_parent_login(): void
    {
        // A student already signs in with this number.
        $this->postJson('/api/v1/students', [
            'student_code' => 'S7013',
            'first_name' => 'پارسا',
            'last_name' => 'رادمنش',
            'phone' => '09127779301',
        ])->assertCreated();

        $student = Student::query()->where('student_code', 'S7013')->firstOrFail();

        $this->postJson("/api/v1/students/{$student->ulid}/guardians", [
            'first_name' => 'مسعود',
            'phone' => '09127779301',
        ])->assertStatus(422)
            ->assertJsonPath('errors.guardians.0', 'این شماره حساب ورود یک دانش‌آموز است؛ برای ولی شمارهٔ دیگری ثبت کنید.');
    }

    public function test_a_teacher_cannot_add_parents(): void
    {
        $student = $this->makeStudent(['student_code' => 'S7008']);

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher');

        $this->postJson("/api/v1/students/{$student->ulid}/guardians", [
            'first_name' => 'مسعود',
            'phone' => '09127778001',
        ])->assertForbidden();
    }
}
