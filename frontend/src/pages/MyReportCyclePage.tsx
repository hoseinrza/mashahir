import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardList, Loader2, Lock, Save, Send, Eye,
} from 'lucide-react';
import { AccessDeniedGate, Badge, Button, Card, EmptyState, PageHeader } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { toPersianDigits } from '../utils/persian';
import { formatJalaliDateTime } from '../utils/jalali';
import {
  ApiMyReportCycleService, EntryGroup, ReportSubmission, SUBMISSION_TONES,
} from '../api/reportCycle';

/**
 * میز کار معلم برای کارنامه ماهانه: فقط دوره‌هایی که مدیر باز کرده، فقط
 * دانش‌آموزان کلاس‌های خودش، و فقط تا لحظه ارسال. بعد از ارسال قفل است تا
 * مدیر برگرداند؛ بعد از ثبت نهایی کاملاً فقط‌خواندنی می‌شود.
 */

interface DraftLine {
  score: string;
  evaluation: string;
  notes: string;
}

type Drafts = Record<string, DraftLine>;

const lineKey = (groupId: number, studentUlid: string) => `${groupId}:${studentUlid}`;

const EVALUATIONS = ['خیلی‌خوب', 'خوب', 'قابل قبول', 'نیاز به تلاش'];

const message = (e: unknown, fallback: string): string => (e instanceof ApiError ? e.firstError() : fallback);

const toDrafts = (groups: EntryGroup[]): Drafts =>
  Object.fromEntries(groups.flatMap((g) => g.rows.map((r) => [
    lineKey(g.classroomSubjectId, r.studentUlid),
    {
      score: r.score === null ? '' : String(r.score),
      evaluation: r.evaluation ?? '',
      notes: r.notes ?? '',
    },
  ])));

