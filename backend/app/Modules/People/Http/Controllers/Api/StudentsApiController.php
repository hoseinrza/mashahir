<?php

namespace App\Modules\People\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\People\Http\Resources\StudentResource;
use App\Modules\People\Models\Student;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

class StudentsApiController extends Controller
{
    public function __construct(private readonly ScopeResolver $resolver)
    {
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Student::class);

        $query = $this->resolver->applyStudentScope(Student::query()->orderBy('last_name'));

        return StudentResource::collection(
            $query->paginate(min($request->integer('per_page', 50), 100)),
        );
    }

    public function show(Request $request, Student $student): StudentResource
    {
        // Out of scope or foreign school = does not exist for the caller (404).
        if (! $request->user()->can('view', $student)) {
            abort(404);
        }

        return new StudentResource($student);
    }

    public function store(Request $request): StudentResource
    {
        $this->authorize('create', Student::class);

        $data = $request->validate([
            'student_code' => ['required', 'string', 'max:50'],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'birth_date' => ['nullable', 'date'],
            'national_code' => ['nullable', 'digits:10'],
        ]);

        if (Student::query()->where('student_code', $data['student_code'])->exists()) {
            throw ValidationException::withMessages(['student_code' => 'این کد دانش‌آموزی قبلاً ثبت شده است.']);
        }

        $student = Student::query()->create($data);

        return new StudentResource($student);
    }

    public function update(Request $request, Student $student): StudentResource
    {
        $this->authorize('update', $student);

        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name' => ['sometimes', 'string', 'max:100'],
            'birth_date' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'in:active,left,graduated'],
            'left_on' => ['sometimes', 'nullable', 'date'],
        ]);

        $student->update($data);

        return new StudentResource($student->fresh());
    }

    /**
     * sh7: decrypting the national code requires a reason and writes an audit
     * entry — viewing a sensitive file is always logged.
     */
    public function nationalCode(Request $request, Student $student)
    {
        if (! $request->user()->can('viewNationalCode', $student)) {
            abort(404);
        }

        $data = $request->validate(['reason' => ['required', 'string', 'min:5']]);

        app(AuditService::class)->log(
            'student.national_code_viewed',
            $student,
            reason: $data['reason'],
        );

        return response()->json(['national_code' => $student->national_code]);
    }
}
