<?php

namespace App\Modules\OnlineClasses\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Alocom organizer API v2 client (الوکام) — the second online-class provider
 * beside Skyroom. Credentials belong to the SCHOOL (stored in school
 * settings by the principal); every call logs in with them and uses the JWT
 * `access` token. Envelope: {message, code, data, error_message}, where
 * error_message is a list of {key, message, internal_code, reason, params}.
 *
 * Classes are Alocom "events": POST /api/v2/event/events/ creates one with a
 * slug we derive from the class ULID, and POST /events/{id}/enroll/ adds a
 * participant (role teacher|assistant|participant) answering with the entry
 * `token` and the `event_link` that opens the class AS THAT USER.
 */
final class AlocomManager
{
    /** @var array<string, AlocomDriver> per-username clients (school-scoped cache lives inside) */
    private static array $clients = [];

    public static function clientFor(?int $schoolId, string $username, string $password): AlocomDriver
    {
        $driver = (string) config('alocom.driver', 'fake');

        return match ($driver) {
            'alocom' => new RealAlocomClient($schoolId, $username, $password),
            'fake' => new FakeAlocomClient($username, $password),
            default => throw new RuntimeException("Unknown Alocom driver [{$driver}]."),
        };
    }

    /**
     * Live connection check used by school settings: logs in, reads the
     * profile and returns the account's display name.
     */
    public static function verify(string $username, string $password): string
    {
        return self::clientFor(null, $username, $password)->verify();
    }

    /** Create the event of a class; returns [provider event uuid, class link]. */
    public static function createEvent(int $schoolId, string $username, string $password, string $title, string $slug): array
    {
        return self::clientFor($schoolId, $username, $password)->createEvent($title, $slug);
    }

    public static function deleteEvent(int $schoolId, string $username, string $password, string $eventId): void
    {
        self::clientFor($schoolId, $username, $password)->deleteEvent($eventId);
    }

    /** Enroll (idempotent) and return the event_link that opens the class for that user. */
    public static function enterLink(
        int $schoolId,
        string $username,
        string $password,
        string $eventId,
        string $participantUsername,
        string $firstName,
        string $lastName,
        string $role,
    ): string {
        return self::clientFor($schoolId, $username, $password)
            ->enterLink($eventId, $participantUsername, $firstName, $lastName, $role);
    }

    /** Stable, URL-safe slug for an event: cls_ + lowercase ULID. */
    public static function eventSlug(string $ulid): string
    {
        return 'cls_' . strtolower(preg_replace('/[^A-Za-z0-9_]/', '', $ulid));
    }

    public static function translateError(?string $internalCode, ?string $message): string
    {
        return match ($internalCode) {
            'USER_PASSWORD_WRONG' => 'نام کاربری یا رمز الوکام نادرست است.',
            'CAPTCHA_REQUIRED', 'CAPTCHA_INVALID' => 'الوکام موقتاً کپچا می‌خواهد؛ کمی بعد دوباره تلاش کنید یا با پشتیبانی الوکام تماس بگیرید.',
            'TOO_MANY_ATTEMPTS' => 'تلاش‌های ناموفق زیاد بوده است؛ چند دقیقه بعد دوباره تلاش کنید.',
            'EVENT_NOT_STARTED' => 'کلاس هنوز در الوکام شروع نشده است؛ کمی بعد دوباره وارد شوید.',
            'EVENT_NOT_FOUND' => 'این کلاس در الوکام پیدا نشد.',
            'PARTICIPANT_NOT_FOUND' => 'حساب شما در الوکامِ مدرسه پیدا نشد؛ با مدیر مدرسه هماهنگ کنید.',
            'ALOCOM_NOT_LINKED' => 'سرویس کلاس الوکام به مدرسه متصل نیست؛ اشتراک الوکام را در پنل الوکام بررسی کنید.',
            'ALOCOM_UNAVAILABLE' => 'سرویس الوکام موقتاً در دسترس نیست؛ کمی بعد دوباره تلاش کنید.',
            'ALOCOM_REJECTED' => 'الوکام درخواست را نپذیرفت' . ($message ? ': ' . $message : ''),
            'NO_USABLE_ORGANIZER_SERVICE' => 'اشتراک فعال کلاس در الوکام وجود ندارد؛ بستهٔ سرویس مدرسه را بررسی کنید.',
            'LIMITED_SERVICE_EVENTS_LIMIT_REACHED' => 'سقف کلاس‌های بستهٔ محدود الوکام پر شده است.',
            'EVENT_DURATION_EXCEEDS_LIMIT' => 'مدت کلاس از سقف اشتراک الوکام بیشتر است.',
            default => $message !== null && $message !== '' ? $message : 'خطای الوکام' . ($internalCode ? ' (' . $internalCode . ')' : ''),
        };
    }
}

interface AlocomDriver
{
    /** Login + profile read; returns the account's display name. */
    public function verify(): string;

    /** @return array{0:string,1:string} [event uuid, event link] */
    public function createEvent(string $title, string $slug): array;

    public function deleteEvent(string $eventId): void;

    public function enterLink(string $eventId, string $username, string $firstName, string $lastName, string $role): string;
}

final class RealAlocomClient implements AlocomDriver
{
    public function __construct(
        private readonly ?int $schoolId,
        private readonly string $username,
        private readonly string $password,
    ) {
    }

