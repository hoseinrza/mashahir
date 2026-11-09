<?php

namespace App\Modules\Transport\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * یک خط سرویس مدرسه: راننده، وسیله و ظرفیت. ایستگاه‌ها و دانش‌آموزان
 * تخصیص‌یافته به همین خط وابسته‌اند.
 */
class BusRoute extends Model
{
    use BelongsToSchool;
    use HasUlid;

    protected $fillable = [
        'code', 'title', 'driver_user_id', 'vehicle_model', 'plate_number', 'capacity', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function stops(): HasMany
    {
        return $this->hasMany(BusStop::class)->orderBy('position');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(BusAssignment::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class, 'driver_user_id');
    }
}
