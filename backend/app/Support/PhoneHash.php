<?php

namespace App\Support;

/**
 * Deterministic keyed hash of a phone number for lookup and uniqueness.
 * The plaintext number is stored encrypted; only the hash is searchable.
 */
final class PhoneHash
{
    public static function of(string $phone): string
    {
        return hash_hmac('sha256', self::normalize($phone), (string) config('app.key'));
    }

    public static function normalize(string $phone): string
    {
        $digits = preg_replace('/[^0-9]/', '', self::toAsciiDigits($phone));

        return $digits;
    }

    private static function toAsciiDigits(string $value): string
    {
        $persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        $arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

        return str_replace($persian, range(0, 9), str_replace($arabic, range(0, 9), $value));
    }
}
