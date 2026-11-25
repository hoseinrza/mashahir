import { api, apiDocument, apiUpload } from './client';
import { fetchMyChildren } from './auth';
import type { AuditEvent, Student } from '../types';

/**
 * Real-data adapters for the pages that have a live backend module.
 * Shapes are mapped from the backend API into the frontend's own types so
 * pages keep working; unwired pages stay on the mock services.
 */

export interface UserRow {
  ulid: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  status: string;
  roles: UserRoleAssignment[];
}

/** One active role assignment; the platform-wide listing adds schoolTitle. */
export interface UserRoleAssignment {
  userRoleId: number;
  roleKey: string | null;
  roleTitle: string | null;
  scopeType: string;
  endsOn: string | null;
  schoolTitle?: string | null;
}

/** A school subject: editable and deletable while not assigned to any classroom. */
export interface SubjectRow {
  id: number;
  title: string;
  code: string | null;
}

export interface StudentRow {
  ulid: string;
  code: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  birthDate: string | null;
  classroomTitle: string | null;
}

/** Backend role keys → the titles the personnel office reads. */
export const BACKEND_ROLE_LABELS: Record<string, string> = {
  school_admin: 'مدیر مدرسه',
  academic_deputy: 'معاون آموزشی',
  discipline_deputy: 'ناظم',
  teacher: 'دبیر',
  corrector: 'مصحح آزمون',
  proctor: 'مراقب آزمون',
  guardian: 'ولی',
  student: 'دانش‌آموز',
  office_manager: 'مسئول دفتر',
  support: 'پشتیبان',
  platform_admin: 'مدیر پلتفرم',
};

export const ApiUserService = {
  async listUsers(): Promise<UserRow[]> {
    const result = await api<{ data: any[] }>('/v1/users?per_page=100');
    return (result.data ?? []).map((u) => ({
      ulid: u.ulid,
      firstName: u.first_name ?? '',
      lastName: u.last_name ?? '',
      fullName: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
      phone: u.phone ?? null,
      status: u.status ?? 'active',
      roles: (u.roles ?? []).map((r: any) => ({
        userRoleId: r.user_role_id,
        roleKey: r.role_key ?? null,
        roleTitle: r.role_title ?? null,
        scopeType: r.scope_type ?? 'school',
        endsOn: r.ends_on ?? null,
        schoolTitle: r.school_name ?? null,
      })),
    }));
  },

  /** ulid is returned so the role can be assigned the same moment the account is created.
   *  freshAccount false = the phone already had a platform account and it was attached to this school. */
  async createUser(payload: { firstName: string; lastName: string; phone: string }): Promise<{ ulid: string; freshAccount: boolean }> {
    const result = await api<{ ulid: string; fresh_account?: boolean }>('/v1/users', {
      method: 'POST',
      body: { first_name: payload.firstName, last_name: payload.lastName, phone: payload.phone },
    });
    return { ulid: result.ulid, freshAccount: result.fresh_account === true };
  },

  /** sh7: the login number only changes with a written reason. */
  async changePhone(ulid: string, phone: string, reason: string): Promise<void> {
    await api(`/v1/users/${ulid}/phone`, { method: 'POST', body: { phone, reason } });
  },

  async assignRole(
    ulid: string,
    payload: { roleKey: string; scopeType: 'school' | 'classroom' | 'student'; scopeId?: number | null },
  ): Promise<void> {
    await api(`/v1/users/${ulid}/roles`, {
      method: 'POST',
      body: {
        role_key: payload.roleKey,
        scope_type: payload.scopeType,
        ...(payload.scopeId ? { scope_id: payload.scopeId } : {}),
      },
    });
  },

  /** sh7: ending a role is reason-logged and audited (backend endRole). */
  async endRole(ulid: string, userRoleId: number, payload: { reason: string; endsOn?: string | null }): Promise<void> {
    await api(`/v1/users/${ulid}/roles/${userRoleId}`, {
      method: 'DELETE',
      body: {
        reason: payload.reason,
        ...(payload.endsOn ? { ends_on: payload.endsOn } : {}),
      },
    });
  },

  /** Deleting a user: school context detaches the membership, the platform
   *  context hard-deletes a ghost account — the backend decides by context. */
  async deleteUser(ulid: string, reason: string): Promise<string> {
    const result = await api<{ message?: string }>(`/v1/users/${ulid}`, {
      method: 'DELETE',
      body: { reason },
    });
    return result.message ?? 'کاربر حذف شد.';
  },

  /** sh7: setting/replacing a login password is reason-logged and audited. */
  async setPassword(ulid: string, payload: { password: string; reason: string }): Promise<void> {
    await api(`/v1/users/${ulid}/password`, {
      method: 'POST',
      body: { password: payload.password, reason: payload.reason },
    });
  },

  /** Self-service password (username = the user's own mobile number). */
  async setOwnPassword(payload: { password: string; currentPassword?: string }): Promise<void> {
    await api('/v1/auth/password', {
      method: 'POST',
      body: {
        password: payload.password,
        ...(payload.currentPassword ? { current_password: payload.currentPassword } : {}),
      },
    });
  },

  async listStudents(): Promise<StudentRow[]> {
    const result = await api<{ data: any[] }>('/v1/students?per_page=100');
    return (result.data ?? []).map((s) => ({
      ulid: s.ulid,
      code: s.student_code ?? '—',
      firstName: s.first_name ?? '',
      lastName: s.last_name ?? '',
      fullName: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
      status: s.status ?? 'active',
      birthDate: s.birth_date ?? null,
      classroomTitle: s.classroom_title ?? null,
    }));
  },

  async createStudent(payload: {
    firstName: string;
    lastName: string;
    studentCode: string;
    birthDate?: string | null;
    nationalCode?: string | null;
  }): Promise<void> {
    await api('/v1/students', {
      method: 'POST',
      body: {
        first_name: payload.firstName,
        last_name: payload.lastName,
        student_code: payload.studentCode,
        ...(payload.birthDate ? { birth_date: payload.birthDate } : {}),
        ...(payload.nationalCode ? { national_code: payload.nationalCode } : {}),
      },
    });
  },

  async updateName(ulid: string, firstName: string, lastName: string): Promise<void> {
    await api(`/v1/users/${ulid}`, {
      method: 'PATCH',
      body: { first_name: firstName, last_name: lastName },
    });
  },

  /**
   * sh7: the national code is encrypted at rest and only revealed with a
   * written reason; the read itself lands in the audit trail.
   */
  async revealNationalCode(studentUlid: string, reason: string): Promise<string> {
    const result = await api<{ national_code: string | null }>(
      `/v1/students/${studentUlid}/national-code`,
      { method: 'POST', body: { reason } },
    );
    return result.national_code ?? '—';
  },
};

/** Backend audit actions → the page's entityType union. */
function auditEntityType(action: string): AuditEvent['entityType'] {
  if (action.startsWith('attendance')) return 'attendance';
  if (
    action.startsWith('grade') ||
    action.startsWith('report_card') ||
    action.startsWith('report_period') ||
    action.startsWith('report_submission') ||
    action.startsWith('report_entries')
  ) {
    return 'grade';
  }
  if (action.startsWith('court_order')) return 'legal_restriction';
  if (action.startsWith('guardian_link') || action.startsWith('pickup')) return 'family_link';
  if (action.startsWith('exam')) return 'exam';
  if (action.startsWith('online_class')) return 'online_class';
  return 'permission';
}

