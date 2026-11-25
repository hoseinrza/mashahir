<?php

namespace App\Modules\School\Models;

use App\Support\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;

class School extends Model
{
    use HasUlid;

    public const LEVEL_HIGH = 'high';
    public const LEVEL_MIDDLE = 'middle';
    public const LEVEL_ELEMENTARY = 'elementary';

    protected $fillable = ['name', 'level', 'grading_type', 'student_has_account', 'timezone', 'is_active'];

    protected function casts(): array
    {
        return [
            'student_has_account' => 'boolean',
            'is_active' => 'boolean',
            // Alocom (الوکام) organizer credentials — the password is
            // encrypted at rest and never returned by any API.
            'alocom_password' => 'encrypted',
        ];
    }

    /** The school holds working Alocom organizer credentials? */
    public function alocomConfigured(): bool
    {
        return ($this->alocom_username ?? '') !== '' && ($this->alocom_password ?? '') !== '';
    }

    public function setting(string $key, mixed $default = null): mixed
    {
        $value = \Illuminate\Support\Facades\DB::table('school_settings')
            ->where('school_id', $this->id)
            ->where('key', $key)
            ->value('value');

        if ($value === null) {
            return $default;
        }

        // The column is jsonb; the query builder hands back the JSON text, so
        // "one_parent" arrives quoted. Decode once, at the single read point.
        $decoded = json_decode((string) $value, true);

        return $decoded ?? $default;
    }

    /**
     * FR: رضایتنامه — سیاست یک‌ولی/دو‌ولی از تنظیمات مدرسه.
     */
    public function consentPolicy(): string
    {
        $raw = $this->setting('consent_policy');

        return in_array($raw, ['one_parent', 'both_parents'], true) ? $raw : 'one_parent';
    }

    /**
     * ورود با کد پیامکی (OTP) — کلید خاموش/روشن مدرسه. پیش‌فرض روشن؛ وقتی
     * خاموش باشد کاربران این مدرسه فقط با رمز عبور وارد می‌شوند.
     */
    public function otpLoginEnabled(): bool
    {
        return (bool) $this->setting('otp_login_enabled', true);
    }
}
