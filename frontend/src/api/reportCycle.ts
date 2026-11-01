import { api } from './client';

/**
 * کارنامه ماهانه: دوره‌هایی که مدیر باز می‌کند و کارنامه‌هایی که معلم ثبت،
 * ارسال و (در صورت برگشت) اصلاح می‌کند. تمام وضعیت‌ها از بک‌اند می‌آید؛
 * رابط کاربری فقط همان وضعیت را نشان می‌دهد و قفل‌ها را دور می‌زند.
 */

export type PeriodStatus = 'draft' | 'open';

export type SubmissionStatus =
  | 'open'
  | 'submitted'
  | 'revision_required'
  | 'approved'
  | 'finalized'
  | 'archived';

export interface ReportPeriod {
  ulid: string;
  academicYearId: number;
  academicYear: string | null;
  month: number;
  monthTitle: string;
  title: string | null;
  status: PeriodStatus;
  statusTitle: string;
  dueAt: string | null;
  openedAt: string | null;
  stats?: {
    total: number;
    open: number;
    submitted: number;
    revision_required: number;
    approved: number;
    archived: number;
  };
}

export interface ReportSubmission {
  ulid: string;
  periodUlid: string;
  monthTitle: string;
  academicYear: string | null;
  dueAt: string | null;
  periodStatus: PeriodStatus;
  teacherUlid: string | null;
  teacherName: string;
  status: SubmissionStatus;
  statusTitle: string;
  editable: boolean;
  locked: boolean;
  entryCount: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  returnedAt: string | null;
  returnNote: string | null;
  approvedAt: string | null;
  finalizedAt: string | null;
  archivedAt: string | null;
  reopenReason: string | null;
  groups?: EntryGroup[];
}

export interface AcademicYearOption {
  id: number;
  title: string;
}

export interface EntryRow {
  studentUlid: string;
  studentName: string;
  score: number | null;
  maxScore: number | null;
  evaluation: string | null;
  notes: string | null;
}

export interface EntryGroup {
  classroomSubjectId: number;
  classroom: string | null;
  subject: string | null;
  rows: EntryRow[];
}

export interface PeriodDetail extends ReportPeriod {
  submissions: ReportSubmission[];
  activity: ReportActivityRow[];
}

/** یک ردیف از «گردش کار این دوره» — گزارش‌های report_activity_logs. */
export interface ReportActivityRow {
  action: string;
  actionTitle: string;
  actor: string;
  teacher: string | null;
  reason: string | null;
  createdAt: string | null;
}

const mapActivity = (a: any): ReportActivityRow => ({
  action: a.action,
  actionTitle: a.action_title ?? a.action,
  actor: a.actor ?? '—',
  teacher: a.teacher ?? null,
  reason: a.reason ?? null,
  createdAt: a.created_at ?? null,
});

const mapPeriod = (p: any): ReportPeriod => ({
  ulid: p.ulid,
  academicYearId: p.academic_year_id,
  academicYear: p.academic_year ?? null,
  month: p.month,
  monthTitle: p.month_title ?? String(p.month),
  title: p.title ?? null,
  status: p.status,
  statusTitle: p.status_title ?? p.status,
  dueAt: p.due_at ?? null,
  openedAt: p.opened_at ?? null,
  stats: p.stats,
});

const mapSubmission = (s: any): ReportSubmission => ({
  ulid: s.ulid,
  periodUlid: s.period_ulid,
  monthTitle: s.month_title ?? '',
  academicYear: s.academic_year ?? null,
  dueAt: s.due_at ?? null,
  periodStatus: s.period_status,
  teacherUlid: s.teacher_ulid ?? null,
  teacherName: s.teacher_name ?? '—',
  status: s.status,
  statusTitle: s.status_title ?? s.status,
  editable: !!s.editable,
  locked: !!s.locked,
  entryCount: s.entry_count ?? 0,
  submittedAt: s.submitted_at ?? null,
  reviewedAt: s.reviewed_at ?? null,
  returnedAt: s.returned_at ?? null,
  returnNote: s.return_note ?? null,
  approvedAt: s.approved_at ?? null,
  finalizedAt: s.finalized_at ?? null,
  archivedAt: s.archived_at ?? null,
  reopenReason: s.reopen_reason ?? null,
  groups: (s.groups ?? []).map((g: any) => ({
    classroomSubjectId: g.classroom_subject_id,
    classroom: g.classroom ?? null,
    subject: g.subject ?? null,
    rows: (g.rows ?? []).map((r: any) => ({
      studentUlid: r.student_ulid,
      studentName: r.student_name ?? '—',
      score: r.score ?? null,
      maxScore: r.max_score ?? 20,
      evaluation: r.evaluation ?? null,
      notes: r.notes ?? null,
    })),
  })),
});

