import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, CheckSquare, Clock, Users, Shield, Loader2, AlertCircle, RefreshCw, Inbox,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader, EmptyState } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { formatJalaliDateTime } from '../../utils/jalali';
import { api, ApiError } from '../../api/client';
import { ApiAcademicService, ExamSummary } from '../../api/data';

interface ResultAnswer {
  type: string;
  score: number | null;
}

interface ResultAttempt {
  answers: ResultAnswer[];
}

export const ProctorGraderDashboard: React.FC = () => {
  const { currentUser, activeRole, hasAccess } = useAuth();
  const canGrade = hasAccess('exams:grade_descriptive');
  const canProctor = hasAccess('exams:proctor');

  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [pendingEssays, setPendingEssays] = useState<number | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setForbidden(false);

    ApiAcademicService.exams()
      .then(async (rows) => {
        if (cancelled) return;
        setExams(rows);

        if (!canGrade) return;

        // Count the descriptive answers whose score is still null, over the
        // most recent published exams (bounded calls, no N+1 over 200 exams).
        const published = rows.filter((exam) => exam.status === 'published').slice(0, 5);

        const counts = await Promise.all(
          published.map((exam) =>
            api<{ data?: ResultAttempt[] }>(`/v1/exams/${exam.ulid}/result`)
              .then((result) => (result.data ?? []).reduce(
                (sum, attempt) => sum + attempt.answers.filter((a) => a.type === 'descriptive' && a.score === null).length,
                0,
              ))
              .catch(() => 0),
          ),
        );

        if (!cancelled) setPendingEssays(counts.reduce((a, b) => a + b, 0));
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 403) {
          setForbidden(true);
          setExams([]);
          return;
        }
        setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت آزمون‌ها');
      });

    return () => { cancelled = true; };
  }, [canGrade, reloadKey]);

  const published = (exams ?? []).filter((e) => e.status === 'published').length;
  const upcoming = (exams ?? []).filter(
    (e) => e.opensAt !== null && new Date(e.opensAt).getTime() > Date.now(),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`میز کار سنجش و تصحیح آزمون‌ها — ${currentUser.fullName}`}
        subtitle={`${activeRole.persianTitle} · تصحیح برگه‌های تشریحی و پیگیری آزمون‌های منتشرشده`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReloadKey((k) => k + 1)}>
              به‌روزرسانی
            </Button>
            {canGrade && (
              <Link to="/essay-grading">
                <Button variant="primary" size="sm" icon={<CheckSquare size={15} />}>
                  کارتابل تصحیح تشریحی
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200 font-bold">
            <AlertCircle size={15} /> {error}
          </div>
        </Card>
      )}

      {forbidden ? (
        <Card>
          <EmptyState
            icon={<Shield size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="فهرست آزمون‌ها برای این نقش باز نیست"
            description={
              canProctor
                ? 'مراقب آزمون اعلان‌های جلسه را دریافت می‌کند؛ دیدن برگه‌ها و نمرات فقط برای مصحح و کادر آموزشی مجاز است.'
                : 'برای این نقش، دسترسی به فهرست آزمون‌ها تعریف نشده است.'
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="text-right">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">آزمون‌های در دسترس</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
                  {exams === null ? '…' : toPersianDigits(exams.length)}
                </span>
                <Badge variant="primary"><FileText size={11} /> کل</Badge>
              </div>
            </Card>

            <Card className="text-right">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">منتشرشده</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {exams === null ? '…' : toPersianDigits(published)}
                </span>
                <Badge variant="success">قابل شرکت</Badge>
              </div>
            </Card>

            <Card className="text-right">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">در پیش‌رو</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {exams === null ? '…' : toPersianDigits(upcoming)}
                </span>
                <Badge variant="warning">زمان‌بندی</Badge>
              </div>
            </Card>

            <Card className="text-right">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پاسخ تشریحی در صف</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
                  {!canGrade ? '—' : pendingEssays === null ? '…' : toPersianDigits(pendingEssays)}
                </span>
                {canGrade
                  ? <Badge variant={pendingEssays && pendingEssays > 0 ? 'danger' : 'success'}>تصحیح</Badge>
                  : <Badge variant="neutral">فقط مراقبت</Badge>}
              </div>
            </Card>
          </div>

          <Card className="text-right">
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <Clock size={16} className="text-[#2457C5]" />
              آزمون‌های اخیر
            </h3>

            {exams === null ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#526176] dark:text-[#B3C0D2]">
                <Loader2 size={18} className="animate-spin" /> در حال دریافت آزمون‌ها…
              </div>
            ) : exams.length === 0 ? (
              <EmptyState
                icon={<Inbox size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
                title="آزمونی در دسترس نیست"
                description="آزمون‌های کلاس‌هایی که به شما تخصیص یافته‌اند همین‌جا ظاهر می‌شوند."
              />
            ) : (
              <div className="space-y-2">
                {exams.slice(0, 8).map((exam) => (
                  <div
                    key={exam.ulid}
                    className="p-3 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">{exam.title}</strong>
                      <span className="text-slate-500 mt-1 block">
                        {exam.subject ?? 'درس نامشخص'} · {formatJalaliDateTime(exam.opensAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={exam.status === 'published' ? 'success' : 'neutral'}>
                        {exam.status === 'published' ? 'منتشرشده' : exam.status === 'draft' ? 'پیش‌نویس' : exam.status}
                      </Badge>
                      {canGrade && exam.status === 'published' && (
                        <Link to="/essay-grading">
                          <Button size="sm" variant="outline" icon={<Users size={13} />}>برگه‌ها</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
