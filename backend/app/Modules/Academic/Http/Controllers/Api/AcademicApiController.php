<?php

namespace App\Modules\Academic\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Academic\Http\Resources\ClassroomResource;
use App\Modules\Academic\Models\AcademicYear;
use App\Modules\Academic\Models\Classroom;
use App\Modules\Academic\Models\ClassroomSubject;
use App\Modules\Academic\Models\Enrollment;
use App\Modules\Academic\Models\GradeLevel;
use App\Modules\Academic\Models\Subject;
use App\Modules\People\Models\Student;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AcademicApiController extends Controller
{
    public function __construct(private readonly ScopeResolver $resolver)
    {
    }

    public function gradeLevels(): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Classroom::class);

        return \App\Modules\Academic\Http\Resources\GradeLevelResource::collection(
            GradeLevel::query()->orderBy('order')->get(),
        );
    }

    public function storeGradeLevel(Request $request): GradeLevel
    {
        $this->authorize('create', Classroom::class);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'order' => ['required', 'integer', 'min:1'],
        ]);

        if (GradeLevel::query()->where('order', $data['order'])->exists()) {
            throw ValidationException::withMessages(['order' => 'این ترتیب قبلاً ثبت شده است.']);
        }

        return GradeLevel::query()->create($data);
    }

    public function storeSubject(Request $request): Subject
    {
        $this->authorize('create', Classroom::class);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:50'],
        ]);

        if (($data['code'] ?? null) !== null && Subject::query()->where('code', $data['code'])->exists()) {
            throw ValidationException::withMessages(['code' => 'این کد درس قبلاً ثبت شده است.']);
        }

        return Subject::query()->create($data);
    }

    public function indexClassrooms(): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Classroom::class);

        $query = $this->resolver->applyClassroomScope(
            Classroom::query()->with(['gradeLevel', 'academicYear'])->orderBy('title'),
        );

        return ClassroomResource::collection($query->get());
    }

    /** سال‌های تحصیلی مدرسه — فرم ساخت کلاس و کارت مدیریت سال. */
    public function indexYears(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Classroom::class);

        return response()->json([
            'data' => AcademicYear::query()
                ->where('school_id', $request->attributes->get('school_id'))
                ->orderByDesc('id')
                ->get()
                ->map(fn (AcademicYear $y) => [
                    'id' => $y->id,
                    'title' => $y->title,
                    'starts_on' => $y->starts_on?->toDateString(),
                    'ends_on' => $y->ends_on?->toDateString(),
                    'is_current' => $y->is_current,
                ]),
        ]);
    }

    /**
     * مدیر/معاون آموزشی سال تحصیلی می‌سازد. is_current obeys the partial
     * unique index (one current year per school): promoting one year demotes
     * the rest; the school's very first year auto-becomes current.
     */
    public function storeYear(Request $request): JsonResponse
    {
        $this->authorize('create', Classroom::class);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:100'],
            // The academic_years columns are NOT NULL — a school year always
            // has a span.
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after:starts_on'],
            'is_current' => ['nullable', 'boolean'],
        ]);

        $makeCurrent = (bool) ($data['is_current'] ?? false)
            || ! AcademicYear::query()->where('is_current', true)->exists();

        $year = \Illuminate\Support\Facades\DB::transaction(function () use ($data, $makeCurrent): AcademicYear {
            if ($makeCurrent) {
                AcademicYear::query()->where('is_current', true)->update(['is_current' => false]);
            }

            return AcademicYear::query()->create($data + ['is_current' => $makeCurrent]);
        });

        return response()->json($this->yearPayload($year), 201);
    }

    public function updateYear(Request $request, AcademicYear $year): JsonResponse
    {
        $this->authorize('create', Classroom::class);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:100'],
            'starts_on' => ['sometimes', 'nullable', 'date'],
            'ends_on' => ['sometimes', 'nullable', 'date', 'after:starts_on'],
            'is_current' => ['sometimes', 'boolean'],
        ]);

        $makeCurrent = (bool) ($data['is_current'] ?? false);

        \Illuminate\Support\Facades\DB::transaction(function () use ($year, $data, $makeCurrent): void {
            if ($makeCurrent && ! $year->is_current) {
                AcademicYear::query()->where('is_current', true)->whereKeyNot($year->id)
                    ->update(['is_current' => false]);
            }

            $year->update($data);
        });

        return response()->json($this->yearPayload($year->fresh()));
    }

    private function yearPayload(?AcademicYear $year): array
    {
        return $year === null ? [] : [
            'id' => $year->id,
            'title' => $year->title,
            'starts_on' => $year->starts_on?->toDateString(),
            'ends_on' => $year->ends_on?->toDateString(),
            'is_current' => $year->is_current,
        ];
    }

    /** درس‌های مدرسه — فرم تخصیص دبیر. */
    public function indexSubjects(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Classroom::class);

        return response()->json([
            'data' => Subject::query()
                ->orderBy('title')
                ->get()
                ->map(fn (Subject $s) => ['id' => $s->id, 'title' => $s->title]),
        ]);
    }

    /** دبیران مدرسه (نقش معلم یا دبیر یک کلاس‌درس) — فرم تخصیص درس. */
    public function indexTeachers(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Classroom::class);

        $viaRole = \App\Modules\Identity\Models\UserRole::query()
            ->where('school_id', $request->attributes->get('school_id'))
            ->whereHas('role', fn ($q) => $q->where('key', 'teacher'))
            ->pluck('user_id');

        $viaSubject = ClassroomSubject::query()
            ->where('school_id', $request->attributes->get('school_id'))
            ->pluck('teacher_id');

        $ids = $viaRole->merge($viaSubject)->filter()->unique()->values();

        return response()->json([
            'data' => \App\Modules\Identity\Models\User::query()
                ->whereIn('id', $ids)
                ->orderBy('last_name')
                ->get()
                ->map(fn (\App\Modules\Identity\Models\User $u) => ['ulid' => $u->ulid, 'name' => $u->fullName()]),
        ]);
    }

    /** ثبت‌نام‌های فعال یک کلاس — فهرست دانش‌آموزان کلاس برای مدیر. */
    public function classroomEnrollments(Request $request, Classroom $classroom): JsonResponse
    {
        $this->authorize('viewAny', Classroom::class);

        // A roster with student codes is management data: enrollment/academic
        // managers read any classroom, a teacher only his own (sh2), and a
        // learner or guardian — who hold academic.view for the timetable —
        // never reads rosters through this endpoint.
        $registrar = app(\App\Support\Rbac\PermissionRegistrar::class);
        $isStaff = $registrar->allows('enrollments.manage') || $registrar->allows('academic.manage');
        $teacherIds = $this->resolver->classroomIds(); // null for every role but teacher (sh2)

        if (! $isStaff && $teacherIds === null) {
            abort(403);
        }

        $scoped = Classroom::query()
            ->whereKey($classroom->getKey())
            ->when($teacherIds !== null, fn ($q) => $q->whereIn('id', $teacherIds ?: [0]))
            ->first();

        abort_unless($scoped !== null, 404);

        $rows = Enrollment::query()
            ->where('classroom_id', $scoped->id)
            ->where('status', Enrollment::STATUS_ACTIVE)
            ->with('student')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (Enrollment $e) => [
                'enrollment_id' => $e->id,
                'student_ulid' => $e->student?->ulid,
                'student_name' => $e->student?->fullName(),
                'student_code' => $e->student?->student_code,
                'starts_on' => $e->starts_on,
            ]),
        ]);
    }

    public function storeClassroom(Request $request): ClassroomResource
    {
        $this->authorize('create', Classroom::class);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'academic_year_id' => ['required', 'integer'],
            'grade_level_id' => ['required', 'integer'],
        ]);

        if (Classroom::query()->where('academic_year_id', $data['academic_year_id'])->where('title', $data['title'])->exists()) {
            throw ValidationException::withMessages(['title' => 'کلاسی با این عنوان در این سال تحصیلی هست.']);
        }

        return new ClassroomResource(Classroom::query()->create($data));
    }

    /**
     * Assign a teacher to a subject in a classroom (sh2 source of truth).
     */
    public function assignSubject(Request $request, Classroom $classroom): JsonResponse
    {
        $this->authorize('assignSubject', $classroom);

        $data = $request->validate([
            'subject_id' => ['required', 'integer'],
            'teacher_ulid' => ['nullable', 'string'],
        ]);

        $subjectId = $data['subject_id'];
        if (! Subject::query()->whereKey($subjectId)->exists()) {
            throw ValidationException::withMessages(['subject_id' => 'درس یافت نشد.']);
        }

        $teacherId = null;
        if ($data['teacher_ulid'] !== null) {
            $teacherId = \App\Modules\Identity\Models\User::query()->where('ulid', $data['teacher_ulid'])->value('id');
            if ($teacherId === null) {
                throw ValidationException::withMessages(['teacher_ulid' => 'معلم یافت نشد.']);
            }
        }

        $assignment = $classroom->classroomSubjects()->updateOrCreate(
            ['subject_id' => $subjectId],
            ['teacher_id' => $teacherId],
        );

        return response()->json([
            'id' => $assignment->id,
            'classroom_ulid' => $classroom->ulid,
            'subject_id' => $subjectId,
            'teacher_ulid' => $data['teacher_ulid'],
        ], 201);
    }

    public function storeEnrollment(Request $request): Enrollment
    {
        $this->authorize('create', Enrollment::class);

        $data = $request->validate([
            'student_ulid' => ['required', 'string'],
            'classroom_ulid' => ['required', 'string'],
            'starts_on' => ['required', 'date'],
        ]);

        $student = Student::query()->where('ulid', $data['student_ulid'])->firstOrFail();
        $classroom = Classroom::query()->where('ulid', $data['classroom_ulid'])->firstOrFail();

        $already = Enrollment::query()
            ->where('student_id', $student->id)
            ->where('classroom_id', $classroom->id)
            ->where('status', Enrollment::STATUS_ACTIVE)
            ->exists();

        if ($already) {
            throw ValidationException::withMessages(['student_ulid' => 'دانش‌آموز در این کلاس ثبت‌نام است.']);
        }

        return Enrollment::query()->create([
            'student_id' => $student->id,
            'classroom_id' => $classroom->id,
            'starts_on' => $data['starts_on'],
            'status' => Enrollment::STATUS_ACTIVE,
        ]);
    }

    public function endEnrollment(Request $request, Enrollment $enrollment): Enrollment
    {
        $this->authorize('end', $enrollment);

        $data = $request->validate([
            'ends_on' => ['required', 'date'],
            'status' => ['required', Rule::in(['transferred', 'ended'])],
        ]);

        $enrollment->update([
            'ends_on' => $data['ends_on'],
            'status' => $data['status'],
        ]);

        return $enrollment->fresh();
    }


    /**
     * The teachable (or school-wide for admins) classroom_subject list —
     * the exam/assignment designers need it to target a subject-class pair.
     */
    public function mySubjects(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Classroom::class);

        $query = ClassroomSubject::query()
            ->with(['subject', 'classroom', 'teacher'])
            ->where('school_id', $request->attributes->get('school_id'))
            ->orderBy('id');

        $ids = $this->resolver->classroomIds();
        if ($ids !== null) {
            $query->whereIn('classroom_id', $ids ?: [0]);
        }

        return response()->json([
            'data' => $query->get()->map(fn (ClassroomSubject $cs) => [
                'id' => $cs->id,
                'subject' => $cs->subject?->title,
                'classroom' => $cs->classroom?->title,
                'teacher' => $cs->teacher?->fullName(),
            ]),
        ]);
    }

    /** ترم‌های تحصیلی مدرسه برای انتخاب در فرم‌های نمره/کارنامه. */
    public function terms(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Classroom::class);

        $terms = \App\Modules\Academic\Models\Term::query()
            ->whereHas('academicYear', fn ($q) => $q->where('school_id', $request->attributes->get('school_id')))
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $terms->map(fn ($t) => ['id' => $t->id, 'title' => $t->title]),
        ]);
    }

    public function updateClassroom(Request $request, Classroom $classroom): ClassroomResource
    {
        $this->authorize('create', Classroom::class);

        $data = $request->validate(['title' => ['sometimes', 'string', 'max:100']]);
        $classroom->update($data);

        return new ClassroomResource($classroom->fresh());
    }

    public function updateSubject(Request $request, Subject $subject): Subject
    {
        $this->authorize('create', Classroom::class);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:100'],
            'code' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);

        if (isset($data['code']) && $data['code'] !== null
            && Subject::query()->where('code', $data['code'])->whereKeyNot($subject->id)->exists()) {
            throw ValidationException::withMessages(['code' => 'این کد درس قبلاً ثبت شده است.']);
        }

        $subject->update($data);

        return $subject->fresh();
    }

    public function updateGradeLevel(Request $request, GradeLevel $gradeLevel): GradeLevel
    {
        $this->authorize('create', Classroom::class);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:100'],
            'order' => ['sometimes', 'integer', 'min:1'],
        ]);

        if (isset($data['order']) && GradeLevel::query()->where('order', $data['order'])->whereKeyNot($gradeLevel->id)->exists()) {
            throw ValidationException::withMessages(['order' => 'این ترتیب قبلاً ثبت شده است.']);
        }

        $gradeLevel->update($data);

        return $gradeLevel->fresh();
    }
}