export const MyReportCyclePage: React.FC = () => {
  const { hasAccess, activeRole } = useAuth();

  const canRecord = hasAccess('report_periods:record');
  const canView = hasAccess('report_periods:view');

  const [periods, setPeriods] = useState<ReportSubmission[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [submission, setSubmission] = useState<ReportSubmission | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const loadPeriods = useCallback(async () => {
    try {
      const list = await ApiMyReportCycleService.mine();
      setPeriods(list);
      setSelected((current) => {
        if (current && list.some((p) => p.ulid === current)) return current;
        const actionable = list.find((p) => p.editable);
        return (actionable ?? list[0])?.ulid ?? null;
      });
      setError(null);
    } catch (e) {
      setError(message(e, 'خطا در دریافت دوره‌های کارنامه'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    loadPeriods();
  }, [canView, loadPeriods]);

  const loadEntries = useCallback((ulid: string) => {
    setSubmission(null);
    ApiMyReportCycleService.entries(ulid)
      .then((s) => {
        setSubmission(s);
        setDrafts(toDrafts(s.groups ?? []));
        setError(null);
      })
      .catch((e) => setError(message(e, 'خطا در دریافت کارنامه‌ها')))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (selected) loadEntries(selected);
  }, [selected, loadEntries]);

  const active = useMemo(() => periods.find((p) => p.ulid === selected) ?? null, [periods, selected]);

  const dirty = useMemo(() => {
    if (!submission?.groups) return false;
    return submission.groups.some((g) => g.rows.some((r) => {
      const d = drafts[lineKey(g.classroomSubjectId, r.studentUlid)];
      return d.score !== (r.score === null ? '' : String(r.score))
        || d.evaluation !== (r.evaluation ?? '')
        || d.notes !== (r.notes ?? '');
    }));
  }, [submission, drafts]);

  const payload = useCallback(() => (submission?.groups ?? []).flatMap((g) => g.rows
    .map((r) => {
      const d = drafts[lineKey(g.classroomSubjectId, r.studentUlid)] ?? { score: '', evaluation: '', notes: '' };
      return {
        student_ulid: r.studentUlid,
        classroom_subject_id: g.classroomSubjectId,
        score: d.score.trim() === '' ? null : Number(d.score),
        max_score: r.maxScore ?? 20,
        evaluation: d.evaluation.trim() || null,
        notes: d.notes.trim() || null,
      };
    }), []), [submission, drafts]);

  const saveDraft = async () => {
    const lines = payload();
    if (lines.length === 0) return;

    const bad = lines.find((l) => l.score !== null && (!Number.isFinite(l.score) || l.score < 0 || l.score > l.max_score));
    if (bad) {
      setNotice({ text: `نمره باید عددی بین ۰ تا ${toPersianDigits(bad.max_score)} باشد.`, error: true });
      return;
    }

    setSaving(true);
    try {
      await ApiMyReportCycleService.save(submission!.ulid, lines);
      setNotice({ text: 'پیش‌نویس کارنامه ذخیره شد.' });
      loadEntries(submission!.ulid);
      await loadPeriods();
    } catch (e) {
      setNotice({ text: message(e, 'خطا در ذخیره'), error: true });
    } finally {
      setSaving(false);
    }
  };

  const submitToAdmin = async () => {
    setBusy(true);
    try {
      const lines = payload();
      if (lines.some((l) => l.score !== null || l.evaluation || l.notes)) {
        await ApiMyReportCycleService.save(submission!.ulid, lines);
      }
      await ApiMyReportCycleService.submit(submission!.ulid);
      setNotice({ text: 'کارنامه برای بررسی مدیر ارسال شد؛ تا بازگشت مدیر قابل ویرایش نیست.' });
      loadEntries(submission!.ulid);
      await loadPeriods();
    } catch (e) {
      setNotice({ text: message(e, 'خطا در ارسال'), error: true });
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return (
      <AccessDeniedGate
        title='عدم دسترسی به کارنامه ماهانه'
        requiredRoleOrPermission='report_periods.record'
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const editable = !!submission?.editable && canRecord;
  const readOnly = submission !== null && !editable;

  return (
    <div className="space-y-6">
      <PageHeader
        title="کارنامه ماهانه من"
        subtitle="ثبت، ارسال و اصلاح کارنامه دانش‌آموزان کلاس‌های خودتان، طبق دوره‌ای که مدیر باز کرده است"
      />

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {notice && (
        <div className={'flex items-center gap-2 text-xs rounded-xl border p-3 ' + (
          notice.error
            ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
            : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900'
        )}>
          {notice.error ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} {notice.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={26} className="animate-spin text-[#2457C5]" /></div>
      ) : periods.length === 0 ? (
        <EmptyState
          title="دوره بازکاری وجود ندارد"
          description="تا مدیر دوره کارنامه این ماه را باز نکند، امکان ثبت کارنامه وجود ندارد."
          icon={<ClipboardList size={24} />}
        />
      ) : (
        <>
          <Card className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">دوره فعال</label>
              <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none">
                {periods.map((p) => (
                  <option key={p.ulid} value={p.ulid}>
                    {p.monthTitle} — {p.academicYear ?? ''} ({p.statusTitle})
                  </option>
                ))}
              </select>
            </div>
            {active && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={SUBMISSION_TONES[active.status] ?? 'neutral'}>{active.statusTitle}</Badge>
                {active.dueAt && (
                  <Badge variant="warning">مهلت: {formatJalaliDateTime(active.dueAt)}</Badge>
                )}
              </div>
            )}
          </Card>

          {/* where this submission stands */}
          {submission && (
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={SUBMISSION_TONES[submission.status] ?? 'neutral'}>{submission.statusTitle}</Badge>
                <Badge variant="neutral">{toPersianDigits(submission.entryCount)} کارنامه ثبت‌شده</Badge>
                {submission.submittedAt && <span className="text-slate-500 dark:text-slate-400">ارسال: {formatJalaliDateTime(submission.submittedAt)}</span>}
                {submission.approvedAt && <span className="text-slate-500 dark:text-slate-400">تأیید مدیر: {formatJalaliDateTime(submission.approvedAt)}</span>}
                {submission.finalizedAt && <span className="text-slate-500 dark:text-slate-400">ثبت نهایی: {formatJalaliDateTime(submission.finalizedAt)}</span>}
                {submission.archivedAt && <span className="text-slate-500 dark:text-slate-400">بایگانی: {formatJalaliDateTime(submission.archivedAt)}</span>}
              </div>

              {submission.returnNote && (
                <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="font-semibold text-amber-800 dark:text-amber-300">توضیح مدیر برای اصلاح: </span>
                    <span className="text-amber-800 dark:text-amber-300">{submission.returnNote}</span>
                    {submission.reopenReason && (
                      <p className="mt-1 text-[11px]">دلیل بازگشایی پس از ثبت نهایی: {submission.reopenReason}</p>
                    )}
                  </div>
                </div>
              )}

              {readOnly && (
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-[#DCE3EE] dark:border-[#223147] rounded-xl p-3">
                  <Lock size={14} />
                  {submission.locked
                    ? 'این کارنامه ثبت نهایی و بایگانی شده است؛ فقط قابل مشاهده است.'
                    : 'کارنامه ارسال شده و تا زمانی که مدیر آن را برای اصلاح برنگرداند، قابل ویرایش نیست.'}
                </div>
              )}

              {submission.periodStatus === 'draft' && (
                <p className="text-xs text-rose-600 dark:text-rose-400">مدیر دوره را بسته است؛ ثبت متوقف شده است.</p>
              )}
            </Card>
          )}

          {!submission ? (
            <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-[#2457C5]" /></div>
          ) : (submission.groups ?? []).length === 0 ? (
            <EmptyState title="کلاسی در اختیار شما نیست"
              description="برای این دوره، درس-کلاسی با دانش‌آموز فعال به شما تخصیص داده نشده است." />
          ) : (
            <>
              {(submission.groups ?? []).map((g) => (
                <Card key={g.classroomSubjectId} className="overflow-x-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{g.subject} — {g.classroom}</h3>
                    <Badge variant="neutral">{toPersianDigits(g.rows.length)} دانش‌آموز</Badge>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-[#E8EDF5] dark:border-[#223147]">
                        <th className="p-3 text-right font-medium">دانش‌آموز</th>
                        <th className="p-3 text-center font-medium">نمره از ۲۰</th>
                        <th className="p-3 text-center font-medium">ارزشیابی</th>
                        <th className="p-3 text-right font-medium">توضیح برای خانواده</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r) => {
                        const key = lineKey(g.classroomSubjectId, r.studentUlid);
                        const d = drafts[key] ?? { score: '', evaluation: '', notes: '' };
                        const set = (patch: Partial<DraftLine>) => setDrafts((prev) => ({
                          ...prev, [key]: { ...d, ...patch },
                        }));

                        return (
                          <tr key={r.studentUlid} className="border-b border-[#F0F4FA] dark:border-[#182338] last:border-0">
                            <td className="p-3 font-medium">{r.studentName}</td>
                            <td className="p-3">
                              <input type="number" min={0} max={r.maxScore ?? 20} inputMode="numeric"
                                disabled={!editable} value={d.score}
                                onChange={(e) => set({ score: e.target.value })}
                                placeholder="—"
                                className="w-24 h-9 mx-auto block px-2 text-center rounded-lg border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none focus:ring-2 focus:ring-[#2457C5]/40 disabled:opacity-60" />
                            </td>
                            <td className="p-3">
                              <select disabled={!editable} value={d.evaluation}
                                onChange={(e) => set({ evaluation: e.target.value })}
                                className="w-full h-9 px-2 rounded-lg border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-xs outline-none disabled:opacity-60">
                                <option value="">—</option>
                                {EVALUATIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </td>
                            <td className="p-3">
                              {editable ? (
                                <input value={d.notes} onChange={(e) => set({ notes: e.target.value })}
                                  placeholder="توضیح کوتاه…"
                                  className="w-full h-9 px-2 rounded-lg border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-xs outline-none focus:ring-2 focus:ring-[#2457C5]/40" />
                              ) : (
                                <span className="text-xs text-slate-600 dark:text-slate-300">{r.notes ?? '—'}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              ))}

              <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                  «ذخیره پیش‌نویس» کارنامه را باز می‌گذارد و مدیر چیزی نمی‌بیند. «ارسال برای بررسی» قفل می‌کند؛
                  برای ویرایش دوباره باید مدیر کارنامه را برگرداند.
                </p>
                <div className="flex items-center gap-2">
                  {editable && (
                    <>
                      <Button variant="outline" disabled={!dirty} loading={saving}
                        onClick={saveDraft} icon={<Save size={14} />}>
                        ذخیره پیش‌نویس
                      </Button>
                      <Button variant="primary" disabled={submission.entryCount === 0} loading={busy}
                        onClick={submitToAdmin} icon={<Send size={14} />}>
                        ارسال برای بررسی مدیر
                      </Button>
                    </>
                  )}
                  {!editable && (
                    <Badge variant="neutral" className="gap-1.5">
                      <Eye size={13} /> فقط خواندنی
                    </Badge>
                  )}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
};
