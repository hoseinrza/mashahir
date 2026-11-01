<?php

namespace App\Modules\Admissions\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;

class PreRegistration extends Model
{
    use HasUlid;
    use BelongsToSchool;

    public const STATUS_NEW = 'new';
    public const STATUS_CONTACTED = 'contacted';
    public const STATUS_EXAM_SCHEDULED = 'exam_scheduled';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_WAITLIST = 'waitlist';
    public const STATUS_REJECTED = 'rejected';

    public const STATUSES = [
        self::STATUS_NEW,
        self::STATUS_CONTACTED,
        self::STATUS_EXAM_SCHEDULED,
        self::STATUS_ACCEPTED,
        self::STATUS_WAITLIST,
        self::STATUS_REJECTED,
    ];

    public const GRADES = [
        '7_general', '8_general', '9_general',
        '10_math', '10_science', '10_humanities',
        '11_math', '11_science',
    ];

    protected $fillable = [
        'school_id', 'tracking_code', 'student_name', 'grade', 'last_gpa',
        'parent_phone', 'current_school', 'has_honor', 'honor_desc',
        'status', 'admin_notes',
    ];

    protected function casts(): array
    {
        return [
            'has_honor' => 'boolean',
        ];
    }
}
