import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, GraduationCap, School, Plus, UserPlus, Phone, ShieldCheck,
  Loader2, AlertCircle, RefreshCw, KeyRound, Info, Upload, Eye, Pencil, FileSpreadsheet, UserX,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, SearchInput, Tabs, PageHeader, AccessDeniedGate, EmptyState } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { formatJalaliDate } from '../utils/jalali';
import { JalaliDatePicker } from '../components/common/JalaliDatePicker';
import {
  ApiUserService, ApiClassroomAdminService, ApiImportService,
  UserRow, UserRoleAssignment, StudentRow, ClassroomAdminRow, IdTitleOption, ImportBatchResult, BACKEND_ROLE_LABELS,
} from '../api/data';
import { ApiError } from '../api/client';

type TabId = 'users' | 'students' | 'classrooms';

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export const UserManagementPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();
  const isAuthorized =
    hasAccess('users:manage') ||
    activeRole.group === 'school_admin' ||
    activeRole.id === 'school_registrar';

  const [activeTab, setActiveTab] = useState<TabId>('users');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Users ──────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [usersReload, setUsersReload] = useState(0);

  // ── Students ───────────────────────────────────────────────────
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [studentsReload, setStudentsReload] = useState(0);

  // ── Classrooms ─────────────────────────────────────────────────
  const [classrooms, setClassrooms] = useState<ClassroomAdminRow[] | null>(null);
  const [classroomsReload, setClassroomsReload] = useState(0);
  const [years, setYears] = useState<IdTitleOption[] | null>(null);
  const [gradeLevels, setGradeLevels] = useState<IdTitleOption[] | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  // ── Modals ─────────────────────────────────────────────────────
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [userFirst, setUserFirst] = useState('');
  const [userLast, setUserLast] = useState('');
  const [userPhone, setUserPhone] = useState('');

  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [roleKey, setRoleKey] = useState('teacher');

  const [phoneTarget, setPhoneTarget] = useState<UserRow | null>(null);
  const [newPhone, setNewPhone] = useState('');
  const [phoneReason, setPhoneReason] = useState('');

  const [isCreateStudentOpen, setIsCreateStudentOpen] = useState(false);
  const [stuFirst, setStuFirst] = useState('');
  const [stuLast, setStuLast] = useState('');
  const [stuCode, setStuCode] = useState('');
  const [stuBirth, setStuBirth] = useState('');
  const [stuNational, setStuNational] = useState('');

  const [enrollTarget, setEnrollTarget] = useState<StudentRow | null>(null);
  const [enrollClassroom, setEnrollClassroom] = useState('');
  const [enrollStartsOn, setEnrollStartsOn] = useState(todayIso());

  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [classTitle, setClassTitle] = useState('');
  const [classYear, setClassYear] = useState('');
  const [classGrade, setClassGrade] = useState('');

  // Edit user name
  const [nameTarget, setNameTarget] = useState<UserRow | null>(null);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');

  // sh7: national code reveal (encrypted at rest, reason-logged)
  const [ncTarget, setNcTarget] = useState<StudentRow | null>(null);
  const [ncReason, setNcReason] = useState('');
  const [ncValue, setNcValue] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);

  // FR-34: bulk CSV import
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportBatchResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;

    setUsers(null);
    ApiUserService.listUsers()
      .then((rows) => { if (!cancelled) setUsers(rows); })
      .catch((e) => { if (!cancelled) setError(firstError(e, 'خطا در دریافت کاربران')); });

    return () => { cancelled = true; };
  }, [isAuthorized, usersReload]);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;

    ApiUserService.listStudents()
      .then((rows) => { if (!cancelled) setStudents(rows); })
      .catch((e) => { if (!cancelled) setError(firstError(e, 'خطا در دریافت دانش‌آموزان')); });

    return () => { cancelled = true; };
  }, [isAuthorized, studentsReload]);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;

    setClassrooms(null);
    ApiClassroomAdminService.list()
      .then((rows) => { if (!cancelled) setClassrooms(rows); })
      .catch((e) => { if (!cancelled) setError(firstError(e, 'خطا در دریافت کلاس‌ها')); });

    return () => { cancelled = true; };
  }, [isAuthorized, classroomsReload]);

  const openCreateClass = () => {
    setClassTitle('');
    setClassYear('');
    setClassGrade('');
    setIsCreateClassOpen(true);

    if (years === null) ApiClassroomAdminService.years().then(setYears).catch(() => setYears([]));
    if (gradeLevels === null) ApiClassroomAdminService.gradeLevels().then(setGradeLevels).catch(() => setGradeLevels([]));
  };

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی به مدیریت کاربران و ساختار مدرسه"
        requiredRoleOrPermission="users:manage (مدیر مدرسه یا مسئول دفتر)"
        reason="ساخت کاربر، تخصیص نقش و ثبت‌نام دانش‌آموزان تنها برای کادر مجاز مدرسه ممکن است؛ هر تغییر در لاگ ممیزی ثبت می‌شود."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const filteredUsers = (users ?? []).filter((u) => {
    if (!searchQuery) return true;
    return u.fullName.includes(searchQuery) || (u.phone ?? '').includes(searchQuery);
  });

  const filteredStudents = (students ?? []).filter((s) => {
    if (!searchQuery) return true;
    return s.fullName.includes(searchQuery) || s.code.includes(searchQuery);
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFirst.trim() || !userLast.trim() || userPhone.trim().length < 10) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const fresh = await ApiUserService.createUser({
        firstName: userFirst.trim(),
        lastName: userLast.trim(),
        phone: userPhone.trim(),
      });
      setIsCreateUserOpen(false);
      setUserFirst('');
      setUserLast('');
      setUserPhone('');
      setUsersReload((k) => k + 1);
      setNotice(fresh
        ? 'کاربر ساخته شد؛ برای دسترسی به سامانه باید نقش بگیرد.'
        : 'این شماره از قبل حساب داشت؛ حساب به این مدرسه متصل شد و اکنون باید نقش بگیرد.');
    } catch (err) {
      setError(firstError(err, 'خطا در ساخت کاربر'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTarget) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ApiUserService.assignRole(roleTarget.ulid, { roleKey, scopeType: 'school' });
      setRoleTarget(null);
      setNotice(`نقش «${BACKEND_ROLE_LABELS[roleKey] ?? roleKey}» تخصیص یافت.`);
      setUsersReload((k) => k + 1);
    } catch (err) {
      setError(firstError(err, 'خطا در تخصیص نقش'));
    } finally {
      setIsSaving(false);
    }
  };

  // ── End role (sh7: reason-logged, audited) ─────────────────────
  const [endRoleTarget, setEndRoleTarget] = useState<{ user: UserRow; role: UserRoleAssignment } | null>(null);
  const [endRoleReason, setEndRoleReason] = useState('');
  const [endRoleEndsOn, setEndRoleEndsOn] = useState('');

  // ── Admin sets/replaces a user's login password (sh7: reason-logged) ──
  const [pwTarget, setPwTarget] = useState<UserRow | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwReason, setPwReason] = useState('');

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwTarget || pwValue.length < 8 || pwReason.trim().length < 5) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ApiUserService.setPassword(pwTarget.ulid, { password: pwValue, reason: pwReason.trim() });
      setPwTarget(null);
      setPwValue('');
      setPwReason('');
      setNotice(`رمز عبور ${pwTarget.fullName} تنظیم شد و در لاگ حساس ثبت شد.`);
    } catch (err) {
      setError(firstError(err, 'خطا در تنظیم رمز عبور'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endRoleTarget || endRoleReason.trim().length < 5) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ApiUserService.endRole(endRoleTarget.user.ulid, endRoleTarget.role.userRoleId, {
        reason: endRoleReason.trim(),
        endsOn: endRoleEndsOn || null,
      });
      setEndRoleTarget(null);
      setEndRoleReason('');
      setEndRoleEndsOn('');
      setUsersReload((k) => k + 1);
      setNotice(`نقش «${endRoleTarget.role.roleTitle ?? endRoleTarget.role.roleKey}» پایان یافت و در لاگ حساس ثبت شد.`);
    } catch (err) {
      setError(firstError(err, 'خطا در پایان نقش'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneTarget || newPhone.trim().length < 10 || phoneReason.trim().length < 5) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ApiUserService.changePhone(phoneTarget.ulid, newPhone.trim(), phoneReason.trim());
      setPhoneTarget(null);
      setNewPhone('');
      setPhoneReason('');
      setUsersReload((k) => k + 1);
      setNotice('شمارهٔ ورود تغییر کرد و در لاگ حساس ثبت شد.');
    } catch (err) {
      setError(firstError(err, 'خطا در تغییر شمارهٔ ورود'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stuFirst.trim() || !stuLast.trim() || !stuCode.trim()) return;

    if (stuNational.trim() && !/^\d{10}$/.test(stuNational.trim())) {
      setError('کد ملی باید دقیقاً ۱۰ رقم باشد.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ApiUserService.createStudent({
        firstName: stuFirst.trim(),
        lastName: stuLast.trim(),
        studentCode: stuCode.trim(),
        birthDate: stuBirth || null,
        nationalCode: stuNational.trim() || null,
      });
      setIsCreateStudentOpen(false);
      setStuFirst('');
      setStuLast('');
      setStuCode('');
      setStuBirth('');
      setStuNational('');
      setStudentsReload((k) => k + 1);
      setNotice('دانش‌آموز ثبت شد؛ برای شروع کلاس، او را در یک کلاس ثبت‌نام کنید.');
    } catch (err) {
      setError(firstError(err, 'خطا در ثبت دانش‌آموز'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollTarget || !enrollClassroom) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ApiClassroomAdminService.enroll(enrollClassroom, enrollTarget.ulid, enrollStartsOn);
      setEnrollTarget(null);
      setEnrollClassroom('');
      setNotice(`${enrollTarget.fullName} در کلاس انتخابی ثبت‌نام شد.`);
    } catch (err) {
      setError(firstError(err, 'خطا در ثبت‌نام دانش‌آموز'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classTitle.trim() || !classYear || !classGrade) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ApiClassroomAdminService.create({
        title: classTitle.trim(),
        academic_year_id: Number(classYear),
        grade_level_id: Number(classGrade),
      });
      setIsCreateClassOpen(false);
      setClassroomsReload((k) => k + 1);
      setNotice('کلاس ساخته شد.');
    } catch (err) {
      setError(firstError(err, 'خطا در ساخت کلاس'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameTarget || !editFirst.trim() || !editLast.trim()) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ApiUserService.updateName(nameTarget.ulid, editFirst.trim(), editLast.trim());
      setNameTarget(null);
      setUsersReload((k) => k + 1);
      setNotice('نام کاربر ویرایش شد.');
    } catch (err) {
      setError(firstError(err, 'خطا در ویرایش نام کاربر'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevealNationalCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ncTarget || ncReason.trim().length < 5) return;

    setIsRevealing(true);
    setError(null);
    try {
      setNcValue(await ApiUserService.revealNationalCode(ncTarget.ulid, ncReason.trim()));
    } catch (err) {
      setError(firstError(err, 'خطا در دریافت کد ملی'));
    } finally {
      setIsRevealing(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setIsImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const result = await ApiImportService.importStudents(importFile);
      setImportResult(result);
      setStudentsReload((k) => k + 1);
    } catch (err) {
      setError(firstError(err, 'خطا در ورود گروهی دانش‌آموزان'));
    } finally {
      setIsImporting(false);
    }
  };

  const tabs = [
    { id: 'users', label: 'کارکنان و کاربران سامانه', badge: users?.length ?? 0 },
    { id: 'students', label: 'دانش‌آموزان', badge: students?.length ?? 0 },
    { id: 'classrooms', label: 'کلاس‌ها و ثبت‌نام', badge: classrooms?.length ?? 0 },
  ];

  const roleOptions = useMemo(() => Object.entries(BACKEND_ROLE_LABELS), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت کاربران، دانش‌آموزان و ساختار کلاس"
        subtitle="ساخت حساب، تخصیص نقش، تغییر شمارهٔ ورود با دلیل، ثبت دانش‌آموز و ثبت‌نام او در کلاس — همه بر پایهٔ دادهٔ زندهٔ سرور"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'users' && (
              <Button variant="primary" size="sm" icon={<UserPlus size={15} />} onClick={() => setIsCreateUserOpen(true)}>
                کاربر جدید
              </Button>
            )}
            {activeTab === 'students' && (
              <>
                <Button variant="outline" size="sm" icon={<Upload size={15} />} onClick={() => { setImportFile(null); setImportResult(null); setIsImportOpen(true); }}>
                  ورود گروهی (CSV)
                </Button>
                <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setIsCreateStudentOpen(true)}>
                  دانش‌آموز جدید
                </Button>
              </>
            )}
            {activeTab === 'classrooms' && (
              <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={openCreateClass}>
                کلاس جدید
              </Button>
            )}
          </div>
        }
      />

      {notice && (
        <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <ShieldCheck size={15} /> <span className="font-bold">{notice}</span>
          </div>
        </Card>
      )}

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
            <span className="flex items-center gap-2 font-bold"><AlertCircle size={15} />{error}</span>
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw size={13} />}
              onClick={() => { setUsersReload((k) => k + 1); setStudentsReload((k) => k + 1); setClassroomsReload((k) => k + 1); }}
            >
              تلاش دوباره
            </Button>
          </div>
        </Card>
      )}

      <Tabs tabs={tabs} activeId={activeTab} onChange={(id) => { setActiveTab(id as TabId); setSearchQuery(''); }} />

      {activeTab !== 'classrooms' && (
        <div className="flex justify-start">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={activeTab === 'users' ? 'جستجو در نام یا شمارهٔ کاربران...' : 'جستجو در نام یا کد دانش‌آموز...'}
          />
        </div>
      )}

      {/* ── Users ──────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        users === null ? (
          <Card>
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
              <Loader2 size={18} className="animate-spin" /> در حال دریافت کاربران…
            </div>
          </Card>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
              title="کاربری برای نمایش نیست"
              description={users.length === 0 ? 'هنوز کاربری در این مدرسه ثبت نشده است؛ با دکمهٔ «کاربر جدید» شروع کنید.' : 'با این عبارت جستجو کاربری پیدا نشد.'}
            />
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#DCE3EE] dark:border-[#344257] text-[#526176] dark:text-[#B3C0D2]">
                    <th className="pb-3 pr-2 font-medium">نام و نام خانوادگی</th>
                    <th className="pb-3 font-medium">شمارهٔ ورود</th>
                    <th className="pb-3 font-medium">وضعیت</th>
                    <th className="pb-3 font-medium">نقش‌های فعال</th>
                    <th className="pb-3 font-medium">اقدامات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE3EE]/60 dark:divide-[#344257]/60">
                  {filteredUsers.map((user) => (
                    <tr key={user.ulid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 pr-2 font-bold text-[#202B3C] dark:text-[#F1F5FB] whitespace-nowrap">{user.fullName}</td>
                      <td className="py-3 font-mono tabular-nums text-slate-500" dir="ltr">{user.phone ?? '—'}</td>
                      <td className="py-3">
                        <Badge variant={user.status === 'active' ? 'success' : 'neutral'}>
                          {user.status === 'active' ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {user.roles.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {user.roles.map((assignment) => (
                              <span
                                key={assignment.userRoleId}
                                className="inline-flex items-center gap-1 rounded-full bg-[#EAF1FB] dark:bg-[#1D2B44] px-2 py-0.5 text-[10px] text-[#2457C5] dark:text-[#8BAEFF]"
                              >
                                {assignment.roleTitle ?? BACKEND_ROLE_LABELS[assignment.roleKey ?? ''] ?? assignment.roleKey}
                                <button
                                  type="button"
                                  title="پایان نقش"
                                  onClick={() => { setError(null); setEndRoleReason(''); setEndRoleEndsOn(''); setEndRoleTarget({ user, role: assignment }); }}
                                  className="text-[#8B96A9] hover:text-red-500"
                                >
                                  <UserX size={11} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="outline" icon={<KeyRound size={13} />} onClick={() => { setError(null); setRoleKey('teacher'); setRoleTarget(user); }}>
                            تخصیص نقش
                          </Button>
                          <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => { setError(null); setEditFirst(user.firstName); setEditLast(user.lastName); setNameTarget(user); }}>
                            ویرایش نام
                          </Button>
                          <Button size="sm" variant="ghost" icon={<Phone size={13} />} onClick={() => { setError(null); setNewPhone(user.phone ?? ''); setPhoneReason(''); setPhoneTarget(user); }}>
                            تغییر شماره
                          </Button>
                          <Button size="sm" variant="ghost" icon={<KeyRound size={13} />} onClick={() => { setError(null); setPwValue(''); setPwReason(''); setPwTarget(user); }}>
                            تعیین رمز
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* ── Students ───────────────────────────────────────────── */}
      {activeTab === 'students' && (
        students === null ? (
          <Card>
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
              <Loader2 size={18} className="animate-spin" /> در حال دریافت دانش‌آموزان…
            </div>
          </Card>
        ) : filteredStudents.length === 0 ? (
          <Card>
            <EmptyState
              icon={<GraduationCap size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
              title="دانش‌آموزی برای نمایش نیست"
              description={students.length === 0 ? 'هنوز دانش‌آموزی ثبت نشده است؛ با دکمهٔ «دانش‌آموز جدید» شروع کنید.' : 'با این عبارت جستجو دانش‌آموزی پیدا نشد.'}
            />
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#DCE3EE] dark:border-[#344257] text-[#526176] dark:text-[#B3C0D2]">
                    <th className="pb-3 pr-2 font-medium">نام دانش‌آموز</th>
                    <th className="pb-3 font-medium">کد دانش‌آموزی</th>
                    <th className="pb-3 font-medium">تاریخ تولد</th>
                    <th className="pb-3 font-medium">وضعیت</th>
                    <th className="pb-3 font-medium">ثبت‌نام در کلاس</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE3EE]/60 dark:divide-[#344257]/60">
                  {filteredStudents.map((student) => (
                    <tr key={student.ulid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 pr-2 font-bold text-[#202B3C] dark:text-[#F1F5FB] whitespace-nowrap">{student.fullName}</td>
                      <td className="py-3 font-mono tabular-nums text-slate-500">{student.code}</td>
                      <td className="py-3 text-slate-500 whitespace-nowrap">{formatJalaliDate(student.birthDate)}</td>
                      <td className="py-3">
                        <Badge variant={student.status === 'active' ? 'success' : 'neutral'}>
                          {student.status === 'active' ? 'فعال' : student.status === 'left' ? 'جدا شده' : 'فارغ‌التحصیل'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          {student.classroomTitle ? (
                            <Badge variant="primary">{student.classroomTitle}</Badge>
                          ) : (
                            <span className="text-slate-400 text-[10px]">بدون کلاس</span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setError(null);
                              setEnrollClassroom(classrooms?.[0]?.ulid ?? '');
                              setEnrollStartsOn(todayIso());
                              setEnrollTarget(student);
                            }}
                            disabled={(classrooms ?? []).length === 0}
                          >
                            ثبت‌نام
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Eye size={13} />}
                            onClick={() => { setError(null); setNcReason(''); setNcValue(null); setNcTarget(student); }}
                          >
                            کد ملی
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* ── Classrooms ─────────────────────────────────────────── */}
      {activeTab === 'classrooms' && (
        classrooms === null ? (
          <Card>
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
              <Loader2 size={18} className="animate-spin" /> در حال دریافت کلاس‌ها…
            </div>
          </Card>
        ) : classrooms.length === 0 ? (
          <Card>
            <EmptyState
              icon={<School size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
              title="کلاسی ساخته نشده است"
              description="پیش از ثبت‌نام دانش‌آموز، نخستین کلاس را با دکمهٔ «کلاس جدید» بسازید."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classrooms.map((room) => (
              <Card key={room.ulid} className="text-right">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="primary">{room.gradeLevel}</Badge>
                  <span className="text-[11px] text-slate-400">{room.academicYear}</span>
                </div>
                <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{room.title}</h3>
              </Card>
            ))}
          </div>
        )
      )}

      {/* ── Create user ────────────────────────────────────────── */}
      <Modal isOpen={isCreateUserOpen} onClose={() => setIsCreateUserOpen(false)} title="ساخت حساب کاربری جدید" maxWidth="md">
        <form onSubmit={handleCreateUser} className="space-y-4 text-right">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="نام" required>
              <input
                type="text"
                required
                value={userFirst}
                onChange={(e) => setUserFirst(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
            <FormField label="نام خانوادگی" required>
              <input
                type="text"
                required
                value={userLast}
                onChange={(e) => setUserLast(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
          </div>

          <FormField label="شماره موبایل (ورود با کد پیامکی)" required>
            <input
              type="text"
              required
              dir="ltr"
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
              placeholder="0912..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
            />
          </FormField>

          <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>پس از ساخت، با «تخصیص نقش» دسترسی او را تعیین کنید؛ بدون نقش، کاربر به داشبورد راه پیدا نمی‌کند.</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateUserOpen(false)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || !userFirst.trim() || !userLast.trim() || userPhone.trim().length < 10}>
              {isSaving ? 'در حال ساخت…' : 'ساخت حساب'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Assign role ────────────────────────────────────────── */}
      <Modal
        isOpen={roleTarget !== null}
        onClose={() => setRoleTarget(null)}
        title={`تخصیص نقش به ${roleTarget?.fullName ?? ''}`}
        maxWidth="sm"
      >
        <form onSubmit={handleAssignRole} className="space-y-4 text-right">
          <FormField label="نقش" required>
            <select
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              {roleOptions.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </FormField>

          <FormField label="قلمرو">
            <input
              type="text"
              value="کل مدرسه"
              disabled
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-[#DCE3EE] dark:border-[#344257] rounded-xl text-slate-500"
            />
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setRoleTarget(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'در حال ثبت…' : 'تخصیص نقش'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── End role ───────────────────────────────────────────── */}
      <Modal
        isOpen={endRoleTarget !== null}
        onClose={() => setEndRoleTarget(null)}
        title={`پایان نقش «${endRoleTarget?.role.roleTitle ?? ''}» برای ${endRoleTarget?.user.fullName ?? ''}`}
        maxWidth="sm"
      >
        <form onSubmit={handleEndRole} className="space-y-4 text-right">
          <FormField label="دلیل پایان (درج در لاگ حساس)" required>
            <textarea
              rows={3}
              required
              value={endRoleReason}
              onChange={(e) => setEndRoleReason(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="تاریخ پایان (خالی = قطع از همین امروز)">
            <JalaliDatePicker value={endRoleEndsOn} onChange={setEndRoleEndsOn} />
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEndRoleTarget(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || endRoleReason.trim().length < 5}>
              {isSaving ? 'در حال ثبت…' : 'پایان نقش'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Change phone ───────────────────────────────────────── */}
      <Modal
        isOpen={phoneTarget !== null}
        onClose={() => setPhoneTarget(null)}
        title={`تغییر شمارهٔ ورود ${phoneTarget?.fullName ?? ''}`}
        maxWidth="sm"
      >
        <form onSubmit={handleChangePhone} className="space-y-4 text-right">
          <FormField label="شمارهٔ جدید" required>
            <input
              type="text"
              required
              dir="ltr"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
            />
          </FormField>

          <FormField label="دلیل تغییر (درج در لاگ حساس)" required>
            <textarea
              rows={3}
              required
              value={phoneReason}
              onChange={(e) => setPhoneReason(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setPhoneTarget(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || newPhone.trim().length < 10 || phoneReason.trim().length < 5}>
              {isSaving ? 'در حال ثبت…' : 'ثبت تغییر'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Set password ───────────────────────────────────────── */}
      <Modal
        isOpen={pwTarget !== null}
        onClose={() => setPwTarget(null)}
        title={`تعیین رمز عبور ${pwTarget?.fullName ?? ''}`}
        maxWidth="sm"
      >
        <form onSubmit={handleSetPassword} className="space-y-4 text-right">
          <FormField label="رمز عبور جدید (دست‌کم ۸ نویسه)" required>
            <input
              type="password" required minLength={8} maxLength={64} dir="ltr"
              value={pwValue}
              onChange={(e) => setPwValue(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
            />
          </FormField>

          <FormField label="دلیل تنظیم (درج در لاگ حساس)" required>
            <textarea
              rows={3}
              required
              value={pwReason}
              onChange={(e) => setPwReason(e.target.value)}
              placeholder="مثال: ورود اولیهٔ کادر تازه‌وارد / درخواست ریست رمز."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <p className="text-[10px] text-slate-400">
            یوزرنیم این کاربر همان شمارهٔ موبایل ثبت‌شدهٔ اوست؛ رمز فعلی او با ذخیرهٔ جدید جایگزین می‌شود.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setPwTarget(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || pwValue.length < 8 || pwReason.trim().length < 5}>
              {isSaving ? 'در حال ثبت…' : 'تنظیم رمز'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Create student ─────────────────────────────────────── */}
      <Modal isOpen={isCreateStudentOpen} onClose={() => setIsCreateStudentOpen(false)} title="ثبت دانش‌آموز جدید" maxWidth="md">
        <form onSubmit={handleCreateStudent} className="space-y-4 text-right">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="نام" required>
              <input
                type="text"
                required
                value={stuFirst}
                onChange={(e) => setStuFirst(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
            <FormField label="نام خانوادگی" required>
              <input
                type="text"
                required
                value={stuLast}
                onChange={(e) => setStuLast(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="کد دانش‌آموزی" required>
              <input
                type="text"
                required
                dir="ltr"
                value={stuCode}
                onChange={(e) => setStuCode(e.target.value)}
                placeholder="S01004"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
              />
            </FormField>
            <FormField label="کد ملی (اختیاری)">
              <input
                type="text"
                dir="ltr"
                value={stuNational}
                onChange={(e) => setStuNational(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="0014589621"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
              />
            </FormField>
          </div>

          <FormField label="تاریخ تولد (اختیاری)">
            <JalaliDatePicker value={stuBirth} onChange={setStuBirth} placeholder="انتخاب تاریخ تولد" />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateStudentOpen(false)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || !stuFirst.trim() || !stuLast.trim() || !stuCode.trim()}>
              {isSaving ? 'در حال ثبت…' : 'ثبت دانش‌آموز'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Enroll student ─────────────────────────────────────── */}
      <Modal
        isOpen={enrollTarget !== null}
        onClose={() => setEnrollTarget(null)}
        title={`ثبت‌نام ${enrollTarget?.fullName ?? ''} در کلاس`}
        maxWidth="sm"
      >
        <form onSubmit={handleEnroll} className="space-y-4 text-right">
          <FormField label="کلاس" required>
            <select
              value={enrollClassroom}
              onChange={(e) => setEnrollClassroom(e.target.value)}
              required
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              {(classrooms ?? []).map((room) => (
                <option key={room.ulid} value={room.ulid}>{room.title} — {room.gradeLevel}</option>
              ))}
            </select>
          </FormField>

          <FormField label="تاریخ شروع" required>
            <JalaliDatePicker value={enrollStartsOn} onChange={setEnrollStartsOn} />
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEnrollTarget(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || !enrollClassroom}>
              {isSaving ? 'در حال ثبت…' : 'ثبت‌نام'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Create classroom ───────────────────────────────────── */}
      <Modal isOpen={isCreateClassOpen} onClose={() => setIsCreateClassOpen(false)} title="ساخت کلاس جدید" maxWidth="sm">
        <form onSubmit={handleCreateClassroom} className="space-y-4 text-right">
          <FormField label="عنوان کلاس" required>
            <input
              type="text"
              required
              value={classTitle}
              onChange={(e) => setClassTitle(e.target.value)}
              placeholder="مثال: دهم ریاضی الف"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="سال تحصیلی" required>
            <select
              value={classYear}
              onChange={(e) => setClassYear(e.target.value)}
              required
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              <option value="">{years === null ? 'در حال دریافت…' : 'انتخاب سال تحصیلی'}</option>
              {(years ?? []).map((y) => <option key={y.id} value={y.id}>{y.title}</option>)}
            </select>
          </FormField>

          <FormField label="پایهٔ تحصیلی" required>
            <select
              value={classGrade}
              onChange={(e) => setClassGrade(e.target.value)}
              required
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              <option value="">{gradeLevels === null ? 'در حال دریافت…' : 'انتخاب پایه'}</option>
              {(gradeLevels ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateClassOpen(false)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || !classTitle.trim() || !classYear || !classGrade}>
              {isSaving ? 'در حال ساخت…' : 'ساخت کلاس'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit user name ─────────────────────────────────────── */}
      <Modal
        isOpen={nameTarget !== null}
        onClose={() => setNameTarget(null)}
        title={`ویرایش نام ${nameTarget?.fullName ?? ''}`}
        maxWidth="sm"
      >
        <form onSubmit={handleEditName} className="space-y-4 text-right">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="نام" required>
              <input
                type="text"
                required
                value={editFirst}
                onChange={(e) => setEditFirst(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
            <FormField label="نام خانوادگی" required>
              <input
                type="text"
                required
                value={editLast}
                onChange={(e) => setEditLast(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setNameTarget(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || !editFirst.trim() || !editLast.trim()}>
              {isSaving ? 'در حال ذخیره…' : 'ذخیره'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Reveal national code (sh7) ─────────────────────────── */}
      <Modal
        isOpen={ncTarget !== null}
        onClose={() => { setNcTarget(null); setNcValue(null); }}
        title={`کد ملی ${ncTarget?.fullName ?? ''}`}
        maxWidth="sm"
      >
        {ncValue !== null ? (
          <div className="space-y-4 text-right">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center">
              <span className="text-[11px] text-slate-400 block mb-1">کد ملی</span>
              <strong className="text-lg font-mono tabular-nums tracking-widest" dir="ltr">{ncValue}</strong>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              این مشاهده با دلیل شما در تاریخچهٔ حساس ثبت شد (ش۷)؛ کد ملی در پایگاه داده رمزنگاری‌شده است.
            </p>
            <div className="flex justify-end">
              <Button variant="primary" type="button" onClick={() => { setNcTarget(null); setNcValue(null); }}>بستن</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRevealNationalCode} className="space-y-4 text-right">
            <div className="flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl">
              <Info size={13} className="shrink-0 mt-0.5" />
              <span>مشاهدهٔ کد ملی یک عملیات حساس است: دلیل الزامی است و خودِ مشاهده در لاگ ممیزی ثبت می‌شود.</span>
            </div>

            <FormField label="دلیل مشاهده" required>
              <textarea
                rows={3}
                required
                value={ncReason}
                onChange={(e) => setNcReason(e.target.value)}
                placeholder="مثال: تطبیق شناسنامه برای ثبت‌نام آزمون ورودی"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setNcTarget(null)}>انصراف</Button>
              <Button variant="primary" type="submit" disabled={isRevealing || ncReason.trim().length < 5}>
                {isRevealing ? 'در حال دریافت…' : 'نمایش کد ملی'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── CSV import (FR-34) ─────────────────────────────────── */}
      <Modal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} title="ورود گروهی دانش‌آموزان از فایل CSV" maxWidth="md">
        <form onSubmit={handleImport} className="space-y-4 text-right">
          <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
            <FileSpreadsheet size={14} className="shrink-0 mt-0.5 text-[#2457C5]" />
            <div className="space-y-1">
              <p>ردیف اول باید سرستون باشد؛ ستون‌های لازم:</p>
              <p className="font-mono" dir="ltr">student_code, first_name, last_name, national_code</p>
              <p className="text-slate-400">ستون کد ملی اختیاری است. فایل حداکثر ۲ مگابایت و با کدگذاری UTF-8 ذخیره شود.</p>
            </div>
          </div>

          <FormField label="فایل CSV" required>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          {importResult && (
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  {toPersianDigits(importResult.rowsOk)} ردیف از {toPersianDigits(importResult.rowsTotal)} ردیف ثبت شد.
                </span>
                <Badge variant={importResult.errors.length > 0 ? 'warning' : 'success'}>
                  {importResult.errors.length > 0 ? `${toPersianDigits(importResult.errors.length)} خطا` : 'بدون خطا'}
                </Badge>
              </div>

              {importResult.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-[#DCE3EE] dark:border-[#344257] rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {importResult.errors.map((row) => (
                    <div key={row.rowNumber} className="p-2 text-[11px] text-[#526176] dark:text-[#B3C0D2] flex items-start gap-2">
                      <Badge variant="danger">سطر {toPersianDigits(row.rowNumber)}</Badge>
                      <span>{row.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setIsImportOpen(false)}>بستن</Button>
            <Button variant="primary" type="submit" icon={<Upload size={14} />} disabled={isImporting || importFile === null}>
              {isImporting ? 'در حال پردازش…' : 'شروع ورود گروهی'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
