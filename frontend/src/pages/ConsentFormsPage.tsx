import React, { useState, useMemo } from 'react';
import {
  ShieldCheck, Calendar, Clock, MapPin, CheckCircle2,
  XCircle, FileText, Check, AlertCircle, Printer, Download,
  Filter, Search, Users, Bus, Plus, Sparkles, Phone, ChevronRight,
  Shield, CheckSquare, Info, RefreshCw, BarChart3, HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, PageHeader, FormField } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { ConsentService, UserService } from '../services';
import { ConsentForm } from '../types';
import { INITIAL_CLASSROOMS } from '../data/mockData';

export const ConsentFormsPage: React.FC = () => {
  const { currentUser, activeRole, hasAccess } = useAuth();

  // Role categorization
  const isFamily = activeRole.group === 'family';
  const isStudent = activeRole.group === 'student';
  const isStaff = !isFamily && !isStudent; // Principal, deputies, teachers, supervisors, platform admin

  const [forms, setForms] = useState<ConsentForm[]>(() => ConsentService.getAll());
  const [selectedForm, setSelectedForm] = useState<ConsentForm | null>(null);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);

  // Staff specific states
  const [activeTab, setActiveTab] = useState<'report' | 'official_list' | 'cards' | 'create_trip'>(
    isStaff ? 'report' : 'cards'
  );
  const [selectedTripTitle, setSelectedTripTitle] = useState<string>('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Print Preview Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Create New Trip Modal / Form State
  const [isCreateTripModalOpen, setIsCreateTripModalOpen] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState('');
  const [newTripDestination, setNewTripDestination] = useState('');
  const [newTripDate, setNewTripDate] = useState('۱۴۰۳/۰۸/۳۰');
  const [newTripDeadline, setNewTripDeadline] = useState('۱۴۰۳/۰۸/۲۵');
  const [newTripTransport, setNewTripTransport] = useState('اتوبوس اختصاصی VIP مدرسه');
  const [newTripCost, setNewTripCost] = useState('رایگان (بورسیه مدرسه)');
  const [newTripCapacity, setNewTripCapacity] = useState(45);
  const [newTripClassTarget, setNewTripClassTarget] = useState('all');
  const [newTripDescription, setNewTripDescription] = useState('');

  // Toast / notification
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const showFeedback = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // Unique Trip Titles for filtering
  const tripTitles = useMemo(() => {
    const set = new Set<string>();
    forms.forEach((f) => set.add(f.title));
    return Array.from(set);
  }, [forms]);

  // Filtered forms
  const filteredForms = useMemo(() => {
    return forms.filter((f) => {
      if (selectedTripTitle !== 'all' && f.title !== selectedTripTitle) return false;
      if (selectedClassFilter !== 'all' && f.studentClass && !f.studentClass.includes(selectedClassFilter)) return false;
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = f.studentName.toLowerCase().includes(query);
        const matchesTitle = f.title.toLowerCase().includes(query);
        const matchesDestination = f.destination.toLowerCase().includes(query);
        const matchesGuardian = f.signedByGuardianName?.toLowerCase().includes(query);
        if (!matchesName && !matchesTitle && !matchesDestination && !matchesGuardian) return false;
      }
      return true;
    });
  }, [forms, selectedTripTitle, selectedClassFilter, statusFilter, searchQuery]);

  // Statistics calculation for the active selection
  const stats = useMemo(() => {
    const total = filteredForms.length;
    const approved = filteredForms.filter((f) => f.status === 'approved').length;
    const pending = filteredForms.filter((f) => f.status === 'pending').length;
    const rejected = filteredForms.filter((f) => f.status === 'rejected').length;
    const percent = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { total, approved, pending, rejected, percent };
  }, [filteredForms]);

  // Currently focused trip metadata
  const currentTripDetails = useMemo(() => {
    if (selectedTripTitle !== 'all') {
      return forms.find((f) => f.title === selectedTripTitle);
    }
    return forms[0] || null;
  }, [forms, selectedTripTitle]);

  // Guardian Signing
  const handleSign = (status: 'approved' | 'rejected') => {
    if (!selectedForm) return;
    const updated = ConsentService.signForm(selectedForm.id, currentUser.fullName, status);
    setForms(updated);
    setIsSignModalOpen(false);
    showFeedback(
      status === 'approved'
        ? `رضایت‌نامه اردوی «${selectedForm.title}» با موفقیت امضا و تایید گردید.`
        : `عدم موافقت با حضور در اردوی «${selectedForm.title}» ثبت شد.`
    );
  };

  // Staff Manual Override / Phone Confirmation
  const handleStaffManualConfirm = (formId: string, newStatus: 'approved' | 'rejected') => {
    const staffNote = `${currentUser.fullName} (${activeRole.persianTitle} - ثبت تلفنی)`;
    const updated = ConsentService.signForm(formId, staffNote, newStatus);
    setForms(updated);
    showFeedback(`وضعیت رضایت‌نامه دانش‌آموز توسط کادر مدرسه به ${newStatus === 'approved' ? '«تأیید شده»' : '«عدم موافقت»'} تغییر یافت.`);
  };

  // Create New Trip Submission
  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripTitle.trim() || !newTripDestination.trim()) {
      alert('لطفاً عنوان اردو و مقصد را وارد نمایید.');
      return;
    }

    // Get sample students from class or all
    const allStudents = UserService.getStudents();
    const targetStudents = newTripClassTarget === 'all'
      ? allStudents.slice(0, 15) // sample 15 students
      : allStudents.filter((s) => s.classroomId === newTripClassTarget).slice(0, 15);

    targetStudents.forEach((student) => {
      const classObj = INITIAL_CLASSROOMS.find((c) => c.id === student.classroomId);
      const studentClass = classObj ? classObj.name : 'کلاس ۱۰۱ (دهم)';
      ConsentService.createForm(
        {
          studentId: student.id,
          studentName: student.fullName,
          studentClass: studentClass,
          title: newTripTitle,
          description: newTripDescription || `اردوی فرهنگی و علمی به مقصد ${newTripDestination} با رعایت تمامی شیوه‌نامه‌های ایمنی دانش‌آموزی.`,
          activityDate: newTripDate,
          deadlineDate: newTripDeadline,
          destination: newTripDestination,
          transportType: newTripTransport,
          insuranceCoverage: true,
          cost: newTripCost,
          capacity: newTripCapacity,
          status: 'pending',
          emergencyContact: '۰۹۱۲۲۲۲۳۳۴۴',
        },
        currentUser.fullName
      );
    });

    setForms(ConsentService.getAll());
    setIsCreateTripModalOpen(false);
    setSelectedTripTitle(newTripTitle);
    setActiveTab('report');
    showFeedback(`اردوی جدید «${newTripTitle}» با موفقیت ثبت شد و فرم‌های رضایت‌نامه برای دانش‌آموزان صادر گردید.`);

    // Reset form
    setNewTripTitle('');
    setNewTripDestination('');
    setNewTripDescription('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isStaff ? 'گزارش‌گیری اردوها و رضایت‌نامه‌های مدرسه' : 'مدیریت رضایت‌نامه‌های الکترونیکی اولیا'}
        subtitle={
          isStaff
            ? 'سامانه یکپارچه نظارت، آمار رضایت‌مندی اولیا و صدور لیست رسمی بیمه و اعزام اردوهای دانش‌آموزی'
            : 'تأیید و امضای دیجیتال اردوهای علمی، مسابقات پژوهشی و برنامه‌های خارج از مدرسه'
        }
      />

      {/* Action Toast Feedback */}
      {feedbackNotice && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} className="text-emerald-600 hover:underline">
            بستن
          </button>
        </div>
      )}

      {/* Top Tabs for Staff */}
      {isStaff && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('report')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
                activeTab === 'report'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              )}
            >
              <BarChart3 size={15} />
              <span>داشبورد و گزارش تحلیلی اردو</span>
            </button>

            <button
              onClick={() => setActiveTab('official_list')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
                activeTab === 'official_list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              )}
            >
              <FileText size={15} />
              <span>لیست رسمی اعزام و بیمه ({toPersianDigits(stats.approved)} نفر)</span>
            </button>

            <button
              onClick={() => setActiveTab('cards')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
                activeTab === 'cards'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              )}
            >
              <Users size={15} />
              <span>مشاهده کارتی رضایت‌نامه‌ها</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer size={15} />}
              onClick={() => setIsPrintModalOpen(true)}
            >
              پیش‌نمایش چاپ رسمی
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => setIsCreateTripModalOpen(true)}
            >
              تعریف اردوی جدید
            </Button>
          </div>
        </div>
      )}

      {/* FILTER & STATS CONTROLS (STAFF ONLY) */}
      {isStaff && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Field Trip Dropdown */}
            <div className="flex-1 min-w-[220px]">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                انتخاب عنوان اردو جهت گزارش:
              </label>
              <select
                value={selectedTripTitle}
                onChange={(e) => setSelectedTripTitle(e.target.value)}
                className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">همه اردوهای فعال مدرسه ({toPersianDigits(tripTitles.length)} اردو)</option>
                {tripTitles.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Filter */}
            <div className="w-full sm:w-auto">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                فیلتر کلاس درسی:
              </label>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="w-full sm:w-44 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">همه کلاس‌ها</option>
                <option value="۱۰۱">کلاس ۱۰۱ (ریاضی)</option>
                <option value="۱۰۲">کلاس ۱۰۲ (تجربی)</option>
                <option value="۱۰۳">کلاس ۱۰۳ (انسانی)</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-auto">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                وضعیت رضایت‌نامه:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full sm:w-40 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="approved">فقط تأیید شده‌ها</option>
                <option value="pending">در انتظار امضا</option>
                <option value="rejected">عدم موافقت</option>
              </select>
            </div>

            {/* Student Search */}
            <div className="w-full sm:w-56">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                جستجوی دانش‌آموز:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="نام دانش‌آموز یا ولی..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700/60">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">کل فرم‌های مشمول</span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                {toPersianDigits(stats.total)} <span className="text-xs font-normal text-slate-500">دانش‌آموز</span>
              </span>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/70 dark:border-emerald-800">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block mb-0.5">تأیید و امضا شده (مجاز)</span>
              <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300">
                {toPersianDigits(stats.approved)} <span className="text-xs font-bold">({toPersianDigits(stats.percent)}٪)</span>
              </span>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200/70 dark:border-amber-800">
              <span className="text-[11px] text-amber-700 dark:text-amber-400 block mb-0.5">در انتظار امضای اولیا</span>
              <span className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300">
                {toPersianDigits(stats.pending)} <span className="text-xs font-normal">نفر</span>
              </span>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200/70 dark:border-rose-800">
              <span className="text-[11px] text-rose-700 dark:text-rose-400 block mb-0.5">عدم موافقت اولیا</span>
              <span className="text-lg font-bold font-mono text-rose-700 dark:text-rose-300">
                {toPersianDigits(stats.rejected)} <span className="text-xs font-normal">نفر</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* REPORT DASHBOARD TAB (STAFF) */}
      {isStaff && activeTab === 'report' && (
        <div className="space-y-5">
          {/* Active Trip Highlights Card */}
          {currentTripDetails && (
            <Card className="text-right border-blue-500/30 dark:border-blue-500/20 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 mb-1.5">
                    <Sparkles size={13} />
                    خلاصه وضعیت اردوی جاری
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{currentTripDetails.title}</h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300">
                    <Calendar size={13} className="text-blue-500" />
                    تاریخ اعزام: <strong>{currentTripDetails.activityDate}</strong>
                  </span>
                  <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300">
                    <Clock size={13} className="text-amber-500" />
                    مهلت امضا: <strong>{currentTripDetails.deadlineDate}</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>مقصد: <strong>{currentTripDetails.destination}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Bus size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>وسیله نقلیه: <strong>{currentTripDetails.transportType || 'اتوبوس اسکانیا'}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>بیمه حوادث دانش‌آموزی: <strong className="text-emerald-600 dark:text-emerald-400">تحت پوشش کامل</strong></span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">پیشرفت امضا و نهایی‌سازی ظرفیت:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {toPersianDigits(stats.approved)} نفر تایید شده از {toPersianDigits(stats.total)} نفر ({toPersianDigits(stats.percent)}٪)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${stats.percent}%` }}
                    title={`تایید شده: ${stats.approved}`}
                  />
                  <div
                    className="bg-amber-400 h-full transition-all duration-500"
                    style={{ width: `${stats.total > 0 ? (stats.pending / stats.total) * 100 : 0}%` }}
                    title={`در انتظار: ${stats.pending}`}
                  />
                  <div
                    className="bg-rose-500 h-full transition-all duration-500"
                    style={{ width: `${stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0}%` }}
                    title={`عدم موافقت: ${stats.rejected}`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    تأیید شده: {toPersianDigits(stats.approved)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    در انتظار: {toPersianDigits(stats.pending)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    عدم موافقت: {toPersianDigits(stats.rejected)}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Roster Table with Staff Overrides */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">فهرست وضعیت دانش‌آموزان مشمول اردو</h4>
                <p className="text-xs text-slate-500">جهت بررسی امضا، تماس اضطراری و ثبت تاییدیه‌های تلفنی کادر مدرسه</p>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                نمایش {toPersianDigits(filteredForms.length)} رکورد
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-3">ردیف</th>
                    <th className="py-3 px-3">نام و نام‌خانوادگی</th>
                    <th className="py-3 px-3">کلاس</th>
                    <th className="py-3 px-3">عنوان اردو</th>
                    <th className="py-3 px-3">وضعیت رضایت‌نامه</th>
                    <th className="py-3 px-3">امضا کننده و زمان</th>
                    <th className="py-3 px-3">تماس اضطراری</th>
                    <th className="py-3 px-3 text-center">اقدام کادر مدرسه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {filteredForms.map((item, index) => {
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-400">{toPersianDigits(index + 1)}</td>
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">{item.studentName}</td>
                        <td className="py-3 px-3 text-slate-500">{item.studentClass || 'کلاس ۱۰۱'}</td>
                        <td className="py-3 px-3 max-w-[200px] truncate" title={item.title}>{item.title}</td>
                        <td className="py-3 px-3">
                          {item.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 size={12} />
                              مجاز به اعزام
                            </span>
                          ) : item.status === 'rejected' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                              <XCircle size={12} />
                              عدم رضایت
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                              <Clock size={12} />
                              در انتظار امضا
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[11px]">
                          {item.signedByGuardianName ? (
                            <div>
                              <span className="font-semibold">{item.signedByGuardianName}</span>
                              <span className="block text-[10px] text-slate-400 font-mono">{item.signedAt}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">ثبت نشده</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {item.emergencyContact ? (
                            <a href={`tel:${item.emergencyContact}`} className="hover:text-blue-600 flex items-center gap-1">
                              <Phone size={11} className="text-slate-400" />
                              <span>{item.emergencyContact}</span>
                            </a>
                          ) : (
                            '۰۹۱۲۰۰۰۰۰۰۰'
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {item.status !== 'approved' && (
                              <button
                                onClick={() => handleStaffManualConfirm(item.id, 'approved')}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                                title="تأیید تلفنی و صدور مجوز اردو توسط کادر مدرسه"
                              >
                                ثبت تأیید
                              </button>
                            )}
                            {item.status !== 'rejected' && (
                              <button
                                onClick={() => handleStaffManualConfirm(item.id, 'rejected')}
                                className="px-2 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-rose-600 hover:text-white text-slate-700 dark:text-slate-300 rounded text-[10px] transition-colors cursor-pointer"
                                title="ثبت انصراف دانش‌آموز"
                              >
                                انصراف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL DISPATCH LIST TAB (STAFF ONLY) */}
      {isStaff && activeTab === 'official_list' && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
              <div>
                <strong className="block font-bold">فهرست قطعی و نهایی دانش‌آموزان مجاز به اعزام (با رضایت‌نامه رسمی امضاشده)</strong>
                <span>این لیست فاقد افراد معلق و انصرافی بوده و مستقیماً ملاک صدور بیمه‌نامه و سوار شدن به اتوبوس است.</span>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Printer size={15} />}
              onClick={() => setIsPrintModalOpen(true)}
            >
              چاپ و دریافت فایل PDF
            </Button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">لیست اسامی مسافران اتوبوس و بیمه‌شدگان اردو</h4>
                <p className="text-xs text-slate-500">دارای تاییدیه قانونی ولی و ثبت در پرونده انضباطی مدرسه</p>
              </div>
              <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full text-xs">
                مجموع: {toPersianDigits(filteredForms.filter((f) => f.status === 'approved').length)} نفر
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-3">ردیف</th>
                    <th className="py-3 px-3">نام دانش‌آموز</th>
                    <th className="py-3 px-3">کلاس</th>
                    <th className="py-3 px-3">ولی امضا کننده</th>
                    <th className="py-3 px-3">زمان امضا</th>
                    <th className="py-3 px-3">شماره تماس اضطراری</th>
                    <th className="py-3 px-3">کد امضا / IP</th>
                    <th className="py-3 px-3">پوشش بیمه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {filteredForms
                    .filter((f) => f.status === 'approved')
                    .map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-mono text-slate-400">{toPersianDigits(index + 1)}</td>
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">{item.studentName}</td>
                        <td className="py-3 px-3 text-slate-500">{item.studentClass || 'کلاس ۱۰۱'}</td>
                        <td className="py-3 px-3 font-medium">{item.signedByGuardianName}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{item.signedAt}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{item.emergencyContact || '۰۹۱۲۲۲۲۳۳۴۴'}</td>
                        <td className="py-3 px-3 font-mono text-[10px] text-slate-400">{item.signatureIp || 'SSL Verified'}</td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded font-bold">
                            تایید شده
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CARDS VIEW (FOR PARENTS AND DETAILED INSPECTION) */}
      {(activeTab === 'cards' || !isStaff) && (
        <div className="space-y-4">
          {filteredForms.map((form) => (
            <Card key={form.id} className="text-right">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={form.status === 'approved' ? 'success' : form.status === 'rejected' ? 'danger' : 'warning'}>
                      {form.status === 'approved' ? 'تأیید و امضا شده' : form.status === 'rejected' ? 'عدم موافقت' : 'در انتظار امضای ولی'}
                    </Badge>
                    <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                      دانش‌آموز: <strong>{form.studentName}</strong> ({form.studentClass || 'پایه دهم'})
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">{form.title}</h3>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-500">
                  <Calendar size={13} className="text-[#2457C5]" />
                  <span>مهلت امضا: {form.deadlineDate}</span>
                </div>
              </div>

              <p className="text-xs md:text-sm text-[#526176] dark:text-[#B3C0D2] py-3 leading-relaxed">
                {form.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 text-xs bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5 mb-2">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <MapPin size={14} className="text-blue-500" />
                  <span>مقصد: <strong>{form.destination}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Bus size={14} className="text-indigo-500" />
                  <span>وسیله نقلیه: <strong>{form.transportType || 'اتوبوس اسکانیا'}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Clock size={14} className="text-amber-500" />
                  <span>تاریخ برگزاری: <strong>{form.activityDate}</strong></span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  {form.cost && (
                    <span className="text-xs text-slate-500">
                      هزینه اردو: <strong>{form.cost}</strong>
                    </span>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {form.status === 'pending' ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedForm(form);
                        setIsSignModalOpen(true);
                      }}
                    >
                      بررسی و امضای رضایت‌نامه دیجیتال
                    </Button>
                  ) : (
                    <div className="text-left sm:text-right">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">
                        امضا شده توسط: {form.signedByGuardianName}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        تاریخ: {form.signedAt}
                      </span>
                    </div>
                  )}

                  {isStaff && form.status !== 'approved' && (
                    <button
                      onClick={() => handleStaffManualConfirm(form.id, 'approved')}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      title="ثبت تایید تلفنی توسط کادر مدرسه"
                    >
                      تایید دستی کادر
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL: SIGN CONSENT (GUARDIAN / STUDENT) */}
      <Modal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
        title="امضای الکترونیکی رضایت‌نامه ولی قانونی"
        maxWidth="md"
      >
        <div className="space-y-4 text-right">
          <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
            اینجانب <strong>{currentUser.fullName}</strong>، به عنوان ولی قانونی دانش‌آموز{' '}
            <strong>{selectedForm?.studentName}</strong>، ضمن مطالعه کامل ضوابط، شیوه‌نامه‌های بهداشتی و ایمنی اردوی{' '}
            <strong>{selectedForm?.destination}</strong> در تاریخ {selectedForm?.activityDate}، موافقت یا عدم موافقت خود را جهت حضور فرزند اعلام می‌دارم.
          </p>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <span className="font-bold block">مقررات و پوشش‌های ایمنی اردو:</span>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-blue-800 dark:text-blue-300">
              <li>پوشش کامل بیمه حوادث دانش‌آموزی و مسئولیت مدنی از مبدا تا مقصد</li>
              <li>همراهی مربیان پرورشی و ناظم اردو در تمامی ساعات سفر</li>
              <li>تعهد دانش‌آموز مبنی بر رعایت کامل شئونات اخلاقی و انضباطی آموزشگاه</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="danger" size="sm" onClick={() => handleSign('rejected')}>
              عدم موافقت با حضور فرزند
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSign('approved')}
              icon={<CheckCircle2 size={15} />}
            >
              تأیید و ثبت امضای دیجیتال
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: CREATE NEW FIELD TRIP (STAFF) */}
      <Modal
        isOpen={isCreateTripModalOpen}
        onClose={() => setIsCreateTripModalOpen(false)}
        title="تعریف و برنامه‌ریزی اردوی جدید مدرسه"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateTrip} className="space-y-4 text-right">
          <p className="text-xs text-slate-500">
            با ثبت این اردو، فرم‌های رضایت‌نامه الکترونیکی به صورت خودکار در پنل اولیا دانش‌آموزان هدف صادر و پیامک اطلاع‌رسانی ارسال می‌شود.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="عنوان اردو یا مسابقه خارج از مدرسه" required>
              <input
                type="text"
                placeholder="مثلاً: اردوی علمی بازدید از رصدخانه و آسمان‌نما"
                value={newTripTitle}
                onChange={(e) => setNewTripTitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                required
              />
            </FormField>

            <FormField label="مقصد اردو" required>
              <input
                type="text"
                placeholder="مثلاً: تهران، بوستان رازی، مرکز نجوم"
                value={newTripDestination}
                onChange={(e) => setNewTripDestination(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                required
              />
            </FormField>

            <FormField label="تاریخ برگزاری اردو" required>
              <input
                type="text"
                value={newTripDate}
                onChange={(e) => setNewTripDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                required
              />
            </FormField>

            <FormField label="مهلت ثبت رضایت اولیا" required>
              <input
                type="text"
                value={newTripDeadline}
                onChange={(e) => setNewTripDeadline(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                required
              />
            </FormField>

            <FormField label="وسیله ایاب و ذهاب">
              <input
                type="text"
                value={newTripTransport}
                onChange={(e) => setNewTripTransport(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
            </FormField>

            <FormField label="هزینه اردو (برای هر دانش‌آموز)">
              <input
                type="text"
                value={newTripCost}
                onChange={(e) => setNewTripCost(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
            </FormField>

            <FormField label="کلاس‌های هدف">
              <select
                value={newTripClassTarget}
                onChange={(e) => setNewTripClassTarget(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              >
                <option value="all">تمام پایه‌ها و کلاس‌ها</option>
                <option value="cls_101">کلاس ۱۰۱ (دهم ریاضی الف)</option>
                <option value="cls_102">کلاس ۱۰۲ (دهم تجربی الف)</option>
                <option value="cls_103">کلاس ۱۰۳ (دهم انسانی)</option>
              </select>
            </FormField>

            <FormField label="حداکثر ظرفیت پذیرش">
              <input
                type="number"
                value={newTripCapacity}
                onChange={(e) => setNewTripCapacity(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
            </FormField>
          </div>

          <FormField label="توضیحات و سین‌برنامه اردو">
            <textarea
              rows={3}
              placeholder="ساعت حرکت، وعده‌های غذایی، وسایل مورد نیاز دانش‌آموز..."
              value={newTripDescription}
              onChange={(e) => setNewTripDescription(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsCreateTripModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit" icon={<Plus size={15} />}>
              ثبت اردو و صدور رضایت‌نامه‌ها
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: OFFICIAL PRINT REPORT PREVIEW */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="پیش‌نمایش فرم رسمی اعزام و پوشش بیمه اردو"
        maxWidth="2xl"
      >
        <div className="space-y-4 text-right">
          {/* Printable Document Box */}
          <div className="p-6 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl space-y-4 print:p-0 print:border-none">
            {/* Document Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-800 dark:border-slate-200 pb-4">
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">جمهوری اسلامی ایران</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">وزارت آموزش و پرورش - اداره منطقه ۱ تهران</span>
                <h2 className="text-base font-extrabold text-[#2457C5] dark:text-[#8BAEFF] mt-1">دبیرستان هوشمند مشاهیر آینده</h2>
              </div>
              <div className="text-center">
                <span className="text-xs font-bold block border border-slate-800 dark:border-slate-200 px-3 py-1 rounded">
                  فرم رسمی اعزام و بیمه دانش‌آموزی
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-1 block">کد بخشنامه: ۹۵۸۲-اردو</span>
              </div>
              <div className="text-left text-xs font-mono text-slate-600 dark:text-slate-400">
                <div>تاریخ صدور: ۱۴۰۳/۰۷/۱۵</div>
                <div>پیوست: فهرست بیمه</div>
              </div>
            </div>

            {/* Trip Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
              <div>
                <span className="text-slate-400 block text-[10px]">عنوان اردو:</span>
                <strong className="text-slate-800 dark:text-slate-200">{currentTripDetails?.title || 'اردوی علمی'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">مقصد:</span>
                <strong className="text-slate-800 dark:text-slate-200">{currentTripDetails?.destination}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">تاریخ برگزاری:</span>
                <strong className="text-slate-800 dark:text-slate-200">{currentTripDetails?.activityDate}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">وسیله نقلیه:</span>
                <strong className="text-slate-800 dark:text-slate-200">{currentTripDetails?.transportType || 'اتوبوس VIP'}</strong>
              </div>
            </div>

            {/* Print Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border border-slate-300 dark:border-slate-700">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                  <tr>
                    <th className="p-2 border border-slate-300 dark:border-slate-700 text-center w-10">ردیف</th>
                    <th className="p-2 border border-slate-300 dark:border-slate-700">نام دانش‌آموز</th>
                    <th className="p-2 border border-slate-300 dark:border-slate-700">کلاس</th>
                    <th className="p-2 border border-slate-300 dark:border-slate-700">ولی تایید کننده</th>
                    <th className="p-2 border border-slate-300 dark:border-slate-700">شماره اضطراری</th>
                    <th className="p-2 border border-slate-300 dark:border-slate-700 text-center">وضعیت بیمه</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredForms
                    .filter((f) => f.status === 'approved')
                    .map((item, idx) => (
                      <tr key={item.id} className="border-b border-slate-200 dark:border-slate-800">
                        <td className="p-2 border border-slate-300 dark:border-slate-700 text-center font-mono">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="p-2 border border-slate-300 dark:border-slate-700 font-bold">{item.studentName}</td>
                        <td className="p-2 border border-slate-300 dark:border-slate-700">{item.studentClass || 'کلاس ۱۰۱'}</td>
                        <td className="p-2 border border-slate-300 dark:border-slate-700">{item.signedByGuardianName}</td>
                        <td className="p-2 border border-slate-300 dark:border-slate-700 font-mono text-[11px]">
                          {item.emergencyContact || '۰۹۱۲۲۲۲۳۳۴۴'}
                        </td>
                        <td className="p-2 border border-slate-300 dark:border-slate-700 text-center font-semibold text-emerald-600">
                          تحت پوشش کامل
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Official Signatures */}
            <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs text-slate-700 dark:text-slate-300">
              <div>
                <span className="block font-bold">مربی پرورشی و سرپرست اردو</span>
                <span className="text-[11px] text-slate-400 mt-6 block">امضا و تاریخ</span>
              </div>
              <div>
                <span className="block font-bold">معاون آموزشی / انضباطی</span>
                <span className="text-[11px] text-slate-400 mt-6 block">امضا و تاریخ</span>
              </div>
              <div>
                <span className="block font-bold">مدیر واحد آموزشی (دکتر جلالی)</span>
                <span className="text-[11px] text-emerald-600 font-bold mt-4 block">✓ تایید و ممهور الکترونیکی</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsPrintModalOpen(false)}>
              بستن
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Printer size={15} />}
              onClick={() => {
                window.print();
              }}
            >
              ارسال به چاپگر / ذخیره به عنوان PDF
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