/** Specific Persian sentence for the actions the backend actually logs. */
const ACTION_TITLES: Record<string, string> = {
  'guardian_link.requested': 'درخواست اتصال ولی ثبت شد',
  'guardian_link.approved': 'پیوند ولی تأیید و فعال شد',
  'guardian_link.updated': 'مجوزهای پیوند ولی تغییر کرد',
  'guardian_link.ended': 'پیوند ولی پایان یافت',
  'court_order.registered': 'حکم دادگاه خانواده ثبت شد',
  'court_order.updated': 'حکم دادگاه خانواده اصلاح شد',
  'pickup.authorization_created': 'فرد مجاز تحویل‌گیری ثبت شد',
  'pickup.authorization_updated': 'فهرست تحویل‌گیری تغییر کرد',
  'user.role_assigned': 'نقش به کاربر تخصیص یافت',
  'user.role_ended': 'تخصیص نقش کاربر پایان یافت',
  'user.created': 'حساب کاربری جدید ساخته یا به مدرسه متصل شد',
  'user.phone_changed': 'شمارهٔ موبایل ورود تغییر کرد',
  'user.updated': 'اطلاعات کاربر ویرایش شد',
  'student.created': 'دانش‌آموز جدید ثبت شد',
  'student.updated': 'اطلاعات دانش‌آموز ویرایش شد',
  'student.national_code_viewed': 'کد ملی دانش‌آموز مشاهده شد',
  'attendance.finalized': 'حضور و غیاب جلسه نهایی شد',
  'attendance.corrected': 'سابقهٔ حضور و غیاب اصلاح شد',
  'attendance.sms_sent': 'پیامک غیبت برای ولی ارسال شد',
  'grade.stored': 'نمره ثبت شد',
  'grade.approved': 'نمره تأیید شد',
  'grade.changed_published': 'نمرهٔ منتشرشده با دلیل تغییر کرد',
  'report_card.published': 'کارنامه منتشر شد',
  'report_period.created': 'دورهٔ کارنامه ماهانه ایجاد شد',
  'report_period.opened': 'دورهٔ کارنامه برای دبیران باز شد',
  'report_entries.saved': 'نمرات دوره ذخیره شد',
  'report_submission.submitted': 'کارنامه برای بازبینی ارسال شد',
  'report_submission.returned': 'کارنامه برای اصلاح برگشت خورد',
  'report_submission.approved': 'کارنامه تأیید شد',
  'report_submission.finalized': 'کارنامه نهایی شد',
  'report_submission.archived': 'کارنامه بایگانی شد',
  'report_submission.reopened': 'کارنامه برای بازبینی بازگشایی شد',
  'announcement.published': 'اطلاعیهٔ رسمی منتشر شد',
  'announcement.updated': 'اطلاعیهٔ رسمی ویرایش شد',
  'role.created': 'نقش سفارشی ایجاد شد',
  'role.updated': 'نقش سفارشی ویرایش شد',
  'role.deleted': 'نقش سفارشی حذف شد',
  'online_class.created': 'کلاس آنلاین ایجاد شد',
  'online_class.closed': 'کلاس آنلاین بسته شد',
  'online_class.deleted': 'کلاس آنلاین حذف شد',
  'import.students_done': 'ورود گروهی دانش‌آموزان انجام شد',
  'school.settings_updated': 'تنظیمات مدرسه تغییر کرد',
};

/** Persian family for an action, used when the exact action has no sentence yet. */
export function auditActionLabel(action: string): string {
  const exact = ACTION_TITLES[action];
  if (exact) return exact;

  const prefix = action.split('.')[0];
  const families: Record<string, string> = {
    guardian_link: 'تغییر در پیوند ولی و دانش‌آموز',
    court_order: 'تغییر در احکام قضایی',
    pickup: 'تغییر در فهرست تحویل‌گیری',
    attendance: 'عملیات حضور و غیاب',
    grade: 'عملیات نمره',
    report_card: 'عملیات کارنامه',
    report_period: 'عملیات دورهٔ کارنامه',
    report_submission: 'عملیات کارنامهٔ ماهانه',
    exam: 'عملیات آزمون',
    user: 'عملیات کاربران',
    student: 'عملیات دانش‌آموزان',
    role: 'مدیریت نقش‌ها',
    announcement: 'کانال اطلاع‌رسانی',
    online_class: 'کلاس آنلاین',
    import: 'ورود گروهی داده',
    school: 'تنظیمات مدرسه',
  };

  return families[prefix] ?? 'رویداد ثبت‌شده در سامانه';
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const ApiAuditService = {
  async listEvents(): Promise<AuditEvent[]> {
    const result = await api<{ data: any[] }>('/v1/audit-logs?per_page=100');
    return (result.data ?? []).map((row) => ({
      id: String(row.id),
      actorId: row.actor?.ulid ?? '—',
      actorName: row.actor?.name ?? 'سیستم',
      actorRole: '—',
      action: row.action,
      entityType: auditEntityType(row.action),
      entityId: row.subject_id != null ? String(row.subject_id) : '—',
      description: ACTION_TITLES[row.action] ?? auditActionLabel(row.action),
      timestamp: formatTimestamp(row.created_at),
      reason: row.reason ?? undefined,
      ipAddress: row.ip ?? undefined,
    }));
  },
};

/** Guardian portal: children of the active guardian, mapped to Student. */
export interface GuardianChildRow {
  studentUlid: string;
  studentName: string;
  linkType: string;
  linkLabel: string;
  flags: {
    can_view_grades: boolean;
    can_view_attendance: boolean;
    can_approve_consent: boolean;
    can_pickup: boolean;
    can_receive_sms: boolean;
  };
}

export interface GuardianFlags {
  can_view_grades: boolean;
  can_view_attendance: boolean;
  can_approve_consent: boolean;
  can_pickup: boolean;
  can_receive_sms: boolean;
}

const EMPTY_FLAGS: GuardianFlags = {
  can_view_grades: false,
  can_view_attendance: false,
  can_approve_consent: false,
  can_pickup: false,
  can_receive_sms: false,
};

const mapFlags = (raw: any): GuardianFlags => ({
  can_view_grades: Boolean(raw?.can_view_grades),
  can_view_attendance: Boolean(raw?.can_view_attendance),
  can_approve_consent: Boolean(raw?.can_approve_consent),
  can_pickup: Boolean(raw?.can_pickup),
  can_receive_sms: Boolean(raw?.can_receive_sms),
});

/** The backend's link types → the labels the family office reads. */
export const GUARDIAN_LINK_TYPES: Record<string, string> = {
  primary: 'ولی اصلی',
  second: 'ولی دوم',
  separated_joint: 'ولی جداشده (حضانت مشترک)',
  separated_limited: 'ولی جداشده (دسترسی محدود)',
  legal_guardian: 'قیم قانونی',
  temporary: 'ولی موقت',
  pickup_only: 'فرد مجاز تحویل‌گیری',
};

export interface GuardianLinkRow {
  id: number;
  studentUlid: string;
  studentName: string;
  guardianUlid: string | null;
  guardianName: string | null;
  linkType: string;
  linkTypeLabel: string;
  status: 'pending' | 'active' | 'ended' | 'rejected' | string;
  endsOn: string | null;
  flags: GuardianFlags;
  verificationFileUlid: string | null;
  adminNote: string | null;
}

export interface CourtOrderRow {
  id: number;
  studentUlid: string | null;
  restrictions: Partial<GuardianFlags>;
  rulingNumber: string | null;
  issuingAuthority: string | null;
  description: string | null;
  validFrom: string | null;
  validTo: string | null;
  fileUlid: string | null;
}

export interface PickupRow {
  id: number;
  fullName: string;
  nationalId: string | null;
  relation: string | null;
  status: 'active' | 'inactive' | string;
  locked: boolean;
  isLinkedGuardian: boolean;
}

const mapCourtOrder = (o: any): CourtOrderRow => ({
  id: o.id,
  studentUlid: o.student_ulid ?? null,
  restrictions: o.restrictions ?? {},
  rulingNumber: o.ruling_number ?? null,
  issuingAuthority: o.issuing_authority ?? null,
  description: o.description ?? null,
  validFrom: o.valid_from ?? null,
  validTo: o.valid_to ?? null,
  fileUlid: o.file ?? null,
});

export const ApiFamilyService = {
  async listMyChildren(): Promise<Student[]> {
    const children = await fetchMyChildren();
    return children.map((c) => ({
      id: c.student_ulid,
      userId: '',
      studentNumber: '',
      classroomId: '',
      nationalId: '—',
      fullName: c.student_name,
      gender: 'male' as const,
      birthDate: '',
      enrollmentStatus: 'active' as const,
    }));
  },

  /** Children of the active guardian with per-link effective flags (court orders included). */
  async childrenWithFlags(): Promise<GuardianChildRow[]> {
    const children = await fetchMyChildren();
    return children.map((c) => ({
      studentUlid: c.student_ulid,
      studentName: c.student_name,
      linkType: c.link_type ?? '',
      linkLabel: c.link_label ?? '',
      flags: {
        can_view_grades: Boolean(c.effective_flags?.can_view_grades),
        can_view_attendance: Boolean(c.effective_flags?.can_view_attendance),
        can_approve_consent: Boolean(c.effective_flags?.can_approve_consent),
        can_pickup: Boolean(c.effective_flags?.can_pickup),
        can_receive_sms: Boolean(c.effective_flags?.can_receive_sms),
      },
    }));
  },

  /** Family-office view: every guardian link of the school. */
  async listAllLinks(): Promise<GuardianLinkRow[]> {
    const result = await api<{ data: any[] }>('/v1/guardian-links');
    return (result.data ?? []).map((l) => ({
      id: l.id,
      studentUlid: l.student_ulid ?? '',
      studentName: l.student_name ?? '—',
      guardianUlid: l.guardian?.ulid ?? null,
      guardianName: l.guardian?.name ?? null,
      linkType: l.link_type ?? '',
      linkTypeLabel: GUARDIAN_LINK_TYPES[l.link_type] ?? l.link_type ?? '—',
      status: l.status ?? 'pending',
      endsOn: l.ends_on ?? null,
      flags: mapFlags(l.effective_flags),
      verificationFileUlid: l.verification_file_ulid ?? null,
      adminNote: l.admin_note ?? null,
    }));
  },

  /** sh15: school approval activates a pending link; the flags come from here. */
  async approveLink(
    id: number,
    payload: {
      flags: GuardianFlags;
      linkType: string;
      reason: string;
      verificationFileId?: number | null;
      adminNote?: string | null;
    },
  ): Promise<void> {
    await api(`/v1/guardian-links/${id}/approve`, {
      method: 'POST',
      body: {
        ...payload.flags,
        link_type: payload.linkType,
        ...(payload.verificationFileId ? { verification_file_id: payload.verificationFileId } : {}),
        ...(payload.adminNote !== undefined && payload.adminNote !== null ? { admin_note: payload.adminNote } : {}),
        reason: payload.reason,
      },
    });
  },

  /** Flag changes are always reason-logged (sh7). */
  async updateLink(
    id: number,
    payload: {
      flags: GuardianFlags;
      linkType: string;
      reason: string;
      verificationFileId?: number | null;
      adminNote?: string | null;
    },
  ): Promise<void> {
    await api(`/v1/guardian-links/${id}`, {
      method: 'PATCH',
      body: {
        ...payload.flags,
        link_type: payload.linkType,
        ...(payload.verificationFileId !== undefined ? { verification_file_id: payload.verificationFileId } : {}),
        ...(payload.adminNote !== undefined ? { admin_note: payload.adminNote } : {}),
        reason: payload.reason,
      },
    });
  },

  /** Ending a link cuts access immediately and keeps the history. */
  async endLink(id: number, reason: string): Promise<void> {
    await api(`/v1/guardian-links/${id}/end`, { method: 'POST', body: { reason } });
  },

  async courtOrders(studentUlid?: string): Promise<{ summaryOnly: boolean; rows: CourtOrderRow[] }> {
    const query = studentUlid ? `?student_ulid=${encodeURIComponent(studentUlid)}` : '';
    const result = await api<{ data: any[]; summary_only: boolean }>(`/v1/court-orders${query}`);
    return {
      summaryOnly: Boolean(result.summary_only),
      rows: (result.data ?? []).map(mapCourtOrder),
    };
  },

  async createCourtOrder(payload: {
    studentUlid: string;
    restrictions: Partial<GuardianFlags>;
    rulingNumber?: string | null;
    issuingAuthority?: string | null;
    description?: string | null;
    validFrom?: string | null;
    validTo?: string | null;
    reason: string;
  }): Promise<void> {
    await api('/v1/court-orders', {
      method: 'POST',
      body: {
        student_ulid: payload.studentUlid,
        restrictions: payload.restrictions,
        ...(payload.rulingNumber ? { ruling_number: payload.rulingNumber } : {}),
        ...(payload.issuingAuthority ? { issuing_authority: payload.issuingAuthority } : {}),
        ...(payload.description ? { description: payload.description } : {}),
        ...(payload.validFrom ? { valid_from: payload.validFrom } : {}),
        ...(payload.validTo ? { valid_to: payload.validTo } : {}),
        reason: payload.reason,
      },
    });
  },

  async updateCourtOrder(
    id: number,
    payload: {
      restrictions?: Partial<GuardianFlags>;
      rulingNumber?: string | null;
      issuingAuthority?: string | null;
      description?: string | null;
      validFrom?: string | null;
      validTo?: string | null;
      reason: string;
    },
  ): Promise<void> {
    await api(`/v1/court-orders/${id}`, {
      method: 'PATCH',
      body: {
        ...(payload.restrictions ? { restrictions: payload.restrictions } : {}),
        ...(payload.rulingNumber !== undefined ? { ruling_number: payload.rulingNumber } : {}),
        ...(payload.issuingAuthority !== undefined ? { issuing_authority: payload.issuingAuthority } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.validFrom !== undefined ? { valid_from: payload.validFrom } : {}),
        ...(payload.validTo !== undefined ? { valid_to: payload.validTo } : {}),
        reason: payload.reason,
      },
    });
  },

  async pickups(studentUlid: string): Promise<PickupRow[]> {
    const result = await api<{ data: any[] }>(`/v1/pickup/${encodeURIComponent(studentUlid)}`);
    return (result.data ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name ?? '—',
      nationalId: p.national_id ?? null,
      relation: p.relation ?? null,
      status: p.status ?? 'active',
      locked: Boolean(p.locked),
      isLinkedGuardian: Boolean(p.is_linked_guardian),
    }));
  },

  async createPickup(
    studentUlid: string,
    payload: { fullName: string; phone: string; nationalId?: string | null; relation?: string; reason: string },
  ): Promise<{ status: string; suggestionOnly: boolean }> {
    const result = await api<{ status: string; suggestion_only: boolean }>(
      `/v1/pickup/${encodeURIComponent(studentUlid)}`,
      {
        method: 'POST',
        body: {
          full_name: payload.fullName,
          phone: payload.phone,
          ...(payload.nationalId ? { national_id: payload.nationalId } : {}),
          ...(payload.relation ? { relation: payload.relation } : {}),
          reason: payload.reason,
        },
      },
    );
    return { status: result?.status ?? 'active', suggestionOnly: Boolean(result?.suggestion_only) };
  },

  async updatePickup(
    id: number,
    payload: { status?: 'active' | 'inactive'; locked?: boolean; relation?: string | null; reason: string },
  ): Promise<void> {
    await api(`/v1/pickup/authorizations/${id}`, {
      method: 'PATCH',
      body: {
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.locked !== undefined ? { locked: payload.locked } : {}),
        ...(payload.relation !== undefined ? { relation: payload.relation } : {}),
        reason: payload.reason,
      },
    });
  },
};

