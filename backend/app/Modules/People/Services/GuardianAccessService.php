<?php

namespace App\Modules\People\Services;

use App\Modules\People\Models\CourtOrder;
use App\Modules\People\Models\GuardianLink;
use Illuminate\Support\Collection;

/**
 * Effective guardian permissions: the link's flags, then ANY matching court
 * order restriction turns a flag off (court order wins, always).
 * Flags are per-link: guardians never inherit from each other.
 */
final class GuardianAccessService
{
    public const FLAG_KEYS = [
        'can_view_grades', 'can_view_attendance', 'can_approve_consent',
        'can_pickup', 'can_receive_sms',
    ];

    /**
     * Effective flags for one usable link, honoring valid court orders.
     *
     * @return array<string, bool>
     */
    public function effectiveFlags(GuardianLink $link): array
    {
        $flags = [];
        foreach (self::FLAG_KEYS as $key) {
            $flags[$key] = (bool) $link->{$key};
        }

        $restrictions = $this->activeRestrictions((int) $link->student_id, (int) $link->guardian_user_id);

        foreach ($restrictions as $key => $denied) {
            if ($denied === true && array_key_exists($key, $flags)) {
                $flags[$key] = false;
            }
        }

        return $flags;
    }

    /**
     * Whether a guardian may exercise one flag for a student. A usable
     * (active, not ended) link with that flag is required; court orders can
     * still veto it.
     */
    public function may(int $guardianUserId, int $studentId, string $flag): bool
    {
        if (! in_array($flag, self::FLAG_KEYS, true)) {
            return false;
        }

        $link = GuardianLink::query()
            ->where('guardian_user_id', $guardianUserId)
            ->where('student_id', $studentId)
            ->usable()
            ->first();

        if ($link === null) {
            return false;
        }

        return $this->effectiveFlags($link)[$flag];
    }

    /**
     * Merged court-order restrictions (true = denied) for a guardian–student
     * pair, from orders currently within their validity window.
     *
     * @return array<string, bool>
     */
    private function activeRestrictions(int $studentId, int $guardianUserId): array
    {
        $today = now()->toDateString();

        /** @var Collection<int, CourtOrder> $orders */
        $orders = CourtOrder::query()
            ->where('student_id', $studentId)
            ->where(function ($q) use ($today) {
                $q->whereNull('valid_from')->orWhere('valid_from', '<=', $today);
            })
            ->where(function ($q) use ($today) {
                $q->whereNull('valid_to')->orWhere('valid_to', '>=', $today);
            })
            ->get();

        $merged = [];

        foreach ($orders as $order) {
            // Orders tied to a specific link only affect that link.
            if ($order->guardian_link_id !== null) {
                $orderLinkGuardian = GuardianLink::query()->whereKey($order->guardian_link_id)->value('guardian_user_id');
                if ((int) $orderLinkGuardian !== $guardianUserId) {
                    continue;
                }
            }

            foreach ((array) $order->restrictions as $key => $value) {
                if (in_array($key, self::FLAG_KEYS, true) && $value === false) {
                    $merged[$key] = true;
                }
            }
        }

        return $merged;
    }
}
