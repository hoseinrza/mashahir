<?php

namespace App\Modules\Exams\Models;

use Illuminate\Database\Eloquent\Model;

class ExamOption extends Model
{
    protected $fillable = ['question_id', 'position', 'body'];
}
