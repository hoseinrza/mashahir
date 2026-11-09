import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, BookOpen, Calendar, Award, Users, Loader2, AlertCircle, RefreshCw, FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader, EmptyState } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { formatJalaliDateTime } from '../../utils/jalali';
import {
  ApiAcademicService, ApiReportCardService,
  AssignmentSummary, ClassroomSummary, ExamSummary, ReportCardRow,
} from '../../api/data';
import { ApiError } from '../../api/client';

export const EducationalDeputyDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  const [classrooms, setClassrooms] = useState<ClassroomSummary[] | null>(null);
  const [studentsCount, setStudentsCount] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<AssignmentSummary[] | null>(null);
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [reportCards, setReportCards] = useState<ReportCardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    Promise.all([
      ApiAcademicService.classrooms(),
      ApiAcademicService.studentsInScope(),
      ApiAcademicService.assignments(),
      ApiAcademicService.exams(),
      ApiReportCardService.list().catch(() => []),
    ])
      .then(([roomRows, studentRows, assignmentRows, examRows, cardRows]) => {
        if (cancelled) return;
        setClassrooms(roomRows);
        setStudentsCount(studentRows.length);
        setAssignments(assignmentRows);
        setExams(examRows);
        setReportCards(cardRows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت دادهٔ آموزشی');
      });

    return () => { cancelled = true; };
  }, [reloadKey]);

  const upcomingExams = (exams ?? [])
    .filter((exam) => exam.opensAt !== null)
    .sort((a, b) => new Date(a.opensAt ?? 0).getTime() - new Date(b.opensAt ?? 0).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`داشبورد معاونت آموزشی — ${currentUser.fullName}`}
        subtitle="نظارت بر کلاس‌ها، تکالیف، آزمون‌ها و کارنامه‌های صادرشده — همه از دادهٔ زندهٔ مدرسه"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/exams">
              <Button variant="outline" size="sm" icon={<Calendar size={15} />}>
                تقویم امتحانات
              </Button>
            </Link>
            <Link to="/report-card">
              <Button variant="primary" size="sm" icon={<Award size={15} />}>
                بررسی و تأیید کارنامه‌ها
              </Button>
            </Link>
          </div>
        }
      />

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
            <span className="flex items-center gap-2 font-bold"><AlertCircle size={15} />{error}</span>
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setReloadKey((k) => k + 1)}>
              تلاش دوباره
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کلاس‌های مدرسه</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {classrooms === null ? '…' : toPersianDigits(classrooms.length)}
            </span>
            <Badge variant="primary"><BookOpen size={11} /> دورهٔ دوم</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">دانش‌آموزان در دسترس شما</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {studentsCount === null ? '…' : toPersianDigits(studentsCount)}
            </span>
            <Badge variant="success"><Users size={11} /> نفر</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">تکالیف تعریف‌شده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {assignments === null ? '…' : toPersianDigits(assignments.length)}
            </span>
            <Badge variant="neutral">همهٔ دروس</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">آزمون‌ها و کارنامه‌ها</span>
          <div className="flex items-baseline justify-between mt-2 gap-2">
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {exams === null ? '…' : toPersianDigits(exams.length)}
              <span className="text-slate-300 mx-1">/</span>
              {reportCards === null ? '…' : toPersianDigits(reportCards.length)}
            </span>
            <Badge variant="warning">آزمون / کارنامه</Badge>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <BookOpen size={16} className="text-[#2457C5]" />
                کلاس‌های فعال و پایهٔ تحصیلی
              </h3>
              <Link to="/classrooms" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                مدیریت کلاس‌ها
              </Link>
            </div>

            {classrooms === null ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#526176] dark:text-[#B3C0D2]">
                <Loader2 size={18} className="animate-spin" /> در حال دریافت کلاس‌ها…
              </div>
            ) : classrooms.length === 0 ? (
              <EmptyState
                icon={<GraduationCap size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
                title="کلاسی ثبت نشده است"
                description="با ساخت کلاس در بخش مدیریت کلاس‌ها، این فهرست پر می‌شود."
              />
            ) : (
              <div className="space-y-3">
                {classrooms.map((cls) => (
                  <div
                    key={cls.ulid}
                    className="p-4 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 text-right flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB]">{cls.title}</span>
                        {cls.gradeLevel && <Badge variant="primary">{cls.gradeLevel}</Badge>}
                      </div>
                      <span className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-1 block">
                        {cls.academicYear ?? 'سال تحصیلی ثبت نشده'}
                      </span>
                    </div>

                    <Link to="/attendance">
                      <Button variant="outline" size="sm">مشاهده دفتر کلاسی</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-[#2457C5]" />
              آزمون‌های پیش‌رو
            </h3>

            {exams === null ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#526176] dark:text-[#B3C0D2]">
                <Loader2 size={16} className="animate-spin" /> …
              </div>
            ) : upcomingExams.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">آزمونی با زمان شروع ثبت نشده است.</p>
            ) : (
              <div className="space-y-2.5 text-xs text-right">
                {upcomingExams.map((exam) => (
                  <div key={exam.ulid} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                    <strong className="block text-[#202B3C] dark:text-[#F1F5FB]">{exam.title}</strong>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {formatJalaliDateTime(exam.opensAt)}
                      {exam.subject ? ` · ${exam.subject}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <FileText size={16} className="text-[#2457C5]" />
              کارنامه‌های صادرشده
            </h3>
            <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
              {reportCards === null
                ? 'در حال دریافت…'
                : reportCards.length === 0
                ? 'هنوز کارنامه‌ای منتشر نشده است.'
                : `${toPersianDigits(reportCards.length)} کارنامه در سامانه ثبت شده است.`}
            </p>
            <Link to="/report-card" className="inline-block mt-3">
              <Button variant="outline" size="sm">مشاهدهٔ فهرست کامل</Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
};