    /** JWT access token — cached per school, refreshed once on 401. */
    private function token(bool $force = false): string
    {
        $key = 'alocom_token:' . ($this->schoolId ?? crc32($this->username));
        if ($force) {
            Cache::forget($key);
        }

        return (string) Cache::remember($key, (int) config('alocom.token_ttl', 300), function (): string {
            $response = Http::timeout((int) config('alocom.timeout', 15))
                ->acceptJson()
                ->post($this->url('account/auth/login/'), [
                    'username' => $this->username,
                    'password' => $this->password,
                ]);

            $payload = $this->decode($response->json());

            // Two-step login enabled on the account: the token never arrives
            // without an SMS code — automatic connection is impossible.
            if (($payload['two_factor_required'] ?? false) === true) {
                throw new RuntimeException('ورود دو مرحله‌ای الوکام روشن است؛ برای اتصال خودکار، آن را در پنل الوکام خاموش کنید یا از API key استفاده کنید.');
            }

            $this->throwOnError($response->status(), $payload);

            $access = $payload['data']['access'] ?? null;
            if (! is_string($access) || $access === '') {
                throw new RuntimeException('پاسخ ورود الوکام توکن نداشت.');
            }

            return $access;
        });
    }

    private function url(string $path): string
    {
        return rtrim((string) config('alocom.base_url', 'https://panel.alocom.co'), '/') . '/api/v2/' . $path;
    }

    /** @return array<string,mixed> */
    private function decode(mixed $json): array
    {
        if (! is_array($json)) {
            throw new RuntimeException('پاسخ نامعتبر از سرویس الوکام.');
        }

        return $json;
    }

    /** @param array<string,mixed> $payload */
    private function throwOnError(int $status, array $payload): void
    {
        $errors = $payload['error_message'] ?? null;
        $first = is_array($errors) && isset($errors[0]) ? $errors[0] : null;
        $internal = is_string($first['internal_code'] ?? null) ? $first['internal_code'] : null;
        $message = is_string($first['message'] ?? null) ? $first['message'] : null;

        if ($status >= 200 && $status < 300 && ! is_array($first)) {
            return;
        }

        throw new RuntimeException(AlocomManager::translateError($internal, $message));
    }

    /** Authenticated JSON call with one re-login on an expired token. */
    private function call(string $method, string $path, array $body = [], bool $retried = false): array
    {
        $response = Http::timeout((int) config('alocom.timeout', 15))
            ->acceptJson()
            ->withToken($this->token())
            ->send($method, $this->url($path), ['json' => $body]);

        // Expired/revoked token: refresh once and repeat the exact call.
        if (in_array($response->status(), [401, 403], true) && ! $retried) {
            $this->token(true);

            return $this->call($method, $path, $body, true);
        }

        $payload = $this->decode($response->json());
        $this->throwOnError($response->status(), $payload);

        return is_array($payload['data'] ?? null) ? $payload['data'] : [];
    }

    public function verify(): string
    {
        // Login itself proves the credentials; the profile call proves the
        // token works. A plain /me read keeps the check honest.
        $this->token(true);

        $me = $this->call('GET', 'account/auth/me/');
        $name = trim(($me['first_name'] ?? '') . ' ' . ($me['last_name'] ?? ''));

        return $name !== '' ? $name : (string) ($me['username'] ?? $this->username);
    }

    public function createEvent(string $title, string $slug): array
    {
        $event = $this->call('POST', 'event/events/', [
            'title' => $title,
            'slug' => $slug,
            'status' => true,
            'start_by_admin' => (bool) config('alocom.defaults.start_by_admin', true),
            'duration' => (int) config('alocom.defaults.duration', 0),
        ]);

        $id = $event['id'] ?? null;
        if (! is_string($id) || $id === '') {
            throw new RuntimeException('الوکام شناسهٔ کلاس را برنگرداند.');
        }

        return [$id, (string) ($event['alocom_link'] ?? '')];
    }

    public function deleteEvent(string $eventId): void
    {
        $this->call('DELETE', 'event/events/' . $eventId . '/');
    }

    public function enterLink(string $eventId, string $username, string $firstName, string $lastName, string $role): string
    {
        $result = $this->call('POST', 'event/events/' . $eventId . '/enroll/', [
            'username' => $username,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'role' => $role,
        ]);

        // event_link opens the class as this participant; token is the
        // fallback the dashboard hands to the Alocom app entry screen.
        $link = $result['event_link'] ?? null;
        if (is_string($link) && $link !== '') {
            return $link;
        }

        $token = $result['token'] ?? null;
        if (is_string($token) && $token !== '') {
            return $token;
        }

        throw new RuntimeException('الوکام لینک ورود را برنگرداند.');
    }
}

final class FakeAlocomClient implements AlocomDriver
{
    public function __construct(
        private readonly string $username,
        private readonly string $password,
    ) {
    }

    public function verify(): string
    {
        if ($this->password === 'bad') {
            throw new RuntimeException('نام کاربری یا رمز الوکام نادرست است.');
        }

        return 'حساب آزمایشی الوکام (' . $this->username . ')';
    }

    public function createEvent(string $title, string $slug): array
    {
        $id = 'evt-' . substr(md5($slug), 0, 16);

        return [$id, 'https://demo.alocom.local/event/' . $id];
    }

    public function deleteEvent(string $eventId): void
    {
        // nothing to clean in the fake provider
    }

    public function enterLink(string $eventId, string $username, string $firstName, string $lastName, string $role): string
    {
        return 'https://demo.alocom.local/event/' . $eventId . '/entry/' . $username . '/' . $role;
    }
}
