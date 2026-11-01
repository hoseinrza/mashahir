<?php

namespace App\Modules\OnlineClasses\Services;

use InvalidArgumentException;
use RuntimeException;

/**
 * Skyroom webservice client — هم‌تراز با نمونه رسمی SkyroomOnline/webservice:
 * درخواست POST با بدنه JSON «{action, params}» به URL سرویس که کلید API
 * بخشی از آن است؛ پاسخ با پوشش «ok/result» یا «ok=false/error_code».
 * ساختار از samples/php/api/Skyroom.php + HttpRequest.php الگو گرفته است.
 *
 * درایور fake همان قرارداد را برای دمو برمی‌گرداند (الگوی درایور SMS).
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

    /**
     * URL سرویس: SKYROOM_URL کامل، یا ساخت خودکار از SKYROOM_API_KEY
     * به شکل https://www.skyroom.online/skyroom/api/{API-KEY} — مطابق README نمونه رسمی.
     */
    public static function serviceUrl(): string
    {
        $url = trim((string) config('skyroom.url'));
        if ($url !== '') {
            return $url;
        }

        $apiKey = trim((string) config('skyroom.api_key'));
        if ($apiKey !== '') {
            return rtrim((string) config('skyroom.service_url', 'https://www.skyroom.online/skyroom/api'), '/').'/'.$apiKey;
        }

        throw new RuntimeException('Skyroom webservice URL تنظیم نشده است (SKYROOM_URL یا SKYROOM_API_KEY).');
    }

    /** ساخت اتاق؛ شناسه اتاق اسکای‌روم برمی‌گردد. */
    public static function createRoom(string $name, string $title): int
    {
        return self::client()->createRoom($name, $title);
    }

    /**
     * لینک ورود مستقیم به اتاق بدون نیاز به حساب اسکای‌روم — کاربر موقت با
     * شناسه رشته‌ای سیستم ما (user_id)، نام نمایشی (nickname) و سطح دسترسی:
     * 1=کاربر عادی، 2=ارائه‌دهنده، 3=اپراتور (ثابت‌های USER_ACCESS_* نمونه رسمی).
     */
    public static function createLoginUrl(int $roomId, string $externalUserId, string $nickname, int $access): string
    {
        return self::client()->createLoginUrl($roomId, $externalUserId, $nickname, $access);
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
    public function createLoginUrl(int $roomId, string $externalUserId, string $nickname, int $access): string;
    public function createUser(string $username, string $nickname): int;
    public function deleteRoom(int $roomId): void;
}

final class RealSkyroomClient implements SkyroomDriver
{
    /**
     * معادل Skyroom::call در نمونه رسمی — ارسال JSON و رمزگشایی پاسخ.
     * خطای شبکه/HTTP/JSON مثل HttpRequest.php استثنا پرتاب می‌کند
     * (برخلاف نمونه، SSL verify غیرفعال نمی‌شود).
     */
    private function call(string $action, array $params = []): mixed
    {
        $response = \Illuminate\Support\Facades\Http::timeout((int) config('skyroom.timeout', 15))
            ->withHeaders(['Accept' => 'application/json', 'Content-Type' => 'application/json'])
            ->post(SkyroomManager::serviceUrl(), ['action' => $action, 'params' => $params])
            ->throw()
            ->json();

        if (! is_array($response)) {
            throw new RuntimeException('پاسخ نامعتبر از سرویس اسکای‌روم.');
        }

        if (($response['ok'] ?? false) !== true) {
            throw new RuntimeException(
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

    public function createLoginUrl(int $roomId, string $externalUserId, string $nickname, int $access): string
    {
        return (string) $this->call('createLoginUrl', [
            'room_id' => $roomId,
            'user_id' => $externalUserId,
            'nickname' => $nickname,
            'access' => $access,
            'language' => (string) config('skyroom.defaults.language', 'fa'),
            'concurrent' => (int) config('skyroom.defaults.concurrent', 1),
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

    public function createLoginUrl(int $roomId, string $externalUserId, string $nickname, int $access): string
    {
        return "https://demo.skyroom.local/room/{$roomId}/entry/{$externalUserId}/access/{$access}";
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
