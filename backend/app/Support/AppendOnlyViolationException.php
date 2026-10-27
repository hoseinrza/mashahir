<?php

namespace App\Support;

use RuntimeException;

final class AppendOnlyViolationException extends RuntimeException
{
    public static function cannotUpdate(string $modelClass): self
    {
        return new self("[{$modelClass}] is append-only; rows may never be updated.");
    }

    public static function cannotDelete(string $modelClass): self
    {
        return new self("[{$modelClass}] is append-only; rows may never be deleted.");
    }
}
