import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus, Paperclip, FileText, Image as ImageIcon, Send, Loader2,
  Eye, X, CheckCircle2, Clock, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader, EmptyState, AccessDeniedGate } from '../components/common';
import { toPersianDigits, formatScore, cn } from '../utils/persian';
import { formatJalaliDateTime } from '../utils/jalali';
import { api, ApiError } from '../api/client';
import {
  uploadFile, fileObjectUrl, validateUpload, isImage,
  formatSize, FileAttachment,
} from '../api/files';

interface AssignmentFile { ulid: string; original_name: string; mime: string; size: number }

interface AssignmentDto {
  ulid: string;
  title: string;
  description: string | null;
  due_at: string;
  max_score: number;
  subject: string | null;
  classroom: string | null;
  files: AssignmentFile[];
}

interface SubmissionDto {
  id: number;
  student_ulid: string | null;
  student_name: string | null;
  status: 'submitted' | 'late' | 'graded';
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
  text: string | null;
  files: AssignmentFile[];
}

const STATUS_LABEL: Record<SubmissionDto['status'], string> = {
  submitted: 'ارسال‌شده — در انتظار تصحیح',
  late: 'ارسال با دیرکرد',
  graded: 'نمره داده شده',
};

/** Inline preview of an attachment: image thumbnail or PDF opener (auth'd blob URL). */
const AttachmentChip: React.FC<{ file: AssignmentFile; onOpen: (f: AssignmentFile) => void }> = ({ file, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(file)}
    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] text-[11px] hover:border-[#2457C5]/60 transition-colors cursor-pointer max-w-[220px]"
  >
    {isImage(file.mime)
      ? <ImageIcon size={13} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0" />
      : <FileText size={13} className="text-rose-500 shrink-0" />}
    <span className="truncate font-medium">{file.original_name}</span>
    <span className="text-slate-400 shrink-0">{formatSize(file.size)}</span>
  </button>
);

