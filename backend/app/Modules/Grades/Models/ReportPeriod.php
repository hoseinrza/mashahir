<?php

namespace App\Modules\Grades\Models;

use App\Modules\Academic\Models\AcademicYear;
use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One monthly report-card period (سال تحصیلی + ماه jalali). Only the principal
 * opens it, and no teacher may record into a period that is still draft.
 */
class ReportPeriod extends Model
{
    use BelongsToSchool;
    use HasUlid;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_OPEN = 'open';

    protected $fillable = [
        'academic_year_id', 'month', 'title', 'status',
        'due_at', 'opened_by', 'opened_at',
    ];

    protected function casts(): array
    {
        return [
            'month' => 'integer',
            'due_at' => 'datetime',
            'opened_at' => 'datetime',
        ];
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(TeacherReportSubmission::class);
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_OPEN;
    }
}
