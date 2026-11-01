<?php

namespace App\Modules\Grades\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Academic\Models\AcademicYear;
use App\Modules\Academic\Models\ClassroomSubject;
use App\Modules\Academic\Models\Enrollment;
use App\Modules\Grades\Models\ReportActivityLog;
use App\Modules\Grades\Models\ReportPeriod;
use App\Modules\Grades\Models\StudentReportEntry;
use App\Modules\Grades\Models\TeacherReportSubmission;
use App\Modules\Grades\Services\ReportCycleService;
use App\Modules\Identity\Models\User;
use App\Modules\People\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Monthly report-card cycle: the principal's period panel and the teacher's
 * entry panel. Permissions decide WHICH actions a role holds; the service
 * decides whether the workflow state allows them.
 */
class ReportCycleApiController extends Controller
{
    public const JALALI_MONTHS = [
        1 => 'فروردین', 2 => 'اردیبهشت', 3 => 'خرداد', 4 => 'تیر', 5 => 'مرداد', 6 => 'شهریور',
        7 => 'مهر', 8 => 'آبان', 9 => 'آذر', 10 => 'دی', 11 => 'بهمن', 12 => 'اسفند',
    ];

    // The period and a teacher's submission both use the key 'open', so the two
    // vocabularies cannot share one map — the period would read "در انتظار ثبت".
    private const PERIOD_STATUS_TITLES = [
        ReportPeriod::STATUS_DRAFT => 'هنوز باز نشده',
        ReportPeriod::STATUS_OPEN => 'باز',
    ];

    private const SUBMISSION_STATUS_TITLES = [
        TeacherReportSubmission::STATUS_OPEN => 'در انتظار ثبت',
        TeacherReportSubmission::STATUS_SUBMITTED => 'ارسال‌شده',
        TeacherReportSubmission::STATUS_REVISION_REQUIRED => 'نیازمند اصلاح',
        TeacherReportSubmission::STATUS_APPROVED => 'تأییدشده',
        TeacherReportSubmission::STATUS_FINALIZED => 'ثبت نهایی شد',
        TeacherReportSubmission::STATUS_ARCHIVED => 'بایگانی‌شده',
    ];

    private const ACTION_TITLES = [
        'report_period.created' => 'ایجاد دوره',
        'report_period.opened' => 'باز کردن دوره توسط مدیر',
        'report_entries.saved' => 'ثبت/ویرایش کارنامه‌ها توسط معلم',
        'report_submission.submitted' => 'ارسال برای بررسی مدیر',
        'report_submission.returned' => 'بازگشت برای اصلاح',
        'report_submission.approved' => 'تأیید مدیر',
        'report_submission.finalized' => 'ثبت نهایی مدیر',
        'report_submission.archived' => 'بایگانی',
        'report_submission.reopened' => 'بازگشایی با دلیل',
    ];

    public function __construct(private readonly ReportCycleService $cycle)
    {
    }

    // ── Principal: periods ────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $this->authorize('report_periods.view');

        $periods = ReportPeriod::query()
            ->with('academicYear')
            ->orderByDesc('academic_year_id')
            ->orderByDesc('month')
            ->get();

