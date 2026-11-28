<?php

namespace Tests\Feature\Modules;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Services\AdminPasswordService;
use App\Modules\People\Models\Student;
use App\Support\PhoneHash;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * The password of a student's login account, set from the roster: same
 * reason-logged flow as the staff page (sh7), but the office reaches it from
 * the student row instead of hunting for the account in the users table.
 *
 * The reason is a pick from a closed list, never free text — the trail has to
 * stay countable, so the server refuses anything the form does not offer.
 */
class StudentPasswordTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    /** One of the labels the form offers. */
    private const REASON = 'فراموشی رمز و درخواست بازیابی';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->makeSchool();
        $this->actingWithRole('school_admin');
    }

    private function studentWithAccount(string $code, string $phone): Student
    {
        $this->postJson('/api/v1/students', [
            'student_code' => $code,
            'first_name' => 'پارسا',
            'last_name' => 'رادمنش',
            'phone' => $phone,
        ])->assertCreated();

        return Student::query()->where('student_code', $code)->firstOrFail();
    }

    public function test_the_office_sets_the_password_and_the_password_login_accepts_it(): void
    {
        $student = $this->studentWithAccount('S7001', '09127770001');

        $this->postJson("/api/v1/students/{$student->ulid}/password", [
            'password' => 'Student-1234',
            'reason' => self::REASON,
        ])->assertOk()->assertJsonPath('data.ulid', $student->ulid);

        $user = User::query()->where('phone_hash', PhoneHash::of('09127770001'))->firstOrFail();
        $this->assertTrue(Hash::check('Student-1234', $user->password));

        // The stored secret is a hash, never the plain text.
        $this->assertNotSame('Student-1234', $user->password);

        // The login path accepted the new secret.
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/password/login', [
            'phone' => '09127770001',
            'password' => 'Student-1234',
        ])->assertOk();

        // The audit entry carries the reason and masks the secret.
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.password_changed',
            'subject_id' => $user->id,
            'reason' => self::REASON,
        ]);
        $log = \DB::table('audit_logs')->where('action', 'user.password_changed')->latest('id')->first();
        $this->assertStringNotContainsString('Student-1234', json_encode($log, JSON_UNESCAPED_UNICODE));
    }

    public function test_a_student_without_a_login_account_is_refused(): void
    {
        $student = $this->makeStudent();

        $this->postJson("/api/v1/students/{$student->ulid}/password", [
            'password' => 'Student-1234',
            'reason' => self::REASON,
        ])->assertStatus(422)
            ->assertJsonPath('errors.password.0', 'این دانش‌آموز حساب ورود ندارد؛ نخست شمارهٔ موبایل او را ثبت کنید.');
    }

    public function test_a_short_password_and_a_reason_outside_the_list_are_rejected(): void
    {
        $student = $this->studentWithAccount('S7002', '09127770002');

        $this->postJson("/api/v1/students/{$student->ulid}/password", [
            'password' => 'short',
            'reason' => 'بد',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['password', 'reason']);
    }

    public function test_a_typewritten_reason_is_refused_even_when_it_looks_plausible(): void
    {
        $student = $this->studentWithAccount('S7004', '09127770004');

        // Not one of the labels the form offers: the office must pick.
        $this->postJson("/api/v1/students/{$student->ulid}/password", [
            'password' => 'Student-1234',
            'reason' => 'درخواست ولی برای ورود اولیه',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['reason']);

        $user = User::query()->where('phone_hash', PhoneHash::of('09127770004'))->firstOrFail();
        $this->assertNull($user->password);
    }

    public function test_the_reason_list_travels_with_the_session(): void
    {
        $this->getJson('/api/v1/auth/context')
            ->assertOk()
            ->assertJsonPath('password_change_reasons', AdminPasswordService::reasons());
    }

    public function test_a_role_without_the_password_permission_gets_404(): void
    {
        $student = $this->studentWithAccount('S7003', '09127770003');

        // The academic deputy sees the roster but may not touch passwords.
        $this->actingWithRole('academic_deputy');

        $this->postJson("/api/v1/students/{$student->ulid}/password", [
            'password' => 'Student-1234',
            'reason' => self::REASON,
        ])->assertNotFound();
    }

    public function test_a_foreign_school_student_is_404(): void
    {
        $otherSchool = \DB::table('schools')->insertGetId([
            'ulid' => '01JOTHERSCHOOL000000000001', 'name' => 'مدرسه دوم', 'level' => 'high',
            'grading_type' => 'numeric', 'student_has_account' => true, 'timezone' => 'Asia/Tehran',
            'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);
        \DB::table('students')->insert([
            'ulid' => '01JFOREIGNSTUDENT000000001', 'school_id' => $otherSchool,
            'student_code' => 'X2', 'first_name' => 'بیرونی', 'last_name' => 'غیرمجاز',
            'status' => 'active', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->postJson('/api/v1/students/01JFOREIGNSTUDENT000000001/password', [
            'password' => 'Student-1234',
            'reason' => self::REASON,
        ])->assertNotFound();
    }
}
