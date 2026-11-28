import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Plus, School, Trash2, Users, CalendarDays, GraduationCap, Pencil,
  BookOpen, Info, AlertCircle, RefreshCw, ShieldCheck, ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, PageHeader, EmptyState, AccessDeniedGate, Modal, FormField } from '../components/common';
import { JalaliDatePicker } from '../components/common/JalaliDatePicker';
import { toPersianDigits, cn } from '../utils/persian';
import { formatJalaliDate } from '../utils/jalali';
import {
  ApiAcademicService,
  ApiClassroomAdminService,
  AcademicYearRow,
  ClassroomAdminRow,
  EnrollmentRow,
  IdTitleOption,
  SubjectRow,
  TeacherOption,
  TimetableSlotRow,
} from '../api/data';
import { ApiError } from '../api/client';

/** Backend weekday convention: ۰ = شنبه … ۶ = جمعه. */
const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

/** JS weekday → backend weekday (شنبه=۰). */
const todayWeekdayIndex = (): number => (new Date().getDay() + 1) % 7;

/** A titled block on the side rail: icon chip, title, count badge, one action. */
const RailCardHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  badge?: string;
  action?: React.ReactNode;
}> = ({ icon, title, badge, action }) => (
  <div className="flex items-center gap-2 pb-3">
    <span className="w-8 h-8 rounded-xl bg-[#EAF1FB] dark:bg-[#1D2B44] text-[#2457C5] dark:text-[#8BAEFF] flex items-center justify-center shrink-0">
      {icon}
    </span>
    <h3 className="text-[13px] font-bold text-[#202B3C] dark:text-[#F1F5FB]">{title}</h3>
    {badge !== undefined && (
      <span className="mr-auto text-[10px] font-black rounded-full bg-[#F1F4F9] dark:bg-[#1B2534] text-[#526176] dark:text-[#B3C0D2] px-2 py-0.5 tabular-nums">
        {badge}
      </span>
    )}
    {action && <span className={badge !== undefined ? 'mr-1' : 'mr-auto'}>{action}</span>}
  </div>
);

