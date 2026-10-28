<?php

namespace App\Modules\Exams\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExamQuestion extends Model
{
    public const TYPE_MCQ = 'mcq';
    public const TYPE_DESCRIPTIVE = 'descriptive';

    protected $fillable = ['exam_id', 'type', 'position', 'body', 'points', 'correct_option_id'];

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(ExamOption::class, 'question_id')->orderBy('position');
    }
}
