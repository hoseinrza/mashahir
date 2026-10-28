<?php

namespace App\Modules\Academic\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClassSession extends Model
{
    use BelongsToSchool;

    public const STATUS_NOT_TAKEN = 'not_taken';
    public const STATUS_DRAFT = 'draft';
    public const STATUS_FINALIZED = 'finalized';

    protected $fillable = [
        'classroom_subject_id', 'held_on', 'period', 'attendance_status',
        'finalized_by', 'finalized_at',
    ];

    protected function casts(): array
    {
        return [
            'held_on' => 'date',
            'finalized_at' => 'datetime',
        ];
    }

    public function classroomSubject(): BelongsTo
    {
        return $this->belongsTo(ClassroomSubject::class);
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(\App\Modules\Attendance\Models\AttendanceRecord::class);
    }
}
