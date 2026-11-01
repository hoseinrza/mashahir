import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, CheckSquare, BookOpen, FileText, ArrowLeftRight, CalendarClock,
  RefreshCw, AlertCircle, Video, Clock, Inbox, GraduationCap, Paperclip,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader, EmptyState, Skeleton } from '../../components/common';
import { toPersianDigits, formatScore, cn } from '../../utils/persian';
import { formatJalaliDateTime } from '../../utils/jalali';
import {
  ApiAcademicService, ApiAssignmentService,
  type AssignmentSummary, type AttendanceSessionSummary, type ExamSummary,
  type GradeRoster, type TeachingSubject, type TimetableSlot, type ClassroomSummary,
} from '../../api/data';
import {
  minutesOfDay, timeToMinutes, todayWeekday, weekdayName, formatPeriodTime,
} from '../../utils/schedule';

/** A settled fetch: a failed section degrades to an empty list — never fake data. */
interface TeacherBoard {
  slots: TimetableSlot[];
  classrooms: ClassroomSummary[];
  assignments: AssignmentSummary[];
  exams: ExamSummary[];
  sessions: AttendanceSessionSummary[];
  studentCount: number | null;
  pending: { assignment: AssignmentSummary; studentName: string; submittedAt: string | null }[];
  pendingTotal: number;
  subjects: TeachingSubject[];
  roster: GradeRoster | null;
  rosterLabel: string | null;
}

const isSettled = <T,>(r: PromiseSettledResult<T>): r is PromiseFulfilledResult<T> => r.status === 'fulfilled';

