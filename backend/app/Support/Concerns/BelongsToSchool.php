<?php

namespace App\Support\Concerns;

use App\Support\SchoolContext;
use App\Support\SchoolContextMissingException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Multi-school isolation: every school-scoped table gets school_id, a global
 * scope keyed to the request's SchoolContext, and an automatic fill on create.
 *
 * Outside the scope means the row does not exist for the caller (404), so
 * this trait must be on every model that has a school_id column.
 *
 * @mixin Model
 */
trait BelongsToSchool
{
    public static function bootBelongsToSchool(): void
    {
        static::addGlobalScope('school', function (Builder $query): void {
            /** @var SchoolContext $context */
            $context = app(SchoolContext::class);

            if ($context->hasOverride()) {
                return;
            }

            $schoolId = $context->schoolId();

            if ($schoolId === null) {
                throw SchoolContextMissingException::forModel($query->getModel()::class);
            }

            $query->where($query->getModel()->qualifyColumn('school_id'), $schoolId);
        });

        static::creating(function (Model $model): void {
            /** @var SchoolContext $context */
            $context = app(SchoolContext::class);

            $model->school_id ??= $context->schoolId();
        });
    }

    public function school(): BelongsTo
    {
        /** @var class-string<Model> $related */
        $related = \App\Modules\School\Models\School::class;

        return $this->belongsTo($related);
    }
}
