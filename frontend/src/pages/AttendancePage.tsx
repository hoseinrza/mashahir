import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, AlertCircle, Save, Send,
  Calendar, ShieldCheck, Search, UserCheck, Loader2, Lock, PhoneCall
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader, AccessDeniedGate, EmptyState } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { formatJalaliDate } from '../utils/jalali';
import {
  ApiAcademicService, ApiFamilyService, ApiAttendanceService,
  GuardianChildRow, AttendanceSessionRow, AttendanceRosterRow,
} from '../api/data';
import { ApiError } from '../api/client';
import { JalaliDatePicker } from '../components/common/JalaliDatePicker';
import { AttendanceStatus } from '../types';

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

const SESSION_STATUS: Record<string, { label: string; variant: 'neutral' | 'warning' | 'success' }> = {
  not_taken: { label: 'ثبت نشده', variant: 'neutral' },
  draft: { label: 'پیش‌نویس ذخیره‌شده', variant: 'warning' },
  finalized: { label: 'نهایی‌شده — ابلاغ اولیا ارسال شد', variant: 'success' },
};

export const AttendancePage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();

  const isFamily = activeRole.group === 'family';
  const isStudent = activeRole.group === 'student';
  const isBusDriver = activeRole.id === 'bus_driver';

  const canView = !isBusDriver && (hasAccess('attendance:view') || hasAccess('attendance:record') || isFamily || isStudent);
  const canEdit = hasAccess('attendance:record');

  // ── real, flag-aware data for the family view ──
  // The server already enforces the per-link attendance flag (404 = denied);
  // the flag in the payload only decides what the UI bothers asking for.
  const [children, setChildren] = useState<GuardianChildRow[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [childTimeline, setChildTimeline] = useState<{ date: string; period: number; subject: string | null; status: string; late_minutes: number | null }[]>([]);
  const [childAttendanceDenied, setChildAttendanceDenied] = useState(false);

  useEffect(() => {
    if (!isFamily) return;
    let alive = true;
    (async () => {
      try {
        const rows = await ApiFamilyService.childrenWithFlags();
        if (!alive) return;
        setChildren(rows);
        setSelectedChildId((prev) => (rows.some((c) => c.studentUlid === prev) ? prev : rows[0]?.studentUlid ?? ''));
      } catch {
        if (alive) setChildren([]);
      }
    })();
    return () => { alive = false; };
  }, [isFamily]);

  useEffect(() => {
    if (!isFamily) return;
    const child = children.find((c) => c.studentUlid === selectedChildId);
    if (!child) {
      setChildTimeline([]);
      return;
    }
    let alive = true;
    setChildTimeline([]);
    setChildAttendanceDenied(false);
    if (!child.flags.can_view_attendance) {
      setChildAttendanceDenied(true);
      return;
    }
    (async () => {
      try {
        const rows = await ApiAttendanceService.studentTimeline(child.studentUlid);
        if (alive) setChildTimeline(rows);
      } catch (e) {
        if (alive && e instanceof ApiError && e.status === 404) setChildAttendanceDenied(true);
      }
    })();
    return () => { alive = false; };
  }, [isFamily, children, selectedChildId]);

  // Student view: the own-record timeline. studentsInScope under sh4 returns
  // exactly the learner himself.
  const [ownStudent, setOwnStudent] = useState<{ ulid: string; fullName: string } | null>(null);

  useEffect(() => {
    if (!isStudent) return;
    let alive = true;
    (async () => {
      try {
        const scope = await ApiAcademicService.studentsInScope();
        const own = scope[0] ?? null;
        if (!alive) return;
        setOwnStudent(own);
        if (!own) {
          setChildTimeline([]);
          return;
        }
        const rows = await ApiAttendanceService.studentTimeline(own.ulid);
        if (alive) setChildTimeline(rows);
      } catch (e) {
        if (alive) setChildTimeline([]);
      }
    })();
    return () => { alive = false; };
  }, [isStudent]);

  // ── real roll-call console (teacher/staff): session + roster ──
  const [mySubjects, setMySubjects] = useState<{ id: number; subject: string; classroom: string }[]>([]);
  const [csId, setCsId] = useState<number | ''>('');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState(1);
  const [session, setSession] = useState<AttendanceSessionRow | null>(null);
  const [roster, setRoster] = useState<AttendanceRosterRow[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffNotice, setStaffNotice] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState('');

  useEffect(() => {
    if (!canEdit) return;
    ApiAcademicService.mySubjects()
      .then(setMySubjects)
      .catch(() => setMySubjects([]));
  }, [canEdit]);

  const loadSession = useCallback(async (subjectId: number, heldOn: string, periodNum: number) => {
    setSessionLoading(true);
    setStaffError(null);
    setStaffNotice(null);
    try {
      // create-or-get: a session for (cs, date, period) is unique on the server.
      const sessions = await ApiAttendanceService.listSessions(subjectId, heldOn);
      const found = sessions.find((s) => s.period === periodNum);
      const s = found ?? (await ApiAttendanceService.createSession(subjectId, heldOn, periodNum));
      const detail = await ApiAttendanceService.showSession(s.id);
      setSession(detail.session);
      setRoster(detail.roster.map((r) => ({ ...r, status: r.status ?? 'present' })));
    } catch (e) {
      setStaffError(firstError(e, 'خطا در بارگذاری جلسه'));
      setSession(null);
      setRoster([]);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  const reloadSession = useCallback(async (sessionId: number) => {
    const detail = await ApiAttendanceService.showSession(sessionId);
    setSession(detail.session);
    setRoster(detail.roster);
  }, []);

  const setRowStatus = (studentUlid: string, status: 'present' | 'absent' | 'late', lateMinutes: number | null = null) => {
    setRoster((prev) => prev.map((r) => (r.studentUlid === studentUlid ? { ...r, status, lateMinutes } : r)));
  };

  const markAllPresent = () => {
    setRoster((prev) => prev.map((r) => ({ ...r, status: 'present' })));
  };

  const saveDraft = async () => {
    if (!session) return;
    setSaving(true);
    setStaffError(null);
    setStaffNotice(null);
    try {
      await ApiAttendanceService.saveRecords(
        session.id,
        roster.map((r) => ({
          studentId: r.studentId,
          status: (r.status ?? 'present') as 'present' | 'absent' | 'late',
          lateMinutes: r.status === 'late' ? (r.lateMinutes ?? 0) : null,
        })),
      );
      await reloadSession(session.id);
      setStaffNotice('پیش‌نویس حضور ذخیره شد؛ تا نهایی‌سازی قابل ویرایش است.');
    } catch (e) {
      setStaffError(firstError(e, 'خطا در ذخیرهٔ حضور'));
    } finally {
      setSaving(false);
    }
  };

  const finalizeNow = async () => {
    if (!session) return;
    setSaving(true);
    setStaffError(null);
    setStaffNotice(null);
    try {
      await ApiAttendanceService.finalizeSession(session.id);
      await reloadSession(session.id);
      setStaffNotice('جلسه نهایی شد؛ اعلان غیبت و تأخیر برای اولیا ارسال گردید.');
    } catch (e) {
      setStaffError(firstError(e, 'خطا در نهایی‌سازی'));
    } finally {
      setSaving(false);
    }
  };

  // Correction of a finalized record: needs a reason (sh7) and lands in audit.
  const [correctTarget, setCorrectTarget] = useState<{ recordId: number; name: string; status: string } | null>(null);
  const [correctStatus, setCorrectStatus] = useState<'present' | 'absent' | 'late'>('present');
  const [correctLate, setCorrectLate] = useState(0);
  const [correctReason, setCorrectReason] = useState('');
  const [correcting, setCorrecting] = useState(false);

  const submitCorrection = async () => {
    if (!correctTarget || !session) return;
    if (correctReason.trim().length < 5) {
      setStaffError('دلیل اصلاح باید دست‌کم ۵ نویسه باشد.');
      return;
    }
    setCorrecting(true);
    setStaffError(null);
    try {
      await ApiAttendanceService.correctRecord(
        correctTarget.recordId,
        correctStatus,
        correctReason.trim(),
        correctStatus === 'late' ? correctLate : null,
      );
      setCorrectTarget(null);
      setCorrectReason('');
      setStaffNotice('اصلاح با ثبت دلیل در تاریخچهٔ ممیزی انجام شد.');
      await reloadSession(session.id);
    } catch (e) {
      setStaffError(firstError(e, 'خطا در اصلاح رکورد'));
    } finally {
      setCorrecting(false);
    }
  };

  // Excuse Request Modal for Parents (family view — notification + request log)
  const [isExcuseModalOpen, setIsExcuseModalOpen] = useState(false);
  const [excuseText, setExcuseText] = useState('');
  const [excuseSuccessMessage, setExcuseSuccessMessage] = useState(false);

  const handleSendExcuseRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setExcuseSuccessMessage(true);
    setIsExcuseModalOpen(false);
    setExcuseText('');
    setTimeout(() => setExcuseSuccessMessage(false), 6000);
  };

  const selectedChild = isFamily
    ? children.find((c) => c.studentUlid === selectedChildId) ?? children[0] ?? null
    : null;

  if (!canView) {
    return (
      <AccessDeniedGate
        title="عدم دسترسی به دفتر حضور و غیاب مدرسه"
        requiredRoleOrPermission="attendance:view (کادر آموزشی، ناظم، یا اولیا)"
        reason="دفتر حضور و غیاب کلاسی تنها برای دبیران، ناظم مدرسه و اولیای گرامی قابل دسترسی است."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  // ==========================================
  // VIEW A: PARENT / GUARDIAN & STUDENT VIEW
  // ==========================================
  if (isFamily || isStudent) {
    const childName = isFamily ? children.find((c) => c.studentUlid === selectedChildId)?.studentName ?? children[0]?.studentName : ownStudent?.fullName;

    const studentRecords = childTimeline
      .map((r, i) => ({
        id: `att_${i}`,
        date: formatJalaliDate(r.date) || r.date,
        sessionLabel: r.subject ? `زنگ ${r.period} — ${r.subject}` : `زنگ ${r.period}`,
        status: r.status as AttendanceStatus,
        lateMinutes: r.late_minutes,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const studentTotalRecorded = studentRecords.length || 1;
    const studentPresents = studentRecords.filter((r) => r.status === 'present').length;
    const studentLates = studentRecords.filter((r) => r.status === 'late').length;
    const studentAbsents = studentRecords.filter((r) => r.status === 'absent').length;
    const studentRate = Math.round((studentPresents / studentTotalRecorded) * 100);

    return (
      <div className="space-y-6 max-w-5xl mx-auto px-2 sm:px-4 py-2">
        {/* Success Alert */}
        {excuseSuccessMessage && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>درخواست موجه‌سازی غیبت ثبت شد؛ بررسی و پاسخ توسط ناظم آموزشی انجام می‌شود.</span>
            </div>
            <button onClick={() => setExcuseSuccessMessage(false)} className="text-emerald-600 hover:underline">
              بستن
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <ShieldCheck className="text-blue-600 dark:text-blue-400" size={24} />
              {isFamily ? 'گزارش و کارنامه حضور و غیاب فرزند' : 'دفتر حضور و غیاب من'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              سوابق جلسات، غیبت‌ها و تأخیرها بر پایهٔ ثبت واقعی کلاس‌ها
            </p>
          </div>

          {isFamily && (
            <Button
              onClick={() => setIsExcuseModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs shrink-0 flex items-center gap-2"
            >
              <AlertCircle size={15} />
              <span>ثبت درخواست موجه‌سازی غیبت</span>
            </Button>
          )}
        </div>

        {/* Child switcher — ولی با چند فرزند */}
        {isFamily && children.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            {children.map((c) => (
              <button
                key={c.studentUlid}
                type="button"
                onClick={() => setSelectedChildId(c.studentUlid)}
                className={cn(
                  'rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors',
                  c.studentUlid === (selectedChild?.studentUlid ?? children[0]?.studentUlid)
                    ? 'border-blue-600 bg-blue-50 text-slate-900 dark:border-blue-500 dark:bg-slate-800 dark:text-white'
                    : 'border-slate-200 text-slate-500 hover:border-blue-600/60 dark:border-slate-700 dark:text-slate-400',
                )}
              >
                {c.studentName}
              </button>
            ))}
          </div>
        )}

        {/* Student Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xl flex items-center justify-center shadow-md">
                {(childName || '—').slice(0, 1)}
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {childName || '—'}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isFamily && selectedChild && <span>نوع پیوند: {selectedChild.linkLabel}</span>}
                </div>
              </div>
            </div>

            {/* SMS Service Badge — فقط برای پیوند ولی و بر اساس پرچم واقعی */}
            {isFamily && (
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl text-xs border self-start',
                  (selectedChild?.flags.can_receive_sms ?? false)
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400',
                )}
              >
                <PhoneCall size={14} />
                <span>
                  {(selectedChild?.flags.can_receive_sms ?? false)
                    ? 'سرویس پیامک ورود و خروج فعال است'
                    : 'پیامک ورود و خروج برای این پیوند فعال نیست'}
                </span>
              </div>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">درصد نظم و حضور</span>
              <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                {toPersianDigits(studentRate)}٪
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">روزهای حاضر</span>
              <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {toPersianDigits(studentPresents)} جلسه
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">تعداد تأخیر ورود</span>
              <span className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
                {toPersianDigits(studentLates)} بار
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">غیبت‌ها</span>
              <span className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
                {toPersianDigits(studentAbsents)} جلسه
              </span>
            </div>
          </div>
        </div>

        {/* History Records Table / Cards */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">سوابق جلسات حضور و غیاب</h3>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5 font-bold">تاریخ</th>
                    <th className="p-3.5 font-bold">جلسه / درس</th>
                    <th className="p-3.5 font-bold">وضعیت حضور</th>
                    <th className="p-3.5 font-bold">میزان تأخیر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {studentRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-medium">{rec.date}</td>
                      <td className="p-3.5 text-slate-500 dark:text-slate-400">{rec.sessionLabel}</td>
                      <td className="p-3.5">
                        {rec.status === 'present' && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                            <CheckCircle2 size={14} />
                            حاضر در کلاس
                          </span>
                        )}
                        {rec.status === 'late' && (
                          <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                            <Clock size={14} />
                            با تأخیر ورود
                          </span>
                        )}
                        {rec.status === 'absent' && (
                          <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5">
                            <XCircle size={14} />
                            غایب
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {rec.lateMinutes ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium font-mono">
                            {toPersianDigits(rec.lateMinutes)} دقیقه تأخیر
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {studentRecords.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">
                        هنوز جلسه‌ای برای شما ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Submit Excuse Request */}
        <Modal
          isOpen={isExcuseModalOpen}
          onClose={() => setIsExcuseModalOpen(false)}
          title="ثبت درخواست موجه‌سازی غیبت یا تأخیر"
        >
          <form onSubmit={handleSendExcuseRequest} className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              اولیای گرامی، در صورت غیبت یا تأخیر فرزندتان به علت بیماری یا امور موجه، لطفاً علت را ثبت نموده و گواهی پزشک را در صورت وجود ارائه فرمایید.
            </p>
            <FormField label="دلیل غیبت / توضیحات">
              <textarea
                rows={3}
                required
                value={excuseText}
                onChange={(e) => setExcuseText(e.target.value)}
                placeholder="شرح علت غیبت (مثال: مراجعه به پزشک به دلیل سرماخوردگی)..."
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setIsExcuseModalOpen(false)}>
                انصراف
              </Button>
              <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
                ارسال درخواست به ناظم
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ==========================================
  // VIEW B: PRINCIPAL, DEPUTY & TEACHER VIEW — real roll-call console
  // ==========================================
  const rosterVisible = roster.filter((r) => {
    if (staffSearch.trim() && !r.studentName.includes(staffSearch.trim())) return false;
    return true;
  });
  const counts = {
    present: roster.filter((r) => (r.status ?? 'present') === 'present').length,
    late: roster.filter((r) => r.status === 'late').length,
    absent: roster.filter((r) => r.status === 'absent').length,
  };
  const finalized = session?.status === 'finalized';
  const editable = canEdit && !finalized;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-2">
      <PageHeader
        title="دفتر ثبت حضور و غیاب کلاسی"
        subtitle="ایجاد جلسه، ثبت حضور بر پایهٔ لیست واقعی کلاس، نهایی‌سازی با ابلاغ خودکار اولیا و اصلاح مستند با ثبت دلیل"
      />

      {staffError && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200">
            <AlertCircle size={15} /> <span className="font-bold">{staffError}</span>
          </div>
        </Card>
      )}
      {staffNotice && (
        <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={15} /> <span className="font-bold">{staffNotice}</span>
          </div>
        </Card>
      )}

      {/* Session picker */}
      <Card>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <label className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] block pb-1">درس و کلاس</label>
              <select
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl text-[#202B3C] dark:text-[#F1F5FB] focus:outline-none"
                value={csId}
                onChange={(e) => setCsId(Number(e.target.value))}
              >
                <option value="">— انتخاب درس و کلاس —</option>
                {mySubjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.subject} — {s.classroom}</option>
                ))}
              </select>
            </div>
            <div className="w-[170px]">
              <label className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] block pb-1">تاریخ</label>
              <JalaliDatePicker value={sessionDate} onChange={setSessionDate} placeholder="تاریخ جلسه" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] block pb-1">زنگ</label>
              <input
                type="number"
                min={1}
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
                className="w-20 text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl text-[#202B3C] dark:text-[#F1F5FB]"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={csId === '' || sessionLoading}
              onClick={() => loadSession(Number(csId), sessionDate, period)}
            >
              {sessionLoading ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />} بارگذاری جلسه
            </Button>
          </div>

          {session && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#DCE3EE]/70 dark:border-[#344257]/70 text-xs">
              <Badge variant={SESSION_STATUS[session.status]?.variant ?? 'neutral'}>
                {SESSION_STATUS[session.status]?.label ?? session.status}
              </Badge>
              <span className="text-[#526176] dark:text-[#B3C0D2]">
                {session.subject ?? '—'} · {formatJalaliDate(session.heldOn)} · زنگ {toPersianDigits(session.period)}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Roster */}
      {session && (
        <Card>
          <div className="p-4 border-b border-[#DCE3EE]/60 dark:border-[#344257]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                لیست حضور — {session.subject ?? '—'}
              </h3>
              <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-0.5">
                {toPersianDigits(roster.length)} دانش‌آموز این کلاس
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">حاضر: {toPersianDigits(counts.present)}</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">تأخیر: {toPersianDigits(counts.late)}</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">غایب: {toPersianDigits(counts.absent)}</span>
            </div>
          </div>

          <div className="p-3 flex items-center gap-2 border-b border-[#DCE3EE]/60 dark:border-[#344257]/60">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute right-3 top-2 text-[#8CA0BC]" size={14} />
              <input
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="جستجوی نام دانش‌آموز..."
                className="w-full text-xs p-2 pr-8 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl text-[#202B3C] dark:text-[#F1F5FB] focus:outline-none"
              />
            </div>
            {editable && (
              <Button variant="outline" size="sm" icon={<UserCheck size={14} />} onClick={markAllPresent}>
                حاضر کردن همه
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-[#101B2C] text-[#526176] dark:text-[#B3C0D2] border-b border-[#DCE3EE] dark:border-[#344257]">
                <tr>
                  <th className="p-3 font-bold w-12 text-center">ردیف</th>
                  <th className="p-3 font-bold">نام و نام خانوادگی</th>
                  <th className="p-3 font-bold">وضعیت حضور</th>
                  <th className="p-3 font-bold">تأخیر (دقیقه)</th>
                  {finalized && <th className="p-3 font-bold text-center">اصلاح</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3EE]/60 dark:divide-[#344257]/60">
                {rosterVisible.map((r, index) => {
                  const status = (r.status ?? 'present') as 'present' | 'absent' | 'late';
                  return (
                    <tr key={r.studentUlid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3 text-center font-mono text-[#8CA0BC]">{toPersianDigits(index + 1)}</td>
                      <td className="p-3 font-bold text-[#202B3C] dark:text-[#F1F5FB]">{r.studentName}</td>
                      <td className="p-3">
                        {finalized ? (
                          <span
                            className={cn(
                              'font-bold flex items-center gap-1',
                              status === 'present' && 'text-emerald-600 dark:text-emerald-400',
                              status === 'late' && 'text-amber-600 dark:text-amber-400',
                              status === 'absent' && 'text-rose-600 dark:text-rose-400',
                            )}
                          >
                            {status === 'present' && <CheckCircle2 size={13} />}
                            {status === 'late' && <Clock size={13} />}
                            {status === 'absent' && <XCircle size={13} />}
                            {status === 'present' ? 'حاضر' : status === 'late' ? 'تأخیر' : 'غایب'}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            {([
                              ['present', 'حاضر', 'bg-emerald-600', 'hover:bg-emerald-100 dark:hover:bg-emerald-950/40'],
                              ['late', 'تأخیر', 'bg-amber-500', 'hover:bg-amber-100 dark:hover:bg-amber-950/40'],
                              ['absent', 'غایب', 'bg-rose-600', 'hover:bg-rose-100 dark:hover:bg-rose-950/40'],
                            ] as const).map(([value, label, activeCls, hoverCls]) => (
                              <button
                                key={value}
                                onClick={() => setRowStatus(r.studentUlid, value, value === 'late' ? 5 : null)}
                                className={cn(
                                  'px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer',
                                  status === value ? cn(activeCls, 'text-white') : cn('bg-slate-100 dark:bg-[#182231] text-[#526176] dark:text-[#B3C0D2]', hoverCls),
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {status === 'late' && editable ? (
                          <input
                            type="number"
                            min={0}
                            max={240}
                            value={r.lateMinutes ?? 0}
                            onChange={(e) => setRowStatus(r.studentUlid, 'late', Number(e.target.value))}
                            className="w-16 text-xs p-1.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-lg text-[#202B3C] dark:text-[#F1F5FB] tabular-nums"
                          />
                        ) : r.lateMinutes ? (
                          <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">{toPersianDigits(r.lateMinutes)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      {finalized && (
                        <td className="p-3 text-center">
                          {r.recordId ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCorrectTarget({ recordId: r.recordId!, name: r.studentName, status });
                                setCorrectStatus(status as 'present' | 'absent' | 'late');
                                setCorrectLate(r.lateMinutes ?? 0);
                                setCorrectReason('');
                              }}
                            >
                              اصلاح
                            </Button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {rosterVisible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">دانش‌آموزی یافت نشد.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {editable && (
            <div className="p-4 border-t border-[#DCE3EE]/60 dark:border-[#344257]/60 flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" disabled={saving || roster.length === 0} onClick={saveDraft}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} ذخیرهٔ پیش‌نویس
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={saving || roster.length === 0}
                onClick={finalizeNow}
                title="قفل جلسه و ارسال اعلان غیبت برای اولیا"
              >
                <Send size={14} /> نهایی‌سازی و ابلاغ اولیا
              </Button>
            </div>
          )}
          {finalized && (
            <div className="p-3 border-t border-[#DCE3EE]/60 dark:border-[#344257]/60 text-[11px] text-slate-400">
              این جلسه نهایی شده است؛ اصلاح رکوردها با ثبت دلیل و ثبت در تاریخچهٔ ممیزی انجام می‌شود.
            </div>
          )}
        </Card>
      )}

      {!session && !sessionLoading && (
        <Card>
          <EmptyState
            title="جلسه‌ای بارگذاری نشده است"
            description="درس-کلاس، تاریخ و زنگ را انتخاب و «بارگذاری جلسه» را بزنید؛ جلسه به‌صورت create-or-get ساخته می‌شود."
          />
        </Card>
      )}

      {/* Correction modal (finalized records only) */}
      <Modal
        isOpen={correctTarget !== null}
        onClose={() => setCorrectTarget(null)}
        title={correctTarget ? `اصلاح حضور — ${correctTarget.name}` : ''}
        maxWidth="sm"
      >
        {correctTarget && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] block pb-1">وضعیت جدید</label>
              <select
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl text-[#202B3C] dark:text-[#F1F5FB]"
                value={correctStatus}
                onChange={(e) => setCorrectStatus(e.target.value as 'present' | 'absent' | 'late')}
              >
                <option value="present">حاضر</option>
                <option value="absent">غایب</option>
                <option value="late">تأخیر</option>
              </select>
            </div>
            {correctStatus === 'late' && (
              <div>
                <label className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] block pb-1">دقیقهٔ تأخیر</label>
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={correctLate}
                  onChange={(e) => setCorrectLate(Number(e.target.value))}
                  className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl text-[#202B3C] dark:text-[#F1F5FB]"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] block pb-1">دلیل اصلاح (الزامی — ثبت در ممیزی)</label>
              <textarea
                rows={3}
                value={correctReason}
                onChange={(e) => setCorrectReason(e.target.value)}
                placeholder="مثال: اعلام اشتباه دبیر پس از هماهنگی با دفتر"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl text-[#202B3C] dark:text-[#F1F5FB]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setCorrectTarget(null)}>انصراف</Button>
              <Button variant="primary" size="sm" disabled={correcting} onClick={submitCorrection}>
                {correcting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} ثبت اصلاح
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
