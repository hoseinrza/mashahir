<?php

namespace App\Support\Sms;

use InvalidArgumentException;

/**
 * Resolves the configured SMS driver. The provider is an open decision in the
 * PRD; drivers are swappable without touching callers.
 */
final class SmsManager
{
    private static ?ArraySmsDriver $arrayDriver = null;

    public static function driver(): SmsDriver
    {
        $name = (string) config('sms.driver', 'log');

        $driver = match ($name) {
            'log' => new LogSmsDriver,
            'array' => self::$arrayDriver ??= new ArraySmsDriver,
            default => throw new InvalidArgumentException("Unknown SMS driver [{$name}]."),
        };

        return $driver;
    }

    public static function send(string $phone, string $message): void
    {
        self::driver()->send($phone, $message);
    }

    /**
     * Test helper: the array driver accumulates across tests via the process
     * singleton; reset it between tests.
     */
    public static function sent(): array
    {
        return self::driver() instanceof ArraySmsDriver
            ? self::driver()->sent()
            : [];
    }

    public static function fake(): void
    {
        config()->set('sms.driver', 'array');
        self::$arrayDriver = new ArraySmsDriver;
    }
}
