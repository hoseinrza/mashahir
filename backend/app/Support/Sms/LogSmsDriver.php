<?php

namespace App\Support\Sms;

use Illuminate\Support\Facades\Log;

/**
 * Development driver: SMS content lands in the log instead of a provider.
 */
class LogSmsDriver implements SmsDriver
{
    public function send(string $phone, string $message): void
    {
        Log::info('SMS (log driver)', ['phone' => $phone, 'message' => $message]);
    }
}
