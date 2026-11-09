<?php

namespace App\Modules\Transport\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** ثبت سوار/پیاده‌شدن یک دانش‌آموز در یک روز و یک جهت. */
class BusBoarding extends Model
{
    use BelongsToSchool;

    public const DIRECTION_IN = 'in';
    public const DIRECTION_OUT = 'out';

    public const STATUS_BOARDED = 'boarded';
    public const STATUS_ABSENT = 'absent';

    protected $fillable = [
        'bus_route_id', 'student_id', 'boarding_date', 'direction', 'status', 'recorded_by', 'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'boarding_date' => 'date',
            'recorded_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\People\Models\Student::class);
    }
}
