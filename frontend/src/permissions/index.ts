import { Permission, Role, PermissionScope } from '../types';

export const ALL_PERMISSIONS: Permission[] = [
  // Educational
  { id: 'p1', code: 'attendance:view', name: 'مشاهده حضور و غیاب', category: 'educational', scope: 'classroom', description: 'امکان مشاهده لیست و سوابق حضور و غیاب' },
  { id: 'p2', code: 'attendance:record', name: 'ثبت و ویرایش حضور و غیاب', category: 'educational', scope: 'classroom', description: 'ثبت غیبت، تأخیر و ارسال پیامک به والدین' },
  { id: 'p3', code: 'assignment:create', name: 'تعریف و مدیریت تکالیف', category: 'educational', scope: 'classroom', description: 'تعریف تکلیف جدید و تعیین مهلت تحویل' },
  { id: 'p4', code: 'assignment:submit', name: 'ارسال پاسخ تکلیف', category: 'educational', scope: 'student', description: 'ارسال فایل یا متن پاسخ تکلیف توسط دانش‌آموز' },
  { id: 'p5', code: 'assignment:grade', name: 'نمره‌دهی و بازخورد تکالیف', category: 'educational', scope: 'classroom', description: 'ثبت نمره و بازخورد کیفی برای تکالیف' },
  { id: 'p6', code: 'exam:create', name: 'طراحی آزمون آنلاین و حضوری', category: 'educational', scope: 'classroom', description: 'طراحی سوالات تستی و تشریحی' },
  { id: 'p7', code: 'exam:take', name: 'شرکت در آزمون آنلاین', category: 'educational', scope: 'student', description: 'پاسخگویی به سوالات و ارسال آزمون' },
  { id: 'p8', code: 'exam:grade_essay', name: 'تصحیح سوالات تشریحی', category: 'educational', scope: 'classroom', description: 'ارزیابی و نمره‌دهی آزمون‌های تشریحی' },
  { id: 'p9', code: 'grades:view_own', name: 'مشاهده نمرات و کارنامه خود/فرزند', category: 'educational', scope: 'student', description: 'مشاهده نمرات کلاسی و کارنامه رسمی' },
  { id: 'p10', code: 'grades:manage', name: 'مدیریت و تأیید نمرات مدرسه', category: 'educational', scope: 'school', description: 'بررسی و صدور کارنامه‌های نهایی' },

  // Administrative & Management
  { id: 'p11', code: 'school:manage_settings', name: 'تنظیمات کلی مدرسه', category: 'administrative', scope: 'school', description: 'ویرایش مشخصات مدرسه، سال تحصیلی و تقویم' },
  { id: 'p12', code: 'users:manage', name: 'مدیریت کاربران و انتساب نقش', category: 'administrative', scope: 'school', description: 'افزودن کاربر، تغییر نقش و تعیین محدوده' },
  { id: 'p13', code: 'classes:manage', name: 'مدیریت کلاس‌ها و تخصیص معلم', category: 'administrative', scope: 'school', description: 'تعریف کلاس‌ها و تخصیص دبیران' },
  { id: 'p14', code: 'announcements:create', name: 'انتشار اطلاعیه رسمی', category: 'administrative', scope: 'school', description: 'ارسال اطلاعیه عمومی به مخاطبان' },
  { id: 'p15', code: 'audit:view', name: 'مشاهده تاریخچه حساس (Audit)', category: 'administrative', scope: 'school', description: 'بررسی تغییرات نمرات، حضور و غیاب و مجوزها' },

  // Family, Custody & Pickup
  { id: 'p16', code: 'family:manage_links', name: 'مدیریت روابط ولی و دانش‌آموز', category: 'family', scope: 'school', description: 'تأیید مدارک، تفکیک والدین جداشده و نظارت بر حضانت' },
  { id: 'p17', code: 'family:enforce_restrictions', name: 'ثبت و اعمال محدودیت قضایی', category: 'family', scope: 'school', description: 'ثبت احکام دادگاه خانواده و سلب دسترسی' },
  { id: 'p18', code: 'pickup:manage', name: 'مدیریت افراد مجاز تحویل', category: 'family', scope: 'student', description: 'تعریف و تأیید اشخاص مجاز ترخیص فیزیکی' },
  { id: 'p19', code: 'consent:sign', name: 'امضا و تأیید رضایت‌نامه‌ها', category: 'family', scope: 'guardian_link', description: 'تأیید اردوها و فعالیت‌های مدرسه' },

  // Counseling & Wellbeing
  { id: 'p20', code: 'counseling:book', name: 'درخواست و رزرو وقت مشاوره', category: 'counseling', scope: 'student', description: 'رزرو جلسات مشاوره تحصیلی یا فردی' },
  { id: 'p21', code: 'counseling:manage_sessions', name: 'مدیریت جلسات مشاوره', category: 'counseling', scope: 'school', description: 'مشاهده پرونده ارجاعی و ثبت خلاصه جلسه' },
  { id: 'p22', code: 'counseling:confidential_notes', name: 'ثبت یادداشت‌های کاملاً محرمانه', category: 'counseling', scope: 'school', description: 'پرونده‌های روانشناختی با حفاظت اختصاصی' },

  // PTA (Parents Council)
  { id: 'p23', code: 'pta:manage', name: 'مدیریت نشست‌ها و مصوبات انجمن', category: 'administrative', scope: 'school', description: 'ثبت صورتجلسات و پیگیری مصوبات' },
  { id: 'p24', code: 'pta:vote', name: 'شرکت در نظرسنجی و ثبت رأی', category: 'administrative', scope: 'school', description: 'ثبت آرا در نظرسنجی‌های انجمن اولیا' },
  { id: 'p25', code: 'pta:submit_feedback', name: 'ثبت پیشنهاد و انتقاد به مدرسه', category: 'administrative', scope: 'school', description: 'ارسال بازخورد مستقیم اولیا به مدیریت' },

  // Operations & Transport
  { id: 'p26', code: 'transport:log_attendance', name: 'ثبت سوار و پیاده شدن سرویس', category: 'system', scope: 'classroom', description: 'ثبت تردد دانش‌آموزان در مسیر سرویس' },
  { id: 'p27', code: 'security:log_entry', name: 'ثبت تردد فیزیکی گیت مدرسه', category: 'system', scope: 'school', description: 'ثبت ورود و خروج توسط حراست' },
  { id: 'p28', code: 'proctor:monitor_exam', name: 'مراقبت جلسه آزمون', category: 'educational', scope: 'classroom', description: 'ثبت وقایع جلسه آزمون بدون دسترسی به پرونده شخصی' },

  // Platform
  { id: 'p29', code: 'platform:manage_schools', name: 'مدیریت کلان مدارس کشور', category: 'system', scope: 'platform', description: 'مدیریت لایسنس و ایجاد واحدهای آموزشی' },
  { id: 'p30', code: 'platform:support_diagnostics', name: 'عیب‌یابی سیستمی بدون دسترسی نمرات', category: 'system', scope: 'platform', description: 'بررسی لاگ‌های خطای نرم‌افزاری' },

  // Online Classes & Virtual Classroom
  { id: 'p31', code: 'online_class:view', name: 'مشاهده برنامه کلاس‌های آنلاین', category: 'educational', scope: 'school', description: 'مشاهده برنامه جلسات و اطلاعات کلاس‌های آنلاین' },
  { id: 'p32', code: 'online_class:join', name: 'ورود به جلسه آنلاین زنده', category: 'educational', scope: 'student', description: 'ورود به اتاق جلسه و شرکت در کلاس برخط' },
  { id: 'p33', code: 'online_class:create', name: 'ایجاد و زمان‌بندی کلاس آنلاین', category: 'educational', scope: 'classroom', description: 'ایجاد جلسه، تعیین ساعت و افزودن منابع' },
  { id: 'p34', code: 'online_class:manage', name: 'مدیریت جلسه زنده و شرکت‌کنندگان', category: 'educational', scope: 'classroom', description: 'کنترل میکروفون، اتمام جلسه و نظارت بر دسترسی‌ها' },
  { id: 'p35', code: 'online_class:record_manage', name: 'مدیریت و مشاهده ضبط‌ها و منابع', category: 'educational', scope: 'school', description: 'دسترسی به فایل ضبط‌شده و منابع آموزشی منتشرشده' },
];

