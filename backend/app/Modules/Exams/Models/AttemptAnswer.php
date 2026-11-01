<?php

namespace App\Modules\Exams\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AttemptAnswer extends Model
{
    protected $fillable = [
        'attempt_id', 'question_id', 'option_id', 'text', 'file_id',
        'version', 'flagged', 'saved_at',
    ];

    protected function casts(): array
    {
        return [
            'flagged' => 'boolean',
            'saved_at' => 'datetime',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'attempt_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(ExamQuestion::class, 'question_id');
    }

    public function grade(): HasOne
    {
        return $this->hasOne(AnswerGrade::class, 'answer_id');
    }

    /** Photo/PDF of the handwritten answer (descriptive questions). */
    public function file(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Files\Models\File::class);
    }
}
