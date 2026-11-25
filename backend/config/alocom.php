<?php

// Alocom (الوکام) — the second online-class provider beside Skyroom.
// Organizer API v2: POST /api/v2/account/auth/login/ bakes a JWT access
// token; events are the classes; enroll returns the participant's entry
// token together with the event_link that opens the class as that user.
// Credentials are PER SCHOOL (the principal stores them in school settings)
// — never global env values.
return [
    // 'alocom' calls the real organizer API; 'fake' returns deterministic
    // results for dev/demo/tests until a school stores real credentials.
    'driver' => env('ALOCOM_DRIVER', 'fake'),

    'base_url' => env('ALOCOM_BASE_URL', 'https://panel.alocom.co'),
    'timeout' => (int) env('ALOCOM_TIMEOUT', 15),

    // The JWT access token is cached per school for this many seconds; an
    // expired token falls back to a fresh login on the next call.
    'token_ttl' => (int) env('ALOCOM_TOKEN_TTL', 300),

    'defaults' => [
        // 0 = no time limit on the Alocom event; the class window is ours.
        'duration' => 0,
        'start_by_admin' => true,
    ],
];
