<?php

namespace App\Modules\Exams\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Exam extends Model
{
    use BelongsToSchool;
    use HasUlid;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PUBLISHED = 'published';
    public const STATUS_CLOSED = 'closed';

    public const VISIBILITY_IMMEDIATELY = 'immediately';
    public const VISIBILITY_AFTER_GRADING = 'after_grading';
    public const VISIBILITY_MANUAL = 'manual';

    protected $fillable = [
        'classroom_subject_id', 'title', 'opens_at', 'closes_at',
        'duration_minutes', 'shuffle_questions', 'result_visibility',
        'status', 'results_released_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'opens_at' => 'datetime',
            'closes_at' => 'datetime',
            'results_released_at' => 'datetime',
            'shuffle_questions' => 'boolean',
        ];
    }

    public function classroomSubject(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Academic\Models\ClassroomSubject::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(ExamQuestion::class)->orderBy('position');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class);
    }

    /**
     * sh6 gate: may this student see the results of this exam now?
     */
    public function resultsVisible(): bool
    {
        return match ($this->result_visibility) {
            self::VISIBILITY_IMMEDIATELY => true,
            self::VISIBILITY_AFTER_GRADING => $this->results_released_at !== null,
            self::VISIBILITY_MANUAL => $this->results_released_at !== null,
            default => false,
        };
    }
}
