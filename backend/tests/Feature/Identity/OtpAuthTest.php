<?php

namespace Tests\Feature\Identity;

use App\Modules\Identity\Models\LoginCode;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\School\Models\School;
use App\Support\Sms\SmsManager;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OtpAuthTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        SmsManager::fake();
        $this->seed(PermissionSeeder::class);

        $this->school = School::query()->create([
            'name' => 'دبیرستان مشاهیر',
            'level' => 'high',
            'grading_type' => 'numeric',
            'student_has_account' => true,
            'timezone' => 'Asia/Tehran',
            'is_active' => true,
        ]);

        $this->user = User::factory()->create(['phone' => '09120000001']);
    }

    private function assignment(string $roleKey, array $attributes = []): UserRole
    {
        $roleId = \DB::table('roles')->whereNull('school_id')->where('key', $roleKey)->value('id');

        return UserRole::query()->create([
            'user_id' => $this->user->id,
            'role_id' => $roleId,
            'school_id' => $this->school->id,
            'scope_type' => 'school',
            'scope_id' => null,
            ...$attributes,
        ]);
    }

    private function latestCodeHash(): string
    {
        return LoginCode::query()->where('user_id', $this->user->id)->orderByDesc('id')->value('code_hash');
    }

    public function test_request_for_unknown_phone_is_generic_and_silent(): void
    {
        $this->postJson('/api/v1/auth/otp/request', ['phone' => '09350000000'])
            ->assertOk()
            ->assertJsonPath('message', 'اگر شماره در سامانه ثبت شده باشد، کد ورود ارسال شد.');

        $this->assertCount(0, SmsManager::sent());
    }

    public function test_request_sends_code_for_registered_phone(): void
    {
        $this->postJson('/api/v1/auth/otp/request', ['phone' => '۰۹۱۲-۰۰۰ ۰۰۰۱'])
            ->assertOk();

        $this->assertCount(1, SmsManager::sent());
        $this->assertSame('09120000001', SmsManager::sent()[0]['phone']);

        $this->assertDatabaseHas('login_codes', ['user_id' => $this->user->id]);
    }

    public function test_request_is_rate_limited_per_phone(): void
    {
        foreach (range(1, 3) as $i) {
            $this->postJson('/api/v1/auth/otp/request', ['phone' => '09120000001'])->assertOk();
        }

        $this->postJson('/api/v1/auth/otp/request', ['phone' => '09120000001'])
            ->assertStatus(429);
    }

    public function test_verify_with_wrong_code_fails_and_counts_attempts(): void
    {
        $this->postJson('/api/v1/auth/otp/request', ['phone' => '09120000001']);
        $codeHash = $this->latestCodeHash();

        $wrongCode = '000000';
        // Craft a wrong code that surely mismatches: try every wrong guess once.
        $response = $this->postJson('/api/v1/auth/otp/verify', ['phone' => '09120000001', 'code' => '999999']);
        $response->assertJsonValidationErrors('code');

        $this->assertSame(1, LoginCode::query()->where('code_hash', $codeHash)->value('attempts'));
    }

    public function test_verify_with_correct_code_returns_pending_token_and_roles(): void
    {
        $this->assignment('school_admin');
        $this->postJson('/api/v1/auth/otp/request', ['phone' => '09120000001']);

        $code = $this->bruteForceCodeFromSms();
        $this->assertNotNull($code, 'log/array driver must expose the code for tests');

        $response = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '09120000001',
            'code' => $code,
        ]);

        $response->assertOk()
            ->assertJsonPath('token_kind', 'pending-role')
            ->assertJsonPath('roles.0.role_key', 'school_admin')
            ->assertJsonPath('roles.0.school_name', 'دبیرستان مشاهیر');

        $this->assertNotNull($this->user->fresh()->last_login_at);
    }

    public function test_verify_rejects_expired_code(): void
    {
        $this->postJson('/api/v1/auth/otp/request', ['phone' => '09120000001']);
        $code = $this->bruteForceCodeFromSms();

        $this->travel(6)->minutes();

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '09120000001', 'code' => $code])
            ->assertJsonValidationErrors('code');
    }

    public function test_verify_rejects_code_after_max_attempts(): void
    {
        $this->postJson('/api/v1/auth/otp/request', ['phone' => '09120000001']);
        $code = $this->bruteForceCodeFromSms();

        foreach (range(1, 5) as $i) {
            $this->postJson('/api/v1/auth/otp/verify', ['phone' => '09120000001', 'code' => '999998']);
        }

        // Even the correct code is dead now.
        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '09120000001', 'code' => $code])
            ->assertJsonValidationErrors('code');
    }

    public function test_switch_role_issues_working_context_token(): void
    {
        $assignment = $this->assignment('school_admin');
        $this->postJson('/api/v1/auth/otp/request', ['phone' => '09120000001']);
        $code = $this->bruteForceCodeFromSms();

        $pending = $this->postJson('/api/v1/auth/otp/verify', ['phone' => '09120000001', 'code' => $code]);
        $pendingToken = $pending->json('token');

        // The pending token is a GUEST session: context answers with no role,
        // and scoped data routes stay default-deny.
        $this->withToken($pendingToken)->getJson('/api/v1/auth/context')
            ->assertOk()
            ->assertJsonPath('active_role', null);

        $this->withToken($pendingToken)->getJson('/api/v1/students')->assertForbidden();

        $switched = $this->withToken($pendingToken)
            ->postJson('/api/v1/auth/switch-role', ['user_role_id' => $assignment->id]);

        $switched->assertOk()->assertJsonPath('active_role.role_key', 'school_admin');

        $this->app['auth']->forgetGuards();

        $context = $this->withToken($switched->json('token'))->getJson('/api/v1/auth/context');
        $context->assertOk()->assertJsonPath('school.name', 'دبیرستان مشاهیر');
    }

    public function test_switch_role_rejects_someone_elses_assignment(): void
    {
        $other = User::factory()->create();
        $roleId = \DB::table('roles')->whereNull('school_id')->where('key', 'teacher')->value('id');
        $foreign = UserRole::query()->create([
            'user_id' => $other->id,
            'role_id' => $roleId,
            'school_id' => $this->school->id,
            'scope_type' => 'school',
            'scope_id' => null,
        ]);

        $this->assignment('school_admin');
        $this->postJson('/api/v1/auth/otp/request', ['phone' => '09120000001']);
        $code = $this->bruteForceCodeFromSms();
        $pendingToken = $this->postJson('/api/v1/auth/otp/verify', ['phone' => '09120000001', 'code' => $code])->json('token');

        $this->withToken($pendingToken)
            ->postJson('/api/v1/auth/switch-role', ['user_role_id' => $foreign->id])
            ->assertJsonValidationErrors('user_role_id');
    }

    public function test_logout_revokes_the_current_token(): void
    {
        $assignment = $this->assignment('school_admin');
        $token = $this->user->createToken('role-session', ["role:{$assignment->id}"])->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();

        // Sanctum caches the resolved guard inside the test app instance;
        // real requests never share it.
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/v1/auth/context')->assertUnauthorized();
    }

    /**
     * The array SMS driver captures the outbound message; tests extract the
     * code from it. Returns null when nothing was sent.
     */
    private function bruteForceCodeFromSms(): ?string
    {
        foreach (SmsManager::sent() as $message) {
            if (preg_match('/(\d{6})/', $message['message'], $m)) {
                return $m[1];
            }
        }

        return null;
    }
}
