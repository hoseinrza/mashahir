<?php

namespace App\Modules\School\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\School\Models\School;
use App\Support\SchoolContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * FR-35: school settings — consent policy, SMS quiet hours, report card
 * template, attendance edit window. Platform admin sees schools too; school
 * admin manages their own.
 */
class SchoolSettingsApiController extends Controller
{
    private const ALLOWED_KEYS = [
        'consent_policy', 'sms_quiet_hours', 'report_card_template', 'attendance_edit_window',
    ];

    public function show(): JsonResponse
    {
        $this->authorize('schools.settings');

        $school = School::query()->findOrFail(app(SchoolContext::class)->schoolId());

        $settings = [];
        foreach (self::ALLOWED_KEYS as $key) {
            $settings[$key] = $school->setting($key);
        }

        return response()->json(['school' => ['ulid' => $school->ulid, 'name' => $school->name], 'settings' => $settings]);
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
            if (! in_array($entry['key'], self::ALLOWED_KEYS, true)) {
                throw ValidationException::withMessages(['settings' => "کلید {$entry['key']} مجاز نیست."]);
            }

            if ($entry['key'] === 'consent_policy'
                && ! in_array($entry['value'], ['one_parent', 'both_parents'], true)) {
                throw ValidationException::withMessages(['settings' => 'سیاست رضایتنامه نامعتبر است.']);
            }

            \Illuminate\Support\Facades\DB::table('school_settings')->updateOrInsert(
                ['school_id' => $school->id, 'key' => $entry['key']],
                ['value' => json_encode($entry['value']), 'created_at' => now(), 'updated_at' => now()],
            );
        }

        return response()->json(['saved' => true]);
    }
}
