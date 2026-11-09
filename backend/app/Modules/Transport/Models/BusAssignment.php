<?php

namespace App\Modules\Transport\Models;

use App\Support\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** تخصیص یک دانش‌آموز به خط سرویس (و در صورت وجود، ایستگاه او). */
class BusAssignment extends Model
{
    use BelongsToSchool;

    protected $fillable = ['bus_route_id', 'student_id', 'bus_stop_id'];

    public function student(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\People\Models\Student::class);
    }

    public function route(): BelongsTo
    {
        return $this->belongsTo(BusRoute::class, 'bus_route_id');
    }

    public function stop(): BelongsTo
    {
        return $this->belongsTo(BusStop::class, 'bus_stop_id');
    }
}
