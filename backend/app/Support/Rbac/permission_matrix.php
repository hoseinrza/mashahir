<?php

/**
 * SINGLE SOURCE OF TRUTH for roles, permissions and the permission matrix.
 *
 * Transcribed from «ماتریس مجوزها v1.0 — سامانه یکپارچه مدرسه مشاهیر آینده»
 * (22 Mehr 1405 / Redwebs.ir). The PermissionSeeder AND the generated
 * permission tests read this file; the matrix and the code never drift.
 *
 * Cell values:
 *   - true                => allowed within the role's scope
 *   - 'shN'               => allowed only when condition shN holds (§4)
 *   - ['shN', 'shM']      => allowed only when ALL listed conditions hold
 *   - omitted / null      => NOT allowed (default deny — never implied)
 */

return [

    'meta' => [
        'source' => 'Permission Matrix v1.0 (Redwebs.ir, 22 Mehr 1405)',
        'version' => '1.0',
    ],

    'roles' => [
        'school_admin' => ['title' => 'مدیر مدرسه', 'is_system' => true],
        'academic_deputy' => ['title' => 'معاون آموزشی', 'is_system' => true],
        'discipline_deputy' => ['title' => 'ناظم (معاون انضباطی)', 'is_system' => true],
        'teacher' => ['title' => 'معلم', 'is_system' => true],
        'corrector' => ['title' => 'مصحح', 'is_system' => true],
        'proctor' => ['title' => 'مراقب آزمون', 'is_system' => true],
        'guardian' => ['title' => 'ولی', 'is_system' => true],
        'student' => ['title' => 'دانش‌آموز', 'is_system' => true],
        'office_manager' => ['title' => 'مسئول دفتر', 'is_system' => true],
        'support' => ['title' => 'پشتیبان', 'is_system' => true],
        'platform_admin' => ['title' => 'مدیر پلتفرم', 'is_system' => true],
    ],

    'conditions' => [
        'sh1' => 'مسئول دفتر نمی‌تواند نقش‌های مدیریتی (مدیر، معاون) را بسازد یا ویرایش کند.',
        'sh2' => 'فقط کلاس‌ها و دانش‌آموزان تخصیص‌یافته به همان معلم.',
        'sh3' => 'فقط فرزندانی که پیوند فعال دارند و پرچم مربوط روی آن پیوند روشن است.',
        'sh4' => 'فقط داده خود کاربر.',
        'sh5' => 'فقط آزمون‌هایی که صریحاً به او تخصیص داده شده است.',
        'sh6' => 'فقط پس از انتشار (برای آزمون، طبق result_visibility).',
        'sh7' => 'ثبت دلیل و لاگ اجباری است.',
        'sh8' => 'فقط حداقل داده؛ بدون نمره، کارنامه و پرونده حساس.',
        'sh9' => 'تا پایان همان روز آزاد؛ پس از آن فقط مدیر با دلیل (پیشنهاد، هنوز تأیید نشده).',
        'sh10' => 'فقط با ثبت دلیل، بازه زمانی محدود و لاگ کامل.',
        'sh11' => 'فقط حوزه خودش (آموزشی: برنامه، آزمون، نمره؛ انضباطی: غیبت، تأخیر، تذکر).',
        'sh12' => 'فقط اطلاعات تماس لازم برای پیگیری غیبت و تأخیر.',
        'sh13' => 'فقط پیشنهاد؛ اعمال با تأیید مدرسه و فقط اگر لیست قفل نباشد.',
        'sh14' => 'پیام‌های اجباری مدرسه قابل غیرفعال‌سازی نیستند.',
        'sh15' => 'اتصال نیازمند تأیید مدرسه است.',
        'sh16' => 'فقط خلاصه محدودیت، نه فایل مدرک.',
    ],

    'permissions' => [

        'identity' => [
            ['key' => 'auth.switch_role', 'title' => 'تعویض نقش فعال'],
            ['key' => 'users.view', 'title' => 'مشاهده فهرست کاربران مدرسه'],
            ['key' => 'users.manage', 'title' => 'ساخت و ویرایش کاربران'],
            ['key' => 'roles.manage', 'title' => 'مدیریت نقش‌ها و مجوزها'],
            ['key' => 'users.update_phone', 'title' => 'تغییر شماره موبایل ورود'],
            ['key' => 'impersonate.start', 'title' => 'ورود به جای کاربر'],
            ['key' => 'audit.view', 'title' => 'مشاهده لاگ رویدادها'],
        ],

        'family' => [
            ['key' => 'guardian_links.view', 'title' => 'مشاهده پیوندهای ولی–دانش‌آموز'],
            ['key' => 'guardian_links.request', 'title' => 'درخواست اتصال به دانش‌آموز'],
            ['key' => 'guardian_links.manage', 'title' => 'ایجاد، تأیید و پایان پیوند'],
            ['key' => 'court_orders.manage', 'title' => 'ثبت و ویرایش حکم دادگاه'],
            ['key' => 'court_orders.view', 'title' => 'مشاهده حکم و محدودیت‌ها'],
            ['key' => 'pickup.view', 'title' => 'مشاهده لیست تحویل‌گیری'],
            ['key' => 'pickup.manage', 'title' => 'تغییر لیست تحویل‌گیری'],
            ['key' => 'consents.manage', 'title' => 'ساخت رضایتنامه'],
            ['key' => 'consents.respond', 'title' => 'پاسخ به رضایتنامه'],
            ['key' => 'consents.view_results', 'title' => 'مشاهده پاسخ رضایتنامه‌ها'],
        ],

        'academic' => [
            ['key' => 'academic.manage', 'title' => 'سال تحصیلی، پایه، کلاس، درس و تخصیص معلم'],
            ['key' => 'academic.view', 'title' => 'مشاهده کلاس‌ها و برنامه'],
            ['key' => 'timetable.manage', 'title' => 'مدیریت برنامه هفتگی'],
            ['key' => 'enrollments.manage', 'title' => 'ثبت‌نام و جابه‌جایی بین کلاس‌ها'],
            ['key' => 'students.view', 'title' => 'مشاهده مشخصات دانش‌آموز'],
            ['key' => 'students.view_national_code', 'title' => 'مشاهده کد ملی'],
            ['key' => 'students.manage', 'title' => 'ثبت، ویرایش و خروج دانش‌آموز'],
            ['key' => 'imports.run', 'title' => 'ورود داده از اکسل'],
        ],

        'attendance' => [
            ['key' => 'attendance.record', 'title' => 'ثبت حضور و غیاب'],
            ['key' => 'attendance.view', 'title' => 'مشاهده حضور و غیاب'],
            ['key' => 'attendance.correct', 'title' => 'اصلاح پس از نهایی‌سازی'],
            ['key' => 'attendance.report', 'title' => 'گزارش و آمار غیبت'],
            ['key' => 'attendance.sms_status', 'title' => 'وضعیت پیامک غیبت و تلاش مجدد'],
        ],

        'assignments' => [
            ['key' => 'assignments.manage', 'title' => 'تعریف و ویرایش تکلیف'],
            ['key' => 'assignments.view', 'title' => 'مشاهده تکلیف'],
            ['key' => 'submissions.submit', 'title' => 'ارسال پاسخ تکلیف'],
            ['key' => 'submissions.view', 'title' => 'مشاهده پاسخ‌های تکلیف'],
            ['key' => 'submissions.grade', 'title' => 'نمره و بازخورد تکلیف'],
        ],

        'exams' => [
            ['key' => 'exams.manage', 'title' => 'ساخت و ویرایش آزمون'],
            ['key' => 'exams.publish', 'title' => 'انتشار آزمون'],
            ['key' => 'exams.take', 'title' => 'شرکت در آزمون'],
            ['key' => 'exams.proctor', 'title' => 'مراقبت و مشاهده نشست‌ها'],
            ['key' => 'exams.grade_descriptive', 'title' => 'تصحیح تشریحی'],
            ['key' => 'exams.results_release', 'title' => 'تعیین زمان نمایش نمره'],
            ['key' => 'exams.results_view', 'title' => 'مشاهده نتایج آزمون'],
        ],

        'grades' => [
            ['key' => 'grades.record', 'title' => 'ثبت نمره (پیش‌نویس)'],
            ['key' => 'grades.view', 'title' => 'مشاهده نمره‌های پیش‌نویس و تأییدشده'],
            ['key' => 'grades.approve', 'title' => 'تأیید نمره'],
            ['key' => 'grades.publish', 'title' => 'انتشار کارنامه'],
            ['key' => 'grades.request_change', 'title' => 'درخواست تغییر نمره منتشرشده'],
            ['key' => 'grades.change_published', 'title' => 'تغییر نمره منتشرشده'],
            ['key' => 'reportcards.view', 'title' => 'مشاهده کارنامه منتشرشده'],
            ['key' => 'reportcards.view_draft', 'title' => 'مشاهده پیش‌نویس کارنامه'],
            ['key' => 'reportcards.export_pdf', 'title' => 'دریافت PDF کارنامه'],
        ],

        'notifications' => [
            ['key' => 'notifications.view_own', 'title' => 'مرکز اعلان خودش'],
            ['key' => 'notifications.preferences', 'title' => 'تنظیم کانال اعلان (ش۱۴)'],
            ['key' => 'announcements.publish', 'title' => 'انتشار اطلاعیه رسمی'],
            ['key' => 'announcements.view', 'title' => 'مشاهده اطلاعیه‌های هدف‌گذاری‌شده'],
        ],

        'system' => [
            ['key' => 'schools.settings', 'title' => 'تنظیمات مدرسه'],
            ['key' => 'schools.manage', 'title' => 'ساخت و مدیریت مدرسه و پلن'],
            ['key' => 'system.monitor', 'title' => 'پایش فنی و خطاها'],
        ],
    ],

    'matrix' => [

        // ─── الف. هویت و کاربران ───────────────────────────────────────
        'auth.switch_role' => [
            'school_admin' => true,
            'academic_deputy' => true,
            'discipline_deputy' => true,
            'teacher' => true,
            'corrector' => true,
            'proctor' => true,
            'guardian' => true,
            'student' => true,
            'office_manager' => true,
            'support' => true,
            'platform_admin' => true,
        ],

        'users.view' => [
            'school_admin' => true,
            'office_manager' => true,
            'support' => 'sh8',
        ],

        'users.manage' => [
            'office_manager' => 'sh1',
        ],

        'roles.manage' => [
            'platform_admin' => true,
        ],

        'users.update_phone' => [
            'school_admin' => 'sh7',
            'office_manager' => 'sh7',
            'support' => 'sh10',
        ],

        'impersonate.start' => [
            'support' => 'sh10',
        ],

        'audit.view' => [
            'school_admin' => true,
        ],

        // ─── ب. خانواده و پیوندها ──────────────────────────────────────
        'guardian_links.view' => [
            'school_admin' => true,
            'discipline_deputy' => 'sh12',
            'guardian' => 'sh4', // REVIEW: ش۳ در خوانش جایگزین؛ پیوند، داده‌ی خودِ ولی است
            'office_manager' => true,
        ],

        'guardian_links.request' => [
            'guardian' => 'sh15',
        ],

        'guardian_links.manage' => [
            'school_admin' => true,
            'office_manager' => true,
        ],

        'court_orders.manage' => [
            'school_admin' => 'sh7',
            'office_manager' => 'sh7',
        ],

        'court_orders.view' => [
            'school_admin' => true,
            'discipline_deputy' => 'sh16',
            'office_manager' => true,
        ],

        'pickup.view' => [
            'school_admin' => true,
            'discipline_deputy' => true,
            'guardian' => 'sh3',
            'office_manager' => true,
        ],

        'pickup.manage' => [
            'school_admin' => 'sh7',
            'discipline_deputy' => 'sh13',
            'office_manager' => 'sh7',
        ],

        'consents.manage' => [
            'school_admin' => true,
            'academic_deputy' => true, // REVIEW: خوانش اصل سند نامطمئن
            'teacher' => 'sh2',
        ],

        'consents.respond' => [
            'guardian' => 'sh3',
        ],

        'consents.view_results' => [
            'school_admin' => true,
            'academic_deputy' => true,
            'teacher' => 'sh2',
            'office_manager' => true,
        ],

        // ─── پ. ساختار آموزشی و دانش‌آموزان ────────────────────────────
        'academic.manage' => [
            'school_admin' => true,
            'academic_deputy' => true,
        ],

        'academic.view' => [
            'school_admin' => true,
            'academic_deputy' => true,
            'discipline_deputy' => true, // REVIEW
            'teacher' => 'sh2',
            'guardian' => 'sh3', // REVIEW
            'student' => 'sh4',
            'office_manager' => true, // REVIEW
        ],

        'timetable.manage' => [
            'school_admin' => true,
            'academic_deputy' => true,
        ],

        'enrollments.manage' => [
            'school_admin' => true,
            'academic_deputy' => true,
            'office_manager' => true,
        ],

        'students.view' => [
            'school_admin' => true,
            'academic_deputy' => true,
            'discipline_deputy' => true,
            'teacher' => 'sh2',
            'guardian' => 'sh3',
            'student' => 'sh4',
            'office_manager' => true,
            'support' => 'sh8',
        ],

        'students.view_national_code' => [
            'school_admin' => 'sh7',
            'office_manager' => 'sh7',
        ],

        'students.manage' => [
            'school_admin' => true,
            'office_manager' => true,
        ],

        'imports.run' => [
            'school_admin' => true,
            'office_manager' => true,
        ],

        // ─── ت. حضور و غیاب ────────────────────────────────────────────
        'attendance.record' => [
            'teacher' => 'sh2',
        ],

        'attendance.view' => [
            'school_admin' => true,
            'academic_deputy' => true,
            'discipline_deputy' => true,
            'teacher' => 'sh2',
            'guardian' => 'sh3',
            'student' => 'sh4',
            'office_manager' => true, // REVIEW
        ],

        'attendance.correct' => [
            'school_admin' => 'sh7',
            'teacher' => 'sh9',
        ],

        'attendance.report' => [
            'school_admin' => true,
            'academic_deputy' => true,
            'discipline_deputy' => true,
            'teacher' => 'sh2',
        ],

        'attendance.sms_status' => [
            'school_admin' => true,
            'discipline_deputy' => true,
            'teacher' => 'sh2', // REVIEW
            'support' => 'sh8', // REVIEW
        ],

        // ─── ث. تکالیف ─────────────────────────────────────────────────
        'assignments.manage' => [
            'teacher' => 'sh2',
        ],

        'assignments.view' => [
            'academic_deputy' => true,
            'discipline_deputy' => true, // REVIEW
            'teacher' => 'sh2',
            'guardian' => 'sh3',
            'student' => 'sh4',
        ],

        'submissions.submit' => [
            'student' => 'sh4',
        ],

        'submissions.view' => [
            'academic_deputy' => true,
            'discipline_deputy' => true, // REVIEW
            'teacher' => 'sh2',
            'guardian' => 'sh3',
            'student' => 'sh4',
        ],

        'submissions.grade' => [
            'teacher' => 'sh2',
        ],

        // ─── ج. آزمون آنلاین ───────────────────────────────────────────
        'exams.manage' => [
            'teacher' => 'sh2',
        ],

        'exams.publish' => [
            'teacher' => 'sh2',
        ],

        'exams.take' => [
            'student' => 'sh4',
        ],

        'exams.proctor' => [
            'discipline_deputy' => true, // REVIEW: معاون آموزشی در خوانش جایگزین
            'teacher' => 'sh2',
            'proctor' => 'sh5',
        ],

        'exams.grade_descriptive' => [
            'teacher' => 'sh2',
            'corrector' => 'sh5',
        ],

        'exams.results_release' => [
            'teacher' => 'sh2',
        ],

        'exams.results_view' => [
            'academic_deputy' => true,
            'discipline_deputy' => true, // REVIEW
            'teacher' => 'sh2',
            'corrector' => 'sh5', // REVIEW
            'guardian' => ['sh3', 'sh6'],
            'student' => ['sh4', 'sh6'],
        ],

        // ─── چ. نمره و کارنامه ─────────────────────────────────────────
        'grades.record' => [
            'teacher' => 'sh2',
        ],

        'grades.view' => [
            'academic_deputy' => true,
            'discipline_deputy' => true, // REVIEW
            'teacher' => 'sh2',
        ],

        'grades.approve' => [
            'academic_deputy' => true,
            'school_admin' => true, // REVIEW: PRD تأیید را فقط معاون می‌داند
        ],

        'grades.publish' => [
            'academic_deputy' => true,
            'school_admin' => true,
        ],

        'grades.request_change' => [
            'teacher' => ['sh2', 'sh7'],
        ],

        'grades.change_published' => [
            'school_admin' => 'sh7',
            'academic_deputy' => 'sh7',
        ],

        'reportcards.view' => [
            'school_admin' => true,
            'academic_deputy' => true,
            'discipline_deputy' => true, // REVIEW
            'teacher' => 'sh2',
            'guardian' => ['sh3', 'sh6'],
            'student' => ['sh4', 'sh6'],
        ],

        'reportcards.view_draft' => [
            'school_admin' => true, // REVIEW
            'academic_deputy' => true,
            'teacher' => 'sh2',
        ],

        'reportcards.export_pdf' => [
            'school_admin' => true,
            'academic_deputy' => true,
            'guardian' => ['sh3', 'sh6'],
            'student' => ['sh4', 'sh6'],
        ],

        // ─── ح. اعلان و اطلاع‌رسانی ─────────────────────────────────────
        'notifications.view_own' => [
            'school_admin' => true,
            'academic_deputy' => true,
            'discipline_deputy' => true,
            'teacher' => true,
            'corrector' => true,
            'proctor' => true,
            'guardian' => true,
            'student' => true,
            'office_manager' => true,
            'support' => true,
            'platform_admin' => true,
        ],

        'notifications.preferences' => [
            'school_admin' => true,
            'academic_deputy' => true,
            'discipline_deputy' => true,
            'teacher' => true,
            'corrector' => true,
            'proctor' => true,
            'guardian' => true,
            'student' => true,
            'office_manager' => true,
            'support' => true,
            'platform_admin' => true,
        ],

        'announcements.publish' => [
            'school_admin' => true,
            'academic_deputy' => 'sh11',
            'discipline_deputy' => 'sh11',
            'teacher' => 'sh2',
        ],

        'announcements.view' => [
            'school_admin' => true,
            'academic_deputy' => true,
            'discipline_deputy' => true,
            'teacher' => true,
            'corrector' => true,
            'proctor' => true,
            'guardian' => true,
            'student' => true,
            'office_manager' => true,
            'support' => true, // REVIEW
        ],

        // ─── خ. سیستم ──────────────────────────────────────────────────
        'schools.settings' => [
            'school_admin' => true,
            'platform_admin' => true,
        ],

        'schools.manage' => [
            'platform_admin' => true,
        ],

        'system.monitor' => [
            'platform_admin' => true,
            'support' => 'sh8',
        ],
    ],
];
