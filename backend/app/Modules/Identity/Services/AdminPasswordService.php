<?php

namespace App\Modules\Identity\Services;

use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * A manager sets or replaces somebody else's login password. The reason is
 * mandatory (sh7/sh10) and the audit trail stores masked values only — the
 * password itself never reaches a log.
 */
final class AdminPasswordService
{
    /**
     * The closed vocabulary of reasons the office may pick. A curated list —
     * not free text — so the audit trail can be counted and so the server can
     * validate the pick (the form offers exactly these labels). Code => label;
     * the label is what is written to the audit trail.
     *
     * @var array<string, string>
     */
    public const REASONS = [
        'onboarding' => 'راه‌اندازی اولیهٔ حساب ورود',
        'forgotten' => 'فراموشی رمز و درخواست بازیابی',
        'office_request' => 'درخواست حضوری در دفتر مدرسه',
        'security_reset' => 'بازنشانی امنیتی — احتمال افشای رمز',
        'handover' => 'تغییر شمارهٔ ورود یا جابه‌جایی مسئول',
        'support' => 'درخواست واحد پشتیبانی',
    ];

    /** @return list<string> */
    public static function reasons(): array
    {
        return array_values(self::REASONS);
    }

    public function __construct(private readonly AuditService $audit)
    {
    }

    public function set(User $user, string $password, string $reason): User
    {
        // One gate for every caller: the trail only accepts the curated labels.
        if (! in_array($reason, self::reasons(), true)) {
            throw ValidationException::withMessages([
                'reason' => 'دلیل انتخاب‌شده در فهرست دلایل مجاز نیست.',
            ]);
        }

        $user->forceFill(['password' => $password])->save();

        $this->audit->log(
            'user.password_changed',
            $user,
            old: ['password' => '***masked***'],
            new: ['password' => '***masked***'],
            reason: $reason,
        );

        return $user->fresh();
    }
}
