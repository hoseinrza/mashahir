<?php

namespace App\Modules\People\Services;

use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\People\Models\GuardianLink;
use App\Modules\People\Models\Student;
use App\Support\PhoneHash;
use Illuminate\Validation\ValidationException;

/**
 * ولی همراه با دانش‌آموز ثبت می‌شود: شمارهٔ موبایل او حساب ورود می‌سازد (یا
 * حساب موجود با همان شماره را وصل می‌کند)، نقش «ولی» در مدرسهٔ همان دانش‌آموز
 * به او داده می‌شود و یک پیوند فعال بین او و همین دانش‌آموز ساخته می‌شود — پس
 * پنل ولی از همان لحظه روی پروندهٔ همین دانش‌آموز باز می‌شود. راه رسمی ساخت
 * حساب ولی، چون فرم تخصیص نقش عمداً نقش ولی را نمی‌پذیرد.
 */
final class GuardianAccountService
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly StudentAccountService $phones,
    ) {
    }

    /**
     * @param  array{first_name:string,last_name?:string|null,phone:string,link_type?:string|null,can_pickup?:bool|null}  $data
     */
    public function attach(Student $student, array $data, User $actor): GuardianLink
    {
        $phone = $this->phones->normalizePhone($data['phone'] ?? null);

        if ($phone === null || ! preg_match('/^09\d{9}$/', $phone)) {
            throw ValidationException::withMessages([
                'guardians' => 'شماره موبایل ولی باید ۱۱ رقم و با ۰۹ شروع شود (مثال: 09121234567).',
            ]);
        }

        $linkType = $data['link_type'] ?? GuardianLink::TYPE_PRIMARY;

        if (! array_key_exists($linkType, GuardianLink::typeLabels())) {
            throw ValidationException::withMessages(['guardians' => 'نوع پیوند ولی معتبر نیست.']);
        }

        $guardian = $this->account($data, $phone);

        // A student's login is never a parent's login: the same number would
        // otherwise hold two identities and two panels.
        if (Student::query()->withoutGlobalScope('school')->where('user_id', $guardian->id)->exists()) {
            throw ValidationException::withMessages([
                'guardians' => 'این شماره حساب ورود یک دانش‌آموز است؛ برای ولی شمارهٔ دیگری ثبت کنید.',
            ]);
        }

        $duplicate = GuardianLink::query()
            ->where('guardian_user_id', $guardian->id)
            ->where('student_id', $student->id)
            ->whereIn('status', [GuardianLink::STATUS_PENDING, GuardianLink::STATUS_ACTIVE])
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'guardians' => 'این شماره از قبل به همین دانش‌آموز پیوند فعال دارد.',
            ]);
        }

        $this->ensureGuardianRole($guardian, (int) $student->school_id);

        $link = GuardianLink::query()->create([
            'guardian_user_id' => $guardian->id,
            'student_id' => $student->id,
            'link_type' => $linkType,
            'status' => GuardianLink::STATUS_ACTIVE,
            'approved_by' => $actor->id,
            'approved_at' => now(),
            ...$this->defaultFlags($linkType, $data['can_pickup'] ?? null),
        ]);

        $this->audit->log('guardian_link.created', $student, new: [
            'guardian_link_id' => $link->id,
            'guardian_user' => $guardian->ulid,
            'link_type' => $linkType,
            // The number itself never enters the audit trail.
            'phone' => '***masked***',
        ]);

        return $link->fresh(['guardian', 'student']);
    }

    /**
     * An existing platform account with the same number is linked, never
     * duplicated (a parent may already be staff, or a parent of a sibling).
     *
     * @param  array{first_name:string,last_name?:string|null}  $data
     */
    private function account(array $data, string $phone): User
    {
        $phoneHash = PhoneHash::of($phone);
        $guardian = User::query()->where('phone_hash', $phoneHash)->first();

        if ($guardian !== null) {
            return $guardian;
        }

        return User::query()->create([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'] ?? '',
            'phone' => $phone,
            'phone_hash' => $phoneHash,
            'status' => 'active',
        ]);
    }

    /**
     * The guardian role is school-scoped (not student-scoped): one parent may
     * hold several children, and each link carries its own flags.
     */
    private function ensureGuardianRole(User $guardian, int $schoolId): void
    {
        $roleId = \DB::table('roles')->whereNull('school_id')->where('key', 'guardian')->value('id');

        if ($roleId === null) {
            throw ValidationException::withMessages(['guardians' => 'نقش «ولی» در سامانه پیکربندی نشده است.']);
        }

        $today = now()->toDateString();

        $active = UserRole::query()
            ->where('user_id', $guardian->id)
            ->where('role_id', $roleId)
            ->where('school_id', $schoolId)
            ->where(fn ($q) => $q->whereNull('ends_on')->orWhere('ends_on', '>=', $today))
            ->exists();

        if (! $active) {
            UserRole::query()->create([
                'user_id' => $guardian->id,
                'role_id' => $roleId,
                'school_id' => $schoolId,
                'scope_type' => UserRole::SCOPE_SCHOOL,
                'scope_id' => null,
                'starts_on' => $today,
            ]);
        }
    }

    /**
     * A parent link starts with the read-side flags on (the family office can
     * narrow them, with a reason, from the family page); both parents can pick
     * their child up. A pickup-only person is on the delivery list and sees
     * nothing else.
     *
     * @return array<string, bool>
     */
    private function defaultFlags(string $linkType, ?bool $canPickup): array
    {
        $pickupOnly = $linkType === GuardianLink::TYPE_PICKUP_ONLY;

        return [
            'can_view_grades' => ! $pickupOnly,
            'can_view_attendance' => ! $pickupOnly,
            'can_approve_consent' => ! $pickupOnly,
            'can_receive_sms' => ! $pickupOnly,
            'can_pickup' => $canPickup ?? true,
        ];
    }
}
