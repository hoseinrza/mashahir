<?php

namespace App\Modules\School\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\OnlineClasses\Services\AlocomManager;
use App\Modules\School\Models\School;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * FR-35: school settings — consent policy, SMS quiet hours, report card
 * template, attendance edit window. Platform admin sees schools too; school
 * admin manages their own.
 */
class SchoolSettingsApiController extends Controller
{
    private const ALLOWED_KEYS = [
        'consent_policy', 'sms_quiet_hours', 'report_card_template', 'attendance_edit_window',
        'otp_login_enabled',
    ];

    public function show(): JsonResponse
    {
        $this->authorize('schools.settings');

        $school = School::query()->findOrFail(app(SchoolContext::class)->schoolId());

        $settings = [];
        foreach (self::ALLOWED_KEYS as $key) {
            $settings[$key] = $school->setting($key);
        }

        return response()->json([
            'school' => ['ulid' => $school->ulid, 'name' => $school->name],
            'settings' => $settings,
            // Alocom online-class credentials — write-only: only the username
            // and a configured flag come back, never the password.
            'alocom_username' => $school->alocom_username,
            'alocom_configured' => $school->alocomConfigured(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->authorize('schools.settings');

        $data = $request->validate([
            'settings' => ['required', 'array'],
            'settings.*.key' => ['required', 'string'],
            'settings.*.value' => ['nullable'],
        ]);

        $school = School::query()->findOrFail(app(SchoolContext::class)->schoolId());

        foreach ($data['settings'] as $entry) {
            // Alocom (الوکام) organizer credentials live on the school row,
            // not in school_settings: the password is encrypted at rest, the
            // connection is verified LIVE against the provider, and both
            // directions are audited.
            if ($entry['key'] === 'alocom_credentials') {
                $this->updateAlocomCredentials($school, $entry['value']);
                continue;
            }

            if (! in_array($entry['key'], self::ALLOWED_KEYS, true)) {
                throw ValidationException::withMessages(['settings' => "کلید {$entry['key']} مجاز نیست."]);
            }

            if ($entry['key'] === 'consent_policy'
                && ! in_array($entry['value'], ['one_parent', 'both_parents'], true)) {
                throw ValidationException::withMessages(['settings' => 'سیاست رضایتنامه نامعتبر است.']);
            }

            if ($entry['key'] === 'otp_login_enabled' && ! is_bool($entry['value'])) {
                throw ValidationException::withMessages(['settings' => 'مقدار کلید OTP باید true یا false باشد.']);
            }

            \Illuminate\Support\Facades\DB::table('school_settings')->updateOrInsert(
                ['school_id' => $school->id, 'key' => $entry['key']],
                ['value' => json_encode($entry['value']), 'created_at' => now(), 'updated_at' => now()],
            );
        }

        return response()->json(['saved' => true]);
    }

    /**
     * The principal stores the school's Alocom username/password: a live
     * login attempt decides whether the credentials are accepted; an empty
     * payload disconnects. Both directions are audited.
     */
    private function updateAlocomCredentials(School $school, mixed $value): void
    {
        $value = is_array($value) ? $value : [];
        $username = trim((string) ($value['username'] ?? ''));
        $password = (string) ($value['password'] ?? '');

        if ($username === '' && $password === '') {
            $school->forceFill(['alocom_username' => null, 'alocom_password' => null])->save();
            app(AuditService::class)->log('school.alocom_credentials_cleared', $school);

            return;
        }

        if ($username === '' || $password === '') {
            throw ValidationException::withMessages(['settings' => 'نام کاربری و رمز الوکام باید با هم ارسال شوند.']);
        }

        try {
            $account = AlocomManager::verify($username, $password);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['settings' => 'اتصال به الوکام برقرار نشد: ' . $e->getMessage()]);
        }

        $school->forceFill(['alocom_username' => $username, 'alocom_password' => $password])->save();

        app(AuditService::class)->log('school.alocom_credentials_set', $school, new: [
            'username' => $username,
            'account' => $account,
        ]);
    }
}
