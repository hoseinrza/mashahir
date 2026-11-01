<?php

namespace App\Modules\Admissions\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Admissions\Models\PreRegistration;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Services\NotificationService;
use App\Modules\School\Models\School;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Public landing-page intake (پیش‌ثبت‌نام آزمون ورودی). Guests submit the
 * form without an account; the school principal (school_admin) and the
 * registrar (office_manager) review and process the requests in the portal.
 */
class PreRegistrationsApiController extends Controller
{
    public const STATUS_TITLES = [
        PreRegistration::STATUS_NEW => 'جدید',
        PreRegistration::STATUS_CONTACTED => 'تماس اولیه انجام شد',
        PreRegistration::STATUS_EXAM_SCHEDULED => 'وقت آزمون تعیین شد',
        PreRegistration::STATUS_ACCEPTED => 'پذیرفته شد',
        PreRegistration::STATUS_WAITLIST => 'لیست انتظار',
        PreRegistration::STATUS_REJECTED => 'رد شد',
    ];

    public function __construct(private readonly NotificationService $notifications)
    {
    }

    /** Public endpoint — the landing form. Strictly throttled on the route. */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedPayload($request);

        $school = $this->resolveSchool($request);

        $registration = PreRegistration::query()->create($data + [
            'school_id' => $school->id,
            'tracking_code' => $this->uniqueTrackingCode(),
            'status' => PreRegistration::STATUS_NEW,
        ]);

        $this->notifyPrincipals($school, $registration);

