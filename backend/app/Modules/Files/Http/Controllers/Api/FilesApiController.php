<?php

namespace App\Modules\Files\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Academic\Models\Enrollment;
use App\Modules\Assignments\Models\Assignment;
use App\Modules\Assignments\Models\Submission;
use App\Modules\Exams\Models\AttemptAnswer;
use App\Modules\Files\Models\File;
use App\Modules\Files\Services\FileService;
use App\Modules\Identity\Models\User;
use App\Modules\People\Models\GuardianLink;
use App\Support\Rbac\PermissionRegistrar;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FilesApiController extends Controller
{
    public function __construct(
        private readonly FileService $files,
        private readonly ScopeResolver $resolver,
        private readonly PermissionRegistrar $registrar,
    ) {
    }

    /**
     * Generic upload; what may be attached WHERE is decided by the domain
     * endpoints (submission, exam answer, assignment sheet, court order).
     */
    public function store(Request $request): JsonResponse
    {
        // Default-deny: the caller must hold at least one permission that
        // leads to a file attachment in this system.
        $allowed = collect(['submissions.submit', 'exams.take', 'assignments.manage', 'court_orders.manage'])
            ->contains(fn (string $permission) => $this->registrar->allows($permission));

        if (! $allowed) {
            abort(404);
        }

        $request->validate([
            'file' => ['required', 'file', 'max:'.FileService::MAX_SIZE_KB],
        ]);

        $schoolId = app(\App\Support\SchoolContext::class)->schoolId();
        if ($schoolId === null) {
            abort(404);
        }

        $file = $this->files->store(
            $request->file('file'),
            $request->user(),
            $schoolId,
        );

        return response()->json($this->files->payload($file), 201);
    }

    /**
     * Access-checked stream (inline) — the only way bytes leave the server.
     */
    public function show(Request $request, File $file): StreamedResponse
    {
        $this->assertCanAccess($file, $request->user());

        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk($file->disk);

        return $disk->response($file->path, $file->original_name, [
            'Content-Disposition' => 'inline; filename="'.$file->original_name.'"',
        ]);
    }

    private function assertCanAccess(File $file, User $user): void
    {
        if ((int) $file->uploaded_by === (int) $user->id) {
            return;
        }

        $roleKey = $this->registrar->activeRole()?->role->key;

        if ($this->referencedByCourtOrder($file)) {
            // sh16: the discipline deputy only ever sees the summary.
            if ($this->registrar->conditionFor('court_orders.view') === 'sh16') {
                abort(404);
            }

            if ($roleKey === 'guardian') {
                $this->assertGuardianOfOrderStudent($file, $user);

                return;
            }

            if ($this->registrar->allows('court_orders.view')) {
                return;
            }

            abort(404);
        }

        if ($submission = $this->referencingSubmission($file)) {
            $classroom = $submission->assignment->classroomSubject->classroom_id;

            if ($roleKey === 'teacher') {
                $this->assertTeacherOfClass($classroom);

                return;
            }

            if ($roleKey === 'guardian') {
                $this->assertGuardianOfStudent($submission->student_id, $user);

                return;
            }

            if ($roleKey === 'student') {
                $this->assertOwnStudent($submission->student_id);

                return;
            }

            if ($this->registrar->allows('submissions.view')) {
                return;
            }

            abort(404);
        }

        if ($answer = $this->referencingAnswer($file)) {
            $attempt = $answer->attempt;
            $exam = $attempt->exam;
            $classroom = $exam->classroomSubject->classroom_id;

            if ($roleKey === 'teacher') {
                $this->assertTeacherOfClass($classroom);

                return;
            }

            if ($roleKey === 'corrector') {
                $assigned = \Illuminate\Support\Facades\DB::table('exam_correctors')
                    ->where('exam_id', $exam->id)
                    ->where('user_id', $user->id)
                    ->exists();
                if (! $assigned) {
                    abort(404);
                }

                return;
            }

            if ($roleKey === 'student') {
                $this->assertOwnStudent((int) $attempt->student_id);

                return;
            }

            if ($this->registrar->allows('exams.results_view')) {
                return;
            }

            abort(404);
        }

        if ($assignment = $this->referencingAssignment($file)) {
            $classroom = $assignment->classroomSubject->classroom_id;

            if ($roleKey === 'teacher') {
                $this->assertTeacherOfClass($classroom);

                return;
            }

            if ($roleKey === 'student') {
                $this->assertEnrolled((int) $assignment->school_id, $classroom, $this->resolver->studentIds() ?? []);

                return;
            }

            if ($roleKey === 'guardian') {
                $this->assertEnrolled((int) $assignment->school_id, $classroom, $this->resolver->studentIds() ?? []);

                return;
            }

            if ($this->registrar->allows('assignments.view')) {
                return;
            }

            abort(404);
        }

        // Attached to nothing (yet) — only the uploader and school admins see it.
        if ($this->registrar->allows('school.settings.manage') || $this->registrar->allows('assignments.view')) {
            return;
        }

        abort(404);
    }

    // ── Reference lookups ────────────────────────────────────────────────

    private function referencingSubmission(File $file): ?Submission
    {
        return Submission::query()
            ->whereHas('files', fn ($q) => $q->where('files.id', $file->id))
            ->with(['assignment.classroomSubject', 'student'])
            ->first();
    }

    private function referencingAnswer(File $file): ?AttemptAnswer
    {
        return AttemptAnswer::query()
            ->where('file_id', $file->id)
            ->with(['attempt.exam.classroomSubject'])
            ->first();
    }

    private function referencingAssignment(File $file): ?Assignment
    {
        return Assignment::query()
            ->whereHas('files', fn ($q) => $q->where('files.id', $file->id))
            ->with('classroomSubject')
            ->first();
    }

    private function referencedByCourtOrder(File $file): bool
    {
        return \App\Modules\People\Models\CourtOrder::query()->where('file_id', $file->id)->exists();
    }

    private function assertGuardianOfOrderStudent(File $file, User $user): void
    {
        $studentId = \App\Modules\People\Models\CourtOrder::query()->where('file_id', $file->id)->value('student_id');

        GuardianLink::query()
            ->where('guardian_user_id', $user->id)
            ->where('student_id', $studentId)
            ->where('status', 'active')
            ->exists() || abort(404);
    }

    private function assertGuardianOfStudent(int $studentId, User $user): void
    {
        GuardianLink::query()
            ->where('guardian_user_id', $user->id)
            ->where('student_id', $studentId)
            ->where('status', 'active')
            ->exists() || abort(404);
    }

    private function assertOwnStudent(int $studentId): void
    {
        if (! in_array($studentId, $this->resolver->studentIds() ?? [], true)) {
            abort(404);
        }
    }

    private function assertTeacherOfClass(int $classroomId): void
    {
        $ids = $this->resolver->classroomIds();
        if ($ids === null || ! in_array($classroomId, $ids, true)) {
            abort(404);
        }
    }

    private function assertEnrolled(int $schoolId, int $classroomId, array $studentIds): void
    {
        if ($studentIds === []) {
            abort(404);
        }

        Enrollment::query()
            ->where('school_id', $schoolId)
            ->where('classroom_id', $classroomId)
            ->whereIn('student_id', $studentIds)
            ->where('status', 'active')
            ->exists() || abort(404);
    }
}
