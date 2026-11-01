<?php

namespace App\Modules\Grades\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One teacher's report-card cycle inside a period — the row that carries the
 * workflow. Independence lives here: approve/finalize/archive act on ONE of
 * these, never on the period as a whole.
 */
class TeacherReportSubmission extends Model
{
    use BelongsToSchool;
    use HasUlid;

    public const STATUS_OPEN = 'open';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_REVISION_REQUIRED = 'revision_required';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_FINALIZED = 'finalized';
    public const STATUS_ARCHIVED = 'archived';

    /** States a teacher may write in. Submitted/approved are NOT writable. */
    public const EDITABLE_STATUSES = [self::STATUS_OPEN, self::STATUS_REVISION_REQUIRED];

    /** No teacher-side or admin-side rewrite after the final order. */
    public const LOCKED_STATUSES = [self::STATUS_FINALIZED, self::STATUS_ARCHIVED];

    protected $fillable = [
        'report_period_id', 'teacher_id', 'status',
        'submitted_at', 'reviewed_at',
        'returned_at', 'returned_by', 'return_note',
        'approved_at', 'finalized_at', 'archived_at',
        'reopened_at', 'reopened_by', 'reopen_reason',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'returned_at' => 'datetime',
            'approved_at' => 'datetime',
            'finalized_at' => 'datetime',
            'archived_at' => 'datetime',
            'reopened_at' => 'datetime',
        ];
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(ReportPeriod::class, 'report_period_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class, 'teacher_id');
    }

    public function entries(): HasMany
    {
        return $this->hasMany(StudentReportEntry::class);
    }

    public function isLocked(): bool
    {
        return in_array($this->status, self::LOCKED_STATUSES, true);
    }

    public function isEditableByTeacher(): bool
    {
        return in_array($this->status, self::EDITABLE_STATUSES, true);
    }
}
