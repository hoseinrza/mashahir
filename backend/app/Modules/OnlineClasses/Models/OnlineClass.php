<?php

namespace App\Modules\OnlineClasses\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OnlineClass extends Model
{
    use BelongsToSchool;
    use HasUlid;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'classroom_subject_id', 'title', 'skyroom_room_id', 'skyroom_name',
        'status', 'created_by', 'starts_at', 'ends_at',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function classroomSubject(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Academic\Models\ClassroomSubject::class);
    }

    /** scheduled|open|ended — برگشت‌خورده از پنجره‌ی زمانی (status بسته را جداگانه می‌پوشاند). */
    public function availability(): string
    {
        if ($this->starts_at !== null && now()->lt($this->starts_at)) {
            return 'scheduled';
        }

        if ($this->ends_at !== null && now()->gt($this->ends_at)) {
            return 'ended';
        }

        return 'open';
    }
}
