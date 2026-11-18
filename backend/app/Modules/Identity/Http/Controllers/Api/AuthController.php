<?php

namespace App\Modules\Identity\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Models\UserRole;
use App\Modules\Identity\Services\OtpService;
use App\Modules\Identity\Services\PasswordAuthService;
use App\Modules\School\Models\School;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function __construct(
        private readonly OtpService $otp,
        private readonly PasswordAuthService $passwordAuth,
    ) {
    }

    /**
     * Always answers with the same generic message — the endpoint never
     * reveals whether a phone number is registered.
     */
    public function requestOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'min:10', 'max:20'],
        ]);

        $this->otp->request($data['phone'], (string) $request->ip());

        return response()->json([
            'message' => 'اگر شماره در سامانه ثبت شده باشد، کد ورود ارسال شد.',
        ]);
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'min:10', 'max:20'],
            'code' => ['required', 'digits:6'],
        ]);

        [$user, $token] = $this->otp->verify($data['phone'], $data['code']);

        return response()->json($this->pendingRolePayload($user, $token));
    }

    /**
     * Password login (username = the mobile number). Issues the SAME
     * pending-role bootstrap token as OTP verify, so the frontend's
     * role-selection flow treats both paths identically.
     */
    public function loginWithPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'min:10', 'max:20'],
            'password' => ['required', 'string'],
        ]);

        [$user, $token] = $this->passwordAuth->login($data['phone'], $data['password'], (string) $request->ip());

        return response()->json($this->pendingRolePayload($user, $token));
    }

    /**
     * Public: the login page reads this to decide whether the SMS-OTP option
     * is offered at all (a school can switch OTP off in its settings). The
     * per-user verdict is still enforced server-side at request/verify time.
     */
    public function authConfig(): JsonResponse
    {
        $otpEnabled = School::query()
            ->where('is_active', true)
            ->get()
            ->contains(fn (School $school) => $school->otpLoginEnabled());

        return response()->json(['otp_enabled' => $otpEnabled]);
    }

    /**
     * Self-service: the logged-in user creates or replaces his own password
     * (username = his mobile number). First-time setup needs no current
     * password; replacing one requires it.
     */
    public function setPassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'password' => ['required', 'string', 'min:8', 'max:64'],
            'current_password' => [
                Rule::requiredIf($user->password !== null),
                'nullable',
                'string',
            ],
        ]);

        if ($user->password !== null && ! Hash::check((string) $data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'رمز فعلی نادرست است.',
            ]);
        }

        $user->forceFill(['password' => $data['password']])->save();

        app(AuditService::class)->log(
            'auth.password_set',
            $user,
            new: ['password' => '***masked***'],
        );

        return response()->json(['message' => 'رمز عبور ذخیره شد.']);
    }

    private function pendingRolePayload($user, $token): array
    {
        return [
            'token' => $token->plainTextToken,
            // Bootstrap token: not yet bound to a role, cannot call scoped APIs.
            'token_kind' => 'pending-role',
            'roles' => $user->userRoles()->active()
                ->with(['role', 'school'])
                ->get()
                ->map(fn (UserRole $assignment) => [
                    'id' => $assignment->id,
                    'role_key' => $assignment->role->key,
                    'role_title' => $assignment->role->title,
                    'scope_type' => $assignment->scope_type,
                    'school_ulid' => $assignment->school->ulid,
                    'school_name' => $assignment->school->name,
                ])
                ->values(),
        ];
    }

    /**
     * Bootstrap of the role context: ownership + activeness checks here
     * replace the permission gate, because no role context exists yet.
     */
    public function switchRole(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_role_id' => ['required', 'integer'],
        ]);

        $assignment = UserRole::query()
            ->with('role', 'school')
            ->where('user_id', $request->user()->id)
            ->active()
            ->find($data['user_role_id']);

        if ($assignment === null) {
            throw ValidationException::withMessages([
                'user_role_id' => 'نقش انتخابی در دسترس نیست.',
            ]);
        }

        $request->user()->currentAccessToken()?->delete();

        $token = $request->user()->createToken('role-session', ["role:{$assignment->id}"]);

        return response()->json([
            'token' => $token->plainTextToken,
            'active_role' => [
                'id' => $assignment->id,
                'role_key' => $assignment->role->key,
                'role_title' => $assignment->role->title,
                'scope_type' => $assignment->scope_type,
                'school_ulid' => $assignment->school->ulid,
                'school_name' => $assignment->school->name,
            ],
        ]);
    }

    public function logout(Request $request): \Illuminate\Http\Response
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->noContent();
    }
}