export const AssignmentsPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();

  const canManage = hasAccess('assignments:manage');
  const canSubmit = hasAccess('submissions:submit');
  const canViewSubmissions = hasAccess('submissions:view');
  const hasAnyAccess = canManage || canSubmit || canViewSubmissions;

  // The copy follows the viewer: a learner submits (and reads his own
  // feedback), a guardian watches, the staff designs and grades.
  const isFamily = activeRole.group === 'family';
  const isLearnerView = isFamily || (canSubmit && !canManage);
  const headerSubtitle = isFamily
    ? 'تکالیف و پروژه‌های درسی فرزندتان، مهلت تحویل و بازخورد دبیران — در یک نگاه'
    : isLearnerView
      ? 'پاسخ تکالیف و پروژه‌ها را با پیوست تصویر یا PDF تا مهلت مقرر بفرستید و بازخورد دبیر را همین‌جا ببینید'
      : 'ارسال برگه تکلیف به‌صورت تصویر یا PDF، مشاهده پاسخ دانش‌آموزان و نمره‌دهی همراه با بازخورد';

  const [assignments, setAssignments] = useState<AssignmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-assignment modal (teacher)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', due_at: '', max_score: 100 });
  const [sheetFiles, setSheetFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);

  // A homework always belongs to one taught class-subject (backend requires its id).
  const [mySubjects, setMySubjects] = useState<{ id: number; subject: string; classroom: string }[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);

  // Submit modal (student)
  const [submitTarget, setSubmitTarget] = useState<AssignmentDto | null>(null);
  const [submitText, setSubmitText] = useState('');
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Review panel (teacher/guardian/student)
  const [reviewTarget, setReviewTarget] = useState<AssignmentDto | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionDto[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [gradeDraft, setGradeDraft] = useState<Record<number, { score: string; feedback: string }>>({});
  const [savingGradeId, setSavingGradeId] = useState<number | null>(null);

  // File lightbox
  const [openFile, setOpenFile] = useState<AssignmentFile | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ data: AssignmentDto[] }>('/v1/assignments');
      setAssignments(r.data ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت تکالیف');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  useEffect(() => {
    if (!canManage) return;
    api<{ data: { id: number; subject: string; classroom: string }[] }>('/v1/academic/my-subjects')
      .then((r) => {
        setMySubjects(r.data ?? []);
        setSubjectId((prev) => prev ?? r.data?.[0]?.id ?? null);
      })
      .catch(() => {});
  }, [canManage]);

  if (!hasAnyAccess) {
    return (
      <AccessDeniedGate
        title="عدم دسترسی به تکالیف درسی"
        requiredRoleOrPermission="assignments:view (دبیران، دانش‌آموزان، اولیا یا کادر مدرسه)"
        reason="حساب فعال شما مجوز مشاهده تکالیف را ندارد."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const loadSubmissions = async (a: AssignmentDto) => {
    setReviewTarget(a);
    setSubmissions([]);
    setReviewLoading(true);
    setGradeDraft({});
    try {
      const r = await api<{ data: SubmissionDto[] }>(`/v1/assignments/${a.ulid}/submissions`);
      setSubmissions(r.data ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت پاسخ‌ها');
    } finally {
      setReviewLoading(false);
    }
  };

  const openFilePreview = async (f: AssignmentFile) => {
    setOpenFile(f);
    setFileUrl(null);
    try {
      setFileUrl(await fileObjectUrl(f.ulid));
    } catch {
      setFileUrl(null);
    }
  };

  const addFiles = (list: FileList | null, setter: React.Dispatch<React.SetStateAction<File[]>>) => {
    if (!list) return;
    const incoming = Array.from(list);
    const rejected: string[] = [];
    incoming.forEach((f) => {
      const err = validateUpload(f);
      if (err) rejected.push(`${f.name}: ${err}`);
    });
    if (rejected.length > 0) {
      setError(rejected.join(' | '));
      return;
    }
    setError(null);
    setter((prev) => [...prev, ...incoming].slice(0, 5));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title || !createForm.due_at) return;
    if (subjectId === null) {
      setError('ابتدا درسی در برنامه هفتگی شما تعریف شود.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const f of sheetFiles) {
        uploaded.push((await uploadFile(f)).ulid);
      }
      await api('/v1/assignments', {
        method: 'POST',
        body: {
          classroom_subject_id: subjectId,
          title: createForm.title,
          description: createForm.description || null,
          due_at: new Date(createForm.due_at).toISOString(),
          max_score: Number(createForm.max_score) || 100,
          ...(uploaded.length > 0 ? { file_ulids: uploaded } : {}),
        },
      });
      setIsCreateOpen(false);
      setCreateForm({ title: '', description: '', due_at: '', max_score: 100 });
      setSheetFiles([]);
      await loadAssignments();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'خطا در تعریف تکلیف');
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTarget) return;
    if (!submitText.trim() && submitFiles.length === 0) {
      setError('متن پاسخ یا حداقل یک فایل (تصویر/PDF) لازم است.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const f of submitFiles) {
        uploaded.push((await uploadFile(f)).ulid);
      }
      await api(`/v1/assignments/${submitTarget.ulid}/submissions`, {
        method: 'POST',
        body: {
          text: submitText.trim() || null,
          ...(uploaded.length > 0 ? { file_ulids: uploaded } : {}),
        },
      });
      setSubmitTarget(null);
      setSubmitText('');
      setSubmitFiles([]);
      await loadAssignments();
      if (reviewTarget?.ulid === submitTarget.ulid) await loadSubmissions(submitTarget);
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'خطا در ارسال پاسخ');
    } finally {
      setSubmitting(false);
    }
  };

  const saveGrade = async (sub: SubmissionDto) => {
    const draft = gradeDraft[sub.id];
    const score = Number(draft?.score ?? sub.score);
    if (Number.isNaN(score)) return;
    setSavingGradeId(sub.id);
    setError(null);
    try {
      await api(`/v1/submissions/${sub.id}/grade`, {
        method: 'POST',
        body: { score, feedback: draft?.feedback ?? sub.feedback ?? '' },
      });
      await loadSubmissions(reviewTarget!);
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'خطا در ثبت نمره');
    } finally {
      setSavingGradeId(null);
    }
  };

  if (loading && assignments.length === 0) {
    return <div className="flex justify-center py-16"><Loader2 size={30} className="animate-spin text-[#2457C5]" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isLearnerView ? 'تکالیف و پروژه‌های درسی من' : 'تکالیف و پروژه‌های درسی'}
        subtitle={headerSubtitle}
        actions={canManage && (
          <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setIsCreateOpen(true)}>
            تعریف تکلیف جدید
          </Button>
        )}
      />

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {assignments.length === 0 && !loading ? (
        <EmptyState
          title="تکلیفی ثبت نشده است"
          description={canManage ? 'هنوز تکلیفی برای کلاس‌های شما تعریف نشده است.' : 'هنوز تکلیفی برای شما تعریف نشده است؛ به‌محض تعریف توسط دبیر همین‌جا نمایش داده می‌شود.'}
        />
      ) : (
        <div className="space-y-4">
          {assignments.map((asg) => (
            <Card key={asg.ulid} className="text-right">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-3 border-b border-[#DCE3EE]/60 dark:border-[#344257]/60">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {asg.subject && <Badge variant="primary">{asg.subject}</Badge>}
                    {asg.classroom && <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">{asg.classroom}</span>}
                  </div>
                  <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">{asg.title}</h3>
                </div>
                <div className="text-left text-xs shrink-0">
                  <span className="text-[#526176] dark:text-[#B3C0D2] block">مهلت تحویل:</span>
                  <strong className="text-rose-700 dark:text-rose-400 font-mono tabular-nums">{formatJalaliDateTime(asg.due_at)}</strong>
                </div>
              </div>

              {asg.description && (
                <p className="text-xs md:text-sm text-[#526176] dark:text-[#B3C0D2] py-3 leading-relaxed whitespace-pre-wrap">{asg.description}</p>
              )}

              {asg.files.length > 0 && (
                <div className="pb-3 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-[#526176] dark:text-[#B3C0D2]">صورت تکلیف:</span>
                  {asg.files.map((f) => (
                    <AttachmentChip key={f.ulid} file={f} onOpen={openFilePreview} />
                  ))}
                </div>
              )}

              {(canSubmit || !canManage) && (
                <div className="pt-3 mt-1 border-t border-[#DCE3EE] dark:border-[#344257] flex justify-end">
                  <Button size="sm" variant="primary" icon={<Send size={14} />} onClick={() => { setSubmitTarget(asg); setSubmitText(''); setSubmitFiles([]); setError(null); }}>
                    ارسال پاسخ تکلیف
                  </Button>
                </div>
              )}

              {canViewSubmissions && (
                <div className="pt-3 mt-1 border-t border-[#DCE3EE] dark:border-[#344257] flex justify-end">
                  <Button size="sm" variant="outline" icon={<Eye size={14} />} onClick={() => loadSubmissions(asg)}>
                    {canManage ? 'مشاهده پاسخ‌ها و نمره‌دهی' : 'مشاهده پاسخ و بازخورد'}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create assignment (teacher) */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="تعریف تکلیف جدید" maxWidth="lg">
        <form onSubmit={handleCreate} className="space-y-4 text-right">
          <FormField label="عنوان تکلیف" required>
            <input
              type="text" required value={createForm.title}
              onChange={(e) => setCreateForm((s) => ({ ...s, title: e.target.value }))}
              placeholder="مثال: تمرین‌های معادلات درجه دوم"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="درس و کلاس" required>
            <select
              value={subjectId ?? ''}
              onChange={(e) => setSubjectId(Number(e.target.value))}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              {mySubjects.length === 0 && <option value="">درسی در برنامه هفتگی شما ثبت نشده است</option>}
              {mySubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.subject} — {s.classroom}</option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="مهلت تحویل" required>
              <input
                type="datetime-local" required value={createForm.due_at}
                onChange={(e) => setCreateForm((s) => ({ ...s, due_at: e.target.value }))}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
              />
            </FormField>
            <FormField label="سقف نمره">
              <input
                type="number" min={1} max={1000} value={createForm.max_score}
                onChange={(e) => setCreateForm((s) => ({ ...s, max_score: Number(e.target.value) }))}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
              />
            </FormField>
          </div>

          <FormField label="توضیحات و دستورالعمل">
            <textarea
              rows={3} value={createForm.description}
              onChange={(e) => setCreateForm((s) => ({ ...s, description: e.target.value }))}
              placeholder="جزئیات تمرین، صفحات کتاب و معیارهای نمره‌دهی..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="صورت تکلیف (اختیاری — تصویر یا PDF، حداکثر ۵ فایل)">
            <label className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-[#DCE3EE] dark:border-[#344257] text-xs text-[#526176] dark:text-[#B3C0D2] cursor-pointer hover:border-[#2457C5]/50 transition-colors">
              <Paperclip size={15} />
              انتخاب فایل برای آپلود
              <input
                type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                onChange={(e) => { addFiles(e.target.files, setSheetFiles); e.target.value = ''; }}
              />
            </label>
            {sheetFiles.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {sheetFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] bg-[#F0F4FA] dark:bg-[#101722]/60 rounded-lg px-2.5 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => setSheetFiles((prev) => prev.filter((_, j) => j !== i))} className="text-rose-500 hover:text-rose-600 cursor-pointer" aria-label="حذف">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={creating} icon={creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}>
              انتشار تکلیف
            </Button>
          </div>
        </form>
      </Modal>

      {/* Submit answer (student) */}
      <Modal isOpen={submitTarget !== null} onClose={() => setSubmitTarget(null)} title={`ارسال پاسخ: ${submitTarget?.title ?? ''}`} maxWidth="md">
        <form onSubmit={handleSubmit} className="space-y-4 text-right">
          <FormField label="متن توضیحی (اختیاری در صورت پیوست فایل)">
            <textarea
              rows={4} value={submitText}
              onChange={(e) => setSubmitText(e.target.value)}
              placeholder="توضیح مراحل حل یا خلاصه نتایج..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="برگه تکلیف — تصویر یا PDF (حداکثر ۵ فایل، هر فایل تا ۱۰ مگابایت)">
            <label className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-[#DCE3EE] dark:border-[#344257] text-xs text-[#526176] dark:text-[#B3C0D2] cursor-pointer hover:border-[#2457C5]/50 transition-colors">
              <Paperclip size={15} />
              انتخاب تصویر یا PDF پاسخ
              <input
                type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                onChange={(e) => { addFiles(e.target.files, setSubmitFiles); e.target.value = ''; }}
              />
            </label>
            {submitFiles.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {submitFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] bg-[#F0F4FA] dark:bg-[#101722]/60 rounded-lg px-2.5 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => setSubmitFiles((prev) => prev.filter((_, j) => j !== i))} className="text-rose-500 hover:text-rose-600 cursor-pointer" aria-label="حذف">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setSubmitTarget(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={submitting} icon={submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}>
              ارسال نهایی به دبیر
            </Button>
          </div>
        </form>
      </Modal>

      {/* Review & grade (teacher / guardian / student) */}
      <Modal isOpen={reviewTarget !== null} onClose={() => setReviewTarget(null)} title={`پاسخ‌های: ${reviewTarget?.title ?? ''}`} maxWidth="lg">
        {reviewLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={26} className="animate-spin text-[#2457C5]" /></div>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">هنوز پاسخی ثبت نشده است.</p>
        ) : (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto text-right">
            {submissions.map((sub) => (
              <div key={sub.id} className="p-3 rounded-xl border border-[#DCE3EE] dark:border-[#344257] space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB]">{sub.student_name ?? '—'}</span>
                  <div className="flex items-center gap-2">
                    {sub.status === 'graded' ? (
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 tabular-nums px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
                        نمره: {formatScore(sub.score)} از {toPersianDigits(reviewTarget?.max_score ?? 100)}
                      </span>
                    ) : (
                      <Badge variant={sub.status === 'late' ? 'danger' : 'warning'}>
                        {sub.status === 'late' ? <Clock size={11} className="inline ml-1" /> : null}
                        {STATUS_LABEL[sub.status]}
                      </Badge>
                    )}
                  </div>
                </div>

                {sub.text && (
                  <p className="text-xs text-[#526176] dark:text-[#B3C0D2] whitespace-pre-wrap bg-slate-50 dark:bg-[#131C2E] rounded-lg p-2.5">{sub.text}</p>
                )}

                {sub.files.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {sub.files.map((f) => (
                      <AttachmentChip key={f.ulid} file={f} onOpen={openFilePreview} />
                    ))}
                  </div>
                )}

                {sub.feedback && (
                  <p className="text-[11px] text-[#2457C5] dark:text-[#8BAEFF]">
                    <CheckCircle2 size={12} className="inline ml-1" /> بازخورد دبیر: {sub.feedback}
                  </p>
                )}

                {canManage && (
                  <div className="flex items-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex-1">
                      <label className="text-[11px] font-bold text-[#526176] dark:text-[#B3C0D2] block mb-1">بازخورد کیفی</label>
                      <input
                        type="text"
                        defaultValue={sub.feedback ?? ''}
                        onChange={(e) => setGradeDraft((prev) => ({
                          ...prev,
                          [sub.id]: { score: prev[sub.id]?.score ?? String(sub.score ?? ''), feedback: e.target.value },
                        }))}
                        placeholder="نقاط قوت و نکات اصلاحی..."
                        className="w-full text-xs p-2 bg-white dark:bg-[#131C2E] border border-[#DCE3EE] dark:border-[#344257] rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#526176] dark:text-[#B3C0D2] block mb-1">
                        نمره (از {toPersianDigits(reviewTarget?.max_score ?? 100)})
                      </label>
                      <input
                        type="number" min={0} max={reviewTarget?.max_score ?? 100}
                        defaultValue={sub.score ?? ''}
                        onChange={(e) => setGradeDraft((prev) => ({
                          ...prev,
                          [sub.id]: { score: e.target.value, feedback: prev[sub.id]?.feedback ?? sub.feedback ?? '' },
                        }))}
                        className="w-20 text-xs p-2 bg-white dark:bg-[#131C2E] border border-[#DCE3EE] dark:border-[#344257] rounded-lg focus:outline-none font-mono tabular-nums"
                      />
                    </div>
                    <Button size="sm" variant="primary" onClick={() => saveGrade(sub)} disabled={savingGradeId === sub.id}
                      icon={savingGradeId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}>
                      {sub.status === 'graded' ? 'ویرایش نمره' : 'ثبت نمره'}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Attachment lightbox: image inline / PDF in an iframe */}
      <Modal isOpen={openFile !== null} onClose={() => { setOpenFile(null); setFileUrl(null); }} title={openFile?.original_name ?? ''} maxWidth="lg">
        {fileUrl ? (
          isImage(openFile!.mime)
            ? <img src={fileUrl} alt={openFile!.original_name} className="max-h-[70vh] w-auto mx-auto rounded-xl" />
            : <iframe src={fileUrl} title={openFile!.original_name} className="w-full h-[70vh] rounded-xl bg-white" />
        ) : (
          <div className="flex justify-center py-10"><Loader2 size={26} className="animate-spin text-[#2457C5]" /></div>
        )}
      </Modal>
    </div>
  );
};