        return response()->json([
            'data' => $periods->map(fn (ReportPeriod $p) => $this->presentPeriod($p, withStats: true))->values(),
            'period_statuses' => self::PERIOD_STATUS_TITLES,
            'submission_statuses' => self::SUBMISSION_STATUS_TITLES,
            'months' => self::JALALI_MONTHS,
            // The year picker needs the list, and this panel is the only place
            // that asks for it — kept here so the cycle stays self-contained.
            'years' => AcademicYear::query()->orderByDesc('starts_on')
                ->get(['id', 'title'])->map(fn (AcademicYear $y) => ['id' => $y->id, 'title' => $y->title])->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('report_periods.manage');

        $data = $request->validate([
            'academic_year_id' => ['required', 'integer'],
            'month' => ['required', 'integer', 'between:1,12'],
            'title' => ['nullable', 'string', 'max:60'],
            'due_at' => ['nullable', 'date'],
        ]);

        $period = $this->cycle->createPeriod(
            (int) $data['academic_year_id'],
            (int) $data['month'],
            $data['title'] ?? null,
            isset($data['due_at']) ? Carbon::parse($data['due_at']) : null,
        );

        return response()->json(['data' => $this->presentPeriod($period)], 201);
    }

    /** Open the period for everyone, or only for the selected teachers. */
    public function open(Request $request, ReportPeriod $period): JsonResponse
    {
        $this->authorize('report_periods.manage');

        $data = $request->validate([
            'teacher_ulids' => ['nullable', 'array'],
            'teacher_ulids.*' => ['string'],
        ]);

        $teacherIds = [];
        if (($ulids = $data['teacher_ulids'] ?? []) !== []) {
            $teacherIds = User::query()->whereIn('ulid', $ulids)->pluck('id')->all();
        }

        $period = $this->cycle->openPeriod($period, $teacherIds, (int) $request->user()->id);

        return response()->json(['data' => $this->presentPeriod($period, withStats: true)]);
    }

    /** Who the period can be opened for — the same set the auto-open uses. */
    public function teachers(): JsonResponse
    {
        $this->authorize('report_periods.manage');

        return response()->json(['data' => $this->cycle->teacherOptions()]);
    }

    public function show(ReportPeriod $period): JsonResponse
    {
        $this->authorize('report_periods.view');

        $submissions = TeacherReportSubmission::query()
            ->where('report_period_id', $period->id)
            ->with('teacher')
            ->get()
            ->map(fn (TeacherReportSubmission $s) => $this->presentSubmission($s, $period));

        $activity = ReportActivityLog::query()
            ->where('report_period_id', $period->id)
            ->with(['actor:id,first_name,last_name', 'submission.teacher:id,first_name,last_name'])
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (ReportActivityLog $l) => [
                'action' => $l->action,
                'action_title' => self::ACTION_TITLES[$l->action] ?? $l->action,
                'actor' => $l->actor?->fullName() ?? '—',
                'teacher' => $l->submission?->teacher?->fullName(),
                'reason' => $l->reason,
                'detail' => $l->detail,
                'created_at' => $l->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'data' => $this->presentPeriod($period, withStats: true) + [
                'submissions' => $submissions->values(),
                'activity' => $activity->values(),
            ],
        ]);
    }

    /** One teacher's submitted cards, for the principal's review. */
    public function submission(ReportPeriod $period, TeacherReportSubmission $submission): JsonResponse
    {
        $this->authorize('report_periods.view');
        $this->assertSamePeriod($period, $submission);

        return response()->json([
            'data' => $this->presentSubmission($submission, $period) + [
                'groups' => $this->entryGroups($submission),
            ],
        ]);
    }

    public function returnForRevision(Request $request, ReportPeriod $period, TeacherReportSubmission $submission): JsonResponse
    {
        $this->authorize('report_periods.review');

        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:1000']]);

        $submission = $this->cycle->returnForRevision($period, $submission, $data['note'], (int) $request->user()->id);

        return response()->json(['data' => $this->presentSubmission($submission, $period)]);
    }

    public function approve(Request $request, ReportPeriod $period, TeacherReportSubmission $submission): JsonResponse
    {
        $this->authorize('report_periods.review');

        $submission = $this->cycle->approve($period, $submission, (int) $request->user()->id);

        return response()->json(['data' => $this->presentSubmission($submission, $period)]);
    }

    public function finalize(Request $request, ReportPeriod $period, TeacherReportSubmission $submission): JsonResponse
    {
        $this->authorize('report_periods.finalize');

        $submission = $this->cycle->finalize($period, $submission, (int) $request->user()->id);

        return response()->json(['data' => $this->presentSubmission($submission, $period)]);
    }

    /** sh7: reopening an archived cycle needs a reason and leaves a trail. */
    public function reopen(Request $request, ReportPeriod $period, TeacherReportSubmission $submission): JsonResponse
    {
        $this->authorize('report_periods.reopen');

        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:1000']]);

        $submission = $this->cycle->reopen($period, $submission, $data['reason'], (int) $request->user()->id);

        return response()->json(['data' => $this->presentSubmission($submission, $period)]);
    }

    // ── Teacher ───────────────────────────────────────────────────────────

