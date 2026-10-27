<?php

namespace App\Modules\Identity\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Models\UserRole;
use App\Modules\Identity\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly OtpService $otp)
    {
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

        return response()->json([
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
        ]);
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
