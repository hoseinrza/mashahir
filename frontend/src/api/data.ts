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
    return new Date(iso).toLocaleString('fa-IR');
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
