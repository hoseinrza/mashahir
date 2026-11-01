import React, { useEffect, useRef, useState } from 'react';
import { Clock, Send, Loader2, AlertTriangle, CheckCircle2, Flag, Paperclip, FileText, Image as ImageIcon, X } from 'lucide-react';
import { Card, Button, Badge, PageHeader } from '../components/common';
import { toPersianDigits } from '../utils/persian';
import { formatJalaliDateTime } from '../utils/jalali';
import { api, ApiError } from '../api/client';
import { uploadFile, fileObjectUrl, validateUpload, isImage, formatSize, FileAttachment } from '../api/files';

/**
 * آزمون‌دهی واقعی دانش‌آموز: شروع نشست، ذخیره خودکار نسخه‌ای، تایمر سرور،
 * ارسال نهایی — و نمایش نمره فقط طبق result_visibility هر آزمون (ش۶).
 * پاسخ سؤال تشریحی می‌تواند تصویر یا PDF برگه دست‌نویس باشد.
 */

interface ExamRow {
  ulid: string;
  title: string;
  subject: string | null;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  status: string;
  result_visibility: string;
  my_attempt_status?: string | null;
}

interface ExamFull {
  ulid: string;
  title: string;
  duration_minutes: number;
  questions: { id: number; type: 'mcq' | 'descriptive'; body: string; points: number; options: { id: number; body: string }[] }[];
}

interface AttemptInfo {
  attempt_id: number;
  server_deadline: string;
}

interface AnswerOutcome {
  question_id: number;
  correct: boolean | null;
  descriptive_score: number | null;
  comment: string | null;
  file: FileAttachment | null;
}

interface ExamResultView {
  title: string;
  visible: boolean;
  auto_score: number | null;
  questions: ExamFull['questions'];
  answers: AnswerOutcome[];
}

