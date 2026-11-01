import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText, Image as ImageIcon, Award, CheckCircle2, Inbox,
  AlertCircle, Loader2, ClipboardList, Paperclip,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Card, Button, Badge, Modal, FormField, PageHeader, AccessDeniedGate,
  EmptyState, RolePermissionBadge, Tabs,
} from '../components/common';
import { toPersianDigits, formatScore } from '../utils/persian';
import { formatJalaliDateTime } from '../utils/jalali';
import { api, ApiError } from '../api/client';
import { ApiAcademicService, ExamSummary } from '../api/data';
import { fileObjectUrl, formatSize, isImage, FileAttachment } from '../api/files';

interface ResultAnswer {
  answer_id: number;
  type: string;
  body: string | null;
  points: number | null;
  text: string | null;
  file: FileAttachment | null;
  score: number | null;
  comment: string | null;
}

interface ResultAttempt {
  attempt_id: number;
  student_name: string | null;
  submitted_at: string | null;
  answers: ResultAnswer[];
}

interface EssayRow {
  key: string;
  answerId: number;
  examTitle: string;
  subject: string | null;
  studentName: string;
  submittedAt: string | null;
  questionBody: string | null;
  points: number | null;
  answerText: string | null;
  file: FileAttachment | null;
  score: number | null;
  comment: string | null;
}

/** Answer attachment streamed through the access-checked file endpoint. */
const AnswerFile: React.FC<{ file: FileAttachment }> = ({ file }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fileObjectUrl(file.ulid)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [file.ulid]);

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 text-[11px] text-[#526176] dark:text-[#B3C0D2]">
        {isImage(file.mime) ? <ImageIcon size={13} /> : <Paperclip size={13} />}
        <span className="font-medium">{file.original_name}</span>
        <span className="text-slate-400">{formatSize(file.size)}</span>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
            باز کردن فایل
          </a>
        )}
        {failed && <span className="text-rose-600">دریافت فایل ممکن نشد</span>}
      </div>
      {url && isImage(file.mime) && (
        <img
          src={url}
          alt={file.original_name}
          className="mt-2 max-h-48 rounded-xl border border-[#DCE3EE] dark:border-[#344257] object-contain"
        />
      )}
    </div>
  );
};

