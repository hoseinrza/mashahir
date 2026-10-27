<?php

namespace App\Modules\Identity\Services;

use App\Modules\Identity\Models\LoginCode;
use App\Modules\Identity\Models\User;
use App\Support\PhoneHash;
use App\Support\Sms\SmsManager;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * SMS OTP login: the only authentication path in the system.
 * Codes are stored hashed, expire quickly, and are attempt-capped.
 */
final class OtpService
{
    /**
     * Request a login code. Responds silently for unknown numbers so the
     * endpoint never reveals which phones are registered.
     */
    public function request(string $phone, string $ip): void
    {
        $config = config('sms.otp');

        if (! RateLimiter::attempt(
            'otp-ip:'.$ip,
            $config['max_per_ip'],
            fn () => true,
            $config['window_seconds'],
        )) {
            throw new ThrottleRequestsException('تعداد درخواست‌ها بیش از حد مجاز است.');
        }

        $phoneHash = PhoneHash::of($phone);

        $user = User::query()
            ->where('phone_hash', $phoneHash)
            ->where('status', 'active')
            ->first();

        if ($user === null) {
            return;
        }

        if (! RateLimiter::attempt(
            'otp-phone:'.$phoneHash,
            $config['max_per_phone'],
            fn () => true,
            $config['window_seconds'],
        )) {
            throw new ThrottleRequestsException('تعداد درخواست‌ها بیش از حد مجاز است.');
        }

        $code = str_pad((string) random_int(0, 10 ** $config['digits'] - 1), $config['digits'], '0', STR_PAD_LEFT);

        LoginCode::query()->create([
            'user_id' => $user->id,
            'phone_hash' => $phoneHash,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes($config['ttl_minutes']),
            'ip' => $ip,
        ]);

        SmsManager::send(PhoneHash::normalize($phone), "کد ورود شما: {$code}");
    }

    /**
     * Verify a code and issue a pending-role token. All failures surface as
     * one generic validation error — no hints about what was wrong.
     *
     * @return array{0: User, 1: \Laravel\Sanctum\NewAccessToken}
     */
    public function verify(string $phone, string $code): array
    {
        $config = config('sms.otp');
        $phoneHash = PhoneHash::of($phone);

        $user = User::query()
            ->where('phone_hash', $phoneHash)
            ->where('status', 'active')
            ->first();

        $loginCode = $user?->id === null ? null : LoginCode::query()
            ->where('user_id', $user->id)
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->orderByDesc('id')
            ->first();

        if ($loginCode === null || $loginCode->attempts >= $config['max_attempts']) {
            throw $this->invalid();
        }

        $loginCode->increment('attempts');

        if (! Hash::check($code, $loginCode->code_hash)) {
            throw $this->invalid();
        }

        $loginCode->forceFill(['consumed_at' => now()])->save();
        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        return [$user, $user->createToken('otp-login', ['pending-role'])];
    }

    private function invalid(): ValidationException
    {
        return ValidationException::withMessages([
            'code' => 'کد ورود نامعتبر است.',
        ]);
    }
}
