<?php

namespace App\Modules\Academic\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Subject taught in a classroom by a teacher — the ROOT of teacher scoping (sh2).
 */
class ClassroomSubject extends Model
{
    use BelongsToSchool;

    protected $fillable = ['classroom_id', 'subject_id', 'teacher_id'];

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class, 'teacher_id');
    }
}
