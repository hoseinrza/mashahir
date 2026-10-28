<?php

namespace App\Modules\Family\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConsentRequest extends Model
{
    use BelongsToSchool;
    use HasUlid;

    public const POLICY_ONE_PARENT = 'one_parent';
    public const POLICY_BOTH_PARENTS = 'both_parents';

    protected $fillable = [
        'student_id', 'title', 'body', 'policy', 'due_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\People\Models\Student::class);
    }

    public function responses(): HasMany
    {
        return $this->hasMany(ConsentResponse::class);
    }

    /**
     * FR: سياست مدرسه — برآورده شدن از روی سطرهای پاسخ محاسبه می‌شود.
     */
    public function isSatisfied(): bool
    {
        $approved = $this->responses->where('decision', ConsentResponse::DECISION_APPROVED)->count();

        return $this->policy === self::POLICY_ONE_PARENT
            ? $approved >= 1
            : $approved >= 2;
    }
}
