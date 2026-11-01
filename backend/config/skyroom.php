<?php

// Skyroom (سامانه کلاس آنلاین ایرانی) — webservice is action-based JSON
// POSTed to https://www.skyroom.online/skyroom/api/{API-KEY}
// (samples/php of SkyroomOnline/webservice).
return [
    // 'skyroom' calls the real webservice; 'fake' returns deterministic
    // results for dev/demo until the provider account is ready.
    'driver' => env('SKYROOM_DRIVER', 'fake'),

    // Full service URL including the API key. When empty, it is built from
    // SKYROOM_API_KEY below.
    'url' => env('SKYROOM_URL'),
    'api_key' => env('SKYROOM_API_KEY'),
    'service_url' => env('SKYROOM_SERVICE_URL', 'https://www.skyroom.online/skyroom/api'),

    'timeout' => (int) env('SKYROOM_TIMEOUT', 15),

    'defaults' => [
        'max_users' => (int) env('SKYROOM_MAX_USERS', 60),
        'guest_login' => false,
        'ttl' => 3600,
        'language' => 'fa',
        'concurrent' => 1,
    ],
];
