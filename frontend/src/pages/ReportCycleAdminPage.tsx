import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck, CheckCircle2, Eye, Loader2, Lock, Plus, RotateCcw,
  Send, Undo2, AlertTriangle, History,
} from 'lucide-react';
import {
  AccessDeniedGate, Badge, Button, Card, EmptyState, Modal, PageHeader,
} from '../components/common';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { toPersianDigits } from '../utils/persian';
import { formatJalaliDateTime } from '../utils/jalali';
import { jalaliMonth } from '../utils/jalali';
import {
  ApiReportCycleAdminService, ReportPeriod, ReportSubmission, SubmissionStatus,
  SUBMISSION_TONES,
} from '../api/reportCycle';

/**
 * پنل مدیر: سال و ماه را انتخاب می‌کند، دوره را باز می‌کند (برای همه یا برای
 * معلمان انتخابی)، مهلت ثبت می‌گذارد و سپس برای هر معلم جداگانه برمی‌گرداند،
 * تأیید می‌کند یا ثبت نهایی می‌کند. «تأیید» و «ثبت نهایی» دو دستور مستقل‌اند.
 */

interface DraftForm {
  academicYearId: string;
  month: string;
  title: string;
  dueAt: string;
}

const message = (e: unknown, fallback: string): string => (e instanceof ApiError ? e.firstError() : fallback);