/** Principal side: report_periods.* */
export const ApiReportCycleAdminService = {
  async periods(): Promise<{ periods: ReportPeriod[]; months: Record<number, string>; years: AcademicYearOption[]; }> {
    const r = await api<{ data: any[]; months: Record<string, string>; years: { id: number; title: string }[] }>('/v1/report-periods');
    return {
      periods: (r.data ?? []).map(mapPeriod),
      months: Object.fromEntries(Object.entries(r.months ?? {}).map(([k, v]) => [Number(k), v as string])),
      years: (r.years ?? []).map((y) => ({ id: y.id, title: y.title })),
    };
  },

  /** معلمان این مدرسه — همان مجموعه‌ای که «باز کردن برای همه» استفاده می‌کند. */
  async teachers(): Promise<{ ulid: string; name: string }[]> {
    const r = await api<{ data: { ulid: string; name: string }[] }>('/v1/report-periods/teachers');
    return r.data ?? [];
  },

  async create(payload: { academicYearId: number; month: number; title?: string; dueAt?: string | null }): Promise<ReportPeriod> {
    const r = await api<{ data: any }>('/v1/report-periods', {
      method: 'POST',
      body: {
        academic_year_id: payload.academicYearId,
        month: payload.month,
        title: payload.title || null,
        due_at: payload.dueAt || null,
      },
    });
    return mapPeriod(r.data);
  },

  async open(periodUlid: string, teacherUlids: string[] = []): Promise<ReportPeriod> {
    const r = await api<{ data: any }>(`/v1/report-periods/${periodUlid}/open`, {
      method: 'POST',
      body: { teacher_ulids: teacherUlids },
    });
    return mapPeriod(r.data);
  },

  async detail(periodUlid: string): Promise<PeriodDetail> {
    const r = await api<{ data: any }>(`/v1/report-periods/${periodUlid}`);
    return {
      ...mapPeriod(r.data),
      submissions: (r.data.submissions ?? []).map(mapSubmission),
      activity: (r.data.activity ?? []).map(mapActivity),
    };
  },

  /** یک کارنامه ارسال‌شده، با ردیف‌های ثبت‌شده‌ی آن معلم. */
  async submission(periodUlid: string, submissionUlid: string): Promise<ReportSubmission> {
    const r = await api<{ data: any }>(`/v1/report-periods/${periodUlid}/submissions/${submissionUlid}`);
    return mapSubmission(r.data);
  },

  async returnForRevision(periodUlid: string, submissionUlid: string, note: string): Promise<ReportSubmission> {
    const r = await api<{ data: any }>(`/v1/report-periods/${periodUlid}/submissions/${submissionUlid}/return`, {
      method: 'POST', body: { note },
    });
    return mapSubmission(r.data);
  },

  async approve(periodUlid: string, submissionUlid: string): Promise<ReportSubmission> {
    const r = await api<{ data: any }>(`/v1/report-periods/${periodUlid}/submissions/${submissionUlid}/approve`, { method: 'POST' });
    return mapSubmission(r.data);
  },

  async finalize(periodUlid: string, submissionUlid: string): Promise<ReportSubmission> {
    const r = await api<{ data: any }>(`/v1/report-periods/${periodUlid}/submissions/${submissionUlid}/finalize`, { method: 'POST' });
    return mapSubmission(r.data);
  },

  async reopen(periodUlid: string, submissionUlid: string, reason: string): Promise<ReportSubmission> {
    const r = await api<{ data: any }>(`/v1/report-periods/${periodUlid}/submissions/${submissionUlid}/reopen`, {
      method: 'POST', body: { reason },
    });
    return mapSubmission(r.data);
  },
};

/** Teacher side: report-cycle/* */
export const ApiMyReportCycleService = {
  async mine(): Promise<ReportSubmission[]> {
    const r = await api<{ data: any[] }>('/v1/report-cycle/mine');
    return (r.data ?? []).map(mapSubmission);
  },

  async entries(submissionUlid: string): Promise<ReportSubmission> {
    const r = await api<{ data: any }>(`/v1/report-cycle/${submissionUlid}/entries`);
    return mapSubmission(r.data);
  },

  async save(submissionUlid: string, lines: {
    student_ulid: string;
    classroom_subject_id: number;
    score: number | null;
    max_score: number;
    evaluation: string | null;
    notes: string | null;
  }[]): Promise<ReportSubmission> {
    const r = await api<{ data: any }>(`/v1/report-cycle/${submissionUlid}/entries`, {
      method: 'PUT', body: { entries: lines },
    });
    return mapSubmission(r.data);
  },

  async submit(submissionUlid: string): Promise<ReportSubmission> {
    const r = await api<{ data: any }>(`/v1/report-cycle/${submissionUlid}/submit`, { method: 'POST' });
    return mapSubmission(r.data);
  },
};

export const SUBMISSION_TONES: Record<SubmissionStatus, 'neutral' | 'warning' | 'primary' | 'success' | 'danger'> = {
  open: 'neutral',
  submitted: 'primary',
  revision_required: 'danger',
  approved: 'warning',
  finalized: 'success',
  archived: 'success',
};
