import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Bell, Sun, Moon, LogOut, Menu, ChevronDown,
  ArrowLeftRight, ShieldCheck, Video, CheckSquare, BookOpen, FileText,
  Award, Sparkles, HeartHandshake, Users, Megaphone, Bus, ShieldAlert,
  UserCog, Layers, Clock, Settings, Search, Check,
  Building2, X, ChevronRight, UserCheck, Archive, Inbox, Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { SchoolLogo } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { ApiNotificationCenter } from '../api/data';
import { ApiError } from '../api/client';

interface DashboardHeaderProps {
  onToggleMobileMenu: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onToggleMobileMenu,
}) => {
  const {
    currentUser,
    activeRole,
    activeAssignment,
    userAssignments,
    allRoles,
    allStudents,
    activeStudent,
    switchContext,
    switchStudent,
    hasAccess,
    logout,
    activeSchoolName,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // State
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<import('../types').Notification[]>([]);
  const [serverUnread, setServerUnread] = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);

  // School Data
  // The school comes from the live session context — no mock school list.

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K for Quick Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsSearchModalOpen(false);
        setIsProfileDropdownOpen(false);
        setIsNotifDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Real notification center: the bell reads the signed-in user's own
  // notifications — never a fabricated sample — and every action hits the API.
  const unreadCount = serverUnread;

  const loadNotifications = useCallback(async () => {
    setNotifsLoading(true);
    try {
      const res = await ApiNotificationCenter.list('all');
      setNotifications(res.items);
      setServerUnread(res.unreadCount);
    } catch {
      setNotifications([]);
      setServerUnread(0);
    } finally {
      setNotifsLoading(false);
    }
  }, []);

  const markNotifRead = async (id: string) => {
    const item = notifications.find((n) => n.id === id);
    if (!item || item.isRead) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setServerUnread((c) => Math.max(0, c - 1));
    try {
      await ApiNotificationCenter.markRead(Number(id));
    } catch (e) {
      if (e instanceof ApiError) loadNotifications();
    }
  };

  const markAllNotifsRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setServerUnread(0);
    for (const n of unread) {
      try {
        await ApiNotificationCenter.markRead(Number(n.id));
      } catch {
        // server is the source of truth — the next open re-syncs
      }
    }
  };

  const archiveNotif = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setServerUnread((c) => Math.max(0, c - (notifications.find((n) => n.id === id)?.isRead ? 0 : 1)));
    try {
      await ApiNotificationCenter.archive(Number(id));
    } catch (e) {
      if (e instanceof ApiError) loadNotifications();
    }
  };

  const openNotifDropdown = () => {
    const next = !isNotifDropdownOpen;
    setIsNotifDropdownOpen(next);
    if (next) loadNotifications();
  };

  const openNotifItem = async (id: string, linkUrl?: string) => {
    await markNotifRead(id);
    setIsNotifDropdownOpen(false);
    if (linkUrl) navigate(linkUrl);
  };

  // Search items across application
  const searchableModules = [
    { title: 'داشبورد اختصاصی نقش', href: '/dashboard', category: 'عمومی', icon: <LayoutDashboard size={16} /> },
    { title: 'کلاس‌های آنلاین و جلسات تصویری', href: '/online-classes', category: 'آموزشی', icon: <Video size={16} /> },
    { title: 'دفتر حضور و غیاب کلاسی', href: '/attendance', category: 'آموزشی', icon: <CheckSquare size={16} /> },
    { title: 'تکالیف درسی و تصحیح', href: '/assignments', category: 'آموزشی', icon: <BookOpen size={16} /> },
    { title: 'بانک و مدیریت آزمون‌های آنلاین', href: '/exams', category: 'سنجش', icon: <FileText size={16} /> },
    { title: 'تصحیح آزمون‌های تشریحی', href: '/essay-grading', category: 'سنجش', icon: <CheckSquare size={16} /> },
    { title: 'کارنامه و نمرات مستمر', href: '/report-card', category: 'آموزشی', icon: <Award size={16} /> },
    { title: 'تحلیل هوشمند عملکرد و افت تحصیلی', href: '/performance-analytics', category: 'آموزشی', icon: <Sparkles size={16} /> },
    { title: 'مشاوره و هدایت تحصیلی فردی', href: '/counseling', category: 'پرورشی', icon: <HeartHandshake size={16} /> },
    { title: 'انجمن اولیا و مربیان (مجمع و آرا)', href: '/pta', category: 'خانواده', icon: <Users size={16} /> },
    { title: 'اطلاعیه‌ها و بخشنامه‌های مدرسه', href: '/announcements', category: 'عمومی', icon: <Megaphone size={16} /> },
    { title: 'رضایت‌نامه‌ها و گزارش اردوها', href: '/consent-forms', category: 'پرورشی', icon: <ShieldCheck size={16} /> },
    { title: 'سرویس مدارس، رانندگان و مسیرها', href: '/special-roles', category: 'اجرایی', icon: <Bus size={16} /> },
    { title: 'روابط خانوادگی و احکام حضانت دادگاه', href: '/family-management', category: 'حقوقی', icon: <ShieldAlert size={16} /> },
    { title: 'مدیریت مدارس، کادر و کاربران', href: '/user-management', category: 'مدیریت', icon: <UserCog size={16} /> },
    { title: 'ماتریس نقش‌ها و مجوزهای امنیتی (RBAC)', href: '/roles-permissions', category: 'امنیت', icon: <Layers size={16} /> },
    { title: 'تاریخچه حساس و ممیزی سیستم (Audit Logs)', href: '/audit-logs', category: 'امنیت', icon: <Clock size={16} /> },
    { title: 'تنظیمات و پیکربندی سامانه', href: '/settings', category: 'سیستم', icon: <Settings size={16} /> },
  ];

  const filteredModules = searchableModules.filter((m) =>
    m.title.includes(searchQuery.trim()) || m.category.includes(searchQuery.trim())
  );

  const filteredStudents = allStudents.filter((s) =>
    s.fullName.includes(searchQuery.trim()) || s.nationalId.includes(searchQuery.trim())
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0c1322]/90 backdrop-blur-xl border-b border-[#DCE3EE] dark:border-[#223147] transition-all duration-200 shadow-2xs">
        <div className="flex items-center justify-between gap-3 sm:gap-6 max-w-7xl mx-auto px-4 lg:px-8 h-16">
          
          {/* Right Zone: Mobile Toggle & School Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="منوی اصلی"
            >
              <Menu size={20} />
            </button>

            {/* School Brand & Logo */}
            <Link to="/dashboard" className="lg:hidden flex items-center gap-2.5 select-none group">
              <div className="relative">
                <SchoolLogo size={36} />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#0c1322] rounded-full" />
              </div>
              <div className="text-right">
                <span className="text-base font-black text-[#2457C5] dark:text-[#8BAEFF] tracking-tight block leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  مشاهیر آینده
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                  سامانه جامع و یکپارچه آموزشی
                </span>
              </div>
            </Link>
          </div>

          {/* Middle Zone: Clean Command Search Bar */}
          <div className="flex-1 max-w-md mx-2 hidden md:block">
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer group shadow-2xs"
              title="جستجوی سریع ماژول‌ها و بخش‌ها (Ctrl+K)"
            >
              <div className="flex items-center gap-2">
                <Search size={15} className="text-slate-400 group-hover:text-[#2457C5] dark:group-hover:text-[#8BAEFF] transition-colors" />
                <span className="text-xs">جستجو در سامانه...</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-md shadow-2xs">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Left Zone: Mobile Search, Notifications, Theme, User Profile */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Mobile Search Button */}
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="جستجو در سامانه"
              aria-label="جستجو"
            >
              <Search size={18} />
            </button>


            {/* Notifications Dropdown — live per-user notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={openNotifDropdown}
                className={cn(
                  'relative p-2 rounded-xl transition-all cursor-pointer border',
                  isNotifDropdownOpen
                    ? 'text-[#2457C5] dark:text-[#8BAEFF] bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700',
                )}
                title="مرکز اعلان‌ها"
                aria-label="اعلان‌ها"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-4 h-4 px-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums shadow-xs">
                    {toPersianDigits(unreadCount)}
                  </span>
                )}
              </button>

              {isNotifDropdownOpen && (
                <div className="absolute left-0 mt-2 w-80 sm:w-88 bg-white dark:bg-[#151f32] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl z-50 animate-in fade-in zoom-in-95 text-right overflow-hidden">
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">اعلان‌ها</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.5 rounded-full font-bold tabular-nums">
                          {toPersianDigits(unreadCount)} خوانده‌نشده
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotifsRead}
                        className="text-[10px] font-bold text-[#2457C5] dark:text-[#8BAEFF] hover:underline cursor-pointer"
                      >
                        خواندن همه
                      </button>
                    )}
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 px-3 pt-3 pb-2">
                    <button
                      onClick={() => setNotifFilter('all')}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg font-bold text-center transition-colors cursor-pointer text-[11px]',
                        notifFilter === 'all'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                          : 'text-slate-400 dark:text-slate-500 hover:text-slate-600',
                      )}
                    >
                      همه
                    </button>
                    <button
                      onClick={() => setNotifFilter('unread')}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg font-bold text-center transition-colors cursor-pointer text-[11px]',
                        notifFilter === 'unread'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                          : 'text-slate-400 dark:text-slate-500 hover:text-slate-600',
                      )}
                    >
                      خوانده‌نشده
                    </button>
                  </div>

                  {/* List */}
                  <div className="max-h-80 overflow-y-auto px-2 pb-2">
                    {notifsLoading ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
                        <Loader2 size={16} className="animate-spin" /> در حال دریافت…
                      </div>
                    ) : (
                      <>
                        {notifications
                          .filter((n) => notifFilter === 'all' || !n.isRead)
                          .slice(0, 8)
                          .map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => openNotifItem(notif.id, notif.linkUrl)}
                              className={cn(
                                'group relative p-3 rounded-xl text-xs transition-colors cursor-pointer text-right mb-1',
                                notif.isRead
                                  ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                                  : notif.isImportant
                                    ? 'bg-amber-50/80 dark:bg-amber-950/30 text-slate-800 dark:text-slate-100'
                                    : 'bg-blue-50/70 dark:bg-blue-950/40 text-slate-800 dark:text-slate-100',
                              )}
                            >
                              <div className="flex items-start justify-between gap-2 mb-0.5">
                                <span className="font-bold leading-snug flex items-center gap-1.5 min-w-0">
                                  {!notif.isRead && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#2457C5] dark:bg-[#8BAEFF] shrink-0" />
                                  )}
                                  <span className="truncate">{notif.title}</span>
                                  {notif.isImportant && (
                                    <span className="shrink-0 text-[9px] font-bold px-1 py-px rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                                      مهم
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{notif.createdAt}</span>
                              </div>
                              {notif.message && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                  {notif.message}
                                </p>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  archiveNotif(notif.id);
                                }}
                                title="بایگانی"
                                className="absolute left-2 top-2 p-1 rounded-lg text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                              >
                                <Archive size={13} />
                              </button>
                            </div>
                          ))}
                        {notifications.filter((n) => notifFilter === 'all' || !n.isRead).length === 0 && (
                          <div className="py-10 flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                            <Inbox size={26} className="opacity-60" />
                            <p className="text-xs">اعلانی ندارید — رویدادهای جدید همین‌جا می‌آیند.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 py-2.5 text-center">
                    <Link
                      to="/notifications"
                      onClick={() => setIsNotifDropdownOpen(false)}
                      className="text-xs font-bold text-[#2457C5] dark:text-[#8BAEFF] hover:underline inline-flex items-center gap-1"
                    >
                      <span>مرکز اعلان‌ها</span>
                      <ChevronRight size={12} className="rotate-180" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer"
              title={theme === 'dark' ? 'حالت روز' : 'حالت شب'}
              aria-label="تغییر تم"
            >
              {theme === 'dark' ? <Sun size={18} className="text-amber-400 animate-in spin-in-180 duration-300" /> : <Moon size={18} />}
            </button>

            {/* Redesigned User Profile Avatar & Popover */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 transition-all cursor-pointer group"
                title="پروفایل و تنظیمات کاربر"
              >
                <div className="w-7 h-7 rounded-lg bg-[#2457C5] dark:bg-[#8BAEFF] text-white dark:text-[#0c1322] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  {currentUser.fullName.slice(0, 1)}
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight max-w-[90px] md:max-w-[110px] truncate">
                    {currentUser.fullName}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-none truncate mt-0.5">
                    {activeRole.persianTitle}
                  </p>
                </div>
                <ChevronDown size={13} className={cn("text-slate-400 group-hover:text-slate-600 transition-transform hidden sm:block", isProfileDropdownOpen && "rotate-180")} />
              </button>

              {/* User Profile Popover */}
              {isProfileDropdownOpen && (
                <div className="absolute left-0 mt-2 w-76 bg-white dark:bg-[#151f32] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 text-right">
                  
                  {/* User info head */}
                  <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#2457C5] dark:bg-[#8BAEFF] text-white dark:text-[#0c1322] flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                      {currentUser.fullName.slice(0, 1)}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{currentUser.fullName}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">کد ملی: {currentUser.nationalId}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold">
                          {activeRole.persianTitle}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold flex items-center gap-0.5">
                          <Check size={10} /> فعال
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* School & Scope Info */}
                  <div className="p-2.5 mb-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Building2 size={13} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                        <span>واحد آموزشی:</span>
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{activeSchoolName}</span>
                    </div>

                    {/* Dual-role Context Switcher (if user has multiple assignments) */}
                    {userAssignments.length > 1 && (
                      <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-200 font-medium mb-1">
                          <ArrowLeftRight size={12} className="text-indigo-600 dark:text-indigo-400" />
                          <span>تغییر زمینه / نقش فعال:</span>
                        </div>
                        <select
                          value={activeAssignment.id}
                          onChange={(e) => switchContext(e.target.value)}
                          className="w-full bg-white dark:bg-[#151f32] border border-indigo-200/80 dark:border-indigo-900/60 rounded-lg px-2 py-1 text-xs text-indigo-950 dark:text-indigo-100 font-semibold cursor-pointer"
                        >
                          {userAssignments.map((ra) => {
                            const r = allRoles.find((role) => role.id === ra.roleId);
                            return (
                              <option key={ra.id} value={ra.id} className="dark:bg-[#151f32] text-slate-800 dark:text-slate-100">
                                {ra.roleTitle ?? r?.persianTitle ?? ra.roleId}{ra.schoolName ? ` — ${ra.schoolName}` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    {/* Parent Child Switcher (if family role) */}
                    {(activeRole.group === 'family' || activeRole.id === 'guardian' || activeRole.id === 'legal_guardian') && allStudents.length > 1 && (
                      <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center justify-between text-blue-900 dark:text-blue-200 font-medium mb-1">
                          <span>انتخاب فرزند تحت تکفل:</span>
                        </div>
                        <select
                          value={activeStudent?.id || ''}
                          onChange={(e) => switchStudent(e.target.value)}
                          className="w-full bg-white dark:bg-[#151f32] border border-blue-200/80 dark:border-blue-900/60 rounded-lg px-2 py-1 text-xs text-blue-950 dark:text-blue-100 font-semibold cursor-pointer"
                        >
                          {allStudents.map((std) => (
                            <option key={std.id} value={std.id} className="dark:bg-[#151f32] text-slate-800 dark:text-slate-100">
                              {std.fullName} (کلاس ۱۰۱)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Actions list */}
                  <div className="space-y-1">

                    {hasAccess('schools:settings') && (
                    <Link
                      to="/settings"
                      onClick={() => setIsProfileDropdownOpen(false)}
                      className="flex items-center gap-2 p-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Settings size={15} className="text-slate-500" />
                      <span>تنظیمات سامانه و حساب</span>
                    </Link>
                    )}

                    <button
                      onClick={async () => {
                        setIsProfileDropdownOpen(false);
                        await logout();
                        navigate('/login', { replace: true });
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer text-right"
                    >
                      <LogOut size={15} />
                      <span>خروج از حساب</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Quick Search Command Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-xl bg-white dark:bg-[#151f32] rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Search input header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 text-right">
              <Search size={18} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در بخش‌ها، دروس، کارنامه‌ها یا نام دانش‌آموز..."
                className="w-full bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => setIsSearchModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Results */}
            <div className="p-3 max-h-96 overflow-y-auto space-y-3 text-right">
              {/* Modules */}
              <div>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1.5 px-2">بخش‌ها و ماژول‌های سامانه</p>
                <div className="space-y-1">
                  {filteredModules.slice(0, 7).map((item) => (
                    <button
                      key={item.href}
                      onClick={() => {
                        navigate(item.href);
                        setIsSearchModalOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-right cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-[#2457C5] dark:text-[#8BAEFF] p-1.5 bg-blue-50 dark:bg-blue-950/60 rounded-lg">
                          {item.icon}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{item.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {item.category}
                      </span>
                    </button>
                  ))}
                  {filteredModules.length === 0 && (
                    <p className="text-xs text-slate-400 py-3 text-center">ماژولی با این عنوان یافت نشد</p>
                  )}
                </div>
              </div>

              {/* Students (if match) */}
              {searchQuery.trim().length > 0 && filteredStudents.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1.5 px-2">دانش‌آموزان منطبق</p>
                  <div className="space-y-1">
                    {filteredStudents.slice(0, 3).map((std) => (
                      <button
                        key={std.id}
                        onClick={() => {
                          switchStudent(std.id);
                          navigate('/report-card');
                          setIsSearchModalOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-right cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <UserCheck size={16} className="text-emerald-500" />
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{std.fullName}</span>
                          <span className="text-[10px] text-slate-400">کد ملی: {std.nationalId}</span>
                        </div>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">مشاهده پرونده و نمرات</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer shortcut guide */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>جهت جابجایی از کلیدهای کیبورد استفاده نمایید</span>
              <span className="font-mono">Esc برای بستن</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
