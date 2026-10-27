import React from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Calendar, Clock, CheckCircle2, AlertCircle,
  FileText, Award, BookOpen, ShieldCheck, HeartHandshake,
  Users, ChevronLeft, ArrowUpRight, ShieldAlert, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits, formatScore } from '../../utils/persian';
import { AssignmentService, ExamService, FamilyService } from '../../services';
import { INITIAL_REPORT_CARDS, INITIAL_ATTENDANCE } from '../../data/mockData';

export const ParentDashboard: React.FC = () => {
  const { currentUser, activeStudent, switchStudent, allStudents } = useAuth();

  const reportCard = INITIAL_REPORT_CARDS.find((r) => r.studentId === activeStudent?.id) || INITIAL_REPORT_CARDS[0];
  const assignments = AssignmentService.getAssignments();
  const submissions = AssignmentService.getSubmissions().filter((s) => s.studentId === activeStudent?.id);
  const links = FamilyService.getLinks();
  const currentLink = links.find((l) => l.guardianUserId === currentUser.id && l.studentId === activeStudent?.id);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`داشبورد اولیا — پورتال تحصیلی ${activeStudent?.fullName || 'فرزند'}`}
        subtitle={`سال تحصیلی ۱۴۰۳-۱۴۰۴ · دبیرستان مشاهیر آینده · کلاس ۱۰۱ (پایه دهم ریاضی)`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/counseling">
              <Button variant="outline" size="sm" icon={<HeartHandshake size={15} />}>
                رزرو مشاوره
              </Button>
            </Link>
            <Link to="/report-card">
              <Button variant="primary" size="sm" icon={<Award size={15} />}>
                مشاهده کارنامه رسمی
              </Button>
            </Link>
          </div>
        }
      />

      {/* Legal & Privacy Banner (Crucial for Separated / Independent Parents) */}
      <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex items-start gap-3">
        <ShieldCheck size={20} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0 mt-0.5" />
        <div className="text-right text-xs text-[#202B3C] dark:text-[#F1F5FB] leading-relaxed">
          <p className="font-bold">امنیت و استقلال کامل داده‌های خانوادگی:</p>
          <p className="text-[#526176] dark:text-[#B3C0D2] mt-0.5">
            حساب کاربری شما به صورت کاملاً مستقل مدیریت می‌شود. شماره تماس، پیام‌های ارسالی، سوابق ورود و درخواست‌های شما تحت هیچ شرایطی به ولی دیگر یا سایر اولیا نمایش داده نمی‌شود.
            {currentLink?.hasLegalRestriction && (
              <span className="block mt-1 font-semibold text-amber-700 dark:text-amber-400">
                توجه: این پیوند دارای محدودیت ترخیص فیزیکی بر اساس دادنامه قضایی است. جهت تحویل فیزیکی دانش‌آموز، لطفاً با دفتر مدرسه هماهنگ فرمایید.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">معدل کل نوبت اول</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {formatScore(reportCard.overallGpa)}
            </span>
            <Badge variant="success">ممتاز</Badge>
          </div>
          <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] block mt-1">
            رتبه در کلاس: <strong className="tabular-nums">{toPersianDigits(reportCard.rankInClass)}</strong> از ۲۸
          </span>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">وضعیت حضور امروز</span>
          <div className="flex items-center gap-2 mt-2">
            <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">حاضر در کلاس</span>
          </div>
          <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] block mt-1">
            ثبت ورود: ساعت <span className="tabular-nums font-mono">۰۸:۰۵</span>
          </span>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">مجموع غیبت‌های ترم</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {toPersianDigits(reportCard.absentDaysCount)} <span className="text-xs font-normal text-slate-500">روز</span>
            </span>
            <Badge variant="neutral">موجه</Badge>
          </div>
          <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] block mt-1">
            تأخیر ثبت‌شده: <strong className="tabular-nums">{toPersianDigits(reportCard.lateDaysCount)}</strong> جلسه
          </span>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">آزمون پیش‌رو</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB] truncate">
              ریاضیات ۱ (آنلاین)
            </span>
          </div>
          <span className="text-[11px] text-amber-700 dark:text-amber-400 block mt-1 font-medium">
            شنبه ۲۸ مهرماه · ساعت ۱۰:۰۰
          </span>
        </Card>
      </div>

      {/* Main Grid: Recent Educational Activities & Quick Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Submissions & Grades */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Grades */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <BookOpen size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                آخرین ارزیابی‌ها و بازخوردهای دبیران
              </h3>
              <Link to="/assignments" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline flex items-center gap-1">
                <span>مشاهده همه تکالیف</span>
                <ChevronLeft size={14} />
              </Link>
            </div>

            <div className="space-y-3">
              {submissions.map((sub) => {
                const asg = assignments.find((a) => a.id === sub.assignmentId);
                return (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 text-right"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB]">{asg?.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">{asg?.subject}</span>
                        <span className="px-2 py-0.5 text-xs font-black rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 tabular-nums">
                          {formatScore(sub.score)} از ۲۰
                        </span>
                      </div>
                    </div>
                    {sub.feedback && (
                      <p className="text-xs text-[#526176] dark:text-[#B3C0D2] bg-white dark:bg-[#182231] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 mt-2">
                        <strong className="text-[#2457C5] dark:text-[#8BAEFF] ml-1">بازخورد دبیر ({sub.gradedBy}):</strong>
                        {sub.feedback}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Subject Grades Snapshot from Report Card */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <Award size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                نمای تفکیکی نمرات دروس اصلی (ترم اول)
              </h3>
              <Link to="/report-card" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                کارنامه کامل تشریحی
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#DCE3EE] dark:border-[#344257] text-[#526176] dark:text-[#B3C0D2]">
                    <th className="pb-2 font-medium">عنوان درس</th>
                    <th className="pb-2 font-medium text-center">ضریب</th>
                    <th className="pb-2 font-medium text-center">آزمون حضوری</th>
                    <th className="pb-2 font-medium text-center">آزمون آنلاین</th>
                    <th className="pb-2 font-medium text-center">میانگین کلاس</th>
                    <th className="pb-2 font-medium text-center">نمره نهایی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE3EE]/60 dark:divide-[#344257]/60">
                  {reportCard.grades.map((gr, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 font-bold text-[#202B3C] dark:text-[#F1F5FB]">{gr.subject}</td>
                      <td className="py-2.5 text-center tabular-nums">{toPersianDigits(gr.coefficient)}</td>
                      <td className="py-2.5 text-center font-mono tabular-nums">{formatScore(gr.inPersonExamScore)}</td>
                      <td className="py-2.5 text-center font-mono tabular-nums text-[#2457C5] dark:text-[#8BAEFF]">{formatScore(gr.onlineExamScore)}</td>
                      <td className="py-2.5 text-center text-slate-500 tabular-nums">{formatScore(gr.classAverage)}</td>
                      <td className="py-2.5 text-center font-black text-emerald-700 dark:text-emerald-400 tabular-nums">{formatScore(gr.finalScore)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Col: Quick Access & School Communication */}
        <div className="space-y-6">
          {/* Smart AI Educational Analysis Widget */}
          <Card className="border-[#2457C5]/30 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
            <div className="flex items-center gap-2 text-[#2457C5] dark:text-[#8BAEFF] mb-2 font-bold text-sm">
              <Sparkles size={16} />
              <span>تحلیل هوشمند عملکرد فرزند</span>
            </div>
            <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed mb-4">
              بر اساس تکالیف اخیر و نتایج آزمون‌های مستمر، نقاط قوت و مباحث تمرینی پارسا رادمنش تحلیل گردیده است.
            </p>
            <div className="space-y-2 mb-4 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>تسلط بالا در رسم توابع و هندسه تحلیلی</span>
              </div>
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl">
                <AlertCircle size={14} className="shrink-0" />
                <span>نیاز به تمرین تکمیلی در عدم قطعیت فیزیک</span>
              </div>
            </div>
            <Link to="/performance-analytics">
              <Button variant="secondary" size="sm" className="w-full">
                مشاهده گزارش کامل تحلیل هوشمند
              </Button>
            </Link>
          </Card>

          {/* Quick Actions Card */}
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3">
              دسترسی‌های سریع اولیا
            </h3>
            <div className="space-y-2">
              <Link to="/consent-forms" className="block">
                <div className="p-2.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                    <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">رضایت‌نامه‌های اردو و فعالیت</span>
                  </div>
                  <span className="text-[11px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">۱ مورد جدید</span>
                </div>
              </Link>

              <Link to="/pta" className="block">
                <div className="p-2.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                    <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">انجمن اولیا و نظرسنجی‌ها</span>
                  </div>
                  <ChevronLeft size={14} className="text-slate-400" />
                </div>
              </Link>

              <Link to="/counseling" className="block">
                <div className="p-2.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <HeartHandshake size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                    <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">درخواست جلسه با مشاور</span>
                  </div>
                  <ChevronLeft size={14} className="text-slate-400" />
                </div>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
