<?php

namespace App\Modules\Notifications\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Notification extends Model
{
    public const IMPORTANCE_INFO = 'info';
    public const IMPORTANCE_IMPORTANT = 'important';
    public const IMPORTANCE_URGENT = 'urgent';

    public const UPDATED_AT = null;

    protected $fillable = [
        'school_id', 'user_id', 'student_id', 'type', 'importance',
        'title', 'body', 'link', 'data', 'read_at', 'archived_at', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
            'archived_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Identity\Models\User::class);
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(NotificationDelivery::class);
    }
}
