import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, FileText, CheckCircle2, Clock, CalendarClock, GraduationCap,
  AlertCircle, RefreshCw, Percent, Inbox, Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader, EmptyState, Skeleton } from '../../components/common';
import { toPersianDigits, formatScore, cn } from '../../utils/persian';
import { formatJalaliDate, formatJalaliDateTime } from '../../utils/jalali';
import {
  ApiAcademicService, ApiAssignmentService, ApiAttendanceService,
  type AssignmentSubmission, type AssignmentSummary, type ClassroomSummary,
  type ExamSummary, type GradeSummary, type TimetableSlot,
} from '../../api/data';
import { minutesOfDay, timeToMinutes, todayWeekday, weekdayName, formatPeriodTime } from '../../utils/schedule';

const isSettled = <T,>(r: PromiseSettledResult<T>): r is PromiseFulfilledResult<T> => r.status === 'fulfilled';

interface StudentBoard {
  classrooms: ClassroomSummary[];
  slots: TimetableSlot[];
  assignments: AssignmentSummary[];
  mySubmissions: Record<string, AssignmentSubmission>;
  exams: ExamSummary[];
  grades: GradeSummary[];
  attendance: { date: string; period: number; subject: string | null; status: string }[];
}

export const StudentDashboard: React.FC = () => {
  const { currentUser, activeRole, activeSchoolName, hasAccess } = useAuth();
  const [board, setBoard] = useState<StudentBoard | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const canSeeAttendance = hasAccess('attendance:view');
  // Students/guardians never get grades.view — /grades serves them published rows
  // through reportcards.view (GradesApiController::index).
  const canSeeGrades = hasAccess('grades:view') || hasAccess('reportcards:view');

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [classroomsR, slotsR, assignmentsR, examsR, gradesR, studentsR] = await Promise.allSettled([
        ApiAcademicService.classrooms(),
        ApiAcademicService.timetable(),
        ApiAcademicService.assignments(),
        ApiAcademicService.exams(),
        canSeeGrades ? ApiAcademicService.grades() : Promise.resolve([] as GradeSummary[]),
        ApiAcademicService.studentsInScope(),
      ]);

      const assignments = isSettled(assignmentsR) ? assignmentsR.value : [];

      // The student's own row for each assignment (server-side sh4 scoping).
      const rows = await Promise.all(
        assignments.slice(0, 15).map(async (a) => {
          try {
            const subs = await ApiAssignmentService.submissionsOf(a.ulid);
            return { ulid: a.ulid, mine: subs[0] ?? null };
          } catch {
            return { ulid: a.ulid, mine: null };
          }
        }),
      );
      const mySubmissions: StudentBoard['mySubmissions'] = {};
      rows.forEach((r) => { if (r.mine) mySubmissions[r.ulid] = r.mine; });

      let attendance: StudentBoard['attendance'] = [];
      if (canSeeAttendance && isSettled(studentsR)) {
        const me = studentsR.value[0];
        if (me) {
          try {
            attendance = await ApiAttendanceService.studentTimeline(me.ulid);
          } catch {
            attendance = [];
          }
        }
      }

      setBoard({
        classrooms: isSettled(classroomsR) ? classroomsR.value : [],
        slots: isSettled(slotsR) ? slotsR.value : [],
        assignments,
        mySubmissions,
        exams: isSettled(examsR) ? examsR.value : [],
        grades: isSettled(gradesR) ? gradesR.value : [],
        attendance,
      });
    } catch {
      setFailed(true);
    }
  }, [canSeeAttendance, canSeeGrades]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = todayWeekday(now);
  const nowMinutes = minutesOfDay(now);

  const todaysSlots = (board?.slots ?? [])
    .filter((s) => s.weekday === today)
    .sort((a, b) => a.period - b.period);

  const upcomingExam = (board?.exams ?? [])
    .filter((e) => e.status === 'published' && (!e.closesAt || new Date(e.closesAt).getTime() > now.getTime()))
    .sort((a, b) => new Date(a.closesAt ?? '').getTime() - new Date(b.closesAt ?? '').getTime())[0];

  const toSubmit = (board?.assignments ?? []).filter((a) => {
    const mine = board?.mySubmissions[a.ulid];
    return !mine && (!a.dueAt || new Date(a.dueAt).getTime() > now.getTime());
  });
  const overdue = (board?.assignments ?? []).filter((a) => {
    const mine = board?.mySubmissions[a.ulid];
    return !mine && a.dueAt && new Date(a.dueAt).getTime() <= now.getTime();
  });

  const graded = (board?.grades ?? []).filter((g) => g.score !== null && g.maxScore);
  const averageScore = graded.length
    ? graded.reduce((sum, g) => sum + (g.score! / g.maxScore!) * 20, 0) / graded.length
    : null;

  const presentDays = (board?.attendance ?? []).filter((r) => r.status === 'present').length;
  const attendanceRate = board?.attendance.length
    ? Math.round((presentDays / board.attendance.length) * 100)
    : null;

  const myClassroom = board?.classrooms[0] ?? null;

  if (!board && !failed) {
    return (
      <div className="space-y-6">
        <PageHeader title={`سلام ${currentUser.fullName} عزیز`} subtitle="در حال خواندن داده‌های سامانه…" />
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
        <PageHeader title={`سلام ${currentUser.fullName} عزیز`} />
        <Card className="border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20">
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <AlertCircle size={26} className="text-rose-600" />
            <p className="text-sm font-bold text-rose-800 dark:text-rose-300">خواندن اطلاعات دانش‌آموز ممکن نشد.</p>
            <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>تلاش دوباره</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`سلام ${currentUser.fullName} عزیز`}
        subtitle={
          myClassroom
            ? `${myClassroom.gradeLevel ?? ''} · ${myClassroom.title}${myClassroom.academicYear ? ` — ${myClassroom.academicYear}` : ''}`
            : `${activeRole.persianTitle} · ${activeSchoolName ?? '—'}`
        }
        actions={
          hasAccess('exams:take') && (
            <Link to="/exams">
              <Button variant="primary" size="sm" icon={<FileText size={15} />}>آزمون‌های آنلاین من</Button>
            </Link>
          )
        }
      />

      {/* Next exam — real exam window */}
      {upcomingExam ? (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-right">
            <span className="inline-block text-[11px] font-bold bg-white/20 px-2.5 py-1 rounded-lg mb-2">
              آزمون آنلاین در دسترس
            </span>
            <h2 className="text-lg font-bold">{upcomingExam.title}</h2>
            <p className="text-xs text-blue-100 mt-1">
              {upcomingExam.subject ?? '—'}
              {upcomingExam.durationMinutes ? ` · مدت: ${toPersianDigits(upcomingExam.durationMinutes)} دقیقه` : ''}
              {upcomingExam.closesAt ? ` · مهلت پایان: ${formatJalaliDateTime(upcomingExam.closesAt)}` : ''}
            </p>
          </div>
          <Link to="/exams" className="shrink-0">
            <Button variant="secondary" size="md">ورود به آزمون</Button>
          </Link>
        </div>
      ) : (
        <Card className="border-[#DCE3EE] dark:border-[#344257]">
          <div className="flex items-center gap-3 text-right">
            <FileText size={18} className="text-slate-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">در حال حاضر آزمون آنلاین فعالی ندارید</p>
              <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-0.5">
                به‌محض انتشار آزمون توسط دبیر، همین‌جا و در مرکز اعلان‌ها نمایش داده می‌شود.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* KPIs — all read from the backend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">تکالیف نیازمند ارسال</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {toPersianDigits(toSubmit.length)}
            </span>
            <Badge variant={toSubmit.length ? 'warning' : 'success'}>{toSubmit.length ? 'باز' : 'بدون اقدام'}</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">مهلت گذشته</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
              {toPersianDigits(overdue.length)}
            </span>
            <Badge variant={overdue.length ? 'danger' : 'neutral'}>
              {overdue.length ? 'بدون ارسال' : 'همه ارسال شده'}
            </Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">میانگین نمرات اعلام‌شده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {averageScore === null ? '—' : formatScore(averageScore)}
            </span>
            <Badge variant="primary">{toPersianDigits(graded.length)} نمره</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">حضور در کلاس‌ها</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {attendanceRate === null ? '—' : `${toPersianDigits(attendanceRate)}٪`}
            </span>
            <Badge variant="neutral">{toPersianDigits(board?.attendance.length ?? 0)} ثبت</Badge>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Assignments with real submission state */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <BookOpen size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                تکالیف و مهلت‌های تحویل
              </h3>
              <Link to="/assignments" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                مشاهده همه
              </Link>
            </div>

            {(board?.assignments.length ?? 0) === 0 ? (
              <EmptyState title="تکلیفی برای کلاس شما تعریف نشده است" description="فهرست تکالیف از ماژول تکالیف مدرسه خوانده می‌شود." />
            ) : (
              <div className="space-y-3">
                {(board?.assignments ?? []).slice(0, 6).map((asg) => {
                  const mine = board?.mySubmissions[asg.ulid];
                  const isOverdue = !mine && asg.dueAt && new Date(asg.dueAt).getTime() <= now.getTime();
                  return (
                    <div
                      key={asg.ulid}
                      className="p-4 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 text-right"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div>
                          <span className="text-xs font-bold text-[#2457C5] dark:text-[#8BAEFF] block">
                            {asg.subject} · {asg.classroom}
                          </span>
                          <h4 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mt-0.5">{asg.title}</h4>
                        </div>
                        <div className="shrink-0">
                          {mine?.status === 'graded' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 size={13} />
                              نمره: {mine.score !== null ? formatScore((mine.score / (asg.maxScore || 100)) * 20) : '—'}
                            </span>
                          ) : mine ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-100 text-[#2457C5] dark:bg-blue-950 dark:text-blue-300">
                              ارسال شد{mine.status === 'late' ? ' (با دیرکرد)' : ''}
                            </span>
                          ) : (
                            <span className={cn(
                              'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg',
                              isOverdue
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
                            )}>
                              {isOverdue ? 'مهلت گذشته' : `مهلت: ${asg.dueAt ? formatJalaliDateTime(asg.dueAt) : '—'}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {asg.description && (
                        <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed mb-3">{asg.description}</p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                        <span className="text-[#526176] dark:text-[#B3C0D2]">
                          {asg.fileCount > 0 ? `${toPersianDigits(asg.fileCount)} پیوست دارد` : 'بدون پیوست'}
                        </span>
                        <Link to="/assignments">
                          <Button variant="outline" size="sm">{mine ? 'مشاهده برگه ارسالی' : 'ارسال پاسخ تکلیف'}</Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Published grades */}
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-4 flex items-center gap-2">
              <GraduationCap size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
              نمرات اعلام‌شده من
            </h3>
            {graded.length === 0 ? (
              <EmptyState
                title="هنوز نمره‌ای برای شما منتشر نشده است"
                description="نمرات پس از تأیید و انتشار توسط مدیریت مدرسه در این بخش و کارنامه قابل مشاهده هستند."
              />
            ) : (
              <div className="space-y-2 text-xs">
                {graded.slice(0, 6).map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60"
                  >
                    <span className="text-right">
                      <span className="font-bold block text-[#202B3C] dark:text-[#F1F5FB]">{g.subject ?? '—'}</span>
                      <span className="text-[#526176] dark:text-[#B3C0D2]">{g.term ?? ''}</span>
                    </span>
                    <span className="font-black tabular-nums text-[#2457C5] dark:text-[#8BAEFF]">
                      {g.score !== null && g.maxScore ? `${formatScore((g.score / g.maxScore) * 20)} از ۲۰` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {canSeeGrades && (
              <Link to="/report-card">
                <Button variant="outline" size="sm" className="w-full mt-3">مشاهده کارنامه</Button>
              </Link>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Today's schedule */}
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <CalendarClock size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
              برنامه کلاسی امروز — {weekdayName(today)}
            </h3>
            {todaysSlots.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3 leading-relaxed">
                امروز کلاسی در برنامه شما ثبت نشده است.
              </p>
            ) : (
              <div className="space-y-2.5 text-xs">
                {todaysSlots.map((slot) => {
                  const running = nowMinutes >= timeToMinutes(slot.startsAt) && nowMinutes < timeToMinutes(slot.endsAt);
                  return (
                    <div
                      key={slot.id}
                      className={cn(
                        'p-2.5 rounded-xl flex items-center justify-between gap-2',
                        running ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900' : 'bg-slate-50 dark:bg-slate-800/50',
                      )}
                    >
                      <div className="text-right">
                        <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB] block">
                          زنگ {toPersianDigits(slot.period)}: {slot.subject ?? '—'}
                        </span>
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
          </Card>

          {/* Attendance log */}
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <Percent size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
              آخرین ثبت‌های حضور و غیاب
            </h3>
            {!canSeeAttendance ? (
              <p className="text-xs text-slate-500 text-center py-2">مشاهده حضور و غیاب برای نقش شما مجاز نیست.</p>
            ) : (board?.attendance.length ?? 0) === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">هنوز ثبتی انجام نشده است.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {board?.attendance.slice(0, 6).map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-right">
                      <span className="font-bold block text-[#202B3C] dark:text-[#F1F5FB]">{r.subject ?? '—'}</span>
                      <span className="text-[#526176] dark:text-[#B3C0D2]">
                        {formatJalaliDate(r.date)} · زنگ {toPersianDigits(r.period)}
                      </span>
                    </span>
                    <Badge variant={r.status === 'present' ? 'success' : r.status === 'absent' ? 'danger' : 'warning'}>
                      {r.status === 'present' ? 'حاضر' : r.status === 'absent' ? 'غایب' : r.status === 'late' ? 'تأخیر' : r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick links, gated by real permissions */}
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
              دسترسی‌های سریع
            </h3>
            <div className="space-y-2">
              <Link to="/assignments">
                <Button variant="outline" size="sm" className="w-full justify-start" icon={<Inbox size={14} />}>
                  ارسال پاسخ تکالیف
                </Button>
              </Link>
              {hasAccess('online_classes:view') && (
                <Link to="/online-classes">
                  <Button variant="outline" size="sm" className="w-full justify-start" icon={<Clock size={14} />}>
                    کلاس‌های آنلاین من
                  </Button>
                </Link>
              )}
              {canSeeAttendance && (
                <Link to="/attendance">
                  <Button variant="outline" size="sm" className="w-full justify-start" icon={<CheckCircle2 size={14} />}>
                    کارنامه حضور و غیاب
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