export const ReportCycleAdminPage: React.FC = () => {
  const { hasAccess, activeRole } = useAuth();

  const canManage = hasAccess('report_periods:manage');
  const canReview = hasAccess('report_periods:review');
  const canFinalize = hasAccess('report_periods:finalize');
  const canReopen = hasAccess('report_periods:reopen');

  const [periods, setPeriods] = useState<ReportPeriod[]>([]);
  const [months, setMonths] = useState<Record<number, string>>({});
  const [years, setYears] = useState<{ id: number; title: string }[]>([]);
  const [teachers, setTeachers] = useState<{ ulid: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUlid, setSelectedUlid] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof ApiReportCycleAdminService.detail>> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [form, setForm] = useState<DraftForm>({ academicYearId: '', month: String(jalaliMonth()), title: '', dueAt: '' });
  const [creating, setCreating] = useState(false);
  const [openedFor, setOpenedFor] = useState<string[] | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const [review, setReview] = useState<ReportSubmission | null>(null);
  const [action, setAction] = useState<{ kind: 'return' | 'reopen'; submission: ReportSubmission } | null>(null);
  const [actionReason, setActionReason] = useState('');

  const reload = useCallback(async (keepSelected = true) => {
    setLoading(true);
    try {
      const r = await ApiReportCycleAdminService.periods();
      setPeriods(r.periods);
      setMonths(r.months);
      setYears(r.years);
      setSelectedUlid((current) => {
        if (!keepSelected) return null;
        return current && r.periods.some((p) => p.ulid === current) ? current : null;
      });
      setError(null);
    } catch (e) {
      setError(message(e, 'خطا در دریافت دوره‌های کارنامه'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManage && !hasAccess('report_periods:view')) return;
    reload();
    if (canManage) ApiReportCycleAdminService.teachers().then(setTeachers).catch(() => setTeachers([]));
  }, [canManage, hasAccess, reload]);

  useEffect(() => {
    if (selectedUlid === null) { setDetail(null); return; }
    setDetailLoading(true);
    ApiReportCycleAdminService.detail(selectedUlid)
      .then((d) => { setDetail(d); setError(null); })
      .catch((e) => setError(message(e, 'خطا در دریافت جزئیات دوره')))
      .finally(() => setDetailLoading(false));
  }, [selectedUlid]);

  const period = useMemo(() => periods.find((p) => p.ulid === selectedUlid) ?? null, [periods, selectedUlid]);

  const createPeriod = async () => {
    if (form.academicYearId === '' || form.month === '') {
      setNotice({ text: 'سال تحصیلی و ماه را انتخاب کنید.', error: true });
      return;
    }
    setCreating(true);
    try {
      const created = await ApiReportCycleAdminService.create({
        academicYearId: Number(form.academicYearId),
        month: Number(form.month),
        title: form.title.trim(),
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      });
      setNotice({ text: `دوره ${created.monthTitle} ساخته شد؛ اکنون آن را باز کنید.` });
      await reload();
      setSelectedUlid(created.ulid);
    } catch (e) {
      setNotice({ text: message(e, 'خطا در ایجاد دوره'), error: true });
    } finally {
      setCreating(false);
    }
  };

  const openPeriod = async (ulid: string, teacherUlids: string[]) => {
    setBusy('open-' + ulid);
    try {
      await ApiReportCycleAdminService.open(ulid, teacherUlids);
      setNotice({ text: 'دوره باز شد و برای معلمان انتخابی کارنامه ایجاد گردید.' });
      await reload();
    } catch (e) {
      setNotice({ text: message(e, 'خطا در باز کردن دوره'), error: true });
    } finally {
      setBusy(null);
      setOpenedFor(null);
    }
  };

  const runOnSubmission = async (
    submissionUlid: string,
    fn: () => Promise<unknown>,
    done: string,
  ) => {
    setBusy(submissionUlid);
    setNotice(null);
    try {
      await fn();
      setNotice({ text: done });
      const d = await ApiReportCycleAdminService.detail(selectedUlid!);
      setDetail(d);
      await reload();
    } catch (e) {
      setNotice({ text: message(e, 'خطا در انجام دستور'), error: true });
    } finally {
      setBusy(null);
    }
  };

  if (!canManage && !hasAccess('report_periods:view')) {
    return (
      <AccessDeniedGate
        title='عدم دسترسی به دوره کارنامه ماهانه'
        requiredRoleOrPermission='report_periods.view'
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="دوره کارنامه ماهانه"
        subtitle="باز کردن دوره توسط مدیر، بررسی کارنامه هر معلم و ثبت نهایی مستقل برای هر معلم"
      />

      {notice && (
        <div className={'flex items-center gap-2 text-xs rounded-xl border p-3 ' + (
          notice.error
            ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
            : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900'
        )}>
          {notice.error ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} {notice.text}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* ── create a period ── */}
      {canManage && (
        <Card className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Plus size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
            تعریف دوره کارنامه
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">سال تحصیلی</label>
              <select value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none">
                <option value="">— انتخاب کنید —</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">ماه (شمسی)</label>
              <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none">
                {Object.entries(months).map(([m, title]) => <option key={m} value={m}>{title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">عنوان (اختیاری)</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="کارنامه آبان"
                className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">مهلت ثبت (اختیاری)</label>
              <input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={createPeriod} loading={creating} icon={<CalendarCheck size={15} />}>
              ساخت دوره (پیش‌نویس)
            </Button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            تا وقتی دوره باز نشده، هیچ معلمی نمی‌تواند کارنامه‌ای ثبت کند؛ باز کردن دوره هم دستور جداگانه مدیر است.
          </p>
        </Card>
      )}

      {/* ── period list ── */}
      <Card className="overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">دوره‌های کارنامه</h3>
          <Button size="sm" variant="ghost" onClick={() => reload()}>بروزرسانی</Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-[#2457C5]" /></div>
        ) : periods.length === 0 ? (
          <EmptyState title="دوره‌ای تعریف نشده" description="برای اولین ماه، یک دوره کارنامه بسازید و آن را باز کنید." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-[#E8EDF5] dark:border-[#223147]">
                <th className="p-3 text-right font-medium">ماه</th>
                <th className="p-3 text-right font-medium">سال تحصیلی</th>
                <th className="p-3 text-center font-medium">وضعیت</th>
                <th className="p-3 text-center font-medium">مهلت</th>
                <th className="p-3 text-center font-medium">کارنامه معلمان</th>
                <th className="p-3 text-left font-medium">اقدام</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.ulid} className={'border-b border-[#F0F4FA] dark:border-[#182338] last:border-0 ' + (
                  p.ulid === selectedUlid ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''
                )}>
                  <td className="p-3 font-medium">
                    {p.monthTitle}{p.title ? <span className="text-xs text-slate-400 block">{p.title}</span> : null}
                  </td>
                  <td className="p-3 text-xs">{p.academicYear ?? '—'}</td>
                  <td className="p-3 text-center">
                    <Badge variant={p.status === 'open' ? 'success' : 'neutral'}>{p.statusTitle}</Badge>
                  </td>
                  <td className="p-3 text-center text-xs">{p.dueAt ? formatJalaliDateTime(p.dueAt) : '—'}</td>
                  <td className="p-3">
                    {p.stats && p.stats.total > 0 ? (
                      <div className="flex flex-wrap justify-center gap-1 text-[10px]">
                        <Badge variant="neutral">کل: {toPersianDigits(p.stats.total)}</Badge>
                        <Badge variant="neutral">در انتظار: {toPersianDigits(p.stats.open)}</Badge>
                        <Badge variant="primary">ارسال‌شده: {toPersianDigits(p.stats.submitted)}</Badge>
                        <Badge variant="danger">بازگشت: {toPersianDigits(p.stats.revision_required)}</Badge>
                        <Badge variant="warning">تأیید: {toPersianDigits(p.stats.approved)}</Badge>
                        <Badge variant="success">بایگانی: {toPersianDigits(p.stats.archived)}</Badge>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 block text-center">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      {canManage && p.status === 'draft' && (
                        openedFor === null ? (
                          <>
                            <Button size="sm" variant="primary" loading={busy === 'open-' + p.ulid}
                              onClick={() => openPeriod(p.ulid, [])}>
                              باز کردن برای همه
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setOpenedFor([p.ulid])}>
                              انتخاب معلمان
                            </Button>
                          </>
                        ) : openedFor[0] === p.ulid ? (
                          <Button size="sm" variant="ghost" onClick={() => setOpenedFor(null)}>انصراف</Button>
                        ) : null
                      )}
                      <Button size="sm" variant={p.ulid === selectedUlid ? 'primary' : 'secondary'}
                        icon={<Eye size={13} />} onClick={() => setSelectedUlid(p.ulid)}>
                        وضعیت معلمان
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ── teachers picker for one period ── */}
      {openedFor && period && (
        <Card className="space-y-3 border-[#2457C5]/40">
          <div className="text-sm font-semibold">باز کردن دوره {period.monthTitle} برای معلمان انتخابی</div>
          <div className="flex flex-wrap gap-2">
            {teachers.map((t) => {
              const on = openedFor.slice(1).includes(t.ulid);
              return (
                <button key={t.ulid} type="button"
                  onClick={() => setOpenedFor((prev) => {
                    if (prev === null) return prev;
                    const selected = prev.slice(1).includes(t.ulid)
                      ? prev.slice(1).filter((u) => u !== t.ulid)
                      : [...prev.slice(1), t.ulid];

                    return [prev[0], ...selected];
                  })}
                  className={'px-3 py-1.5 rounded-xl text-xs border transition-colors ' + (
                    on
                      ? 'bg-[#2457C5] text-white border-[#2457C5]'
                      : 'bg-white dark:bg-[#131C2E] text-slate-600 dark:text-slate-300 border-[#DCE3EE] dark:border-[#223147]'
                  )}>
                  {t.name}
                </button>
              );
            })}
          </div>
          {teachers.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">معلمی برای این مدرسه یافت نشد.</p>
          )}
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setOpenedFor(null)}>انصراف</Button>
            <Button size="sm" disabled={openedFor.length < 2} loading={busy === 'open-' + period.ulid}
              onClick={() => openPeriod(period.ulid, openedFor.slice(1))}>
              باز کردن برای {toPersianDigits(openedFor.length - 1)} معلم
            </Button>
          </div>
        </Card>
      )}

      {/* ── per-teacher board ── */}
      {selectedUlid && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Send size={15} className="text-[#2457C5] dark:text-[#8BAEFF]" />
              وضعیت کارنامه معلمان — {period?.monthTitle}
            </h3>
            {period?.status === 'draft' && <Badge variant="neutral">دوره هنوز باز نشده</Badge>}
          </div>

          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-[#2457C5]" /></div>
          ) : !detail || detail.submissions.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              با باز کردن دوره، برای هر معلم یک کارنامه ساخته می‌شود.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-[#E8EDF5] dark:border-[#223147]">
                    <th className="p-3 text-right font-medium">معلم</th>
                    <th className="p-3 text-center font-medium">وضعیت</th>
                    <th className="p-3 text-center font-medium">کارنامه‌های ثبت‌شده</th>
                    <th className="p-3 text-center font-medium">آخرین رویداد</th>
                    <th className="p-3 text-left font-medium">دستور مدیر</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.submissions.map((s) => (
                    <tr key={s.ulid} className="border-b border-[#F0F4FA] dark:border-[#182338] last:border-0 align-top">
                      <td className="p-3 font-medium">{s.teacherName}</td>
                      <td className="p-3 text-center">
                        <Badge variant={SUBMISSION_TONES[s.status] ?? 'neutral'}>{s.statusTitle}</Badge>
                        {s.returnNote && s.status === 'revision_required' && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 max-w-[16rem]">{s.returnNote}</p>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {toPersianDigits(s.entryCount)}
                        <button type="button" onClick={() => setReview(s)}
                          className="block mx-auto mt-1 text-[10px] text-[#2457C5] dark:text-[#8BAEFF] underline underline-offset-2">
                          مشاهده
                        </button>
                      </td>
                      <td className="p-3 text-center text-[11px] text-slate-500 dark:text-slate-400">
                        {s.archivedAt ? 'بایگانی: ' + formatJalaliDateTime(s.archivedAt)
                          : s.finalizedAt ? 'ثبت نهایی: ' + formatJalaliDateTime(s.finalizedAt)
                            : s.approvedAt ? 'تأیید: ' + formatJalaliDateTime(s.approvedAt)
                              : s.returnedAt ? 'بازگشت: ' + formatJalaliDateTime(s.returnedAt)
                                : s.submittedAt ? 'ارسال: ' + formatJalaliDateTime(s.submittedAt) : '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {canReview && s.status === 'submitted' && (
                            <>
                              <Button size="sm" variant="secondary" icon={<Undo2 size={13} />}
                                onClick={() => { setAction({ kind: 'return', submission: s }); setActionReason(''); }}>
                                برگشت برای اصلاح
                              </Button>
                              <Button size="sm" variant="primary" icon={<CheckCircle2 size={13} />}
                                loading={busy === s.ulid}
                                onClick={() => runOnSubmission(s.ulid, () => ApiReportCycleAdminService.approve(period!.ulid, s.ulid), `کارنامه ${s.teacherName} تأیید شد.`)}>
                                تأیید
                              </Button>
                            </>
                          )}
                          {canReview && s.status === 'approved' && (
                            <Button size="sm" variant="secondary" icon={<Undo2 size={13} />}
                              onClick={() => { setAction({ kind: 'return', submission: s }); setActionReason(''); }}>
                              برگشت
                            </Button>
                          )}
                          {canFinalize && s.status === 'approved' && (
                            <Button size="sm" variant="primary" icon={<Lock size={13} />}
                              loading={busy === s.ulid}
                              onClick={() => runOnSubmission(s.ulid,
                                () => ApiReportCycleAdminService.finalize(period!.ulid, s.ulid),
                                `کارنامه ${s.teacherName} ثبت نهایی و بایگانی شد.`)}>
                              ثبت نهایی و بایگانی
                            </Button>
                          )}
                          {canReopen && (s.status === 'archived' || s.status === 'finalized') && (
                            <Button size="sm" variant="outline" icon={<RotateCcw size={13} />}
                              onClick={() => { setAction({ kind: 'reopen', submission: s }); setActionReason(''); }}>
                              بازگشایی
                            </Button>
                          )}
                          {s.status === 'open' && <span className="text-[11px] text-slate-400">در انتظار ارسال معلم</span>}
                          {s.status === 'revision_required' && <span className="text-[11px] text-slate-400">در انتظار اصلاح معلم</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* trail */}
          <div className="pt-2 border-t border-[#E8EDF5] dark:border-[#223147]">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <History size={14} /> گردش کار این دوره
            </h4>
            {detail && detail.activity.length > 0 ? (
              <ul className="space-y-1.5 max-h-64 overflow-y-auto text-[11px]">
                {detail.activity.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">{formatJalaliDateTime(a.createdAt)}</span>
                    <Badge variant="neutral">{a.actionTitle}</Badge>
                    <span>{a.teacher ? `کارنامه ${a.teacher} — ` : ''}{a.actor}</span>
                    {a.reason && <span className="text-rose-600 dark:text-rose-400">دلیل: {a.reason}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-400">رویدادی ثبت نشده است.</p>
            )}
          </div>
        </Card>
      )}

      {/* ── read the teacher's cards ── */}
      <Modal isOpen={review !== null} onClose={() => setReview(null)}
        title={`کارنامه‌های ${review?.teacherName ?? ''} — ${review?.monthTitle ?? ''}`} maxWidth="2xl">
        {review ? (
          <SubmissionCards periodUlid={review.periodUlid} submissionUlid={review.ulid} />
        ) : null}
      </Modal>

      {/* ── return / reopen need a written reason ── */}
      <Modal isOpen={action !== null} onClose={() => setAction(null)}
        title={action?.kind === 'reopen' ? 'بازگشایی کارنامه بایگانی‌شده' : 'برگشت کارنامه برای اصلاح'} maxWidth="md">
        {action && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {action.kind === 'reopen'
                ? 'این دستور فقط با مجوز sh7 و با ذکر دلیل انجام می‌شود و در گردش کار ثبت می‌گردد.'
                : 'توضیح شما در پنل معلم نمایش داده می‌شود و قفل ارسال باز می‌گردد.'}
            </p>
            <textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} rows={4}
              placeholder={action.kind === 'reopen' ? 'دلیل بازگشایی…' : 'توضیح اصلاح…'}
              className="w-full px-3 py-2 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none resize-y" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAction(null)}>انصراف</Button>
              <Button size="sm" variant={action.kind === 'reopen' ? 'danger' : 'primary'}
                disabled={actionReason.trim().length < 3}
                loading={busy === action.submission.ulid}
                onClick={async () => {
                  const periodUlid = selectedUlid!;
                  const { kind, submission } = action;
                  await runOnSubmission(submission.ulid, () => (kind === 'reopen'
                    ? ApiReportCycleAdminService.reopen(periodUlid, submission.ulid, actionReason.trim())
                    : ApiReportCycleAdminService.returnForRevision(periodUlid, submission.ulid, actionReason.trim())),
                  kind === 'reopen' ? 'کارنامه بازگشایی و برای اصلاح باز شد.' : 'کارنامه برای اصلاح به معلم برگشت.');
                  setAction(null);
                }}>
                ثبت دستور
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {canManage === false && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          نقش شما فقط مشاهده است؛ باز کردن دوره، تأیید و ثبت نهایی با مدیر مدرسه انجام می‌شود.
        </p>
      )}
    </div>
  );
};

/** کارت‌های ثبت‌شده یک معلم، برای بررسی مدیر (فقط خواندنی). */
const SubmissionCards: React.FC<{ periodUlid: string; submissionUlid: string }> = ({ periodUlid, submissionUlid }) => {
  const [data, setData] = useState<ReportSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    ApiReportCycleAdminService.submission(periodUlid, submissionUlid)
      .then(setData)
      .catch((e) => setError(message(e, 'خطا در دریافت کارنامه‌ها')));
  }, [periodUlid, submissionUlid]);

  if (error) return <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>;
  if (!data) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#2457C5]" /></div>;

  if (!data.groups || data.groups.length === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">این معلم هنوز کارنامه‌ای ثبت نکرده است.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant={SUBMISSION_TONES[data.status] ?? 'neutral'}>{data.statusTitle}</Badge>
        {data.returnNote && <span className="text-rose-600 dark:text-rose-400">توضیح مدیر: {data.returnNote}</span>}
      </div>
      {data.groups.map((g) => (
        <div key={g.classroomSubjectId} className="space-y-2">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">{g.subject} — {g.classroom}</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-[#E8EDF5] dark:border-[#223147]">
                <th className="p-2 text-right font-medium">دانش‌آموز</th>
                <th className="p-2 text-center font-medium">نمره</th>
                <th className="p-2 text-center font-medium">ارزشیابی</th>
                <th className="p-2 text-right font-medium">توضیح معلم</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.studentUlid} className="border-b border-[#F0F4FA] dark:border-[#182338] last:border-0">
                  <td className="p-2">{r.studentName}</td>
                  <td className="p-2 text-center font-bold text-[#2457C5] dark:text-[#8BAEFF]">
                    {r.score === null ? '—' : `${toPersianDigits(r.score)} از ${toPersianDigits(r.maxScore ?? 20)}`}
                  </td>
                  <td className="p-2 text-center">{r.evaluation ?? '—'}</td>
                  <td className="p-2 text-slate-500 dark:text-slate-400">{r.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};
