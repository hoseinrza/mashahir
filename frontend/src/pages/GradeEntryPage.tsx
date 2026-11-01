import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Loader2, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, Button, Badge, PageHeader } from '../components/common';
import { toPersianDigits } from '../utils/persian';
import { api, ApiError } from '../api/client';

/**
 * ثبت نمره نهایی حضوری دانش‌آموزان از ۲۰ برای درس-کلاس‌های معلم، همراه با
 * لیست نمرات ثبت‌شده و میانگین مقیاس‌شده هر دانش‌آموز از ۲۰. نمره ثبت‌شده
 * پیش‌نویس است؛ تأیید و انتشار با معاون/مدیر طبق چرخه‌ی ش۶ انجام می‌شود.
 */

interface GradeItemRow {
  id: number;
  status: 'draft' | 'approved' | 'published';
  score: number;
  max_score: number;
  delivery: 'in_person' | 'online';
  source_type: string;
}

interface RosterRow {
  student_ulid: string;
  student_name: string;
  avg_out_of_20: number | null;
  final_in_person: { id: number; status: string; score: number; max_score: number } | null;
  items: GradeItemRow[];
}

interface RosterResponse {
  subject: string | null;
  classroom: string | null;
  teacher: string | null;
  term_id: number;
  class_avg_out_of_20: number | null;
  data: RosterRow[];
}

const STATUS_META: Record<string, { label: string; variant: 'neutral' | 'success' | 'warning' | 'primary' }> = {
  draft: { label: 'پیش‌نویس', variant: 'warning' },
  approved: { label: 'تأییدشده', variant: 'primary' },
  published: { label: 'منتشرشده', variant: 'success' },
};

const SOURCE_LABEL: Record<string, string> = {
  in_person_exam: 'آزمون حضوری',
  exam: 'آزمون',
  assignment: 'تکلیف',
  manual: 'دستی',
};

const formatAvg = (v: number | null | undefined): string =>
  v === null || v === undefined ? '—' : toPersianDigits(v % 1 === 0 ? v : v.toFixed(2));

