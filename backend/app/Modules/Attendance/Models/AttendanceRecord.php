<?php

namespace App\Modules\Attendance\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceRecord extends Model
{
    use BelongsToSchool;

    public const STATUS_PRESENT = 'present';
    public const STATUS_ABSENT = 'absent';
    public const STATUS_LATE = 'late';

    protected $fillable = [
        'class_session_id', 'student_id', 'status', 'late_minutes',
        'source', 'recorded_by', 'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'recorded_at' => 'datetime',
        ];
    }

    public function classSession(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Academic\Models\ClassSession::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\People\Models\Student::class);
    }

    public function changes(): HasMany
    {
        return $this->hasMany(AttendanceChange::class);
    }
}
