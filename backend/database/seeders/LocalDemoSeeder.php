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
            // Platform admin — technical only, no educational content.
            ['first_name' => 'حسین', 'last_name' => 'رضازاده', 'phone' => '09120000000', 'role' => 'platform_admin'],
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

        // Second school: the math teacher works there TOO (multi-school demo).
        $secondSchool = School::query()->firstOrCreate(
            ['name' => 'هنرستان فنی مشاهیر نوین'],
            [
                'level' => 'high', 'grading_type' => 'numeric',
                'student_has_account' => true, 'timezone' => 'Asia/Tehran', 'is_active' => true,
            ],
        );

        $teacher = $usersByPhone['09120000004'];
        UserRole::query()->firstOrCreate([
            'user_id' => $teacher->id,
            'role_id' => $roleIds['teacher'],
            'school_id' => $secondSchool->id,
            'scope_type' => 'school',
            'scope_id' => null,
        ], ['starts_on' => now()->toDateString()]);

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

        $functionsAsg = \App\Modules\Assignments\Models\Assignment::query()->firstOrCreate(
            ['title' => 'تم تابع درجه دوم', 'classroom_subject_id' => $mathCs->id],
            [
                'school_id' => $school->id, 'due_at' => now()->addDays(3),
                'description' => 'تمرین‌های ۱ تا ۸ فصل ۲ را حل کنید.',
                'created_by' => $teacher->id,
            ],
        );
        $pendulumAsg = \App\Modules\Assignments\Models\Assignment::query()->firstOrCreate(
            ['title' => 'گزارش آزمایش آونگ', 'classroom_subject_id' => $mathCs->id],
            [
                'school_id' => $school->id, 'due_at' => now()->subDay(),
                'description' => 'گزارش آزمایش آونگ ساده (مهلت گذشته).',
                'created_by' => $teacher->id,
            ],
        );

        // Submission states covering every badge in the UI: graded (پارسا),
        // waiting for correction (سارا) and late-graded (آرش).
        $parsaSub = \App\Modules\Assignments\Models\Submission::query()->updateOrCreate(
            ['assignment_id' => $functionsAsg->id, 'student_id' => $students[1]->id],
            [
                'school_id' => $school->id,
                'text' => 'تمرین‌های ۱ تا ۸ حل شد؛ نمودارها در پیوست است.',
                'status' => 'graded',
                'submitted_at' => now()->subDays(2),
                'score' => 92,
                'feedback' => 'رسم نمودار دقیق است؛ دامنه و بازه تعریف را در سؤال ۷ بازبینی کنید.',
                'graded_by' => $teacher->id,
                'graded_at' => now()->subDay(),
            ],
        );
        \App\Modules\Assignments\Models\Submission::query()->updateOrCreate(
            ['assignment_id' => $functionsAsg->id, 'student_id' => $students[2]->id],
            [
                'school_id' => $school->id,
                'text' => 'حل تمرین‌های ۱ تا ۵ — دو سؤال آخر نیاز به راهنمایی دارد.',
                'status' => 'submitted',
                'submitted_at' => now()->subHours(4),
                'score' => null,
                'feedback' => null,
                'graded_by' => null,
                'graded_at' => null,
            ],
        );
        \App\Modules\Assignments\Models\Submission::query()->updateOrCreate(
            ['assignment_id' => $pendulumAsg->id, 'student_id' => $students[0]->id],
            [
                'school_id' => $school->id,
                'text' => 'گزارش کار آزمایش آونگ همراه با جدول دوره تناوب.',
                'status' => 'graded',
                'submitted_at' => now()->subHours(6),
                'score' => 74,
                'feedback' => 'محاسبات درست است؛ نتیجه‌گیری از رابطه طول و دوره ناقص است.',
                'graded_by' => $teacher->id,
                'graded_at' => now()->subHour(),
            ],
        );

        // Attachments through the real file manager (bytes + content sniffing),
        // so homework sheets and PDFs render in the teacher and student views.
        $studentUser = $usersByPhone['09120000008'];
        $attach = function(
            \Illuminate\Database\Eloquent\Model $owner,
            string $name,
            string $bytes,
            \App\Modules\Identity\Models\User $uploader
        ) use ($school): void {
            if ($owner->files()->exists()) {
                return;
            }
            $owner->files()->attach($this->demoFile($uploader, $school->id, $name, $bytes));
        };

        $attach($functionsAsg, 'برگه سؤالات فصل ۲.pdf', $this->pdfBytes('Functions chapter 2 - exercise sheet'), $teacher);
        $attach($pendulumAsg, 'دستور کار آزمایش آونگ.pdf', $this->pdfBytes('Pendulum lab - procedure'), $teacher);
        $attach($parsaSub, 'برگه پاسخ پارسا.png', $this->pngBytes(), $studentUser);

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

        // A descriptive question + two submitted papers so the teacher's
        // correction panel has a pending sheet and an already-graded one.
        // پارسا is left without an attempt so the live take-the-exam demo still works.
        $essayQuestion = \App\Modules\Exams\Models\ExamQuestion::query()->firstOrCreate(
            ['exam_id' => $exam->id, 'position' => 2],
            [
                'type' => 'descriptive',
                'body' => 'با استفاده از مشتق، نشانه‌های افزایش و کاهش تابع f(x) = x² − 4x + 3 را تعیین کنید و کمینه آن را توضیح دهید.',
                'points' => 4,
            ],
        );

        $demoPaper = function (int $studentId, string $answerText, ?string $sheetName) use ($exam, $question, $essayQuestion, $optB, $school, $teacher): \App\Modules\Exams\Models\ExamAttempt {
            $attempt = \App\Modules\Exams\Models\ExamAttempt::query()->firstOrCreate(
                ['exam_id' => $exam->id, 'student_id' => $studentId],
                [
                    'school_id' => $school->id,
                    'started_at' => now()->subHours(3),
                    'server_deadline' => now()->subHours(3)->addMinutes($exam->duration_minutes),
                    'status' => 'submitted',
                    'submitted_at' => now()->subHours(2),
                    'auto_score' => 2,
                ],
            );

            \App\Modules\Exams\Models\AttemptAnswer::query()->firstOrCreate(
                ['attempt_id' => $attempt->id, 'question_id' => $question->id],
                ['option_id' => $optB->id, 'saved_at' => now()->subHours(2), 'version' => 1],
            );

            $essay = \App\Modules\Exams\Models\AttemptAnswer::query()->firstOrCreate(
                ['attempt_id' => $attempt->id, 'question_id' => $essayQuestion->id],
                ['text' => $answerText, 'saved_at' => now()->subHours(2), 'version' => 1],
            );

            if ($sheetName !== null && $essay->file_id === null) {
                // The demo students behind these papers have no login, so the
                // scanned sheet is filed by the teacher; access is still scoped
                // through the attempt's class.
                $essay->forceFill([
                    'file_id' => $this->demoFile($teacher, $school->id, $sheetName, $this->pngBytes())->id,
                ])->save();
            }

            return $attempt;
        };

        // Graded paper (has the scanned sheet) + one still waiting for a score.
        $gradedPaper = $demoPaper($students[0]->id, 'مشتق برابر ۲x−۴ است؛ با صفر قرار دادن آن x=2 به دست می‌آید و تابع در این نقطه کمینه دارد.', 'برگه دست‌نویس آرش.png');
        $demoPaper($students[2]->id, 'نمودار سهمی رو به بالا است و رأس آن در x=2 قرار دارد؛ بنابراین کمینه تابع f(2)=−۱ است.', null);

        \App\Modules\Exams\Models\AnswerGrade::query()->firstOrCreate(
            ['answer_id' => $gradedPaper->answers()->where('question_id', $essayQuestion->id)->value('id')],
            [
                'score' => 3,
                'comment' => 'استدلال درست است؛ مقدار کمینه تابع ذکر نشده بود، یک نمره کسر شد.',
                'graded_by' => $teacher->id,
                'graded_at' => now()->subHour(),
            ],
        );

        // A second, untouched exam: the demo student can still sit it live,
        // so the take → correct → view-result round trip stays demoable even
        // after the first exam already has submitted papers.
        $liveExam = \App\Modules\Exams\Models\Exam::query()->firstOrCreate(
            ['title' => 'آزمون تشریحی فصل ۲', 'classroom_subject_id' => $mathCs->id],
            [
                'school_id' => $school->id,
                'opens_at' => now()->subHours(2), 'closes_at' => now()->addDays(3),
                'duration_minutes' => 20, 'result_visibility' => 'immediately',
                'status' => 'published', 'created_by' => $teacher->id,
            ],
        );
        \App\Modules\Exams\Models\ExamQuestion::query()->firstOrCreate(
            ['exam_id' => $liveExam->id, 'position' => 1],
            [
                'type' => 'descriptive',
                'body' => 'حد تابع (x² − 9)/(x − 3) را هنگام میل x به 3 محاسبه کنید و روش خود را توضیح دهید.',
                'points' => 4,
            ],
        );

        // firstOrCreate freezes these at the first seed run, so a sandbox that is
        // opened days later shows an expired exam and overdue homework only.
        // Re-running the seeder re-anchors the demo window around "now".
        $exam->forceFill(['opens_at' => now()->subDay(), 'closes_at' => now()->addDays(2)])->save();
        $liveExam->forceFill(['opens_at' => now()->subHours(2), 'closes_at' => now()->addDays(3)])->save();
        $functionsAsg->forceFill(['due_at' => now()->addDays(3)])->save();
        $pendulumAsg->forceFill(['due_at' => now()->subDay()])->save();

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

        // One published report card, so the student/guardian grade views
        // (which only ever show published rows) have real content.
        $alreadyPublished = \App\Modules\Grades\Models\ReportCard::query()
            ->where('student_id', $students[1]->id)
            ->where('term_id', $term->id)
            ->where('kind', \App\Modules\Grades\Models\ReportCard::KIND_IN_PERSON)
            ->where('status', \App\Modules\Grades\Models\ReportCard::STATUS_PUBLISHED)
            ->exists();

        if (! $alreadyPublished) {
            app(\App\Modules\Grades\Services\GradeService::class)
                ->publishReportCard($students[1]->id, $term->id, \App\Modules\Grades\Models\ReportCard::KIND_IN_PERSON, $admin->id);
        }

        \App\Modules\OnlineClasses\Models\OnlineClass::query()->firstOrCreate(
            ['title' => 'کلاس آنلاین ریاضی — فصل ۲', 'classroom_subject_id' => $mathCs->id],
            [
                'school_id' => $school->id,
                'skyroom_room_id' => crc32('demo-math'),
                'skyroom_name' => 'cls_demo_math',
                'status' => 'active',
                'created_by' => $teacher->id,
            ],
        );
    }

    /** Store real bytes through the file manager — same validation as the UI. */
    private function demoFile(User $uploader, int $schoolId, string $name, string $bytes): \App\Modules\Files\Models\File
    {
        $tmp = tempnam(sys_get_temp_dir(), 'mashahir-demo');
        file_put_contents($tmp, $bytes);

        try {
            return app(\App\Modules\Files\Services\FileService::class)->store(
                new \Illuminate\Http\UploadedFile($tmp, $name, null, null, true),
                $uploader,
                $schoolId,
            );
        } finally {
            @unlink($tmp);
        }
    }

    private function pdfBytes(string $title): string
    {
        $content = "BT /F1 18 Tf 40 780 Td ({$title}) Tj ET";
        $objects = [
            1 => '<< /Type /Catalog /Pages 2 0 R >>',
            2 => '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            3 => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] '
                . '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
            4 => '<< /Length ' . strlen($content) . " >>\nstream\n{$content}\nendstream",
            5 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $num => $body) {
            $offsets[$num] = strlen($pdf);
            $pdf .= "{$num} 0 obj\n{$body}\nendobj\n";
        }

        $xrefAt = strlen($pdf);
        $pdf .= "xref\n0 6\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf . "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{$xrefAt}\n%%EOF";
    }

    private function pngBytes(): string
    {
        return base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        );
    }
}
