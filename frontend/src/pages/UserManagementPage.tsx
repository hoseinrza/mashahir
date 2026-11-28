import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, GraduationCap, School, Plus, UserPlus, Phone, ShieldCheck,
  Loader2, AlertCircle, RefreshCw, KeyRound, Info, Upload, Eye, Pencil, FileSpreadsheet, UserX, Trash2, Download,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, SearchInput, Select, Tabs, PageHeader, AccessDeniedGate, EmptyState } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { formatJalaliDate } from '../utils/jalali';
import { JalaliDatePicker } from '../components/common/JalaliDatePicker';
import {
  ApiUserService, ApiClassroomAdminService, ApiImportService, ApiFamilyService,
  UserRow, UserRoleAssignment, StudentRow, ClassroomAdminRow, IdTitleOption, ImportBatchResult, BACKEND_ROLE_LABELS,
  GuardianLinkRow, GUARDIAN_LINK_TYPES, StudentGuardianInput,
} from '../api/data';
import { ApiError } from '../api/client';

type TabId = 'users' | 'students' | 'classrooms';

/**
 * A parent row typed in the student modal. The block is optional: empty rows
 * are dropped before sending, so a student can be registered alone.
 */
type GuardianDraft = { key: number; linkType: string; firstName: string; lastName: string; phone: string };

let guardianDraftKey = 0;
const emptyGuardianDraft = (linkType: string): GuardianDraft => ({
  key: ++guardianDraftKey,
  linkType,
  firstName: '',
  lastName: '',
  phone: '',
});

/** ۰۹… → 09… so the API regex and the office both see one shape. */
const digitsOnly = (raw: string): string => raw
  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[^\d]/g, '')
  .slice(0, 11);

const isGuardianDraftEmpty = (g: GuardianDraft): boolean =>
  !g.firstName.trim() && !g.lastName.trim() && !g.phone.trim();

