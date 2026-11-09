<?php

namespace App\Modules\Transport\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** ایستگاه یک خط سرویس، با ترتیب و ساعت تقریبی سوارشدن. */
class BusStop extends Model
{
    use BelongsToSchool;
    use HasUlid;

    protected $fillable = ['bus_route_id', 'title', 'position', 'pickup_time'];

    public function route(): BelongsTo
    {
        return $this->belongsTo(BusRoute::class, 'bus_route_id');
    }
}