/** Announcements (official channel) mapped to the page's Announcement type. */
export const ApiAnnouncementService = {
  async list(): Promise<import('../types').Announcement[]> {
    const result = await api<{ data: any[] }>('/v1/announcements');
    return (result.data ?? []).map((a) => ({
      id: a.ulid,
      title: a.title,
      content: a.body,
      category: a.importance === 'urgent' ? 'urgent' : a.importance === 'info' ? 'educational' : 'official',
      targetAudience: ['all'],
      authorName: a.publisher ?? 'اداره مدرسه',
      authorRole: 'کانال رسمی',
      publishedDate: formatTimestamp(a.published_at),
      isPinned: false,
      expiresAt: a.expires_at ?? null,
    }));
  },

  async create(
    title: string,
    body: string,
    importance: 'info' | 'important' | 'urgent',
    expiresAt?: string,
  ): Promise<void> {
    await api('/v1/announcements', {
      method: 'POST',
      body: { title, body, importance, ...(expiresAt ? { expires_at: expiresAt } : {}) },
    });
  },

  /** Editing keeps already-delivered notices as their read snapshot. */
  async update(
    ulid: string,
    payload: { title?: string; body?: string; importance?: 'info' | 'important' | 'urgent'; expiresAt?: string | null },
  ): Promise<void> {
    await api(`/v1/announcements/${ulid}`, {
      method: 'PATCH',
      body: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.body !== undefined ? { body: payload.body } : {}),
        ...(payload.importance !== undefined ? { importance: payload.importance } : {}),
        ...(payload.expiresAt !== undefined ? { expires_at: payload.expiresAt } : {}),
      },
    });
  },
};

/** Notification center mapped to the page's Notification type. */
export const ApiNotificationCenter = {
  async list(tab: 'all' | 'unread' | 'important' | 'archived' = 'all'): Promise<{
    unreadCount: number;
    items: import('../types').Notification[];
  }> {
    const result = await api<{ unread_count: number; data: any[] }>(`/v1/notifications?tab=${tab}`);
    return {
      unreadCount: result.unread_count ?? 0,
      items: (result.data ?? []).map((n) => ({
        id: String(n.id),
        userId: 'me',
        title: n.title,
        message: n.body ?? '',
        category: n.type.startsWith('attendance') ? 'attendance'
          : n.type.startsWith('exam') ? 'exam'
          : n.type === 'announcement' ? 'system'
          : 'academic',
        createdAt: formatTimestamp(n.created_at),
        isRead: n.read_at !== null,
        isImportant: n.importance === 'important' || n.importance === 'urgent',
        isArchived: n.archived_at !== null,
        linkUrl: n.link ?? undefined,
      })),
    };
  },

  async markRead(id: number): Promise<void> {
    await api(`/v1/notifications/${id}/read`, { method: 'POST' });
  },

  async archive(id: number): Promise<void> {
    await api(`/v1/notifications/${id}/archive`, { method: 'POST' });
  },

  /** FR-29: per-channel opt-outs; sh14 mandatory school alerts stay locked. */
  async listPreferences(): Promise<{ rows: { type: string; channel: string; enabled: boolean }[]; mandatory: string[] }> {
    const result = await api<{ data: any[]; mandatory_types: string[] }>('/v1/notification-preferences');
    return {
      rows: (result.data ?? []).map((p) => ({ type: p.type, channel: p.channel, enabled: Boolean(p.enabled) })),
      mandatory: result.mandatory_types ?? [],
    };
  },

  async setPreference(type: string, channel: 'in_app' | 'sms' | 'push', enabled: boolean): Promise<void> {
    await api('/v1/notification-preferences', {
      method: 'PUT',
      body: { type, channel, enabled },
    });
  },
};