export const StudentExamsPage: React.FC = () => {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeExam, setActiveExam] = useState<ExamFull | null>(null);
  const [attempt, setAttempt] = useState<AttemptInfo | null>(null);
  const [answers, setAnswers] = useState<Record<number, { option_id: number | null; text: string | null; file: FileAttachment | null; version: number; saved: boolean }>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const loadExams = () => {
    setLoading(true);
    api<{ data: ExamRow[] }>('/v1/exams')
      .then((r) => setExams((r.data ?? []).filter((e) => e.status === 'published')))
      .catch((e) => setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت آزمون‌ها'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadExams(); }, []);

  // Server-clock countdown
  useEffect(() => {
    if (deadline === null) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);

  const startExam = async (ulid: string) => {
    setError(null);
    try {
      const full = await api<ExamFull>(`/v1/exams/${ulid}`);
      const a = await api<AttemptInfo>(`/v1/exams/${ulid}/start`, { method: 'POST' });
      setActiveExam(full);
      setAttempt(a);
      setDeadline(new Date(a.server_deadline).getTime());
      setNowTick(Date.now());
      setAnswers({});
      setResult(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در شروع آزمون');
    }
  };

  const saveAnswer = (questionId: number, patch: { option_id?: number | null; text?: string | null; file?: FileAttachment | null; flagged?: boolean }) => {
    if (!attempt) return;
    const current = answers[questionId] ?? { option_id: null, text: null, file: null, version: 0, saved: false };
    const next = {
      option_id: patch.option_id !== undefined ? patch.option_id : current.option_id,
      text: patch.text !== undefined ? patch.text : current.text,
      file: patch.file !== undefined ? patch.file : current.file,
      version: current.version + 1,
      saved: false,
    };
    setAnswers((prev) => ({ ...prev, [questionId]: next }));

    // Debounced autosave; the server confirms honestly (ذخیره شد فقط پس از تأیید).
    clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => {
      api<{ accepted: boolean; version: number }>(`/v1/exams/attempts/${attempt.attempt_id}/answers`, {
        method: 'POST',
        body: {
          question_id: questionId,
          option_id: next.option_id,
          text: next.text,
          ...(next.file
            ? { file_ulid: next.file.ulid }
            : current.file ? { remove_file: true } : {}),
          version: next.version,
        },
      })
        .then((r) => {
          setAnswers((prev) => ({ ...prev, [questionId]: { ...next, version: r.version, saved: true } }));
        })
        .catch(() => {
          setAnswers((prev) => ({ ...prev, [questionId]: { ...next, saved: false } }));
        });
    }, 900);
  };

  /** Upload the handwritten sheet (image/PDF) and attach it to a descriptive answer. */
  const attachAnswerFile = async (questionId: number, file: File) => {
    const err = validateUpload(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    try {
      const attachment = await uploadFile(file);
      setAnswers((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] ?? { option_id: null, text: null, version: 0, saved: false }), file: attachment, saved: false } }));
      saveAnswer(questionId, { file: attachment });
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در آپلود فایل پاسخ');
    }
  };

  const previewAnswerFile = async (questionId: number) => {
    const f = answers[questionId]?.file;
    if (!f) return;
    try {
      const url = await fileObjectUrl(f.ulid);
      window.open(url, '_blank');
    } catch {
      setError('خطا در نمایش فایل');
    }
  };

  /** Read a submitted paper back: auto score plus the corrected descriptive answers. */
  const openResult = async (ulid: string, title: string) => {
    setError(null);
    try {
      const [full, r] = await Promise.all([
        api<ExamFull>(`/v1/exams/${ulid}`),
        api<{ visible: boolean; auto_score: number | null; answers?: AnswerOutcome[] }>(`/v1/exams/${ulid}/result`),
      ]);
      setResult({
        title,
        visible: r.visible,
        auto_score: r.auto_score ?? null,
        questions: r.visible ? (full.questions ?? []) : [],
        answers: r.visible ? (r.answers ?? []) : [],
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت نتیجه');
    }
  };

  const submitExam = async () => {
    if (!attempt || !activeExam) return;
    setSubmitting(true);
    try {
      await api(`/v1/exams/attempts/${attempt.attempt_id}/submit`, { method: 'POST' });
      setActiveExam(null);
      setAttempt(null);
      setDeadline(null);
      await openResult(activeExam.ulid, activeExam.title);
      loadExams();
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در ارسال');
    } finally {
      setSubmitting(false);
    }
  };

  const secondsLeft = deadline !== null ? Math.max(0, Math.floor((deadline - nowTick) / 1000)) : null;
  const expired = secondsLeft !== null && secondsLeft <= 0;

  // ── Taking view ──────────────────────────────────────────────────────
  if (activeExam && attempt) {
    const mm = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
    const ss = secondsLeft !== null ? secondsLeft % 60 : 0;

    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">{activeExam.title}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {toPersianDigits(activeExam.questions.length)} سؤال — ذخیره خودکار فعال است
            </p>
          </div>
          <div className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-sm',
            expired ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              : secondsLeft !== null && secondsLeft < 120 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
          )}>
            <Clock size={15} />
            {expired ? 'زمان به پایان رسید' : `${toPersianDigits(mm)}:${toPersianDigits(String(ss).padStart(2, '0'))}`}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div className="space-y-4">
          {activeExam.questions.map((q, qi) => {
            const st = answers[q.id];
            return (
              <Card key={q.id} className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">{q.type === 'mcq' ? 'تستی' : 'تشریحی'}</Badge>
                    <span className="text-xs text-slate-500">بارم: {toPersianDigits(q.points)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {st?.saved ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12} /> ذخیره شد</span>
                    ) : st ? (
                      <span className="text-amber-600 dark:text-amber-400">در حال ذخیره...</span>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm font-medium">{toPersianDigits(qi + 1)}. {q.body}</p>

                {q.type === 'mcq' ? (
                  <div className="space-y-2">
                    {q.options.map((o) => (
                      <label key={o.id} className={cn(
                        'flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-sm transition-colors',
                        st?.option_id === o.id
                          ? 'border-[#2457C5] bg-[#2457C5]/5 dark:border-[#8BAEFF] dark:bg-[#8BAEFF]/10'
                          : 'border-[#DCE3EE] dark:border-[#223147] hover:border-[#2457C5]/50',
                      )}>
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={st?.option_id === o.id}
                          disabled={expired}
                          onChange={() => saveAnswer(q.id, { option_id: o.id })}
                          className="accent-[#2457C5]"
                        />
                        {o.body}
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={st?.text ?? ''}
                      disabled={expired}
                      onChange={(e) => saveAnswer(q.id, { text: e.target.value })}
                      rows={4}
                      placeholder="پاسخ تشریحی خود را بنویسید یا برگه دست‌نویس را به‌صورت تصویر/PDF پیوست کنید..."
                      className="w-full p-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none focus:ring-2 focus:ring-[#2457C5]/40 disabled:opacity-60"
                    />

                    {/* Answer sheet as image/PDF (فایل منیجر سمت سرور اعتبارسنجی می‌کند) */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {st?.file ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-[11px] text-emerald-700 dark:text-emerald-300">
                          {isImage(st.file.mime) ? <ImageIcon size={12} /> : <FileText size={12} />}
                          <button type="button" onClick={() => previewAnswerFile(q.id)} className="underline cursor-pointer max-w-[180px] truncate">
                            {st.file.original_name}
                          </button>
                          <span className="opacity-70">({formatSize(st.file.size)})</span>
                          {!expired && (
                            <button
                              type="button"
                              onClick={() => saveAnswer(q.id, { file: null })}
                              className="text-rose-500 hover:text-rose-600 cursor-pointer"
                              aria-label="حذف پیوست"
                            >
                              <X size={12} />
                            </button>
                          )}
                          {st.saved ? <CheckCircle2 size={12} /> : <Loader2 size={12} className="animate-spin" />}
                        </span>
                      ) : (
                        <label className={cn(
                          'flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-dashed cursor-pointer transition-colors',
                          expired
                            ? 'opacity-50 cursor-not-allowed border-slate-300 text-slate-400'
                            : 'border-[#2457C5]/40 text-[#2457C5] dark:text-[#8BAEFF] hover:bg-[#2457C5]/5',
                        )}>
                          <Paperclip size={12} />
                          پیوست تصویر/PDF پاسخ
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="hidden"
                            disabled={expired}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) attachAnswerFile(q.id, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button onClick={submitExam} disabled={submitting || expired} icon={submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}>
            تأیید و پایان آزمون
          </Button>
        </div>
      </div>
    );
  }

  // ── Result view ──────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto mt-4">
        <Card className="p-8 text-center space-y-4">
          <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
          <h2 className="text-lg font-black">{result.title}</h2>
          {result.visible ? (
            <p className="text-sm">
              {result.questions.some((q) => q.type === 'mcq') ? (
                <>
                  نمره تستی شما: <b className="font-mono text-lg">{toPersianDigits(result.auto_score ?? 0)}</b>
                  <span className="text-xs text-slate-500 block mt-1">سؤالات تشریحی پس از تصحیح معلم اضافه می‌شود.</span>
                </>
              ) : (
                <>
                  نمرهٔ این آزمون پس از تصحیح سؤالات تشریحی اعلام می‌شود.
                  <span className="text-xs text-slate-500 block mt-1">نمرهٔ تستی برای این آزمون محاسبه نشده است.</span>
                </>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-500">نمره طبق تنظیم معلم پس از تصحیح نمایش داده می‌شود.</p>
          )}
          <Button variant="outline" onClick={() => { setResult(null); loadExams(); }}>بازگشت به فهرست آزمون‌ها</Button>
        </Card>

        {result.visible && result.questions.length > 0 && (
          <div className="space-y-3">
            {result.questions.map((q, qi) => {
              const out = result.answers.find((a) => a.question_id === q.id);
              return (
                <Card key={q.id} className="p-5 space-y-2 text-right">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{toPersianDigits(qi + 1)}. {q.body}</p>
                    <Badge variant="neutral">{q.type === 'mcq' ? 'تستی' : 'تشریحی'}</Badge>
                  </div>
                  {q.type === 'mcq' ? (
                    out?.correct === null || out?.correct === undefined ? (
                      <span className="text-xs text-slate-500">وضعیت تصحیح مشخص نیست.</span>
                    ) : (
                      <span className={cn('text-xs font-bold', out.correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                        {out.correct ? 'پاسخ درست' : 'پاسخ نادرست'}
                      </span>
                    )
                  ) : out?.descriptive_score === null || out?.descriptive_score === undefined ? (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">هنوز تصحیح نشده است.</span>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                        نمره: {toPersianDigits(out.descriptive_score)} از {toPersianDigits(q.points)}
                      </span>
                      {out.comment && (
                        <p className="text-xs text-[#526176] dark:text-[#B3C0D2] bg-[#F7F9FC] dark:bg-[#101722]/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
                          بازخورد دبیر: {out.comment}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="آزمون‌های آنلاین من"
        subtitle="شرکت در آزمون‌های منتشرشده — با هر بار ورود، ادامهٔ همان نشست باز می‌شود"
      />

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={26} className="animate-spin text-[#2457C5]" /></div>
      ) : exams.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">در حال حاضر آزمون منتشرشده‌ای برای شما وجود ندارد.</Card>
      ) : (
        <div className="grid gap-4">
          {exams.map((e) => {
            const open = new Date(e.opens_at) <= new Date() && new Date(e.closes_at) >= new Date();
            const taken = e.my_attempt_status === 'submitted';
            const resuming = e.my_attempt_status === 'in_progress';
            return (
              <Card key={e.ulid} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold">{e.title}</h3>
                    {e.subject && <Badge variant="neutral">{e.subject}</Badge>}
                    {taken && <Badge variant="success">برگه ارسال شده</Badge>}
                    {resuming && <Badge variant="warning">نشست باز</Badge>}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
                    <span>شروع: {formatJalaliDateTime(e.opens_at)}</span>
                    <span>پایان: {formatJalaliDateTime(e.closes_at)}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {toPersianDigits(e.duration_minutes)} دقیقه</span>
                  </div>
                </div>
                {taken ? (
                  <Button onClick={() => openResult(e.ulid, e.title)} variant="outline" icon={<CheckCircle2 size={13} />}>
                    مشاهده نتیجه
                  </Button>
                ) : (
                  <Button
                    onClick={() => startExam(e.ulid)}
                    disabled={!open}
                    variant={open ? 'primary' : 'outline'}
                    icon={<Send size={13} />}
                  >
                    {resuming ? 'ادامه آزمون' : open ? 'شروع آزمون' : 'خارج از بازه'}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
