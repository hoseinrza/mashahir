<?php

namespace Tests\Concerns;

use App\Modules\Academic\Models\AcademicYear;
use App\Modules\Academic\Models\Classroom;
use App\Modules\Academic\Models\ClassroomSubject;
use App\Modules\Academic\Models\Enrollment;
use App\Modules\Academic\Models\Term;
use App\Modules\Academic\Models\GradeLevel;
use App\Modules\Academic\Models\Subject;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\People\Models\Student;
use App\Modules\School\Models\School;
use App\Support\Sms\SmsManager;
use Database\Seeders\PermissionSeeder;

trait BuildsSchoolContext
{
    protected School $school;

    protected User $actor;

    protected function seedRbac(): void
    {
        $this->seed(PermissionSeeder::class);
    }

    protected function makeSchool(array $attributes = []): School
    {
        $this->school = School::query()->create([
            'name' => 'دبیرستان مشاهیر',
            'level' => 'high',
            'grading_type' => 'numeric',
            'student_has_account' => true,
            'timezone' => 'Asia/Tehran',
            'is_active' => true,
            ...$attributes,
        ]);

        // Fixtures created through models rely on the school context for the
        // BelongsToSchool creating hook; HTTP middleware re-sets it per request.
        app(\App\Support\SchoolContext::class)->set($this->school->id);

        return $this->school;
    }

    protected function makeUser(array $attributes = []): User
    {
        return User::factory()->create($attributes);
    }

    protected function actingWithRole(string $roleKey, array $attributes = [], ?User $user = null): UserRole
    {
        // Sanctum caches the resolved guard inside the test app instance;
        // clear it so every acting switch re-resolves the fresh token.
        $this->app['auth']->forgetGuards();

        $this->actor = $user ?? $this->actor ?? $this->makeUser();

        $roleId = \DB::table('roles')->whereNull('school_id')->where('key', $roleKey)->value('id');
        assert($roleId !== null, "Role [{$roleKey}] is not seeded.");

        $assignment = UserRole::query()->create([
            'user_id' => $this->actor->id,
            'role_id' => $roleId,
            'school_id' => $this->school->id,
            'scope_type' => 'school',
            'scope_id' => null,
            ...$attributes,
        ]);

        $token = $this->actor->createToken('test', ["role:{$assignment->id}"])->plainTextToken;
        $this->withToken($token);

        return $assignment;
    }

    protected function makeStudent(array $attributes = []): Student
    {
        static $counter = 0;

        return Student::query()->create([
            'student_code' => 'S'.str_pad((string) (++$counter + 1000), 5, '0', STR_PAD_LEFT),
            'first_name' => 'دانش',
            'last_name' => 'آموز'.($counter),
            ...$attributes,
        ]);
    }

    protected function makeTerm(): Term
    {
        $year = $this->makeAcademicYear();

        return Term::query()->firstOrCreate(
            ['academic_year_id' => $year->id, 'title' => 'دوره اول'],
            ['starts_on' => '2026-09-01', 'ends_on' => '2027-01-20'],
        );
    }

    protected function makeAcademicYear(array $attributes = []): AcademicYear
    {
        // One current year per school (partial unique index) — reuse it.
        $existing = AcademicYear::query()->where('school_id', $this->school->id)->first();

        if ($existing !== null && $attributes === []) {
            return $existing;
        }

        return AcademicYear::query()->create([
            'title' => 'سال تحصیلی ۱۴۰۵-۱۴۰۶',
            'starts_on' => '2026-09-01',
            'ends_on' => '2027-06-20',
            'is_current' => $existing === null,
            ...$attributes,
        ]);
    }

    protected function makeClassroom(array $attributes = []): Classroom
    {
        static $counter = 0;

        $year = $attributes['academic_year_id'] ?? null
            ?? AcademicYear::query()->where('school_id', $this->school->id)->first()?->id
            ?? $this->makeAcademicYear()->id;

        $grade = GradeLevel::query()->where('school_id', $this->school->id)->orderBy('order')->first()
            ?? GradeLevel::query()->create(['title' => 'دهم', 'order' => 10]);

        return Classroom::query()->create([
            'academic_year_id' => $year,
            'grade_level_id' => $grade->id,
            'title' => 'کلاس '.(++$counter),
            ...$attributes,
        ]);
    }

    protected function makeSubject(array $attributes = []): Subject
    {
        static $counter = 0;

        return Subject::query()->create([
            'title' => 'درس '.(++$counter),
            ...$attributes,
        ]);
    }

    protected function assignTeacher(User $teacher, Classroom $classroom, ?Subject $subject = null): ClassroomSubject
    {
        return ClassroomSubject::query()->create([
            'classroom_id' => $classroom->id,
            'subject_id' => ($subject ?? $this->makeSubject())->id,
            'teacher_id' => $teacher->id,
        ]);
    }

    protected function enroll(Student $student, Classroom $classroom): Enrollment
    {
        return Enrollment::query()->create([
            'student_id' => $student->id,
            'classroom_id' => $classroom->id,
            'starts_on' => now()->toDateString(),
            'status' => 'active',
        ]);
    }

    protected function otpLogin(User $user): string
    {
        SmsManager::fake();

        $this->postJson('/api/v1/auth/otp/request', ['phone' => $user->phone]);
        $code = collect(SmsManager::sent())->pluck('message')->first();
        preg_match('/(\d{6})/', $code, $m);

        $pendingToken = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => $user->phone,
            'code' => $m[1],
        ])->json('token');

        $this->app['auth']->forgetGuards();

        return $pendingToken;
    }
}
