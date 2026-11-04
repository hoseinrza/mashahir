import React, { useEffect, useState } from 'react';
import {
  FileText, Plus, Send, Edit3, BarChart3, Clock,
  Loader2, AlertTriangle, CheckCircle2, X, Image as ImageIcon
} from 'lucide-react';
import { Card, Button, Badge, Modal, FormField, PageHeader, SearchInput } from '../components/common';
import { JalaliDateTimePicker } from '../components/common/JalaliDatePicker';
import { toPersianDigits, cn } from '../utils/persian';
import { formatJalaliDateTime, jalaliPreview } from '../utils/jalali';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';
import { fileObjectUrl, isImage, formatSize, FileAttachment } from '../api/files';

/**
 * Teacher/staff exam MANAGEMENT: design (draft), publish, results.
 * The exam-TAKING experience for students lives in OnlineExamPage.
 */

interface ExamQuestionDraft {
  type: 'mcq' | 'descriptive';
  body: string;
  points: number;
  options: string[];
  correct_position: number;
}

interface ExamRow {
  ulid: string;
  title: string;
  subject: string | null;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  status: 'draft' | 'published' | 'closed';
  result_visibility: 'immediately' | 'after_grading' | 'manual';
}

const STATUS_BADGE: Record<string, { label: string; variant: 'neutral' | 'success' | 'warning' }> = {
  draft: { label: 'پیش‌نویس', variant: 'warning' },
  published: { label: 'منتشرشده', variant: 'success' },
  closed: { label: 'بسته‌شده', variant: 'neutral' },
};

const VISIBILITY_LABEL: Record<string, string> = {
  immediately: 'نمایش فوری نمره',
  after_grading: 'نمایش پس از تصحیح',
  manual: 'نمایش دستی توسط معلم',
};

