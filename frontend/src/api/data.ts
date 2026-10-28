import { api } from './client';
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

/** Backend audit actions → the page's entityType union (nearest match). */
function auditEntityType(action: string): AuditEvent['entityType'] {
  if (action.startsWith('guardian_link')) return 'family_link';
  if (action.startsWith('court_order')) return 'legal_restriction';
  if (action.startsWith('user.role') || action.startsWith('user.phone')) return 'permission';
  if (action.startsWith('pickup')) return 'family_link';
  if (action.startsWith('attendance')) return 'attendance';
  return 'permission';
}

const ACTION_TITLES: Record<string, string> = {
  'guardian_link.requested': 'درخواست اتصال ولی',
  'guardian_link.approved': 'تأیید پیوند ولی',
  'guardian_link.updated': 'تغییر پرچم‌های پیوند ولی',
  'guardian_link.ended': 'پایان پیوند ولی',
  'court_order.registered': 'ثبت حکم دادگاه',
  'user.role_assigned': 'تخصیص نقش به کاربر',
  'user.role_ended': 'پایان نقش کاربر',
  'user.phone_changed': 'تغییر شماره موبایل ورود',
  'student.national_code_viewed': 'مشاهده کد ملی دانش‌آموز',
  'pickup.authorization_created': 'ثبت فرد مجاز تحویل‌گیری',
  'pickup.authorization_updated': 'تغییر لیست تحویل‌گیری',
};

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
      description: ACTION_TITLES[row.action] ?? row.action,
      timestamp: formatTimestamp(row.created_at),
      reason: row.reason ?? undefined,
      ipAddress: row.ip ?? undefined,
    }));
  },
};

/** Guardian portal: children of the active guardian, mapped to Student. */
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
};

/** Announcements (official channel) mapped to the page's Announcement type. */
export const ApiAnnouncementService = {
  async list(): Promise<import('../types').Announcement[]> {
    const result = await api<{ data: any[] }>('/v1/announcements');
    return (result.data ?? []).map((a) => ({
      id: a.ulid,
      title: a.title,
      content: a.body,
      category: a.importance === 'urgent' ? 'urgent' : 'official',
      targetAudience: ['all'],
      authorName: a.publisher ?? 'اداره مدرسه',
      authorRole: 'کانال رسمی',
      publishedDate: formatTimestamp(a.published_at),
      isPinned: false,
    }));
  },

  async create(title: string, body: string, importance: 'info' | 'important' | 'urgent'): Promise<void> {
    await api('/v1/announcements', {
      method: 'POST',
      body: { title, body, importance },
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
export const ApiAttendanceService = {
  async studentTimeline(studentUlid: string): Promise<
    { date: string; period: number; subject: string | null; status: string; late_minutes: number | null }[]
  > {
    const result = await api<{ data: any[] }>(`/v1/attendance/students/${studentUlid}/records`);
    return result.data ?? [];
  },
};

/** Assignments list mapped to the page's Assignment shape (subset). */
export const ApiAssignmentService = {
  async list(): Promise<Record<string, unknown>[]> {
    const result = await api<{ data: any[] }>('/v1/assignments');
    return result.data ?? [];
  },
};

/** Published report cards (guardian/student see only published versions). */
export const ApiReportCardService = {
  async list(): Promise<Record<string, unknown>[]> {
    const result = await api<{ data: any[] }>('/v1/report-cards');
    return result.data ?? [];
  },
};

/** Consent requests for the current viewer. */
export const ApiConsentService = {
  async list(): Promise<Record<string, unknown>[]> {
    const result = await api<{ data: any[] }>('/v1/consents');
    return result.data ?? [];
  },
};

/** Custom school-role management (roles.manage / school_admin). */
export const ApiRolesService = {
  async list(): Promise<Record<string, unknown>[]> {
    const result = await api<{ data: Record<string, unknown>[] }>('/v1/roles');
    return result.data ?? [];
  },

  async create(key: string, title: string, permissions: string[]): Promise<void> {
    await api('/v1/roles', {
      method: 'POST',
      body: { key, title, permissions: permissions.map((c) => c.replace(':', '.')) },
    });
  },
};
