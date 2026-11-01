<?php

namespace Tests\Feature\Modules;

use App\Modules\OnlineClasses\Services\SkyroomManager;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

/**
 * قرارداد کلاینت واقعی اسکای‌روم باید با نمونه رسمی SkyroomOnline/webservice
 * یکی باشد: POST با بدنه JSON «{action, params}» به URL حاوی کلید API،
 * پوشش پاسخ «ok/result» یا «ok=false/error_code/error_message».
 */
class SkyroomClientTest extends TestCase
{
    public function test_service_url_is_built_from_api_key(): void
    {
        config(['skyroom.url' => null, 'skyroom.api_key' => 'ABCD-1234-EFGH']);

        $this->assertSame(
            'https://www.skyroom.online/skyroom/api/ABCD-1234-EFGH',
            SkyroomManager::serviceUrl(),
        );
    }

    public function test_service_url_without_configuration_throws(): void
    {
        config(['skyroom.url' => null, 'skyroom.api_key' => null]);

        $this->expectException(RuntimeException::class);
        SkyroomManager::serviceUrl();
    }

    public function test_create_room_sends_official_action_envelope_and_returns_result(): void
    {
        config(['skyroom.driver' => 'skyroom', 'skyroom.url' => 'https://www.skyroom.online/skyroom/api/KEY']);

        Http::fake([
            'https://www.skyroom.online/skyroom/api/KEY' => Http::response(['ok' => true, 'result' => 12345]),
        ]);

        $roomId = SkyroomManager::createRoom('cls_test', 'کلاس ریاضی');

        $this->assertSame(12345, $roomId);

        Http::assertSent(function ($request) {
            $body = $request->data();

            return $request->url() === 'https://www.skyroom.online/skyroom/api/KEY'
                && $request->hasHeader('Content-Type', 'application/json')
                && ($body['action'] ?? null) === 'createRoom'
                && $body['params']['name'] === 'cls_test'
                && $body['params']['title'] === 'کلاس ریاضی'
                && isset($body['params']['max_users']);
        });
    }

    public function test_create_login_url_matches_official_sample_params(): void
    {
        config(['skyroom.driver' => 'skyroom', 'skyroom.url' => 'https://www.skyroom.online/skyroom/api/KEY']);

        // نمونه رسمی: room_id + user_id رشته‌ای + nickname + access + language + concurrent + ttl
        Http::fake(['*' => Http::response(['ok' => true, 'result' => 'https://room.skyroom.online/entry?x=1'])]);

        $url = SkyroomManager::createLoginUrl(77, 'u42', 'پارسا رادمنش', 1);

        $this->assertSame('https://room.skyroom.online/entry?x=1', $url);

        Http::assertSent(function ($request) {
            $body = $request->data();
            $params = $body['params'] ?? [];

            return ($body['action'] ?? null) === 'createLoginUrl'
                && $params['room_id'] === 77
                && $params['user_id'] === 'u42'
                && $params['nickname'] === 'پارسا رادمنش'
                && $params['access'] === 1
                && $params['language'] === 'fa'
                && $params['concurrent'] === 1
                && $params['ttl'] === 3600;
        });
    }

    public function test_error_envelope_raises_with_provider_code_and_message(): void
    {
        config(['skyroom.driver' => 'skyroom', 'skyroom.url' => 'https://www.skyroom.online/skyroom/api/KEY']);

        Http::fake(['*' => Http::response([
            'ok' => false,
            'error_code' => 1001,
            'error_message' => 'invalid api key',
        ])]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Skyroom error 1001: invalid api key');

        SkyroomManager::createRoom('cls_x', 'عنوان');
    }

    public function test_invalid_json_response_raises(): void
    {
        config(['skyroom.driver' => 'skyroom', 'skyroom.url' => 'https://www.skyroom.online/skyroom/api/KEY']);

        Http::fake(['*' => Http::response('not-json', 200)]);

        $this->expectException(RuntimeException::class);
        SkyroomManager::deleteRoom(1);
    }

    public function test_http_failure_raises(): void
    {
        config(['skyroom.driver' => 'skyroom', 'skyroom.url' => 'https://www.skyroom.online/skyroom/api/KEY']);

        Http::fake(['*' => Http::response('server exploded', 500)]);

        $this->expectException(\Illuminate\Http\Client\RequestException::class);
        SkyroomManager::deleteRoom(1);
    }
}
