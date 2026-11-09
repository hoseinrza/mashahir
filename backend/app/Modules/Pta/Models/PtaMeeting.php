<?php

namespace App\Modules\Pta\Models;

use App\Support\Concerns\BelongsToSchool;
use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;

/**
 * جلسهٔ انجمن اولیا و مربیان: دستور جلسه، صورت‌جلسه و مصوبات.
 */
class PtaMeeting extends Model
{
    use BelongsToSchool;
    use HasUlid;

    public const STATUS_UPCOMING = 'upcoming';
    public const STATUS_HELD = 'held';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = ['title', 'held_at', 'location', 'agenda', 'minutes', 'resolutions', 'status', 'created_by'];

    protected function casts(): array
    {
        return [
            'held_at' => 'datetime',
            'agenda' => 'array',
            'resolutions' => 'array',
        ];
    }
}
