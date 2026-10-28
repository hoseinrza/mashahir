<?php

namespace App\Modules\Exams\Models;

use Illuminate\Database\Eloquent\Model;

class AnswerGrade extends Model
{
    public $timestamps = false;

    protected $fillable = ['answer_id', 'score', 'comment', 'graded_by', 'graded_at'];

    protected function casts(): array
    {
        return [
            'graded_at' => 'datetime',
        ];
    }
}
