import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles, TrendingUp, CheckCircle2, Target, Lightbulb, AlertCircle,
  Loader2, Users, BookOpen, ClipboardList,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, Button, PageHeader, AccessDeniedGate, RolePermissionBadge, EmptyState } from '../components/common';
import { toPersianDigits, formatScore } from '../utils/persian';
import {
  ApiAcademicService, ApiReportCardService,
  GradeSummary, GradeRoster, ReportCardRow, TeachingSubject,
} from '../api/data';
import { ApiError } from '../api/client';

/**
 * Learning analytics — every figure here is computed from records the
 * school actually stored (published grades, report-card lines, grade book).
 * Nothing is generated: comparative claims (strong/weak subjects, term trend)
 * only render when enough real rows exist to support them.
 */

const SOURCE_LABELS: Record<string, string> = {
  exam: 'آزمون آنلاین',
  assignment: 'تکلیف',
  in_person_exam: 'آزمون حضوری',
  manual: 'ثبت دستی',
};

/** Any score onto the official ۲۰-point scale; a missing ceiling means it already is /۲۰. */
function toTwenty(score: number, max: number | null): number {
  return max && max > 0 ? (score / max) * 20 : score;
}

const sourceLabel = (row: GradeSummary | ReportCardLineLike): string => {
  const key = 'sourceType' in row ? row.sourceType : null;
  return (key && SOURCE_LABELS[key]) || 'ارزشیابی';
};

interface ReportCardLineLike {
  sourceType: string | null;
}

interface SubjectStat {
  subject: string;
  average: number;
  records: GradeSummary[];
}

function scoreOf(row: GradeSummary): number | null {
  return row.score === null ? null : toTwenty(row.score, row.maxScore);
}

function subjectStats(rows: GradeSummary[]): SubjectStat[] {
  const groups = new Map<string, GradeSummary[]>();
  rows.forEach((r) => {
    if (scoreOf(r) === null) return;
    const key = r.subject ?? 'بدون نام درس';
    groups.set(key, [...(groups.get(key) ?? []), r]);
  });

  return [...groups.entries()]
    .map(([subject, records]) => ({
      subject,
      records,
      average: records.reduce((sum, r) => sum + (scoreOf(r) ?? 0), 0) / records.length,
    }))
    .sort((a, b) => b.average - a.average);
}

