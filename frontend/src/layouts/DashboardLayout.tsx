import React, { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, CheckSquare, FileText, Award,
  Sparkles, HeartHandshake, Users, Megaphone, ShieldCheck,
  UserCog, Settings, Menu, X, ClipboardList, Send,
  Layers, Clock, ShieldAlert, Bus, Video, CheckCircle2, Lock, Building2, Printer,
  LogOut, GraduationCap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GuestPanelPage } from '../pages/GuestPanelPage';
import { SchoolLogo, Badge, Modal, Button } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { ALL_PERMISSIONS } from '../permissions';
import { DashboardHeader } from './DashboardHeader';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentUser, activeRole, activeAssignment, hasAccess,
    isAuthenticated, isSessionLoading, needsRole, activeSchoolName,
    logout,
  } = useAuth();
  const location = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [schoolSwitched] = useState(() => {
    const flag = sessionStorage.getItem('mashahir_school_switched') === '1';
    if (flag) sessionStorage.removeItem('mashahir_school_switched');
    return flag;
  });

  // Dynamic role-tailored navigation items
  const isPlatformAdmin = activeRole.group === 'platform' || activeRole.id === 'platform_super_admin' || currentUser.id === 'usr_platform_admin';
  const isFamily = activeRole.group === 'family';
  const isStudent = activeRole.group === 'student';
  const isAdmin = activeRole.group === 'school_admin' || activeRole.group === 'platform';
  const isFaculty = activeRole.group === 'faculty';
  const isTeacher = activeRole.id === 'teacher' || isFaculty;
  const isBusDriver = activeRole.id === 'bus_driver';
  const isOps = activeRole.group === 'operations';

  interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    show: boolean;
    badge?: string;
  }

  interface NavGroup {
    title: string;
    items: NavItem[];
  }

  // Sections a role cannot touch are REMOVED from navigation — no dead
  // links, no access-error pages. Phase-2 pages without a backend module
  // map to null (hidden until the module ships).
  const NAV_PERMISSIONS: Record<string, string | string[] | null> = {
    '/announcements': 'announcements:view',
    '/attendance': 'attendance:view',
    '/assignments': 'assignments:view',
    '/exams': 'exams:results_view',
    '/essay-grading': 'exams:grade_descriptive',
    '/report-card': 'reportcards:view',
    '/grade-entry': 'grades:record',
    '/consent-forms': 'consents:view_results',
    '/user-management': 'users:view',
    '/roles-permissions': 'roles:manage',
    '/audit-logs': 'audit:view',
    '/family-management': 'guardian_links:view',
    '/pre-registrations': 'preregistrations:view',
    '/settings': 'schools:settings',
    '/create-school': 'schools:manage',
    '/transport': ['transport:manage', 'transport:view', 'transport:board'],
    '/online-classes': 'online_classes:view',
    // Monthly report-card cycle: the principal opens periods, the teacher
    // fills and submits his own. Each page also gates itself.
    '/report-cycle-admin': ['report_periods:manage', 'report_periods:review', 'report_periods:finalize'],
    '/report-card-print': 'reportcards:export_pdf',
    '/my-report-cycle': ['report_periods:record', 'report_periods:view'],
    // Classroom structure: rosters, teacher assignment, weekly timetable.
    '/classrooms': 'academic:view',
    // Shipped from live grade data; every viewer of the report also holds one
    // of these codes (learners get reportcards.view, staff get grades.*).
    '/performance-analytics': ['grades:view', 'grades:record', 'reportcards:view'],
    '/counseling': ['counseling:view', 'counseling:request', 'counseling:manage'],
    '/pta': ['pta:view', 'pta:manage', 'pta:vote'],
  };

  const itemAllowed = (href: string, show: boolean): boolean => {
    if (!show) return false;
    if (!(href in NAV_PERMISSIONS)) return true;
    const perm = NAV_PERMISSIONS[href];
    if (perm === null) return false;
    return (Array.isArray(perm) ? perm : [perm]).some((code) => hasAccess(code));
  };

  // Mandatory login + guest panel: no anonymous dashboards, and a role-less
  // account never reaches data screens.
  if (isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6FA] dark:bg-[#0A111D]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-[#2457C5] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[#526176] dark:text-[#7C8CA5]">در حال آماده‌سازی پیشخوان…</span>
        </div>
      </div>
    );
  }

  if (needsRole) {
    return <GuestPanelPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const navGroups: NavGroup[] = [
    {
      title: 'پیشخوان و اعلانات',
      items: [
        {
          label: 'داشبورد کاربری',
          href: '/dashboard',
          icon: <LayoutDashboard size={17} />,
          show: true,
        },
        {
          label: 'اطلاعیه‌ها و بخشنامه‌ها',
          href: '/announcements',
          icon: <Megaphone size={17} />,
          show: true,
        },
      ],
    },
    {
      title: 'آموزش و یادگیری',
      items: [
        {
          label: isStudent ? 'کلاس‌های آنلاین من' : isTeacher ? 'کلاس‌های آنلاین و جلسات' : 'کلاس‌های آنلاین مدرسه',
          href: '/online-classes',
          icon: <Video size={17} />,
          show: !isBusDriver && hasAccess('online_classes:view'),
          badge: isTeacher ? 'زنده' : hasAccess('online_classes:manage') ? 'مدیریت' : undefined,
        },
        {
          label: isFamily ? 'حضور و غیاب فرزند' : isStudent ? 'حضور و غیاب من' : isTeacher ? 'حضور و غیاب کلاس‌ها' : 'حضور و غیاب مدرسه',
          href: '/attendance',
          icon: <CheckSquare size={17} />,
          show: !isBusDriver && (hasAccess('attendance:record') || hasAccess('attendance:view') || isFamily || isStudent || isAdmin),
        },
        {
          label: isFamily ? 'تکالیف درسی فرزند' : isStudent ? 'تکالیف و ارسال پاسخ' : isTeacher ? 'تکالیف و تصحیح' : 'تکالیف درسی کلاسی',
          href: '/assignments',
          icon: <BookOpen size={17} />,
          show: !isBusDriver && (hasAccess('assignments:view') || hasAccess('submissions:submit')),
        },
        {
          label: isStudent ? 'آزمون‌های آنلاین من' : isTeacher ? 'آزمون‌های من / طراحی آزمون' : 'بانک و آزمون‌های آنلاین',
          href: '/exams',
          icon: <FileText size={17} />,
          show: !isBusDriver && (hasAccess('exams:results_view') || hasAccess('exams:take') || hasAccess('exams:manage')),
        },
        {
          label: 'تصحیح آزمون تشریحی',
          href: '/essay-grading',
          icon: <CheckSquare size={17} />,
          show: !isBusDriver && hasAccess('exams:grade_descriptive'),
          badge: 'مصحح',
        },
        {
          // Classroom structure: rosters, teacher assignment, weekly timetable.
          label: 'کلاس‌ها و برنامهٔ هفتگی',
          href: '/classrooms',
          icon: <Layers size={17} />,
          show: !isBusDriver && !isFamily && !isStudent && hasAccess('academic:view'),
        },
        {
          // A teacher's grade book is دفتر نمره (/grade-entry); the report-card
          // page is the learner/family view of published cards.
          label: isFamily ? 'کارنامه تحصیلی فرزند' : isStudent ? 'کارنامه تحصیلی من' : 'کارنامه‌های تحصیلی',
          href: '/report-card',
          icon: <Award size={17} />,
          show: !isBusDriver && !isTeacher && (hasAccess('reportcards:view') || isFamily || isStudent),
        },
        {
          label: 'ثبت نمرات کلاس',
          href: '/grade-entry',
          icon: <CheckCircle2 size={17} />,
          show: !isBusDriver && !isFamily && !isStudent && (isTeacher || hasAccess('grades:record')),
        },
        {
          label: isTeacher ? 'کارنامه ماهانه من' : 'ثبت کارنامه معلمان',
          href: '/my-report-cycle',
          icon: <Send size={17} />,
          show: !isBusDriver && !isFamily && !isStudent && (hasAccess('report_periods:record') || hasAccess('report_periods:view')),
        },
        {
          label: 'دوره کارنامه ماهانه',
          href: '/report-cycle-admin',
          icon: <ClipboardList size={17} />,
          show: isAdmin,
          badge: isAdmin ? 'مدیریت' : undefined,
        },
        {
          // The bulk console is a staff tool: learners hold export_pdf for
          // their own card's print button, not for this page.
          label: 'چاپ گروهی کارنامه',
          href: '/report-card-print',
          icon: <Printer size={17} />,
          show: !isBusDriver && !isFamily && !isStudent && hasAccess('reportcards:export_pdf'),
        },
        {
          label: isTeacher ? 'تحلیل پیشرفت دانش‌آموزان' : isFamily ? 'تحلیل تحصیلی فرزند' : 'تحلیل هوشمند عملکرد',
          href: '/performance-analytics',
          icon: <Sparkles size={17} />,
          show: !isBusDriver && activeRole.id !== 'security_guard' && (hasAccess('grades:view') || hasAccess('reportcards:view') || isAdmin || isFaculty),
        },
      ],
    },
    {
      title: 'امور پرورشی و اولیا',
      items: [
        {
          label: isFamily ? 'رزرو وقت مشاوره' : isStudent ? 'مشاوره و هدایت تحصیلی' : 'مشاوره و هدایت تحصیلی',
          href: '/counseling',
          icon: <HeartHandshake size={17} />,
          show: !isBusDriver && (hasAccess('counseling:view') || hasAccess('counseling:request') || hasAccess('counseling:manage')),
        },
        {
          label: 'انجمن اولیا و مربیان',
          href: '/pta',
          icon: <Users size={17} />,
          show: !isBusDriver && !isStudent && (hasAccess('pta:view') || hasAccess('pta:manage') || hasAccess('pta:vote') || isFamily || activeRole.group === 'pta' || isAdmin),
        },
        {
          label: isFamily ? 'رضایت‌نامه‌ها و اردوها' : 'رضایت‌نامه‌ها و گزارش اردوها',
          href: '/consent-forms',
          icon: <ShieldCheck size={17} />,
          show: !isBusDriver && (isFamily || isAdmin || isFaculty || activeRole.id === 'educational_deputy' || activeRole.id === 'disciplinary_deputy'),
          badge: isFamily ? 'تایید اولیا' : 'گزارش اردو',
        },
      ],
    },
    {
      title: 'مدیریت، حقوقی و نظارت',
      items: [
        {
          label: isBusDriver ? 'سرویس‌های من و تردد خط' : activeRole.id === 'security_guard' ? 'استعلام و کنترل گیت خروج' : activeRole.id === 'essay_grader' || activeRole.id === 'exam_proctor' ? 'پنل مراقبت آزمون' : 'پنل نقش‌های اجرایی و گیت',
          href: '/transport',
          icon: <Bus size={17} />,
          show: isBusDriver,
          badge: isBusDriver ? 'راننده' : activeRole.id === 'security_guard' ? 'حراست' : undefined,
        },
        {
          label: 'سرویس مدرسه — خطوط و ایستگاه‌ها',
          href: '/transport',
          icon: <Bus size={17} />,
          show: !isBusDriver && (hasAccess('transport:manage') || hasAccess('transport:view')),
        },
        {
          label: 'ارتباطات خانوادگی و حضانت',
          href: '/family-management',
          icon: <ShieldAlert size={17} />,
          show: !isBusDriver && !isStudent && !isFamily && (isAdmin || activeRole.id === 'school_registrar'),
          badge: 'ویژه حقوقی',
        },
        {
          label: 'پیش‌ثبت‌نام‌های پذیرش',
          href: '/pre-registrations',
          icon: <ClipboardList size={17} />,
          show: !isBusDriver && (isAdmin || hasAccess('preregistrations:view')),
          badge: 'پذیرش',
        },
        {
          label: 'تأسیس واحد آموزشی (ویزارد)',
          href: '/create-school',
          icon: <Building2 size={17} />,
          show: isPlatformAdmin,
          badge: 'مدیر کل',
        },
        {
          label: 'مدیریت مدارس، کادر و کاربران',
          href: '/user-management',
          icon: <UserCog size={17} />,
          show: isAdmin || activeRole.id === 'educational_deputy' || activeRole.id === 'disciplinary_deputy' || activeRole.id === 'school_principal' || activeRole.id === 'platform_super_admin' || hasAccess('users:manage'),
          badge: activeRole.id === 'educational_deputy' ? 'معاونت' : undefined,
        },
        {
          label: 'نقش‌ها و دسترسی‌ها',
          href: '/roles-permissions',
          icon: <Layers size={17} />,
          show: isAdmin,
        },
        {
          label: 'تاریخچه حساس (Audit)',
          href: '/audit-logs',
          icon: <Clock size={17} />,
          show: isAdmin || activeRole.id === 'ministry_inspector',
        },
        {
          label: 'تنظیمات سامانه',
          href: '/settings',
          icon: <Settings size={17} />,
          show: isAdmin,
        },
      ],
    },
  ];

  const groupsWithContent = navGroups
    .map((group) => ({ ...group, items: group.items.filter((it) => itemAllowed(it.href, it.show)) }))
    .filter((group) => group.items.length > 0);

  /** One nav renderer for the desktop rail and the mobile drawer. */
  const renderNav = (onNavigate?: () => void) => (
    <div className="space-y-5">
      {groupsWithContent.map((group) => (
        <div key={group.title}>
          <p className="text-[10px] font-bold text-[#8CA0BC] dark:text-[#5E7391] px-3 pb-1.5 tracking-wide">
            {group.title}
          </p>
          <nav className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all select-none',
                    isActive
                      ? 'bg-[#2457C5] text-white shadow-sm shadow-[#2457C5]/30 dark:bg-[#2457C5] dark:text-white'
                      : 'text-[#526176] dark:text-[#AFC0D6] hover:bg-[#EEF2F9] dark:hover:bg-[#16202F] hover:text-[#202B3C] dark:hover:text-white',
                  )}
                >
                  {/* active accent — a thin bar hugging the inline-start edge */}
                  <span
                    className={cn(
                      'absolute inset-y-1.5 -right-3 w-1 rounded-full transition-opacity',
                      isActive ? 'bg-[#2457C5] dark:bg-[#8BAEFF] opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        'shrink-0 transition-colors',
                        isActive
                          ? 'text-white dark:text-[#8BAEFF]'
                          : 'text-[#8CA0BC] dark:text-[#5E7391] group-hover:text-[#2457C5] dark:group-hover:text-[#8BAEFF]',
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && (
                    <span
                      className={cn(
                        'shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-bold',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );

  const brandBlock = (
    <Link to="/dashboard" className="flex items-center gap-3 px-1 select-none group">
      <div className="relative shrink-0">
        <SchoolLogo size={40} />
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#0D1523] rounded-full" />
      </div>
      <div className="min-w-0 text-right">
        <span className="text-[15px] font-black text-[#2457C5] dark:text-[#8BAEFF] tracking-tight block leading-tight">
          مشاهیر آینده
        </span>
        <span className="text-[10px] text-[#8CA0BC] dark:text-[#5E7391] font-medium block truncate">
          {activeSchoolName ?? 'سامانه جامع آموزشی'}
        </span>
      </div>
    </Link>
  );

  const userCard = (
    <div className="mx-1 rounded-2xl bg-[#F4F7FC] dark:bg-[#141E30] border border-[#E3EAF4] dark:border-[#1E2A3D] p-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2457C5] to-[#173B8F] text-white dark:from-[#8BAEFF] dark:to-[#5F86D9] dark:text-[#0D1523] flex items-center justify-center font-black text-sm shrink-0">
          {currentUser.fullName.slice(0, 1)}
        </div>
        <div className="overflow-hidden text-right">
          <p className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] truncate">{currentUser.fullName}</p>
          <p className="text-[10px] text-[#526176] dark:text-[#B3C0D2] truncate flex items-center gap-1">
            <GraduationCap size={11} className="shrink-0" />
            {activeRole.persianTitle}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#F4F6FA] dark:bg-[#0A111D] text-[#202B3C] dark:text-[#F1F5FB]">
      {schoolSwitched && (
        <div className="bg-emerald-600 dark:bg-emerald-700 text-white text-xs font-bold text-center py-2 px-4 shrink-0">
          ورود به {activeSchoolName ?? 'واحد آموزشی جدید'} انجام شد — داده‌ها برای این مدرسه بارگذاری شدند.
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* ── Desktop rail (RTL: hugs the right edge, full height) ── */}
        <aside className="hidden lg:flex flex-col w-[272px] shrink-0 h-full bg-white dark:bg-[#0D1523] border-l border-[#E3EAF4] dark:border-[#1B2739]">
          <div className="px-4 pt-5 pb-4 shrink-0">{brandBlock}</div>
          <div className="px-3 pb-3 shrink-0">{userCard}</div>
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 pb-4">{renderNav()}</div>
          <div className="shrink-0 px-3 pb-4 pt-3 border-t border-[#EEF2F9] dark:border-[#1B2739] flex items-center justify-end gap-2">
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#8CA0BC] dark:text-[#7C8CA5] hover:text-rose-600 dark:hover:text-rose-400 px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <LogOut size={13} /> خروج
            </button>
          </div>
        </aside>

        {/* ── Main column: header on top, content scrolls under it ── */}
        <div className="flex-1 min-w-0 h-full flex flex-col">
          <div className="shrink-0 bg-white/85 dark:bg-[#0C1424]/85 backdrop-blur-xl border-b border-[#E3EAF4] dark:border-[#1B2739]">
            <DashboardHeader onToggleMobileMenu={() => setIsMobileMenuOpen(true)} />
          </div>
          <main className="flex-1 min-h-0 overflow-y-auto scroll-smooth">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10">
              {children}
            </div>
            <footer className="border-t border-[#E9EEF5] dark:border-[#16202F] py-5 px-4 text-center text-[11px] text-[#8CA0BC] dark:text-[#5E7391]">
              <div className="max-w-7xl mx-auto">
                <p>© سال تحصیلی ۱۴۰۵-۱۴۰۶ — مجتمع آموزشی مشاهیر آینده</p>
              </div>
            </footer>
          </main>
        </div>
      </div>

      {/* ── Mobile drawer: same rail content, edge-to-edge ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative z-10 w-[290px] max-w-[86%] h-full bg-white dark:bg-[#0D1523] shadow-2xl flex flex-col border-l border-[#E3EAF4] dark:border-[#1B2739]">
            <div className="px-4 pt-5 pb-3 flex items-center justify-between shrink-0">
              {brandBlock}
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#16202F] cursor-pointer"
                aria-label="بستن منو"
              >
                <X size={19} />
              </button>
            </div>
            <div className="px-3 pb-3 shrink-0">{userCard}</div>
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 pb-4">{renderNav(() => setIsMobileMenuOpen(false))}</div>
            <div className="shrink-0 px-3 pb-4 pt-3 border-t border-[#EEF2F9] dark:border-[#1B2739]">
              <button
                onClick={() => logout()}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <LogOut size={14} /> خروج از حساب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile floating dock: gliding indicator + icon pop ── */}
      {(() => {
        const tabs = [
          { href: '/dashboard', label: 'داشبورد', icon: <LayoutDashboard size={19} /> },
          ...(itemAllowed('/attendance', true) ? [{ href: '/attendance', label: 'حضور و غیاب', icon: <CheckSquare size={19} /> }] : []),
          ...(itemAllowed('/assignments', true) ? [{ href: '/assignments', label: 'تکالیف', icon: <BookOpen size={19} /> }] : []),
        ];
        const activeIdx = tabs.findIndex((t) => location.pathname === t.href);
        const slot = 100 / (tabs.length + 1); // +1 برای دکمهٔ منوی کامل
        return (
          <div className="lg:hidden fixed bottom-3 left-3 right-3 z-40 animate-in slide-in-from-bottom-6 fade-in duration-700">
            <div className="relative bg-white/92 dark:bg-[#0C1424]/95 backdrop-blur-xl border border-[#E3EAF4] dark:border-[#1B2739] rounded-[24px] shadow-xl shadow-black/10 dark:shadow-black/50 px-1.5 py-1.5 flex items-stretch">
              {/* gliding pill — springs to the active tab */}
              {activeIdx >= 0 && (
                <span
                  aria-hidden
                  className="absolute top-1.5 bottom-1.5 rounded-2xl bg-[#2457C5]/10 dark:bg-[#8BAEFF]/10 border border-[#2457C5]/20 dark:border-[#8BAEFF]/25 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                  style={{ width: `calc(${slot}% - 8px)`, right: `calc(${activeIdx * slot}% + 4px)` }}
                />
              )}
              {tabs.map((t) => {
                const isActive = location.pathname === t.href;
                return (
                  <Link
                    key={t.href}
                    to={t.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'relative z-10 flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-[10px] font-bold transition-all duration-200 active:scale-90 select-none',
                      isActive
                        ? 'text-[#2457C5] dark:text-[#8BAEFF]'
                        : 'text-[#8CA0BC] dark:text-[#5E7391] hover:text-[#2457C5] dark:hover:text-[#8BAEFF]',
                    )}
                  >
                    <span className={cn('transition-transform duration-300 ease-out', isActive && 'scale-110 -translate-y-0.5')}>
                      {t.icon}
                    </span>
                    <span>{t.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="relative z-10 flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-[10px] font-bold text-[#8CA0BC] dark:text-[#5E7391] hover:text-[#2457C5] dark:hover:text-[#8BAEFF] active:scale-90 transition-all cursor-pointer"
              >
                <Menu size={19} />
                <span>منوی کامل</span>
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
