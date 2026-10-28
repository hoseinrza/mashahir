<?php

// Skyroom (سامانه کلاس آنلاین ایرانی) — webservice is action-based JSON
// POSTed to https://www.skyroom.online/skyroom/api/{API-KEY}.
return [
    // 'skyroom' calls the real webservice; 'fake' returns deterministic
    // results for dev/demo until the provider account is ready.
    'driver' => env('SKYROOM_DRIVER', 'fake'),

    'url' => env('SKYROOM_URL'),
    'timeout' => (int) env('SKYROOM_TIMEOUT', 15),

    'defaults' => [
        'max_users' => (int) env('SKYROOM_MAX_USERS', 60),
        'guest_login' => false,
        'ttl' => 3600,
        'language' => 'fa',
    ],
];
