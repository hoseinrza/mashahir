<?php

namespace Tests\Feature\Identity;

use App\Modules\Identity\Models\UserRole;
use App\Modules\School\Models\School;
use App\Support\Sms\SmsManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Concerns\BuildsSchoolContext;
use Tests\TestCase;

/**
 * Phone+password login beside SMS OTP (username = the mobile number), plus
 * the school-level OTP switch in school settings: when a school turns SMS
 * login off, its users fall back to the password path and the public auth
 * config reflects it for the login page.
 */
class PasswordAuthTest extends TestCase
{
    use BuildsSchoolContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        SmsManager::fake();
        $this->seedRbac();
        $this->makeSchool();
    }

    private function assignment(string $roleKey, ?School $school = null): UserRole
    {
        $roleId = \DB::table('roles')->whereNull('school_id')->where('key', $roleKey)->value('id');
        assert($roleId !== null);

        return UserRole::query()->create([
            'user_id' => ($this->user ?? $this->actor)->id,
            'role_id' => $roleId,
            'school_id' => ($school ?? $this->school)->id,
            'scope_type' => 'school',
            'scope_id' => null,
        ]);
    }

    private function otpEnabled(bool $enabled): void
    {
        \DB::table('school_settings')->updateOrInsert(
            ['school_id' => $this->school->id, 'key' => 'otp_login_enabled'],
            ['value' => json_encode($enabled), 'created_at' => now(), 'updated_at' => now()],
        );
    }

    public function test_unknown_number_no_password_and_wrong_password_share_one_message(): void
    {
        $withAccount = $this->makeUser();

        $unknown = $this->postJson('/api/v1/auth/password/login', [
            'phone' => '09120009999',
            'password' => 'whatever-123',
        ]);
        $noPassword = $this->postJson('/api/v1/auth/password/login', [
            'phone' => $withAccount->phone,
            'password' => 'whatever-123',
        ]);

        $withAccount->forceFill(['password' => 'real-secret-1'])->save();
        $wrong = $this->postJson('/api/v1/auth/password/login', [
            'phone' => $withAccount->phone,
            'password' => 'wrong-secret',
        ]);

        foreach ([$unknown, $noPassword, $wrong] as $response) {
            $response->assertStatus(422)
                ->assertJsonPath('errors.phone.0', 'اطلاعات ورود نادرست است.');
        }
    }

    public function test_correct_password_issues_the_pending_role_bootstrap(): void
    {
        $this->user = $this->makeUser();
        $this->assignment('school_admin');
        $this->user->forceFill(['password' => 'real-secret-1'])->save();

        $response = $this->postJson('/api/v1/auth/password/login', [
            'phone' => $this->user->phone,
            'password' => 'real-secret-1',
        ])->assertOk();

        $response->assertJsonPath('token_kind', 'pending-role')
            ->assertJsonPath('roles.0.role_key', 'school_admin');

        $this->assertNotNull($this->user->fresh()->last_login_at);
    }

    public function test_password_login_is_rate_limited_then_resettable(): void
    {
        $this->user = $this->makeUser();
        $this->user->forceFill(['password' => 'real-secret-1'])->save();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/password/login', [
                'phone' => $this->user->phone,
                'password' => 'wrong-secret',
            ])->assertStatus(422);
        }

        $this->postJson('/api/v1/auth/password/login', [
            'phone' => $this->user->phone,
            'password' => 'wrong-secret',
        ])->assertStatus(429);

        RateLimiter::clear('password-phone:'.\App\Support\PhoneHash::of($this->user->phone));

        $this->postJson('/api/v1/auth/password/login', [
            'phone' => $this->user->phone,
            'password' => 'real-secret-1',
        ])->assertOk();
    }

    public function test_self_service_first_setup_needs_no_current_but_replacing_it_does(): void
    {
        $this->user = $this->makeUser();
        $this->actingWithRole('teacher', user: $this->user);

        $this->postJson('/api/v1/auth/password', ['password' => 'first-pass-1'])->assertOk();

        // Now a password exists — the endpoint demands the current one.
        $this->postJson('/api/v1/auth/password', ['password' => 'second-pass-2'])->assertStatus(422);
        $this->postJson('/api/v1/auth/password', [
            'password' => 'second-pass-2',
            'current_password' => 'not-my-password',
        ])->assertStatus(422);
        $this->postJson('/api/v1/auth/password', [
            'password' => 'second-pass-2',
            'current_password' => 'first-pass-1',
        ])->assertOk();

        $this->postJson('/api/v1/auth/password/login', [
            'phone' => $this->user->phone,
            'password' => 'second-pass-2',
        ])->assertOk();
    }

    public function test_admin_sets_password_with_reason_and_audit(): void
    {
        $admin = $this->makeUser();
        $this->actingWithRole('school_admin', user: $admin);
        $teacher = $this->makeUser();

        $this->postJson("/api/v1/users/{$teacher->ulid}/password", [
            'password' => 'office-set-1',
            'reason' => 'راه‌اندازی اولیهٔ حساب ورود',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.password_changed',
            'reason' => 'راه‌اندازی اولیهٔ حساب ورود',
        ]);

        // The password works; a teacher may not set passwords for others.
        $this->postJson('/api/v1/auth/password/login', [
            'phone' => $teacher->phone,
            'password' => 'office-set-1',
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('teacher', user: $this->makeUser());
        $this->postJson("/api/v1/users/{$teacher->ulid}/password", [
            'password' => 'sneaky-pass-1',
            'reason' => 'تلاش غیرمجاز برای تغییر رمز دیگری.',
        ])->assertForbidden();
    }

    public function test_school_can_switch_sms_otp_off_and_users_fall_back_to_password(): void
    {
        $this->user = $this->makeUser();
        $this->assignment('school_admin');
        $this->user->forceFill(['password' => 'real-secret-1'])->save();

        $this->otpEnabled(false);

        // The public config flips, the login page hides the OTP option.
        $this->getJson('/api/v1/auth/config')->assertOk()->assertJsonPath('otp_enabled', false);

        // OTP request refuses explicitly and sends no SMS.
        $this->postJson('/api/v1/auth/otp/request', ['phone' => $this->user->phone])
            ->assertStatus(422)
            ->assertJsonPath('errors.phone.0', 'ورود با کد پیامکی برای مدرسهٔ شما غیرفعال است — با رمز عبور وارد شوید.');
        $this->assertSame([], SmsManager::sent());

        // The password path is untouched.
        $this->postJson('/api/v1/auth/password/login', [
            'phone' => $this->user->phone,
            'password' => 'real-secret-1',
        ])->assertOk();

        // The switch back re-opens SMS login.
        $this->otpEnabled(true);
        $this->getJson('/api/v1/auth/config')->assertOk()->assertJsonPath('otp_enabled', true);
        $this->postJson('/api/v1/auth/otp/request', ['phone' => $this->user->phone])->assertOk();
        $this->assertCount(1, SmsManager::sent());
    }

    public function test_a_two_school_user_keeps_otp_while_any_school_leaves_it_on(): void
    {
        $this->user = $this->makeUser();
        $this->assignment('school_admin');

        $otherSchool = School::query()->create([
            'name' => 'دبیرستان دوم',
            'level' => 'high',
            'grading_type' => 'numeric',
            'student_has_account' => true,
            'timezone' => 'Asia/Tehran',
            'is_active' => true,
        ]);
        $this->assignment('teacher', $otherSchool);

        // Only the second school turns OTP off — the first is still on.
        \DB::table('school_settings')->updateOrInsert(
            ['school_id' => $otherSchool->id, 'key' => 'otp_login_enabled'],
            ['value' => json_encode(false), 'created_at' => now(), 'updated_at' => now()],
        );

        $this->postJson('/api/v1/auth/otp/request', ['phone' => $this->user->phone])->assertOk();
        $this->assertCount(1, SmsManager::sent());
    }

    public function test_the_otp_toggle_is_school_admin_only_and_typed(): void
    {
        $this->actingWithRole('teacher');
        $this->putJson('/api/v1/school/settings', [
            'settings' => [['key' => 'otp_login_enabled', 'value' => false]],
        ])->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->actingWithRole('school_admin');

        $this->putJson('/api/v1/school/settings', [
            'settings' => [['key' => 'otp_login_enabled', 'value' => 'yes']],
        ])->assertStatus(422);

        $this->putJson('/api/v1/school/settings', [
            'settings' => [['key' => 'otp_login_enabled', 'value' => false]],
        ])->assertOk();

        $this->assertSame(
            false,
            $this->getJson('/api/v1/school/settings')->json('settings.otp_login_enabled'),
        );
    }
}