/** Attendance timeline of one student (guardian/student view). */
export interface AttendanceSessionRow {
  id: number;
  heldOn: string;
  period: number;
  status: string;
  subject: string | null;
  classroomSubjectId: number;
}

export interface AttendanceRosterRow {
  studentUlid: string;
  studentId: number;
  studentName: string;
  status: string | null;
  lateMinutes: number | null;
  recordId: number | null;
}

const mapAttendanceSession = (s: any): AttendanceSessionRow => ({
  id: s.id,
  heldOn: s.held_on ?? '',
  period: s.period,
  status: s.status ?? 'not_taken',
  subject: s.subject ?? null,
  classroomSubjectId: s.classroom_subject_id,
});

export const ApiAttendanceService = {
  async studentTimeline(studentUlid: string): Promise<
    { date: string; period: number; subject: string | null; status: string; late_minutes: number | null }[]
  > {
    const result = await api<{ data: any[] }>(`/v1/attendance/students/${studentUlid}/records`);
    return result.data ?? [];
  },

  /** ── Roll-call console (teacher/staff) ── */

  async createSession(classroomSubjectId: number, heldOn: string, period: number): Promise<AttendanceSessionRow> {
    const result = await api<any>('/v1/attendance/sessions', {
      method: 'POST',
      body: { classroom_subject_id: classroomSubjectId, held_on: heldOn, period },
    });
    return mapAttendanceSession(result);
  },

  async listSessions(classroomSubjectId: number, heldOn: string): Promise<AttendanceSessionRow[]> {
    const result = await api<{ data: any[] }>(
      `/v1/attendance/sessions?classroom_subject_id=${classroomSubjectId}&held_on=${heldOn}`,
    );
    return (result.data ?? []).map(mapAttendanceSession);
  },

  async showSession(id: number): Promise<{ session: AttendanceSessionRow; roster: AttendanceRosterRow[] }> {
    const result = await api<{ session: any; data: any[] }>(`/v1/attendance/sessions/${id}`);
    return {
      session: mapAttendanceSession(result.session),
      roster: (result.data ?? []).map((r) => ({
        studentUlid: r.student_ulid,
        studentId: r.student_id,
        studentName: r.student_name,
        status: r.status ?? null,
        lateMinutes: r.late_minutes ?? null,
        recordId: r.record_id ?? null,
      })),
    };
  },

  async saveRecords(
    sessionId: number,
    rows: { studentId: number; status: 'present' | 'absent' | 'late'; lateMinutes: number | null }[],
  ): Promise<void> {
    await api(`/v1/attendance/sessions/${sessionId}/records`, {
      method: 'POST',
      body: { rows: rows.map((r) => ({ student_id: r.studentId, status: r.status, late_minutes: r.lateMinutes })) },
    });
  },

  async finalizeSession(sessionId: number): Promise<void> {
    await api(`/v1/attendance/sessions/${sessionId}/finalize`, { method: 'POST' });
  },

  async correctRecord(
    recordId: number,
    status: 'present' | 'absent' | 'late',
    reason: string,
    lateMinutes?: number | null,
  ): Promise<void> {
    await api(`/v1/attendance/records/${recordId}/correct`, {
      method: 'POST',
      body: { status, reason, ...(lateMinutes !== null && lateMinutes !== undefined ? { late_minutes: lateMinutes } : {}) },
    });
  },

  /** FR-31: delivery state of the absence/late SMS alerts (sh14 channel). */
  async smsStatus(): Promise<{
    id: number;
    type: string;
    status: string;
    channel: string;
    lastError: string | null;
    sentAt: string | null;
  }[]> {
    const result = await api<{ data: any[] }>('/v1/attendance/sms-status');
    return (result.data ?? []).map((d) => ({
      id: d.id,
      type: d.type,
      status: d.status,
      channel: d.channel,
      lastError: d.last_error ?? null,
      sentAt: d.sent_at ?? null,
    }));
  },

  /** Re-queue one failed delivery (the worker retries it on its next pass). */
  async retryDelivery(id: number): Promise<void> {
    await api(`/v1/notification-deliveries/${id}/retry`, { method: 'POST' });
  },
};

/** Consent inbox of the signed-in guardian (trips and activities of their children). */
export interface ConsentResponseRow {
  guardianUlid: string | null;
  decision: 'approved' | 'rejected' | string;
  decidedAt: string;
}

export interface ConsentRow {
  ulid: string;
  title: string;
  body: string;
  policy: 'one_parent' | 'both_parents' | string;
  dueAt: string | null;
  studentUlid: string | null;
  studentName: string;
  satisfied: boolean;
  myDecision: 'approved' | 'rejected' | null;
  responses: ConsentResponseRow[];
}

export const ApiConsentService = {
  async list(): Promise<ConsentRow[]> {
    const result = await api<{ data: any[] }>('/v1/consents');
    return (result.data ?? []).map((c) => ({
      ulid: c.ulid,
      title: c.title,
      body: c.body ?? '',
      policy: c.policy ?? 'one_parent',
      dueAt: c.due_at ?? null,
      studentUlid: c.student_ulid ?? null,
      studentName: c.student_name ?? '—',
      satisfied: Boolean(c.satisfied),
      myDecision: c.my_decision ?? null,
      responses: (c.responses ?? []).map((r: any) => ({
        guardianUlid: r.guardian_ulid ?? null,
        decision: r.decision,
        decidedAt: r.decided_at,
      })),
    }));
  },

  async respond(ulid: string, decision: 'approved' | 'rejected'): Promise<{ satisfied: boolean }> {
    const result = await api<{ satisfied: boolean }>(`/v1/consents/${ulid}/respond`, {
      method: 'POST',
      body: { decision },
    });
    return { satisfied: Boolean(result?.satisfied) };
  },

  /** Staff: open a consent request for one learner (trip, activity, form). */
  async create(payload: {
    studentUlid: string;
    title: string;
    body?: string;
    dueAt?: string | null;
    policy?: 'one_parent' | 'both_parents';
  }): Promise<void> {
    await api('/v1/consents', {
      method: 'POST',
      body: {
        student_ulid: payload.studentUlid,
        title: payload.title,
        ...(payload.body ? { body: payload.body } : {}),
        ...(payload.dueAt ? { due_at: payload.dueAt } : {}),
        ...(payload.policy ? { policy: payload.policy } : {}),
      },
    });
  },

  /** Fix the wording or push the deadline of an already-opened consent. */
  async update(
    ulid: string,
    payload: { title?: string; body?: string | null; dueAt?: string | null; policy?: 'one_parent' | 'both_parents' },
  ): Promise<void> {
    await api(`/v1/consents/${ulid}`, {
      method: 'PATCH',
      body: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.body !== undefined ? { body: payload.body } : {}),
        ...(payload.dueAt !== undefined ? { due_at: payload.dueAt } : {}),
        ...(payload.policy !== undefined ? { policy: payload.policy } : {}),
      },
    });
  },
};

/** Assignments list mapped to the page's Assignment shape (subset). */
export const ApiAssignmentService = {
  async list(): Promise<Record<string, unknown>[]> {
    const result = await api<{ data: any[] }>('/v1/assignments');
    return result.data ?? [];
  },

  /**
   * Submissions of one assignment, already scoped server-side:
   * a teacher gets his class rows, a student only his own (sh3/sh4).
   */
  async submissionsOf(assignmentUlid: string): Promise<AssignmentSubmission[]> {
    const result = await api<{ data: any[] }>(`/v1/assignments/${assignmentUlid}/submissions`);
    return (result.data ?? []).map((s) => ({
      id: s.id,
      studentUlid: s.student_ulid ?? null,
      studentName: s.student_name ?? '—',
      status: s.status,
      submittedAt: s.submitted_at ?? null,
      score: s.score ?? null,
      feedback: s.feedback ?? null,
      text: s.text ?? null,
      fileCount: (s.files ?? []).length,
    }));
  },
};

export interface AssignmentSummary {
  ulid: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  maxScore: number;
  subject: string | null;
  classroom: string | null;
  fileCount: number;
}

export interface AssignmentSubmission {
  id: number;
  studentUlid: string | null;
  studentName: string;
  status: 'submitted' | 'late' | 'graded';
  submittedAt: string | null;
  score: number | null;
  feedback: string | null;
  text: string | null;
  fileCount: number;
}

export interface TimetableSlot {
  id: number;
  /** 0 = Saturday, following the backend's Iran-standard weekday index. */
  weekday: number;
  period: number;
  startsAt: string;
  endsAt: string;
  classroom: string | null;
  classroomUlid: string | null;
  subject: string | null;
  teacherUlid: string | null;
}

export interface ClassroomSummary {
  ulid: string;
  title: string;
  gradeLevel: string | null;
  academicYear: string | null;
}

export interface ExamSummary {
  ulid: string;
  title: string;
  subject: string | null;
  opensAt: string | null;
  closesAt: string | null;
  durationMinutes: number | null;
  status: string;
}

export interface AttendanceSessionSummary {
  id: number;
  heldOn: string;
  period: number;
  status: 'draft' | 'finalized' | 'corrected';
  subject: string | null;
  classroomSubjectId: number;
}

