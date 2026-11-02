import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Printer, CheckCircle2, FileText, Calendar, ShieldCheck, AlertCircle, Loader2,
  GraduationCap, BookOpenCheck, Sparkles, TrendingUp, MessageSquareQuote, Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Card, Button, Badge, Tabs, PageHeader, EmptyState, AccessDeniedGate, RolePermissionBadge,
} from '../components/common';
import { toPersianDigits, formatScore, cn } from '../utils/persian';
import { formatJalaliDateTime } from '../utils/jalali';
import { ApiReportCardService, ApiReportCardPrintService, ReportCardLineRow, ReportCardRow } from '../api/data';
import { ApiError } from '../api/client';

const KIND_LABEL: Record<string, string> = {
  in_person: 'کارنامه آزمون‌های حضوری',
  online: 'کارنامه سنجش آنلاین و مستمر',
};

const SOURCE_LABEL: Record<string, string> = {
  exam: 'آزمون',
  in_person_exam: 'آزمون حضوری',
  assignment: 'تکلیف و فعالیت کلاسی',
  manual: 'ثبت دستی دبیر',
};

/** Score on the official ۲۰-point scale; a line without a ceiling is already out of ۲۰. */
function outOfTwenty(line: ReportCardLineRow): number | null {
  if (line.score === null) return null;
  if (!line.maxScore || line.maxScore === 20) return line.score;
  return (line.score / line.maxScore) * 20;
}

/**
 * The four descriptive bands of the Iranian grading scale. The same vocabulary
 * the teachers pick in the monthly report cycle, so a family reads one language
 * in both places.
 */
