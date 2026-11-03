<?php

namespace App\Modules\Assignments\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Academic\Models\ClassroomSubject;
use App\Modules\Assignments\Models\Assignment;
use App\Modules\Assignments\Models\Submission;
use App\Modules\Files\Models\File;
use App\Modules\Files\Services\FileService;
use App\Modules\People\Models\Student;
use App\Modules\People\Services\GuardianAccessService;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AssignmentsApiController extends Controller
{
    public function __construct(
        private readonly ScopeResolver $resolver,
        private readonly GuardianAccessService $access,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorize('assignments.view');

        $roleKey = app(PermissionRegistrar::class)->activeRole()?->role->key;

        $assignments = Assignment::query()
            ->with(['classroomSubject.subject', 'classroomSubject.classroom', 'files'])
            ->orderByDesc('due_at')
            ->limit(200)
            ->get();

        if ($roleKey === 'guardian') {
            // sh3: only assignments of classes the children are enrolled in.
            $childrenIds = $this->resolver->studentIds() ?? [];
            $classroomIds = \App\Modules\Academic\Models\Enrollment::query()
                ->whereIn('student_id', $childrenIds)
                ->where('status', 'active')
                ->pluck('classroom_id');
            $assignments = $assignments->filter(
                fn ($a) => $classroomIds->contains($a->classroomSubject->classroom_id),
            )->values();
        } elseif ($roleKey === 'student') {
            // sh4: assignments of my active enrollments.
            $selfIds = $this->resolver->studentIds() ?? [];
            $classroomIds = \App\Modules\Academic\Models\Enrollment::query()
                ->whereIn('student_id', $selfIds)
                ->where('status', 'active')
                ->pluck('classroom_id');
            $assignments = $assignments->filter(
                fn ($a) => $classroomIds->contains($a->classroomSubject->classroom_id),
            )->values();
        }

        return response()->json([
            'data' => $assignments->map(fn (Assignment $a) => $this->assignmentPayload($a)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('assignments.manage');

        $data = $request->validate([
            'classroom_subject_id' => ['required', 'integer'],
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string'],
            'due_at' => ['required', 'date'],
            'max_score' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'file_ulids' => ['nullable', 'array', 'max:5', 'distinct'],
        ]);

        $subject = ClassroomSubject::query()->findOrFail($data['classroom_subject_id']);
        $this->assertSubjectAccess($subject);

        $assignment = Assignment::query()->create([
            ...collect($data)->except(['classroom_subject_id', 'file_ulids'])->all(),
            'classroom_subject_id' => $subject->id,
            'max_score' => $data['max_score'] ?? 100,
            'created_by' => $request->user()->id,
        ]);

        $this->syncFiles($assignment, $data['file_ulids'] ?? []);

        // Deadline reminder to every learner of the classroom, in their own bell.
        app(\App\Modules\Notifications\Services\NotificationService::class)
            ->notifyClassroomLearners(
                $subject->classroom_id,
                'assignment.created',
                "تکلیف جدید: {$assignment->title}",
                'درس '.$subject->subject?->title.' — مهلت تحویل: '.\App\Support\Jalali::dateTime($assignment->due_at),
                '/assignments',
                \App\Modules\Notifications\Models\Notification::IMPORTANCE_INFO,
            );

        return response()->json($this->assignmentPayload($assignment->fresh('files')), 201);
    }

    public function update(Request $request, Assignment $assignment): JsonResponse
    {
        $this->authorize('assignments.manage');
        $this->assertSubjectAccess($assignment->classroomSubject);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string'],
            'due_at' => ['sometimes', 'date'],
            'max_score' => ['sometimes', 'integer', 'min:1', 'max:1000'],
            'file_ulids' => ['sometimes', 'array', 'max:5', 'distinct'],
        ]);

        $assignment->update(collect($data)->except('file_ulids')->all());

        if (array_key_exists('file_ulids', $data)) {
            $this->syncFiles($assignment, $data['file_ulids'] ?? []);
        }

        return response()->json($this->assignmentPayload($assignment->fresh('files')));
    }

    /**
     * FR-12: the student submits text and/or homework sheets (image/PDF);
     * late is computed against due_at.
     */
    public function submit(Request $request, Assignment $assignment): JsonResponse
    {
        $this->authorize('submissions.submit');

        $data = $request->validate([
            'text' => ['nullable', 'string', 'max:20000'],
            'file_ulids' => ['nullable', 'array', 'max:5', 'distinct'],
        ]);

        $text = $data['text'] ?? null;
        $fileUlids = $data['file_ulids'] ?? [];

        if (trim((string) $text) === '' && $fileUlids === []) {
            throw ValidationException::withMessages([
                'text' => 'متن پاسخ یا حداقل یک فایل (تصویر/PDF) لازم است.',
            ]);
        }

        $files = $this->resolveFiles($fileUlids);

        $student = Student::query()
            ->where('user_id', $request->user()->id)
            ->firstOrFail(); // sh4: own submission only

        $enrolled = \App\Modules\Academic\Models\Enrollment::query()
            ->where('student_id', $student->id)
            ->where('classroom_id', $assignment->classroomSubject->classroom_id)
            ->where('status', 'active')
            ->exists();

        if (! $enrolled) {
            abort(404);
        }

        $late = now()->gt($assignment->due_at);

        $submission = Submission::query()->updateOrCreate(
            ['assignment_id' => $assignment->id, 'student_id' => $student->id],
            [
                'school_id' => $assignment->school_id,
                'text' => $text !== null && trim($text) !== '' ? $text : null,
                'status' => $late ? Submission::STATUS_LATE : Submission::STATUS_SUBMITTED,
                'submitted_at' => now(),
            ],
        );

        $submission->files()->sync($files->pluck('id')->all());

        return response()->json([
            'id' => $submission->id,
            'status' => $submission->status,
            'submitted_at' => $submission->submitted_at->toIso8601String(),
            'files' => $files->map(fn (File $f) => app(FileService::class)->payload($f))->values()->all(),
        ], 201);
    }

    /**
     * FR-13: teacher grades; guardian/child see the result read-only.
     */
    public function grade(Request $request, Submission $submission): JsonResponse
    {
        $this->authorize('submissions.grade');

        $data = $request->validate([
            'score' => ['required', 'integer', 'min:0', 'max:1000'],
            'feedback' => ['nullable', 'string', 'max:5000'],
        ]);

        $this->assertSubjectAccess($submission->assignment->classroomSubject);

        if ($data['score'] > $submission->assignment->max_score) {
            throw ValidationException::withMessages(['score' => 'نمره بیشتر از سقف تکلیف است.']);
        }

        $submission->forceFill([
            'score' => $data['score'],
            'feedback' => $data['feedback'] ?? null,
            'status' => Submission::STATUS_GRADED,
            'graded_by' => $request->user()->id,
            'graded_at' => now(),
        ])->save();

        return response()->json([
            'id' => $submission->id,
            'status' => $submission->status,
            'score' => $submission->score,
        ]);
    }

    public function submissions(Request $request, Assignment $assignment): JsonResponse
    {
        $this->authorize('submissions.view');

        $roleKey = app(PermissionRegistrar::class)->activeRole()?->role->key;
        $query = $assignment->submissions()->with(['student', 'files']);

        if ($roleKey === 'guardian') {
            // sh3: only my children's rows.
            $childrenIds = $this->resolver->studentIds() ?? [];
            $query->whereIn('student_id', $childrenIds ?: [0]);
        } elseif ($roleKey === 'student') {
            // sh4: the student only ever sees his own row.
            $selfIds = $this->resolver->studentIds() ?? [];
            $query->whereIn('student_id', $selfIds ?: [0]);
        }

        return response()->json([
            'data' => $query->get()->map(fn (Submission $s) => [
                'id' => $s->id,
                'student_ulid' => $s->student?->ulid,
                'student_name' => $s->student?->fullName(),
                'status' => $s->status,
                'submitted_at' => $s->submitted_at?->toIso8601String(),
                'score' => $s->score,
                'feedback' => $s->feedback,
                'text' => $s->text,
                'files' => $s->files->map(fn (File $f) => app(FileService::class)->payload($f))->values()->all(),
            ]),
            'assignment' => $this->assignmentPayload($assignment),
        ]);
    }

    private function assertSubjectAccess(ClassroomSubject $subject): void
    {
        $ids = $this->resolver->classroomIds();
        if ($ids !== null && ! in_array($subject->classroom_id, $ids, true)) {
            abort(404);
        }
    }

    /** ulids → in-school File models (input order kept); unknown ulid fails loudly. */
    private function resolveFiles(array $ulids): \Illuminate\Support\Collection
    {
        if ($ulids === []) {
            return collect();
        }

        $files = File::query()->whereIn('ulid', $ulids)->get()->keyBy('ulid');

        $resolved = collect();
        foreach ($ulids as $ulid) {
            $file = $files->get($ulid);
            if ($file === null) {
                throw ValidationException::withMessages(['file_ulids' => "فایل {$ulid} یافت نشد."]);
            }

            $resolved->push($file);
        }

        return $resolved;
    }

    private function syncFiles(Assignment $assignment, array $ulids): void
    {
        $assignment->files()->sync($this->resolveFiles($ulids)->pluck('id')->all());
    }

    private function assignmentPayload(Assignment $a): array
    {
        return [
            'ulid' => $a->ulid,
            'title' => $a->title,
            'description' => $a->description,
            'due_at' => $a->due_at->toIso8601String(),
            'max_score' => $a->max_score,
            'subject' => $a->classroomSubject?->subject?->title,
            'classroom' => $a->classroomSubject?->classroom?->title,
            // Lazy-load when the caller did not eager-load it — an embedded
            // assignment must never silently report "no attachments".
            'files' => $a->files
                ->map(fn (File $f) => app(FileService::class)->payload($f))->values()->all(),
        ];
    }
}
