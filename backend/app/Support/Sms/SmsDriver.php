<?php

namespace App\Support\Sms;

interface SmsDriver
{
    /**
     * Send an SMS to a E.164-ish local number (e.g. 0912...).
     * Must not throw on provider hiccups: failures are queued/retried upstream.
     */
    public function send(string $phone, string $message): void;
}
