<?php

namespace App\Support;

use App\Modules\Identity\Models\User;

/**
 * Decrypts the stored phone for outbound SMS (the raw column is encrypted).
 */
final class PhoneOf
{
    public static function user(User $user): string
    {
        return PhoneHash::normalize((string) $user->phone);
    }
}