    /** Periods open for me, with where I stand in each. */
    public function mine(Request $request): JsonResponse
    {
        $this->authorize('report_periods.view');

        $submissions = TeacherReportSubmission::query()
            ->where('teacher_id', $request->user()->id)
            ->with(['period.academicYear', 'teacher:id,ulid,first_name,last_name'])
            ->whereHas('period', fn ($q) => $q->where('status', ReportPeriod::STATUS_OPEN))
            // Newest school year and month first — creation order is not chronology.
            ->join('report_periods', 'report_periods.id', '=', 'teacher_report_submissions.report_period_id')
            ->select('teacher_report_submissions.*')
            ->orderByDesc('report_periods.academic_year_id')
            ->orderByDesc('report_periods.month')
            ->get()
            ->map(fn (TeacherReportSubmission $s) => $this->presentSubmission($s, $s->period));

        return response()->json(['data' => $submissions->values()]);
    }

    /**
     * The teacher's own roster merged with whatever he already saved — built
     * from classroom_subjects of THIS teacher (sh2), so another teacher's
     * students never appear here.
     */
    public function entries(Request $request, TeacherReportSubmission $submission): JsonResponse
    {
        $this->authorize('report_periods.view');
        $this->assertMine($request, $submission);

        return response()->json([
            'data' => $this->presentSubmission($submission, $submission->period) + [
                'groups' => $this->entryGroups($submission),
            ],
        ]);
    }

