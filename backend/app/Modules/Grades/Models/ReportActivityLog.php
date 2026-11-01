<?php

namespace App\Modules\Grades\Models;

use App\Support\Concerns\AppendOnly;
use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The cycle's own trail — what the admin and teacher panels show next to the
 * workflow. Append-only like audit_logs; security events go through
 * AuditService as well.
 *
 * @mixin Model
 */
class ReportActivityLog extends Model
{
    use AppendOnly;
    use BelongsToSchool;

    public $timestamps = false;

    protected $fillable = [
        'report_period_id', 'teacher_report_submission_id', 'actor_id',
        'action', 'detail', 'reason', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'detail' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class, 'actor_id');
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(TeacherReportSubmission::class, 'teacher_report_submission_id');
    }
}
