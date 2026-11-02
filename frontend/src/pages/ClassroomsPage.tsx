import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, School, Trash2, Users, CalendarDays, GraduationCap, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, PageHeader, EmptyState, AccessDeniedGate, Modal } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { formatJalaliDate } from '../utils/jalali';
import {
  ApiAcademicService,
  ApiClassroomAdminService,
  ClassroomAdminRow,
  EnrollmentRow,
  IdTitleOption,
  TeacherOption,
  TimetableSlotRow,
} from '../api/data';
import { ApiError } from '../api/client';

/** Backend weekday convention: ۰ = شنبه … ۶ = جمعه. */
const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}> = ({ icon, title, children, action }) => (
  <div className="rounded-3xl border border-[#DCE3EE] dark:border-[#344257] bg-[#FAFBFD] dark:bg-[#131C2E] p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3 flex-wrap pb-3">
      <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
        <span className="w-8 h-8 rounded-xl bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] flex items-center justify-center">
          {icon}
        </span>
        {title}
      </h3>
      {action}
    </div>
    {children}
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
  const [subjects, setSubjects] = useState<IdTitleOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [years, setYears] = useState<IdTitleOption[]>([]);
  const [gradeLevels, setGradeLevels] = useState<IdTitleOption[]>([]);
  const [assignments, setAssignments] = useState<{ id: number; subject: string; classroom: string; teacher: string | null }[]>([]);
  const [students, setStudents] = useState<{ ulid: string; fullName: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // create-classroom form
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

  // Ending an enrollment is a destructive, history-bearing action: the first
  // click only arms the row, the second one commits.
  const [armedEndId, setArmedEndId] = useState<number | null>(null);

  const selected = classrooms.find((c) => c.ulid === selectedUlid) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rooms, subs, teachersList, yearsList, gradeList, teachingSubjects, studentList] = await Promise.all([
        ApiClassroomAdminService.list(),
        ApiClassroomAdminService.subjects().catch(() => [] as IdTitleOption[]),
        ApiClassroomAdminService.teachers().catch(() => [] as TeacherOption[]),
        ApiClassroomAdminService.years().catch(() => [] as IdTitleOption[]),
        ApiClassroomAdminService.gradeLevels().catch(() => [] as IdTitleOption[]),
        ApiAcademicService.mySubjects().catch(() => []),
        ApiAcademicService.studentsInScope().catch(() => []),
      ]);
      setClassrooms(rooms);
      setSubjects(subs);
      setTeachers(teachersList);
      setYears(yearsList);
      setGradeLevels(gradeList);
      setAssignments(
        teachingSubjects.map((s) => ({ id: s.id, subject: s.subject ?? '', classroom: s.classroom ?? '', teacher: s.teacher })),
      );
      setStudents(studentList);
      setNewYearId((prev) => prev || yearsList[0]?.id || '');
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

  const createClassroom = async () => {
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
      setNotice('کلاس ساخته شد.');
      await load();
    } catch (e) {
      setError(firstError(e, 'خطا در ساخت کلاس'));
    } finally {
      setCreating(false);
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
      />

      {error && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-4 py-2.5 text-xs font-semibold">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-4 py-2.5 text-xs font-semibold">
          {notice}
        </div>
      )}

      {loading ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-10 text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال بارگذاری…
          </div>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[320px_1fr] gap-5 items-start">
          {/* ── classroom list + create ── */}
          <div className="space-y-4">
            <Card>
              <div className="p-4">
                <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2 pb-3">
                  <School size={15} className="text-[#2457C5] dark:text-[#8BAEFF]" /> کلاس‌های مدرسه
                </h3>
                {classrooms.length === 0 ? (
                  <p className="text-xs text-[#526176] dark:text-[#B3C0D2] py-3">هنوز کلاسی ثبت نشده است.</p>
                ) : (
                  <div className="space-y-1.5">
                    {classrooms.map((c) => (
                      <div
                        key={c.ulid}
                        className={cn(
                          'flex items-center gap-1 rounded-xl border pl-1.5 pr-1 py-1 transition-colors',
                          c.ulid === selectedUlid
                            ? 'border-[#2457C5] bg-[#F0F4FA] dark:bg-[#182231]'
                            : 'border-[#DCE3EE] dark:border-[#344257]',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedUlid(c.ulid)}
                          className="flex-1 text-right rounded-lg px-2 py-1.5 hover:bg-[#F0F4FA]/70 dark:hover:bg-[#182231]/70 transition-colors"
                        >
                          <span className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{c.title}</span>
                          <span className="block text-[10px] text-[#526176] dark:text-[#B3C0D2] mt-0.5">
                            {c.gradeLevel} · {c.academicYear}
                          </span>
                        </button>
                        {canManageStructure && (
                          <button
                            type="button"
                            onClick={() => setRenameModal({ ulid: c.ulid, title: c.title })}
                            aria-label={`ویرایش ${c.title}`}
                            className="self-center rounded-lg p-1.5 text-[#8CA0BC] dark:text-[#5E7391] hover:text-[#2457C5] dark:hover:text-[#8BAEFF] transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {canManageStructure && (
              <Card>
                <div className="p-4 space-y-3">
                  <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                    <Plus size={15} className="text-[#2457C5] dark:text-[#8BAEFF]" /> ساخت کلاس جدید
                  </h3>
                  <input
                    className={inputCls}
                    placeholder="عنوان کلاس — مثال: دهم ریاضی ۱"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select className={inputCls} value={newYearId} onChange={(e) => setNewYearId(Number(e.target.value))}>
                      {years.length === 0 && <option value="">— سال تحصیلی —</option>}
                      {years.map((y) => (
                        <option key={y.id} value={y.id}>{y.title}</option>
                      ))}
                    </select>
                    <select className={inputCls} value={newGradeId} onChange={(e) => setNewGradeId(Number(e.target.value))}>
                      {gradeLevels.length === 0 && <option value="">— پایه —</option>}
                      {gradeLevels.map((g) => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!newTitle.trim() || newYearId === '' || newGradeId === '' || creating}
                    onClick={createClassroom}
                  >
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} ساخت کلاس
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* ── selected classroom detail ── */}
          <div className="space-y-4">
            {!selected ? (
              <Card>
                <EmptyState title="کلاسی انتخاب نشده" description="از فهرست سمت راست یک کلاس انتخاب کنید یا کلاس جدیدی بسازید." />
              </Card>
            ) : (
              <>
                <div className="rounded-3xl border border-[#DCE3EE] dark:border-[#344257] bg-gradient-to-l from-[#F0F4FA] via-white to-white dark:from-[#101722] dark:via-[#182231] dark:to-[#182231] p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#2457C5] dark:bg-[#8BAEFF] text-white dark:text-[#101722] flex items-center justify-center shrink-0">
                      <GraduationCap size={22} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-[#202B3C] dark:text-[#F1F5FB]">{selected.title}</h2>
                      <p className="text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-0.5">
                        {selected.gradeLevel} · {selected.academicYear} · {toPersianDigits(enrollments.length)} دانش‌آموز فعال
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── roster ── */}
                <Section icon={<Users size={15} className="text-[#2457C5] dark:text-[#8BAEFF]" />} title="دانش‌آموزان کلاس">
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
                              <tr className="text-[#526176] dark:text-[#B3C0D2]">
                                <th className="text-right font-semibold pb-2 px-2">دانش‌آموز</th>
                                <th className="text-right font-semibold pb-2 px-2">کد</th>
                                <th className="text-right font-semibold pb-2 px-2">شروع</th>
                                {canEnroll && <th className="pb-2 px-2"></th>}
                              </tr>
                            </thead>
                            <tbody>
                              {enrollments.map((row) => (
                                <tr key={row.enrollmentId} className="border-t border-[#DCE3EE]/70 dark:border-[#344257]/70">
                                  <td className="py-2 px-2 font-bold text-[#202B3C] dark:text-[#F1F5FB]">{row.studentName}</td>
                                  <td className="py-2 px-2 tabular-nums text-[#526176] dark:text-[#B3C0D2]">{toPersianDigits(row.studentCode)}</td>
                                  <td className="py-2 px-2 tabular-nums text-[#526176] dark:text-[#B3C0D2]">{toPersianDigits(formatJalaliDate(row.startsOn) || row.startsOn.slice(0, 10))}</td>
                                  {canEnroll && (
                                    <td className="py-2 px-2 text-left">
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
                        <div className="flex flex-wrap items-end gap-2 pt-3 border-t border-[#DCE3EE]/70 dark:border-[#344257]/70 mt-3">
                          <div className="min-w-[220px] flex-1">
                            <select className={inputCls} value={enrollStudent} onChange={(e) => setEnrollStudent(e.target.value)}>
                              <option value="">— انتخاب دانش‌آموز —</option>
                              {students.map((s) => (
                                <option key={s.ulid} value={s.ulid}>{s.fullName}</option>
                              ))}
                            </select>
                          </div>
                          <input
                            type="date"
                            className={cn(inputCls, 'w-[150px]')}
                            value={enrollDate}
                            onChange={(e) => setEnrollDate(e.target.value)}
                          />
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
                  <Section icon={<GraduationCap size={15} className="text-[#2457C5] dark:text-[#8BAEFF]" />} title="درس‌ها و دبیران">
                    {selectedAssignments.length === 0 ? (
                      <p className="text-xs text-[#526176] dark:text-[#B3C0D2] py-3">هنوز درسی به این کلاس تخصیص نیافته است.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 pb-3">
                        {selectedAssignments.map((a) => (
                          <span
                            key={a.id}
                            className="rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] px-3 py-1.5 text-xs"
                          >
                            <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">{a.subject}</span>
                            <span className="text-[#526176] dark:text-[#B3C0D2]"> — {a.teacher ?? 'بدون دبیر'}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-end gap-2 pt-3 border-t border-[#DCE3EE]/70 dark:border-[#344257]/70">
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
                <Section icon={<CalendarDays size={15} className="text-[#2457C5] dark:text-[#8BAEFF]" />} title="برنامهٔ هفتگی">
                  {(() => {
                    const periodCount = Math.min(Math.max(slots.reduce((m, s) => Math.max(m, s.period), 0), 4), 10);
                    const periods = Array.from({ length: periodCount }, (_, i) => i + 1);
                    const cellCls = 'border border-[#DCE3EE] dark:border-[#344257] p-1.5 align-top min-w-[108px]';
                    return (
                      <>
                        <div className="overflow-x-auto pb-1">
                          <table className="w-full text-xs border-collapse min-w-[620px]">
                            <thead>
                              <tr>
                                <th className={cn(cellCls, 'bg-[#EEF3FB] dark:bg-[#182231] text-[#29405F] dark:text-[#B3C0D2] font-bold w-[76px]')}>
                                  روز / زنگ
                                </th>
                                {periods.map((p) => (
                                  <th key={p} className={cn(cellCls, 'bg-[#EEF3FB] dark:bg-[#182231] text-[#29405F] dark:text-[#B3C0D2] font-bold')}>
                                    زنگ {toPersianDigits(p)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {WEEKDAYS.map((day, wi) => (
                                <tr key={day}>
                                  <th className={cn(cellCls, 'bg-[#EEF3FB] dark:bg-[#182231] text-[#29405F] dark:text-[#B3C0D2] font-bold text-center')}>
                                    {day}
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
                                                ? 'border-[#2457C5]/30 bg-[#F0F4FA] dark:border-[#2E4C8A]/40 dark:bg-[#1B2739] hover:border-[#2457C5] cursor-pointer'
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
                                            className="w-full h-9 rounded-lg border border-dashed border-[#C9D4E5] dark:border-[#3A4A63] text-[#8CA0BC] dark:text-[#5E7391] hover:border-[#2457C5] hover:text-[#2457C5] dark:hover:text-[#8BAEFF] flex items-center justify-center transition-colors"
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
              <div>
                <label className="block text-xs font-semibold text-[#202B3C] dark:text-[#F1F5FB] pb-1">درس-کلاس</label>
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
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#202B3C] dark:text-[#F1F5FB] pb-1">روز</label>
                <select
                  className={inputCls}
                  value={slotModal.weekday}
                  onChange={(e) => setSlotModal({ ...slotModal, weekday: Number(e.target.value) })}
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#202B3C] dark:text-[#F1F5FB] pb-1">شمارهٔ زنگ</label>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={slotModal.period}
                  onChange={(e) => setSlotModal({ ...slotModal, period: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#202B3C] dark:text-[#F1F5FB] pb-1">از ساعت</label>
                <input
                  type="time"
                  className={inputCls}
                  value={slotModal.starts}
                  onChange={(e) => setSlotModal({ ...slotModal, starts: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#202B3C] dark:text-[#F1F5FB] pb-1">تا ساعت</label>
                <input
                  type="time"
                  className={inputCls}
                  value={slotModal.ends}
                  onChange={(e) => setSlotModal({ ...slotModal, ends: e.target.value })}
                />
              </div>
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
            <div>
              <label className="block text-xs font-semibold text-[#202B3C] dark:text-[#F1F5FB] pb-1">عنوان کلاس</label>
              <input
                className={inputCls}
                value={renameModal.title}
                onChange={(e) => setRenameModal({ ...renameModal, title: e.target.value })}
              />
            </div>
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
    </div>
  );
};
