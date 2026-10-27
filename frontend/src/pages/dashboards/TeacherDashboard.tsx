import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, CheckSquare, BookOpen, FileText, ArrowRight,
  Clock, Plus, AlertCircle, ArrowLeftRight, CheckCircle2,
  Calendar, Lock, Edit3, Save, Sparkles, Video, Play, ExternalLink,
  ChevronRight, Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader } from '../../components/common';
import { toPersianDigits, formatScore, cn } from '../../utils/persian';
import { AssignmentService, AttendanceService, ScheduleService, AuditService } from '../../services';
import { INITIAL_CLASSROOMS, INITIAL_WEEKLY_TIMETABLE } from '../../data/mockData';
import { WeeklyTimetableSlot } from '../../types';

export const TeacherDashboard: React.FC = () => {
  const { currentUser, userAssignments, switchContext, activeRole } = useAuth();
  const classrooms = INITIAL_CLASSROOMS;
  const submissions = AssignmentService.getSubmissions();
  const pendingGrading = submissions.filter((s) => s.status === 'submitted');
  const attendanceToday = AttendanceService.getByClassAndDate('cls_101', '۱۴۰۳/۰۷/۱۵');

  const presentCount = attendanceToday.filter((a) => a.status === 'present').length;
  const absentCount = attendanceToday.filter((a) => a.status === 'absent').length;
  const lateCount = attendanceToday.filter((a) => a.status === 'late').length;

  const parentAssignment = userAssignments.find((ra) => ra.roleId === 'guardian');

  // Teacher Schedule (Section 25: Current & Next class detection)
  const teacherId = currentUser.id || 'usr_teacher_karimi';
  const allTeacherSlots = INITIAL_WEEKLY_TIMETABLE.filter(
    (s) => s.teacherId === teacherId || s.teacherName.includes('کریمی')
  );

  // Time simulation state for teacher schedule
  const [currentTimeSimulated, setCurrentTimeSimulated] = useState<string>('۱۰:۲۵');

  // Next session edit state (Section 28)
  const [isEditNextSessionOpen, setIsEditNextSessionOpen] = useState(false);
  const [nextSessionTopic, setNextSessionTopic] = useState('تحلیل برداری نیروها، قانون کولن و حل نمونه سوالات کنکور');
  const [nextSessionNotes, setNextSessionNotes] = useState('آشنایی با بردار یکه، رسم خطوط میدان الکتریکی و انجام آزمایش مجازی در سامانه');
  const [nextSessionResources, setNextSessionResources] = useState('فایل PDF جزوه تکمیلی فصل اول + ویدیوی شبیه‌ساز PhET');
  const [saveSessionFeedback, setSaveSessionFeedback] = useState<string | null>(null);

  // Current class identification (Slot running during 10:25)
  // Period 2: 09:45 - 11:15 is active!
  const currentClassSlot: WeeklyTimetableSlot = allTeacherSlots.find(
    (s) => s.timeRange.includes('۰۹:۴۵') || s.period === 2
  ) || {
    id: 'tt_cur',
    classroomId: 'cls_101',
    className: 'کلاس ۱۰۱ (دهم ریاضی الف)',
    dayOfWeek: 'saturday',
    dayName: 'شنبه',
    period: 2,
    timeRange: '۰۹:۴۵ - ۱۱:۱۵',
    subject: 'فیزیک ۱ (حل مسئله و کارگاه)',
    teacherId: teacherId,
    teacherName: currentUser.fullName,
    roomNumber: '۱۰۱',
  };

  // Next class identification (Period 3: 11:30 - 13:00)
  const nextClassSlot: WeeklyTimetableSlot = allTeacherSlots.find(
    (s) => s.timeRange.includes('۱۱:۳۰') || s.period === 3
  ) || {
    id: 'tt_next',
    classroomId: 'cls_101',
    className: 'کلاس ۱۰۱ (دهم ریاضی الف)',
    dayOfWeek: 'saturday',
    dayName: 'شنبه',
    period: 3,
    timeRange: '۱۱:۳۰ - ۱۳:۰۰',
    subject: 'هندسه تحلیلی و جبر خطی',
    teacherId: teacherId,
    teacherName: currentUser.fullName,
    roomNumber: '۱۰۱',
    isOnlineAvailable: true,
  };

  const handleSaveNextSession = (e: React.FormEvent) => {
    e.preventDefault();
    AuditService.log({
      actorId: teacherId,
      actorName: currentUser.fullName,
      actorRole: activeRole.persianTitle,
      action: 'ویرایش محتوای آموزشی جلسه بعدی',
      entityType: 'online_class',
      entityId: nextClassSlot.id,
      description: `به‌روزرسانی مباحث جلسه «${nextClassSlot.subject}» در ${nextClassSlot.className} بدون تغییر زمان یا مدرس.`,
    });

    setSaveSessionFeedback('محتوای آموزشی و پیوست‌های جلسه بعدی با موفقیت ثبت و برای دانش‌آموزان به‌روزرسانی شد.');
    setTimeout(() => {
      setSaveSessionFeedback(null);
      setIsEditNextSessionOpen(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`میز کار آموزشی — ${currentUser.fullName}`}
        subtitle="دبیر ریاضیات و فیزیک · دوره دوم دبیرستان مشاهیر آینده"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/attendance">
              <Button variant="outline" size="sm" icon={<CheckSquare size={15} />}>
                ثبت حضور و غیاب
              </Button>
            </Link>
            <Link to="/assignments">
              <Button variant="primary" size="sm" icon={<Plus size={15} />}>
                تعریف تکلیف جدید
              </Button>
            </Link>
          </div>
        }
      />

      {/* Dual Role Alert if user has guardian context */}
      {parentAssignment && (
        <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-right">
            <ArrowLeftRight size={20} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">حساب شما دارای دو زمینه کاری مجزا است:</span>
              <p className="text-[#526176] dark:text-[#B3C0D2] mt-0.5">
                شما هم‌اکنون در زمینه «دبیر ریاضی» هستید و می‌توانید در هر لحظه به زمینه «ولی دانش‌آموز (آرش کریمی)» سوییچ کنید بدون تداخل دسترسی‌ها.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => switchContext(parentAssignment.id)}
            className="shrink-0"
          >
            سوییچ به زمینه والد
          </Button>
        </div>
      )}

      {/* SECTION 25 & 26: CURRENT CLASS & NEXT CLASS WORKFLOW CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CURRENT RUNNING CLASS (کلاس جاری) */}
        <Card className="border-rose-500/40 dark:border-rose-500/30 bg-gradient-to-br from-rose-50/40 via-white to-white dark:from-rose-950/20 dark:via-[#182231] dark:to-[#182231] shadow-sm text-right">
          <div className="flex items-center justify-between pb-3 border-b border-rose-100 dark:border-rose-900/40">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                کلاس جاری در حال برگزاری
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                ساعت: {currentClassSlot.timeRange}
              </span>
            </div>
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
              زنگ {toPersianDigits(currentClassSlot.period)}
            </span>
          </div>

          <div className="pt-3 space-y-2">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              {currentClassSlot.subject}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {currentClassSlot.className}
              </span>
              <span>·</span>
              <span>محل تشکیل: <strong>اتاق {toPersianDigits(currentClassSlot.roomNumber)}</strong></span>
              <span>·</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                پنجره زمانی ثبت حضور و غیاب باز است
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              طبق قوانین بند ۲۶ سند حاکمیت آموزشی، در بازه برگزاری کلاس می‌توانید حضور و غیاب ۲۸ دانش‌آموز این کلاس را ثبت و تایید نمایید.
            </p>

            <div className="pt-3 flex flex-wrap items-center gap-2">
              <Link to="/attendance" className="flex-1 min-w-[160px]">
                <Button variant="primary" size="sm" className="w-full" icon={<CheckSquare size={14} />}>
                  ثبت سریع حضور و غیاب کلاس جاری
                </Button>
              </Link>
              <Link to="/online-classes">
                <Button variant="outline" size="sm" icon={<Video size={14} />}>
                  مشاهده اتاق آنلاین
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* NEXT SCHEDULED SESSION (جلسه بعدی تدریس - ویرایش طبق ماده ۲۸) */}
        <Card className="border-blue-500/40 dark:border-blue-500/30 bg-gradient-to-br from-blue-50/40 via-white to-white dark:from-blue-950/20 dark:via-[#182231] dark:to-[#182231] shadow-sm text-right">
          <div className="flex items-center justify-between pb-3 border-b border-blue-100 dark:border-blue-900/40">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                جلسه بعدی تدریس امروز
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                شروع: {nextClassSlot.timeRange.split(' - ')[0]}
              </span>
            </div>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
              زنگ {toPersianDigits(nextClassSlot.period)}
            </span>
          </div>

          <div className="pt-3 space-y-2">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              {nextClassSlot.subject}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {nextClassSlot.className}
              </span>
              <span>·</span>
              <span>ساعت: <strong>{nextClassSlot.timeRange}</strong></span>
              <span>·</span>
              <span>اتاق: <strong>{toPersianDigits(nextClassSlot.roomNumber)}</strong></span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
              <span className="text-slate-400 block text-[11px]">رئوس مباحث و محتوای ثبت‌شده:</span>
              <p className="text-slate-700 dark:text-slate-200 font-medium truncate">
                {nextSessionTopic}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                مدرس و زمان قفل است (طبق اصل ۲۸)
              </span>
              <Button
                variant="outline"
                size="sm"
                icon={<Edit3 size={13} />}
                onClick={() => setIsEditNextSessionOpen(true)}
              >
                ویرایش محتوای آموزشی جلسه بعدی
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کلاس‌های فعال</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {toPersianDigits(classrooms.length)}
            </span>
            <Badge variant="primary">۸۴ دانش‌آموز</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">تکالیف در انتظار تصحیح</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {toPersianDigits(pendingGrading.length)}
            </span>
            <Badge variant="warning">نیازمند اقدام</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">حضور امروز (کلاس ۱۰۱)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {toPersianDigits(presentCount)} <span className="text-xs font-normal text-slate-500">حاضر</span>
            </span>
            <Badge variant="neutral">{toPersianDigits(absentCount)} غایب</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">آزمون‌های تعریف‌شده من</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {toPersianDigits(2)}
            </span>
            <Badge variant="success">فعال</Badge>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Assigned Classes */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <Users size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                کلاس‌های تخصیص‌یافته به دبیر
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {classrooms.map((cls) => (
                <div
                  key={cls.id}
                  className="p-4 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 text-right"
                >
                  <span className="text-xs font-bold text-[#2457C5] dark:text-[#8BAEFF]">{cls.grade}</span>
                  <h4 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mt-0.5">{cls.name}</h4>
                  <div className="flex items-center justify-between text-xs text-[#526176] dark:text-[#B3C0D2] mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span>{toPersianDigits(cls.studentCount)} دانش‌آموز</span>
                    <span className="font-mono">اتاق {toPersianDigits(cls.roomNumber)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Pending Submissions to Grade */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <BookOpen size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                پاسخ‌برگ‌های ارسالی دانش‌آموزان (آماده نمره‌دهی)
              </h3>
              <Link to="/assignments" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                مدیریت همه تکالیف
              </Link>
            </div>

            {pendingGrading.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">تمامی پاسخ‌برگ‌ها تصحیح شده‌اند.</p>
            ) : (
              <div className="space-y-3">
                {pendingGrading.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB]">{sub.studentName}</span>
                        <Badge variant="warning">در انتظار نمره‌دهی</Badge>
                      </div>
                      <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-1">{sub.content}</p>
                      <span className="text-[11px] text-slate-400 mt-1 block">زمان ارسال: {sub.submissionDate}</span>
                    </div>

                    <Link to="/assignments" className="shrink-0">
                      <Button variant="primary" size="sm">
                        ثبت نمره و بازخورد
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Attendance Summary & Fast Entry */}
        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <CheckSquare size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
              خلاصه حضور و غیاب امروز (کلاس ۱۰۱)
            </h3>
            <div className="space-y-2 text-xs text-right mb-4">
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                <span>دانش‌آموزان حاضر:</span>
                <strong className="tabular-nums font-bold">{toPersianDigits(presentCount)} نفر</strong>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300">
                <span>غایبین:</span>
                <strong className="tabular-nums font-bold">{toPersianDigits(absentCount)} نفر</strong>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                <span>تأخیر ثبت‌شده:</span>
                <strong className="tabular-nums font-bold">{toPersianDigits(lateCount)} نفر</strong>
              </div>
            </div>
            <Link to="/attendance">
              <Button variant="outline" size="sm" className="w-full">
                ورود به دفتر نمرات و حضور و غیاب
              </Button>
            </Link>
          </Card>
        </div>
      </div>

      {/* SECTION 28 MODAL: EDIT NEXT SESSION CONTENT (LOCKED TEACHER/TIME/CLASS) */}
      <Modal
        isOpen={isEditNextSessionOpen}
        onClose={() => setIsEditNextSessionOpen(false)}
        title="ویرایش محتوای آموزشی جلسه بعدی تدریس"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveNextSession} className="space-y-4 text-right">
          {saveSessionFeedback && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{saveSessionFeedback}</span>
            </div>
          )}

          {/* Locked parameters warning banner per Section 28 */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
              <Lock size={14} className="text-amber-600 shrink-0" />
              <span>فیلدهای هویتی جلسه قفل هستند (ماده ۲۸ سند حاکمیت آموزشی):</span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              کلاس «{nextClassSlot.className}»، زمان «{nextClassSlot.timeRange}» و نام مدرس «{currentUser.fullName}» توسط برنامه رسمی معاونت آموزشی تعیین شده و توسط دبیر قابل تغییر نیست.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-slate-400 block text-[10px]">کلاس و پایه:</span>
              <strong className="text-slate-800 dark:text-slate-200">{nextClassSlot.className}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">ساعت برگزاری:</span>
              <strong className="font-mono text-slate-800 dark:text-slate-200">{nextClassSlot.timeRange}</strong>
            </div>
          </div>

          <FormField label="عنوان و رئوس مطالب جلسه" required>
            <input
              type="text"
              value={nextSessionTopic}
              onChange={(e) => setNextSessionTopic(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </FormField>

          <FormField label="شرح درس و تکالیف مرتبط">
            <textarea
              rows={3}
              value={nextSessionNotes}
              onChange={(e) => setNextSessionNotes(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </FormField>

          <FormField label="منابع، جزوات و پیوست‌های آموزشی">
            <input
              type="text"
              value={nextSessionResources}
              onChange={(e) => setNextSessionResources(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setIsEditNextSessionOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit" icon={<Save size={14} />}>
              ذخیره تغییرات جلسه بعدی
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
