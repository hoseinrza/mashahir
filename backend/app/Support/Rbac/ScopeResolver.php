<?php

namespace App\Support\Rbac;

use App\Modules\Academic\Models\Classroom;
use App\Modules\Academic\Models\ClassroomSubject;
use App\Modules\Academic\Models\Enrollment;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\People\Models\GuardianLink;
use App\Modules\People\Models\Student;
use Illuminate\Support\Collection;

/**
 * Translates the ACTIVE role assignment into concrete id sets:
 *  - sh2 (teacher): classrooms of his assignments + classroom_subjects
 *  - sh3 (guardian): children via ACTIVE links (per-link flags gate the data)
 *  - sh4 (student): own record only
 *
 * Methods return NULL when the active role is school-wide (no extra filter)
 * and an id list (possibly empty) when scoped.
 */
final class ScopeResolver
{
    public function __construct(private readonly PermissionRegistrar $registrar)
    {
    }

    /**
     * @return list<int>|null classroom ids, or null when unrestricted
     */
    public function classroomIds(): ?array
    {
        $role = $this->registrar->activeRole();

        if ($role === null) {
            return [];
        }

        if ($role->role->key !== 'teacher') {
            return null;
        }

        $assignedViaRole = UserRole::query()
            ->where('user_id', $role->user_id)
            ->where('role_id', $role->role_id)
            ->where('scope_type', UserRole::SCOPE_CLASSROOM)
            ->active()
            ->pluck('scope_id');

        $assignedViaSubject = ClassroomSubject::query()
            ->where('teacher_id', $role->user_id)
            ->where('school_id', $role->school_id)
            ->pluck('classroom_id');

        return $assignedViaRole->merge($assignedViaSubject)->unique()->values()->all();
    }

    /**
     * @return list<int>|null student ids, or null when unrestricted
     */
    public function studentIds(): ?array
    {
        $classrooms = $this->classroomIds();

        if ($classrooms !== null) {
            if ($classrooms === []) {
                return [];
            }

            return Enrollment::query()
                ->whereIn('classroom_id', $classrooms)
                ->where('status', Enrollment::STATUS_ACTIVE)
                ->pluck('student_id')
                ->unique()
                ->values()
                ->all();
        }

        $role = $this->registrar->activeRole();

        if ($role === null) {
            return [];
        }

        $roleKey = $role->role->key;

        if ($roleKey === 'guardian') {
            return GuardianLink::query()
                ->where('guardian_user_id', $role->user_id)
                ->where('status', GuardianLink::STATUS_ACTIVE)
                ->pluck('student_id')
                ->all();
        }

        if ($roleKey === 'student') {
            return Student::query()
                ->where('user_id', $role->user_id)
                ->pluck('id')
                ->all();
        }

        return null; // school-wide roles
    }

    /**
     * Apply the student scope to a query.
     */
    public function applyStudentScope($query, ?User $user = null): mixed
    {
        $ids = $this->studentIds();

        if ($ids === null) {
            return $query;
        }

        return $query->whereIn((new Student)->qualifyColumn('id'), $ids ?: [0]);
    }

    /**
     * Classrooms visible to the active role.
     */
    public function applyClassroomScope($query): mixed
    {
        $ids = $this->classroomIds();

        if ($ids === null) {
            return $query;
        }

        return $query->whereIn((new Classroom)->qualifyColumn('id'), $ids ?: [0]);
    }

    /**
     * Active guardian links of the current guardian user, keyed by student id.
     *
     * @return Collection<int, GuardianLink>
     */
    public function myGuardianLinks(): Collection
    {
        $role = $this->registrar->activeRole();

        if ($role === null || $role->role->key !== 'guardian') {
            return collect();
        }

        return GuardianLink::query()
            ->where('guardian_user_id', $role->user_id)
            ->where('status', GuardianLink::STATUS_ACTIVE)
            ->get()
            ->keyBy('student_id');
    }
}
