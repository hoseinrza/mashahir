<?php

namespace App\Modules\Grades\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One line of a teacher's monthly report card: score + descriptive verdict +
 * remark for one student of one lesson-class.
 */
class StudentReportEntry extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'teacher_report_submission_id', 'student_id', 'classroom_subject_id',
        'score', 'max_score', 'evaluation', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'integer',
            'max_score' => 'integer',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(TeacherReportSubmission::class, 'teacher_report_submission_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\People\Models\Student::class);
    }

    public function classroomSubject(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Academic\Models\ClassroomSubject::class);
    }
}
