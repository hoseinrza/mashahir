<?php

namespace App\Modules\Notifications\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationDelivery extends Model
{
    public const CHANNEL_IN_APP = 'in_app';
    public const CHANNEL_SMS = 'sms';
    public const CHANNEL_PUSH = 'push';

    public const STATUS_QUEUED = 'queued';
    public const STATUS_SENT = 'sent';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'notification_id', 'channel', 'status', 'attempts',
        'provider_message_id', 'sent_at', 'last_error', 'next_retry_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'next_retry_at' => 'datetime',
        ];
    }

    public function notification(): BelongsTo
    {
        return $this->belongsTo(Notification::class);
    }
}
