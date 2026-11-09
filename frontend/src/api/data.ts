import { api, apiDocument } from './client';
import { fetchMyChildren } from './auth';
import type { AuditEvent, Student, User } from '../types';

/**
 * Real-data adapters for the pages that have a live backend module.
 * Shapes are mapped from the backend API into the frontend's own types so
 * pages keep working; unwired pages stay on the mock services.
 */

export const ApiUserService = {
  async listUsers(): Promise<User[]> {
    const result = await api<{ data: any[] }>('/v1/users?per_page=100');
    return (result.data ?? []).map((u) => ({
      id: u.ulid,
      nationalId: '—',
      fullName: `${u.first_name} ${u.last_name}`.trim(),
      email: '—',
      phoneNumber: u.phone ?? '—',
      isActive: u.status === 'active',
      createdAt: '—',
    }));
  },

  async listStudents(): Promise<Student[]> {
    const result = await api<{ data: any[] }>('/v1/students?per_page=100');
    return (result.data ?? []).map((s) => ({
      id: s.ulid,
      userId: '',
      studentNumber: s.student_code,
      classroomId: '',
      nationalId: '—',
      fullName: `${s.first_name} ${s.last_name}`.trim(),
      gender: 'male' as const,
      birthDate: s.birth_date ?? '',
      enrollmentStatus: s.status === 'active' ? 'active' : s.status === 'left' ? 'transferred' : 'graduated',
    }));
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
}

export interface CourtOrderRow {
  id: number;
  studentUlid: string | null;
  restrictions: Partial<GuardianFlags>;
  validFrom: string | null;
  validTo: string | null;
  fileUlid: string | null;
}

export interface PickupRow {
  id: number;
  fullName: string;
  relation: string | null;
  status: 'active' | 'inactive' | string;
  locked: boolean;
  isLinkedGuardian: boolean;
}

const mapCourtOrder = (o: any): CourtOrderRow => ({
  id: o.id,
  studentUlid: o.student_ulid ?? null,
  restrictions: o.restrictions ?? {},
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
    }));
  },

  /** sh15: school approval activates a pending link; the flags come from here. */
  async approveLink(
    id: number,
    payload: { flags: GuardianFlags; linkType: string; reason: string },
  ): Promise<void> {
    await api(`/v1/guardian-links/${id}/approve`, {
      method: 'POST',
      body: { ...payload.flags, link_type: payload.linkType, reason: payload.reason },
    });
  },

  /** Flag changes are always reason-logged (sh7). */
  async updateLink(
    id: number,
    payload: { flags: GuardianFlags; linkType: string; reason: string },
  ): Promise<void> {
    await api(`/v1/guardian-links/${id}`, {
      method: 'PATCH',
      body: { ...payload.flags, link_type: payload.linkType, reason: payload.reason },
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
    validFrom?: string | null;
    validTo?: string | null;
    reason: string;
  }): Promise<void> {
    await api('/v1/court-orders', {
      method: 'POST',
      body: {
        student_ulid: payload.studentUlid,
        restrictions: payload.restrictions,
        ...(payload.validFrom ? { valid_from: payload.validFrom } : {}),
        ...(payload.validTo ? { valid_to: payload.validTo } : {}),
        reason: payload.reason,
      },
    });
  },

  async updateCourtOrder(
    id: number,
    payload: { restrictions?: Partial<GuardianFlags>; validFrom?: string | null; validTo?: string | null; reason: string },
  ): Promise<void> {
    await api(`/v1/court-orders/${id}`, {
      method: 'PATCH',
      body: {
        ...(payload.restrictions ? { restrictions: payload.restrictions } : {}),
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
      relation: p.relation ?? null,
      status: p.status ?? 'active',
      locked: Boolean(p.locked),
      isLinkedGuardian: Boolean(p.is_linked_guardian),
    }));
  },

  async createPickup(
    studentUlid: string,
    payload: { fullName: string; phone: string; relation?: string; reason: string },
  ): Promise<{ status: string; suggestionOnly: boolean }> {
    const result = await api<{ status: string; suggestion_only: boolean }>(
      `/v1/pickup/${encodeURIComponent(studentUlid)}`,
      {
        method: 'POST',
        body: {
          full_name: payload.fullName,
          phone: payload.phone,
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
};

/** Consent inbox of the signed-in guardian (trips and activities of their children). */
export interface ConsentRow {
  ulid: string;
  title: string;
  body: string;
  policy: 'one_parent' | 'both_parents' | string;
  dueAt: string | null;
  studentName: string;
  satisfied: boolean;
  myDecision: 'approved' | 'rejected' | null;
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
      studentName: c.student_name ?? '—',
      satisfied: Boolean(c.satisfied),
      myDecision: c.my_decision ?? null,
    }));
  },

  async respond(ulid: string, decision: 'approved' | 'rejected'): Promise<{ satisfied: boolean }> {
    const result = await api<{ satisfied: boolean }>(`/v1/consents/${ulid}/respond`, {
      method: 'POST',
      body: { decision },
    });
    return { satisfied: Boolean(result?.satisfied) };
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

  async subjects(): Promise<IdTitleOption[]> {
    const result = await api<{ data: any[] }>('/v1/academic/subjects');
    return (result.data ?? []).map((s: any) => ({ id: s.id, title: s.title }));
  },

  async teachers(): Promise<TeacherOption[]> {
    const result = await api<{ data: any[] }>('/v1/academic/teachers');
    return (result.data ?? []).map((t: any) => ({ ulid: t.ulid, name: t.name }));
  },

  async years(): Promise<IdTitleOption[]> {
    const result = await api<{ data: any[] }>('/v1/academic/years');
    return (result.data ?? []).map((y: any) => ({ id: y.id, title: y.title }));
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
