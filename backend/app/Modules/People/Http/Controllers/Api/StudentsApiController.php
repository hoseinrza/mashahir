<?php

namespace App\Modules\People\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Audit\Services\AuditService;
use App\Modules\Identity\Models\UserRole;
use App\Modules\Identity\Services\AdminPasswordService;
use App\Modules\People\Http\Resources\GuardianLinkResource;
use App\Modules\People\Http\Resources\StudentResource;
use App\Modules\People\Models\GuardianLink;
use App\Modules\People\Models\Student;
use App\Modules\People\Services\GuardianAccountService;
use App\Modules\People\Services\StudentAccountService;
use App\Support\Rbac\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StudentsApiController extends Controller
{
    public function __construct(private readonly ScopeResolver $resolver)
    {
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Student::class);

        $query = $this->resolver->applyStudentScope(Student::query()->orderBy('last_name'))
            // The current classroom for the roster tables (active enrollment only)
            // and the linked login account, whose phone the roster shows.
            ->with(['enrollments' => fn ($q) => $q->where('status', 'active')->with('classroom'), 'user']);

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

        $student->load(['enrollments' => fn ($q) => $q->where('status', 'active')->with('classroom'), 'user']);

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
            // A phone mints/links the student's login account (OTP + panel).
            'phone' => ['nullable', 'string', 'max:20'],
            // Parents registered in the same step: optional, and each one
            // given here gets a login account, the guardian role, and an
            // ACTIVE link to this student. A student without a parent is a
            // perfectly valid registration.
            'guardians' => ['sometimes', 'array', 'max:4'],
            'guardians.*.first_name' => ['required', 'string', 'max:100'],
            'guardians.*.last_name' => ['nullable', 'string', 'max:100'],
            'guardians.*.phone' => ['required', 'string', 'max:20'],
            'guardians.*.link_type' => ['nullable', Rule::in(array_keys(GuardianLink::typeLabels()))],
            'guardians.*.can_pickup' => ['sometimes', 'boolean'],
        ]);

        if (Student::query()->where('student_code', $data['student_code'])->exists()) {
            throw ValidationException::withMessages(['student_code' => 'این کد دانش‌آموزی قبلاً ثبت شده است.']);
        }

        $guardians = $data['guardians'] ?? [];
        unset($data['guardians']);

        // Create + account-linking + guardians are atomic: a rejected phone
        // leaves no half-registered student (and no orphan parent account)
        // behind.
        $student = DB::transaction(function () use ($data, $guardians, $request) {
            $student = Student::query()->create($data);
            app(StudentAccountService::class)->linkPhone($student, $data['phone'] ?? null);

            $parents = app(GuardianAccountService::class);
            foreach ($guardians as $guardian) {
                $parents->attach($student, $guardian, $request->user());
            }

            return $student;
        });

        // The recently-created model keeps 201 semantics AND carries the
        // linked user for the phone field of the response.
        return new StudentResource($student->load('user'));
    }

    /**
     * Guardians of one student — the parents modal of the roster. School
     * staff only: a guardian asking about his own child reads /my/children,
     * never the other parent's row.
     */
    public function guardians(Request $request, Student $student): AnonymousResourceCollection
    {
        $this->authorize('manage', GuardianLink::class);

        if (! $request->user()->can('view', $student)) {
            abort(404);
        }

        return GuardianLinkResource::collection(
            GuardianLink::query()
                ->where('student_id', $student->id)
                ->with(['guardian', 'student'])
                ->orderByDesc('id')
                ->get(),
        );
    }

    /**
     * A parent added to an already-registered student: account + guardian role
     * + ACTIVE link in one call, so his panel opens on this student.
     */
    public function attachGuardian(Request $request, Student $student): JsonResponse
    {
        $this->authorize('manage', GuardianLink::class);

        if (! $request->user()->can('view', $student)) {
            abort(404);
        }

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'phone' => ['required', 'string', 'max:20'],
            'link_type' => ['nullable', Rule::in(array_keys(GuardianLink::typeLabels()))],
            'can_pickup' => ['sometimes', 'boolean'],
        ]);

        $link = app(GuardianAccountService::class)->attach($student, $data, $request->user());

        return (new GuardianLinkResource($link))
            ->response()
            ->setStatusCode(201);
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

    /**
     * The student's login account is an ordinary platform user — the same
     * reason-logged password flow as the staff page, reached from the roster
     * so the office never has to hunt for the account in the users table.
     */
    public function setPassword(Request $request, Student $student, AdminPasswordService $passwords): StudentResource
    {
        $user = $student->user;

        if ($user === null) {
            throw ValidationException::withMessages([
                'password' => 'این دانش‌آموز حساب ورود ندارد؛ نخست شمارهٔ موبایل او را ثبت کنید.',
            ]);
        }

        if (! $request->user()->can('setPassword', $user)) {
            abort(404);
        }

        $data = $request->validate([
            'password' => ['required', 'string', 'min:8', 'max:64'],
            'reason' => ['required', 'string', Rule::in(AdminPasswordService::reasons())],
        ]);

        $passwords->set($user, $data['password'], $data['reason']);

        return new StudentResource($student->fresh()->load('user'));
    }

    /**
     * Removing a student is a reason-logged soft delete (sh7): the roster row
     * disappears, the history stays for a restore, and only the role scoped to
     * this student ends — a family number keeps its platform account.
     */
    public function destroy(Request $request, Student $student): JsonResponse
    {
        $this->authorize('delete', $student);

        $data = $request->validate(['reason' => ['required', 'string', 'min:5']]);

        $ended = UserRole::query()
            ->where('scope_type', 'student')
            ->where('scope_id', $student->id)
            ->active()
            ->update(['ends_on' => now()->subDay()->toDateString()]);

        app(AuditService::class)->log('student.deleted', $student, old: [
            'student_code' => $student->student_code,
            'name' => $student->fullName(),
            'ended_roles' => $ended,
        ], reason: $data['reason']);

        $student->delete();

        return response()->json(['message' => 'دانش‌آموز از فهرست حذف شد؛ سوابق آموزشی او برای بازیابی باقی می‌ماند.']);
    }
}
