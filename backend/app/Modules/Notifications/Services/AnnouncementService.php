<?php

namespace App\Modules\Notifications\Services;

use App\Modules\Academic\Models\Classroom;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\Notifications\Models\Announcement;
use App\Modules\Notifications\Models\AnnouncementTarget;
use App\Modules\Notifications\Models\Notification;
use App\Modules\People\Models\GuardianLink;
use App\Support\SchoolContext;
use Illuminate\Support\Collection;

/**
 * Official school announcements with targeting: fan-out into per-user
 * notifications (every guardian gets their OWN row — never a shared one).
 */
final class AnnouncementService
{
    public function __construct(private readonly NotificationService $notifications)
    {
    }

    /**
     * @param array<int, array{target_type: string, target_id?: ?int}> $targets
     */
    public function publish(
        string $title,
        string $body,
        string $importance,
        int $publisherId,
        array $targets,
        ?\Carbon\CarbonInterface $expiresAt = null,
    ): Announcement {
        /** @var SchoolContext $context */
        $context = app(SchoolContext::class);
        $schoolId = (int) $context->schoolId();

        $announcement = Announcement::query()->create([
            'title' => $title,
            'body' => $body,
            'importance' => $importance,
            'published_by' => $publisherId,
            'published_at' => now(),
            'expires_at' => $expiresAt,
        ]);

        if ($targets === []) {
            $targets = [['target_type' => AnnouncementTarget::TYPE_SCHOOL, 'target_id' => null]];
        }

        foreach ($targets as $target) {
            AnnouncementTarget::query()->create([
                'announcement_id' => $announcement->id,
                'target_type' => $target['target_type'],
                'target_id' => $target['target_id'] ?? null,
            ]);
        }

        $audience = $this->resolveAudience($schoolId, collect($targets));

        foreach ($audience as $user) {
            $this->notifications->notify(
                $user,
                null,
                'announcement',
                $title,
                $body,
                '/announcements',
                $importance,
                ['in_app'],
                ['announcement_ulid' => $announcement->ulid],
            );
        }

        return $announcement->fresh(['targets']);
    }

    /**
     * Union of users matching the targets: school-wide targets reach all
     * staff + students + guardians; classroom/grade targets reach the
     * classroom's teachers, its enrolled students and their guardians.
     *
     * @return Collection<int, User>
     */
    private function resolveAudience(int $schoolId, Collection $targets): Collection
    {
        $userIds = collect();
        $isSchoolWide = $targets->contains('target_type', AnnouncementTarget::TYPE_SCHOOL);

        foreach ($targets as $target) {
            $classroomIds = match ($target['target_type']) {
                AnnouncementTarget::TYPE_SCHOOL => Classroom::query()->where('school_id', $schoolId)->pluck('id'),
                AnnouncementTarget::TYPE_GRADE_LEVEL => Classroom::query()
                    ->where('school_id', $schoolId)
                    ->where('grade_level_id', $target['target_id'])
                    ->pluck('id'),
                AnnouncementTarget::TYPE_CLASSROOM => collect([(int) $target['target_id']]),
                default => collect(),
            };

            $studentIds = \App\Modules\Academic\Models\Enrollment::query()
                ->whereIn('classroom_id', $classroomIds)
                ->where('status', 'active')
                ->pluck('student_id');

            // Staff: everyone for school-wide, the assigned teachers otherwise.
            if ($isSchoolWide) {
                $userIds = $userIds->merge(
                    UserRole::query()->where('school_id', $schoolId)->active()->pluck('user_id'),
                );
            } else {
                $userIds = $userIds->merge(
                    \App\Modules\Academic\Models\ClassroomSubject::query()
                        ->whereIn('classroom_id', $classroomIds)
                        ->pluck('teacher_id')
                        ->filter(),
                );
            }

            // Students with accounts.
            $userIds = $userIds->merge(
                \App\Modules\People\Models\Student::query()->whereIn('id', $studentIds)->pluck('user_id')->filter(),
            );

            // Guardians of those students (usable links only).
            $userIds = $userIds->merge(
                GuardianLink::query()->whereIn('student_id', $studentIds)->usable()->pluck('guardian_user_id'),
            );
        }

        return User::query()
            ->whereIn('id', $userIds->unique()->filter())
            ->where('status', 'active')
            ->get();
    }
}
