<?php

namespace App\Modules\Exams\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExamAttempt extends Model
{
    use BelongsToSchool;

    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_EXPIRED = 'expired';

    protected $fillable = [
        'exam_id', 'student_id', 'started_at', 'server_deadline',
        'status', 'submitted_at', 'auto_score',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'server_deadline' => 'datetime',
            'submitted_at' => 'datetime',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\People\Models\Student::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(AttemptAnswer::class, 'attempt_id');
    }

    /**
     * FR-16: the server clock decides everything.
     */
    public function isExpired(): bool
    {
        return now()->gt($this->server_deadline)
            || $this->exam->closes_at->lt(now());
    }
}
