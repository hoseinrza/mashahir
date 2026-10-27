<?php

namespace App\Modules\Academic\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Enrollment extends Model
{
    use BelongsToSchool;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_TRANSFERRED = 'transferred';
    public const STATUS_ENDED = 'ended';

    protected $fillable = ['classroom_id', 'student_id', 'starts_on', 'ends_on', 'status'];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\People\Models\Student::class);
    }
}