        return response()->json([
            'message' => 'درخواست پیش‌ثبت‌نام شما در سامانه مدرسه ثبت شد؛ کارشناسان پذیرش با شما تماس می‌گیرند.',
            'tracking_code' => $registration->tracking_code,
        ], 201);
    }

    /** School-scoped list with pipeline stats for the principal/registrar. */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('preregistrations.view');

        $query = PreRegistration::query()->orderByDesc('id');

        if (($status = $request->query('status')) && in_array($status, PreRegistration::STATUSES, true)) {
            $query->where('status', $status);
        }

        $perPage = min(max($request->integer('per_page', 60), 1), 100);
        $rows = $query->paginate($perPage);

        return response()->json([
            'stats' => [
                'total' => PreRegistration::query()->count(),
                'new' => PreRegistration::query()->where('status', PreRegistration::STATUS_NEW)->count(),
                'today' => PreRegistration::query()->where('created_at', '>=', now()->startOfDay())->count(),
                'accepted' => PreRegistration::query()->where('status', PreRegistration::STATUS_ACCEPTED)->count(),
            ],
            'current_page' => $rows->currentPage(),
            'last_page' => $rows->lastPage(),
            'data' => collect($rows->items())->map(fn (PreRegistration $r) => $this->present($r))->values(),
        ]);
    }

    /** Move a request through the admission pipeline. */
    public function update(Request $request, PreRegistration $registration): JsonResponse
    {
        $this->authorize('preregistrations.manage');

        $data = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', PreRegistration::STATUSES)],
            'admin_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $old = ['status' => $registration->status];

        $registration->fill($data)->save();

        app(AuditService::class)->log(
            'preregistration.status_changed',
            $registration,
            $old,
            ['status' => $registration->status],
        );

        return response()->json(['data' => $this->present($registration->refresh())]);
    }

    private function validatedPayload(Request $request): array
    {
        $data = $request->validate([
            'student_name' => ['required', 'string', 'min:3', 'max:120'],
            'grade' => ['required', 'in:' . implode(',', PreRegistration::GRADES)],
            'last_gpa' => ['nullable', 'string', 'max:8'],
            'parent_phone' => ['required', 'string', 'max:20'],
            'current_school' => ['nullable', 'string', 'max:150'],
            'has_honor' => ['nullable', 'boolean'],
            'honor_desc' => ['nullable', 'string', 'max:400'],
            'school' => ['nullable', 'string', 'exists:schools,ulid'],
        ]);

        $phone = $this->toLatinDigits($data['parent_phone']);
        if (str_starts_with($phone, '+98')) {
            $phone = '0' . substr($phone, 3);
        } elseif (str_starts_with($phone, '98') && strlen($phone) === 12) {
            $phone = '0' . substr($phone, 2);
        }

        if (! preg_match('/^09\d{9}$/', $phone)) {
            throw ValidationException::withMessages([
                'parent_phone' => 'شماره همراه ولی باید یک موبایل معتبر باشد (مثال: ۰۹۱۲۳۴۵۶۷۸۹).',
            ]);
        }

        $gpa = $data['last_gpa'] ?? null;
        if ($gpa !== null && $gpa !== '') {
            $gpa = $this->toLatinDigits($gpa);

            if (! is_numeric($gpa) || (float) $gpa < 0 || (float) $gpa > 20) {
                throw ValidationException::withMessages([
                    'last_gpa' => 'معدل باید عددی بین ۰ تا ۲۰ باشد.',
                ]);
            }
        }

        if (! empty($data['has_honor']) && empty($data['honor_desc'])) {
            throw ValidationException::withMessages([
                'honor_desc' => 'برای بررسی سهمیه استعداد درخشان، توضیح افتخار را وارد کنید.',
            ]);
        }

        return [
            'student_name' => trim($data['student_name']),
            'grade' => $data['grade'],
            'last_gpa' => ($gpa !== null && $gpa !== '') ? $gpa : null,
            'parent_phone' => $phone,
            'current_school' => ($data['current_school'] ?? null) ? trim($data['current_school']) : null,
            'has_honor' => (bool) ($data['has_honor'] ?? false),
            'honor_desc' => ($data['honor_desc'] ?? null) ? trim($data['honor_desc']) : null,
        ];
    }

    /** Persian/Arabic digits → Latin so validation is locale-proof. */
    private function toLatinDigits(string $value): string
    {
        return strtr($value, [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);
    }

    /**
     * The landing page has no auth context: an explicit school ulid wins,
     * otherwise the (single) active school of the platform.
     */
    private function resolveSchool(Request $request): School
    {
        $school = null;

        if ($request->filled('school')) {
            $school = School::query()->where('ulid', $request->string('school'))->where('is_active', true)->first();
        }

        $school ??= School::query()->where('is_active', true)->orderBy('id')->first();

        if ($school === null) {
            throw ValidationException::withMessages([
                'school' => 'هیچ واحد آموزشی فعالی برای پذیرش تعریف نشده است.',
            ]);
        }

        return $school;
    }

    /** Tracking code uniqueness is checked directly on the table: the
     * public request has no school context, so Eloquent scope reads fail. */
    private function uniqueTrackingCode(): string
    {
        do {
            $code = 'MA-' . random_int(100000, 999999);
        } while (DB::table('pre_registrations')->where('tracking_code', $code)->exists());

        return $code;
    }

    /** In-app alert for every active school_admin of the school. */
    private function notifyPrincipals(School $school, PreRegistration $registration): void
    {
        User::query()
            ->whereHas('userRoles', function ($q) use ($school) {
                $q->active()
                    ->where('school_id', $school->id)
                    ->whereHas('role', fn ($r) => $r->where('key', 'school_admin'));
            })
            ->get()
            ->each(function (User $admin) use ($registration, $school): void {
                $this->notifications->notify(
                    $admin,
                    null,
                    'admissions.preregistration',
                    "پیش‌ثبت‌نام جدید: {$registration->student_name}",
                    "پایه {$registration->grade} · کد رهگیری {$registration->tracking_code}",
                    '/pre-registrations',
                    Notification::IMPORTANCE_IMPORTANT,
                    ['in_app'],
                );
            });
    }

    private function present(PreRegistration $r): array
    {
        return [
            'ulid' => $r->ulid,
            'tracking_code' => $r->tracking_code,
            'student_name' => $r->student_name,
            'grade' => $r->grade,
            'last_gpa' => $r->last_gpa,
            'parent_phone' => $r->parent_phone,
            'current_school' => $r->current_school,
            'has_honor' => $r->has_honor,
            'honor_desc' => $r->honor_desc,
            'status' => $r->status,
            'status_title' => self::STATUS_TITLES[$r->status] ?? $r->status,
            'admin_notes' => $r->admin_notes,
            'created_at' => $r->created_at?->toISOString(),
        ];
    }
}