const IconAction: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({
  title,
  onClick,
  children,
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF1FB] dark:bg-[#1D2B44] text-[#2457C5] dark:text-[#8BAEFF] hover:bg-[#DBE7FA] dark:hover:bg-[#24365B] transition-colors"
  >
    {children}
  </button>
);

const StatTile: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({ icon, value, label }) => (
  <div className="rounded-xl border border-[#DCE3EE] dark:border-[#2C3A4E] bg-white/80 dark:bg-[#131C29] px-3 py-2">
    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#526176] dark:text-[#B3C0D2]">
      {icon}
      {label}
    </div>
    <p className="text-lg font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums mt-0.5">{value}</p>
  </div>
);

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}> = ({ icon, title, children, action }) => (
  <div className="rounded-2xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231]">
    <div className="flex items-center justify-between gap-3 flex-wrap px-4 pt-3.5 pb-3 border-b border-[#EEF2F8] dark:border-[#2C3A4E]">
      <h3 className="text-[13px] font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-[#EAF1FB] dark:bg-[#1D2B44] text-[#2457C5] dark:text-[#8BAEFF] flex items-center justify-center">
          {icon}
        </span>
        {title}
      </h3>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const inputCls =
  'w-full rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] px-3 py-2 text-sm text-[#202B3C] dark:text-[#F1F5FB] outline-none focus:border-[#2457C5]';

export const ClassroomsPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();
  const isBusDriver = activeRole.id === 'bus_driver';
  const canView = hasAccess('academic:view');
  const canManageStructure = hasAccess('academic:manage');
  const canEnroll = hasAccess('enrollments:manage');
  const canTimetable = hasAccess('timetable:manage');

  const [classrooms, setClassrooms] = useState<ClassroomAdminRow[]>([]);
  const [selectedUlid, setSelectedUlid] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [slots, setSlots] = useState<TimetableSlotRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [years, setYears] = useState<IdTitleOption[]>([]);
  const [yearRows, setYearRows] = useState<AcademicYearRow[]>([]);
  const [gradeLevels, setGradeLevels] = useState<IdTitleOption[]>([]);
  const [assignments, setAssignments] = useState<{ id: number; subject: string; classroom: string; teacher: string | null }[]>([]);
  const [students, setStudents] = useState<{ ulid: string; fullName: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // create-classroom form (modal)
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newYearId, setNewYearId] = useState<number | ''>('');
  const [newGradeId, setNewGradeId] = useState<number | ''>('');
  const [creating, setCreating] = useState(false);

  // enroll form
  const [enrollStudent, setEnrollStudent] = useState('');
  const [enrollDate, setEnrollDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [enrolling, setEnrolling] = useState(false);

  // assign form
  const [assignSubjectId, setAssignSubjectId] = useState<number | ''>('');
  const [assignTeacherUlid, setAssignTeacherUlid] = useState('');
  const [assigning, setAssigning] = useState(false);

  // timetable grid editing — one cell at a time through the modal
  const [slotModal, setSlotModal] = useState<{
    mode: 'create' | 'edit';
    weekday: number;
    period: number;
    slotId?: number;
    subject?: string | null;
    csId: number | '';
    starts: string;
    ends: string;
  } | null>(null);
  const [slotSaving, setSlotSaving] = useState(false);

  // classroom rename — the only editable field after creation
  const [renameModal, setRenameModal] = useState<{ ulid: string; title: string } | null>(null);
  const [renaming, setRenaming] = useState(false);

  // year management (academic.manage = مدیر / معاون آموزشی) — modal form
  const [isCreateYearOpen, setIsCreateYearOpen] = useState(false);
  const [newYearTitle, setNewYearTitle] = useState('');
  const [newYearStarts, setNewYearStarts] = useState('');
  const [newYearEnds, setNewYearEnds] = useState('');
  const [newYearCurrent, setNewYearCurrent] = useState(false);
  const [creatingYear, setCreatingYear] = useState(false);
  const [promotingYearId, setPromotingYearId] = useState<number | null>(null);

  // subject creation — modal form
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [newSubjectTitle, setNewSubjectTitle] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [creatingSubject, setCreatingSubject] = useState(false);

  // subject edit / delete (blocked server-side while assigned to a classroom)
  const [editSubject, setEditSubject] = useState<SubjectRow | null>(null);
  const [editSubjectTitle, setEditSubjectTitle] = useState('');
  const [editSubjectCode, setEditSubjectCode] = useState('');
  const [savingSubject, setSavingSubject] = useState(false);
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState<SubjectRow | null>(null);
  const [deletingSubject, setDeletingSubject] = useState(false);
  // Armed after a 422: the subject is assigned, so the modal offers the
  // destructive "force" confirm that cascades the dependents.
  const [forceDeleteArmed, setForceDeleteArmed] = useState(false);

  // Ending an enrollment is a destructive, history-bearing action: the first
  // click only arms the row, the second one commits.
  const [armedEndId, setArmedEndId] = useState<number | null>(null);

  const selected = classrooms.find((c) => c.ulid === selectedUlid) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rooms, subs, teachersList, yearRowsList, gradeList, teachingSubjects, studentList] = await Promise.all([
        ApiClassroomAdminService.list(),
        ApiClassroomAdminService.subjects().catch(() => [] as SubjectRow[]),
        ApiClassroomAdminService.teachers().catch(() => [] as TeacherOption[]),
        ApiClassroomAdminService.yearRows().catch(() => [] as AcademicYearRow[]),
        ApiClassroomAdminService.gradeLevels().catch(() => [] as IdTitleOption[]),
        ApiAcademicService.mySubjects().catch(() => []),
        ApiAcademicService.studentsInScope().catch(() => []),
      ]);
      setClassrooms(rooms);
      setSubjects(subs);
      setTeachers(teachersList);
      setYearRows(yearRowsList);
      setYears(yearRowsList.map((y) => ({ id: y.id, title: y.title })));
      setGradeLevels(gradeList);
      setAssignments(
        teachingSubjects.map((s) => ({ id: s.id, subject: s.subject ?? '', classroom: s.classroom ?? '', teacher: s.teacher })),
      );
      setStudents(studentList);
      setNewYearId((prev) => prev || yearRowsList.find((y) => y.isCurrent)?.id || yearRowsList[0]?.id || '');
      setNewGradeId((prev) => prev || gradeList[0]?.id || '');
      setSelectedUlid((prev) => prev ?? rooms[0]?.ulid ?? null);
    } catch (e) {
      setError(firstError(e, 'خطا در دریافت کلاس‌ها'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  const loadDetail = useCallback(async (classroomUlid: string) => {
    setDetailLoading(true);
    setEnrollStudent('');
    setArmedEndId(null);
    try {
      const [rows, slotRows] = await Promise.all([
        ApiClassroomAdminService.enrollments(classroomUlid),
        ApiClassroomAdminService.timetable(classroomUlid),
      ]);
      setEnrollments(rows);
      setSlots(slotRows);
    } catch (e) {
      setError(firstError(e, 'خطا در دریافت جزئیات کلاس'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUlid) loadDetail(selectedUlid);
  }, [selectedUlid, loadDetail]);

  // mySubjects carries the classroom title; keep only the selected room's rows.
  const selectedAssignments = useMemo(
    () => (selected ? assignments.filter((a) => a.classroom === selected.title) : []),
    [assignments, selected],
  );

  // The enroll dropdown never offers learners who are already active in this
  // classroom — the backend rejects duplicates, so the UI shouldn't list them.
  const enrollableStudents = useMemo(() => {
    const enrolled = new Set(enrollments.map((e) => e.studentUlid));
    return students.filter((s) => !enrolled.has(s.ulid));
  }, [students, enrollments]);

  const reloadAll = () => {
    load();
    if (selectedUlid) loadDetail(selectedUlid);
  };

  const openCreateClassroom = () => {
    setNewTitle('');
    setIsCreateClassOpen(true);
  };

  const openCreateYear = () => {
    setNewYearTitle('');
    setNewYearStarts('');
    setNewYearEnds('');
    setNewYearCurrent(false);
    setIsCreateYearOpen(true);
  };

  const openCreateSubject = () => {
    setNewSubjectTitle('');
    setNewSubjectCode('');
    setIsCreateSubjectOpen(true);
  };

  const createClassroom = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newTitle.trim() || newYearId === '' || newGradeId === '') return;
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await ApiClassroomAdminService.create({
        title: newTitle.trim(),
        academic_year_id: Number(newYearId),
        grade_level_id: Number(newGradeId),
      });
      setNewTitle('');
      setIsCreateClassOpen(false);
      setNotice('کلاس ساخته شد.');
      await load();
    } catch (e) {
      setError(firstError(e, 'خطا در ساخت کلاس'));
    } finally {
      setCreating(false);
    }
  };

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearTitle.trim()) {
      setError('عنوان سال تحصیلی را وارد نمایید.');
      return;
    }
    setCreatingYear(true);
    setError(null);
    try {
      await ApiClassroomAdminService.createYear({
        title: newYearTitle.trim(),
        startsOn: newYearStarts || null,
        endsOn: newYearEnds || null,
        isCurrent: newYearCurrent,
      });
      setNewYearTitle('');
      setNewYearStarts('');
      setNewYearEnds('');
      setNewYearCurrent(false);
      setIsCreateYearOpen(false);
      setNotice('سال تحصیلی ساخته شد.');
      await load();
    } catch (err) {
      setError(firstError(err, 'خطا در ساخت سال تحصیلی'));
    } finally {
      setCreatingYear(false);
    }
  };

  const handlePromoteYear = async (id: number) => {
    setPromotingYearId(id);
    setError(null);
    try {
      await ApiClassroomAdminService.updateYear(id, { isCurrent: true });
      setNotice('سال جاری تغییر کرد.');
      await load();
    } catch (err) {
      setError(firstError(err, 'خطا در تغییر سال جاری'));
    } finally {
      setPromotingYearId(null);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectTitle.trim()) {
      setError('عنوان درس را وارد نمایید.');
      return;
    }
    setCreatingSubject(true);
    setError(null);
    try {
      await ApiClassroomAdminService.createSubject({
        title: newSubjectTitle.trim(),
        code: newSubjectCode.trim() || undefined,
      });
      setNewSubjectTitle('');
      setNewSubjectCode('');
      setIsCreateSubjectOpen(false);
      setNotice('درس به مدرسه اضافه شد.');
      await load();
    } catch (err) {
      setError(firstError(err, 'خطا در افزودن درس'));
    } finally {
      setCreatingSubject(false);
    }
  };

  const openEditSubject = (s: SubjectRow) => {
    setEditSubject(s);
    setEditSubjectTitle(s.title);
    setEditSubjectCode(s.code ?? '');
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSubject || !editSubjectTitle.trim()) return;

    setSavingSubject(true);
    setError(null);
    try {
      await ApiClassroomAdminService.updateSubject(editSubject.id, {
        title: editSubjectTitle.trim(),
        code: editSubjectCode.trim() || null,
      });
      setEditSubject(null);
      setNotice('درس ویرایش شد.');
      await load();
    } catch (err) {
      setError(firstError(err, 'خطا در ویرایش درس'));
    } finally {
      setSavingSubject(false);
    }
  };

  const handleDeleteSubject = async (force: boolean) => {
    if (!deleteSubjectTarget) return;

    setDeletingSubject(true);
    setError(null);
    try {
      await ApiClassroomAdminService.deleteSubject(deleteSubjectTarget.id, force);
      setNotice(`درس «${deleteSubjectTarget.title}» حذف شد.`);
      setDeleteSubjectTarget(null);
      setForceDeleteArmed(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        // Assigned to classrooms: arm the destructive confirm in the modal.
        setForceDeleteArmed(true);
      } else {
        setError(firstError(err, 'خطا در حذف درس'));
        setDeleteSubjectTarget(null);
        setForceDeleteArmed(false);
      }
    } finally {
      setDeletingSubject(false);
    }
  };

  const enroll = async () => {
    if (!selected || !enrollStudent) return;
    setEnrolling(true);
    setError(null);
    setNotice(null);
    try {
      await ApiClassroomAdminService.enroll(selected.ulid, enrollStudent, enrollDate);
      setEnrollStudent('');
      setNotice('دانش‌آموز به کلاس اضافه شد.');
      await loadDetail(selected.ulid);
    } catch (e) {
      setError(firstError(e, 'خطا در ثبت‌نام دانش‌آموز'));
    } finally {
      setEnrolling(false);
    }
  };

  const endEnrollment = async (row: EnrollmentRow) => {
    if (!selected) return;
    setError(null);
    setNotice(null);
    try {
      await ApiClassroomAdminService.endEnrollment(row.enrollmentId, 'ended');
      setArmedEndId(null);
      setNotice(`ثبت‌نام ${row.studentName} خاتمه یافت.`);
      await loadDetail(selected.ulid);
    } catch (e) {
      setError(firstError(e, 'خطا در خاتمه ثبت‌نام'));
    }
  };

  const assign = async () => {
    if (!selected || assignSubjectId === '') return;
    setAssigning(true);
    setError(null);
    setNotice(null);
    try {
      await ApiClassroomAdminService.assignTeacher(selected.ulid, Number(assignSubjectId), assignTeacherUlid || null);
      setAssignSubjectId('');
      setAssignTeacherUlid('');
      setNotice('تخصیص درس ثبت شد.');
      const teaching = await ApiAcademicService.mySubjects();
      setAssignments(
        teaching.map((s) => ({ id: s.id, subject: s.subject ?? '', classroom: s.classroom ?? '', teacher: s.teacher })),
      );
    } catch (e) {
      setError(firstError(e, 'خطا در تخصیص دبیر'));
    } finally {
      setAssigning(false);
    }
  };

  const openSlotModal = (weekday: number, period: number, slot?: TimetableSlotRow) => {
    if (!canTimetable) return;
    setSlotModal(
      slot
        ? {
            mode: 'edit',
            weekday: slot.weekday,
            period: slot.period,
            slotId: slot.id,
            subject: slot.subject,
            csId: '',
            starts: slot.startsAt,
            ends: slot.endsAt,
          }
        : {
            mode: 'create',
            weekday,
            period,
            csId: selectedAssignments[0]?.id ?? '',
            starts: '08:00',
            ends: '09:30',
          },
    );
  };

  const saveSlot = async () => {
    if (!selected || !slotModal) return;
    if (slotModal.mode === 'create' && slotModal.csId === '') return;
    setSlotSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (slotModal.mode === 'create') {
        await ApiClassroomAdminService.createSlot({
          classroom_subject_id: Number(slotModal.csId),
          weekday: slotModal.weekday,
          period: Number(slotModal.period),
          starts_at: slotModal.starts,
          ends_at: slotModal.ends,
        });
        setNotice('زنگ به برنامه هفتگی اضافه شد.');
      } else if (slotModal.slotId !== undefined) {
        await ApiClassroomAdminService.updateSlot(slotModal.slotId, {
          weekday: slotModal.weekday,
          period: Number(slotModal.period),
          starts_at: slotModal.starts,
          ends_at: slotModal.ends,
        });
        setNotice('زنگ به‌روزرسانی شد.');
      }
      setSlotModal(null);
      await loadDetail(selected.ulid);
    } catch (e) {
      setError(firstError(e, 'خطا در ثبت زنگ'));
    } finally {
      setSlotSaving(false);
    }
  };

  const removeSlot = async (id: number) => {
    if (!selected) return;
    setError(null);
    setNotice(null);
    try {
      await ApiClassroomAdminService.deleteSlot(id);
      setSlots((prev) => prev.filter((s) => s.id !== id));
      setSlotModal(null);
      setNotice('زنگ حذف شد.');
    } catch (e) {
      setError(firstError(e, 'خطا در حذف زنگ'));
    }
  };

  const saveRename = async () => {
    if (!renameModal || !renameModal.title.trim()) return;
    setRenaming(true);
    setError(null);
    setNotice(null);
    try {
      await ApiClassroomAdminService.rename(renameModal.ulid, renameModal.title.trim());
      setNotice('نام کلاس به‌روزرسانی شد.');
      setRenameModal(null);
      await load();
    } catch (e) {
      setError(firstError(e, 'خطا در ویرایش کلاس'));
    } finally {
      setRenaming(false);
    }
  };

  if (isBusDriver) {
    return (
      <AccessDeniedGate
        title="عدم دسترسی به ساختار آموزشی"
        requiredRoleOrPermission="academic:view"
        reason="حساب کاربری راننده سرویس به داده‌های آموزشی کلاس‌ها دسترسی ندارد."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  if (!canView) {
    return (
      <AccessDeniedGate
        title="عدم دسترسی به کلاس‌ها و برنامه هفتگی"
        requiredRoleOrPermission="academic:view"
        reason="حساب فعال شما مجوز مشاهده ساختار آموزشی مدرسه را ندارد."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="کلاس‌ها و برنامهٔ هفتگی"
        subtitle="مدیریت کلاس‌ها، ثبت‌نام و خاتمهٔ دانش‌آموز، تخصیص دبیر به درس و چیدن زنگ‌های هر کلاس"
        actions={
          canManageStructure ? (
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={openCreateClassroom}>
              کلاس جدید
            </Button>
          ) : undefined
        }
      />

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
            <span className="flex items-center gap-2 font-bold">
              <AlertCircle size={15} /> {error}
            </span>
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={reloadAll}>
              تلاش دوباره
            </Button>
          </div>
        </Card>
      )}
      {notice && (
        <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <ShieldCheck size={15} /> <span className="font-bold">{notice}</span>
          </div>
        </Card>
      )}

      {loading ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-10 text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال بارگذاری…
          </div>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
          {/* ── side rail: classrooms, years, subjects ── */}
          {/* min-w-0: grid items refuse to shrink below content min-width
              by default — the 620px timetable would stretch the whole page
              on phones (everything cut at the left edge). */}
          <div className="min-w-0 space-y-4">
            <Card>
              <div className="p-4">
                <RailCardHeader
                  icon={<School size={15} />}
                  title="کلاس‌های مدرسه"
                  badge={toPersianDigits(classrooms.length)}
                />
                {classrooms.length === 0 ? (
                  <p className="text-xs text-[#526176] dark:text-[#B3C0D2] py-3">
                    هنوز کلاسی ثبت نشده است{canManageStructure ? '؛ با دکمهٔ «کلاس جدید» شروع کنید.' : '.'}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {classrooms.map((c) => {
                      const active = c.ulid === selectedUlid;
                      return (
                        <button
                          key={c.ulid}
                          type="button"
                          onClick={() => setSelectedUlid(c.ulid)}
                          className={cn(
                            'group w-full text-right rounded-xl border px-3 py-2 transition-colors',
                            active
                              ? 'border-[#2457C5]/60 bg-[#F0F4FA] dark:border-[#2E4C8A]/50 dark:bg-[#1B2739]'
                              : 'border-transparent hover:border-[#DCE3EE] dark:hover:border-[#344257] hover:bg-[#F7F9FC] dark:hover:bg-[#131C29]',
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'min-w-0 flex-1 truncate text-sm font-bold',
                                active ? 'text-[#2457C5] dark:text-[#8BAEFF]' : 'text-[#202B3C] dark:text-[#F1F5FB]',
                              )}
                            >
                              {c.title}
                            </span>
                            {active && <ChevronLeft size={14} className="shrink-0 text-[#2457C5] dark:text-[#8BAEFF]" />}
                          </span>
                          <span className="block text-[10px] text-[#526176] dark:text-[#B3C0D2] mt-0.5">
                            {c.gradeLevel} · {c.academicYear}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>

            {canManageStructure && (
              <Card>
                <div className="p-4">
                  <RailCardHeader
                    icon={<CalendarDays size={15} />}
                    title="سال‌های تحصیلی"
                    badge={toPersianDigits(yearRows.length)}
                    action={
                      <IconAction title="افزودن سال تحصیلی" onClick={openCreateYear}>
                        <Plus size={14} />
                      </IconAction>
                    }
                  />

                  {yearRows.length > 0 ? (
                    <div className="space-y-1.5">
                      {yearRows.map((y) => (
                        <div
                          key={y.id}
                          className="flex items-center gap-2 rounded-xl border border-[#DCE3EE] dark:border-[#344257] px-2.5 py-1.5 hover:border-[#BECDE2] dark:hover:border-[#4A5A73] transition-colors"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{y.title}</span>
                            {(y.startsOn || y.endsOn) && (
                              <span className="block text-[10px] text-[#526176] dark:text-[#B3C0D2] mt-0.5 tabular-nums">
                                {y.startsOn ? formatJalaliDate(y.startsOn) : '—'} تا {y.endsOn ? formatJalaliDate(y.endsOn) : '—'}
                              </span>
                            )}
                          </span>
                          {y.isCurrent ? (
                            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              جاری
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={promotingYearId === y.id}
                              onClick={() => handlePromoteYear(y.id)}
                            >
                              {promotingYearId === y.id ? <Loader2 size={12} className="animate-spin" /> : 'تعیین جاری'}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#526176] dark:text-[#B3C0D2] py-2">
                      سال تحصیلی ثبت نشده است؛ با دکمهٔ + اولین سال را بسازید.
                    </p>
                  )}
                </div>
              </Card>
            )}

            {canManageStructure && (
              <Card>
                <div className="p-4">
                  <RailCardHeader
                    icon={<BookOpen size={15} />}
                    title="درس‌های مدرسه"
                    badge={toPersianDigits(subjects.length)}
                    action={
                      <IconAction title="افزودن درس" onClick={openCreateSubject}>
                        <Plus size={14} />
                      </IconAction>
                    }
                  />

                  {subjects.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {subjects.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 text-[11px] bg-[#EAF1FB] dark:bg-[#1D2B44] text-[#2457C5] dark:text-[#8BAEFF] px-2 py-1 rounded-lg font-bold"
                        >
                          {s.title}
                          <button
                            type="button"
                            title="ویرایش درس"
                            aria-label={`ویرایش ${s.title}`}
                            onClick={() => openEditSubject(s)}
                            className="opacity-60 hover:opacity-100"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            type="button"
                            title="حذف درس"
                            aria-label={`حذف ${s.title}`}
                            onClick={() => setDeleteSubjectTarget(s)}
                            className="opacity-60 hover:opacity-100 hover:text-red-500"
                          >
                            <Trash2 size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#526176] dark:text-[#B3C0D2] py-2">
                      درسی ثبت نشده است؛ با دکمهٔ + درس‌های مدرسه را بسازید تا به کلاس تخصیص یابند.
                    </p>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* ── selected classroom detail ── */}
          <div className="min-w-0 space-y-4">
            {!selected ? (
              <Card>
                <EmptyState
                  icon={<School size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
                  title="کلاسی انتخاب نشده"
                  description="از فهرست سمت راست یک کلاس انتخاب کنید یا با دکمهٔ «کلاس جدید» شروع کنید."
                />
              </Card>
            ) : (
              <>
                {/* ── classroom head: identity + live counters ── */}
                <div className="relative overflow-hidden rounded-2xl border border-[#DCE3EE] dark:border-[#344257] bg-gradient-to-l from-[#F0F4FA] via-white to-white dark:from-[#101722] dark:via-[#182231] dark:to-[#182231] p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#2457C5] dark:bg-[#8BAEFF] text-white dark:text-[#101722] flex items-center justify-center shrink-0">
                      <GraduationCap size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-black text-[#202B3C] dark:text-[#F1F5FB] truncate">{selected.title}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-[#EAF1FB] dark:bg-[#1D2B44] px-1.5 py-0.5 text-[10px] font-bold text-[#2457C5] dark:text-[#8BAEFF]">
                          {selected.gradeLevel}
                        </span>
                        <span className="rounded-md bg-[#EAF1FB] dark:bg-[#1D2B44] px-1.5 py-0.5 text-[10px] font-bold text-[#2457C5] dark:text-[#8BAEFF]">
                          {selected.academicYear}
                        </span>
                      </div>
                    </div>
                    {canManageStructure && (
                      <button
                        type="button"
                        title="ویرایش نام کلاس"
                        aria-label="ویرایش نام کلاس"
                        onClick={() => setRenameModal({ ulid: selected.ulid, title: selected.title })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] text-[#526176] dark:text-[#B3C0D2] hover:text-[#2457C5] dark:hover:text-[#8BAEFF] transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 max-w-md">
                    <StatTile
                      icon={<Users size={12} />}
                      value={detailLoading ? '…' : toPersianDigits(enrollments.length)}
                      label="دانش‌آموز فعال"
                    />
                    <StatTile
                      icon={<BookOpen size={12} />}
                      value={detailLoading ? '…' : toPersianDigits(selectedAssignments.length)}
                      label="درس تخصیص‌یافته"
                    />
                    <StatTile
                      icon={<CalendarDays size={12} />}
                      value={detailLoading ? '…' : toPersianDigits(slots.length)}
                      label="زنگ در هفته"
                    />
                  </div>
                </div>

                {/* ── roster ── */}
                <Section icon={<Users size={14} />} title="دانش‌آموزان کلاس">
                  {detailLoading ? (
                    <div className="flex items-center gap-2 py-6 text-xs text-[#526176] dark:text-[#B3C0D2]">
                      <Loader2 size={14} className="animate-spin" /> در حال بارگذاری…
                    </div>
                  ) : (
                    <>
                      {enrollments.length === 0 ? (
                        <p className="text-xs text-[#526176] dark:text-[#B3C0D2] py-3">دانش‌آموز فعالی در این کلاس نیست.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[10px] text-[#8B96A9]">
                                <th className="text-right font-bold pb-2 px-2">دانش‌آموز</th>
                                <th className="text-right font-bold pb-2 px-2">کد</th>
                                <th className="text-right font-bold pb-2 px-2">شروع</th>
                                {canEnroll && <th className="pb-2 px-2"></th>}
                              </tr>
                            </thead>
                            <tbody>
                              {enrollments.map((row) => (
                                <tr
                                  key={row.enrollmentId}
                                  className="border-t border-[#EEF2F8] dark:border-[#2C3A4E] hover:bg-[#F7F9FC] dark:hover:bg-[#1B2739] transition-colors"
                                >
                                  <td className="py-2 px-2 font-bold text-[#202B3C] dark:text-[#F1F5FB]">{row.studentName}</td>
                                  <td className="py-2 px-2 tabular-nums text-[#526176] dark:text-[#B3C0D2]">{toPersianDigits(row.studentCode)}</td>
                                  <td className="py-2 px-2 tabular-nums text-[#526176] dark:text-[#B3C0D2]">{toPersianDigits(formatJalaliDate(row.startsOn) || row.startsOn.slice(0, 10))}</td>
                                  {canEnroll && (
                                    <td className="py-1.5 px-2 text-left">
                                      <Button
                                        variant={armedEndId === row.enrollmentId ? 'danger' : 'ghost'}
                                        size="sm"
                                        onClick={() =>
                                          armedEndId === row.enrollmentId
                                            ? endEnrollment(row)
                                            : setArmedEndId(row.enrollmentId)
                                        }
                                      >
                                        <Trash2 size={13} />
                                        {armedEndId === row.enrollmentId ? 'تأیید قطعی خاتمه' : 'خاتمه ثبت‌نام'}
                                      </Button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {canEnroll && (
                        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#131C29] p-3">
                          <div className="min-w-[220px] flex-1">
                            <select className={inputCls} value={enrollStudent} onChange={(e) => setEnrollStudent(e.target.value)}>
                              <option value="">
                                {enrollableStudents.length === 0 ? '— همهٔ دانش‌آموزان این کلاس ثبت‌نام دارند —' : '— انتخاب دانش‌آموز —'}
                              </option>
                              {enrollableStudents.map((s) => (
                                <option key={s.ulid} value={s.ulid}>{s.fullName}</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-[170px]">
                            <JalaliDatePicker
                              value={enrollDate}
                              onChange={setEnrollDate}
                              placeholder="تاریخ شروع"
                            />
                          </div>
                          <Button variant="primary" size="sm" disabled={!enrollStudent || enrolling} onClick={enroll}>
                            {enrolling ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} افزودن به کلاس
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </Section>

                {/* ── teacher assignments ── */}
                {canManageStructure && (
                  <Section icon={<GraduationCap size={14} />} title="درس‌ها و دبیران">
                    {selectedAssignments.length === 0 ? (
                      <p className="text-xs text-[#526176] dark:text-[#B3C0D2] py-3">هنوز درسی به این کلاس تخصیص نیافته است.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 pb-3">
                        {selectedAssignments.map((a) => (
                          <span
                            key={a.id}
                            className="rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] px-3 py-1.5 text-xs hover:border-[#BECDE2] dark:hover:border-[#4A5A73] transition-colors"
                          >
                            <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">{a.subject}</span>
                            <span className="text-[#526176] dark:text-[#B3C0D2]"> — {a.teacher ?? 'بدون دبیر'}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#131C29] p-3">
                      <div className="min-w-[160px]">
                        <select className={inputCls} value={assignSubjectId} onChange={(e) => setAssignSubjectId(Number(e.target.value))}>
                          <option value="">— درس —</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                      </div>
                      <div className="min-w-[180px]">
                        <select className={inputCls} value={assignTeacherUlid} onChange={(e) => setAssignTeacherUlid(e.target.value)}>
                          <option value="">— بدون دبیر —</option>
                          {teachers.map((t) => (
                            <option key={t.ulid} value={t.ulid}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <Button variant="primary" size="sm" disabled={assignSubjectId === '' || assigning} onClick={assign}>
                        {assigning ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} تخصیص به {selected.title}
                      </Button>
                    </div>
                  </Section>
                )}

                {/* ── weekly timetable: rows = weekdays, columns = periods ── */}
                <Section icon={<CalendarDays size={14} />} title="برنامهٔ هفتگی">
                  {(() => {
                    const periodCount = Math.min(Math.max(slots.reduce((m, s) => Math.max(m, s.period), 0), 4), 10);
                    const periods = Array.from({ length: periodCount }, (_, i) => i + 1);
                    const todayWi = todayWeekdayIndex();
                    const cellCls = 'border border-[#EEF2F8] dark:border-[#2C3A4E] p-1.5 align-top min-w-[108px]';
                    const headCls = 'bg-[#EEF3FB] dark:bg-[#182231] text-[#29405F] dark:text-[#B3C0D2] font-bold';
                    return (
                      <>
                        <div className="overflow-x-auto rounded-xl border border-[#DCE3EE] dark:border-[#344257]">
                          <table className="w-full text-xs border-collapse min-w-[620px]">
                            <thead>
                              <tr>
                                <th className={cn(cellCls, headCls, 'w-[76px]')}>روز / زنگ</th>
                                {periods.map((p) => (
                                  <th key={p} className={cn(cellCls, headCls)}>
                                    زنگ {toPersianDigits(p)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {WEEKDAYS.map((day, wi) => (
                                <tr key={day}>
                                  <th
                                    className={cn(
                                      cellCls,
                                      'font-bold text-center',
                                      wi === todayWi
                                        ? 'bg-[#E3ECFA] dark:bg-[#1D2B44] text-[#2457C5] dark:text-[#8BAEFF]'
                                        : headCls,
                                    )}
                                  >
                                    <span className="block">{day}</span>
                                    {wi === todayWi && <span className="block text-[9px] font-black mt-0.5">امروز</span>}
                                  </th>
                                  {periods.map((p) => {
                                    const cellSlots = slots.filter((s) => s.weekday === wi && s.period === p);
                                    return (
                                      <td key={p} className={cellCls}>
                                        {cellSlots.map((s) => (
                                          <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => openSlotModal(wi, p, s)}
                                            className={cn(
                                              'w-full text-right rounded-lg border px-2 py-1.5 mb-1 last:mb-0 transition-colors',
                                              canTimetable
                                                ? 'border-[#2457C5]/25 bg-[#F0F4FA] dark:border-[#2E4C8A]/40 dark:bg-[#1B2739] hover:border-[#2457C5] hover:shadow-sm cursor-pointer'
                                                : 'border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] cursor-default',
                                            )}
                                          >
                                            <span className="block text-[11px] font-bold text-[#202B3C] dark:text-[#F1F5FB] truncate">
                                              {s.subject ?? '—'}
                                            </span>
                                            <span className="block text-[9px] text-[#526176] dark:text-[#B3C0D2] tabular-nums">
                                              {toPersianDigits(s.startsAt)}–{toPersianDigits(s.endsAt)}
                                            </span>
                                          </button>
                                        ))}
                                        {cellSlots.length === 0 && canTimetable && (
                                          <button
                                            type="button"
                                            onClick={() => openSlotModal(wi, p)}
                                            className="w-full h-9 rounded-lg border border-dashed border-[#C9D4E5] dark:border-[#3A4A63] text-[#8CA0BC] dark:text-[#5E7391] hover:border-[#2457C5] hover:bg-[#F0F4FA] hover:text-[#2457C5] dark:hover:bg-[#1B2739] dark:hover:text-[#8BAEFF] flex items-center justify-center transition-colors"
                                            aria-label={`افزودن زنگ ${toPersianDigits(p)} — ${day}`}
                                          >
                                            <Plus size={13} />
                                          </button>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[10px] text-[#526176] dark:text-[#B3C0D2] pt-2">
                          {canTimetable
                            ? 'برای افزودن، خانهٔ خالی و برای ویرایش یا حذف، روی زنگ کلیک کنید.'
                            : 'نمای فقط‌خواندنی — ویرایش برنامه با مجوز مدیریت برنامه هفتگی.'}
                        </p>
                      </>
                    );
                  })()}
                </Section>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── create classroom ── */}
      <Modal isOpen={isCreateClassOpen} onClose={() => setIsCreateClassOpen(false)} title="ساخت کلاس جدید" maxWidth="sm">
        <form onSubmit={createClassroom} className="space-y-3 text-right">
          <FormField label="عنوان کلاس" required>
            <input
              type="text"
              className={inputCls}
              placeholder="مثال: دهم ریاضی ۱"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="سال تحصیلی" required>
              <select className={inputCls} value={newYearId} onChange={(e) => setNewYearId(Number(e.target.value))}>
                {years.length === 0 && <option value="">— سال تحصیلی —</option>}
                {years.map((y) => (
                  <option key={y.id} value={y.id}>{y.title}</option>
                ))}
              </select>
            </FormField>
            <FormField label="پایهٔ تحصیلی" required>
              <select className={inputCls} value={newGradeId} onChange={(e) => setNewGradeId(Number(e.target.value))}>
                {gradeLevels.length === 0 && <option value="">— پایه —</option>}
                {gradeLevels.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </FormField>
          </div>
          <p className="text-[10px] text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
            پایه و سال تحصیلی پس از ساخت قابل تغییر نیستند — ثبت‌نام‌ها و برنامهٔ هفتگی به همین کلاس گره می‌خورند.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateClassOpen(false)}>انصراف</Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!newTitle.trim() || newYearId === '' || newGradeId === '' || creating}
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} ساخت کلاس
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── create academic year ── */}
      <Modal isOpen={isCreateYearOpen} onClose={() => setIsCreateYearOpen(false)} title="افزودن سال تحصیلی" maxWidth="sm">
        <form onSubmit={handleCreateYear} className="space-y-3 text-right">
          <FormField label="عنوان سال" required>
            <input
              type="text"
              className={inputCls}
              placeholder="مثال: ۱۴۰۶-۱۴۰۷"
              value={newYearTitle}
              onChange={(e) => setNewYearTitle(e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="شروع (اختیاری)">
              <JalaliDatePicker value={newYearStarts} onChange={setNewYearStarts} placeholder="شروع" />
            </FormField>
            <FormField label="پایان (اختیاری)">
              <JalaliDatePicker value={newYearEnds} onChange={setNewYearEnds} placeholder="پایان" />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-xs text-[#526176] dark:text-[#B3C0D2] cursor-pointer">
            <input type="checkbox" checked={newYearCurrent} onChange={(e) => setNewYearCurrent(e.target.checked)} className="rounded" />
            تعیین به‌عنوان سال جاری
          </label>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateYearOpen(false)}>انصراف</Button>
            <Button variant="primary" size="sm" type="submit" disabled={!newYearTitle.trim() || creatingYear}>
              {creatingYear ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} افزودن سال
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── create subject ── */}
      <Modal isOpen={isCreateSubjectOpen} onClose={() => setIsCreateSubjectOpen(false)} title="افزودن درس به مدرسه" maxWidth="sm">
        <form onSubmit={handleCreateSubject} className="space-y-3 text-right">
          <FormField label="عنوان درس" required>
            <input
              type="text"
              className={inputCls}
              placeholder="مثال: شیمی"
              value={newSubjectTitle}
              onChange={(e) => setNewSubjectTitle(e.target.value)}
            />
          </FormField>
          <FormField label="کد درس (اختیاری)">
            <input
              type="text"
              className={inputCls}
              placeholder="مثال: CHEM"
              value={newSubjectCode}
              onChange={(e) => setNewSubjectCode(e.target.value)}
            />
          </FormField>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateSubjectOpen(false)}>انصراف</Button>
            <Button variant="primary" size="sm" type="submit" disabled={!newSubjectTitle.trim() || creatingSubject}>
              {creatingSubject ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} افزودن درس
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── add / edit one timetable cell ── */}
      <Modal
        isOpen={slotModal !== null}
        onClose={() => setSlotModal(null)}
        title={
          slotModal?.mode === 'edit'
            ? `ویرایش زنگ — ${slotModal.subject ?? '—'}`
            : `افزودن زنگ — ${WEEKDAYS[slotModal?.weekday ?? 0]} · زنگ ${toPersianDigits(slotModal?.period ?? 1)}`
        }
        maxWidth="sm"
      >
        {slotModal && (
          <div className="space-y-3">
            {slotModal.mode === 'create' && (
              <FormField label="درس-کلاس" required>
                <select
                  className={inputCls}
                  value={slotModal.csId}
                  onChange={(e) => setSlotModal({ ...slotModal, csId: Number(e.target.value) })}
                >
                  <option value="">— انتخاب درس —</option>
                  {selectedAssignments.map((a) => (
                    <option key={a.id} value={a.id}>{a.subject}</option>
                  ))}
                </select>
              </FormField>
            )}
            <div className="grid grid-cols-2 gap-2">
              <FormField label="روز">
                <select
                  className={inputCls}
                  value={slotModal.weekday}
                  onChange={(e) => setSlotModal({ ...slotModal, weekday: Number(e.target.value) })}
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="شمارهٔ زنگ">
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={slotModal.period}
                  onChange={(e) => setSlotModal({ ...slotModal, period: Number(e.target.value) })}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="از ساعت">
                <input
                  type="time"
                  className={inputCls}
                  value={slotModal.starts}
                  onChange={(e) => setSlotModal({ ...slotModal, starts: e.target.value })}
                />
              </FormField>
              <FormField label="تا ساعت">
                <input
                  type="time"
                  className={inputCls}
                  value={slotModal.ends}
                  onChange={(e) => setSlotModal({ ...slotModal, ends: e.target.value })}
                />
              </FormField>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              {slotModal.mode === 'edit' && slotModal.slotId !== undefined ? (
                <Button variant="danger" size="sm" disabled={slotSaving} onClick={() => removeSlot(slotModal.slotId!)}>
                  <Trash2 size={13} /> حذف زنگ
                </Button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSlotModal(null)}>انصراف</Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={slotSaving || (slotModal.mode === 'create' && slotModal.csId === '')}
                  onClick={saveSlot}
                >
                  {slotSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} ذخیره
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── classroom rename ── */}
      <Modal
        isOpen={renameModal !== null}
        onClose={() => setRenameModal(null)}
        title="ویرایش کلاس"
        maxWidth="sm"
      >
        {renameModal && (
          <div className="space-y-3">
            <FormField label="عنوان کلاس" required>
              <input
                className={inputCls}
                value={renameModal.title}
                onChange={(e) => setRenameModal({ ...renameModal, title: e.target.value })}
              />
            </FormField>
            <p className="text-[10px] text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
              پایه و سال تحصیلی پس از ساخت قابل تغییر نیستند — ثبت‌نام‌ها و برنامهٔ هفتگی به همین کلاس گره خورده‌اند.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setRenameModal(null)}>انصراف</Button>
              <Button variant="primary" size="sm" disabled={!renameModal.title.trim() || renaming} onClick={saveRename}>
                {renaming ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={13} />} ذخیره
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── edit subject ── */}
      <Modal
        isOpen={editSubject !== null}
        onClose={() => setEditSubject(null)}
        title={`ویرایش درس «${editSubject?.title ?? ''}»`}
        maxWidth="sm"
      >
        <form onSubmit={handleUpdateSubject} className="space-y-3">
          <FormField label="عنوان درس" required>
            <input
              className={inputCls}
              value={editSubjectTitle}
              onChange={(e) => setEditSubjectTitle(e.target.value)}
            />
          </FormField>
          <FormField label="کد درس (اختیاری)">
            <input
              className={inputCls}
              value={editSubjectCode}
              onChange={(e) => setEditSubjectCode(e.target.value)}
            />
          </FormField>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditSubject(null)}>انصراف</Button>
            <Button variant="primary" size="sm" type="submit" disabled={!editSubjectTitle.trim() || savingSubject}>
              {savingSubject ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={13} />} ذخیره
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── delete subject confirm ── */}
      <Modal
        isOpen={deleteSubjectTarget !== null}
        onClose={() => { setDeleteSubjectTarget(null); setForceDeleteArmed(false); }}
        title={`حذف درس «${deleteSubjectTarget?.title ?? ''}»`}
        maxWidth="sm"
      >
        <div className="space-y-3">
          {forceDeleteArmed ? (
            <div className="flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl">
              <Info size={13} className="shrink-0 mt-0.5" />
              <span>این درس به کلاس‌ها تخصیص یافته است. «حذف قطعی» تخصیص‌ها و همهٔ زنگ‌های برنامهٔ هفتگی، تکالیف، آزمون‌ها و نمرات این درس را هم پاک می‌کند — برگشت‌پذیر نیست.</span>
            </div>
          ) : (
            <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
              درس برای همیشه حذف می‌شود؛ اگر به کلاس‌ها تخصیص یافته باشد، گام بعدی «حذف قطعی» پیشنهاد می‌شود.
            </p>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => { setDeleteSubjectTarget(null); setForceDeleteArmed(false); }}>انصراف</Button>
            {forceDeleteArmed ? (
              <Button variant="danger" size="sm" disabled={deletingSubject} onClick={() => handleDeleteSubject(true)}>
                {deletingSubject ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={13} />} حذف قطعی
              </Button>
            ) : (
              <Button variant="primary" size="sm" disabled={deletingSubject} onClick={() => handleDeleteSubject(false)}>
                {deletingSubject ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={13} />} حذف درس
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
