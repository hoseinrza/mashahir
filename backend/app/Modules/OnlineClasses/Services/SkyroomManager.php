<?php

namespace App\Modules\OnlineClasses\Services;

use InvalidArgumentException;

/**
 * Skyroom webservice client. Action-based JSON over POST; API key is part
 * of the endpoint URL. A fake driver keeps dev/demo working without a
 * provider account (same shape as the SMS driver pattern).
 */
final class SkyroomManager
{
    private static ?FakeSkyroomClient $fake = null;

    public static function client(): object
    {
        $driver = (string) config('skyroom.driver', 'fake');

        return match ($driver) {
            'skyroom' => new RealSkyroomClient,
            'fake' => self::$fake ??= new FakeSkyroomClient,
            default => throw new InvalidArgumentException("Unknown Skyroom driver [{$driver}]."),
        };
    }

    /** ساخت اتاق؛ شناسه اتاق اسکای‌روم برمی‌گردد. */
    public static function createRoom(string $name, string $title): int
    {
        return self::client()->createRoom($name, $title);
    }

    /** لینک ورود مستقیم کاربر به اتاق (بدون نیاز به لاگین اسکای‌روم). */
    public static function createLoginUrl(int $roomId, string $skyroomUserId, string $nickname, int $access): string
    {
        return self::client()->createLoginUrl($roomId, $skyroomUserId, $nickname, $access);
    }

    public static function createUser(string $username, string $nickname): int
    {
        return self::client()->createUser($username, $nickname);
    }

    public static function deleteRoom(int $roomId): void
    {
        self::client()->deleteRoom($roomId);
    }

    /** ساخت نام اتاق یکتا و لاتین از ULID سامانه. */
    public static function roomName(string $ulid): string
    {
        return 'cls_' . strtolower(preg_replace('/[^A-Za-z0-9]/', '', $ulid));
    }
}

interface SkyroomDriver
{
    public function createRoom(string $name, string $title): int;
    public function createLoginUrl(int $roomId, string $skyroomUserId, string $nickname, int $access): string;
    public function createUser(string $username, string $nickname): int;
    public function deleteRoom(int $roomId): void;
}

final class RealSkyroomClient implements SkyroomDriver
{
    private function call(string $action, array $params = []): mixed
    {
        $url = (string) config('skyroom.url');
        if ($url === '') {
            throw new \RuntimeException('Skyroom webservice URL تنظیم نشده است.');
        }

        $response = \Illuminate\Support\Facades\Http::timeout((int) config('skyroom.timeout', 15))
            ->post($url, ['action' => $action, 'params' => $params])
            ->throw()
            ->json();

        if (($response['ok'] ?? false) !== true) {
            throw new \RuntimeException(
                'Skyroom error ' . ($response['error_code'] ?? '?') . ': ' . ($response['error_message'] ?? 'نامشخص'),
            );
        }

        return $response['result'] ?? null;
    }

    public function createRoom(string $name, string $title): int
    {
        return (int) $this->call('createRoom', [
            'name' => $name,
            'title' => $title,
            'max_users' => (int) config('skyroom.defaults.max_users', 60),
            'guest_login' => (bool) config('skyroom.defaults.guest_login', false),
        ]);
    }

    public function createLoginUrl(int $roomId, string $skyroomUserId, string $nickname, int $access): string
    {
        return (string) $this->call('createLoginUrl', [
            'room_id' => $roomId,
            'user_id' => $skyroomUserId,
            'nickname' => $nickname,
            'access' => $access, // 1=user, 2=presenter, 3=operator
            'language' => config('skyroom.defaults.language', 'fa'),
            'ttl' => (int) config('skyroom.defaults.ttl', 3600),
        ]);
    }

    public function createUser(string $username, string $nickname): int
    {
        return (int) $this->call('createUser', [
            'username' => $username,
            'password' => \Illuminate\Support\Str::random(16),
            'nickname' => $nickname,
            'is_public' => false,
        ]);
    }

    public function deleteRoom(int $roomId): void
    {
        $this->call('deleteRoom', ['room_id' => $roomId]);
    }
}

final class FakeSkyroomClient implements SkyroomDriver
{
    public function createRoom(string $name, string $title): int
    {
        return crc32($name);
    }

    public function createLoginUrl(int $roomId, string $skyroomUserId, string $nickname, int $access): string
    {
        return "https://demo.skyroom.local/room/{$roomId}/entry/{$skyroomUserId}/access/{$access}";
    }

    public function createUser(string $username, string $nickname): int
    {
        return crc32($username);
    }

    public function deleteRoom(int $roomId): void
    {
        // nothing to clean in the fake provider
    }
}
