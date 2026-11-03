import React, { useEffect, useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, AlertCircle, Save, Send,
  Calendar, Check, UserCheck, ShieldCheck, MessageSquare,
  Search, Filter, ChevronDown, BookOpen, Users, PhoneCall,
  FileSpreadsheet, Sparkles, RefreshCw, Eye, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Modal, FormField, PageHeader, AccessDeniedGate } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { formatJalaliDate } from '../utils/jalali';
import { AttendanceService, ScheduleService } from '../services';
import { AttendanceRecord, AttendanceStatus, WeeklyTimetableSlot } from '../types';
import { INITIAL_STUDENTS, INITIAL_CLASSROOMS, INITIAL_WEEKLY_TIMETABLE } from '../data/mockData';
import { ApiAcademicService, ApiFamilyService, ApiAttendanceService, GuardianChildRow } from '../api/data';
import { ApiError } from '../api/client';

export const AttendancePage: React.FC = () => {
  const { currentUser, activeRole, hasAccess } = useAuth();

  const isFamily = activeRole.group === 'family';
  const isStudent = activeRole.group === 'student';
  const isTeacher = activeRole.id === 'teacher' || activeRole.group === 'faculty';
  const isAdmin = activeRole.group === 'school_admin' || activeRole.group === 'platform';
  const isBusDriver = activeRole.id === 'bus_driver';

  const canView = !isBusDriver && (hasAccess('attendance:view') || hasAccess('attendance:record') || isFamily || isStudent || isAdmin);
  const canEdit = !isBusDriver && (hasAccess('attendance:record') || isTeacher || isAdmin);

  // Selected filters
  const [selectedClassId, setSelectedClassId] = useState<string>('cls_101');
  const [selectedDate, setSelectedDate] = useState<string>('۱۴۰۳/۰۷/۱۵');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isTimetableDrawerOpen, setIsTimetableDrawerOpen] = useState(false);

  // Parent student selector if multiple children linked
  const [selectedChildId, setSelectedChildId] = useState<string>('std_parsa');

  // Attendance records state
  const [records, setRecords] = useState<AttendanceRecord[]>(() => AttendanceService.getAll());

  // Correction Reason Modal
  const [isEditReasonModalOpen, setIsEditReasonModalOpen] = useState(false);
  const [targetStudentId, setTargetStudentId] = useState<string | null>(null);
  const [targetNewStatus, setTargetNewStatus] = useState<AttendanceStatus>('present');
  const [correctionReasonText, setCorrectionReasonText] = useState('');
  const [delayMinutesInput, setDelayMinutesInput] = useState<number>(15);

  // Finalize & SMS dispatch simulation
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [smsSimulationLogs, setSmsSimulationLogs] = useState<string[]>([]);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);

  // Excuse Request Modal for Parents
  const [isExcuseModalOpen, setIsExcuseModalOpen] = useState(false);
  const [excuseText, setExcuseText] = useState('');
  const [excuseSuccessMessage, setExcuseSuccessMessage] = useState(false);

  // ── real, flag-aware data for the family view ──
  // The server already enforces the per-link attendance flag (404 = denied);
  // the flag in the payload only decides what the UI bothers asking for.
  const [children, setChildren] = useState<GuardianChildRow[]>([]);
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

  // Selected classroom object
  const currentClassroom = INITIAL_CLASSROOMS.find((c) => c.id === selectedClassId) || INITIAL_CLASSROOMS[0];

  // Weekly timetable for current classroom
  const classTimetable = INITIAL_WEEKLY_TIMETABLE.filter((t) => t.classroomId === selectedClassId);

  // Students belonging to the selected classroom
  const classStudents = INITIAL_STUDENTS.filter((std) => std.classroomId === selectedClassId);

  // Map each student in selected class to their attendance record on selectedDate
  const currentClassAttendanceList = classStudents.map((std) => {
    const existing = records.find((r) => r.studentId === std.id && r.date === selectedDate);
    return (
      existing || {
        id: `att_${std.id}_${selectedDate}`,
        classroomId: selectedClassId,
        studentId: std.id,
        studentName: std.fullName,
        date: selectedDate,
        status: 'present' as AttendanceStatus,
        recordedByTeacherId: currentUser.id,
        recordedAt: '۰۸:۰۰',
        smsNotificationSent: false,
      }
    );
  });

  // Filtered by search and status
  const displayedStudents = currentClassAttendanceList.filter((rec) => {
    const student = INITIAL_STUDENTS.find((s) => s.id === rec.studentId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = rec.studentName.toLowerCase().includes(q);
      const matchNum = student?.studentNumber.includes(q);
      const matchNid = student?.nationalId.includes(q);
      if (!matchName && !matchNum && !matchNid) return false;
    }
    if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
    return true;
  });

  // School-wide statistics across all 100 students for selectedDate
  const allTodayRecords = INITIAL_STUDENTS.map((std) => {
    return (
      records.find((r) => r.studentId === std.id && r.date === selectedDate) || {
        status: 'present' as AttendanceStatus,
      }
    );
  });
  const totalStudentsCount = INITIAL_STUDENTS.length;
  const totalPresentCount = allTodayRecords.filter((r) => r.status === 'present').length;
  const totalLateCount = allTodayRecords.filter((r) => r.status === 'late').length;
  const totalAbsentCount = allTodayRecords.filter((r) => r.status === 'absent').length;
  const totalExcusedCount = allTodayRecords.filter((r) => r.status === 'excused').length;
  const overallAttendanceRate = Math.round(((totalPresentCount + totalLateCount) / totalStudentsCount) * 100);

  // Class-specific stats
  const classPresentCount = currentClassAttendanceList.filter((r) => r.status === 'present').length;
  const classLateCount = currentClassAttendanceList.filter((r) => r.status === 'late').length;
  const classAbsentCount = currentClassAttendanceList.filter((r) => r.status === 'absent').length;

  // Single-student attendance for Parent / Student view. Family reads the
  // real per-session timeline of the selected child; the server has already
  // enforced the per-link attendance flag (denied → locked UI below).
  const selectedChild = isFamily
    ? children.find((c) => c.studentUlid === selectedChildId) ?? children[0] ?? null
    : null;

  const studentRecords = ((isFamily || isStudent)
    ? childTimeline.map((r, i) => ({
        id: `att_${i}`,
        date: formatJalaliDate(r.date) || r.date,
        recordedAt: '',
        status: r.status as AttendanceStatus,
        delayMinutes: r.late_minutes,
        note: r.subject ? `زنگ ${r.period} — ${r.subject}` : '',
        smsNotificationSent: false,
      }))
    : records.filter((r) => r.studentId === (INITIAL_STUDENTS.find((s) => s.userId === currentUser.id)?.id ?? '')))
    .sort((a, b) => b.date.localeCompare(a.date));

  const studentTotalRecorded = studentRecords.length || 1;
  const studentPresents = studentRecords.filter((r) => r.status === 'present').length;
  const studentLates = studentRecords.filter((r) => r.status === 'late').length;
  const studentAbsents = studentRecords.filter((r) => r.status === 'absent').length;
  const studentRate = Math.round((studentPresents / studentTotalRecorded) * 100);

  // Handlers
  const handleInlineStatusChange = (studentId: string, newStatus: AttendanceStatus) => {
    if (!canEdit) return;

    if (newStatus === 'late' || newStatus === 'excused') {
      // Open modal to specify delay minutes or reason
      setTargetStudentId(studentId);
      setTargetNewStatus(newStatus);
      setIsEditReasonModalOpen(true);
      return;
    }

    applyStatusUpdate(studentId, newStatus);
  };

  const applyStatusUpdate = (studentId: string, newStatus: AttendanceStatus, delayMin?: number, reason?: string) => {
    setRecords((prev) => {
      const existingIdx = prev.findIndex((r) => r.studentId === studentId && r.date === selectedDate);
      const student = INITIAL_STUDENTS.find((s) => s.id === studentId);

      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          status: newStatus,
          delayMinutes: newStatus === 'late' ? delayMin || 15 : undefined,
          note: reason || copy[existingIdx].note,
          lastModifiedBy: currentUser.fullName,
          lastModifiedReason: reason || 'تغییر وضعیت توسط کاربر مجاز',
        };
        return copy;
      } else {
        return [
          ...prev,
          {
            id: `att_${studentId}_${Date.now()}`,
            classroomId: selectedClassId,
            studentId,
            studentName: student?.fullName || '',
            date: selectedDate,
            status: newStatus,
            delayMinutes: newStatus === 'late' ? delayMin || 15 : undefined,
            note: reason,
            recordedByTeacherId: currentUser.id,
            recordedAt: '۰۸:۰۵',
            smsNotificationSent: false,
            lastModifiedBy: currentUser.fullName,
          },
        ];
      }
    });
  };

  const handleSaveCorrectionReason = () => {
    if (!targetStudentId) return;
    applyStatusUpdate(targetStudentId, targetNewStatus, delayMinutesInput, correctionReasonText);
    setIsEditReasonModalOpen(false);
    setCorrectionReasonText('');
    setTargetStudentId(null);
  };

  const handleMarkAllPresent = () => {
    if (!canEdit) return;
    classStudents.forEach((std) => {
      applyStatusUpdate(std.id, 'present');
    });
  };

  const handleFinalizeSave = () => {
    const updated = AttendanceService.saveRecords(
      currentClassAttendanceList,
      currentUser.fullName,
      `ثبت و نهایی‌سازی حضور و غیاب ${currentClassroom.name} در تاریخ ${selectedDate}`
    );
    setRecords(updated);

    // Simulate SMS dispatch to legal guardians
    const smsResults: string[] = [];
    currentClassAttendanceList.forEach((std) => {
      if (std.status === 'absent') {
        smsResults.push(`پیامک غیبت برای ولی قانونی ${std.studentName} ارسال شد (سامانه مخابراتی پیام‌رسان مشاهیر).`);
      } else if (std.status === 'late') {
        smsResults.push(`پیامک تأخیر ورود برای ولی قانونی ${std.studentName} ارسال شد.`);
      }
    });

    if (smsResults.length === 0) {
      smsResults.push(`کلیه دانش‌آموزان کلاس ${currentClassroom.name} حاضر بودند. پیامک اعلام حضور موفق ثبت شد.`);
    }

    setSmsSimulationLogs(smsResults);
    setSaveSuccessMessage(true);
    setIsFinalizeModalOpen(false);
    setTimeout(() => setSaveSuccessMessage(false), 7000);
  };

  const handleSendExcuseRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setExcuseSuccessMessage(true);
    setIsExcuseModalOpen(false);
    setExcuseText('');
    setTimeout(() => setExcuseSuccessMessage(false), 6000);
  };

  // ==========================================
  // VIEW A: PARENT / GUARDIAN & STUDENT VIEW
  // ==========================================
  if (isFamily || isStudent) {
    const smsActive = Boolean(selectedChild?.flags.can_receive_sms);
    const childName = isFamily ? selectedChild?.studentName : ownStudent?.fullName;

    return (
      <div className="space-y-6 max-w-5xl mx-auto px-2 sm:px-4 py-2">
        {/* Success Alert */}
        {excuseSuccessMessage && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>درخواست موجه‌سازی غیبت با موفقیت ثبت شد و به ناظم آموزشی ارجاع گردید.</span>
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
              مشاهده سوابق جلسات، غیبت‌ها و تأخیرها بر پایهٔ ثبت واقعی کلاس‌ها
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
                  c.studentUlid === selectedChild?.studentUlid
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
                  smsActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400',
                )}
              >
                <PhoneCall size={14} className={smsActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                <span>{smsActive ? 'سرویس پیامک ورود و خروج فعال است' : 'پیامک ورود و خروج برای این پیوند فعال نیست'}</span>
              </div>
            )}
          </div>

          {/* Quick Metrics — فقط با مجوز حضور این پیوند */}
          {isFamily && childAttendanceDenied && (
            <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
              <Lock size={20} className="mx-auto text-slate-400 mb-2" />
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                مشاهدهٔ حضور و غیاب برای پیوند شما فعال نیست (محدودیت نوع پیوند یا دادنامهٔ قضایی).
                <br />
                در صورت نیاز با دفتر مدرسه تماس بگیرید.
              </p>
            </div>
          )}
          {!(isFamily && childAttendanceDenied) && (
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
                {toPersianDigits(studentPresents)} روز
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
                {toPersianDigits(studentAbsents)} روز
              </span>
            </div>
          </div>
          )}
        </div>

        {isFamily && childAttendanceDenied ? (
          <div className="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
            <Lock size={20} className="mx-auto text-slate-400 mb-2" />
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              سوابق جلسات برای پیوند شما قابل نمایش نیست.
            </p>
          </div>
        ) : (
        <>
        {/* History Records Table / Cards */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">سوابق روزانه حضور و غیاب</h3>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5 font-bold">تاریخ</th>
                    <th className="p-3.5 font-bold">جلسه / درس</th>
                    <th className="p-3.5 font-bold">وضعیت حضور</th>
                    <th className="p-3.5 font-bold">میزان تأخیر / توضیحات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {studentRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-medium">{rec.date}</td>
                      <td className="p-3.5 text-slate-500 dark:text-slate-400">{rec.note || '—'}</td>
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
                        {rec.status === 'excused' && (
                          <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1.5">
                            <ShieldCheck size={14} />
                            غیبت موجه
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {rec.delayMinutes ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium font-mono">
                            {toPersianDigits(rec.delayMinutes)} دقیقه تأخیر
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </>
        )}

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
            <FormField label="تاریخ مورد نظر">
              <input
                type="text"
                defaultValue="۱۴۰۳/۰۷/۱۵"
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </FormField>
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
  // VIEW B: PRINCIPAL, DEPUTY & TEACHER VIEW
  // ==========================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-2">
      {/* Save Success Alert */}
      {saveSuccessMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
            <span>حضور و غیاب کلاس {currentClassroom.name} با موفقیت ثبت و نهایی شد.</span>
          </div>
          {smsSimulationLogs.length > 0 && (
            <div className="pl-6 space-y-1 text-emerald-700 dark:text-emerald-400 font-mono text-[11px]">
              {smsSimulationLogs.map((log, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span>·</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Page Title & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <CheckCircle2 className="text-blue-600 dark:text-blue-400" size={24} />
            {isAdmin ? 'مدیریت و نظارت جامع حضور و غیاب مدرسه' : 'دفتر ثبت حضور و غیاب کلاسی'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            مدیریت {toPersianDigits(INITIAL_CLASSROOMS.length)} کلاس و بیش از {toPersianDigits(totalStudentsCount)} دانش‌آموز، برنامه هفتگی و پیامک خودکار اولیا
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setIsTimetableDrawerOpen(!isTimetableDrawerOpen)}
            className="text-xs flex items-center gap-1.5"
          >
            <BookOpen size={15} />
            <span>برنامه هفتگی کلاس</span>
          </Button>

          {canEdit && (
            <>
              <Button
                variant="secondary"
                onClick={handleMarkAllPresent}
                className="text-xs flex items-center gap-1.5"
              >
                <UserCheck size={15} className="text-emerald-600" />
                <span>حاضر کردن همه کلاس</span>
              </Button>
              <Button
                onClick={() => setIsFinalizeModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Save size={15} />
                <span>نهایی‌سازی و ارسال پیامک</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* SCHOOL-WIDE KPI CARDS (FOR PRINCIPAL & ADMINS) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">کل دانش‌آموزان مدرسه</span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {toPersianDigits(totalStudentsCount)} نفر
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">در {toPersianDigits(INITIAL_CLASSROOMS.length)} کلاس درسی</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">نرخ کل حضور مدرسه</span>
          <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
            {toPersianDigits(overallAttendanceRate)}٪
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-1">شاخص انضباطی عالی</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">حاضرین امروز</span>
          <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {toPersianDigits(totalPresentCount)} نفر
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">به موقع در کلاس</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">تأخیر در ورود</span>
          <span className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
            {toPersianDigits(totalLateCount)} نفر
          </span>
          <span className="text-[10px] text-amber-500 block mt-1">با ثبت زمان دقیقه</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">غایبین امروز</span>
          <span className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
            {toPersianDigits(totalAbsentCount)} نفر
          </span>
          <span className="text-[10px] text-rose-500 block mt-1">پیامک ولی ارسال شد</span>
        </div>
      </div>

      {/* WEEKLY TIMETABLE DRAWER (COLLAPSIBLE) */}
      {isTimetableDrawerOpen && (
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen size={16} className="text-blue-400" />
                برنامه هفتگی و ساعات درسی {currentClassroom.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                دبیر راهنما: {currentClassroom.headTeacherId === 'usr_teacher_karimi' ? 'مهندس محسن کریمی' : 'دکتر فاطمه صابری'} · اتاق {currentClassroom.roomNumber}
              </p>
            </div>
            <button
              onClick={() => setIsTimetableDrawerOpen(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              بستن
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {classTimetable.map((slot) => (
              <div
                key={slot.id}
                className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-300">{slot.dayName}</span>
                  <span className="font-mono text-slate-400 text-[11px]">{slot.timeRange}</span>
                </div>
                <p className="font-bold text-white text-sm">{slot.subject}</p>
                <p className="text-slate-400 text-[11px]">مدرس: {slot.teacherName}</p>
                {slot.isOnlineAvailable && (
                  <span className="inline-block text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    امکان پخش آنلاین
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTROLS & CLASSROOM SELECTOR BAR */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Class Selection Tabs (Mobile Scrollable) */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
            انتخاب کلاس درسی ({toPersianDigits(INITIAL_CLASSROOMS.length)} کلاس فعال):
          </label>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {INITIAL_CLASSROOMS.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClassId(c.id)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0',
                  selectedClassId === c.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                )}
              >
                {c.name} ({toPersianDigits(c.studentCount)} نفر)
              </button>
            ))}
          </div>
        </div>

        {/* Date, Search & Status Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">تاریخ:</span>
            <input
              type="text"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 font-mono"
            />
          </div>

          {/* Search Student */}
          <div className="relative">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام یا شماره دانش‌آموز..."
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg pr-9 pl-3 py-2 text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">وضعیت:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="present">حاضر</option>
              <option value="late">با تأخیر</option>
              <option value="absent">غایب</option>
              <option value="excused">موجه</option>
            </select>
          </div>
        </div>
      </div>

      {/* CLASSROOM STUDENTS ATTENDANCE ROSTER */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* Table Header Summary */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              لیست دانش‌آموزان {currentClassroom.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              نمایش {toPersianDigits(displayedStudents.length)} از {toPersianDigits(classStudents.length)} دانش‌آموز این کلاس
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              حاضر: {toPersianDigits(classPresentCount)}
            </span>
            <span>·</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">
              تأخیر: {toPersianDigits(classLateCount)}
            </span>
            <span>·</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">
              غایب: {toPersianDigits(classAbsentCount)}
            </span>
          </div>
        </div>

        {/* Table / List */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5 font-bold w-12 text-center">ردیف</th>
                <th className="p-3.5 font-bold">نام و نام خانوادگی</th>
                <th className="p-3.5 font-bold hidden sm:table-cell">شماره پرونده</th>
                <th className="p-3.5 font-bold">وضعیت حضور</th>
                <th className="p-3.5 font-bold hidden md:table-cell">توضیحات و زمان تأخیر</th>
                {canEdit && <th className="p-3.5 font-bold text-center">تغییر وضعیت سریع</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {displayedStudents.map((rec, index) => {
                const stdInfo = INITIAL_STUDENTS.find((s) => s.id === rec.studentId);

                return (
                  <tr key={rec.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 text-center font-mono text-slate-400">
                      {toPersianDigits(index + 1)}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                      {rec.studentName}
                      {stdInfo?.enrollmentStatus === 'guest' && (
                        <span className="mr-1.5 text-[10px] text-purple-600 dark:text-purple-400 font-normal">
                          (دانش‌آموز مهمان)
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-slate-500 hidden sm:table-cell">
                      {toPersianDigits(stdInfo?.studentNumber || '')}
                    </td>
                    <td className="p-3.5">
                      {rec.status === 'present' && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 size={14} />
                          حاضر
                        </span>
                      )}
                      {rec.status === 'late' && (
                        <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                          <Clock size={14} />
                          با تأخیر ({toPersianDigits(rec.delayMinutes || 15)} دقیقه)
                        </span>
                      )}
                      {rec.status === 'absent' && (
                        <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                          <XCircle size={14} />
                          غایب
                        </span>
                      )}
                      {rec.status === 'excused' && (
                        <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                          <ShieldCheck size={14} />
                          موجه
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 hidden md:table-cell text-slate-500 max-w-xs truncate">
                      {rec.note || (rec.delayMinutes ? `ورود با ${toPersianDigits(rec.delayMinutes)} دقیقه تأخیر` : '—')}
                    </td>
                    {canEdit && (
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleInlineStatusChange(rec.studentId, 'present')}
                            className={cn(
                              'px-2 py-1 rounded text-xs transition-colors',
                              rec.status === 'present'
                                ? 'bg-emerald-600 text-white font-bold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-100'
                            )}
                          >
                            حاضر
                          </button>
                          <button
                            onClick={() => handleInlineStatusChange(rec.studentId, 'late')}
                            className={cn(
                              'px-2 py-1 rounded text-xs transition-colors',
                              rec.status === 'late'
                                ? 'bg-amber-500 text-white font-bold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-100'
                            )}
                          >
                            تأخیر
                          </button>
                          <button
                            onClick={() => handleInlineStatusChange(rec.studentId, 'absent')}
                            className={cn(
                              'px-2 py-1 rounded text-xs transition-colors',
                              rec.status === 'absent'
                                ? 'bg-rose-600 text-white font-bold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-100'
                            )}
                          >
                            غایب
                          </button>
                          <button
                            onClick={() => handleInlineStatusChange(rec.studentId, 'excused')}
                            className={cn(
                              'px-2 py-1 rounded text-xs transition-colors',
                              rec.status === 'excused'
                                ? 'bg-blue-600 text-white font-bold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-blue-100'
                            )}
                          >
                            موجه
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* REASON MODAL FOR LATE / EXCUSED CORRECTION */}
      <Modal
        isOpen={isEditReasonModalOpen}
        onClose={() => setIsEditReasonModalOpen(false)}
        title="ثبت جزئیات تغییر وضعیت و علت اصلاح"
      >
        <div className="space-y-4">
          {targetNewStatus === 'late' && (
            <FormField label="مدت زمان تأخیر به دقیقه">
              <input
                type="number"
                min={5}
                max={90}
                value={delayMinutesInput}
                onChange={(e) => setDelayMinutesInput(Number(e.target.value))}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </FormField>
          )}

          <FormField label="دلیل ثبت / اصلاح وضعیت (جهت ثبت در لاگ مستند مدرسه)">
            <textarea
              rows={3}
              value={correctionReasonText}
              onChange={(e) => setCorrectionReasonText(e.target.value)}
              placeholder="مثال: ارائه گواهی پزشک، نقص فنی سرویس مدرسه، هماهنگی قبلی ولی با دفتر..."
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsEditReasonModalOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleSaveCorrectionReason} className="bg-blue-600 text-white hover:bg-blue-700">
              ثبت و اعمال وضعیت
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL FINALIZE ATTENDANCE & SMS DISPATCH */}
      <Modal
        isOpen={isFinalizeModalOpen}
        onClose={() => setIsFinalizeModalOpen(false)}
        title="تأیید نهایی‌سازی و ارسال خودکار پیامک به اولیا"
      >
        <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>
            شما در حال نهایی‌سازی دفتر حضور و غیاب برای <strong>{currentClassroom.name}</strong> در تاریخ <strong>{selectedDate}</strong> هستید.
          </p>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl space-y-1.5 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between font-bold">
              <span>تعداد کل حاضرین:</span>
              <span className="text-emerald-600">{toPersianDigits(classPresentCount)} نفر</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>تعداد افراد با تأخیر:</span>
              <span className="text-amber-600">{toPersianDigits(classLateCount)} نفر</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>تعداد غایبین:</span>
              <span className="text-rose-600">{toPersianDigits(classAbsentCount)} نفر</span>
            </div>
          </div>

          <p className="text-slate-500">
            با تأیید شما، سامانه پیامک برای اولیای دانش‌آموزان غایب و با تأخیر پیامک اطلاع‌رسانی ارسال خواهد نمود و رویداد در سیستم مانیتورینگ ثبت می‌شود.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsFinalizeModalOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleFinalizeSave} className="bg-blue-600 text-white hover:bg-blue-700">
              تأیید نهایی و ارسال پیامک‌ها
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
