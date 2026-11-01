<?php

namespace App\Modules\Academic\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Academic\Http\Resources\ClassroomResource;
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