export const ExamsManagementPage: React.FC = () => {
  const { hasAccess, currentUser } = useAuth();
  const canManage = hasAccess('exams:manage');
  const canPublish = hasAccess('exams:publish');

  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingUlid, setEditingUlid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '', opens_at: '', closes_at: '', duration_minutes: 20,
    result_visibility: 'after_grading' as ExamRow['result_visibility'],
    shuffle_questions: false,
  });
  const [questions, setQuestions] = useState<ExamQuestionDraft[]>([]);

  const [resultsFor, setResultsFor] = useState<ExamRow | null>(null);

  // Attachment lightbox for descriptive answer sheets (image/PDF, auth'd blob URL).
  const [filePreview, setFilePreview] = useState<{ name: string; mime: string; url: string | null } | null>(null);

  const openAnswerFile = async (f: FileAttachment) => {
    setFilePreview({ name: f.original_name, mime: f.mime, url: null });
    try {
      setFilePreview({ name: f.original_name, mime: f.mime, url: await fileObjectUrl(f.ulid) });
    } catch {
      setFilePreview(null);
    }
  };
  const [results, setResults] = useState<any[] | null>(null);
  const [mySubjects, setMySubjects] = useState<{ id: number; subject: string; classroom: string }[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);

  const reload = () => {
    setLoading(true);
    api<{ data: ExamRow[] }>('/v1/exams')
      .then((r) => setExams(r.data ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا در دریافت آزمون‌ها'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    api<{ data: { id: number; subject: string; classroom: string }[] }>('/v1/academic/my-subjects')
      .then((r) => {
        setMySubjects(r.data ?? []);
        setSubjectId((prev) => prev ?? r.data?.[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingUlid(null);
    setForm({
      title: '', opens_at: toLocalInput(new Date(Date.now() + 3600_000)),
      closes_at: toLocalInput(new Date(Date.now() + 86400_000)),
      duration_minutes: 20, result_visibility: 'after_grading', shuffle_questions: false,
    });
    setQuestions([{ type: 'mcq', body: '', points: 1, options: ['', ''], correct_position: 1 }]);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const openEdit = async (exam: ExamRow) => {
    try {
      const full = await api<any>(`/v1/exams/${exam.ulid}`);
      setEditingUlid(exam.ulid);
      setForm({
        title: full.title,
        opens_at: toLocalInput(new Date(full.opens_at)),
        closes_at: toLocalInput(new Date(full.closes_at)),
        duration_minutes: full.duration_minutes,
        result_visibility: full.result_visibility,
        shuffle_questions: !!full.shuffle_questions,
      });
      setQuestions(full.questions.map((q: any) => ({
        type: q.type, body: q.body, points: q.points,
        options: q.type === 'mcq' ? q.options.map((o: any) => o.body) : [],
        correct_position: q.type === 'mcq'
          ? (q.options.findIndex((o: any) => o.id === q.correct_option_id) + 1 || 1)
          : 0,
      })));
      setFormError(null);
      setIsEditorOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    }
  };

  const saveExam = async () => {
    setFormError(null);
    if (!form.title || !form.opens_at || !form.closes_at || questions.length === 0) {
      setFormError('عنوان، بازه زمانی و حداقل یک سؤال الزامی است.');
      return;
    }

    if (subjectId === null) {
      setFormError('ابتدا درس و کلاس توسط مدیریت تعریف شود.');
      return;
    }

    const payload = {
      ...form,
      classroom_subject_id: subjectId,
      opens_at: new Date(form.opens_at).toISOString(),
      closes_at: new Date(form.closes_at).toISOString(),
      questions: questions.map((q) => ({
        type: q.type, body: q.body, points: q.points,
        options: q.type === 'mcq' ? q.options.filter((o) => o.trim() !== '') : undefined,
        correct_position: q.type === 'mcq' ? q.correct_position : undefined,
      })),
    };

    setSaving(true);
    try {
      if (editingUlid) {
        await api(`/v1/exams/${editingUlid}`, { method: 'PATCH', body: payload });
        await api(`/v1/exams/${editingUlid}/questions`, { method: 'PUT', body: { questions: payload.questions } });
      } else {
        await api('/v1/exams', { method: 'POST', body: payload });
      }
      setIsEditorOpen(false);
      reload();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.firstError() : 'خطا در ذخیره آزمون');
    } finally {
      setSaving(false);
    }
  };

  const publishExam = async (ulid: string) => {
    try {
      await api(`/v1/exams/${ulid}/publish`, { method: 'POST' });
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در انتشار');
    }
  };

  const openResults = async (exam: ExamRow) => {
    setResultsFor(exam);
    setResults(null);
    try {
      const r = await api<any>(`/v1/exams/${exam.ulid}/result`);
      setResults(r.data ?? []);
    } catch (e) {
      setResults([]);
    }
  };

  const filtered = exams.filter((e) =>
    !searchQuery || e.title.includes(searchQuery) || (e.subject ?? '').includes(searchQuery),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="طراحی و مدیریت آزمون‌های آنلاین"
        subtitle="ساخت آزمون تستی و تشریحی، انتشار برای کلاس، و پیگیری نتایج — پایان زمان فقط با ساعت سرور"
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="جستجوی آزمون..." />
        {canManage && (
          <Button onClick={openCreate} icon={<Plus size={15} />}>
            طراحی آزمون جدید
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={26} className="animate-spin text-[#2457C5]" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          هنوز آزمونی ندارید؛ با دکمه «طراحی آزمون جدید» اولین آزمون خود را بسازید.
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((exam) => {
            const badge = STATUS_BADGE[exam.status];
            return (
              <Card key={exam.ulid} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold">{exam.title}</h3>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {exam.subject && <Badge variant="neutral">{exam.subject}</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1"><Clock size={12} /> {toPersianDigits(exam.duration_minutes)} دقیقه</span>
                      <span>شروع: {fmt(exam.opens_at)}</span>
                      <span>پایان: {fmt(exam.closes_at)}</span>
                      <span>{VISIBILITY_LABEL[exam.result_visibility]}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && exam.status === 'draft' && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(exam)} icon={<Edit3 size={13} />}>
                        ویرایش
                      </Button>
                    )}
                    {canPublish && exam.status === 'draft' && (
                      <Button variant="primary" size="sm" onClick={() => publishExam(exam.ulid)} icon={<Send size={13} />}>
                        انتشار
                      </Button>
                    )}
                    {exam.status !== 'draft' && (
                      <Button variant="secondary" size="sm" onClick={() => openResults(exam)} icon={<BarChart3 size={13} />}>
                        نتایج
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingUlid ? 'ویرایش آزمون (پیش‌نویس)' : 'طراحی آزمون جدید'}
        maxWidth="xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pl-1">
          <FormField label="عنوان آزمون" required>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none focus:ring-2 focus:ring-[#2457C5]/40"
            />
          </FormField>

          <FormField label="درس و کلاس" required>
            <select
              value={subjectId ?? ''}
              onChange={(e) => setSubjectId(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none"
            >
              {mySubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.subject} — {s.classroom}</option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="شروع" required hint={jalaliPreview(form.opens_at) ? `شمسی: ${jalaliPreview(form.opens_at)}` : undefined}>
              <JalaliDateTimePicker value={form.opens_at} onChange={(v) => setForm({ ...form, opens_at: v })} />
            </FormField>
            <FormField label="پایان" required hint={jalaliPreview(form.closes_at) ? `شمسی: ${jalaliPreview(form.closes_at)}` : undefined}>
              <JalaliDateTimePicker value={form.closes_at} onChange={(v) => setForm({ ...form, closes_at: v })} />
            </FormField>
            <FormField label="مدت (دقیقه)" required hint="پایان زمان فقط با ساعت سرور">
              <input type="number" min={5} max={300} value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none" />
            </FormField>
            <FormField label="زمان نمایش نمره">
              <select value={form.result_visibility}
                onChange={(e) => setForm({ ...form, result_visibility: e.target.value as any })}
                className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none">
                <option value="immediately">فوری (فقط تستی)</option>
                <option value="after_grading">پس از تصحیح و انتشار</option>
                <option value="manual">دستی</option>
              </select>
            </FormField>
          </div>

          {/* Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">سؤال‌ها</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" icon={<Plus size={12} />}
                  onClick={() => setQuestions([...questions, { type: 'mcq', body: '', points: 1, options: ['', ''], correct_position: 1 }])}>
                  تستی
                </Button>
                <Button variant="outline" size="sm" icon={<Plus size={12} />}
                  onClick={() => setQuestions([...questions, { type: 'descriptive', body: '', points: 3, options: [], correct_position: 0 }])}>
                  تشریحی
                </Button>
              </div>
            </div>

            {questions.map((q, qi) => (
              <div key={qi} className="p-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="neutral">{q.type === 'mcq' ? `تستی ${toPersianDigits(qi + 1)}` : `تشریحی ${toPersianDigits(qi + 1)}`}</Badge>
                  <button onClick={() => setQuestions(questions.filter((_, i) => i !== qi))}
                    className="text-rose-500 hover:text-rose-600" aria-label="حذف سؤال">
                    <X size={15} />
                  </button>
                </div>
                <textarea
                  value={q.body}
                  onChange={(e) => setQuestions(questions.map((x, i) => i === qi ? { ...x, body: e.target.value } : x))}
                  placeholder="متن سؤال..."
                  rows={2}
                  className="w-full p-2 rounded-lg border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">بارم:</span>
                  <input type="number" min={1} max={100} value={q.points}
                    onChange={(e) => setQuestions(questions.map((x, i) => i === qi ? { ...x, points: Number(e.target.value) } : x))}
                    className="w-16 h-8 px-2 rounded-lg border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-xs outline-none" />
                </div>
                {q.type === 'mcq' && (
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input type="radio" name={`correct-${qi}`} checked={q.correct_position === oi + 1}
                          onChange={() => setQuestions(questions.map((x, i) => i === qi ? { ...x, correct_position: oi + 1 } : x))}
                          className="accent-[#2457C5]" title="گزینه صحیح" />
                        <input value={opt}
                          onChange={(e) => setQuestions(questions.map((x, i) => i === qi ? {
                            ...x, options: x.options.map((o, j) => j === oi ? e.target.value : o),
                          } : x))}
                          placeholder={`گزینه ${toPersianDigits(oi + 1)}`}
                          className="flex-1 h-8 px-2 rounded-lg border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-xs outline-none" />
                        <button onClick={() => setQuestions(questions.map((x, i) => i === qi ? { ...x, options: x.options.filter((_, j) => j !== oi) } : x))}
                          className="text-slate-400 hover:text-rose-500" aria-label="حذف گزینه">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setQuestions(questions.map((x, i) => i === qi ? { ...x, options: [...x.options, ''] } : x))}
                      className="text-[11px] text-[#2457C5] dark:text-[#8BAEFF] font-bold">
                      + افزودن گزینه
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
              <AlertTriangle size={14} /> {formError}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setIsEditorOpen(false)}>انصراف</Button>
          <Button onClick={saveExam} disabled={saving} icon={saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}>
            {editingUlid ? 'ذخیره تغییرات' : 'ذخیره پیش‌نویس'}
          </Button>
        </div>
      </Modal>

      {/* Results modal (staff view) */}
      <Modal
        isOpen={resultsFor !== null}
        onClose={() => setResultsFor(null)}
        title={`نتایج: ${resultsFor?.title ?? ''}`}
        maxWidth="lg"
      >
        {results === null ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#2457C5]" /></div>
        ) : results.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">هنوز هیچ شرکت‌کننده‌ای نداشته است.</p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {results.map((a) => (
              <div key={a.attempt_id} className="p-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">{a.student_name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.status === 'submitted' ? 'success' : a.status === 'expired' ? 'danger' : 'warning'}>
                      {a.status === 'submitted' ? 'ارسال‌شده' : a.status === 'expired' ? 'منقضی' : 'در حال آزمون'}
                    </Badge>
                    <span className="font-mono font-bold">نمره تستی: {a.auto_score !== null ? toPersianDigits(a.auto_score) : '—'}</span>
                  </div>
                </div>

                {(a.answers ?? []).filter((ans: any) => ans.type === 'descriptive').map((ans: any) => (
                  <div key={ans.answer_id} className="bg-slate-50 dark:bg-[#131C2E] rounded-lg p-2.5 space-y-1.5">
                    <p className="text-[11px] font-medium">{ans.body}</p>
                    {ans.text && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-pre-wrap">{ans.text}</p>
                    )}
                    {ans.file ? (
                      <button
                        type="button"
                        onClick={() => openAnswerFile(ans.file)}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-[#2457C5] dark:text-[#8BAEFF] hover:underline cursor-pointer"
                      >
                        {isImage(ans.file.mime) ? <ImageIcon size={13} /> : <FileText size={13} />}
                        مشاهده برگه پاسخ ({ans.file.original_name} — {formatSize(ans.file.size)})
                      </button>
                    ) : !ans.text ? (
                      <p className="text-[11px] text-slate-400">(بدون پاسخ)</p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={ans.points}
                        defaultValue={ans.score ?? ''}
                        placeholder={`از ${toPersianDigits(ans.points)}`}
                        data-answer-id={ans.answer_id}
                        className="w-20 h-8 px-2 rounded-lg border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-xs outline-none"
                      />
                      <button
                        onClick={async (e) => {
                          const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                          try {
                            await api(`/v1/exams/answers/${ans.answer_id}/grade`, {
                              method: 'POST',
                              body: { score: Number(input.value), comment: '' },
                            });
                            (e.target as HTMLElement).textContent = '✓ ثبت شد';
                          } catch (err) {
                            (e.target as HTMLElement).textContent = err instanceof ApiError ? err.firstError() : 'خطا';
                          }
                        }}
                        className="text-[11px] font-bold text-[#2457C5] dark:text-[#8BAEFF] cursor-pointer"
                      >
                        ثبت نمره
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Attachment lightbox: image inline / PDF in an iframe */}
      {filePreview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setFilePreview(null)}>
          <div className="bg-white dark:bg-[#131C2E] rounded-2xl max-w-4xl w-full max-h-[90vh] p-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{filePreview.name}</span>
              <button type="button" onClick={() => setFilePreview(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer" aria-label="بستن">
                <X size={18} />
              </button>
            </div>
            {filePreview.url ? (
              isImage(filePreview.mime)
                ? <img src={filePreview.url} alt={filePreview.name} className="max-h-[75vh] w-auto mx-auto rounded-xl" />
                : <iframe src={filePreview.url} title={filePreview.name} className="w-full h-[75vh] rounded-xl bg-white" />
            ) : (
              <div className="flex justify-center py-14"><Loader2 size={26} className="animate-spin text-[#2457C5]" /></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(iso: string): string {
  return formatJalaliDateTime(iso);
}
