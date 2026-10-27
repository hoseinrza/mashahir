import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, FileText, CheckCircle2, Clock, Calendar,
  Award, Sparkles, AlertCircle, ArrowLeft, HeartHandshake
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits, formatScore } from '../../utils/persian';
import { AssignmentService, ExamService } from '../../services';
import { INITIAL_REPORT_CARDS } from '../../data/mockData';

export const StudentDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const assignments = AssignmentService.getAssignments();
  const submissions = AssignmentService.getSubmissions().filter((s) => s.studentId === 'std_parsa');
  const exams = ExamService.getExams();
  const reportCard = INITIAL_REPORT_CARDS[0];

  const pendingAssignments = assignments.filter((a) => !submissions.some((s) => s.assignmentId === a.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`سلام ${currentUser.fullName} عزیز؛ روز پرانرژی داشته باشی!`}
        subtitle="برنامه درسی و تکالیف پایه دهم ریاضی و فیزیک · کلاس ۱۰۱"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/exams">
              <Button variant="primary" size="sm" icon={<FileText size={15} />}>
                ورود به سامانه آزمون آنلاین
              </Button>
            </Link>
          </div>
        }
      />

      {/* Hero Notice Strip: Next Online Exam */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="inline-block text-[11px] font-bold bg-white/20 px-2.5 py-1 rounded-lg mb-2">
            آزمون آنلاین پیش‌رو
          </span>
          <h2 className="text-lg font-bold">آزمون دوره‌ای ریاضیات ۱ (هندسه و جبر تحلیلی)</h2>
          <p className="text-xs text-blue-100 mt-1">
            شنبه ۲۸ مهرماه · ساعت ۱۰:۰۰ صبح · مدت زمان: ۲۵ دقیقه · شامل ۴ تست و ۱ سوال تشریحی
          </p>
        </div>
        <Link to="/exams" className="shrink-0">
          <Button variant="secondary" size="md">
            آمادگی و ورود به آزمون
          </Button>
        </Link>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">معدل ترم جاری</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {formatScore(reportCard.overallGpa)}
            </span>
            <Badge variant="success">رتبه ۳ کلاس</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">تکالیف نیازمند ارسال</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {toPersianDigits(pendingAssignments.length)}
            </span>
            <Badge variant="warning">مهلت تا ۲۸ مهر</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">حضور در کلاس‌ها</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              ۹۸٪
            </span>
            <Badge variant="success">منظم</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">امتیاز پژوهشی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {toPersianDigits(185)}
            </span>
            <Badge variant="primary">سطح طلایی</Badge>
          </div>
        </Card>
      </div>

      {/* Tasks and Assignments Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <BookOpen size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                تکالیف درسی و مهلت‌های تحویل
              </h3>
              <Link to="/assignments" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                مشاهده همه
              </Link>
            </div>

            <div className="space-y-3">
              {assignments.map((asg) => {
                const sub = submissions.find((s) => s.assignmentId === asg.id);
                return (
                  <div
                    key={asg.id}
                    className="p-4 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 text-right"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="text-xs font-bold text-[#2457C5] dark:text-[#8BAEFF] block">{asg.subject}</span>
                        <h4 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mt-0.5">{asg.title}</h4>
                      </div>
                      <div className="shrink-0">
                        {sub?.status === 'graded' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            نمره: {formatScore(sub.score)} از ۲۰
                          </span>
                        ) : sub ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-100 text-[#2457C5] dark:bg-blue-950 dark:text-blue-300">
                            ارسال شده (در انتظار تصحیح)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            مهلت: {asg.dueDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed mb-3">
                      {asg.description}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                      <span className="text-[#526176] dark:text-[#B3C0D2]">مدرس: {asg.teacherName}</span>
                      <Link to="/assignments">
                        <Button variant="outline" size="sm">
                          {sub ? 'مشاهده برگه ارسالی' : 'ارسال پاسخ تکلیف'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* Daily Schedule */}
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
              برنامه کلاسی امروز (دوشنبه)
            </h3>
            <div className="space-y-2.5 text-xs text-right">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB] block">زنگ اول: ریاضیات ۱</span>
                  <span className="text-[#526176] dark:text-[#B3C0D2]">استاد کریمی · کلاس ۱۰۱</span>
                </div>
                <span className="font-mono text-slate-500 tabular-nums">۰۸:۰۰ - ۰۹:۳۰</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB] block">زنگ دوم: فیزیک ۱ و آزمایشگاه</span>
                  <span className="text-[#526176] dark:text-[#B3C0D2]">استاد کریمی · سالن فیزیک</span>
                </div>
                <span className="font-mono text-slate-500 tabular-nums">۰۹:۴۵ - ۱۱:۱۵</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB] block">زنگ سوم: فارسی و نگارش</span>
                  <span className="text-[#526176] dark:text-[#B3C0D2]">دکتر جلالی · کلاس ۱۰۱</span>
                </div>
                <span className="font-mono text-slate-500 tabular-nums">۱۱:۳۰ - ۱۳:۰۰</span>
              </div>
            </div>
          </Card>

          {/* Quick Guidance Box */}
          <Card className="border-[#2457C5]/30">
            <div className="flex items-center gap-2 text-[#2457C5] dark:text-[#8BAEFF] mb-2 font-bold text-sm">
              <Sparkles size={16} />
              <span>پیشنهاد مشاور تحصیلی</span>
            </div>
            <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed mb-3">
              «مرور فرمول‌های دلتا و رسم سهمی قبل از آزمون شنبه فراموش نشود. برای آمادگی بهتر، حل مسائل تشریحی کتاب توصیه می‌شود.»
            </p>
            <Link to="/counseling">
              <Button variant="ghost" size="sm" className="w-full text-xs">
                رزرو وقت گفتگو با مشاور تحصیلی
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
};
