<?php

namespace App\Modules\Grades\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GradeItem extends Model
{
    use BelongsToSchool;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_PUBLISHED = 'published';

    public const SOURCE_EXAM = 'exam';
    public const SOURCE_ASSIGNMENT = 'assignment';
    public const SOURCE_IN_PERSON_EXAM = 'in_person_exam';
    public const SOURCE_MANUAL = 'manual';

    protected $fillable = [
        'student_id', 'classroom_subject_id', 'term_id', 'source_type',
        'source_id', 'delivery', 'status', 'score', 'max_score',
        'recorded_by', 'approved_by', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\People\Models\Student::class);
    }

    public function classroomSubject(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Academic\Models\ClassroomSubject::class);
    }

    public function term(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Academic\Models\Term::class, 'term_id');
    }

    public function changes(): HasMany
    {
        return $this->hasMany(GradeChange::class);
    }
}