export interface GradeSummary {
  id: number;
  studentUlid: string | null;
  studentName: string;
  subject: string | null;
  term: string | null;
  status: string;
  sourceType: string | null;
  score: number | null;
  maxScore: number | null;
}

export interface TeachingSubject {
  id: number;
  subject: string;
  classroom: string;
  teacher: string | null;
}

export interface RosterStudent {
  studentUlid: string;
  studentName: string;
  avgOutOf20: number | null;
  finalStatus: string | null;
  finalScore: number | null;
  finalMax: number | null;
}

export interface GradeRoster {
  subject: string | null;
  classroom: string | null;
  teacher: string | null;
  classAvgOutOf20: number | null;
  rows: RosterStudent[];
}

/**
 * Academic structure + learner-facing lists. These power the role dashboards,
 * so every number shown there comes from the live backend.
 */
export const ApiAcademicService = {
  async assignments(): Promise<AssignmentSummary[]> {
    const result = await api<{ data: any[] }>('/v1/assignments');
    return (result.data ?? []).map((a) => ({
      ulid: a.ulid,
      title: a.title,
      description: a.description ?? null,
      dueAt: a.due_at ?? null,
      maxScore: a.max_score ?? 20,
      subject: a.subject ?? null,
      classroom: a.classroom ?? null,
      fileCount: (a.files ?? []).length,
    }));
  },

  async timetable(): Promise<TimetableSlot[]> {
    const result = await api<{ data: any[] }>('/v1/timetable');
    return (result.data ?? []).map((s) => ({
      id: s.id,
      weekday: s.weekday,
      period: s.period,
      startsAt: s.starts_at ?? '',
      endsAt: s.ends_at ?? '',
      classroom: s.classroom ?? null,
      classroomUlid: s.classroom_ulid ?? null,
      subject: s.subject ?? null,
      teacherUlid: s.teacher_ulid ?? null,
    }));
  },

  async classrooms(): Promise<ClassroomSummary[]> {
    const result = await api<{ data: any[] }>('/v1/academic/classrooms');
    return (result.data ?? []).map((c) => ({
      ulid: c.ulid,
      title: c.title,
      gradeLevel: c.grade_level?.title ?? null,
      academicYear: c.academic_year?.title ?? null,
    }));
  },

  async exams(): Promise<ExamSummary[]> {
    const result = await api<{ data: any[] }>('/v1/exams');
    return (result.data ?? []).map((e) => ({
      ulid: e.ulid,
      title: e.title,
      subject: e.subject ?? null,
      opensAt: e.opens_at ?? null,
      closesAt: e.closes_at ?? null,
      durationMinutes: e.duration_minutes ?? null,
      status: e.status,
    }));
  },

  async attendanceSessions(): Promise<AttendanceSessionSummary[]> {
    const result = await api<{ data: any[] }>('/v1/attendance/sessions');
    return (result.data ?? []).map((s) => ({
      id: s.id,
      heldOn: s.held_on,
      period: s.period,
      status: s.status,
      subject: s.subject ?? null,
      classroomSubjectId: s.classroom_subject_id,
    }));
  },

  async grades(): Promise<GradeSummary[]> {
    const result = await api<{ data: any[] }>('/v1/grades');
    return (result.data ?? []).map((g) => ({
      id: g.id,
      studentUlid: g.student_ulid ?? null,
      studentName: g.student_name ?? '—',
      subject: g.subject ?? null,
      term: g.term ?? null,
      status: g.status,
      sourceType: g.source_type ?? null,
      score: g.score ?? null,
      maxScore: g.max_score ?? null,
    }));
  },

  /** Students visible to the active role (sh2/sh3/sh4 scoping is server-side). */
  async studentsInScope(): Promise<{ ulid: string; fullName: string }[]> {
    const result = await api<{ data: any[] }>('/v1/students?per_page=100');
    return (result.data ?? []).map((s) => ({
      ulid: s.ulid,
      fullName: `${s.first_name} ${s.last_name}`.trim(),
    }));
  },

  /** Lesson-classes the active teacher is responsible for (ش۲). */
  async mySubjects(): Promise<TeachingSubject[]> {
    const result = await api<{ data: any[] }>('/v1/academic/my-subjects');
    return (result.data ?? []).map((s) => ({
      id: s.id,
      subject: s.subject,
      classroom: s.classroom,
      teacher: s.teacher ?? null,
    }));
  },

  async terms(): Promise<{ id: number; title: string }[]> {
    const result = await api<{ data: any[] }>('/v1/academic/terms');
    return (result.data ?? []).map((t) => ({ id: t.id, title: t.title }));
  },

  /** Grade book of one lesson-class: the roster the teacher enters scores for. */
  async roster(classroomSubjectId: number, termId: number | null): Promise<GradeRoster> {
    const query = `classroom_subject_id=${classroomSubjectId}${termId ? `&term_id=${termId}` : ''}`;
    const result = await api<any>(`/v1/grades/roster?${query}`);
    return {
      subject: result.subject ?? null,
      classroom: result.classroom ?? null,
      teacher: result.teacher ?? null,
      classAvgOutOf20: result.class_avg_out_of_20 ?? null,
      rows: (result.data ?? []).map((r: any) => ({
        studentUlid: r.student_ulid,
        studentName: r.student_name,
        avgOutOf20: r.avg_out_of_20 ?? null,
        finalStatus: r.final_in_person?.status ?? null,
        finalScore: r.final_in_person?.score ?? null,
        finalMax: r.final_in_person?.max_score ?? null,
      })),
    };
  },
};

/** ── Classroom management (کلاس‌ها، ثبت‌نام، تخصیص دبیر، برنامه هفتگی) ── */

export interface ClassroomAdminRow {
  ulid: string;
  title: string;
  gradeLevel: string;
  academicYear: string;
}

export interface EnrollmentRow {
  enrollmentId: number;
  studentUlid: string;
  studentName: string;
  studentCode: string;
  startsOn: string;
}

export interface IdTitleOption {
  id: number;
  title: string;
}

/** Full academic-year row for the management card. */
export interface AcademicYearRow {
  id: number;
  title: string;
  startsOn: string | null;
  endsOn: string | null;
  isCurrent: boolean;
}

export interface TeacherOption {
  ulid: string;
  name: string;
}

export interface TimetableSlotRow {
  id: number;
  weekday: number;
  period: number;
  startsAt: string;
  endsAt: string;
  subject: string | null;
}

