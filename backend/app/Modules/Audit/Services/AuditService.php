<?php

namespace App\Modules\Audit\Services;

use App\Modules\Audit\Models\AuditLog;
use App\Support\SchoolContext;
use Illuminate\Database\Eloquent\Model;

/**
 * Single entry point for audit writes. Operations under sh7/sh10 MUST call
 * this with a reason; the reason is part of the record, not optional.
 */
final class AuditService
{
    public function log(
        string $action,
        ?Model $subject = null,
        ?array $old = null,
        ?array $new = null,
        ?string $reason = null,
    ): AuditLog {
        /** @var SchoolContext $context */
        $context = app(SchoolContext::class);

        return AuditLog::query()->create([
            // Platform-level events (override active) carry no school.
            'school_id' => $context->hasOverride() ? null : $context->schoolId(),
            'actor_id' => auth()->id(),
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject !== null ? (int) $subject->getKey() : null,
            'old' => $old,
            'new' => $new,
            'reason' => $reason,
            'ip' => request()?->ip(),
            'user_agent' => (string) request()?->userAgent(),
        ]);
    }
}
