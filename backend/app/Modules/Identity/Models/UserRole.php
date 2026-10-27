<?php

namespace App\Modules\Identity\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A role assignment with scope: school-wide, a single classroom, or a single
 * student. ends_on is evaluated on every request — no scheduler needed.
 */
class UserRole extends Model
{
    public const SCOPE_SCHOOL = 'school';
    public const SCOPE_CLASSROOM = 'classroom';
    public const SCOPE_STUDENT = 'student';

    protected $fillable = ['user_id', 'role_id', 'school_id', 'scope_type', 'scope_id', 'starts_on', 'ends_on'];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\School\Models\School::class);
    }

    /**
     * Started and not ended as of today (UTC date).
     */
    public function scopeActive(Builder $query): Builder
    {
        $today = now()->toDateString();

        return $query
            ->where(fn (Builder $q) => $q->whereNull('starts_on')->orWhere('starts_on', '<=', $today))
            ->where(fn (Builder $q) => $q->whereNull('ends_on')->orWhere('ends_on', '>=', $today));
    }
}
