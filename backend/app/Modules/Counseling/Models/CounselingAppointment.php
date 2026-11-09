<?php

namespace App\Modules\Counseling\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * نوبت مشاورهٔ یک دانش‌آموز: درخواست از سوی خود دانش‌آموز یا ولی ثبت می‌شود،
 * مشاور آن را زمان‌بندی و تکمیل می‌کند. یادداشت محرمانه فقط برای مشاور است.
 */
class CounselingAppointment extends Model
{
    use BelongsToSchool;
    use HasUlid;

    public const STATUS_REQUESTED = 'requested';
    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    public const TYPE_IN_PERSON = 'in_person';
    public const TYPE_ONLINE = 'online';

    protected $fillable = [
        'student_id', 'requester_user_id', 'counselor_user_id', 'topic', 'type',
        'status', 'scheduled_at', 'shared_summary', 'confidential_notes', 'follow_up_plan',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\People\Models\Student::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class, 'requester_user_id');
    }

    public function counselor(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class, 'counselor_user_id');
    }
}
