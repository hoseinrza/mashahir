<?php

// SMS provider is an open PRD decision; drivers are swapped via SMS_DRIVER.
return [
    'driver' => env('SMS_DRIVER', 'log'),

    'otp' => [
        'ttl_minutes' => (int) env('OTP_TTL_MINUTES', 5),
        'digits' => 6,
        'max_attempts' => 5,        // verification attempts per code
        'max_per_phone' => 3,       // requests per window per phone
        'max_per_ip' => 10,         // requests per window per IP
        'window_seconds' => 600,
    ],
];
