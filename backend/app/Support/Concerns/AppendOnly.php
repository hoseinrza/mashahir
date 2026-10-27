<?php

namespace App\Support\Concerns;

use App\Support\AppendOnlyViolationException;
use Illuminate\Database\Eloquent\Model;

/**
 * History tables (audit logs, grade changes, attendance changes) are written
 * once and never mutated. This is the model-level guard; the database-level
 * REVOKE (applied in the migration) is the backstop.
 *
 * @mixin Model
 */
trait AppendOnly
{
    public static function bootAppendOnly(): void
    {
        static::updating(function (Model $model): void {
            throw AppendOnlyViolationException::cannotUpdate($model::class);
        });

        static::deleting(function (Model $model): void {
            throw AppendOnlyViolationException::cannotDelete($model::class);
        });
    }
}
