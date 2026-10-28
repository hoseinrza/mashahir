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
            // Student of the high school — has his own account (PRD §3).
            ['first_name' => 'پارسا', 'last_name' => 'رادمنش', 'phone' => '09120000008', 'role' => 'student'],
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

            // The student role is student-scoped (ش۴): scope_id = own record.
            $studentRecordId = null;
            $scopeType = 'school';

            if ($person['role'] === 'student') {
                $record = Student::query()->firstOrCreate(
                    ['school_id' => $school->id, 'student_code' => '4002'],
                    [
                        'ulid' => (string) \Illuminate\Support\Str::ulid(),
                        'first_name' => $person['first_name'],
                        'last_name' => $person['last_name'],
                        'status' => 'active',
                    ],
                );
                $record->forceFill(['user_id' => $user->id])->save();
                $studentRecordId = $record->id;
                $scopeType = 'student';
            }

            UserRole::query()->firstOrCreate([
                'user_id' => $user->id,
                'role_id' => $roleIds[$person['role']],
                'school_id' => $school->id,
                'scope_type' => $scopeType,
                'scope_id' => $studentRecordId,
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

        // Guardian B (مسعود، پدر جداشده‌ی پارسا): limited link — pickup yes, grades no.
        GuardianLink::query()->firstOrCreate(
            ['guardian_user_id' => $guardianB->id, 'student_id' => $students[1]->id],
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

        $this->seedAcademicContent($school, $students, $usersByPhone);

        $this->command?->info('Demo users ready — ورود: 09120000001 (مدیر) … 09120000007 (ولی دوم) … 09120000008 (دانش‌آموز)');
    }

    /**
     * Timetable, sessions, attendance, assignments, exam, announcement,
     * consent — so every wired UI page shows live data.
     */
    private function seedAcademicContent($school, $students, $usersByPhone): void
    {
        $admin = $usersByPhone['09120000001'];
        $teacher = $usersByPhone['09120000004'];

        $math = \App\Modules\Academic\Models\Subject::query()->firstOrCreate(
            ['school_id' => $school->id, 'title' => 'ریاضی'],
            ['code' => 'MATH'],
        );
        $physics = \App\Modules\Academic\Models\Subject::query()->firstOrCreate(
            ['school_id' => $school->id, 'title' => 'فیزیک'],
            ['code' => 'PHY'],
        );

        $year = \App\Modules\Academic\Models\AcademicYear::query()->where('school_id', $school->id)->first();
        $grade = \App\Modules\Academic\Models\GradeLevel::query()->where('school_id', $school->id)->first()
            ?? \App\Modules\Academic\Models\GradeLevel::query()->create(['school_id' => $school->id, 'title' => 'دهم', 'order' => 10]);
        $classroom = \App\Modules\Academic\Models\Classroom::query()->firstOrCreate(
            ['academic_year_id' => $year->id, 'title' => 'دهم تجربی ۱'],
            ['school_id' => $school->id, 'grade_level_id' => $grade->id],
        );

        $mathCs = \App\Modules\Academic\Models\ClassroomSubject::query()->firstOrCreate(
            ['classroom_id' => $classroom->id, 'subject_id' => $math->id],
            ['school_id' => $school->id, 'teacher_id' => $teacher->id],
        );
        \App\Modules\Academic\Models\ClassroomSubject::query()->firstOrCreate(
            ['classroom_id' => $classroom->id, 'subject_id' => $physics->id],
            ['school_id' => $school->id, 'teacher_id' => $admin->id],
        );

        foreach ($students as $s) {
            \App\Modules\Academic\Models\Enrollment::query()->firstOrCreate(
                ['student_id' => $s->id, 'classroom_id' => $classroom->id],
                ['school_id' => $school->id, 'starts_on' => $year->starts_on, 'status' => 'active'],
            );
        }

        foreach ([[0, 1, '08:00', '09:30'], [0, 2, '09:45', '11:15'], [2, 1, '08:00', '09:30']] as [$w, $p, $st, $en]) {
            \App\Modules\Academic\Models\TimetableSlot::query()->firstOrCreate(
                ['classroom_subject_id' => $mathCs->id, 'weekday' => $w, 'period' => $p],
                ['school_id' => $school->id, 'starts_at' => $st, 'ends_at' => $en],
            );
        }

        // Today's session with a DRAFT attendance (آرش غایب، بقیه حاضر).
        $session = \App\Modules\Academic\Models\ClassSession::query()->firstOrCreate(
            ['classroom_subject_id' => $mathCs->id, 'held_on' => now()->toDateString(), 'period' => 1],
            ['school_id' => $school->id, 'attendance_status' => 'draft'],
        );
        foreach ($students as $s) {
            \App\Modules\Attendance\Models\AttendanceRecord::query()->updateOrCreate(
                ['class_session_id' => $session->id, 'student_id' => $s->id],
                [
                    'school_id' => $school->id,
                    'status' => $s->id === $students[0]->id ? 'absent' : 'present',
                    'source' => 'manual',
                    'recorded_by' => $teacher->id,
                    'recorded_at' => now(),
                ],
            );
        }

        \App\Modules\Assignments\Models\Assignment::query()->firstOrCreate(
            ['title' => 'تم تابع درجه دوم', 'classroom_subject_id' => $mathCs->id],
            [
                'school_id' => $school->id, 'due_at' => now()->addDays(3),
                'description' => 'تمرین‌های ۱ تا ۸ فصل ۲ را حل کنید.',
                'created_by' => $teacher->id,
            ],
        );
        \App\Modules\Assignments\Models\Assignment::query()->firstOrCreate(
            ['title' => 'گزارش آزمایش آونگ', 'classroom_subject_id' => $mathCs->id],
            [
                'school_id' => $school->id, 'due_at' => now()->subDay(),
                'description' => 'گزارش آزمایش آونگ ساده (مهلت گذشته).',
                'created_by' => $teacher->id,
            ],
        );

        $exam = \App\Modules\Exams\Models\Exam::query()->firstOrCreate(
            ['title' => 'کوییز آنلاین فصل ۱', 'classroom_subject_id' => $mathCs->id],
            [
                'school_id' => $school->id,
                'opens_at' => now()->subHour(), 'closes_at' => now()->addDays(2),
                'duration_minutes' => 15, 'result_visibility' => 'immediately',
                'status' => 'published', 'created_by' => $teacher->id,
            ],
        );
        $question = \App\Modules\Exams\Models\ExamQuestion::query()->firstOrCreate(
            ['exam_id' => $exam->id, 'position' => 1],
            ['type' => 'mcq', 'body' => 'مشتق x² چیست؟', 'points' => 2],
        );
        $optA = \App\Modules\Exams\Models\ExamOption::query()->firstOrCreate(
            ['question_id' => $question->id, 'position' => 1], ['body' => 'x'],
        );
        $optB = \App\Modules\Exams\Models\ExamOption::query()->firstOrCreate(
            ['question_id' => $question->id, 'position' => 2], ['body' => '2x'],
        );
        $question->forceFill(['correct_option_id' => $optB->id])->save();
        \App\Modules\Exams\Models\ExamOption::query()->firstOrCreate(
            ['question_id' => $question->id, 'position' => 3], ['body' => 'x²/2'],
        );

        app(\App\Modules\Notifications\Services\AnnouncementService::class)->publish(
            'جلسه انجمن اولیا',
            'جلسه انجمن اولیا و مربیان روز پنجشنبه ساعت ۱۰ در سالن اجتماعات برگزار می‌شود.',
            'important',
            $admin->id,
            [['target_type' => 'school']],
        );

        \App\Modules\Family\Models\ConsentRequest::query()->firstOrCreate(
            ['student_id' => $students[1]->id, 'title' => 'رضایتنامه اردوی باغ کتاب'],
            [
                'school_id' => $school->id, 'policy' => 'one_parent',
                'due_at' => now()->addDays(5), 'created_by' => $admin->id,
            ],
        );

        $term = \App\Modules\Academic\Models\Term::query()->firstOrCreate(
            ['academic_year_id' => $year->id, 'title' => 'دوره اول'],
            ['school_id' => $school->id, 'starts_on' => '2026-09-01', 'ends_on' => '2027-01-20'],
        );
        \App\Modules\Grades\Models\GradeItem::query()->firstOrCreate(
            ['student_id' => $students[1]->id, 'classroom_subject_id' => $mathCs->id, 'term_id' => $term->id, 'source_type' => 'in_person_exam'],
            [
                'school_id' => $school->id, 'delivery' => 'in_person',
                'status' => 'approved', 'score' => 88, 'max_score' => 100,
                'recorded_by' => $teacher->id, 'approved_by' => $admin->id,
            ],
        );
    }
}
