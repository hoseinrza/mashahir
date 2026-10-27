<?php

namespace App\Modules\Academic\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Classroom extends Model
{
    use BelongsToSchool;
    use HasUlid;

    protected $fillable = ['academic_year_id', 'grade_level_id', 'title', 'homeroom_staff_id'];

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function gradeLevel(): BelongsTo
    {
        return $this->belongsTo(GradeLevel::class);
    }

    public function homeroomStaff(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\StaffProfile::class, 'homeroom_staff_id');
    }

    public function classroomSubjects(): HasMany
    {
        return $this->hasMany(ClassroomSubject::class);
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }
}