    public function saveEntries(Request $request, TeacherReportSubmission $submission): JsonResponse
    {
        $this->authorize('report_periods.record');
        $this->assertMine($request, $submission);

        $data = $request->validate([
            'entries' => ['required', 'array', 'min:1'],
            'entries.*.student_ulid' => ['required', 'string'],
            'entries.*.classroom_subject_id' => ['required', 'integer'],
            'entries.*.score' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'entries.*.max_score' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'entries.*.evaluation' => ['nullable', 'string', 'max:60'],
            'entries.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $students = Student::query()
            ->whereIn('ulid', collect($data['entries'])->pluck('student_ulid')->all())
            ->pluck('id', 'ulid');

        $lines = collect($data['entries'])->map(fn (array $line) => [
            'student_id' => (int) ($students[$line['student_ulid']] ?? 0),
            'classroom_subject_id' => (int) $line['classroom_subject_id'],
            'score' => $line['score'] ?? null,
            'max_score' => $line['max_score'] ?? 20,
            'evaluation' => $line['evaluation'] ?? null,
            'notes' => $line['notes'] ?? null,
        ])->all();

        $submission = $this->cycle->saveEntries($submission, $lines, (int) $request->user()->id);

        return response()->json(['data' => $this->presentSubmission($submission, $submission->period)]);
    }

    public function submit(Request $request, TeacherReportSubmission $submission): JsonResponse
    {
        $this->authorize('report_periods.record');
        $this->assertMine($request, $submission);

        $submission = $this->cycle->submit($submission, (int) $request->user()->id);

        return response()->json(['data' => $this->presentSubmission($submission, $submission->period)]);
    }

    // ── Presentation ──────────────────────────────────────────────────────

    private function presentPeriod(ReportPeriod $period, bool $withStats = false): array
    {
        $payload = [
            'ulid' => $period->ulid,
            'academic_year_id' => $period->academic_year_id,
            'academic_year' => $period->academicYear?->title,
            'month' => $period->month,
            'month_title' => self::JALALI_MONTHS[$period->month] ?? (string) $period->month,
            'title' => $period->title,
            'status' => $period->status,
            'status_title' => self::PERIOD_STATUS_TITLES[$period->status] ?? $period->status,
            'due_at' => $period->due_at?->toIso8601String(),
            'opened_at' => $period->opened_at?->toIso8601String(),
            'opened_by' => $period->opened_by,
        ];

        if (! $withStats) {
            return $payload;
        }

        $counts = TeacherReportSubmission::query()
            ->where('report_period_id', $period->id)
            ->selectRaw('status, count(*)::int as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $payload['stats'] = [
            'total' => (int) $counts->sum(),
            'open' => (int) $counts->get(TeacherReportSubmission::STATUS_OPEN, 0),
            'submitted' => (int) $counts->get(TeacherReportSubmission::STATUS_SUBMITTED, 0),
            'revision_required' => (int) $counts->get(TeacherReportSubmission::STATUS_REVISION_REQUIRED, 0),
            'approved' => (int) $counts->get(TeacherReportSubmission::STATUS_APPROVED, 0),
            'archived' => (int) $counts->get(TeacherReportSubmission::STATUS_ARCHIVED, 0),
        ];

        return $payload;
    }

    private function presentSubmission(TeacherReportSubmission $submission, ReportPeriod $period): array
    {
        return [
            'ulid' => $submission->ulid,
            'period_ulid' => $period->ulid,
            'month_title' => self::JALALI_MONTHS[$period->month] ?? (string) $period->month,
            'academic_year' => $period->academicYear?->title,
            'due_at' => $period->due_at?->toIso8601String(),
            'period_status' => $period->status,
            'teacher_ulid' => $submission->teacher?->ulid,
            'teacher_name' => $submission->teacher?->fullName() ?? '—',
            'status' => $submission->status,
            'status_title' => self::SUBMISSION_STATUS_TITLES[$submission->status] ?? $submission->status,
            'editable' => $submission->isEditableByTeacher() && $period->isOpen(),
            'locked' => $submission->isLocked(),
            'entry_count' => StudentReportEntry::query()->where('teacher_report_submission_id', $submission->id)->count(),
            'submitted_at' => $submission->submitted_at?->toIso8601String(),
            'reviewed_at' => $submission->reviewed_at?->toIso8601String(),
            'returned_at' => $submission->returned_at?->toIso8601String(),
            'return_note' => $submission->return_note,
            'approved_at' => $submission->approved_at?->toIso8601String(),
            'finalized_at' => $submission->finalized_at?->toIso8601String(),
            'archived_at' => $submission->archived_at?->toIso8601String(),
            'reopen_reason' => $submission->reopen_reason,
        ];
    }

    /**
     * My students grouped by lesson-class, each line carrying the saved entry
     * when there is one — the exact shape the teacher table edits.
     */
    private function entryGroups(TeacherReportSubmission $submission): array
    {
        $entries = StudentReportEntry::query()
            ->where('teacher_report_submission_id', $submission->id)
            ->get()
            ->keyBy(fn (StudentReportEntry $e) => $e->student_id.':'.$e->classroom_subject_id);

        return ClassroomSubject::query()
            ->where('teacher_id', $submission->teacher_id)
            ->with(['subject:id,title', 'classroom:id,title'])
            ->get()
            ->map(function (ClassroomSubject $cs) use ($entries) {
                $students = Student::query()
                    ->whereIn('id', Enrollment::query()
                        ->where('classroom_id', $cs->classroom_id)
                        ->where('status', Enrollment::STATUS_ACTIVE)
                        ->pluck('student_id'))
                    ->orderBy('last_name')
                    ->get();

                return [
                    'classroom_subject_id' => $cs->id,
                    'classroom' => $cs->classroom?->title,
                    'subject' => $cs->subject?->title,
                    'rows' => $students->map(function (Student $s) use ($cs, $entries) {
                        $entry = $entries->get($s->id.':'.$cs->id);

                        return [
                            'student_ulid' => $s->ulid,
                            'student_name' => $s->fullName(),
                            'score' => $entry?->score,
                            'max_score' => $entry?->max_score,
                            'evaluation' => $entry?->evaluation,
                            'notes' => $entry?->notes,
                        ];
                    })->values(),
                ];
            })
            ->filter(fn (array $group) => $group['rows']->isNotEmpty())
            ->map(fn (array $group) => [...$group, 'rows' => $group['rows']->all()])
            ->values()
            ->all();
    }

    private function assertMine(Request $request, TeacherReportSubmission $submission): void
    {
        if ((int) $submission->teacher_id !== (int) $request->user()->id) {
            abort(404);
        }
    }

    private function assertSamePeriod(ReportPeriod $period, TeacherReportSubmission $submission): void
    {
        if ((int) $submission->report_period_id !== (int) $period->id) {
            abort(404);
        }
    }
}
