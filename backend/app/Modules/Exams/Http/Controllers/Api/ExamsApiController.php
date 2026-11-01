<?php

namespace App\Modules\Exams\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Academic\Models\ClassroomSubject;
use App\Modules\Exams\Models\AnswerGrade;
use App\Modules\Exams\Models\AttemptAnswer;
use App\Modules\Exams\Models\Exam;
use App\Modules\Exams\Models\ExamAttempt;
use App\Modules\Exams\Models\ExamQuestion;
use App\Modules\Exams\Services\ExamService;
use App\Modules\Files\Services\FileService;
use App\Modules\People\Models\Student;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ExamsApiController extends Controller
{
    public function __construct(
        private readonly ExamService $service,
        private readonly ScopeResolver $resolver,
    ) {
    }

    public function index(): JsonResponse
    {
        $this->authorize('exams.results_view');

        $exams = Exam::query()->with('classroomSubject.subject')->orderByDesc('id')->limit(200)->get();

        $classroomIds = $this->resolver->classroomIds();
        $myAttempts = [];
        if ($classroomIds !== null) {
            $exams = $exams->filter(fn ($e) => in_array($e->classroomSubject->classroom_id, $classroomIds, true))->values();
        } elseif (app(PermissionRegistrar::class)->activeRole()?->role->key === 'student') {
            // sh4: the student sees exams of HIS enrolled classrooms only.
            $selfIds = $this->resolver->studentIds() ?? [];
            $classroomIds = \App\Modules\Academic\Models\Enrollment::query()
                ->whereIn('student_id', $selfIds)
                ->where('status', 'active')
                ->pluck('classroom_id')
                ->all();
            $exams = $exams->filter(fn ($e) => in_array($e->classroomSubject->classroom_id, $classroomIds, true))->values();

            // The list has to say whether the student already sat an exam:
            // a second attempt is refused server-side, so offering «شروع» on a
            // submitted paper is a dead end.
            $myAttempts = ExamAttempt::query()
                ->whereIn('student_id', $selfIds ?: [0])
                ->whereIn('exam_id', $exams->pluck('id')->all() ?: [0])
                ->orderByDesc('id')
                ->get()
                ->keyBy('exam_id')
                ->map(fn (ExamAttempt $a) => $a->status)
                ->all();
        }

        return response()->json([
            'data' => $exams->map(fn (Exam $e) => [
                'ulid' => $e->ulid,
                'title' => $e->title,
                'subject' => $e->classroomSubject?->subject?->title,
                'opens_at' => $e->opens_at->toIso8601String(),
                'closes_at' => $e->closes_at->toIso8601String(),
                'duration_minutes' => $e->duration_minutes,
                'status' => $e->status,
                'result_visibility' => $e->result_visibility,
                'my_attempt_status' => $myAttempts[$e->id] ?? null,
            ]),
        ]);
    }

    /**
     * FR-15: create with questions/options in one shot.
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('exams.manage');

        $data = $request->validate([
            'classroom_subject_id' => ['required', 'integer'],
            'title' => ['required', 'string', 'max:200'],
            'opens_at' => ['required', 'date'],
            'closes_at' => ['required', 'date', 'after:opens_at'],
            'duration_minutes' => ['required', 'integer', 'min:5', 'max:300'],
            'shuffle_questions' => ['boolean'],
            'result_visibility' => ['required', 'in:immediately,after_grading,manual'],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.type' => ['required', 'in:mcq,descriptive'],
            'questions.*.body' => ['required', 'string'],
            'questions.*.points' => ['nullable', 'integer', 'min:1', 'max:100'],
            'questions.*.options' => ['nullable', 'array', 'min:2'],
            'questions.*.options.*' => ['required', 'string', 'max:500'],
            'questions.*.correct_position' => ['nullable', 'integer', 'min:1'],
        ]);

        $subject = ClassroomSubject::query()->findOrFail($data['classroom_subject_id']);
        $ids = $this->resolver->classroomIds();
        if ($ids !== null && ! in_array($subject->classroom_id, $ids, true)) {
            abort(404);
        }

        $exam = \Illuminate\Support\Facades\DB::transaction(function () use ($data, $subject, $request) {
            $exam = Exam::query()->create([
                'classroom_subject_id' => $subject->id,
                'title' => $data['title'],
                'opens_at' => $data['opens_at'],
                'closes_at' => $data['closes_at'],
                'duration_minutes' => $data['duration_minutes'],
                'shuffle_questions' => $data['shuffle_questions'] ?? false,
                'result_visibility' => $data['result_visibility'],
                'status' => Exam::STATUS_DRAFT,
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['questions'] as $i => $q) {
                $question = $exam->questions()->create([
                    'type' => $q['type'],
                    'position' => $i + 1,
                    'body' => $q['body'],
                    'points' => $q['points'] ?? 1,
                ]);

                if ($q['type'] === ExamQuestion::TYPE_MCQ) {
                    foreach ($q['options'] as $optPos => $body) {
                        $question->options()->create(['position' => $optPos + 1, 'body' => $body]);
                    }

                    $correct = $question->options()->where('position', $q['correct_position'] ?? 1)->first();
                    $question->forceFill(['correct_option_id' => $correct?->id])->save();
                }
            }

            return $exam;
        });

        return response()->json(['ulid' => $exam->ulid, 'status' => $exam->status], 201);
    }

    /**
     * FR-15: a DRAFT exam is fully editable; published exams are frozen.
     */
    public function update(Request $request, Exam $exam): JsonResponse
    {
        $this->authorize('exams.manage');

        if ($exam->status !== Exam::STATUS_DRAFT) {
            throw ValidationException::withMessages(['status' => 'آزمون منتشرشده قابل ویرایش نیست.']);
        }

        $ids = $this->resolver->classroomIds();
        if ($ids !== null && ! in_array($exam->classroomSubject->classroom_id, $ids, true)) {
            abort(404);
        }

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'opens_at' => ['sometimes', 'date'],
            'closes_at' => ['sometimes', 'date', 'after:opens_at'],
            'duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:300'],
            'shuffle_questions' => ['boolean'],
            'result_visibility' => ['sometimes', 'in:immediately,after_grading,manual'],
        ]);

        $exam->update($data);

        return response()->json(['ulid' => $exam->ulid, 'status' => $exam->fresh()->status]);
    }

    /**
     * Replace ALL questions of a draft exam (bulk edit of the paper).
     */
    public function replaceQuestions(Request $request, Exam $exam): JsonResponse
    {
        $this->authorize('exams.manage');

        if ($exam->status !== Exam::STATUS_DRAFT) {
            throw ValidationException::withMessages(['status' => 'سؤال‌های آزمون منتشرشده قابل تغییر نیستند.']);
        }

        $ids = $this->resolver->classroomIds();
        if ($ids !== null && ! in_array($exam->classroomSubject->classroom_id, $ids, true)) {
            abort(404);
        }

        $data = $request->validate([
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.type' => ['required', 'in:mcq,descriptive'],
            'questions.*.body' => ['required', 'string'],
            'questions.*.points' => ['nullable', 'integer', 'min:1', 'max:100'],
            'questions.*.options' => ['nullable', 'array', 'min:2'],
            'questions.*.options.*' => ['required', 'string', 'max:500'],
            'questions.*.correct_position' => ['nullable', 'integer', 'min:1'],
        ]);

        \Illuminate\Support\Facades\DB::transaction(function () use ($exam, $data) {
            $exam->questions()->delete();

            foreach ($data['questions'] as $i => $q) {
                $question = $exam->questions()->create([
                    'type' => $q['type'],
                    'position' => $i + 1,
                    'body' => $q['body'],
                    'points' => $q['points'] ?? 1,
                ]);

                if ($q['type'] === ExamQuestion::TYPE_MCQ) {
                    foreach ($q['options'] as $optPos => $body) {
                        $question->options()->create(['position' => $optPos + 1, 'body' => $body]);
                    }

                    $correct = $question->options()->where('position', $q['correct_position'] ?? 1)->first();
                    $question->forceFill(['correct_option_id' => $correct?->id])->save();
                }
            }
        });

        return response()->json(['ulid' => $exam->ulid, 'questions' => $exam->questions()->count()]);
    }

    public function publish(Request $request, Exam $exam): JsonResponse
    {
        $this->authorize('exams.publish');

        if ($exam->status !== Exam::STATUS_DRAFT) {
            throw ValidationException::withMessages(['status' => 'فقط آزمون پیش‌نویس منتشر می‌شود.']);
        }

        $exam->forceFill(['status' => Exam::STATUS_PUBLISHED])->save();

        return response()->json(['ulid' => $exam->ulid, 'status' => $exam->status]);
    }

    public function show(Request $request, Exam $exam): JsonResponse
    {
        $this->authorize('exams.results_view');

        $roleKey = app(PermissionRegistrar::class)->activeRole()?->role->key;
        $isStudent = $roleKey === 'student';

        return response()->json([
            'ulid' => $exam->ulid,
            'title' => $exam->title,
            'classroom_subject_id' => $exam->classroom_subject_id,
            'subject' => $exam->classroomSubject?->subject?->title,
            'opens_at' => $exam->opens_at->toIso8601String(),
            'closes_at' => $exam->closes_at->toIso8601String(),
            'duration_minutes' => $exam->duration_minutes,
            'shuffle_questions' => $exam->shuffle_questions,
            'status' => $exam->status,
            // Students never see correct answers.
            'questions' => $exam->questions->map(function (ExamQuestion $q) use ($isStudent) {
                $payload = [
                    'id' => $q->id,
                    'type' => $q->type,
                    'position' => $q->position,
                    'body' => $q->body,
                    'points' => $q->points,
                ];

                if (! $isStudent) {
                    $payload['correct_option_id'] = $q->correct_option_id;
                }

                $payload['options'] = $q->options->map(fn ($o) => [
                    'id' => $o->id, 'position' => $o->position, 'body' => $o->body,
                ]);

                return $payload;
            }),
        ]);
    }

    /**
     * FR-21: one active attempt; re-entry resumes it.
     */
    public function start(Request $request, Exam $exam): JsonResponse
    {
        $this->authorize('exams.take');

        $student = Student::query()->where('user_id', $request->user()->id)->firstOrFail(); // sh4

        $attempt = $this->service->startOrResume($exam, $student->id);

        return response()->json([
            'attempt_id' => $attempt->id,
            'status' => $attempt->status,
            'started_at' => $attempt->started_at->toIso8601String(),
            'server_deadline' => $attempt->server_deadline->toIso8601String(),
        ]);
    }

    /**
     * FR-17: autosave with honest server-confirmed state. Descriptive
     * answers may carry an image/PDF of the handwritten paper.
     */
    public function saveAnswer(Request $request, ExamAttempt $attempt): JsonResponse
    {
        $this->authorize('exams.take');

        $data = $request->validate([
            'question_id' => ['required', 'integer'],
            'option_id' => ['nullable', 'integer'],
            'text' => ['nullable', 'string', 'max:10000'],
            'file_ulid' => ['nullable', 'string', 'max:26'],
            'remove_file' => ['boolean'],
            'version' => ['required', 'integer', 'min:1'],
            'flagged' => ['boolean'],
        ]);

        if ((int) $attempt->student_id !== (int) Student::query()->where('user_id', $request->user()->id)->value('id')) {
            abort(404);
        }

        // null = keep the attached sheet, 0 = clear it, >0 = replace it.
        $fileId = null;
        if ($data['remove_file'] ?? false) {
            $fileId = 0;
        } elseif (($data['file_ulid'] ?? null) !== null) {
            $questionType = ExamQuestion::query()->whereKey($data['question_id'])->value('type');
            if ($questionType !== ExamQuestion::TYPE_DESCRIPTIVE) {
                throw ValidationException::withMessages(['file_ulid' => 'فقط سؤال تشریحی پیوست فایل می‌پذیرد.']);
            }

            $file = \App\Modules\Files\Models\File::query()->where('ulid', $data['file_ulid'])->first();
            if ($file === null) {
                throw ValidationException::withMessages(['file_ulid' => 'فایل یافت نشد.']);
            }

            $fileId = $file->id;
        }

        $result = $this->service->saveAnswer(
            $attempt,
            $data['question_id'],
            $data['option_id'] ?? null,
            $data['text'] ?? null,
            $data['version'],
            $data['flagged'] ?? false,
            $fileId,
        );

        return response()->json($result + ['message' => $result['accepted'] ? 'ذخیره شد' : 'نسخه قدیمی؛ همگام‌سازی شد']);
    }

    public function submit(Request $request, ExamAttempt $attempt): JsonResponse
    {
        $this->authorize('exams.take');

        if ((int) $attempt->student_id !== (int) Student::query()->where('user_id', $request->user()->id)->value('id')) {
            abort(404);
        }

        $attempt = $this->service->submit($attempt);

        return response()->json(['status' => $attempt->status, 'auto_score' => $attempt->auto_score]);
    }

    /**
     * sh6: student sees results only per the exam's result_visibility.
     */
    public function result(Request $request, Exam $exam): JsonResponse
    {
        $this->authorize('exams.results_view');

        $roleKey = app(PermissionRegistrar::class)->activeRole()?->role->key;
        $visible = $this->service->resultsVisibleFor($exam);

        if ($roleKey === 'student') {
            $student = Student::query()->where('user_id', $request->user()->id)->firstOrFail();
            $attempt = $exam->attempts()->where('student_id', $student->id)->first();

            if (! $visible) {
                return response()->json(['visible' => false, 'message' => 'نمره هنوز منتشر نشده است.']);
            }

            return response()->json([
                'visible' => true,
                'auto_score' => $attempt?->auto_score,
                'answers' => $attempt?->answers->map(function (AttemptAnswer $a) {
                    return [
                        'question_id' => $a->question_id,
                        'option_id' => $a->option_id,
                        'correct' => $a->question->type === 'mcq'
                            ? (int) $a->option_id === (int) $a->question->correct_option_id
                            : null,
                        'descriptive_score' => $a->grade?->score,
                        'comment' => $a->grade?->comment,
                        'file' => $a->file ? app(FileService::class)->payload($a->file) : null,
                    ];
                }),
            ]);
        }

        // Staff view: all attempts with their answers (descriptive grading).
        $attempts = $exam->attempts()->with(['student', 'answers.question', 'answers.grade', 'answers.file'])->get()->map(fn (ExamAttempt $a) => [
            'attempt_id' => $a->id,
            'student_ulid' => $a->student?->ulid,
            'student_name' => $a->student?->fullName(),
            'status' => $a->status,
            'auto_score' => $a->auto_score,
            'submitted_at' => $a->submitted_at?->toIso8601String(),
            'answers' => $a->answers->map(fn (AttemptAnswer $ans) => [
                'answer_id' => $ans->id,
                'question_id' => $ans->question_id,
                'type' => $ans->question?->type,
                'body' => $ans->question?->body,
                'points' => $ans->question?->points,
                'option_id' => $ans->option_id,
                'text' => $ans->text,
                'file' => $ans->file ? app(FileService::class)->payload($ans->file) : null,
                'score' => $ans->grade?->score,
                'comment' => $ans->grade?->comment,
            ]),
        ]);

        return response()->json(['visible' => $visible, 'data' => $attempts]);
    }

    /**
     * FR-20 + sh5: teacher (sh2) or assigned corrector grades a descriptive answer.
     */
    public function gradeAnswer(Request $request, AttemptAnswer $answer): JsonResponse
    {
        $registrar = app(PermissionRegistrar::class);

        $user = $request->user();
        $roleKey = $registrar->activeRole()?->role->key;

        $allowed = false;

        if ($roleKey === 'teacher') {
            $this->authorize('exams.grade_descriptive');
            $ids = $this->resolver->classroomIds();
            $allowed = $ids !== null && in_array($answer->attempt->exam->classroomSubject->classroom_id, $ids, true);
        } elseif ($roleKey === 'corrector') {
            $this->authorize('exams.grade_descriptive');
            // sh5: only exams explicitly assigned to this corrector.
            $allowed = \Illuminate\Support\Facades\DB::table('exam_correctors')
                ->where('exam_id', $answer->attempt->exam_id)
                ->where('user_id', $user->id)
                ->exists();
        }

        if (! $allowed) {
            abort(404);
        }

        $data = $request->validate([
            'score' => ['required', 'integer', 'min:0'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $grade = $this->service->gradeDescriptive($answer, $data['score'], $data['comment'] ?? null, $user->id);

        return response()->json(['id' => $grade->id, 'score' => $grade->score]);
    }

    /**
     * sh5 admin: assign a corrector to an exam.
     */
    public function assignCorrector(Request $request, Exam $exam): JsonResponse
    {
        $this->authorize('exams.manage');

        $data = $request->validate(['user_ulid' => ['required', 'string']]);

        $userId = \App\Modules\Identity\Models\User::query()->where('ulid', $data['user_ulid'])->value('id');
        if ($userId === null) {
            throw ValidationException::withMessages(['user_ulid' => 'کاربر یافت نشد.']);
        }

        \Illuminate\Support\Facades\DB::table('exam_correctors')->updateOrInsert(
            ['exam_id' => $exam->id, 'user_id' => $userId],
            ['created_at' => now(), 'updated_at' => now()],
        );

        return response()->json(['exam_ulid' => $exam->ulid, 'user_ulid' => $data['user_ulid']], 201);
    }
}
