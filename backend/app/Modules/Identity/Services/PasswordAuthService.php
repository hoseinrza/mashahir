<?php

namespace App\Modules\Identity\Services;

use App\Modules\Identity\Models\User;
use App\Support\PhoneHash;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Phone+password login beside the SMS OTP path: the username IS the mobile
 * number, so brute-force protection is the whole story. Failures share one
 * generic message — the endpoint never reveals which accounts exist.
 */
final class PasswordAuthService
{
    public function login(string $phone, string $password, string $ip): array
    {
        $config = config('password_login');
        $phoneHash = PhoneHash::of($phone);

        // Throttle before any lookup — probing an unregistered number costs
        // exactly the same as probing a registered one.
        if (! RateLimiter::attempt(
            'password-ip:'.$ip,
            $config['max_per_ip'],
            fn () => true,
            $config['window_seconds'],
        )) {
            throw new ThrottleRequestsException('تعداد درخواست‌ها بیش از حد مجاز است.');
        }

        if (! RateLimiter::attempt(
            'password-phone:'.$phoneHash,
            $config['max_per_phone'],
            fn () => true,
            $config['window_seconds'],
        )) {
            throw new ThrottleRequestsException('تعداد درخواست‌ها بیش از حد مجاز است.');
        }

        $user = User::query()
            ->where('phone_hash', $phoneHash)
            ->where('status', 'active')
            ->first();

        if ($user === null || $user->password === null || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'phone' => 'اطلاعات ورود نادرست است.',
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        return [$user, $user->createToken('password-login', ['pending-role'])];
    }
}