export const TeacherDashboard: React.FC = () => {
  const {
    currentUser, activeRole, userAssignments, switchContext,
    activeSchoolName, hasAccess,
  } = useAuth();

  const [board, setBoard] = useState<TeacherBoard | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const parentAssignment = userAssignments.find((ra) => ra.roleId === 'guardian');
  const canSeeStudents = hasAccess('students:view');
  const canSeeAttendance = hasAccess('attendance:view') || hasAccess('attendance:record');
  const canSeeAssignments = hasAccess('assignments:view');
  const canSeeExams = hasAccess('exams:results_view');
  const canRecordGrades = hasAccess('grades:record');

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [slotsR, classroomsR, assignmentsR, examsR, sessionsR, studentsR] = await Promise.allSettled([
        ApiAcademicService.timetable(),
        ApiAcademicService.classrooms(),
        canSeeAssignments ? ApiAcademicService.assignments() : Promise.resolve([] as AssignmentSummary[]),
        canSeeExams ? ApiAcademicService.exams() : Promise.resolve([] as ExamSummary[]),
        canSeeAttendance ? ApiAcademicService.attendanceSessions() : Promise.resolve([] as AttendanceSessionSummary[]),
        canSeeStudents ? ApiAcademicService.studentsInScope() : Promise.resolve(null),
      ]);

      const assignments = isSettled(assignmentsR) ? assignmentsR.value : [];

      // Grade book: the roster of students this teacher scores (دفتر نمره).
      let subjects: TeachingSubject[] = [];
      let roster: GradeRoster | null = null;
      let rosterLabel: string | null = null;
      if (canRecordGrades) {
        try {
          const [mySubjects, terms] = await Promise.all([
            ApiAcademicService.mySubjects(),
            ApiAcademicService.terms(),
          ]);
          subjects = mySubjects;
          const first = mySubjects[0];
          const term = terms[0];
          if (first && term) {
            roster = await ApiAcademicService.roster(first.id, term.id);
            rosterLabel = `${first.subject} — ${first.classroom}`;
          }
        } catch {
          roster = null;
        }
      }

      // Grading queue: submissions are scoped server-side to this teacher's classes.
      const perAssignment = await Promise.all(
        assignments.slice(0, 12).map(async (a) => {
          try {
            const subs = await ApiAssignmentService.submissionsOf(a.ulid);
            return { assignment: a, subs };
          } catch {
            return null;
          }
        }),
      );

      const pending: TeacherBoard['pending'] = [];
      let pendingTotal = 0;
      perAssignment.forEach((entry) => {
        if (!entry) return;
        const waiting = entry.subs.filter((s) => s.status === 'submitted' || s.status === 'late');
        pendingTotal += waiting.length;
        waiting.slice(0, 2).forEach((s) => pending.push({
          assignment: entry.assignment,
          studentName: s.studentName,
          submittedAt: s.submittedAt,
        }));
      });

      setBoard({
        slots: isSettled(slotsR) ? slotsR.value : [],
        classrooms: isSettled(classroomsR) ? classroomsR.value : [],
        assignments,
        exams: isSettled(examsR) ? examsR.value : [],
        sessions: isSettled(sessionsR) ? sessionsR.value : [],
        studentCount: isSettled(studentsR) && studentsR.value ? studentsR.value.length : null,
        pending,
        pendingTotal,
        subjects,
        roster,
        rosterLabel,
      });
    } catch {
      setFailed(true);
    }
  }, [canSeeAssignments, canSeeAttendance, canSeeExams, canSeeStudents, canRecordGrades]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = todayWeekday(now);
  const nowMinutes = minutesOfDay(now);
  const pendingTotal = board?.pendingTotal ?? 0;
  const todaysSlots = (board?.slots ?? [])
    .filter((s) => s.weekday === today)
    .sort((a, b) => a.period - b.period);

  const currentSlot = todaysSlots.find(
    (s) => nowMinutes >= timeToMinutes(s.startsAt) && nowMinutes < timeToMinutes(s.endsAt),
  );
  const nextSlot = todaysSlots.find((s) => timeToMinutes(s.startsAt) > nowMinutes);

  const myClassroomTitles = Array.from(new Set(
    (board?.slots ?? []).filter((s) => s.classroom).map((s) => s.classroom as string),
  ));

  const todaySessions = (board?.sessions ?? []).filter((s) => {
    const iso = new Date(`${s.heldOn}T00:00:00`);
    return iso.toDateString() === now.toDateString();
  });

  if (!board && !failed) {
    return (
      <div className="space-y-6">
        <PageHeader title={`میز کار آموزشی — ${currentUser.fullName}`} subtitle="در حال خواندن داده‌های واقعی سامانه…" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="space-y-6">
        <PageHeader title={`میز کار آموزشی — ${currentUser.fullName}`} />
        <Card className="border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20">
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <AlertCircle size={26} className="text-rose-600" />
            <p className="text-sm font-bold text-rose-800 dark:text-rose-300">دریافت اطلاعات میز کار ممکن نشد.</p>
            <p className="text-xs text-rose-700/80 dark:text-rose-400/80">
              ارتباط با سرور برقرار نشد؛ پس از برطرف شدن خطا دوباره تلاش کنید.
            </p>
            <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>تلاش دوباره</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`میز کار آموزشی — ${currentUser.fullName}`}
        subtitle={`${activeRole.persianTitle} · ${activeSchoolName ?? '—'}`}
        actions={
          <div className="flex items-center gap-2">
            {canSeeAttendance && (
              <Link to="/attendance">
                <Button variant="outline" size="sm" icon={<CheckSquare size={15} />}>ثبت حضور و غیاب</Button>
              </Link>
            )}
            {canRecordGrades && (
              <Link to="/grade-entry">
                <Button variant="primary" size="sm" icon={<GraduationCap size={15} />}>دفتر نمره و ثبت نمره</Button>
              </Link>
            )}
            {canSeeAssignments && (
              <Link to="/assignments">
                <Button variant="outline" size="sm" icon={<BookOpen size={15} />}>تکالیف و تصحیح</Button>
              </Link>
            )}
          </div>
        }
      />

      {parentAssignment && (
        <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-right">
            <ArrowLeftRight size={20} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">حساب شما دارای دو زمینه کاری مجزا است:</span>
              <p className="text-[#526176] dark:text-[#B3C0D2] mt-0.5">
                هم‌اکنون در زمینه «{activeRole.persianTitle}» هستید؛ می‌توانید بدون تداخل دسترسی‌ها به زمینه «ولی دانش‌آموز» سوییچ کنید.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => switchContext(parentAssignment.id)}>
            سوییچ به زمینه والد
          </Button>
        </div>
      )}

      {/* Today's teaching schedule — real timetable */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
            <CalendarClock size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
            برنامه تدریس امروز — {weekdayName(today)}
          </h3>
          <span className="text-[11px] text-slate-400 tabular-nums">
            {toPersianDigits(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}
          </span>
        </div>

        {todaysSlots.length === 0 ? (
          <EmptyState
            title="امروز جلسه تدریسی در برنامه شما ثبت نشده است"
            description="برنامه هفتگی از ماژول آکادمیک مدرسه خوانده می‌شود؛ برای مشاهده روزهای دیگر به بخش برنامه هفتگی مراجعه کنید."
          />
        ) : (
          <div className="space-y-2.5 text-xs">
            {todaysSlots.map((slot) => {
              const isCurrent = currentSlot?.id === slot.id;
              return (
                <div
                  key={slot.id}
                  className={cn(
                    'p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2',
                    isCurrent
                      ? 'border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/25'
                      : 'border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60',
                  )}
                >
                  <div className="text-right">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                        زنگ {toPersianDigits(slot.period)}: {slot.subject ?? '—'}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          در حال برگزاری
                        </span>
                      )}
                    </div>
                    <span className="text-[#526176] dark:text-[#B3C0D2]">{slot.classroom ?? '—'}</span>
                  </div>
                  <span className="font-mono text-slate-500 tabular-nums shrink-0">
                    {formatPeriodTime(slot.startsAt)} - {formatPeriodTime(slot.endsAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {(currentSlot || nextSlot) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {currentSlot && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 text-right">
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 block">کلاس جاری شما</span>
                <p className="text-sm font-extrabold text-[#202B3C] dark:text-[#F1F5FB] mt-1">{currentSlot.subject}</p>
                <p className="text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-0.5">
                  {currentSlot.classroom} · {formatPeriodTime(currentSlot.startsAt)} تا {formatPeriodTime(currentSlot.endsAt)}
                </p>
                {canSeeAttendance && (
                  <Link to="/attendance" className="inline-block mt-2">
                    <Button variant="primary" size="sm" icon={<CheckSquare size={13} />}>ثبت حضور و غیاب این کلاس</Button>
                  </Link>
                )}
              </div>
            )}
            {nextSlot && (
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-200 dark:border-blue-900/50 text-right">
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block">جلسه بعدی امروز</span>
                <p className="text-sm font-extrabold text-[#202B3C] dark:text-[#F1F5FB] mt-1">{nextSlot.subject}</p>
                <p className="text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-0.5">
                  {nextSlot.classroom} · شروع {formatPeriodTime(nextSlot.startsAt)}
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* KPIs — every figure read from the backend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کلاس‌های دارای تدریس</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {toPersianDigits(myClassroomTitles.length)}
            </span>
            <Badge variant="primary">در {toPersianDigits(board?.classrooms.length ?? 0)} کلاس مدرسه</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">دانش‌آموزان در دسترسی من</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {board?.studentCount === null ? '—' : toPersianDigits(board?.studentCount ?? 0)}
            </span>
            <Badge variant="neutral">قید ش۲</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پاسخ‌برگ در انتظار تصحیح</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {toPersianDigits(pendingTotal)}
            </span>
            <Badge variant={pendingTotal > 0 ? 'warning' : 'success'}>
              {pendingTotal > 0 ? 'نیازمند اقدام' : 'همه تصحیح شده'}
            </Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">آزمون‌های قابل مشاهده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {toPersianDigits(board?.exams.length ?? 0)}
            </span>
            <Badge variant="success">{toPersianDigits((board?.exams ?? []).filter((e) => e.status === 'published').length)} منتشرشده</Badge>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Grading queue */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <Inbox size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                پاسخ‌برگ‌های ارسالی (آماده نمره‌دهی)
              </h3>
              {canSeeAssignments && (
                <Link to="/assignments" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                  مدیریت همه تکالیف
                </Link>
              )}
            </div>

            {pendingTotal === 0 ? (
              <EmptyState
                title="پاسخ‌برگ در انتظار تصحیح وجود ندارد"
                description="به‌محض ارسال پاسخ توسط دانش‌آموزان، اینجا فهرست می‌شود."
              />
            ) : (
              <div className="space-y-3">
                {(board?.pending ?? []).map((row, idx) => (
                  <div
                    key={`${row.assignment.ulid}-${idx}`}
                    className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB]">{row.studentName}</span>
                        <Badge variant="warning">در انتظار نمره‌دهی</Badge>
                      </div>
                      <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-1">
                        {row.assignment.title} · {row.assignment.subject}
                      </p>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        زمان ارسال: {row.submittedAt ? formatJalaliDateTime(row.submittedAt) : '—'}
                      </span>
                    </div>
                    {canSeeAssignments && (
                      <Link to="/assignments" className="shrink-0">
                        <Button variant="primary" size="sm">ثبت نمره و بازخورد</Button>
                      </Link>
                    )}
                  </div>
                ))}
                {pendingTotal > (board?.pending.length ?? 0) && (
                  <p className="text-[11px] text-slate-400 text-center pt-1">
                    و {toPersianDigits(pendingTotal - (board?.pending.length ?? 0))} مورد دیگر در فهرست تکالیف
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Grade book: the student list the teacher enters scores for */}
          {canRecordGrades && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                  <GraduationCap size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                  دانش‌آموزان برای ثبت نمره
                </h3>
                <span className="text-[11px] text-slate-400">
                  {board?.rosterLabel ?? '—'}
                  {board?.roster?.classAvgOutOf20 !== null && board?.roster?.classAvgOutOf20 !== undefined
                    ? ` · میانگین کلاس ${formatScore(board.roster.classAvgOutOf20)}`
                    : ''}
                </span>
              </div>

              {(board?.roster?.rows.length ?? 0) === 0 ? (
                <EmptyState
                  title="دانش‌آموزی در درس-کلاس انتخاب‌شده ثبت نشده است"
                  description="پس از ثبت نام در کلاس، فهرست نمره‌دهی اینجا و در دفتر نمره نمایش داده می‌شود."
                />
              ) : (
                <div className="space-y-2 text-xs">
                  {(board?.roster?.rows ?? []).map((row) => (
                    <div
                      key={row.studentUlid}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 text-right"
                    >
                      <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">{row.studentName}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={row.finalStatus === 'published'
                            ? 'success'
                            : row.finalStatus === 'approved'
                              ? 'primary'
                              : row.finalStatus === 'draft'
                                ? 'warning'
                                : 'neutral'}
                        >
                          {row.finalStatus === 'published'
                            ? 'منتشرشده'
                            : row.finalStatus === 'approved'
                              ? 'تأییدشده'
                              : row.finalStatus === 'draft'
                                ? 'پیش‌نویس'
                                : 'بدون نمره'}
                        </Badge>
                        <span className="font-black tabular-nums text-[#2457C5] dark:text-[#8BAEFF]">
                          {row.avgOutOf20 === null ? '—' : `${formatScore(row.avgOutOf20)} از ۲۰`}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-4">
                {(board?.subjects ?? []).slice(1).map((s) => (
                  <span
                    key={s.id}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-[#526176] dark:text-[#B3C0D2]"
                  >
                    {s.subject} — {s.classroom}
                  </span>
                ))}
                <Link to="/grade-entry" className="mr-auto">
                  <Button variant="primary" size="sm" icon={<CheckSquare size={14} />}>ورود به دفتر نمره و ثبت نمره</Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Recent assignments */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <FileText size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                تکالیف اخیر کلاس‌های من
              </h3>
              <span className="text-[11px] text-slate-400">{toPersianDigits(board?.assignments.length ?? 0)} مورد</span>
            </div>
            {(board?.assignments.length ?? 0) === 0 ? (
              <EmptyState title="تکلیفی تعریف نشده است" description="از بخش تکالیف می‌توانید برای کلاس‌های خود تکلیف تعریف کنید." />
            ) : (
              <div className="space-y-2.5">
                {(board?.assignments ?? []).slice(0, 5).map((a) => (
                  <div
                    key={a.ulid}
                    className="p-3 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 flex items-center justify-between gap-3 text-right"
                  >
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-[#2457C5] dark:text-[#8BAEFF] block">
                        {a.subject} · {a.classroom}
                      </span>
                      <h4 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] truncate">{a.title}</h4>
                      <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] flex items-center gap-1 mt-1">
                        <Paperclip size={11} />
                        {a.fileCount > 0 ? `${toPersianDigits(a.fileCount)} پیوست` : 'بدون پیوست'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
                      <Clock size={12} />
                      {a.dueAt ? formatJalaliDateTime(a.dueAt) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Attendance sessions today */}
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <CheckSquare size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
              جلسات حضور و غیاب امروز
            </h3>
            {!canSeeAttendance ? (
              <p className="text-xs text-slate-500">این بخش برای نقش شما مجاز نیست.</p>
            ) : todaySessions.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3 leading-relaxed">
                امروز جلسه‌ای ثبت نشده است. با شروع زنگ می‌توانید پیش‌نویس حضور و غیاب را باز کنید.
              </p>
            ) : (
              <div className="space-y-2 text-xs">
                {todaySessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                  >
                    <span className="text-right">
                      <span className="font-bold block text-[#202B3C] dark:text-[#F1F5FB]">{s.subject ?? '—'}</span>
                      <span className="text-[#526176] dark:text-[#B3C0D2]">زنگ {toPersianDigits(s.period)}</span>
                    </span>
                    <Badge variant={s.status === 'draft' ? 'warning' : 'success'}>
                      {s.status === 'draft' ? 'پیش‌نویس' : s.status === 'finalized' ? 'نهایی' : 'اصلاح‌شده'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {canSeeAttendance && (
              <Link to="/attendance">
                <Button variant="outline" size="sm" className="w-full mt-3">دفتر حضور و غیاب</Button>
              </Link>
            )}
          </Card>

          {/* My classrooms */}
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <Users size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
              کلاس‌های دارای تدریس من
            </h3>
            {myClassroomTitles.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3">هنوز درسی در برنامه هفتگی به شما تخصیص نیافته است.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {myClassroomTitles.map((title) => (
                  <li
                    key={title}
                    className="p-2.5 rounded-lg border border-[#DCE3EE] dark:border-[#344257] text-right font-medium"
                  >
                    {title}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <Video size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
              کلاس آنلاین
            </h3>
            <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed mb-3">
              برگزاری و مدیریت اتاق‌های اسکای‌روم از این بخش انجام می‌شود.
            </p>
            {hasAccess('online_classes:view') && (
              <Link to="/online-classes">
                <Button variant="outline" size="sm" className="w-full">مدیریت کلاس‌های آنلاین</Button>
              </Link>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