const BANDS = [
  { key: 'excellent', min: 17, label: 'خیلی خوب', variant: 'success' as const, bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  { key: 'good', min: 14, label: 'خوب', variant: 'primary' as const, bar: 'bg-[#2457C5]', text: 'text-[#2457C5] dark:text-[#8BAEFF]' },
  { key: 'acceptable', min: 10, label: 'قابل قبول', variant: 'warning' as const, bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  { key: 'needs_work', min: -1, label: 'نیاز به تلاش', variant: 'danger' as const, bar: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
];

const bandOf = (score20: number | null) =>
  score20 === null ? null : BANDS.find((b) => score20 >= b.min) ?? BANDS[BANDS.length - 1];

/** Ring gauge for the overall average. */
const ScoreRing: React.FC<{ avg: number | null }> = ({ avg }) => {
  const R = 34;
  const C = 2 * Math.PI * R;
  const ratio = avg === null ? 0 : Math.max(0, Math.min(1, avg / 20));
  const band = bandOf(avg);
  return (
    <div className="relative w-[92px] h-[92px] shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={R} fill="none" strokeWidth="8" className="stroke-[#DCE3EE] dark:stroke-[#344257]" />
        <circle
          cx="40" cy="40" r={R} fill="none" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${ratio * C} ${C}`}
          className={cn('transition-all duration-500', band?.key === 'excellent' && 'stroke-emerald-500', band?.key === 'good' && 'stroke-[#2457C5] dark:stroke-[#8BAEFF]', band?.key === 'acceptable' && 'stroke-amber-500', band?.key === 'needs_work' && 'stroke-rose-500')}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black tabular-nums text-[#202B3C] dark:text-[#F1F5FB]">
          {avg === null ? '—' : formatScore(avg)}
        </span>
        <span className="text-[10px] text-[#526176] dark:text-[#B3C0D2]">از ۲۰</span>
      </div>
    </div>
  );
};

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: string; hint?: string }> = ({ icon, label, value, hint }) => (
  <div className="rounded-2xl border border-[#DCE3EE]/80 dark:border-[#344257]/80 bg-white/70 dark:bg-[#101722]/40 px-3.5 py-3">
    <span className="flex items-center gap-1.5 text-[11px] text-[#526176] dark:text-[#B3C0D2]">
      <span className="text-[#2457C5] dark:text-[#8BAEFF]">{icon}</span>{label}
    </span>
    <div className="mt-1 text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] truncate">{value}</div>
    {hint && <span className="text-[10px] text-slate-400 dark:text-slate-500">{hint}</span>}
  </div>
);

/** One lesson: gauge, descriptive band and the teacher's remark. */
const SubjectCard: React.FC<{ line: ReportCardLineRow; index: number }> = ({ line, index }) => {
  const score20 = outOfTwenty(line);
  const band = bandOf(score20);
  return (
    <div className="rounded-2xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-[#F0F4FA] dark:bg-[#222F42] text-[#2457C5] dark:text-[#8BAEFF] text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
            {toPersianDigits(index + 1)}
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] truncate">{line.subject ?? '—'}</h4>
            <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2]">
              {line.sourceType ? SOURCE_LABEL[line.sourceType] ?? line.sourceType : 'بدون منبع'}
            </span>
          </div>
        </div>
        <div className="text-left shrink-0">
          <div className={cn('text-2xl font-black tabular-nums leading-none', band?.text ?? 'text-slate-400')}>
            {score20 === null ? '—' : formatScore(score20)}
          </div>
          <span className="text-[10px] text-[#526176] dark:text-[#B3C0D2] block mt-1">
            {line.score === null ? 'ثبت نشده' : line.maxScore && line.maxScore !== 20 ? `${formatScore(line.score)} از ${toPersianDigits(line.maxScore)}` : 'از ۲۰'}
          </span>
        </div>
      </div>

      <div>
        <div className="h-2 rounded-full bg-[#F0F4FA] dark:bg-[#222F42] overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', band?.bar ?? 'bg-slate-300 dark:bg-slate-600')}
            style={{ width: `${score20 === null ? 0 : Math.max(3, (score20 / 20) * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          {band ? <Badge variant={band.variant}>{band.label}</Badge> : <Badge variant="neutral">بی‌نمره</Badge>}
          {score20 !== null && (
            <span className="text-[10px] text-slate-400 tabular-nums">{toPersianDigits(Math.round((score20 / 20) * 100))}٪ از سقف نمره</span>
          )}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-[#526176] dark:text-[#B3C0D2] flex items-start gap-1.5 min-h-[32px]">
        <MessageSquareQuote size={13} className="shrink-0 mt-0.5 text-slate-400" />
        {line.teacherComment ?? 'دبیر توضیحی برای این درس ثبت نکرده است.'}
      </p>
    </div>
  );
};

export const ReportCardPage: React.FC = () => {
  const { currentUser, activeRole, hasAccess } = useAuth();

  const isBusDriver = activeRole.id === 'bus_driver';
  const isTeacher = activeRole.id === 'teacher' || activeRole.group === 'faculty';
  const isFamily = activeRole.group === 'family';
  const isStudent = activeRole.group === 'student';

  const canView = hasAccess('reportcards:view');

  const [cards, setCards] = useState<ReportCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'in_person' | 'online'>('all');
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await ApiReportCardService.list();
      setCards(rows);
      setSelectedStudent((prev) => prev ?? rows[0]?.studentUlid ?? rows[0]?.studentName ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت کارنامه‌ها');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [canView, load]);

  // One chip per learner: a guardian switches between children files, a staff
  // member sees only the cards the backend put in scope (sh2/sh3/sh4).
  const learners = useMemo(() => {
    const seen = new Map<string, string>();
    cards.forEach((c) => {
      const key = c.studentUlid ?? c.studentName;
      if (!seen.has(key)) seen.set(key, c.studentName);
    });
    return Array.from(seen, ([key, name]) => ({ key, name }));
  }, [cards]);

  const visible = useMemo(
    () =>
      cards.filter(
        (c) =>
          (c.studentUlid ?? c.studentName) === selectedStudent &&
          (activeTab === 'all' || c.kind === activeTab),
      ),
    [cards, selectedStudent, activeTab],
  );

  const summary = useMemo(() => {
    const scored = visible.flatMap((c) => c.lines).map((l) => ({ l, s20: outOfTwenty(l) })).filter((x) => x.s20 !== null);
    const avg = scored.length === 0 ? null : scored.reduce((sum, x) => sum + (x.s20 as number), 0) / scored.length;
    const best = scored.reduce<{ subject: string; s20: number } | null>(
      (top, x) => (x.s20! > (top?.s20 ?? -1) ? { subject: x.l.subject ?? '—', s20: x.s20! } : top), null);
    const lastPublished = visible.map((c) => c.publishedAt).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
    const counts = BANDS.map((b) => ({
      band: b,
      count: scored.filter((x) => bandOf(x.s20)?.key === b.key).length,
    }));
    // Standing of the learner's newest ranked card in this view (the server
    // ranks among published classmates of the same term and delivery).
    const newestRanked = visible
      .filter((c) => c.rank !== null)
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || b.version - a.version)[0];
    const standing = newestRanked ? { rank: newestRanked.rank as number, of: newestRanked.rankOf as number } : null;
    return { subjectCount: scored.length, avg, best, lastPublished, counts, standing };
  }, [visible]);

  if (isBusDriver) {
    return (
      <AccessDeniedGate
        title="عدم دسترسی به نمرات و کارنامه تحصیلی دانش‌آموزان"
        requiredRoleOrPermission="reportcards.view (دانش‌آموز، اولیا یا کادر آموزشی)"
        reason="بر اساس اصول ۱۸ و ۳۶ سند جامع حاکمیت داده، حساب کاربری راننده سرویس فاقد هرگونه دسترسی به اطلاعات تحصیلی، نمرات و کارنامه‌های دانش‌آموزان می‌باشد."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  if (!canView) {
    return (
      <AccessDeniedGate
        title="عدم دسترسی به کارنامه تحصیلی"
        requiredRoleOrPermission="reportcards.view"
        reason="حساب فعال شما مجوز مشاهده کارنامه منتشرشده را ندارد؛ نمره‌های پیش‌نویس و تأییدشده فقط برای کادر آموزشی قابل مشاهده است."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const learnerLabel = cards.find((c) => (c.studentUlid ?? c.studentName) === selectedStudent)?.studentName ?? '';
  const initials = learnerLabel.trim().charAt(0) || '—';
  const learnerUlid = cards.find((c) => (c.studentUlid ?? c.studentName) === selectedStudent)?.studentUlid ?? null;

  // The paper is the server's fixed A4 template, not a screenshot of this page.
  const printOfficial = async () => {
    if (!learnerUlid) return;
    setPrinting(true);
    setPrintError(null);
    try {
      const url = await ApiReportCardPrintService.bundle({ students: [learnerUlid] });
      if (!window.open(url, '_blank')) {
        setPrintError('مرورگر تب چاپ را بست؛ اجازهٔ پاپ‌آپ را به این سایت بدهید.');
      }
    } catch (e) {
      setPrintError(e instanceof ApiError ? e.firstError() : 'خطا در تولید سند چاپ');
    } finally {
      setPrinting(false);
    }
  };

  // Fold the approved scores into an official version — the draft then reads
  // as published here and reaches the family's paper.
  const publishCard = async (card: ReportCardRow) => {
    if (card.termId === null || !card.studentUlid) return;
    setPublishing(card.ulid);
    setPublishError(null);
    try {
      await ApiReportCardService.publish(card.studentUlid, card.termId, card.kind);
      await load();
    } catch (e) {
      setPublishError(e instanceof ApiError ? e.firstError() : 'خطا در انتشار کارنامه');
    } finally {
      setPublishing(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          isStudent
            ? 'کارنامه تحصیلی من'
            : isFamily
            ? `کارنامه تحصیلی فرزند — ${learnerLabel}`
            : `کارنامه تحصیلی — ${learnerLabel || 'انتخاب پرونده'}`
        }
        subtitle={hasAccess('reportcards:view_draft')
          ? 'کارنامه‌های منتشرشده و پیش‌نویسِ مجاز در این نما می‌آید؛ برگهٔ چاپی فقط از نسخهٔ منتشرشده صادر می‌شود'
          : 'فقط کارنامه‌های منتشرشده در این نمای رسمی نمایش داده می‌شوند'}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <RolePermissionBadge level="view_only" scopeLabel="کارنامه منتشرشده" />
            {hasAccess('reportcards:export_pdf') && (
              <Button
                variant="outline"
                size="sm"
                icon={<Printer size={15} />}
                disabled={learnerUlid === null}
                loading={printing}
                onClick={printOfficial}
              >
                چاپ نسخه رسمی
              </Button>
            )}
          </div>
        }
      />

      {printError && (
        <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 print:hidden">
          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle size={15} />
            <span className="font-bold">{printError}</span>
          </div>
        </Card>
      )}

      {publishError && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 print:hidden">
          <div className="flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200">
            <AlertCircle size={15} />
            <span className="font-bold">{publishError}</span>
          </div>
        </Card>
      )}

      {isTeacher && (
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs flex items-center justify-between gap-3 flex-wrap print:hidden">
          <p className="text-blue-900 dark:text-blue-200 leading-relaxed">
            این صفحه کارنامهٔ منتشرشدهٔ دانش‌آموزان است. برای وارد کردن یا اصلاح نمرهٔ کلاس‌های خود به دفتر نمره بروید.
          </p>
          <Link to="/grade-entry">
            <Button variant="primary" size="sm" icon={<GraduationCap size={14} />}>دفتر نمره و ثبت نمره</Button>
          </Link>
        </div>
      )}

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 print:hidden">
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
              <AlertCircle size={15} />
              <span className="font-bold">{error}</span>
            </div>
            <Button variant="primary" size="sm" onClick={load}>تلاش دوباره</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={30} className="animate-spin text-[#2457C5]" />
        </div>
      ) : (
        <>
          {learners.length > 1 && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2 text-xs print:hidden">
              <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                <Users size={16} className="text-[#2457C5]" />
                پرونده تحصیلی:
              </span>
              {learners.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setSelectedStudent(l.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                    selectedStudent === l.key
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
                  )}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}

          {learners.length === 0 && !error && (
            <Card>
              <EmptyState
                title="هنوز کارنامه‌ای منتشر نشده است"
                description="کارنامه پس از تأیید نمرات توسط معاونت آموزشی و انتشار رسمی، برای دانش‌آموز و اولیا قابل مشاهده است."
              />
            </Card>
          )}

          {learners.length > 0 && (
            <Tabs
              className="print:hidden"
              tabs={[
                { id: 'all', label: 'همهٔ کارنامه‌ها' },
                { id: 'in_person', label: 'آزمون‌های حضوری' },
                { id: 'online', label: 'سنجش آنلاین و مستمر' },
              ]}
              activeId={activeTab}
              onChange={(id) => setActiveTab(id as typeof activeTab)}
            />
          )}

          {/* ── official header of the document ── */}
          {learners.length > 0 && (
            <div className="rounded-3xl border border-[#DCE3EE] dark:border-[#344257] bg-gradient-to-l from-[#F0F4FA] via-white to-white dark:from-[#101722] dark:via-[#182231] dark:to-[#182231] overflow-hidden">
              <div className="p-5 flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-3.5 flex-1 min-w-[240px]">
                  <div className="w-14 h-14 rounded-2xl bg-[#2457C5] dark:bg-[#8BAEFF] text-white dark:text-[#101722] flex items-center justify-center text-2xl font-black shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-[#202B3C] dark:text-[#F1F5FB] truncate">{learnerLabel || '—'}</h2>
                    <p className="text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-0.5">
                      {visible[0]?.term ?? 'بدون ترم'} · {toPersianDigits(visible.length)} کارنامه منتشرشده
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Badge variant="success"><CheckCircle2 size={12} /> منتشرشده و نهایی</Badge>
                      {summary.lastPublished && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Calendar size={11} /> آخرین ابلاغ {formatJalaliDateTime(summary.lastPublished)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ScoreRing avg={summary.avg} />
                  <div className="text-right">
                    <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] block">میانگین کل از ۲۰</span>
                    <span className={cn('text-sm font-bold', bandOf(summary.avg)?.text ?? 'text-slate-400')}>
                      {bandOf(summary.avg)?.label ?? '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* descriptive distribution — how the file reads at a glance */}
              {summary.subjectCount > 0 && (
                <div className="px-5 pb-4">
                  <div className="flex h-2 rounded-full overflow-hidden bg-[#F0F4FA] dark:bg-[#222F42]">
                    {summary.counts.filter((c) => c.count > 0).map((c) => (
                      <div key={c.band.key} className={c.band.bar} style={{ width: `${(c.count / summary.subjectCount) * 100}%` }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-[#526176] dark:text-[#B3C0D2]">
                    {summary.counts.map((c) => (
                      <span key={c.band.key} className="flex items-center gap-1.5">
                        <span className={cn('w-2 h-2 rounded-full', c.band.bar)} />
                        {c.band.label}: {toPersianDigits(c.count)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-5 pt-0">
                <StatTile icon={<BookOpenCheck size={13} />} label="دروس اعلام‌شده" value={`${toPersianDigits(summary.subjectCount)} درس`} hint={`در ${toPersianDigits(visible.length)} کارنامه`} />
                <StatTile icon={<Sparkles size={13} />} label="برترین درس" value={summary.best ? summary.best.subject : '—'} hint={summary.best ? `${formatScore(summary.best.s20)} از ۲۰` : undefined} />
                <StatTile icon={<TrendingUp size={13} />} label="وضعیت تحصیلی" value={bandOf(summary.avg)?.label ?? '—'} hint={summary.avg === null ? 'بدون نمره' : `${formatScore(summary.avg)} از ۲۰`} />
                <StatTile icon={<Users size={13} />} label="رتبه در کلاس" value={summary.standing ? `${toPersianDigits(summary.standing.rank)} از ${toPersianDigits(summary.standing.of)}` : '—'} hint={summary.standing ? 'میان کارنامه‌های منتشرشدهٔ هم‌کلاسی‌ها' : 'هم‌کلاسی رتبه‌گیری نشده'} />
                <StatTile icon={<FileText size={13} />} label="آخرین ابلاغ رسمی" value={summary.lastPublished ? formatJalaliDateTime(summary.lastPublished) : '—'} />
              </div>
            </div>
          )}

          {learners.length > 0 && visible.length === 0 && (
            <Card>
              <EmptyState
                title="در این نوع ارزشیابی کارنامه‌ای منتشر نشده است"
                description="برای دیدن همهٔ کارنامه‌های این پرونده، تب «همهٔ کارنامه‌ها» را انتخاب کنید."
              />
            </Card>
          )}

          {visible.map((card) => (
            <section key={card.ulid} className="rounded-3xl border border-[#DCE3EE] dark:border-[#344257] bg-[#FAFBFD] dark:bg-[#131C2E] p-4 sm:p-5">
              <header className="flex items-center justify-between gap-3 flex-wrap pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] flex items-center justify-center">
                    <BookOpenCheck size={17} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                      {KIND_LABEL[card.kind] ?? 'کارنامه تحصیلی'}
                    </h3>
                    <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2]">
                      {card.term ?? '—'} · نسخه {toPersianDigits(card.version)} · {card.studentName}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasAccess('grades:publish') && (card.status === 'draft' || card.status === 'approved') && card.termId !== null && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={publishing === card.ulid}
                      onClick={() => publishCard(card)}
                      className="print:hidden"
                    >
                      {publishing === card.ulid ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                      انتشار رسمی
                    </Button>
                  )}
                  {card.rank !== null && card.rankOf !== null && (
                    <Badge variant="neutral">
                      <Users size={12} /> رتبه {toPersianDigits(card.rank)} از {toPersianDigits(card.rankOf)}
                    </Badge>
                  )}
                  <Badge variant={card.status === 'published' ? 'success' : 'neutral'}>
                    {card.status === 'published' ? 'منتشرشده' : card.status === 'superseded' ? 'جایگزین‌شده' : 'پیش‌نویس'}
                  </Badge>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <FileText size={12} />
                    {card.publishedAt ? formatJalaliDateTime(card.publishedAt) : '—'}
                  </span>
                </div>
              </header>

              {card.lines.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DCE3EE] dark:border-[#344257] p-8 text-center text-xs text-slate-400">
                  سطر نمره‌ای برای این کارنامه ثبت نشده است.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {card.lines.map((line, idx) => <SubjectCard key={`${card.ulid}-${idx}`} line={line} index={idx} />)}
                </div>
              )}

              <footer className="mt-4 pt-3 border-t border-[#DCE3EE] dark:border-[#344257] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#526176] dark:text-[#B3C0D2]">
                <span className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                  این کارنامه پس از تأیید معاونت آموزشی در سامانه صادر شده است.
                </span>
                <span className="font-mono tabular-nums">شناسه رسمی: {card.ulid}</span>
              </footer>
            </section>
          ))}

          <div className="flex items-center gap-2 text-[11px] text-slate-400 print:hidden">
            <AlertCircle size={13} />
            نمره‌هایی که هنوز منتشر نشده‌اند (پیش‌نویس یا تأییدشده) در این نمای رسمی نمایش داده نمی‌شوند.
          </div>
        </>
      )}
    </div>
  );
};