function overallAverage(rows: GradeSummary[]): number | null {
  const values = rows.map(scoreOf).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function termTrend(rows: GradeSummary[]): { term: string; average: number; count: number }[] {
  const groups = new Map<string, number[]>();
  rows.forEach((r) => {
    const value = scoreOf(r);
    if (value === null) return;
    const key = r.term ?? 'بدون دوره';
    groups.set(key, [...(groups.get(key) ?? []), value]);
  });

  return [...groups.entries()].map(([term, values]) => ({
    term,
    average: values.reduce((a, b) => a + b, 0) / values.length,
    count: values.length,
  }));
}

export const SmartPerformanceAnalysisPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();
  const group = activeRole.group;
  const isStaff = group === 'faculty' || group === 'school_admin' || group === 'platform';
  const isLearnerSide = group === 'student' || group === 'family';

  // Class-level analysis needs the grade book; learners get their own rows.
  const classView = isStaff && (hasAccess('grades:record') || hasAccess('grades:view'));
  const canView = classView || ((hasAccess('grades:view') || hasAccess('reportcards:view')) && isLearnerSide);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Learner side
  const [rows, setRows] = useState<GradeSummary[]>([]);
  const [cards, setCards] = useState<ReportCardRow[]>([]);
  const [learner, setLearner] = useState<string | null>(null);

  // Staff side
  const [subjects, setSubjects] = useState<TeachingSubject[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [roster, setRoster] = useState<GradeRoster | null>(null);

  const loadLearner = useCallback(async () => {
    const [grades, reportCards] = await Promise.all([
      ApiAcademicService.grades().catch(() => [] as GradeSummary[]),
      ApiReportCardService.list().catch(() => [] as ReportCardRow[]),
    ]);
    setRows(grades);
    setCards(reportCards);
    setLearner((prev) => prev ?? grades[0]?.studentName ?? reportCards[0]?.studentName ?? null);
  }, []);

  const loadClass = useCallback(async (csId: number) => {
    const terms = await ApiAcademicService.terms().catch(() => []);
    // terms() is newest-first, so index 0 is the current period.
    setRoster(await ApiAcademicService.roster(csId, terms[0]?.id ?? null));
  }, []);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (classView) {
          const list = await ApiAcademicService.mySubjects();
          if (cancelled) return;
          setSubjects(list);
          setSubjectId(list[0]?.id ?? null);
        } else {
          await loadLearner();
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت داده‌های تحلیل');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, classView]);

  useEffect(() => {
    if (!classView || subjectId === null) return;
    loadClass(subjectId).catch((e) => setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت دفتر نمره'));
  }, [classView, subjectId, loadClass]);

  const learnerRows = useMemo(
    () => (learner ? rows.filter((r) => r.studentName === learner) : rows),
    [rows, learner],
  );
  const learnerNames = useMemo(
    () => [...new Set(rows.map((r) => r.studentName).concat(cards.map((c) => c.studentName)))],
    [rows, cards],
  );

  if (!canView) {
    return (
      <AccessDeniedGate
        title="دسترسی به تحلیل عملکرد آموزشی"
        requiredRoleOrPermission="grades.view یا reportcards.view"
        reason="این گزارش از نمرات ثبت‌شده ساخته می‌شود؛ بنابراین فقط برای دانش‌آموز، ولیِ مجاز و کادر آموزشی قابل مشاهده است."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={26} className="animate-spin text-[#2457C5]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={classView ? 'تحلیل پیشرفت دانش‌آموزان' : `تحلیل هوشمند و شناختی یادگیری${learner ? ` — ${learner}` : ''}`}
        subtitle={isLearnerSide ? 'گزارش تحلیلی از نمرات منتشرشدهٔ شما — نقاط قوت، مباحث نیازمند تمرین و روند پیشرفت' : 'محاسبه از نمرات و بازخوردهای ثبت‌شده در سامانه — بدون هیچ عدد ساختگی'}
        actions={
          <div className="flex items-center gap-2">
            <RolePermissionBadge level="view_only" scopeLabel={classView ? 'دفتر نمره کلاس' : 'سوابق تحصیلی خود'} />
          </div>
        }
      />

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {isStaff && (<div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs text-[#202B3C] dark:text-[#F1F5FB] flex items-start gap-2 text-right">
        <Sparkles size={16} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0 mt-0.5" />
        <span>
          <strong>یادداشت روش‌شناختی:</strong> میانگین‌ها از نمرات منتشرشده (تبدیل‌شده به مقیاس ۲۰) محاسبه می‌شوند.
          مقایسهٔ دروس و روند بین دوره‌ها فقط زمانی نمایش داده می‌شود که دست‌کم دو رکورد واقعی برای آن وجود داشته باشد؛
          این گزارش جایگزین ارزیابی حضوری دبیر و مشاور نیست.
        </span>
      </div>)}

      {classView ? (
        <ClassAnalysis
          subjects={subjects}
          subjectId={subjectId}
          onSubject={(id) => setSubjectId(id)}
          roster={roster}
        />
      ) : (
        <LearnerAnalysis
          names={learnerNames}
          active={learner}
          onSelect={setLearner}
          rows={learnerRows}
          cards={cards.filter((c) => learner === null || c.studentName === learner)}
        />
      )}
    </div>
  );
};

// ── Learner (student / guardian) ─────────────────────────────────────────

const LearnerAnalysis: React.FC<{
  names: string[];
  active: string | null;
  onSelect: (name: string) => void;
  rows: GradeSummary[];
  cards: ReportCardRow[];
}> = ({ names, active, onSelect, rows, cards }) => {
  const overall = overallAverage(rows);
  const stats = subjectStats(rows);
  const trend = termTrend(rows);
  const comments = cards.flatMap((c) => c.lines.filter((l) => l.teacherComment).map((l) => ({ card: c, line: l })));

  const strongest = stats.length >= 2 ? stats[0] : null;
  const weakest = stats.length >= 2 ? stats[stats.length - 1] : null;
  const above = strongest && overall !== null && strongest.average - overall >= 1 ? strongest : null;
  const below = weakest && overall !== null && overall - weakest.average >= 1 ? weakest : null;

  return (
    <div className="space-y-6">
      {names.length > 1 && (
        <Card className="p-3.5 flex flex-wrap items-center gap-2 text-right">
          <Users size={15} className="text-[#2457C5]" />
          <span className="text-xs font-bold text-[#526176] dark:text-[#B3C0D2]">انتخاب پرونده تحصیلی:</span>
          {names.map((n) => (
            <button
              key={n}
              onClick={() => onSelect(n)}
              className={
                n === active
                  ? 'px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white cursor-pointer'
                  : 'px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer'
              }
            >
              {n}
            </button>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">میانگین از ۲۰</span>
          <div className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums mt-1">
            {overall === null ? '—' : formatScore(overall)}
          </div>
        </Card>
        <Card className="p-4 text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">نمرات منتشرشده</span>
          <div className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums mt-1">
            {toPersianDigits(rows.length)}
          </div>
        </Card>
        <Card className="p-4 text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">دروس با سابقه ارزشیابی</span>
          <div className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums mt-1">
            {toPersianDigits(stats.length)}
          </div>
        </Card>
        <Card className="p-4 text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">کارنامه منتشرشده</span>
          <div className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums mt-1">
            {toPersianDigits(cards.length)}
          </div>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            title="هنوز نمره منتشرشده‌ای ثبت نشده است"
            description="تحلیل، مستقیماً از نمرات منتشرشدهٔ کارنامه ساخته می‌شود. پس از تأیید و انتشار اولین نمره، این گزارش پر می‌شود."
            icon={<BookOpen size={24} />}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths */}
          <Card className="text-right border-emerald-200 dark:border-emerald-900/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                <CheckCircle2 size={18} />
                <span>نقاط قوت مستند</span>
              </div>
              <Badge variant="success">محاسبه‌شده</Badge>
            </div>

            {above ? (
              <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs">
                <h4 className="font-bold text-emerald-900 dark:text-emerald-200 mb-1">{above.subject}</h4>
                <p className="text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                  میانگین این درس {formatScore(above.average)} از ۲۰ است؛ {toPersianDigits(Math.round((above.average - (overall ?? 0)) * 100) / 100)} نمره بالاتر از میانگین کل.
                </p>
                <div className="mt-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-900/30 text-[11px] text-emerald-700 dark:text-emerald-400">
                  <strong>شاهد عینی: </strong>
                  {above.records.map((r) => `${sourceLabel(r)} ${formatScore(r.score ?? 0)} از ${toPersianDigits(r.maxScore ?? 20)}`).join(' · ')}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                برای اعلام نقطه قوت، دست‌کم دو درس با نمره و فاصلهٔ معنادار از میانگین لازم است.
                در حال حاضر {toPersianDigits(stats.length)} درس با سابقه ارزشیابی ثبت شده است.
              </p>
            )}
          </Card>

          {/* Needs practice */}
          <Card className="text-right border-amber-200 dark:border-amber-900/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                <Target size={18} />
                <span>مباحث نیازمند تمرین</span>
              </div>
              <Badge variant="warning">فرصت بهبود</Badge>
            </div>

            {below ? (
              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                <h4 className="font-bold text-amber-950 dark:text-amber-200 mb-1">{below.subject}</h4>
                <p className="text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                  میانگین این درس {formatScore(below.average)} از ۲۰ است و {toPersianDigits(Math.round(((overall ?? 0) - below.average) * 100) / 100)} نمره پایین‌تر از میانگین کل قرار دارد.
                </p>
                <div className="mt-2 pt-2 border-t border-amber-200/50 dark:border-amber-900/30 text-[11px] text-amber-800 dark:text-amber-400">
                  <strong>شاهد عینی: </strong>
                  {below.records.map((r) => `${sourceLabel(r)} ${formatScore(r.score ?? 0)} از ${toPersianDigits(r.maxScore ?? 20)}`).join(' · ')}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                افت معناداری بین دروس ثبت نشده است؛ این نتیجه با داده‌های فعلی قابل اعلام نیست.
              </p>
            )}
          </Card>

          {/* Trend */}
          <Card className="text-right p-5">
            <div className="flex items-center gap-2 mb-3 text-[#2457C5] dark:text-[#8BAEFF] font-bold text-sm">
              <TrendingUp size={18} />
              <span>روند بین دوره‌های ارزشیابی</span>
            </div>

            {trend.length >= 2 ? (
              <div className="space-y-2.5 text-xs">
                {trend.map((t) => (
                  <div key={t.term} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                    <span>
                      {t.term}
                      <span className="text-[10px] text-slate-500 block">{toPersianDigits(t.count)} نمره ثبت‌شده</span>
                    </span>
                    <strong className="font-mono tabular-nums">{formatScore(t.average)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                برای ترسیم روند، نمرات منتشرشده در دست‌کم دو دوره لازم است.
                در حال حاضر {toPersianDigits(trend.length)} دوره با سابقه نمره وجود دارد.
              </p>
            )}
          </Card>

          {/* Evidence + teacher feedback */}
          <Card className="text-right p-5">
            <div className="flex items-center gap-2 mb-3 text-[#2457C5] dark:text-[#8BAEFF] font-bold text-sm">
              <Lightbulb size={18} />
              <span>شواهد عینی و بازخورد دبیران</span>
            </div>

            <div className="space-y-2.5 text-xs max-h-64 overflow-y-auto">
              {rows.map((r) => (
                <div key={r.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-start justify-between gap-2">
                  <div className="text-right">
                    <strong className="block text-[#202B3C] dark:text-[#F1F5FB]">{r.subject ?? '—'}</strong>
                    <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2]">
                      {sourceLabel(r)}{r.term ? ` · ${r.term}` : ''}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                    {formatScore(r.score ?? 0)} از {toPersianDigits(r.maxScore ?? 20)}
                  </span>
                </div>
              ))}

              {comments.map(({ card, line }, i) => (
                <div key={`${card.ulid}-${i}`} className="p-2.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257]">
                  <strong className="text-[#2457C5] dark:text-[#8BAEFF] block">بازخورد {line.subject ?? '—'}:</strong>
                  <span className="text-[#526176] dark:text-[#B3C0D2]">{line.teacherComment}</span>
                </div>
              ))}

              {comments.length === 0 && (
                <p className="text-[11px] text-[#526176] dark:text-[#B3C0D2]">
                  بازخورد نوشتاری دبیر در کارنامه‌ها ثبت نشده است؛ توصیه‌های آموزشی باید از خود دبیر گرفته شود.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// ── Staff (teacher / faculty / admin) ────────────────────────────────────

const BUCKETS: { label: string; from: number; to: number }[] = [
  { label: '۱۸ تا ۲۰', from: 18, to: 20.0001 },
  { label: '۱۵ تا ۱۸', from: 15, to: 18 },
  { label: '۱۰ تا ۱۵', from: 10, to: 15 },
  { label: 'زیر ۱۰', from: 0, to: 10 },
];

const ClassAnalysis: React.FC<{
  subjects: TeachingSubject[];
  subjectId: number | null;
  onSubject: (id: number) => void;
  roster: GradeRoster | null;
}> = ({ subjects, subjectId, onSubject, roster }) => {
  if (subjects.length === 0) {
    return (
      <Card className="p-10">
        <EmptyState
          title="درسی در برنامه هفتگی شما ثبت نشده است"
          description="تحلیل کلاس از دفتر نمرهٔ درس‌هایی ساخته می‌شود که به شما سپرده شده است. پس از تعریف درس در برنامه هفتگی، این گزارش فعال می‌شود."
          icon={<BookOpen size={24} />}
        />
      </Card>
    );
  }

  const rows = roster?.rows ?? [];
  const scored = rows.filter((r) => r.avgOutOf20 !== null);
  const missing = rows.length - scored.length;

  const buckets = BUCKETS.map((b) => ({
    ...b,
    count: scored.filter((r) => (r.avgOutOf20 as number) >= b.from && (r.avgOutOf20 as number) < b.to).length,
  }));

  const ranked = [...scored].sort((a, b) => (b.avgOutOf20 as number) - (a.avgOutOf20 as number));
  const top = ranked.slice(0, 3);
  const tail = ranked.slice(-3).reverse();

  return (
    <div className="space-y-6">
      <Card className="p-4 text-right flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs font-bold text-[#526176] dark:text-[#B3C0D2]" htmlFor="analysis-class">
            درس و کلاس:
          </label>
          <select
            id="analysis-class"
            value={subjectId ?? ''}
            onChange={(e) => onSubject(Number(e.target.value))}
            className="text-sm p-2 rounded-xl bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] focus:outline-none"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.subject} — {s.classroom}</option>
            ))}
          </select>
          {roster?.classroom && <Badge variant="primary">{roster.classroom}</Badge>}
        </div>
        <Link to="/grade-entry" className="text-xs font-bold text-[#2457C5] dark:text-[#8BAEFF] flex items-center gap-1.5">
          <ClipboardList size={14} /> دفتر نمره و ثبت نمره
        </Link>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">میانگین کلاس از ۲۰</span>
          <div className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums mt-1">
            {roster?.classAvgOutOf20 === null || roster?.classAvgOutOf20 === undefined ? '—' : formatScore(roster.classAvgOutOf20)}
          </div>
        </Card>
        <Card className="p-4 text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">دانش‌آموزان کلاس</span>
          <div className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums mt-1">
            {toPersianDigits(rows.length)}
          </div>
        </Card>
        <Card className="p-4 text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">دارای نمره</span>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
            {toPersianDigits(scored.length)}
          </div>
        </Card>
        <Card className="p-4 text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">بدون نمره</span>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-400 tabular-nums mt-1">
            {toPersianDigits(missing)}
          </div>
        </Card>
      </div>

      {scored.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            title="دفتر نمره این کلاس هنوز پر نشده است"
            description="با ثبت اولین نمره در دفتر نمره، توزیع کلاس و رتبه‌بندی دانش‌آموزان از همان داده‌های واقعی محاسبه می‌شود."
            actionLabel="رفتن به دفتر نمره"
            onAction={() => { window.location.href = '/grade-entry'; }}
            icon={<Target size={24} />}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="text-right p-5">
            <div className="flex items-center gap-2 mb-3 text-[#2457C5] dark:text-[#8BAEFF] font-bold text-sm">
              <Users size={18} />
              <span>توزیع نمرات کلاس (از ۲۰)</span>
            </div>
            <div className="space-y-2.5 text-xs">
              {buckets.map((b) => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-[#526176] dark:text-[#B3C0D2]">{b.label}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#2457C5] dark:bg-[#8BAEFF]"
                      style={{ width: `${scored.length === 0 ? 0 : (b.count / scored.length) * 100}%` }}
                    />
                  </div>
                  <strong className="tabular-nums w-8 text-left">{toPersianDigits(b.count)}</strong>
                </div>
              ))}
            </div>
          </Card>

          <Card className="text-right p-5">
            <div className="flex items-center gap-2 mb-3 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
              <CheckCircle2 size={18} />
              <span>بالاترین و پایین‌ترین میانگین ثبت‌شده</span>
            </div>
            <div className="space-y-2 text-xs">
              {top.map((r) => (
                <div key={r.studentUlid} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30">
                  <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">{r.studentName}</span>
                  <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">{formatScore(r.avgOutOf20 ?? 0)}</span>
                </div>
              ))}
              {tail.filter((r) => !top.includes(r)).map((r) => (
                <div key={r.studentUlid} className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/30">
                  <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">{r.studentName}</span>
                  <span className="font-mono tabular-nums text-amber-800 dark:text-amber-400">{formatScore(r.avgOutOf20 ?? 0)}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-3 leading-relaxed">
              این فهرست فقط میانگین نمرات ثبت‌شدهٔ همان درس را نشان می‌دهد و رتبهٔ کل یا مقایسهٔ بین‌درسی نیست.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};
