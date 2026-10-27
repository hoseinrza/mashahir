<?php

namespace App\Support\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Non-guessable external identifier: numeric bigint primary key stays
 * internal; `ulid` is the only identifier exposed in URLs and API responses.
 *
 * @mixin Model
 */
trait HasUlid
{
    public static function bootHasUlid(): void
    {
        static::creating(function (Model $model): void {
            if (empty($model->ulid)) {
                $model->ulid = (string) Str::ulid();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }

    public function getRouteKey(): mixed
    {
        return $this->ulid;
    }
}
