<?php

namespace App\Modules\Notifications\Services;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\NotificationDelivery;
use App\Modules\Notifications\Models\NotificationPreference;
use App\Support\Sms\SmsManager;
use Illuminate\Support\Collection;

/**
 * Center of all outbound messaging. in_app lands instantly; sms/push go to
 * the delivery queue (one row per channel). School-mandatory messages
 * (sh14 — e.g. absence alerts) ignore user opt-outs.
 */
final class NotificationService
{
    /** sh14: the school's mandatory alerts cannot be muted. */
    public const MANDATORY_TYPES = ['attendance.absence', 'attendance.late'];

    public function notify(
        User $user,
        ?int $studentId,
        string $type,
        string $title,
        ?string $body = null,
        ?string $link = null,
        string $importance = Notification::IMPORTANCE_INFO,
        array $channels = [NotificationDelivery::CHANNEL_IN_APP],
        array $data = [],
    ): Notification {
        $notification = Notification::query()->create([
            'school_id' => $user->userRoles()->value('school_id') ?? app(\App\Support\SchoolContext::class)->schoolId(),
            'user_id' => $user->id,
            'student_id' => $studentId,
            'type' => $type,
            'importance' => $importance,
            'title' => $title,
            'body' => $body,
            'link' => $link,
            'data' => $data,
        ]);

        foreach (array_unique($channels) as $channel) {
            if ($channel === NotificationDelivery::CHANNEL_IN_APP) {
                NotificationDelivery::query()->create([
                    'notification_id' => $notification->id,
                    'channel' => $channel,
                    'status' => NotificationDelivery::STATUS_SENT,
                    'sent_at' => now(),
                ]);
                continue;
            }

            // sh14: mandatory school messages bypass opt-outs.
            if (! in_array($type, self::MANDATORY_TYPES, true) && ! $this->userWants($user, $type, $channel)) {
                continue;
            }

            NotificationDelivery::query()->create([
                'notification_id' => $notification->id,
                'channel' => $channel,
                'status' => NotificationDelivery::STATUS_QUEUED,
                'next_retry_at' => now(),
            ]);
        }

        return $notification;
    }

    /**
     * Queue worker: sends queued SMS/push deliveries and retries failures.
     * A failed SMS never breaks the operation that created it.
     */
    public function dispatchQueued(int $limit = 100): int
    {
        $deliveries = NotificationDelivery::query()
            ->with('notification.user')
            ->where('status', NotificationDelivery::STATUS_QUEUED)
            ->where(fn ($q) => $q->whereNull('next_retry_at')->orWhere('next_retry_at', '<=', now()))
            ->orderBy('id')
            ->limit($limit)
            ->get();

        $sent = 0;

        foreach ($deliveries as $delivery) {
            $delivery->increment('attempts');

            try {
                match ($delivery->channel) {
                    NotificationDelivery::CHANNEL_SMS => $this->sendSms($delivery),
                    default => throw new \RuntimeException("Channel [{$delivery->channel}] has no sender yet."),
                };

                $delivery->forceFill([
                    'status' => NotificationDelivery::STATUS_SENT,
                    'sent_at' => now(),
                    'last_error' => null,
                ])->save();
                $sent++;
            } catch (\Throwable $e) {
                $delivery->forceFill([
                    'status' => NotificationDelivery::STATUS_FAILED,
                    'last_error' => mb_substr($e->getMessage(), 0, 500),
                    'next_retry_at' => now()->addMinutes(5 * $delivery->attempts),
                ])->save();
            }
        }

        return $sent;
    }

    private function sendSms(NotificationDelivery $delivery): void
    {
        $user = $delivery->notification->user;

        if ($user === null || $user->status !== 'active') {
            throw new \RuntimeException('User is not active.');
        }

        SmsManager::send(
            \App\Support\PhoneOf::user($user),
            trim(($delivery->notification->title ?? '')."\n".($delivery->notification->body ?? '')),
        );
    }

    private function userWants(User $user, string $type, string $channel): bool
    {
        $pref = NotificationPreference::query()
            ->where('user_id', $user->id)
            ->where('type', $type)
            ->where('channel', $channel)
            ->first();

        return $pref?->enabled ?? true;
    }
}