export const ApiClassroomAdminService = {
  async list(): Promise<ClassroomAdminRow[]> {
    const result = await api<{ data: any[] }>('/v1/academic/classrooms');
    return (result.data ?? []).map((c: any) => ({
      ulid: c.ulid,
      title: c.title,
      gradeLevel: c.grade_level?.title ?? '—',
      academicYear: c.academic_year?.title ?? '—',
    }));
  },

  async create(body: { title: string; academic_year_id: number; grade_level_id: number }): Promise<void> {
    await api('/v1/academic/classrooms', { method: 'POST', body });
  },

  async rename(ulid: string, title: string): Promise<void> {
    await api(`/v1/academic/classrooms/${ulid}`, { method: 'PATCH', body: { title } });
  },

  async enrollments(classroomUlid: string): Promise<EnrollmentRow[]> {
    const result = await api<{ data: any[] }>(`/v1/academic/classrooms/${classroomUlid}/enrollments`);
    return (result.data ?? []).map((e: any) => ({
      enrollmentId: e.enrollment_id,
      studentUlid: e.student_ulid,
      studentName: e.student_name ?? '—',
      studentCode: e.student_code ?? '—',
      startsOn: e.starts_on ?? '',
    }));
  },

  async enroll(classroomUlid: string, studentUlid: string, startsOn: string): Promise<void> {
    await api('/v1/academic/enrollments', {
      method: 'POST',
      body: { classroom_ulid: classroomUlid, student_ulid: studentUlid, starts_on: startsOn },
    });
  },

  async endEnrollment(enrollmentId: number, status: 'transferred' | 'ended'): Promise<void> {
    await api(`/v1/academic/enrollments/${enrollmentId}/end`, {
      method: 'POST',
      body: { ends_on: new Date().toISOString().slice(0, 10), status },
    });
  },

  async subjects(): Promise<SubjectRow[]> {
    const result = await api<{ data: any[] }>('/v1/academic/subjects');
    return (result.data ?? []).map((s: any) => ({ id: s.id, title: s.title, code: s.code ?? null }));
  },

  /** academic.manage: define a subject for the school (code optional). */
  async createSubject(payload: { title: string; code?: string }): Promise<void> {
    await api('/v1/academic/subjects', {
      method: 'POST',
      body: {
        title: payload.title,
        ...(payload.code ? { code: payload.code } : {}),
      },
    });
  },

  /** academic.manage: rename/recode a school subject. */
  async updateSubject(id: number, payload: { title?: string; code?: string | null }): Promise<void> {
    await api(`/v1/academic/subjects/${id}`, {
      method: 'PATCH',
      body: {
        ...(payload.title ? { title: payload.title } : {}),
        ...(payload.code !== undefined ? { code: payload.code || null } : {}),
      },
    });
  },

  /** Plain delete answers 422 while the subject is assigned to a classroom;
   *  force=true cascades the assignments with their slots, assignments,
   *  exams and grades — the UI owns the explicit confirmation. */
  async deleteSubject(id: number, force = false): Promise<void> {
    await api(`/v1/academic/subjects/${id}`, {
      method: 'DELETE',
      ...(force ? { body: { force: true } } : {}),
    });
  },

  async teachers(): Promise<TeacherOption[]> {
    const result = await api<{ data: any[] }>('/v1/academic/teachers');
    return (result.data ?? []).map((t: any) => ({ ulid: t.ulid, name: t.name }));
  },

  async years(): Promise<IdTitleOption[]> {
    const result = await api<{ data: any[] }>('/v1/academic/years');
    return (result.data ?? []).map((y: any) => ({ id: y.id, title: y.title }));
  },

  /** Full year rows for the management card (is_current badge etc.). */
  async yearRows(): Promise<AcademicYearRow[]> {
    const result = await api<{ data: any[] }>('/v1/academic/years');
    return (result.data ?? []).map((y: any) => ({
      id: y.id,
      title: y.title,
      startsOn: y.starts_on ?? null,
      endsOn: y.ends_on ?? null,
      isCurrent: Boolean(y.is_current),
    }));
  },

  /** academic.manage: create an academic year; first one auto-becomes current. */
  async createYear(payload: { title: string; startsOn?: string | null; endsOn?: string | null; isCurrent?: boolean }): Promise<void> {
    await api('/v1/academic/years', {
      method: 'POST',
      body: {
        title: payload.title,
        ...(payload.startsOn ? { starts_on: payload.startsOn } : {}),
        ...(payload.endsOn ? { ends_on: payload.endsOn } : {}),
        ...(payload.isCurrent !== undefined ? { is_current: payload.isCurrent } : {}),
      },
    });
  },

  /** academic.manage: rename or promote a year to the school's current one. */
  async updateYear(id: number, payload: { title?: string; isCurrent?: boolean }): Promise<void> {
    await api(`/v1/academic/years/${id}`, {
      method: 'PATCH',
      body: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.isCurrent !== undefined ? { is_current: payload.isCurrent } : {}),
      },
    });
  },

  async gradeLevels(): Promise<IdTitleOption[]> {
    const result = await api<{ data: any[] }>('/v1/academic/grade-levels');
    return (result.data ?? []).map((g: any) => ({ id: g.id, title: g.title }));
  },

  async timetable(classroomUlid: string): Promise<TimetableSlotRow[]> {
    const result = await api<{ data: any[] }>(`/v1/timetable?classroom_ulid=${classroomUlid}`);
    return (result.data ?? []).map((s: any) => ({
      id: s.id,
      weekday: s.weekday,
      period: s.period,
      startsAt: (s.starts_at ?? '').slice(0, 5),
      endsAt: (s.ends_at ?? '').slice(0, 5),
      subject: s.subject ?? null,
    }));
  },

  async createSlot(body: {
    classroom_subject_id: number;
    weekday: number;
    period: number;
    starts_at: string;
    ends_at: string;
  }): Promise<void> {
    await api('/v1/timetable', { method: 'POST', body });
  },

  async updateSlot(id: number, body: { weekday: number; period: number; starts_at: string; ends_at: string }): Promise<void> {
    await api(`/v1/timetable/${id}`, { method: 'PATCH', body });
  },

  async deleteSlot(id: number): Promise<void> {
    await api(`/v1/timetable/${id}`, { method: 'DELETE' });
  },

  async assignTeacher(classroomUlid: string, subjectId: number, teacherUlid: string | null): Promise<void> {
    await api(`/v1/academic/classrooms/${classroomUlid}/subjects`, {
      method: 'POST',
      body: { subject_id: subjectId, teacher_ulid: teacherUlid },
    });
  },
};

export interface ReportCardLineRow {
  subject: string | null;
  score: number | null;
  maxScore: number | null;
  sourceType: string | null;
  teacherComment: string | null;
}

export interface ReportCardRow {
  ulid: string;
  studentUlid: string | null;
  studentName: string;
  term: string | null;
  kind: 'in_person' | 'online' | string;
  version: number;
  status: string;
  publishedAt: string | null;
  /** Class standing among published classmates' cards; null while unrankable. */
  rank: number | null;
  rankOf: number | null;
  /** Raw term id — the publish action posts ids, not display titles. */
  termId: number | null;
  lines: ReportCardLineRow[];
}

/** Published report cards (guardian/student see only published versions). */
export const ApiReportCardService = {
  async list(): Promise<ReportCardRow[]> {
    const result = await api<{ data: any[] }>('/v1/report-cards');
    return (result.data ?? []).map((c) => ({
      ulid: c.ulid,
      studentUlid: c.student_ulid ?? null,
      studentName: c.student_name ?? '—',
      term: c.term ?? null,
      kind: c.kind ?? 'in_person',
      version: c.version ?? 1,
      status: c.status ?? 'published',
      publishedAt: c.published_at ?? null,
      rank: c.rank ?? null,
      rankOf: c.rank_of ?? null,
      termId: c.term_id ?? null,
      lines: (c.lines ?? []).map((l: any) => ({
        subject: l.subject ?? null,
        score: l.score ?? null,
        maxScore: l.max_score ?? null,
        sourceType: l.source_type ?? null,
        teacherComment: l.teacher_comment ?? null,
      })),
    }));
  },

  /** Issue the official card for one learner: folds approved scores into a version. */
  async publish(studentUlid: string, termId: number, kind: string): Promise<void> {
    await api('/v1/report-cards/publish', {
      method: 'POST',
      body: { student_ulid: studentUlid, term_id: termId, kind },
    });
  },
};

/**
 * The printable document. The server renders one fixed A4 template
 * (resources/views/grades/print/document.blade.php) for a single card or for a
 * whole selection, and the browser opens it as an authenticated blob.
 */
export const ApiReportCardPrintService = {
  async bundle(options: { students?: string[]; all?: boolean; kind?: string }): Promise<string> {
    const params = new URLSearchParams();
    if (options.students && options.students.length > 0) {
      params.set('students', options.students.join(','));
    } else if (options.all) {
      params.set('all', '1');
    }
    if (options.kind) params.set('kind', options.kind);

    return apiDocument(`/v1/report-cards/print?${params.toString()}`);
  },

  /** One card by its own ulid — the same template, a single sheet. */
  single(cardUlid: string): Promise<string> {
    return apiDocument(`/v1/report-cards/${cardUlid}/export`);
  },
};

/** Custom school-role management (roles.manage / school_admin). */
export interface SchoolRoleRow {
  id: number;
  key: string;
  title: string;
  isSystem: boolean;
  permissions: { key: string; title: string }[];
}

export const ApiRolesService = {
  async list(): Promise<SchoolRoleRow[]> {
    const result = await api<{ data: any[] }>('/v1/roles');
    return (result.data ?? []).map((r) => ({
      id: r.id,
      key: r.key,
      title: r.title,
      isSystem: Boolean(r.is_system),
      permissions: (r.permissions ?? []).map((p: any) => ({ key: p.key, title: p.title })),
    }));
  },

  async create(key: string, title: string, permissions: string[]): Promise<void> {
    await api('/v1/roles', { method: 'POST', body: { key, title, permissions } });
  },

  async update(id: number, body: { title?: string; permissions?: string[] }): Promise<void> {
    await api(`/v1/roles/${id}`, { method: 'PATCH', body });
  },

  async destroy(id: number): Promise<void> {
    await api(`/v1/roles/${id}`, { method: 'DELETE' });
  },
};

/** FR-35: school-level policy that consent, SMS and report cards share. */
export interface SchoolSettingsPayload {
  school: { ulid: string; name: string } | null;
  settings: Record<string, unknown>;
  /** Alocom (الوکام) online-class credentials — write-only on the backend. */
  alocomUsername: string | null;
  alocomConfigured: boolean;
}

export const ApiSchoolSettingsService = {
  async get(): Promise<SchoolSettingsPayload> {
    const result = await api<{ school: any; settings: Record<string, any>; alocom_username?: string; alocom_configured?: boolean }>('/v1/school/settings');
    return {
      school: result.school ? { ulid: result.school.ulid, name: result.school.name } : null,
      settings: result.settings ?? {},
      alocomUsername: result.alocom_username ?? null,
      alocomConfigured: Boolean(result.alocom_configured),
    };
  },

  async save(entries: { key: string; value: unknown }[]): Promise<void> {
    await api('/v1/school/settings', { method: 'PUT', body: { settings: entries } });
  },
};

/** FR-34: bulk learner import with per-row error reporting. */
export interface ImportBatchResult {
  ulid: string;
  status: string;
  rowsTotal: number;
  rowsOk: number;
  errors: { rowNumber: number; message: string }[];
}

