<?php

namespace App\Support;

use RuntimeException;

final class SchoolContextMissingException extends RuntimeException
{
    public static function forModel(string $modelClass): self
    {
        return new self(
            "No school context is set. A query on [{$modelClass}] without an active school is not allowed; "
            .'set the context or explicitly opt out with SchoolContext::override().'
        );
    }
}
