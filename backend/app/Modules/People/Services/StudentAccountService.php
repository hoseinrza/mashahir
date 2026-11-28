<?php

namespace App\Modules\People\Services;

use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\People\Models\Student;
use App\Support\PhoneHash;
use Illuminate\Validation\ValidationException;

/**
 * دانش‌آموز با شماره موبایل وارد پنل می‌شود: دادن شماره به دانش‌آموز، حساب
 * ورود او را می‌سازد (یا حساب موجود با همان شماره را متصل می‌کند) و نقش
 * دانش‌آموزی را روی رکورد خودش scope می‌کند — راه رسمی ساخت حساب دانش‌آموز،
 * چون فرم تخصیص نقش عمداً نقش دانش‌آموز را نمی‌پذیرد.
 */
final class StudentAccountService
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    /** ۰۹… / ٠٩… / +98 / فاصله و خط → 09xxxxxxxxx؛ خالی همان null می‌ماند. */
    public function normalizePhone(?string $raw): ?string
    {
        $phone = trim((string) $raw);
        if ($phone === '') {
            return null;
        }

        $phone = strtr($phone, [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);

        $phone = (string) preg_replace('/[\s\-().]/', '', $phone);
        $phone = (string) preg_replace('/^(?:\+?98|0)/', '0', $phone);

        return $phone;
    }

    /**
     * Phone → login account. An existing platform account with the same
     * number is linked instead of duplicated (the guardian-phones-first rule
     * of the personnel form); a number already bound to ANOTHER student is
     * rejected. Answers with the normalized phone (null = none given).
     */
    public function linkPhone(Student $student, ?string $rawPhone): ?string
    {
        $phone = $this->normalizePhone($rawPhone);
        if ($phone === null) {
            return null;
        }

        if (! preg_match('/^09\d{9}$/', $phone)) {
            throw ValidationException::withMessages([
                'phone' => 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود (مثال: 09121234567).',
            ]);
        }

        $phoneHash = PhoneHash::of($phone);
        $user = User::query()->where('phone_hash', $phoneHash)->first();

        if ($user === null) {
            $user = User::query()->create([
                'first_name' => $student->first_name,
                'last_name' => $student->last_name,
                'phone' => $phone,
                'phone_hash' => $phoneHash,
                'status' => 'active',
            ]);
        } elseif (Student::query()->where('user_id', $user->id)->whereKeyNot($student->id)->exists()) {
            throw ValidationException::withMessages([
                'phone' => 'این شماره قبلاً به دانش‌آموز دیگری متصل شده است.',
            ]);
        }

        $student->forceFill(['user_id' => $user->id])->save();

        $roleId = \DB::table('roles')->whereNull('school_id')->where('key', 'student')->value('id');
        UserRole::query()->firstOrCreate([
            'user_id' => $user->id,
            'role_id' => $roleId,
            'school_id' => $student->school_id,
            'scope_type' => 'student',
            'scope_id' => $student->id,
        ], ['starts_on' => now()->toDateString()]);

        $this->audit->log('student.account_linked', $student, new: [
            'phone' => '***masked***',
            'phone_hash' => $phoneHash,
        ]);

        return $phone;
    }
}
