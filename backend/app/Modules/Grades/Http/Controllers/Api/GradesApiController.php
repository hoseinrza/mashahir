<?php

namespace App\Modules\Grades\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Academic\Models\AcademicYear;
use App\Modules\Academic\Models\ClassroomSubject;
use App\Modules\Grades\Models\GradeItem;
use App\Modules\Grades\Models\ReportCard;
use App\Modules\Grades\Services\GradeService;
use App\Modules\People\Models\Student;
use App\Modules\People\Services\GuardianAccessService;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class GradesApiController extends Controller
{
    public function __construct(
        private readonly GradeService $service,
        private readonly ScopeResolver $resolver,
        private readonly GuardianAccessService $access,
    ) {
    }

    /**
     * FR-23: teacher records drafts. Students/guardians only ever see
     * PUBLISHED grades — draft/approved are staff-only (FR-25). Guardians
     * reach grades through reportcards.view (per-link flags), not grades.view.
     */
    public function index(Request $request): JsonResponse
    {
        $registrar = app(PermissionRegistrar::class);

        if (! $registrar->allows('grades.view') && ! $registrar->allows('reportcards.view')) {
            abort(403);
        }

        $roleKey = $registrar->activeRole()?->role->key;

        $query = GradeItem::query()->with(['student', 'classroomSubject.subject', 'term']);

        // Family and students only ever see published rows.
        if (in_array($roleKey, ['guardian', 'student'], true)) {
            $ids = $this->resolver->studentIds() ?? [];
            $query->whereIn('student_id', $ids ?: [0])->where('status', GradeItem::STATUS_PUBLISHED);

            if ($roleKey === 'guardian') {
                $selfId = $request->user()->id;
                $visible = collect($ids)->filter(
                    fn ($sid) => $this->access->may($selfId, $sid, 'can_view_grades'),
                );
                $query->whereIn('student_id', $visible ?: [0]);
            }
        } else {
            // Teacher scope sh2.
            $classroomIds = $this->resolver->classroomIds();
            if ($classroomIds !== null) {
                $query->whereHas('classroomSubject', fn ($q) => $q->whereIn('classroom_id', $classroomIds ?: [0]));
            }
        }

        return response()->json([
            'data' => $query->orderByDesc('id')->limit(300)->get()->map(fn (GradeItem $g) => [
                'id' => $g->id,
                'student_ulid' => $g->student?->ulid,
                'student_name' => $g->student?->fullName(),
                'subject' => $g->classroomSubject?->subject?->title,
                'term' => $g->term?->title,
                'source_type' => $g->source_type,
                'delivery' => $g->delivery,
                'status' => $g->status,
                'score' => $g->score,
                'max_score' => $g->max_score,
            ]),
        ]);
    }

    /**
     * لیست کلاس برای ثبت نمره: دانش‌آموزانِ درس-کلاس + نمرات ثبت‌شده‌ی همان
     * درس و ترم + میانگین هر دانش‌آموز از ۲۰ (مقیاس‌شده از max_score).
     * محدوده معلم همان sh2 است — کلاس بیرون از محدوده = ۴۰۴.
     */
    public function roster(Request $request): JsonResponse
    {
        $registrar = app(PermissionRegistrar::class);

        if (! $registrar->allows('grades.record') && ! $registrar->allows('grades.view')) {
            abort(403);
        }

        $data = $request->validate([
            'classroom_subject_id' => ['required', 'integer'],
            'term_id' => ['nullable', 'integer'],
        ]);

        $subject = ClassroomSubject::query()
            ->with(['subject', 'classroom', 'teacher'])
            ->findOrFail($data['classroom_subject_id']);

        $classroomIds = $this->resolver->classroomIds();
        if ($classroomIds !== null && ! in_array($subject->classroom_id, $classroomIds, true)) {
            abort(404);
        }

        $termId = $data['term_id'] ?? \App\Modules\Academic\Models\Term::query()
            ->whereHas('academicYear', fn ($q) => $q->where('school_id', $subject->school_id))
            ->max('id');

        $studentIds = \App\Modules\Academic\Models\Enrollment::query()
            ->where('classroom_id', $subject->classroom_id)
            ->where('status', 'active')
            ->pluck('student_id');

        $students = Student::query()->whereIn('id', $studentIds)->orderBy('last_name')->get();

        $items = GradeItem::query()
            ->where('classroom_subject_id', $subject->id)
            ->where('term_id', $termId)
            ->whereIn('student_id', $studentIds)
            ->orderByDesc('id')
            ->get()
            ->groupBy('student_id');

        $rows = $students->map(function (Student $s) use ($items) {
            $own = $items->get($s->id, collect());

            $avg = $own->isEmpty() ? null : round(
                $own->avg(fn (GradeItem $g) => $g->max_score > 0 ? ($g->score / $g->max_score) * 20 : 0),
                2,
            );

            return [
                'student_ulid' => $s->ulid,
                'student_name' => $s->fullName(),
                'avg_out_of_20' => $avg,
                'final_in_person' => $own->firstWhere('source_type', GradeItem::SOURCE_IN_PERSON_EXAM)?->only([
                    'id', 'status', 'score', 'max_score',
                ]),
                'items' => $own->map(fn (GradeItem $g) => [
                    'id' => $g->id,
                    'status' => $g->status,
                    'score' => $g->score,
                    'max_score' => $g->max_score,
                    'delivery' => $g->delivery,
                    'source_type' => $g->source_type,
                ])->values(),
            ];
        });

        $averages = $rows->pluck('avg_out_of_20')->filter();

        return response()->json([
            'subject' => $subject->subject?->title,
            'classroom' => $subject->classroom?->title,
            'teacher' => $subject->teacher?->fullName(),
            'term_id' => (int) $termId,
            'class_avg_out_of_20' => $averages->isEmpty() ? null : round($averages->avg(), 2),
            'data' => $rows,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('grades.record');

        $data = $request->validate([
            'student_ulid' => ['required', 'string'],
            'classroom_subject_id' => ['required', 'integer'],
            'term_id' => ['required', 'integer'],
            'score' => ['required', 'integer', 'min:0'],
            'max_score' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'source_type' => ['required', 'in:exam,assignment,in_person_exam,manual'],
            'delivery' => ['required', 'in:in_person,online'],
        ]);

        $subject = ClassroomSubject::query()->findOrFail($data['classroom_subject_id']);
        $ids = $this->resolver->classroomIds();
        if ($ids !== null && ! in_array($subject->classroom_id, $ids, true)) {
            abort(404);
        }

        $student = Student::query()->where('ulid', $data['student_ulid'])->firstOrFail();
        \App\Modules\Academic\Models\Term::query()->findOrFail($data['term_id']);

        $item = $this->service->recordDraft(
            $student->id,
            $subject->id,
            $data['term_id'],
            $data['score'],
            $data['max_score'] ?? 100,
            $data['source_type'],
            null,
            $data['delivery'],
            $request->user()->id,
        );

        return response()->json(['id' => $item->id, 'status' => $item->status], 201);
    }

    /**
     * Draft grades are freely editable by the recorder; approved items go
     * back to draft on edit, published items NEVER change here (sh7 flow).
     */
    public function update(Request $request, GradeItem $item): JsonResponse
    {
        $this->authorize('grades.record');

        if ($item->status === GradeItem::STATUS_PUBLISHED) {
            throw ValidationException::withMessages(['status' => 'نمره منتشرشده فقط با مسیر change_published و ثبت دلیل تغییر می‌کند.']);
        }

        $data = $request->validate([
            'score' => ['required', 'integer', 'min:0'],
            'max_score' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        if ($data['score'] > ($data['max_score'] ?? $item->max_score)) {
            throw ValidationException::withMessages(['score' => 'نمره بیشتر از سقف است.']);
        }

        $item->forceFill([
            'score' => $data['score'],
            'max_score' => $data['max_score'] ?? $item->max_score,
            // Editing an approved grade sends it back to the deputy.
            'status' => GradeItem::STATUS_DRAFT,
            'approved_by' => null,
        ])->save();

        return response()->json(['id' => $item->id, 'status' => $item->status, 'score' => $item->score]);
    }

    public function approve(Request $request, GradeItem $item): JsonResponse
    {
        $this->authorize('grades.approve');

        $item = $this->service->approve($item, $request->user()->id);

        return response()->json(['id' => $item->id, 'status' => $item->status]);
    }

    /**
     * FR-22/FR-23: two SEPARATE report cards; publish needs grades.publish.
     */
    public function publishReportCard(Request $request): JsonResponse
    {
        $this->authorize('grades.publish');

        $data = $request->validate([
            'student_ulid' => ['required', 'string'],
            'term_id' => ['required', 'integer'],
            'kind' => ['required', 'in:in_person,online'],
        ]);

        $student = Student::query()->where('ulid', $data['student_ulid'])->firstOrFail();

        $card = $this->service->publishReportCard($student->id, $data['term_id'], $data['kind'], $request->user()->id);

        return response()->json([
            'ulid' => $card->ulid,
            'version' => $card->version,
            'kind' => $card->kind,
            'status' => $card->status,
            'lines' => $card->lines->map(fn ($l) => [
                'subject' => $l->subject?->title,
                'score' => $l->score,
            ]),
        ], 201);
    }

    /**
     * sh7: changing a published grade requires the reason; logged forever.
     */
    public function changePublished(Request $request, GradeItem $item): JsonResponse
    {
        $this->authorize('grades.change_published');

        $data = $request->validate([
            'score' => ['required', 'integer', 'min:0'],
            'reason' => ['required', 'string', 'min:5'],
        ]);

        $change = $this->service->changePublished($item, $data['score'], $data['reason'], $request->user()->id);

        return response()->json(['id' => $change->id, 'old_score' => $change->old_score, 'new_score' => $change->new_score]);
    }

    public function reportCards(Request $request): JsonResponse
    {
        $this->authorize('reportcards.view');

        $roleKey = app(PermissionRegistrar::class)->activeRole()?->role->key;
        $registrar = app(PermissionRegistrar::class);

        $query = ReportCard::query()->with(['student', 'term', 'lines.subject'])->orderByDesc('id');

        if (in_array($roleKey, ['guardian', 'student'], true)) {
            // sh3/sh4 + FR-25: only published versions.
            $ids = $this->resolver->studentIds() ?? [];
            $query->whereIn('student_id', $ids ?: [0])->where('status', ReportCard::STATUS_PUBLISHED);

            if ($roleKey === 'guardian') {
                $visible = collect($ids)->filter(
                    fn ($sid) => $this->access->may($request->user()->id, $sid, 'can_view_grades'),
                );
                $query->whereIn('student_id', $visible ?: [0]);
            }
        } elseif (! $registrar->allows('reportcards.view_draft')) {
            $query->where('status', ReportCard::STATUS_PUBLISHED);
        }

        $cards = $query->limit(100)->get();

        // Cards published before the ceiling was frozen into the line payload
        // still have to render as a real score out of 20 — read it from the
        // source grade item instead of showing a raw out-of-100 number.
        $ceilings = GradeItem::query()
            ->with('classroomSubject')
            ->whereIn('student_id', $cards->pluck('student_id')->unique()->all() ?: [0])
            ->whereIn('term_id', $cards->pluck('term_id')->unique()->all() ?: [0])
            ->get()
            ->keyBy(fn (GradeItem $i) => $i->student_id.':'.$i->term_id.':'.($i->classroomSubject?->subject_id ?? 0));

        return response()->json([
            'data' => $cards->map(fn (ReportCard $c) => [
                'ulid' => $c->ulid,
                'student_ulid' => $c->student?->ulid,
                'student_name' => $c->student?->fullName(),
                'term' => $c->term?->title,
                'kind' => $c->kind,
                'version' => $c->version,
                'status' => $c->status,
                'published_at' => $c->published_at?->toIso8601String(),
                'lines' => $c->lines->map(fn ($l) => [
                    'subject' => $l->subject?->title,
                    'score' => $l->score,
                    'max_score' => $l->data['max_score'] ?? $ceilings->get($c->student_id.':'.$c->term_id.':'.$l->subject_id)?->max_score,
                    'source_type' => $l->data['source_type']
                        ?? $ceilings->get($c->student_id.':'.$c->term_id.':'.$l->subject_id)?->source_type,
                    'teacher_comment' => $l->teacher_comment,
                ]),
            ]),
        ]);
    }

    /**
     * FR-26: PDF of a PUBLISHED report card only. Minimal HTML print view.
     */
    public function exportPdf(Request $request, ReportCard $card): \Illuminate\Http\Response
    {
        $this->authorize('reportcards.export_pdf');

        $roleKey = app(PermissionRegistrar::class)->activeRole()?->role->key;
        if (in_array($roleKey, ['guardian', 'student'], true) && $card->status !== ReportCard::STATUS_PUBLISHED) {
            abort(404);
        }

        $html = view('grades.report-card', ['card' => $card->load(['student', 'term', 'lines.subject'])])->render();

        return response($html, 200, ['Content-Type' => 'text/html; charset=utf-8']);
    }
}
