<?php

namespace App\Modules\Pta\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * نظرسنجی انجمن: گزینه‌ها در ستون jsonb و سیاست رأی per_guardian / per_family.
 */
class PtaSurvey extends Model
{
    use BelongsToSchool;
    use HasUlid;

    public const POLICY_PER_GUARDIAN = 'per_guardian';
    public const POLICY_PER_FAMILY = 'per_family';

    protected $fillable = ['title', 'description', 'options', 'policy', 'closes_at', 'is_active', 'created_by'];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'closes_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function votes(): HasMany
    {
        return $this->hasMany(PtaVote::class);
    }

    public function isOpen(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        return $this->closes_at === null || now()->lte($this->closes_at);
    }
}
