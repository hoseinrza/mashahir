<?php

namespace Database\Seeders;

use App\Modules\Academic\Models\AcademicYear;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserRole;
use App\Modules\People\Models\GuardianLink;
use App\Modules\People\Models\Student;
use App\Modules\School\Models\School;
use App\Support\PhoneHash;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Local development demo content (skipped in production):
 * a school, one staff user per core role, students and two separated
 * guardians of the same child — perfect for exercising guardian isolation.
 */
class LocalDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }

        $school = School::query()->first() ?? School::query()->create([
            'name' => 'دبیرستان مشاهیر آینده',
            'level' => 'high',
            'grading_type' => 'numeric',
            'student_has_account' => true,
            'timezone' => 'Asia/Tehran',
            'is_active' => true,
        ]);

        // School-scoped models (students, links, ...) rely on the context.
        app(\App\Support\SchoolContext::class)->set($school->id);

        AcademicYear::query()->firstOrCreate(
            ['school_id' => $school->id, 'title' => 'سال تحصیلی ۱۴۰۵-۱۴۰۶'],
            ['starts_on' => '2026-09-01', 'ends_on' => '2027-06-20', 'is_current' => true],
        );

        $people = [
            ['first_name' => 'احمدرضا', 'last_name' => 'جلالی', 'phone' => '09120000001', 'role' => 'school_admin'],
            ['first_name' => 'مریم', 'last_name' => 'تهرانی', 'phone' => '09120000002', 'role' => 'academic_deputy'],
            ['first_name' => 'علی', 'last_name' => 'قربانی', 'phone' => '09120000003', 'role' => 'discipline_deputy'],
            ['first_name' => 'محسن', 'last_name' => 'کریمی', 'phone' => '09120000004', 'role' => 'teacher'],
            ['first_name' => 'رضا', 'last_name' => 'احمدی', 'phone' => '09120000005', 'role' => 'office_manager'],
            ['first_name' => 'فریبا', 'last_name' => 'کاظمی', 'phone' => '09120000006', 'role' => 'guardian'],
            ['first_name' => 'مسعود', 'last_name' => 'رادمنش', 'phone' => '09120000007', 'role' => 'guardian'],
        ];

        $roleIds = DB::table('roles')->whereNull('school_id')->pluck('id', 'key');
        $usersByRole = [];
        $usersByPhone = [];

        foreach ($people as $person) {
            $user = User::query()->firstOrCreate(
                ['phone_hash' => PhoneHash::of($person['phone'])],
                [
                    'ulid' => (string) \Illuminate\Support\Str::ulid(),
                    'first_name' => $person['first_name'],
                    'last_name' => $person['last_name'],
                    'phone' => $person['phone'],
                    'phone_hash' => PhoneHash::of($person['phone']),
                    'status' => 'active',
                ],
            );

            UserRole::query()->firstOrCreate([
                'user_id' => $user->id,
                'role_id' => $roleIds[$person['role']],
                'school_id' => $school->id,
                'scope_type' => 'school',
                'scope_id' => null,
            ], ['starts_on' => now()->toDateString()]);

            $usersByRole[$person['role']] = $user;
            $usersByPhone[$person['phone']] = $user;
        }

        $guardianA = $usersByPhone['09120000006']; // فریبا کاظمی
        $guardianB = $usersByPhone['09120000007']; // مسعود رادمنش

        $students = collect([
            ['code' => '4001', 'first_name' => 'آرش', 'last_name' => 'کریمی'],
            ['code' => '4002', 'first_name' => 'پارسا', 'last_name' => 'رادمنش'],
            ['code' => '4003', 'first_name' => 'سارا', 'last_name' => 'موسوی'],
        ])->map(fn (array $s) => Student::query()->firstOrCreate(
            ['school_id' => $school->id, 'student_code' => $s['code']],
            [
                'ulid' => (string) \Illuminate\Support\Str::ulid(),
                'first_name' => $s['first_name'],
                'last_name' => $s['last_name'],
                'status' => 'active',
            ],
        ));

        // Guardian A (فریبا): primary of آرش + پارسا.
        GuardianLink::query()->firstOrCreate(
            ['guardian_user_id' => $guardianA->id, 'student_id' => $students[0]->id],
            [
                'link_type' => 'primary',
                'status' => 'active',
                'approved_at' => now(),
                'can_view_grades' => true,
                'can_view_attendance' => true,
                'can_approve_consent' => true,
                'can_pickup' => false,
                'can_receive_sms' => true,
            ],
        );

        GuardianLink::query()->firstOrCreate(
            ['guardian_user_id' => $guardianA->id, 'student_id' => $students[1]->id],
            [
                'link_type' => 'primary',
                'status' => 'active',
                'approved_at' => now(),
                'can_view_grades' => true,
                'can_view_attendance' => true,
                'can_approve_consent' => true,
                'can_pickup' => true,
                'can_receive_sms' => true,
            ],
        );

        // Guardian B (مسعود، جدا شده): limited link to the SAME child (آرش).
        GuardianLink::query()->firstOrCreate(
            ['guardian_user_id' => $guardianB->id, 'student_id' => $students[0]->id],
            [
                'link_type' => 'separated_limited',
                'status' => 'active',
                'approved_at' => now(),
                'can_view_grades' => false,
                'can_view_attendance' => false,
                'can_approve_consent' => false,
                'can_pickup' => true,
                'can_receive_sms' => false,
            ],
        );

        $this->command?->info('Demo users ready — ورود: 09120000001 (مدیر) … 09120000007 (ولی دوم)');
    }
}
