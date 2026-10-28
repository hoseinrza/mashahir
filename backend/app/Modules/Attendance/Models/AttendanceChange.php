<?php

namespace App\Modules\Attendance\Models;

use App\Support\Concerns\AppendOnly;
use Illuminate\Database\Eloquent\Model;

class AttendanceChange extends Model
{
    use AppendOnly;

    public $timestamps = false;

    protected $fillable = [
        'school_id', 'attendance_record_id', 'old_status', 'new_status',
        'reason', 'changed_by', 'changed_at',
    ];

    protected function casts(): array
    {
        return [
            'changed_at' => 'datetime',
        ];
    }
}
