import React, { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, CheckSquare, FileText, Award,
  Sparkles, HeartHandshake, Users, Megaphone, ShieldCheck,
  UserCog, Settings, Menu, X, ClipboardList, Send,
  Layers, Clock, ShieldAlert, Bus, Video, CheckCircle2, Lock, Building2, Printer
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
    '/special-roles': 'roles:manage',
    '/online-classes': 'online_classes:view',
    // Monthly report-card cycle: the principal opens periods, the teacher
    // fills and submits his own. Each page also gates itself.
    '/report-cycle-admin': ['report_periods:manage', 'report_periods:review', 'report_periods:finalize'],
    '/report-card-print': 'reportcards:export_pdf',
    '/my-report-cycle': ['report_periods:record', 'report_periods:view'],
    // Shipped from live grade data; every viewer of the report also holds one
    // of these codes (learners get reportcards.view, staff get grades.*).
    '/performance-analytics': ['grades:view', 'grades:record', 'reportcards:view'],
    '/counseling': null,
    '/pta': null,
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
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC] dark:bg-[#0c1322]">
        <div className="w-8 h-8 border-2 border-[#2457C5] border-t-transparent rounded-full animate-spin" />
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
          label: 'چاپ گروهی کارنامه',
          href: '/report-card-print',
          icon: <Printer size={17} />,
          show: hasAccess('reportcards:export_pdf'),
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
          show: !isBusDriver && (hasAccess('counseling:book') || hasAccess('counseling:manage_sessions')),
        },
        {
          label: 'انجمن اولیا و مربیان',
          href: '/pta',
          icon: <Users size={17} />,
          show: !isBusDriver && !isStudent && (hasAccess('pta:vote') || hasAccess('pta:manage') || isFamily || activeRole.group === 'pta' || isAdmin),
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
          href: '/special-roles',
          icon: <Bus size={17} />,
          show: isBusDriver || activeRole.id === 'security_guard' || activeRole.id === 'essay_grader' || activeRole.id === 'exam_proctor' || isAdmin,
          badge: isBusDriver ? 'راننده' : activeRole.id === 'security_guard' ? 'حراست' : undefined,
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
          label: 'نقش‌ها و دسترسی‌ها (RBAC)',
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

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC] dark:bg-[#101722] text-[#202B3C] dark:text-[#F1F5FB]">
      {schoolSwitched && (
        <div className="bg-emerald-600 dark:bg-emerald-700 text-white text-xs font-bold text-center py-2 px-4">
          ورود به {activeSchoolName ?? 'واحد آموزشی جدید'} انجام شد — داده‌ها برای این مدرسه بارگذاری شدند.
        </div>
      )}
      {/* Top Bar Header (Redesigned) */}
      <DashboardHeader
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 gap-6">
        {/* Desktop Sidebar (RTL: right side) */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-20 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-2xl p-3.5 shadow-xs max-h-[calc(100vh-6rem)] overflow-y-auto no-scrollbar">
            {/* User Profile Summary */}
            <div className="pb-3.5 mb-3 border-b border-[#DCE3EE] dark:border-[#344257] text-right">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2457C5]/10 dark:bg-[#8BAEFF]/20 text-[#2457C5] dark:text-[#8BAEFF] flex items-center justify-center font-bold text-sm shrink-0">
                  {currentUser.fullName.slice(0, 1)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] truncate">{currentUser.fullName}</p>
                  <p className="text-xs text-[#526176] dark:text-[#B3C0D2] truncate">{activeRole.persianTitle}</p>
                </div>
              </div>
            </div>

            {/* Navigation Groups */}
            <div className="space-y-4">
              {navGroups.map((group) => {
                const visibleItems = group.items.filter((it) => itemAllowed(it.href, it.show));
                if (visibleItems.length === 0) return null;
                return (
                  <div key={group.title}>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-3 py-1 uppercase tracking-wider">
                      {group.title}
                    </p>
                    <nav className="space-y-0.5 mt-0.5">
                      {visibleItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all select-none',
                              isActive
                                ? 'bg-[#2457C5] text-white shadow-xs dark:bg-[#8BAEFF] dark:text-[#101722] font-semibold'
                                : 'text-[#526176] dark:text-[#B3C0D2] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] hover:text-[#202B3C] dark:hover:text-white'
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={cn('shrink-0', isActive ? 'text-white dark:text-[#101722]' : 'text-slate-400 dark:text-slate-400')}>{item.icon}</span>
                              <span className="truncate">{item.label}</span>
                            </div>
                            {item.badge && (
                              <span
                                className={cn(
                                  'text-[10px] px-1.5 py-0.2 rounded-md font-bold',
                                  isActive ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
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
                );
              })}
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="relative z-10 w-72 max-w-[85%] bg-white dark:bg-[#182231] h-full p-4 overflow-y-auto border-l border-[#DCE3EE] dark:border-[#344257] shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#DCE3EE] dark:border-[#344257] mb-4">
                <div className="flex items-center gap-2">
                  <SchoolLogo size={28} />
                  <div>
                    <span className="font-bold text-sm text-[#2457C5] dark:text-[#8BAEFF] block leading-tight">مشاهیر آینده</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">پنل جامع پیشخوان</span>
                  </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              {/* Mobile Drawer Groups */}
              <div className="space-y-4">
                {navGroups.map((group) => {
                  const visibleItems = group.items.filter((it) => itemAllowed(it.href, it.show));
                  if (visibleItems.length === 0) return null;
                  return (
                    <div key={group.title}>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2 py-1 uppercase tracking-wider">
                        {group.title}
                      </p>
                      <nav className="space-y-0.5 mt-0.5">
                        {visibleItems.map((item) => {
                          const isActive = location.pathname === item.href;
                          return (
                            <Link
                              key={item.href}
                              to={item.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={cn(
                                'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors',
                                isActive
                                  ? 'bg-[#2457C5] text-white dark:bg-[#8BAEFF] dark:text-[#101722] font-semibold'
                                  : 'text-[#526176] dark:text-[#B3C0D2] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42]'
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="shrink-0">{item.icon}</span>
                                <span className="truncate">{item.label}</span>
                              </div>
                              {item.badge && (
                                <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.5 rounded font-bold">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </nav>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Content Viewport */}
        <main className="flex-1 min-w-0 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Thumb Reach) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#182231]/95 backdrop-blur-md border-t border-[#DCE3EE] dark:border-[#344257] px-2 py-1.5 flex items-center justify-around shadow-lg">
        <Link
          to="/dashboard"
          className={cn(
            'flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors',
            location.pathname === '/dashboard' ? 'text-[#2457C5] dark:text-[#8BAEFF]' : 'text-slate-500 dark:text-slate-400'
          )}
        >
          <LayoutDashboard size={18} />
          <span>داشبورد</span>
        </Link>

        {itemAllowed('/attendance', true) && (
        <Link
          to="/attendance"
          className={cn(
            'flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors',
            location.pathname === '/attendance' ? 'text-[#2457C5] dark:text-[#8BAEFF]' : 'text-slate-500 dark:text-slate-400'
          )}
        >
          <CheckSquare size={18} />
          <span>حضور و غیاب</span>
        </Link>
        )}

        {itemAllowed('/assignments', true) && (
        <Link
          to="/assignments"
          className={cn(
            'flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors',
            location.pathname === '/assignments' ? 'text-[#2457C5] dark:text-[#8BAEFF]' : 'text-slate-500 dark:text-slate-400'
          )}
        >
          <BookOpen size={18} />
          <span>تکالیف</span>
        </Link>
        )}

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium text-slate-500 dark:text-slate-400"
        >
          <Menu size={18} />
          <span>منوی کامل</span>
        </button>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#DCE3EE] dark:border-[#344257] py-6 px-4 bg-white/50 dark:bg-[#182231]/40 text-center text-xs text-[#526176] dark:text-[#B3C0D2]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© سال تحصیلی ۱۴۰۵-۱۴۰۶ — مجتمع آموزشی و دبیرستان استعدادهای درخشان مشاهیر آینده</p>
          <div className="flex items-center gap-4">
            <span className="text-[11px] bg-blue-50 text-[#2457C5] dark:bg-blue-950 dark:text-[#8BAEFF] px-2 py-0.5 rounded">
              سامانه یکپارچه مبتنی بر RBAC و امنیت روابط خانوادگی
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
};