export const EssayGradingPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();
  const canGrade = hasAccess('exams:grade_descriptive');

  const [rows, setRows] = useState<EssayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'graded'>('pending');

  const [target, setTarget] = useState<EssayRow | null>(null);
  const [scoreInput, setScoreInput] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const exams: ExamSummary[] = await ApiAcademicService.exams();
      const results = await Promise.all(
        exams.map(async (exam) => {
          try {
            const r = await api<{ data?: ResultAttempt[] }>(`/v1/exams/${exam.ulid}/result`);
            return { exam, attempts: r.data ?? [] };
          } catch {
            // Results of an exam that is not releasable yet contribute nothing.
            return { exam, attempts: [] as ResultAttempt[] };
          }
        }),
      );

      const flattened: EssayRow[] = [];
      results.forEach(({ exam, attempts }) => {
        attempts.forEach((attempt) => {
          (attempt.answers ?? [])
            .filter((a) => a.type === 'descriptive')
            .forEach((a) => {
              flattened.push({
                key: `${attempt.attempt_id}-${a.answer_id}`,
                answerId: a.answer_id,
                examTitle: exam.title,
                subject: exam.subject,
                studentName: attempt.student_name ?? '—',
                submittedAt: attempt.submitted_at,
                questionBody: a.body,
                points: a.points,
                answerText: a.text,
                file: a.file,
                score: a.score,
                comment: a.comment,
              });
            });
        });
      });

      setRows(flattened);
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت پاسخ‌های تشریحی');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canGrade) load();
    else setLoading(false);
  }, [canGrade, load]);

  const pending = useMemo(() => rows.filter((r) => r.score === null), [rows]);
  const shown = filter === 'pending' ? pending : rows.filter((r) => r.score !== null);

  const openModal = (row: EssayRow) => {
    setTarget(row);
    // Left empty for an ungraded paper: pre-filling 0 turns a hasty submit
    // into a recorded zero.
    setScoreInput(row.score);
    setCommentInput(row.comment ?? '');
    setError(null);
  };

  const saveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || scoreInput === null) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/v1/exams/answers/${target.answerId}/grade`, {
        method: 'POST',
        body: { score: Math.round(scoreInput), comment: commentInput.trim() || null },
      });
      setTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'خطا در ثبت نمره');
    } finally {
      setSaving(false);
    }
  };

  if (!canGrade) {
    return (
      <AccessDeniedGate
        title="دسترسی به پنل تصحیح اوراق تشریحی آزمون"
        requiredRoleOrPermission="exams.grade_descriptive (دبیر کلاس مربوطه یا مصحح ارجاع‌شده)"
        reason="تصحیح پاسخ‌های تشریحی فقط برای دبیرِ کلاس تحت تدریس (ش۲) یا مصححی که آزمون به او ارجاع شده (ش۵) ممکن است."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="سامانه تصحیح سؤالات تشریحی آزمون‌ها"
        subtitle="پاسخ‌های متنی و فایل‌های ارسالی، مستقیماً از برگه‌های ثبت‌شدهٔ آزمون‌ها خوانده می‌شود"
        actions={
          <div className="flex items-center gap-2">
            <RolePermissionBadge level="full" scopeLabel="تصحیح و ثبت نمره" />
            <Button variant="outline" size="sm" icon={<ClipboardList size={15} />} onClick={load}>
              نوسازی برگه‌ها
            </Button>
          </div>
        }
      />

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={30} className="animate-spin text-[#2457C5]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card className="text-right">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پاسخ‌های تشریحی کل</span>
              <div className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums mt-1">
                {toPersianDigits(rows.length)}
              </div>
            </Card>
            <Card className="text-right">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">در انتظار تصحیح</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums mt-1">
                {toPersianDigits(pending.length)}
              </div>
            </Card>
            <Card className="text-right">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">تصحیح‌شده</span>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                {toPersianDigits(rows.length - pending.length)}
              </div>
            </Card>
          </div>

          <Tabs
            tabs={[
              { id: 'pending', label: `در انتظار تصحیح (${toPersianDigits(pending.length)})` },
              { id: 'graded', label: `تصحیح‌شده (${toPersianDigits(rows.length - pending.length)})` },
            ]}
            activeId={filter}
            onChange={(id) => setFilter(id as typeof filter)}
          />

          {shown.length === 0 ? (
            <Card>
              <EmptyState
                title={filter === 'pending'
                  ? 'همهٔ پاسخ‌های تشریحی تصحیح شده‌اند'
                  : 'هنوز پاسخی نمره‌دهی نشده است'}
                description="پاسخ تشریحی پس از ثبت برگهٔ دانش‌آموز در این فهرست ظاهر می‌شود."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {shown.map((row) => (
                <Card key={row.key} className="text-right">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#2457C5] flex items-center justify-center font-bold text-xs">
                        {row.studentName.slice(0, 1)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{row.studentName}</h4>
                        <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2]">
                          {row.subject ?? '—'} · {row.examTitle}
                          {row.submittedAt ? ` · ارسال ${formatJalaliDateTime(row.submittedAt)}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {row.score !== null ? (
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg tabular-nums">
                          نمره: {formatScore(row.score)} از {toPersianDigits(row.points ?? 20)}
                        </span>
                      ) : (
                        <Badge variant="warning">
                          <Inbox size={11} className="inline me-1" />
                          نیازمند تصحیح
                        </Badge>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openModal(row)}>
                        {row.score !== null ? 'ویرایش نمره' : 'تصحیح و ثبت نمره'}
                      </Button>
                    </div>
                  </div>

                  <div className="pt-3 space-y-2">
                    {row.questionBody && (
                      <>
                        <span className="text-xs font-bold text-[#2457C5] dark:text-[#8BAEFF] block">صورت سؤال:</span>
                        <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">{row.questionBody}</p>
                      </>
                    )}

                    <span className="text-xs font-bold text-[#526176] dark:text-[#B3C0D2] block mt-2">
                      پاسخ دانش‌آموز:
                    </span>
                    <p className="text-xs text-[#202B3C] dark:text-[#F1F5FB] leading-relaxed bg-[#F7F9FC] dark:bg-[#101722]/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
                      {row.answerText || 'پاسخی به‌صورت متن ثبت نشده است.'}
                    </p>

                    {row.file && <AnswerFile file={row.file} />}

                    {row.comment && (
                      <div className="text-xs text-[#526176] dark:text-[#B3C0D2] pt-2">
                        <strong className="text-[#2457C5] dark:text-[#8BAEFF] flex items-center gap-1">
                          <CheckCircle2 size={13} /> بازخورد مصحح:
                        </strong>
                        <span>{row.comment}</span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={target !== null}
        onClose={() => setTarget(null)}
        title={`تصحیح برگه ${target?.studentName ?? ''}`}
        maxWidth="md"
      >
        <form onSubmit={saveGrade} className="space-y-4 text-right">
          {target?.questionBody && (
            <div className="p-3 rounded-xl bg-[#F7F9FC] dark:bg-[#101722]/50 border border-slate-200 dark:border-slate-800 text-xs text-[#526176] dark:text-[#B3C0D2]">
              {target.questionBody}
            </div>
          )}

          {target?.answerText && (
            <div className="p-3 rounded-xl border border-[#DCE3EE] dark:border-[#344257] text-xs text-[#202B3C] dark:text-[#F1F5FB] max-h-40 overflow-y-auto whitespace-pre-wrap">
              {target.answerText}
            </div>
          )}

          <FormField label={`نمره (حداکثر ${toPersianDigits(target?.points ?? 20)})`} required>
            <input
              type="number"
              step="1"
              min="0"
              max={target?.points ?? 20}
              required
              value={scoreInput ?? ''}
              onChange={(e) => setScoreInput(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full text-sm p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-bold font-mono tabular-nums"
            />
          </FormField>

          <FormField label="بازخورد و دلیل نمره">
            <textarea
              rows={4}
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="نکات قوت استدلال یا دلایل کسر نمره..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setTarget(null)}>انصراف</Button>
            <Button
              variant="primary"
              type="submit"
              disabled={saving}
              icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />}
            >
              ثبت نمره
            </Button>
          </div>
        </form>
      </Modal>

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 text-right">
        <FileText size={12} />
        نمرهٔ سؤالات تشریحی پس از ثبت، در نمرهٔ کل برگه و کارنامهٔ آزمون لحاظ می‌شود.
      </p>
    </div>
  );
};
