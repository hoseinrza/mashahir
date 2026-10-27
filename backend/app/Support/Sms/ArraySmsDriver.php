<?php

namespace App\Support\Sms;

/**
 * Test driver: captures messages in memory so tests can assert on them.
 */
class ArraySmsDriver implements SmsDriver
{
    /** @var list<array{phone: string, message: string}> */
    private array $sent = [];

    public function send(string $phone, string $message): void
    {
        $this->sent[] = ['phone' => $phone, 'message' => $message];
    }

    /** @return list<array{phone: string, message: string}> */
    public function sent(): array
    {
        return $this->sent;
    }
}
