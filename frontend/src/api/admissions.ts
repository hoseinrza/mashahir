import { api } from './client';

/**
 * Admissions module: the public landing pre-registration form plus the
 * school-side pipeline (principal / registrar review).
 */

export const GRADE_OPTIONS: { value: string; label: string }[] = [
  { value: '7_general', label: 'پایه هفتم (دوره اول متوسطه)' },
  { value: '8_general', label: 'پایه هشتم (دوره اول متوسطه)' },
  { value: '9_general', label: 'پایه نهم (دوره اول متوسطه)' },
  { value: '10_math', label: 'پایه دهم · رشته ریاضی و فیزیک' },
  { value: '10_science', label: 'پایه دهم · رشته علوم تجربی' },
  { value: '10_humanities', label: 'پایه دهم · رشته علوم انسانی' },
  { value: '11_math', label: 'پایه یازدهم · رشته ریاضی و فیزیک' },
  { value: '11_science', label: 'پایه یازدهم · رشته علوم تجربی' },
];

const GRADE_LABELS: Record<string, string> = Object.fromEntries(
  GRADE_OPTIONS.map((o) => [o.value, o.label]),
);

export const gradeLabel = (grade: string): string => GRADE_LABELS[grade] ?? grade;

export const PRE_REGISTRATION_STATUS_TITLES: Record<string, string> = {
  new: 'جدید',
  contacted: 'تماس اولیه انجام شد',
  exam_scheduled: 'وقت آزمون تعیین شد',
  accepted: 'پذیرفته شد',
  waitlist: 'لیست انتظار',
  rejected: 'رد شد',
};

export interface PreRegistrationPayload {
  student_name: string;
  grade: string;
  parent_phone: string;
  last_gpa?: string;
  current_school?: string;
  has_honor?: boolean;
  honor_desc?: string;
}

export interface PreRegistrationRow {
  ulid: string;
  tracking_code: string;
  student_name: string;
  grade: string;
  last_gpa: string | null;
  parent_phone: string;
  current_school: string | null;
  has_honor: boolean;
  honor_desc: string | null;
  status: string;
  status_title: string;
  admin_notes: string | null;
  created_at: string | null;
}

export interface PreRegistrationStats {
  total: number;
  new: number;
  today: number;
  accepted: number;
}

/** Persian/Arabic digits → Latin so the backend regex validates. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export const AdmissionsApi = {
  /** Public: no token attached, the route is throttled server-side. */
  submit(payload: PreRegistrationPayload): Promise<{ message: string; tracking_code: string }> {
    return api('/v1/pre-registrations', { method: 'POST', body: payload, tokenKind: 'none' });
  },

  async list(
    status?: string,
  ): Promise<{ stats: PreRegistrationStats; data: PreRegistrationRow[]; last_page: number }> {
    const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    return api(`/v1/pre-registrations${query}`);
  },

  async update(
    ulid: string,
    body: { status: string; admin_notes?: string | null },
  ): Promise<{ data: PreRegistrationRow }> {
    return api(`/v1/pre-registrations/${ulid}`, { method: 'PATCH', body });
  },
};