export const GradeEntryPage: React.FC = () => {
  const [subjects, setSubjects] = useState<{ id: number; label: string }[]>([]);
  const [terms, setTerms] = useState<{ id: number; title: string }[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [termId, setTermId] = useState<number | null>(null);

  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, string>>({});
  const [savingStudent, setSavingStudent] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<{ key: string; text: string; error?: boolean } | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ data: { id: number; subject: string; classroom: string; teacher?: string | null }[] }>('/v1/academic/my-subjects'),
      api<{ data: { id: number; title: string }[] }>('/v1/academic/terms'),
    ])
      .then(([s, t]) => {
        setSubjects((s.data ?? []).map((x) => ({
          id: x.id,
          label: x.subject + ' — ' + x.classroom + (x.teacher ? ' — ' + x.teacher : ''),
        })));
        setTerms(t.data ?? []);
        setSubjectId(s.data?.[0]?.id ?? null);
        setTermId(t.data?.[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت درس‌ها و ترم‌ها'))
      .finally(() => setLoading(false));
  }, []);

  const loadRoster = useCallback(() => {
    if (subjectId === null) return;
    setLoading(true);
    setRowMessage(null);
    const query = new URLSearchParams({ classroom_subject_id: String(subjectId) });
    if (termId !== null) query.set('term_id', String(termId));
    api<RosterResponse>('/v1/grades/roster?' + query.toString())
      .then((r) => {
        setRoster(r);
        setScores(Object.fromEntries(
          (r.data ?? [])
            .filter((row) => row.final_in_person && row.final_in_person.status === 'draft')
            .map((row) => [row.student_ulid, String(row.final_in_person!.score)]),
        ));
      })
      .catch((e) => setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت لیست کلاس'))
      .finally(() => setLoading(false));
  }, [subjectId, termId]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  const saveFinal = async (row: RosterRow) => {
    // store() requires term_id; without a term the teacher would only see a
    // validation error that names a field they never chose.
    if (termId === null) {
      setRowMessage({ key: row.student_ulid, text: 'هنوز دوره تحصیلی تعریف نشده است؛ برای ثبت نمره دست‌کم یک دوره لازم است.', error: true });
      return;
    }

    const raw = scores[row.student_ulid]?.trim() ?? '';
    const score = Number(raw);
    if (raw === '' || !Number.isFinite(score) || score < 0 || score > 20) {
      setRowMessage({ key: row.student_ulid, text: 'نمره باید عددی بین ۰ تا ۲۰ باشد.', error: true });
      return;
    }

    setSavingStudent(row.student_ulid);
    setRowMessage(null);
    try {
      const final = row.final_in_person;
      if (final && final.status === 'draft') {
        await api('/v1/grades/' + final.id, { method: 'PATCH', body: { score: Math.round(score) } });
      } else {
        await api('/v1/grades', {
          method: 'POST',
          body: {
            student_ulid: row.student_ulid,
            classroom_subject_id: subjectId,
            term_id: termId,
            score: Math.round(score),
            max_score: 20,
            source_type: 'in_person_exam',
            delivery: 'in_person',
          },
        });
      }
      setRowMessage({ key: row.student_ulid, text: 'ثبت شد (پیش‌نویس — در انتظار تأیید معاون).' });
      loadRoster();
    } catch (e) {
      setRowMessage({ key: row.student_ulid, text: e instanceof ApiError ? e.firstError() : 'خطا در ثبت نمره', error: true });
    } finally {
      setSavingStudent(null);
    }
  };

  const subjectLabel = useMemo(
    () => subjects.find((s) => s.id === subjectId)?.label ?? '',
    [subjects, subjectId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="ثبت نمرات کلاس"
        subtitle="ورود نمره نهایی حضوری از ۲۰ و مشاهده میانگین نمرات هر دانش‌آموز"
      />

      <Card className="p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">درس و کلاس</label>
          <select value={subjectId ?? ''} onChange={(e) => setSubjectId(Number(e.target.value))}
            className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none">
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">ترم تحصیلی</label>
          <select value={termId ?? ''} onChange={(e) => setTermId(Number(e.target.value))}
            className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none">
            {terms.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
        <Button variant="outline" onClick={loadRoster} icon={<RefreshCw size={14} />}>به‌روزرسانی</Button>
      </Card>

      {roster && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="primary">میانگین کلاس از ۲۰: {formatAvg(roster.class_avg_out_of_20)}</Badge>
          <Badge variant="neutral">{toPersianDigits(roster.data.length)} دانش‌آموز</Badge>
          {roster.teacher && <Badge variant="neutral">معلم: {roster.teacher}</Badge>}
          <span className="text-slate-500 dark:text-slate-400">{subjectLabel}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={26} className="animate-spin text-[#2457C5]" /></div>
      ) : !roster || roster.data.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          دانش‌آموز فعالی در این کلاس نیست.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-[#E8EDF5] dark:border-[#223147]">
                <th className="p-3 text-right font-medium">#</th>
                <th className="p-3 text-right font-medium">دانش‌آموز</th>
                <th className="p-3 text-right font-medium">نمرات ثبت‌شده</th>
                <th className="p-3 text-center font-medium">میانگین از ۲۰</th>
                <th className="p-3 text-center font-medium">نمره نهایی حضوری</th>
              </tr>
            </thead>
            <tbody>
              {roster.data.map((row, i) => {
                const final = row.final_in_person;
                const locked = !!final && final.status !== 'draft';
                const meta = final ? STATUS_META[final.status] : null;
                return (
                  <tr key={row.student_ulid} className="border-b border-[#F0F4FA] dark:border-[#182338] last:border-0">
                    <td className="p-3 text-slate-400">{toPersianDigits(i + 1)}</td>
                    <td className="p-3 font-medium">{row.student_name}</td>
                    <td className="p-3">
                      {row.items.length === 0 ? (
                        <span className="text-xs text-slate-400">نمره‌ای ثبت نشده</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {row.items.map((it) => (
                            <Badge key={it.id} variant={STATUS_META[it.status]?.variant ?? 'neutral'}>
                              {SOURCE_LABEL[it.source_type] ?? it.source_type}: {toPersianDigits(it.score)}/{toPersianDigits(it.max_score)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold text-[#2457C5] dark:text-[#8BAEFF]">{formatAvg(row.avg_out_of_20)}</td>
                    <td className="p-3">
                      {locked ? (
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant={meta?.variant ?? 'neutral'}>
                            {toPersianDigits(final!.score)} از {toPersianDigits(final!.max_score)} — {meta?.label}
                          </Badge>
                          <span className="text-[10px] text-slate-400">تغییر فقط با معاون/مدیر</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number" min={0} max={20} inputMode="numeric"
                            placeholder="از ۲۰"
                            value={scores[row.student_ulid] ?? ''}
                            onChange={(e) => setScores((prev) => ({ ...prev, [row.student_ulid]: e.target.value }))}
                            className="w-20 h-9 px-2 text-center rounded-lg border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none focus:ring-2 focus:ring-[#2457C5]/40"
                          />
                          <Button size="sm" variant="primary"
                            disabled={savingStudent === row.student_ulid}
                            onClick={() => saveFinal(row)}
                            icon={savingStudent === row.student_ulid ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}>
                            {final ? 'ویرایش' : 'ثبت'}
                          </Button>
                        </div>
                      )}
                      {rowMessage?.key === row.student_ulid && (
                        <p className={'text-[10px] mt-1 text-center ' + (rowMessage.error ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
                          {rowMessage.text}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <Award size={13} className="shrink-0 mt-0.5" />
        <p>
          نمره ثبت‌شده به‌صورت پیش‌نویس ذخیره می‌شود؛ پس از تأیید معاون آموزشی و انتشار، در کارنامه حضوری
          دانش‌آموز می‌نشیند. نمره تأییدشده برای تغییر به معاون/مدیر برمی‌گردد.
        </p>
      </div>
    </div>
  );
};