export const BASE_ROLES: Role[] = [
  // 1. Platform Admin
  {
    id: 'platform_super_admin',
    name: 'Platform Super Admin',
    persianTitle: 'مدیر کل پلتفرم',
    group: 'platform',
    description: 'مدیریت واحدهای آموزشی و الگوهای مجوز (فاقد دسترسی به نمرات و پرونده‌های شخصی دانش‌آموز)',
    defaultScope: 'platform',
    allowedPermissions: ['platform:manage_schools', 'announcements:create'],
  },
  // 2. Tech Support
  {
    id: 'platform_tech_support',
    name: 'Technical Support',
    persianTitle: 'پشتیبان فنی پلتفرم',
    group: 'platform',
    description: 'بررسی خطاهای فنی سامانه و تیکت‌ها',
    defaultScope: 'platform',
    allowedPermissions: ['platform:support_diagnostics'],
  },
  // 3. Principal
  {
    id: 'school_principal',
    name: 'School Principal',
    persianTitle: 'مدیر مدرسه',
    group: 'school_admin',
    description: 'دسترسی کامل مدیریتی به واحد آموزشی، انتساب نقش‌ها، نظارت بر عملکرد و بررسی رویدادهای حساس',
    defaultScope: 'school',
    allowedPermissions: [
      'school:manage_settings', 'users:manage', 'classes:manage', 'announcements:create',
      'audit:view', 'family:manage_links', 'family:enforce_restrictions', 'grades:manage',
      'attendance:view', 'pta:manage', 'consent:sign',
      'online_class:view', 'online_class:create', 'online_class:manage', 'online_class:record_manage'
    ],
  },
  // 4. Educational Deputy
  {
    id: 'educational_deputy',
    name: 'Educational Deputy',
    persianTitle: 'معاون آموزشی',
    group: 'school_admin',
    description: 'مدیریت تقویم آموزشی، کلاس‌ها، نظارت بر تکالیف و صدور کارنامه‌ها',
    defaultScope: 'school',
    allowedPermissions: [
      'classes:manage', 'grades:manage', 'exam:create', 'assignment:create', 'announcements:create', 'attendance:view',
      'online_class:view', 'online_class:create', 'online_class:manage', 'online_class:record_manage'
    ],
  },
  // 5. Disciplinary Deputy
  {
    id: 'disciplinary_deputy',
    name: 'Disciplinary Deputy',
    persianTitle: 'معاون پرورشی و انضباطی',
    group: 'school_admin',
    description: 'نظارت بر انضباط، غیبت‌ها، تأخیرها، و امور تربیتی دانش‌آموزان',
    defaultScope: 'school',
    allowedPermissions: ['attendance:view', 'attendance:record', 'announcements:create', 'counseling:book'],
  },
  // 6. Attendance Supervisor / Nazem
  {
    id: 'attendance_supervisor',
    name: 'Attendance Supervisor',
    persianTitle: 'ناظم / مسئول حضور و غیاب',
    group: 'school_admin',
    description: 'بررسی و اصلاح مستند حضور و غیاب کلاس‌ها، پیگیری غیبت‌های غیرموجه و گزارش پیامک‌ها',
    defaultScope: 'school',
    allowedPermissions: ['attendance:view', 'attendance:record', 'audit:view'],
  },
  // 7. Teacher
  {
    id: 'teacher',
    name: 'Teacher',
    persianTitle: 'دبیر / معلم',
    group: 'faculty',
    description: 'ثبت حضور و غیاب، تعریف تکالیف، برگزاری آزمون و نمره‌دهی به دانش‌آموزان کلاس‌های خود',
    defaultScope: 'classroom',
    allowedPermissions: [
      'attendance:view', 'attendance:record', 'assignment:create', 'assignment:grade',
      'exam:create', 'exam:grade_essay', 'grades:view_own',
      'online_class:view', 'online_class:create', 'online_class:manage', 'online_class:record_manage'
    ],
  },
  // 8. Substitute Teacher
  {
    id: 'substitute_teacher',
    name: 'Substitute Teacher',
    persianTitle: 'معلم جایگزین / مدعو',
    group: 'faculty',
    description: 'دسترسی موقت و زمان‌دار برای تدریس و ثبت نمرات کلاسی خاص',
    defaultScope: 'classroom',
    allowedPermissions: ['attendance:record', 'assignment:grade'],
  },
  // 9. Essay Grader
  {
    id: 'essay_grader',
    name: 'Essay Grader',
    persianTitle: 'مصحح آزمون تشریحی',
    group: 'faculty',
    description: 'ارزیابی پاسخ‌برگ‌های تشریحی بدون دسترسی به سایر سوابق آموزشی و خانوادگی دانش‌آموز',
    defaultScope: 'classroom',
    allowedPermissions: ['exam:grade_essay'],
  },
  // 10. Exam Proctor
  {
    id: 'exam_proctor',
    name: 'Exam Proctor',
    persianTitle: 'مراقب آزمون',
    group: 'faculty',
    description: 'نظارت بر ورود به جلسه آزمون و ثبت صورت‌جلسه تخلف یا تاخیر',
    defaultScope: 'classroom',
    allowedPermissions: ['proctor:monitor_exam'],
  },
  // 11. Intern Teacher
  {
    id: 'intern_teacher',
    name: 'Intern Teacher',
    persianTitle: 'کارورز آموزشی',
    group: 'faculty',
    description: 'دسترسی مشاهده‌ای محدود جهت یادگیری تجارب تدریس',
    defaultScope: 'classroom',
    allowedPermissions: ['attendance:view'],
  },
  // 12. Academic Counselor
  {
    id: 'academic_counselor',
    name: 'Academic Counselor',
    persianTitle: 'مشاور تحصیلی',
    group: 'support',
    description: 'بررسی پیشرفت تحصیلی مراجعین، زمان‌بندی جلسات مشاوره و ثبت برنامه‌های مطالعاتی',
    defaultScope: 'student',
    allowedPermissions: ['counseling:manage_sessions', 'grades:view_own', 'attendance:view'],
  },
  // 13. School Psychologist
  {
    id: 'school_psychologist',
    name: 'School Psychologist',
    persianTitle: 'روانشناس و مددکار مدرسه',
    group: 'support',
    description: 'ثبت پرونده‌های مشاوره فردی و یادداشت‌های بالینی با سطح محرمانگی بالا',
    defaultScope: 'student',
    allowedPermissions: ['counseling:manage_sessions', 'counseling:confidential_notes'],
  },
  // 14. Health Officer
  {
    id: 'health_officer',
    name: 'Health Officer',
    persianTitle: 'مسئول بهداشت مدرسه',
    group: 'support',
    description: 'پیگیری پرونده سلامت، موارد حساسیت و ارجاعات پزشکی دانش‌آموزان',
    defaultScope: 'school',
    allowedPermissions: ['attendance:view'],
  },
  // 15. School Registrar
  {
    id: 'school_registrar',
    name: 'School Registrar',
    persianTitle: 'مسئول دفتر و ثبت‌نام',
    group: 'operations',
    description: 'ثبت‌نام، راستی‌آزمایی مدارک والدین و دانش‌آموزان، مدیریت پیوندهای خانوادگی و گواهی‌ها',
    defaultScope: 'school',
    allowedPermissions: ['family:manage_links', 'family:enforce_restrictions', 'pickup:manage', 'users:manage'],
  },
  // 16. Support Desk
  {
    id: 'school_support_desk',
    name: 'School Support Desk',
    persianTitle: 'پشتیبان سامانه مدرسه',
    group: 'operations',
    description: 'راهنمایی اولیا و دانش‌آموزان و رفع مشکلات بازیابی رمز بدون دسترسی به نمرات',
    defaultScope: 'school',
    allowedPermissions: ['announcements:create'],
  },
  // 17. Security Guard
  {
    id: 'security_guard',
    name: 'Security Officer',
    persianTitle: 'مسئول حراست و تردد',
    group: 'operations',
    description: 'بررسی مجوزهای تحویل فیزیکی دانش‌آموز و ثبت تردد گیت خروجی',
    defaultScope: 'school',
    allowedPermissions: ['security:log_entry', 'pickup:manage'],
  },
  // 18. School Bus Driver
  {
    id: 'bus_driver',
    name: 'School Bus Driver',
    persianTitle: 'راننده سرویس مدرسه',
    group: 'operations',
    description: 'مشاهده لیست دانش‌آموزان ایستگاه‌های خط مربوطه و ثبت سوار و پیاده شدن',
    defaultScope: 'classroom',
    allowedPermissions: ['transport:log_attendance'],
  },
  // 19. Parent / Guardian
  {
    id: 'guardian',
    name: 'Parent / Guardian',
    persianTitle: 'ولی / والد دانش‌آموز',
    group: 'family',
    description: 'مشاهده نمرات، تکالیف و غیبت‌های فرزند، رزرو مشاوره، شرکت در جلسات انجمن و دریافت پیامک',
    defaultScope: 'guardian_link',
    allowedPermissions: [
      'grades:view_own', 'attendance:view', 'counseling:book', 'consent:sign',
      'pta:vote', 'pta:submit_feedback', 'pickup:manage', 'online_class:view'
    ],
  },
  // 20. Legal Guardian
  {
    id: 'legal_guardian',
    name: 'Legal Guardian',
    persianTitle: 'سرپرست قانونی',
    group: 'family',
    description: 'سرپرست حقوقی دارای حکم سرپرستی معتبر با کلیه اختیارات آموزشی و اداری',
    defaultScope: 'guardian_link',
    allowedPermissions: [
      'grades:view_own', 'attendance:view', 'counseling:book', 'consent:sign',
      'pta:vote', 'pta:submit_feedback', 'pickup:manage', 'online_class:view'
    ],
  },
  // 21. Temporary Delegate
  {
    id: 'temporary_delegate',
    name: 'Temporary Delegate',
    persianTitle: 'نماینده / ولی موقت',
    group: 'family',
    description: 'نماینده دارای وکالت‌نامه مدت‌دار با انقضای خودکار دسترسی پس از موعد معین',
    defaultScope: 'guardian_link',
    allowedPermissions: ['attendance:view', 'counseling:book'],
  },
  // 22. Authorized Pickup Person
  {
    id: 'pickup_authorized_person',
    name: 'Authorized Pickup Person',
    persianTitle: 'فرد مجاز تحویل دانش‌آموز',
    group: 'family',
    description: 'فقط مجاز به تحویل گرفتن فیزیکی دانش‌آموز در درب مدرسه (فاقد هرگونه دسترسی به کارنامه یا پیام‌ها)',
    defaultScope: 'student',
    allowedPermissions: [],
  },
  // 23. Active Student
  {
    id: 'active_student',
    name: 'Active Student',
    persianTitle: 'دانش‌آموز فعال',
    group: 'student',
    description: 'ارسال تکالیف، شرکت در آزمون آنلاین، مشاهده نمرات، حضور و غیاب و درخواست مشاوره',
    defaultScope: 'student',
    allowedPermissions: ['assignment:submit', 'exam:take', 'grades:view_own', 'attendance:view', 'counseling:book', 'online_class:view', 'online_class:join'],
  },
  // 24. Guest Student
  {
    id: 'guest_student',
    name: 'Guest Student',
    persianTitle: 'دانش‌آموز مهمان یا انتقالی',
    group: 'student',
    description: 'دانش‌آموز دوره‌های موقت با دسترسی محدود به کلاس تعیین‌شده',
    defaultScope: 'student',
    allowedPermissions: ['assignment:submit', 'exam:take', 'grades:view_own', 'online_class:view', 'online_class:join'],
  },
  // 25. Alumnus
  {
    id: 'alumnus_student',
    name: 'Alumnus',
    persianTitle: 'دانش‌آموز فارغ‌التحصیل',
    group: 'student',
    description: 'دسترسی آرشیو به کارنامه‌های ادوار گذشته و گواهی‌های صادرشده',
    defaultScope: 'student',
    allowedPermissions: ['grades:view_own'],
  },
  // 26. PTA President
  {
    id: 'pta_president',
    name: 'PTA President',
    persianTitle: 'رئیس انجمن اولیا و مربیان',
    group: 'pta',
    description: 'برگزاری جلسات ماهانه انجمن اولیا، ثبت مصوبات، راه‌اندازی نظرسنجی‌ها و پیگیری درخواست‌های والدین',
    defaultScope: 'school',
    allowedPermissions: ['pta:manage', 'pta:vote', 'pta:submit_feedback', 'announcements:create'],
  },
  // 27. PTA Class Representative
  {
    id: 'pta_class_rep',
    name: 'PTA Class Representative',
    persianTitle: 'نماینده کلاس در انجمن اولیا',
    group: 'pta',
    description: 'هماهنگی مطالبات والدین کلاس با هیئت مدیره انجمن اولیا',
    defaultScope: 'classroom',
    allowedPermissions: ['pta:vote', 'pta:submit_feedback'],
  },
  // 28. PTA Member
  {
    id: 'pta_member',
    name: 'PTA Member',
    persianTitle: 'عضو انجمن اولیا',
    group: 'pta',
    description: 'مشارکت در جلسات، نظرسنجی‌ها و ارائه نظرات مشورتی به مدیریت',
    defaultScope: 'school',
    allowedPermissions: ['pta:vote', 'pta:submit_feedback'],
  },
  // 29. Ministry Inspector
  {
    id: 'ministry_inspector',
    name: 'Ministry Inspector',
    persianTitle: 'بازرس آموزش و پرورش',
    group: 'external',
    description: 'دسترسی نظارتی فقط‌خواندنی به شاخص‌های کلان مدرسه در بازه ماموریت بازرسی',
    defaultScope: 'school',
    allowedPermissions: ['attendance:view', 'grades:manage', 'audit:view'],
  },
  // 30. Guest
  {
    id: 'external_guest',
    name: 'Guest',
    persianTitle: 'مهمان عمومی',
    group: 'external',
    description: 'مشاهده صفحه عمومی مدرسه و پورتال معرفی',
    defaultScope: 'school',
    allowedPermissions: [],
  },
];

/**
 * Checks whether a given role holds a specific permission code.
 */
export function hasPermission(role: Role, permissionCode: string): boolean {
  return role.allowedPermissions.includes(permissionCode);
}
