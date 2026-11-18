<?php

// Phone+password login (beside SMS OTP): username is the mobile number, so
// only brute-force protection lives here. Counters are independent of the
// OTP limiters.
return [
    'max_per_phone' => (int) env('PASSWORD_LOGIN_MAX_PER_PHONE', 5),
    'max_per_ip' => (int) env('PASSWORD_LOGIN_MAX_PER_IP', 20),
    'window_seconds' => (int) env('PASSWORD_LOGIN_WINDOW_SECONDS', 600),
];
