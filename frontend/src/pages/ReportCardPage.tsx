import React, { useState } from 'react';
import {
  Award, Printer, Download, CheckCircle2, TrendingUp,
  FileText, Calendar, User, ShieldCheck, ChevronDown, Lock,
  AlertCircle, ShieldAlert, Users, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Tabs, PageHeader, AccessDeniedGate, RolePermissionBadge } from '../components/common';
import { toPersianDigits, formatScore, cn } from '../utils/persian';
import { INITIAL_REPORT_CARDS, INITIAL_STUDENTS } from '../data/mockData';

export const ReportCardPage: React.FC = () => {
  const { currentUser, activeRole, switchUser } = useAuth();

  // Role checks adhering to Section 35 & 36
  const isBusDriver = activeRole.id === 'bus_driver';
  const isTeacher = activeRole.id === 'teacher' || activeRole.group === 'faculty';
  const isFamily = activeRole.group === 'family';
  const isStudent = activeRole.group === 'student';
  const isAdmin = activeRole.group === 'school_admin' || activeRole.group === 'platform';

  // Section 18 & 36: Bus driver is strictly denied access to student gradebooks
  if (isBusDriver) {
    return (
      <AccessDeniedGate
        title="عدم دسترسی به نمرات و کارنامه تحصیلی دانش‌آموزان"
        requiredRoleOrPermission="grades:view_own یا grades:manage (اولیا، دانش‌آموز، یا کادر آموزشی)"
        reason="بر اساس اصول ۱۸ و ۳۶ سند جامع حاکمیت داده، حساب کاربری راننده سرویس فاقد هرگونه دسترسی به اطلاعات تحصیلی، نمرات و کارنامه‌های دانش‌آموزان می‌باشد."
        currentRoleTitle={activeRole.persianTitle}
        suggestedRoleId="usr_principal"
        suggestedRoleName="دکتر احمدرضا جلالی (مدیر مدرسه)"
        onSwitchUser={switchUser}
      />
    );
  }

  // Active view: combined vs in_person vs online
  const [activeTab, setActiveTab] = useState<'combined' | 'in_person' | 'online'>('combined');

  // Multi-child selection for parents (Section 38)
  const [selectedChildStudentId, setSelectedChildStudentId] = useState<string>('std_parsa');

  // Active report card
  const baseReportCard = INITIAL_REPORT_CARDS[0];

  // Subject filtering for Teachers according to Section 35 (Teacher limited only to their own subjects)
  const displayedGrades = isTeacher
    ? baseReportCard.grades.filter(
        (g) =>
          g.teacherName.includes('کریمی') ||
          g.teacherName.includes(currentUser.fullName) ||
          g.subject.includes('ریاضی') ||
          g.subject.includes('هندسه')
      )
    : baseReportCard.grades;

  const tabs = [
    { id: 'combined', label: 'کارنامه تجمیعی و رسمی' },
    { id: 'in_person', label: 'کارنامه آزمون‌های حضوری' },
    { id: 'online', label: 'کارنامه سنجش آنلاین و مستمر' },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          isTeacher
            ? `ارزشیابی و نمرات دروس تحت تدریس — ${baseReportCard.className}`
            : isFamily
            ? `کارنامه تحصیلی فرزند — ${selectedChildStudentId === 'std_parsa' ? 'پارسا رادمنش' : 'دانیال رادمنش'}`
            : `کارنامه تحصیلی تشریحی — ${baseReportCard.studentName}`
        }
        subtitle={`${baseReportCard.term} · سال تحصیلی ${baseReportCard.academicYear} · ${baseReportCard.className}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<Printer size={15} />} onClick={handlePrint}>
              چاپ نسخه رسمی کارنامه
            </Button>
          </div>
        }
      />

      {/* SECTION 35 BANNER FOR TEACHER SCOPING */}
      {isTeacher && (
        <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
          <ShieldCheck size={20} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block font-bold">
              رعایت اصل ۳۵ سند حاکمیت داده (محدودیت کارنامه معلم):
            </strong>
            <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
              طبق قوانین امنیتی سامانه، دسترسی دبیر صرفاً به نمرات، آزمون‌ها و ارزیابی دروس تحت تدریس خود (حسابان، ریاضیات ۱ و هندسه ۱) محدود است و دسترسی به نمرات سایر همکاران و کارنامه بین‌درسی محرمانه مسدود می‌باشد.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 38: MULTI-CHILD SELECTOR FOR PARENTS */}
      {isFamily && (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
            <Users size={16} className="text-[#2457C5]" />
            <span>انتخاب پرونده تحصیلی فرزند (اصل ۳۸ تفکیک حساب اولیا):</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedChildStudentId('std_parsa')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                selectedChildStudentId === 'std_parsa'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              )}
            >
              پارسا رادمنش (دهم ریاضی الف)
            </button>
            <button
              onClick={() => setSelectedChildStudentId('std_danial')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                selectedChildStudentId === 'std_danial'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              )}
            >
              دانیال رادمنش (هشتم دوره اول)
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} activeId={activeTab} onChange={(id) => setActiveTab(id as any)} />

      {/* Header Summary Box (Hidden for teacher if showing single subjects, or adapted) */}
      {!isTeacher && (
        <Card className="text-right border-blue-200 dark:border-blue-900/50 bg-gradient-to-r from-blue-50/40 to-white dark:from-blue-950/20 dark:to-[#182231]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">معدل کل کارنامه:</span>
              <div className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums mt-1">
                {activeTab === 'in_person'
                  ? formatScore(baseReportCard.inPersonGpa)
                  : activeTab === 'online'
                  ? formatScore(baseReportCard.onlineGpa)
                  : formatScore(baseReportCard.overallGpa)}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                سطح علمی: بسیار عالی (ممتاز)
              </span>
            </div>

            <div>
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">رتبه در کلاس:</span>
              <div className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums mt-1">
                {toPersianDigits(baseReportCard.rankInClass)} <span className="text-xs font-normal text-slate-500">از ۲۸ نفر</span>
              </div>
              <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-0.5 block">
                رتبه پایه: {toPersianDigits(baseReportCard.rankInGrade)} از ۸۴
              </span>
            </div>

            <div>
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">مجموع ساعات حضور:</span>
              <div className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums mt-1">
                {toPersianDigits(baseReportCard.attendanceDaysCount)} <span className="text-xs font-normal text-slate-500">روز</span>
              </div>
              <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-0.5 block">
                غیبت: {toPersianDigits(baseReportCard.absentDaysCount)} روز (موجه)
              </span>
            </div>

            <div>
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">وضعیت ابلاغ رسمی:</span>
              <div className="mt-1 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                <CheckCircle2 size={16} />
                <span>تأیید و نهایی شده</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                امضا: {baseReportCard.finalizedBy}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Grade Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#DCE3EE] dark:border-[#344257] text-[#526176] dark:text-[#B3C0D2]">
                <th className="pb-3 pr-2 font-medium">عنوان درس</th>
                <th className="pb-3 font-medium text-center">ضریب</th>
                {activeTab !== 'online' && <th className="pb-3 font-medium text-center">آزمون کتبی حضوری</th>}
                {activeTab !== 'in_person' && <th className="pb-3 font-medium text-center">سنجش آنلاین</th>}
                <th className="pb-3 font-medium text-center">نمره مستمر کلاسی</th>
                <th className="pb-3 font-medium text-center">نمره نهایی</th>
                <th className="pb-3 font-medium text-center">میانگین کلاس</th>
                <th className="pb-3 font-medium text-center">رتبه در کلاس</th>
                <th className="pb-3 font-medium">دبیر مربوطه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE3EE]/60 dark:divide-[#344257]/60">
              {displayedGrades.map((gr, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 pr-2 font-bold text-[#202B3C] dark:text-[#F1F5FB]">{gr.subject}</td>
                  <td className="py-3 text-center tabular-nums">{toPersianDigits(gr.coefficient)}</td>
                  {activeTab !== 'online' && (
                    <td className="py-3 text-center font-mono tabular-nums">{formatScore(gr.inPersonExamScore)}</td>
                  )}
                  {activeTab !== 'in_person' && (
                    <td className="py-3 text-center font-mono tabular-nums text-[#2457C5] dark:text-[#8BAEFF]">
                      {formatScore(gr.onlineExamScore)}
                    </td>
                  )}
                  <td className="py-3 text-center font-mono tabular-nums">{formatScore(gr.continuousScore)}</td>
                  <td className="py-3 text-center font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                    {formatScore(gr.finalScore)}
                  </td>
                  <td className="py-3 text-center text-slate-500 font-mono tabular-nums">{formatScore(gr.classAverage)}</td>
                  <td className="py-3 text-center tabular-nums">{toPersianDigits(gr.rankInClass)}</td>
                  <td className="py-3 text-[#526176] dark:text-[#B3C0D2]">{gr.teacherName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Verification and Legal seal */}
        <div className="mt-8 pt-4 border-t border-[#DCE3EE] dark:border-[#344257] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#526176] dark:text-[#B3C0D2]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#2457C5] dark:text-[#8BAEFF]" />
            <span>گواهی اصالت الکترونیکی: این کارنامه با امضای دیجیتال معاونت آموزشی صادر گردیده و فاقد خدشه است.</span>
          </div>
          <span className="font-mono text-[11px] tabular-nums">کد رهگیری اصالت: MSH-1403-101-0982</span>
        </div>
      </Card>
    </div>
  );
};
