<?php

namespace App\Modules\People\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Guardian–student link with per-link permission flags. Guardians NEVER
 * inherit flags from each other: two separated guardians are two rows.
 */
class GuardianLink extends Model
{
    use BelongsToSchool;

    public const STATUS_PENDING = 'pending';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_ENDED = 'ended';
    public const STATUS_REJECTED = 'rejected';

    public const TYPE_PRIMARY = 'primary';
    public const TYPE_SECOND = 'second';
    public const TYPE_SEPARATED_JOINT = 'separated_joint';
    public const TYPE_SEPARATED_LIMITED = 'separated_limited';
    public const TYPE_LEGAL_GUARDIAN = 'legal_guardian';
    public const TYPE_TEMPORARY = 'temporary';
    public const TYPE_PICKUP_ONLY = 'pickup_only';

    protected $fillable = [
        'guardian_user_id', 'student_id', 'link_type',
        'can_view_grades', 'can_view_attendance', 'can_approve_consent',
        'can_pickup', 'can_receive_sms',
        'status', 'approved_by', 'ends_on',
    ];

    protected function casts(): array
    {
        return [
            'can_view_grades' => 'boolean',
            'can_view_attendance' => 'boolean',
            'can_approve_consent' => 'boolean',
            'can_pickup' => 'boolean',
            'can_receive_sms' => 'boolean',
            'approved_at' => 'datetime',
            'ends_on' => 'date',
        ];
    }

    public function guardian(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class, 'guardian_user_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * Link is usable today (active and not ended).
     */
    public function scopeUsable($query)
    {
        $today = now()->toDateString();

        return $query
            ->where('status', self::STATUS_ACTIVE)
            ->where(fn ($q) => $q->whereNull('ends_on')->orWhere('ends_on', '>=', $today));
    }
}
