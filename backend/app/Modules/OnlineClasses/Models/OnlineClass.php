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
        'status', 'created_by',
    ];

    public function classroomSubject(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Academic\Models\ClassroomSubject::class);
    }
}