export const ApiImportService = {
  async importStudents(file: File): Promise<ImportBatchResult> {
    const form = new FormData();
    form.append('file', file);

    const created = await apiUpload<{ ulid: string; status: string; rows_total: number; rows_ok: number }>(
      '/v1/imports/students',
      form,
    );

    // The create response carries no row errors; the batch endpoint does.
    try {
      const full = await api<{
        ulid: string;
        status: string;
        rows_total: number;
        rows_ok: number;
        errors?: { row_number: number; message: string }[];
      }>(`/v1/imports/${created.ulid}`);

      return {
        ulid: full.ulid ?? created.ulid,
        status: full.status ?? created.status,
        rowsTotal: full.rows_total ?? created.rows_total,
        rowsOk: full.rows_ok ?? created.rows_ok,
        errors: (full.errors ?? []).map((e) => ({ rowNumber: e.row_number, message: e.message })),
      };
    } catch {
      return {
        ulid: created.ulid,
        status: created.status,
        rowsTotal: created.rows_total,
        rowsOk: created.rows_ok,
        errors: [],
      };
    }
  },
};

/** دفتر مدارس پلتفرم — فقط schools.manage. */
export interface SchoolRow {
  ulid: string;
  name: string;
  level: string;
  gradingType: string;
  studentHasAccount: boolean;
  timezone: string;
  isActive: boolean;
  createdAt: string | null;
}

export const SCHOOL_LEVEL_LABEL: Record<string, string> = {
  elementary: 'ابتدایی',
  middle: 'متوسطهٔ اول',
  high: 'متوسطهٔ دوم',
};

const mapSchool = (raw: any): SchoolRow => ({
  ulid: raw.ulid,
  name: raw.name,
  level: raw.level,
  gradingType: raw.grading_type,
  studentHasAccount: Boolean(raw.student_has_account),
  timezone: raw.timezone ?? 'Asia/Tehran',
  isActive: Boolean(raw.is_active),
  createdAt: raw.created_at ?? null,
});

export interface SchoolPrincipalRow {
  userUlid: string | null;
  name: string | null;
  userRoleId: number;
  startsOn: string | null;
}

export const ApiSchoolsService = {
  async list(): Promise<SchoolRow[]> {
    const result = await api<{ data: any[] }>('/v1/schools');
    return (result.data ?? []).map(mapSchool);
  },

  async show(ulid: string): Promise<SchoolRow & { principals: SchoolPrincipalRow[] }> {
    const raw = await api<any>(`/v1/schools/${ulid}`);
    return {
      ...mapSchool(raw),
      principals: (raw.principals ?? []).map((p: any) => ({
        userUlid: p.user_ulid ?? null,
        name: p.name ?? null,
        userRoleId: p.user_role_id,
        startsOn: p.starts_on ?? null,
      })),
    };
  },

  async create(payload: {
    name: string;
    level: 'elementary' | 'middle' | 'high';
    gradingType: 'numeric' | 'descriptive';
    studentHasAccount?: boolean;
    timezone?: string;
  }): Promise<SchoolRow> {
    const raw = await api<any>('/v1/schools', {
      method: 'POST',
      body: {
        name: payload.name,
        level: payload.level,
        grading_type: payload.gradingType,
        ...(payload.studentHasAccount !== undefined ? { student_has_account: payload.studentHasAccount } : {}),
        ...(payload.timezone ? { timezone: payload.timezone } : {}),
      },
    });
    return mapSchool(raw);
  },

  async update(
    ulid: string,
    payload: Partial<{ name: string; level: string; gradingType: string; isActive: boolean }>,
  ): Promise<void> {
    await api(`/v1/schools/${ulid}`, {
      method: 'PATCH',
      body: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.level !== undefined ? { level: payload.level } : {}),
        ...(payload.gradingType !== undefined ? { grading_type: payload.gradingType } : {}),
        ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {}),
      },
    });
  },

  async assignPrincipal(ulid: string, userUlid: string): Promise<void> {
    await api(`/v1/schools/${ulid}/principals`, {
      method: 'POST',
      body: { user_ulid: userUlid },
    });
  },

  /** Global user search for the principal picker (platform admin only). */
  async candidates(query: string): Promise<{ ulid: string; name: string }[]> {
    if (query.trim().length < 2) return [];

    const result = await api<{ data: any[] }>(`/v1/schools/candidates?q=${encodeURIComponent(query.trim())}`);
    return (result.data ?? []).map((user) => ({ ulid: user.ulid, name: user.name }));
  },
};

/** سرویس مدرسه: خطوط، ایستگاه‌ها، تخصیص دانش‌آموز و ثبت سوارشدن. */
export interface BusStopRow {
  ulid: string;
  title: string;
  position: number;
  pickupTime: string | null;
}

export interface BusRouteRow {
  ulid: string;
  code: string;
  title: string;
  driver: { ulid: string; name: string } | null;
  vehicleModel: string | null;
  plateNumber: string | null;
  capacity: number;
  isActive: boolean;
  stops: BusStopRow[];
  studentsCount: number;
}

export interface BusAssignmentRow {
  studentUlid: string | null;
  studentName: string | null;
  studentCode: string | null;
  stopUlid: string | null;
  stopTitle: string | null;
  pickupTime: string | null;
}

export interface DriverRosterRow {
  studentUlid: string | null;
  studentName: string | null;
  studentCode: string | null;
  stopUlid: string | null;
  stopTitle: string | null;
  pickupTime: string | null;
}

export interface DriverBoardingRow {
  student_ulid: string | null;
  direction: 'in' | 'out' | string;
  status: 'boarded' | 'absent' | string;
  recorded_at: string | null;
}

const mapBusRoute = (raw: any): BusRouteRow => ({
  ulid: raw.ulid,
  code: raw.code ?? '',
  title: raw.title ?? '',
  driver: raw.driver ? { ulid: raw.driver.ulid, name: raw.driver.name } : null,
  vehicleModel: raw.vehicle_model ?? null,
  plateNumber: raw.plate_number ?? null,
  capacity: raw.capacity ?? 0,
  isActive: Boolean(raw.is_active),
  stops: (raw.stops ?? []).map((s: any) => ({
    ulid: s.ulid,
    title: s.title,
    position: s.position,
    pickupTime: s.pickup_time ?? null,
  })),
  studentsCount: raw.students_count ?? 0,
});

export const ApiTransportService = {
  async routes(): Promise<BusRouteRow[]> {
    const result = await api<{ data: any[] }>('/v1/transport/routes');
    return (result.data ?? []).map(mapBusRoute);
  },

  async createRoute(payload: {
    code: string;
    title: string;
    driverUlid?: string | null;
    vehicleModel?: string;
    plateNumber?: string;
    capacity?: number;
  }): Promise<void> {
    await api('/v1/transport/routes', {
      method: 'POST',
      body: {
        code: payload.code,
        title: payload.title,
        ...(payload.driverUlid ? { driver_ulid: payload.driverUlid } : {}),
        ...(payload.vehicleModel ? { vehicle_model: payload.vehicleModel } : {}),
        ...(payload.plateNumber ? { plate_number: payload.plateNumber } : {}),
        ...(payload.capacity !== undefined ? { capacity: payload.capacity } : {}),
      },
    });
  },

  async updateRoute(
    ulid: string,
    payload: { title?: string; driverUlid?: string | null; capacity?: number; isActive?: boolean },
  ): Promise<void> {
    await api(`/v1/transport/routes/${ulid}`, {
      method: 'PATCH',
      body: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.driverUlid !== undefined ? { driver_ulid: payload.driverUlid } : {}),
        ...(payload.capacity !== undefined ? { capacity: payload.capacity } : {}),
        ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {}),
      },
    });
  },

  async addStop(routeUlid: string, payload: { title: string; pickupTime?: string }): Promise<void> {
    await api(`/v1/transport/routes/${routeUlid}/stops`, {
      method: 'POST',
      body: {
        title: payload.title,
        ...(payload.pickupTime ? { pickup_time: payload.pickupTime } : {}),
      },
    });
  },

  async removeStop(routeUlid: string, stopUlid: string): Promise<void> {
    await api(`/v1/transport/routes/${routeUlid}/stops/${stopUlid}`, { method: 'DELETE' });
  },

  async students(routeUlid: string): Promise<BusAssignmentRow[]> {
    const result = await api<{ data: any[] }>(`/v1/transport/routes/${routeUlid}/students`);
    return (result.data ?? []).map((row) => ({
      studentUlid: row.student_ulid ?? null,
      studentName: row.student_name ?? null,
      studentCode: row.student_code ?? null,
      stopUlid: row.stop_ulid ?? null,
      stopTitle: row.stop_title ?? null,
      pickupTime: row.pickup_time ?? null,
    }));
  },

  async assign(routeUlid: string, studentUlid: string, stopUlid?: string | null): Promise<void> {
    await api(`/v1/transport/routes/${routeUlid}/students`, {
      method: 'POST',
      body: { student_ulid: studentUlid, ...(stopUlid ? { bus_stop_ulid: stopUlid } : {}) },
    });
  },

  async unassign(routeUlid: string, studentUlid: string): Promise<void> {
    await api(`/v1/transport/routes/${routeUlid}/students/${studentUlid}`, { method: 'DELETE' });
  },

  /** Driver view: his own route with today's roster and boardings. */
  async myRoute(): Promise<{
    route: BusRouteRow | null;
    roster: DriverRosterRow[];
    boardings: DriverBoardingRow[];
  }> {
    const raw = await api<any>('/v1/transport/my-route');
    return {
      route: raw.route ? mapBusRoute(raw.route) : null,
      roster: (raw.roster ?? []).map((r: any) => ({
        studentUlid: r.student_ulid ?? null,
        studentName: r.student_name ?? null,
        studentCode: r.student_code ?? null,
        stopUlid: r.stop_ulid ?? null,
        stopTitle: r.stop_title ?? null,
        pickupTime: r.pickup_time ?? null,
      })),
      boardings: raw.boardings ?? [],
    };
  },

  async markBoarding(payload: {
    routeUlid: string;
    studentUlid: string;
    direction: 'in' | 'out';
    status: 'boarded' | 'absent';
  }): Promise<void> {
    await api('/v1/transport/boardings', {
      method: 'POST',
      body: {
        route_ulid: payload.routeUlid,
        student_ulid: payload.studentUlid,
        direction: payload.direction,
        status: payload.status,
      },
    });
  },
};