/** A login account owner whose password the office may (re)set. */
type PasswordTarget = { ulid: string; fullName: string; kind: 'user' | 'student' };

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export const UserManagementPage: React.FC = () => {
  const { activeRole, hasAccess, passwordChangeReasons } = useAuth();
  // Platform console: school-agnostic — every account of every school.
  const isPlatformAdmin = activeRole.group === 'platform' || activeRole.id === 'platform_super_admin';
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
  // Role picked in the create form itself — assigned the same moment the
  // account exists, no second pass over the table needed.
  const [userRoleKey, setUserRoleKey] = useState('');

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
  // Phone = login: the backend mints/links the student's account from it.
  const [stuPhone, setStuPhone] = useState('');
  // Optional parents, registered in the same step: each row mints a login
  // account, the guardian role, and an active link to this student.
  const [stuGuardians, setStuGuardians] = useState<GuardianDraft[]>(() => [emptyGuardianDraft('primary')]);

  // Parents modal of one roster row: who is already linked, plus an optional
  // add form (a student may have no parent registered at all).
  const [guardianTarget, setGuardianTarget] = useState<StudentRow | null>(null);
  const [guardianList, setGuardianList] = useState<GuardianLinkRow[] | null>(null);
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [gLinkType, setGLinkType] = useState('primary');
  const [gFirst, setGFirst] = useState('');
  const [gLast, setGLast] = useState('');
  const [gPhone, setGPhone] = useState('');

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

  // FR-34: bulk roster import (CSV or xlsx)
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

  /** A clean student form: the parents block starts with one empty row and is never required. */
  const openCreateStudent = () => {
    setStuFirst('');
    setStuLast('');
    setStuCode('');
    setStuBirth('');
    setStuNational('');
    setStuPhone('');
    setStuGuardians([emptyGuardianDraft('primary')]);
    setIsCreateStudentOpen(true);
  };

  const openGuardians = (student: StudentRow) => {
    setError(null);
    setGuardianError(null);
    setGuardianList(null);
    setGLinkType('primary');
    setGFirst('');
    setGLast('');
    setGPhone('');
    setGuardianTarget(student);

    ApiFamilyService.listStudentGuardians(student.ulid)
      .then(setGuardianList)
      .catch((e) => setGuardianError(firstError(e, 'خطا در دریافت اولیای دانش‌آموز')));
  };

  const addGuardianRow = () => setStuGuardians((rows) => (
    rows.length >= 4 ? rows : [...rows, emptyGuardianDraft(rows.length === 0 ? 'primary' : 'second')]
  ));

  const removeGuardianRow = (key: number) =>
    setStuGuardians((rows) => rows.filter((row) => row.key !== key));

  const patchGuardianRow = (key: number, patch: Partial<GuardianDraft>) =>
    setStuGuardians((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

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
      const { ulid, freshAccount } = await ApiUserService.createUser({
        firstName: userFirst.trim(),
        lastName: userLast.trim(),
        phone: userPhone.trim(),
      });

      // Same-moment role assignment: the role selected in the create form is
      // applied right here; only a failed assignment leaves the user listed
      // without a role, retried from the table row.
      let roleNotice: string | null = null;
      let roleFailure: string | null = null;
      if (userRoleKey) {
        try {
          await ApiUserService.assignRole(ulid, { roleKey: userRoleKey, scopeType: 'school' });
          const roleLabel = BACKEND_ROLE_LABELS[userRoleKey] ?? userRoleKey;
          roleNotice = freshAccount
            ? `کاربر ساخته شد و نقش «${roleLabel}» همان لحظه تخصیص یافت.`
            : `این شماره از قبل حساب داشت؛ حساب به این مدرسه متصل و نقش «${roleLabel}» تخصیص یافت.`;
        } catch (roleErr) {
          roleFailure = firstError(roleErr, 'خطا در تخصیص نقش');
        }
      }

      setIsCreateUserOpen(false);
      setUserFirst('');
      setUserLast('');
      setUserPhone('');
      setUserRoleKey('');
      setUsersReload((k) => k + 1);

      if (roleNotice !== null) {
        setNotice(roleNotice);
      } else if (roleFailure !== null) {
        setError(`حساب ساخته/متصل شد اما تخصیص نقش ناموفق ماند: ${roleFailure} — از ردیف کاربر در جدول، «تخصیص نقش» را دوباره بزنید.`);
      } else {
        setNotice(freshAccount
          ? 'کاربر ساخته شد؛ برای دسترسی به سامانه باید نقش بگیرد.'
          : 'این شماره از قبل حساب داشت؛ حساب به این مدرسه متصل شد و اکنون باید نقش بگیرد.');
      }
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
  const [pwTarget, setPwTarget] = useState<PasswordTarget | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwReason, setPwReason] = useState('');

  // ── Delete user: school context detaches the membership; the platform
  // context hard-deletes a ghost account (the backend decides by context) ──
  const [delTarget, setDelTarget] = useState<UserRow | null>(null);
  const [delReason, setDelReason] = useState('');

  // ── Remove a student: a reason-logged soft delete that keeps the history ──
  const [delStudentTarget, setDelStudentTarget] = useState<StudentRow | null>(null);
  const [delStudentReason, setDelStudentReason] = useState('');

  const handleDeleteStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delStudentTarget || delStudentReason.trim().length < 5) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const message = await ApiUserService.deleteStudent(delStudentTarget.ulid, delStudentReason.trim());
      setDelStudentTarget(null);
      setDelStudentReason('');
      setNotice(message);
      setStudentsReload((k) => k + 1);
    } catch (err) {
      setError(firstError(err, 'خطا در حذف دانش‌آموز'));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete user: reason-logged and audited — school detach or ghost removal.
  const handleDeleteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delTarget || delReason.trim().length < 5) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const message = await ApiUserService.deleteUser(delTarget.ulid, delReason.trim());
      setDelTarget(null);
      setDelReason('');
      setNotice(message);
      setUsersReload((k) => k + 1);
    } catch (err) {
      setError(firstError(err, 'خطا در حذف کاربر'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwTarget || pwValue.length < 8 || !pwReason) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (pwTarget.kind === 'student') {
        await ApiUserService.setStudentPassword(pwTarget.ulid, { password: pwValue, reason: pwReason });
      } else {
        await ApiUserService.setPassword(pwTarget.ulid, { password: pwValue, reason: pwReason });
      }
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

    if (stuPhone.trim() && !/^09\d{9}$/.test(stuPhone.trim())) {
      setError('شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود (مثال: 09121234567).');
      return;
    }

    // Parents are optional: only the rows the office actually filled count,
    // and an empty row is silently dropped.
    const filledGuardians = stuGuardians.filter((g) => !isGuardianDraftEmpty(g));

    for (const guardian of filledGuardians) {
      if (!guardian.firstName.trim()) {
        setError('نام ولی را کامل کنید؛ اگر این ردیف لازم نیست، آن را حذف کنید.');
        return;
      }
      if (!/^09\d{9}$/.test(guardian.phone.trim())) {
        setError(`شماره موبایل ${guardian.firstName.trim() || 'ولی'} باید ۱۱ رقم و با ۰۹ شروع شود.`);
        return;
      }
    }

    const guardians: StudentGuardianInput[] = filledGuardians.map((g) => ({
      firstName: g.firstName.trim(),
      lastName: g.lastName.trim() || null,
      phone: g.phone.trim(),
      linkType: g.linkType,
    }));

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
        phone: stuPhone.trim() || null,
        ...(guardians.length > 0 ? { guardians } : {}),
      });
      setIsCreateStudentOpen(false);
      setStuFirst('');
      setStuLast('');
      setStuCode('');
      setStuBirth('');
      setStuNational('');
      setStuPhone('');
      setStuGuardians([emptyGuardianDraft('primary')]);
      setStudentsReload((k) => k + 1);

      const parentsNote = guardians.length > 0
        ? ` و ${toPersianDigits(guardians.length)} ولی با حساب ورودش به او وصل شد`
        : '';
      setNotice(`${stuPhone.trim() ? 'دانش‌آموز ثبت شد و حساب ورودش با شمارهٔ موبایل ساخته شد' : 'دانش‌آموز ثبت شد'}${parentsNote}؛ برای شروع کلاس، او را در یک کلاس ثبت‌نام کنید.`);
    } catch (err) {
      setError(firstError(err, 'خطا در ثبت دانش‌آموز'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardianTarget || !gFirst.trim() || !/^09\d{9}$/.test(gPhone.trim())) return;

    setIsSaving(true);
    setGuardianError(null);
    setNotice(null);
    try {
      await ApiFamilyService.addStudentGuardian(guardianTarget.ulid, {
        firstName: gFirst.trim(),
        lastName: gLast.trim() || null,
        phone: gPhone.trim(),
        linkType: gLinkType,
      });
      setGFirst('');
      setGLast('');
      setGPhone('');
      setGuardianList(await ApiFamilyService.listStudentGuardians(guardianTarget.ulid));
      setNotice(`ولی به ${guardianTarget.fullName} وصل شد و از همین حالا پنلش را با پروندهٔ او می‌بیند.`);
    } catch (err) {
      setGuardianError(firstError(err, 'خطا در افزودن ولی'));
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

  // School actors never mint a platform admin, and nobody assigns the student
  // or guardian role from the personnel form — students live in the students
  // tab and their parents are added next to them, in the same modal.
  const assignableRoleOptions = useMemo(
    () => Object.entries(BACKEND_ROLE_LABELS).filter(
      ([key]) => key !== 'student' && key !== 'guardian' && (isPlatformAdmin || key !== 'platform_admin'),
    ),
    [isPlatformAdmin],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت کاربران، دانش‌آموزان و ساختار کلاس"
        subtitle="ساخت حساب، تخصیص نقش، تغییر شمارهٔ ورود با دلیل، ثبت دانش‌آموز با اولیایش و ثبت‌نام او در کلاس — همه بر پایهٔ دادهٔ زندهٔ سرور"
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
                  ورود گروهی (CSV/Excel)
                </Button>
                <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={openCreateStudent}>
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
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 2xl:grid-cols-3">
            {filteredUsers.map((user) => (
              <div
                key={user.ulid}
                className="rounded-xl border border-[#DCE3EE] bg-white p-2 transition-colors hover:border-[#BECDE2] dark:border-[#344257] dark:bg-[#182231] dark:hover:border-[#4A5A73]"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB]" title={user.fullName}>
                    {user.fullName}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#8B96A9]" dir="ltr">{user.phone ?? '—'}</span>
                  <span className={'flex shrink-0 items-center gap-1 text-[10px] ' + (user.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#8B96A9]')}>
                    <span className={'h-1.5 w-1.5 rounded-full ' + (user.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400')} />
                    {user.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {user.roles.length === 0 ? (
                    <span className="text-[10px] text-[#8B96A9]">بدون نقش فعال</span>
                  ) : (
                    user.roles.map((assignment) => (
                      <span
                        key={assignment.userRoleId}
                        className="inline-flex max-w-full items-center gap-1 rounded-md bg-[#EAF1FB] dark:bg-[#1D2B44] px-1.5 py-0.5 text-[10px] text-[#2457C5] dark:text-[#8BAEFF]"
                      >
                        <span className="truncate">
                          {assignment.roleTitle ?? BACKEND_ROLE_LABELS[assignment.roleKey ?? ''] ?? assignment.roleKey}
                          {isPlatformAdmin && assignment.schoolTitle ? ` · ${assignment.schoolTitle}` : ''}
                        </span>
                        <button
                          type="button"
                          title="پایان نقش"
                          aria-label="پایان نقش"
                          onClick={() => { setError(null); setEndRoleReason(''); setEndRoleEndsOn(''); setEndRoleTarget({ user, role: assignment }); }}
                          className="shrink-0 text-[#8B96A9] hover:text-red-500"
                        >
                          <UserX size={10} />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <div className="mt-1.5 flex items-center gap-1 border-t border-[#E8EDF5] pt-1 dark:border-[#2C3A4E]">
                  <button type="button" title="تخصیص نقش" aria-label="تخصیص نقش" onClick={() => { setError(null); setRoleKey('teacher'); setRoleTarget(user); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#526176] transition-colors hover:bg-black/5 hover:text-[#202B3C] dark:text-[#B3C0D2] dark:hover:bg-white/5 dark:hover:text-white">
                    <ShieldCheck size={13} />
                  </button>
                  <button type="button" title="ویرایش نام" aria-label="ویرایش نام" onClick={() => { setError(null); setEditFirst(user.firstName); setEditLast(user.lastName); setNameTarget(user); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#526176] transition-colors hover:bg-black/5 hover:text-[#202B3C] dark:text-[#B3C0D2] dark:hover:bg-white/5 dark:hover:text-white">
                    <Pencil size={13} />
                  </button>
                  <button type="button" title="تغییر شماره" aria-label="تغییر شماره" onClick={() => { setError(null); setNewPhone(user.phone ?? ''); setPhoneReason(''); setPhoneTarget(user); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#526176] transition-colors hover:bg-black/5 hover:text-[#202B3C] dark:text-[#B3C0D2] dark:hover:bg-white/5 dark:hover:text-white">
                    <Phone size={13} />
                  </button>
                  {hasAccess('users:set_password') && (
                    <button type="button" title="تعیین رمز" aria-label="تعیین رمز" onClick={() => { setError(null); setPwValue(''); setPwReason(''); setPwTarget({ ulid: user.ulid, fullName: user.fullName, kind: 'user' }); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#526176] transition-colors hover:bg-black/5 hover:text-[#202B3C] dark:text-[#B3C0D2] dark:hover:bg-white/5 dark:hover:text-white">
                      <KeyRound size={13} />
                    </button>
                  )}
                  <button type="button" title="حذف کاربر" aria-label="حذف کاربر" onClick={() => { setError(null); setDelReason(''); setDelTarget(user); }} className="mr-auto flex h-7 w-7 items-center justify-center rounded-lg text-[#8B96A9] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 2xl:grid-cols-3">
            {filteredStudents.map((student) => (
              <div
                key={student.ulid}
                className="rounded-xl border border-[#DCE3EE] bg-white p-2 transition-colors hover:border-[#BECDE2] dark:border-[#344257] dark:bg-[#182231] dark:hover:border-[#4A5A73]"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB]" title={student.fullName}>
                    {student.fullName}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#8B96A9]">{student.code}</span>
                  <span className={'flex shrink-0 items-center gap-1 text-[10px] ' + (student.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#8B96A9]')}>
                    <span className={'h-1.5 w-1.5 rounded-full ' + (student.status === 'active' ? 'bg-emerald-500' : student.status === 'left' ? 'bg-amber-500' : 'bg-slate-400')} />
                    {student.status === 'active' ? 'فعال' : student.status === 'left' ? 'جدا شده' : 'فارغ‌التحصیل'}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[#8B96A9]">
                  {student.classroomTitle ? (
                    <span className="rounded-md bg-[#EAF1FB] dark:bg-[#1D2B44] px-1.5 py-0.5 text-[#2457C5] dark:text-[#8BAEFF]">{student.classroomTitle}</span>
                  ) : (
                    <span className="rounded-md bg-[#F1F4F9] dark:bg-[#1B2534] px-1.5 py-0.5">بدون کلاس</span>
                  )}
                  <span className={student.phone ? 'font-mono tabular-nums' : 'italic'} dir={student.phone ? 'ltr' : undefined}>
                    {student.phone ?? 'بدون شمارهٔ ورود'}
                  </span>
                  {student.birthDate && <span>{formatJalaliDate(student.birthDate)}</span>}
                </div>

                <div className="mt-1.5 flex items-center gap-1 border-t border-[#E8EDF5] pt-1 dark:border-[#2C3A4E]">
                  {hasAccess('guardian_links:manage') && (
                    <button
                      type="button"
                      title="اولیا و پیوند به این دانش‌آموز"
                      aria-label="اولیا"
                      onClick={() => openGuardians(student)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#526176] transition-colors hover:bg-black/5 hover:text-[#202B3C] dark:text-[#B3C0D2] dark:hover:bg-white/5 dark:hover:text-white"
                    >
                      <Users size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    title="ثبت‌نام در کلاس"
                    aria-label="ثبت‌نام در کلاس"
                    disabled={(classrooms ?? []).length === 0}
                    onClick={() => {
                      setError(null);
                      setEnrollClassroom(classrooms?.[0]?.ulid ?? '');
                      setEnrollStartsOn(todayIso());
                      setEnrollTarget(student);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#526176] transition-colors hover:bg-black/5 hover:text-[#202B3C] disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#B3C0D2] dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    <UserPlus size={13} />
                  </button>
                  <button
                    type="button"
                    title="کد ملی"
                    aria-label="کد ملی"
                    onClick={() => { setError(null); setNcReason(''); setNcValue(null); setNcTarget(student); }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#526176] transition-colors hover:bg-black/5 hover:text-[#202B3C] dark:text-[#B3C0D2] dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    <Eye size={13} />
                  </button>
                  {hasAccess('users:set_password') && (
                    <button
                      type="button"
                      title={student.phone ? 'تعیین رمز' : 'اول شمارهٔ ورود دانش‌آموز را ثبت کنید تا حساب ساخته شود'}
                      aria-label="تعیین رمز"
                      disabled={!student.phone}
                      onClick={() => {
                        setError(null);
                        setPwValue('');
                        setPwReason('');
                        setPwTarget({ ulid: student.ulid, fullName: student.fullName, kind: 'student' });
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#526176] transition-colors hover:bg-black/5 hover:text-[#202B3C] disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#B3C0D2] dark:hover:bg-white/5 dark:hover:text-white"
                    >
                      <KeyRound size={13} />
                    </button>
                  )}
                  {hasAccess('students:manage') && (
                    <button
                      type="button"
                      title="حذف دانش‌آموز"
                      aria-label="حذف دانش‌آموز"
                      onClick={() => { setError(null); setDelStudentReason(''); setDelStudentTarget(student); }}
                      className="mr-auto flex h-7 w-7 items-center justify-center rounded-lg text-[#8B96A9] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
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

          <FormField label="نقش (اختیاری — همان لحظه تخصیص می‌شود)">
            <select
              value={userRoleKey}
              onChange={(e) => setUserRoleKey(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              <option value="">بدون نقش — بعداً از جدول تخصیص داده می‌شود</option>
              {assignableRoleOptions.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </FormField>

          <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>اگر نقش را همین‌جا انتخاب کنید، به محض ساخت حساب همان لحظه تخصیص می‌یابد؛ بدون نقش، کاربر به داشبورد راه پیدا نمی‌کند (بعداً هم می‌توانید از ردیف او در جدول نقش بدهید). نقش‌های «ولی» و «دانش‌آموز» در این فرم نیستند؛ دانش‌آموز و اولیایش از تب دانش‌آموزان ثبت می‌شوند.</span>
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
              {assignableRoleOptions.map(([key, label]) => (
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
            <Select
              value={pwReason}
              onChange={setPwReason}
              options={[
                { value: '', label: passwordChangeReasons.length ? '— انتخاب دلیل —' : '— فهرست دلایل در دسترس نیست —' },
                ...passwordChangeReasons.map((reason) => ({ value: reason, label: reason })),
              ]}
            />
          </FormField>

          <p className="text-[10px] text-slate-400">
            {pwTarget?.kind === 'student'
              ? 'یوزرنیم این دانش‌آموز همان شمارهٔ موبایل ثبت‌شدهٔ اوست؛ رمز فعلی او با ذخیرهٔ جدید جایگزین می‌شود.'
              : 'یوزرنیم این کاربر همان شمارهٔ موبایل ثبت‌شدهٔ اوست؛ رمز فعلی او با ذخیرهٔ جدید جایگزین می‌شود.'}
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setPwTarget(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || pwValue.length < 8 || !pwReason}>
              {isSaving ? 'در حال ثبت…' : 'تنظیم رمز'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete user ────────────────────────────────────────── */}
      <Modal
        isOpen={delTarget !== null}
        onClose={() => setDelTarget(null)}
        title={`حذف ${delTarget?.fullName ?? ''}`}
        maxWidth="sm"
      >
        <form onSubmit={handleDeleteUser} className="space-y-4 text-right">
          <div className="flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>
              {isPlatformAdmin
                ? 'اگر این حساب عضو هیچ مدرسه‌ای نباشد، برای همیشه حذف می‌شود؛ در غیر این صورت پیام خطا راهنمایی می‌کند که عضویت‌هایش را نخست از لیست همان مدرسه حذف کنید.'
                : 'عضویت او از این مدرسه حذف می‌شود (نقش‌هایش در این مدرسه پایان می‌یابد)؛ حساب پلتفرمی‌اش برای مدارس دیگر باقی می‌ماند.'}
            </span>
          </div>

          <FormField label="دلیل حذف (درج در لاگ حساس)" required>
            <textarea
              rows={3}
              required
              value={delReason}
              onChange={(e) => setDelReason(e.target.value)}
              placeholder="مثال: ثبت اشتباه / پایان همکاری"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setDelTarget(null)}>انصراف</Button>
            <Button variant="danger" type="submit" disabled={isSaving || delReason.trim().length < 5}>
              {isSaving ? 'در حال حذف…' : 'حذف کاربر'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Remove a student ───────────────────────────────────── */}
      <Modal
        isOpen={delStudentTarget !== null}
        onClose={() => setDelStudentTarget(null)}
        title={`حذف دانش‌آموز ${delStudentTarget?.fullName ?? ''}`}
        maxWidth="sm"
      >
        <form onSubmit={handleDeleteStudent} className="space-y-4 text-right">
          <div className="flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>
              دانش‌آموز از فهرست مدرسه حذف می‌شود و دیگر در لیست‌ها دیده نمی‌شود؛ حضور و غیاب، نمرات و ثبت‌نام‌هایش برای بازیابی باقی می‌ماند و نقش ورود او پایان می‌یابد.
            </span>
          </div>

          <FormField label="دلیل حذف (درج در لاگ حساس)" required>
            <textarea
              rows={3}
              required
              value={delStudentReason}
              onChange={(e) => setDelStudentReason(e.target.value)}
              placeholder="مثال: ثبت اشتباه در فهرست / انتقال به مدرسهٔ دیگر"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setDelStudentTarget(null)}>انصراف</Button>
            <Button variant="danger" type="submit" disabled={isSaving || delStudentReason.trim().length < 5}>
              {isSaving ? 'در حال حذف…' : 'حذف دانش‌آموز'}
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

          <FormField label="شماره موبایل (اختیاری — حساب ورود دانش‌آموز ساخته می‌شود)">
            <input
              type="text"
              dir="ltr"
              value={stuPhone}
              onChange={(e) => setStuPhone(
                e.target.value
                  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                  .replace(/[^\d]/g, '')
                  .slice(0, 11),
              )}
              placeholder="09121234567"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
            />
          </FormField>

          <FormField label="تاریخ تولد (اختیاری)">
            <JalaliDatePicker value={stuBirth} onChange={setStuBirth} placeholder="انتخاب تاریخ تولد" />
          </FormField>

          {/* Parents — optional, and linked to THIS student at the same moment. */}
          <div className="rounded-xl border border-dashed border-[#DCE3EE] p-3 text-right dark:border-[#344257]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                اولیا <span className="font-normal text-[#8B96A9]">(اختیاری)</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus size={13} />}
                disabled={stuGuardians.length >= 4}
                onClick={addGuardianRow}
              >
                افزودن ولی
              </Button>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-[#8B96A9]">
              الزامی نیست؛ ردیف خالی نادیده گرفته می‌شود. هر ولی که اینجا ثبت کنید با همان شماره حساب ورود می‌گیرد،
              نقش «ولی» را در این مدرسه دارد و به همین دانش‌آموز وصل می‌شود — پس پنلش پروندهٔ همین دانش‌آموز را نشان می‌دهد.
            </p>

            <div className="mt-2 space-y-2">
              {stuGuardians.map((guardian, index) => (
                <div key={guardian.key} className="rounded-lg bg-[#F7F9FC] p-2 dark:bg-[#131C29]">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-[#526176] dark:text-[#B3C0D2]">
                      {toPersianDigits(index + 1)}. {GUARDIAN_LINK_TYPES[guardian.linkType] ?? 'ولی'}
                    </span>
                    {stuGuardians.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGuardianRow(guardian.key)}
                        className="flex items-center gap-1 text-[10px] text-[#8B96A9] transition-colors hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 size={11} /> حذف ردیف
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <FormField label="نوع پیوند">
                      <select
                        value={guardian.linkType}
                        onChange={(e) => patchGuardianRow(guardian.key, { linkType: e.target.value })}
                        className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
                      >
                        {Object.entries(GUARDIAN_LINK_TYPES).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="نام ولی">
                      <input
                        type="text"
                        value={guardian.firstName}
                        onChange={(e) => patchGuardianRow(guardian.key, { firstName: e.target.value })}
                        className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
                      />
                    </FormField>
                    <FormField label="نام خانوادگی ولی">
                      <input
                        type="text"
                        value={guardian.lastName}
                        onChange={(e) => patchGuardianRow(guardian.key, { lastName: e.target.value })}
                        className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
                      />
                    </FormField>
                    <FormField label="موبایل ولی (همان نام کاربری ورود)">
                      <input
                        type="text"
                        dir="ltr"
                        value={guardian.phone}
                        onChange={(e) => patchGuardianRow(guardian.key, { phone: digitsOnly(e.target.value) })}
                        placeholder="09121234567"
                        className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateStudentOpen(false)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || !stuFirst.trim() || !stuLast.trim() || !stuCode.trim()}>
              {isSaving ? 'در حال ثبت…' : 'ثبت دانش‌آموز'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Parents of one student ─────────────────────────────── */}
      <Modal
        isOpen={guardianTarget !== null}
        onClose={() => setGuardianTarget(null)}
        title={`اولیای ${guardianTarget?.fullName ?? ''}`}
        maxWidth="md"
      >
        <div className="space-y-4 text-right">
          <p className="rounded-xl bg-[#F7F9FC] p-2.5 text-[10px] leading-relaxed text-[#526176] dark:bg-[#131C29] dark:text-[#B3C0D2]">
            هر ولی که به این دانش‌آموز وصل شود با شمارهٔ خودش وارد می‌شود و پنلش را روی پروندهٔ همین دانش‌آموز می‌گیرد؛
            ولی دیگر هرگز شماره، پیام یا پروندهٔ او را نمی‌بیند. داشتن ولی اختیاری است.
          </p>

          {guardianError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/70 p-2.5 text-[11px] font-bold text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{guardianError}</span>
            </div>
          )}

          {guardianList === null && !guardianError ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-[#526176] dark:text-[#B3C0D2]">
              <Loader2 size={16} className="animate-spin" /> در حال دریافت اولیا…
            </div>
          ) : (guardianList ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#DCE3EE] p-3 text-center text-[11px] text-[#8B96A9] dark:border-[#344257]">
              هنوز ولی برای این دانش‌آموز ثبت نشده است؛ الزامی هم نیست. اگر سرپرست دانش‌آموز باید پنل داشته باشد، از فرم پایین اضافه کنید.
            </div>
          ) : (
            <div className="space-y-2">
              {(guardianList ?? []).map((link) => {
                const status = link.status === 'active'
                  ? { label: 'پیوند فعال', className: 'text-emerald-700 dark:text-emerald-400' }
                  : link.status === 'pending'
                    ? { label: 'در انتظار تأیید', className: 'text-amber-700 dark:text-amber-400' }
                    : link.status === 'rejected'
                      ? { label: 'رد شده', className: 'text-rose-700 dark:text-rose-400' }
                      : { label: 'پایان یافته', className: 'text-[#8B96A9]' };

                const granted = [
                  link.flags.can_view_grades && 'نمرات',
                  link.flags.can_view_attendance && 'حضور',
                  link.flags.can_approve_consent && 'رضایت‌نامه',
                  link.flags.can_pickup && 'تحویل دانش‌آموز',
                  link.flags.can_receive_sms && 'پیامک',
                ].filter(Boolean).join(' · ');

                return (
                  <div key={link.id} className="rounded-xl border border-[#DCE3EE] p-2 dark:border-[#344257]">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                        {link.guardianName ?? 'ولی بدون حساب کاربری'}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#8B96A9]" dir="ltr">
                        {link.guardianPhone ?? '—'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="rounded-md bg-[#EAF1FB] px-1.5 py-0.5 text-[#2457C5] dark:bg-[#1D2B44] dark:text-[#8BAEFF]">
                        {link.linkTypeLabel}
                      </span>
                      <span className={'font-bold ' + status.className}>{status.label}</span>
                      {granted && <span className="text-[#8B96A9]">{granted}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <form onSubmit={handleAddGuardian} className="space-y-3 border-t border-[#E8EDF5] pt-3 dark:border-[#2C3A4E]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB]">
              <UserPlus size={14} /> افزودن ولی <span className="font-normal text-[#8B96A9]">(اختیاری)</span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FormField label="نوع پیوند">
                <select
                  value={gLinkType}
                  onChange={(e) => setGLinkType(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
                >
                  {Object.entries(GUARDIAN_LINK_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="نام ولی">
                <input
                  type="text"
                  value={gFirst}
                  onChange={(e) => setGFirst(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
                />
              </FormField>
              <FormField label="نام خانوادگی ولی">
                <input
                  type="text"
                  value={gLast}
                  onChange={(e) => setGLast(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
                />
              </FormField>
              <FormField label="موبایل ولی (همان نام کاربری ورود)">
                <input
                  type="text"
                  dir="ltr"
                  value={gPhone}
                  onChange={(e) => setGPhone(digitsOnly(e.target.value))}
                  placeholder="09121234567"
                  className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setGuardianTarget(null)}>بستن</Button>
              <Button
                variant="primary"
                type="submit"
                disabled={isSaving || !gFirst.trim() || !/^09\d{9}$/.test(gPhone)}
              >
                {isSaving ? 'در حال ثبت…' : 'ثبت و اتصال ولی'}
              </Button>
            </div>
          </form>
        </div>
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

      {/* ── Roster import (FR-34) ──────────────────────────────── */}
      <Modal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} title="ورود گروهی دانش‌آموزان از فایل CSV یا Excel" maxWidth="md">
        <form onSubmit={handleImport} className="space-y-4 text-right">
          <div className="rounded-xl border border-[#DCE3EE] dark:border-[#344257] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border-b border-[#DCE3EE] dark:border-[#344257]">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <FileSpreadsheet size={13} className="text-[#2457C5]" />
                ساختار دقیق برگهٔ اکسل — ردیف ۱ سرستون، داده‌ها از ردیف ۲
              </span>
              <a href="/templates/student-roster-sample.xlsx" download className="flex items-center gap-1 text-[11px] font-medium text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                <Download size={13} />
                دانلود فایل نمونه
              </a>
            </div>

            <div className="overflow-x-auto" dir="ltr">
              <table dir="ltr" className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 dark:bg-slate-800/20 text-slate-400 dark:text-slate-500">
                    <th className="w-6 px-1.5 py-1.5 font-normal border-b border-[#DCE3EE] dark:border-[#344257]"></th>
                    {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                      <th key={letter} className="px-1.5 py-1.5 font-normal border-b border-[#DCE3EE] dark:border-[#344257]">{letter}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-200">
                  <tr>
                    <td className="px-1.5 py-1.5 text-slate-400 border-b border-[#DCE3EE] dark:border-[#344257]">1</td>
                    {['student_code', 'first_name', 'last_name', 'national_code', 'phone'].map((column) => (
                      <td key={column} className="px-1.5 py-1.5 font-mono text-[9px] whitespace-nowrap border-b border-[#DCE3EE] dark:border-[#344257]">{column}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-1.5 py-1.5 text-slate-400">2</td>
                    <td className="px-1.5 py-1.5 font-mono">S1001</td>
                    <td className="px-1.5 py-1.5" dir="rtl">پارسا</td>
                    <td className="px-1.5 py-1.5" dir="rtl">رادمنش</td>
                    <td className="px-1.5 py-1.5 font-mono">0012345678</td>
                    <td className="px-1.5 py-1.5 font-mono">09121234567</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="px-3 py-2 text-[11px] leading-6 text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-800/20">
              ردیف ۲ فقط نمونه است. <span className="font-mono" dir="ltr">national_code</span> و <span className="font-mono" dir="ltr">phone</span> اختیاری‌اند (کد ملی ۱۰ رقم، موبایل ۱۱ رقم با ۰۹؛ ارقام فارسی هم قبول است) و با ثبت موبایل، حساب ورود دانش‌آموز ساخته می‌شود. فقط برگهٔ اول خوانده می‌شود؛ xls قدیمی باید اول به xlsx تبدیل شود. حداکثر ۲ مگابایت.
            </p>
          </div>

          <FormField label="فایل CSV یا Excel (xlsx)" required>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
