<?php

namespace App\Modules\Grades\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportCardLine extends Model
{
    protected $fillable = ['report_card_id', 'subject_id', 'score', 'teacher_comment', 'data'];

    protected function casts(): array
    {
        return [
            'score' => 'float', // decimal column; pgsql would otherwise hand back a string
            'data' => 'array',
        ];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Academic\Models\Subject::class);
    }
}