/** ??????: ??????? ????? ????????? ? ??????? ???????? ?????. */
export interface CounselingRow {
  ulid: string;
  topic: string;
  type: string;
  status: string;
  studentUlid: string | null;
  studentName: string | null;
  requesterName: string | null;
  counselorUlid: string | null;
  counselorName: string | null;
  scheduledAt: string | null;
  sharedSummary: string | null;
  followUpPlan: string | null;
  confidentialNotes: string | null;
  createdAt: string | null;
}

export const COUNSELING_STATUS_LABEL: Record<string, string> = {
  requested: '?? ?????? ?????????',
  scheduled: '?????????????',
  completed: '?????????',
  cancelled: '??????',
};

const mapCounseling = (raw: any): CounselingRow => ({
  ulid: raw.ulid,
  topic: raw.topic ?? '',
  type: raw.type ?? 'in_person',
  status: raw.status ?? 'requested',
  studentUlid: raw.student_ulid ?? null,
  studentName: raw.student_name ?? null,
  requesterName: raw.requester_name ?? null,
  counselorUlid: raw.counselor_ulid ?? null,
  counselorName: raw.counselor_name ?? null,
  scheduledAt: raw.scheduled_at ?? null,
  sharedSummary: raw.shared_summary ?? null,
  followUpPlan: raw.follow_up_plan ?? null,
  confidentialNotes: raw.confidential_notes ?? null,
  createdAt: raw.created_at ?? null,
});

export const ApiCounselingService = {
  async list(): Promise<CounselingRow[]> {
    const result = await api<{ data: any[] }>('/v1/counseling/appointments');
    return (result.data ?? []).map(mapCounseling);
  },

  async request(payload: {
    studentUlid: string;
    topic: string;
    type?: 'in_person' | 'online';
    preferredAt?: string | null;
  }): Promise<void> {
    await api('/v1/counseling/appointments', {
      method: 'POST',
      body: {
        student_ulid: payload.studentUlid,
        topic: payload.topic,
        ...(payload.type ? { type: payload.type } : {}),
        ...(payload.preferredAt ? { preferred_at: payload.preferredAt } : {}),
      },
    });
  },

  async update(
    ulid: string,
    payload: {
      counselorUlid?: string | null;
      scheduledAt?: string | null;
      status?: 'requested' | 'scheduled' | 'completed' | 'cancelled';
      type?: 'in_person' | 'online';
      sharedSummary?: string | null;
      confidentialNotes?: string | null;
      followUpPlan?: string | null;
    },
  ): Promise<void> {
    await api(`/v1/counseling/appointments/${ulid}`, {
      method: 'PATCH',
      body: {
        ...(payload.counselorUlid !== undefined ? { counselor_ulid: payload.counselorUlid } : {}),
        ...(payload.scheduledAt !== undefined ? { scheduled_at: payload.scheduledAt } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.type !== undefined ? { type: payload.type } : {}),
        ...(payload.sharedSummary !== undefined ? { shared_summary: payload.sharedSummary } : {}),
        ...(payload.confidentialNotes !== undefined ? { confidential_notes: payload.confidentialNotes } : {}),
        ...(payload.followUpPlan !== undefined ? { follow_up_plan: payload.followUpPlan } : {}),
      },
    });
  },
};

/** ????? ?????: ?????? ????????? ? ??????? ?? ????? ??????? ???. */
export interface PtaMeetingRow {
  ulid: string;
  title: string;
  heldAt: string | null;
  location: string | null;
  agenda: string[];
  minutes: string | null;
  resolutions: string[];
  status: string;
}

export interface PtaSurveyOptionRow {
  id: string;
  text: string;
  votes: number;
}

export interface PtaSurveyRow {
  ulid: string;
  title: string;
  description: string | null;
  policy: string;
  closesAt: string | null;
  isActive: boolean;
  isOpen: boolean;
  options: PtaSurveyOptionRow[];
  totalVotes: number;
  myVote: string | null;
  canManage: boolean;
}

export const PTA_STATUS_LABEL: Record<string, string> = {
  upcoming: '??????',
  held: '?????????',
  cancelled: '??????',
};

const mapPtaMeeting = (raw: any): PtaMeetingRow => ({
  ulid: raw.ulid,
  title: raw.title ?? '',
  heldAt: raw.held_at ?? null,
  location: raw.location ?? null,
  agenda: raw.agenda ?? [],
  minutes: raw.minutes ?? null,
  resolutions: raw.resolutions ?? [],
  status: raw.status ?? 'upcoming',
});

const mapPtaSurvey = (raw: any): PtaSurveyRow => ({
  ulid: raw.ulid,
  title: raw.title ?? '',
  description: raw.description ?? null,
  policy: raw.policy ?? 'per_guardian',
  closesAt: raw.closes_at ?? null,
  isActive: Boolean(raw.is_active),
  isOpen: Boolean(raw.is_open),
  options: (raw.options ?? []).map((o: any) => ({ id: o.id, text: o.text, votes: o.votes ?? 0 })),
  totalVotes: raw.total_votes ?? 0,
  myVote: raw.my_vote ?? null,
  canManage: Boolean(raw.can_manage),
});

export const ApiPtaService = {
  async meetings(): Promise<PtaMeetingRow[]> {
    const result = await api<{ data: any[] }>('/v1/pta/meetings');
    return (result.data ?? []).map(mapPtaMeeting);
  },

  async createMeeting(payload: {
    title: string;
    heldAt: string;
    location?: string;
    agenda?: string[];
  }): Promise<void> {
    await api('/v1/pta/meetings', {
      method: 'POST',
      body: {
        title: payload.title,
        held_at: payload.heldAt,
        ...(payload.location ? { location: payload.location } : {}),
        ...(payload.agenda && payload.agenda.length > 0 ? { agenda: payload.agenda } : {}),
      },
    });
  },

  async updateMeeting(
    ulid: string,
    payload: { title?: string; status?: string; minutes?: string | null; agenda?: string[]; resolutions?: string[]; location?: string | null },
  ): Promise<void> {
    await api(`/v1/pta/meetings/${ulid}`, {
      method: 'PATCH',
      body: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.minutes !== undefined ? { minutes: payload.minutes } : {}),
        ...(payload.agenda !== undefined ? { agenda: payload.agenda } : {}),
        ...(payload.resolutions !== undefined ? { resolutions: payload.resolutions } : {}),
        ...(payload.location !== undefined ? { location: payload.location } : {}),
      },
    });
  },

  async surveys(): Promise<PtaSurveyRow[]> {
    const result = await api<{ data: any[] }>('/v1/pta/surveys');
    return (result.data ?? []).map(mapPtaSurvey);
  },

  async createSurvey(payload: {
    title: string;
    description?: string;
    options: { id?: string; text: string }[];
    policy?: 'per_guardian' | 'per_family';
    closesAt?: string | null;
  }): Promise<void> {
    await api('/v1/pta/surveys', {
      method: 'POST',
      body: {
        title: payload.title,
        ...(payload.description ? { description: payload.description } : {}),
        options: payload.options,
        ...(payload.policy ? { policy: payload.policy } : {}),
        ...(payload.closesAt ? { closes_at: payload.closesAt } : {}),
      },
    });
  },

  async updateSurvey(ulid: string, payload: { isActive?: boolean; title?: string; description?: string | null }): Promise<void> {
    await api(`/v1/pta/surveys/${ulid}`, {
      method: 'PATCH',
      body: {
        ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {}),
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
      },
    });
  },

  async vote(surveyUlid: string, optionId: string): Promise<void> {
    await api(`/v1/pta/surveys/${surveyUlid}/vote`, {
      method: 'POST',
      body: { option_id: optionId },
    });
  },
};
