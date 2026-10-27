<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SmokeTest extends TestCase
{
    public function test_health_endpoint_responds(): void
    {
        $this->get('/up')->assertOk();
    }

    public function test_database_is_postgresql(): void
    {
        $version = DB::selectOne('select version() as version')->version;

        $this->assertStringContainsString('PostgreSQL', $version);
    }

    public function test_redis_cache_is_reachable(): void
    {
        cache()->store('redis')->put('smoke', 'ok', 10);

        $this->assertSame('ok', cache()->store('redis')->get('smoke'));
    }
}
