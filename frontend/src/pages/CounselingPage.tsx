import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HeartHandshake, Loader2, AlertCircle, RefreshCw, Plus, Calendar, Clock,
  Lock, UserCheck, CheckCircle2, XCircle, Inbox,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader, AccessDeniedGate, EmptyState } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { formatJalaliDateTime } from '../utils/jalali';
import { JalaliDateTimePicker } from '../components/common/JalaliDatePicker';
import {
  ApiCounselingService, ApiAcademicService, ApiFamilyService,
  CounselingRow, COUNSELING_STATUS_LABEL,
} from '../api/data';
import { ApiError } from '../api/client';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' | 'primary' }> = {
  requested: { label: COUNSELING_STATUS_LABEL.requested, variant: 'warning' },
  scheduled: { label: COUNSELING_STATUS_LABEL.scheduled, variant: 'primary' },
  completed: { label: COUNSELING_STATUS_LABEL.completed, variant: 'success' },
  cancelled: { label: COUNSELING_STATUS_LABEL.cancelled, variant: 'neutral' },
};

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

const toLocalInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const CounselingPage: React.FC = () => {
  const { activeRole, currentUser, hasAccess } = useAuth();

  const isFamily = activeRole.group === 'family';
  const isStudent = activeRole.group === 'student';
  const canManage = hasAccess('counseling:manage');
  const canRequest = hasAccess('counseling:request');
  const canView = hasAccess('counseling:view') || canManage;

  const [rows, setRows] = useState<CounselingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const [students, setStudents] = useState<{ ulid: string; fullName: string }[] | null>(null);

  // Booking (learner / guardian / staff on behalf)
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [bookStudent, setBookStudent] = useState('');
  const [bookTopic, setBookTopic] = useState('');
  const [bookType, setBookType] = useState<'in_person' | 'online'>('in_person');
  const [bookPreferred, setBookPreferred] = useState('');

  // Manage (counselor)
  const [manageTarget, setManageTarget] = useState<CounselingRow | null>(null);
  const [manageScheduled, setManageScheduled] = useState('');
  const [manageStatus, setManageStatus] = useState<'requested' | 'scheduled' | 'completed' | 'cancelled'>('scheduled');
  const [manageSummary, setManageSummary] = useState('');
  const [manageNotes, setManageNotes] = useState('');
  const [manageFollowUp, setManageFollowUp] = useState('');

  const load = useCallback(() => {
    setRows(null);
    setError(null);

    ApiCounselingService.list()
      .then(setRows)
      .catch((e) => setError(firstError(e, 'خطا در دریافت نوبت‌های مشاوره')));
  }, []);

  useEffect(() => { if (canView) load(); }, [canView, reloadKey, load]);

  useEffect(() => {
    if (!canView) return;

    if (isFamily) {
      ApiFamilyService.childrenWithFlags()
        .then((children) => setStudents(children.map((c) => ({ ulid: c.studentUlid, fullName: c.studentName }))))
        .catch(() => setStudents([]));
      return;
    }

    ApiAcademicService.studentsInScope()
      .then((list) => setStudents(list))
      .catch(() => setStudents([]));
  }, [canView, isFamily]);

  const openBooking = () => {
    const first = students?.[0];
    setBookStudent(first?.ulid ?? '');
    setBookTopic('');
    setBookType('in_person');
    setBookPreferred('');
    setIsBookOpen(true);
    setError(null);
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookStudent || bookTopic.trim().length < 3) return;

    setIsSaving(true);
    setError(null);
    try {
      await ApiCounselingService.request({
        studentUlid: bookStudent,
        topic: bookTopic.trim(),
        type: bookType,
        preferredAt: bookPreferred || null,
      });
      setIsBookOpen(false);
      setReloadKey((k) => k + 1);
      setNotice('درخواست نوبت ثبت شد؛ مشاور زمان جلسه را تعیین می‌کند.');
    } catch (err) {
      setError(firstError(err, 'خطا در ثبت درخواست مشاوره'));
    } finally {
      setIsSaving(false);
    }
  };

  const openManage = (row: CounselingRow) => {
    setManageTarget(row);
    setManageScheduled(toLocalInput(row.scheduledAt));
    setManageStatus(row.status === 'requested' ? 'scheduled' : row.status as typeof manageStatus);
    setManageSummary(row.sharedSummary ?? '');
    setManageNotes(row.confidentialNotes ?? '');
    setManageFollowUp(row.followUpPlan ?? '');
    setError(null);
  };

  const handleManage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageTarget) return;

    setIsSaving(true);
    setError(null);
    try {
      await ApiCounselingService.update(manageTarget.ulid, {
        counselorUlid: manageTarget.counselorUlid ?? currentUser.id,
        scheduledAt: manageScheduled || null,
        status: manageStatus,
        sharedSummary: manageSummary.trim() || null,
        confidentialNotes: manageNotes.trim() || null,
        followUpPlan: manageFollowUp.trim() || null,
      });
      setManageTarget(null);
      setReloadKey((k) => k + 1);
      setNotice('نوبت به‌روزرسانی شد.');
    } catch (err) {
      setError(firstError(err, 'خطا در به‌روزرسانی نوبت'));
    } finally {
      setIsSaving(false);
    }
  };

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      requested: all.filter((r) => r.status === 'requested').length,
      scheduled: all.filter((r) => r.status === 'scheduled').length,
      completed: all.filter((r) => r.status === 'completed').length,
    };
  }, [rows]);

  if (!canView) {
    return (
      <AccessDeniedGate
        title="دسترسی به پروندهٔ مشاوره"
        requiredRoleOrPermission="counseling:view یا counseling:request"
        reason="جلسات مشاوره و یادداشت‌های آن برای دانش‌آموز، ولی مرتبط و مشاور مجاز است؛ سایر نقش‌ها به این پرونده دسترسی ندارند."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isFamily ? 'مشاورهٔ فرزند — نوبت‌دهی و پیگیری' : isStudent ? 'مشاوره و هدایت تحصیلی من' : 'میز مشاوره — نوبت‌ها و جلسات'}
        subtitle={
          canManage
            ? 'درخواست‌های دانش‌آموزان و اولیا، زمان‌بندی جلسه، ثبت خلاصهٔ قابل اشتراک و یادداشت محرمانهٔ مشاور'
            : 'درخواست نوبت، زمان جلسه و خلاصهٔ جلساتی که مشاور با شما به اشتراک گذاشته است'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReloadKey((k) => k + 1)}>
              به‌روزرسانی
            </Button>
            {canRequest && (
              <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={openBooking}>
                درخواست نوبت مشاوره
              </Button>
            )}
          </div>
        }
      />

      {notice && (
        <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={15} /> <span className="font-bold">{notice}</span>
          </div>
        </Card>
      )}

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
            <span className="flex items-center gap-2 font-bold"><AlertCircle size={15} />{error}</span>
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setReloadKey((k) => k + 1)}>
              تلاش دوباره
            </Button>
          </div>
        </Card>
      )}

      {canManage && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{rows === null ? '…' : toPersianDigits(stats.requested)}</div>
            <div className="text-[11px] text-slate-400">در انتظار زمان‌بندی</div>
          </Card>
          <Card className="text-center">
            <div className="text-lg font-bold text-[#2457C5] dark:text-[#8BAEFF]">{rows === null ? '…' : toPersianDigits(stats.scheduled)}</div>
            <div className="text-[11px] text-slate-400">زمان‌بندی‌شده</div>
          </Card>
          <Card className="text-center">
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{rows === null ? '…' : toPersianDigits(stats.completed)}</div>
            <div className="text-[11px] text-slate-400">برگزارشده</div>
          </Card>
        </div>
      )}

      {rows === null ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال دریافت نوبت‌ها…
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="نوبتی ثبت نشده است"
            description={
              canRequest
                ? 'با دکمهٔ «درخواست نوبت مشاوره» نخستین جلسه را ثبت کنید؛ مشاور زمان جلسه را تعیین می‌کند.'
                : 'درخواست‌های دانش‌آموزان و اولیا همین‌جا برای زمان‌بندی ظاهر می‌شوند.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const badge = STATUS_BADGE[row.status] ?? { label: row.status, variant: 'neutral' as const };
            return (
              <Card key={row.ulid} className="text-right">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                      <HeartHandshake size={14} className="text-[#2457C5]" /> {row.topic}
                    </h3>
                    {row.type === 'online' && <Badge variant="neutral">آنلاین</Badge>}
                  </div>

                  {canManage && (
                    <Button size="sm" variant="outline" icon={<Calendar size={13} />} onClick={() => openManage(row)}>
                      {row.status === 'requested' ? 'زمان‌بندی' : 'مدیریت جلسه'}
                    </Button>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 mt-2 flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1"><UserCheck size={11} /> {row.studentName ?? '—'}</span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {row.scheduledAt ? formatJalaliDateTime(row.scheduledAt) : 'زمان تعیین نشده'}
                  </span>
                  {row.counselorName && <span>مشاور: {row.counselorName}</span>}
                  {row.requesterName && <span className="text-slate-400">درخواست: {row.requesterName}</span>}
                </div>

                {row.sharedSummary && (
                  <p className="mt-2 text-xs text-[#526176] dark:text-[#B3C0D2] bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl leading-relaxed">
                    <strong className="block mb-1">خلاصهٔ جلسه:</strong>
                    {row.sharedSummary}
                  </p>
                )}

                {canManage && row.confidentialNotes && (
                  <p className="mt-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl leading-relaxed">
                    <strong className="flex items-center gap-1 mb-1"><Lock size={11} /> یادداشت محرمانه (فقط مشاور):</strong>
                    {row.confidentialNotes}
                  </p>
                )}

                {row.followUpPlan && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    <strong>پیگیری: </strong>{row.followUpPlan}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Booking modal */}
      <Modal isOpen={isBookOpen} onClose={() => setIsBookOpen(false)} title="درخواست نوبت مشاوره" maxWidth="md">
        <form onSubmit={handleBook} className="space-y-4 text-right">
          {!isStudent && (
            <FormField label="دانش‌آموز" required>
              <select
                value={bookStudent}
                onChange={(e) => setBookStudent(e.target.value)}
                required
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              >
                <option value="">{students === null ? 'در حال دریافت…' : 'انتخاب دانش‌آموز'}</option>
                {(students ?? []).map((student) => (
                  <option key={student.ulid} value={student.ulid}>{student.fullName}</option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="موضوع جلسه" required>
            <input
              type="text"
              required
              value={bookTopic}
              onChange={(e) => setBookTopic(e.target.value)}
              placeholder="مثال: اضطراب پیش از آزمون / انتخاب رشته"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="نوع جلسه">
              <select
                value={bookType}
                onChange={(e) => setBookType(e.target.value as 'in_person' | 'online')}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              >
                <option value="in_person">حضوری</option>
                <option value="online">آنلاین</option>
              </select>
            </FormField>

            <FormField label="زمان پیشنهادی (اختیاری)">
              <JalaliDateTimePicker value={bookPreferred} onChange={setBookPreferred} />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsBookOpen(false)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || !bookStudent || bookTopic.trim().length < 3}>
              {isSaving ? 'در حال ثبت…' : 'ثبت درخواست'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage modal */}
      <Modal
        isOpen={manageTarget !== null}
        onClose={() => setManageTarget(null)}
        title={`مدیریت جلسه — ${manageTarget?.studentName ?? ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleManage} className="space-y-4 text-right">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="زمان جلسه">
              <JalaliDateTimePicker value={manageScheduled} onChange={setManageScheduled} />
            </FormField>

            <FormField label="وضعیت">
              <select
                value={manageStatus}
                onChange={(e) => setManageStatus(e.target.value as typeof manageStatus)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              >
                <option value="requested">در انتظار زمان‌بندی</option>
                <option value="scheduled">زمان‌بندی‌شده</option>
                <option value="completed">برگزار شد</option>
                <option value="cancelled">لغو شد</option>
              </select>
            </FormField>
          </div>

          <FormField label="خلاصهٔ قابل اشتراک با دانش‌آموز و ولی">
            <textarea
              rows={3}
              value={manageSummary}
              onChange={(e) => setManageSummary(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="یادداشت محرمانهٔ مشاور (برای دانش‌آموز و ولی نمایش داده نمی‌شود)">
            <textarea
              rows={3}
              value={manageNotes}
              onChange={(e) => setManageNotes(e.target.value)}
              className="w-full text-xs p-2.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="برنامهٔ پیگیری">
            <textarea
              rows={2}
              value={manageFollowUp}
              onChange={(e) => setManageFollowUp(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setManageTarget(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'در حال ذخیره…' : 'ذخیرهٔ جلسه'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
