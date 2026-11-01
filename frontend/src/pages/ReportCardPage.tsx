import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award, Printer, CheckCircle2, FileText, Calendar, ShieldCheck,
  Users, AlertCircle, Loader2, GraduationCap, BookOpenCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Card, Button, Badge, Tabs, PageHeader, EmptyState, AccessDeniedGate, RolePermissionBadge,
} from '../components/common';
import { toPersianDigits, formatScore, cn } from '../utils/persian';
import { formatJalaliDateTime } from '../utils/jalali';
import { ApiReportCardService, ReportCardLineRow, ReportCardRow } from '../api/data';
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
function outOfTwenty(line: ReportCardLineRow): string {
  if (line.score === null) return '—';
  if (!line.maxScore || line.maxScore === 20) return formatScore(line.score);
  return formatScore((line.score / line.maxScore) * 20);
}

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
    const scored = visible.flatMap((c) => c.lines).filter((l) => l.score !== null);
    const convertible = scored.filter((l) => l.maxScore);
    const avg =
      convertible.length === 0
        ? null
        : convertible.reduce((sum, l) => sum + ((l.score as number) / (l.maxScore as number)) * 20, 0) / convertible.length;
    const lastPublished = visible
      .map((c) => c.publishedAt)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? null;
    return { subjectCount: scored.length, avg, lastPublished };
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

  const learnerLabel = visible[0]?.studentName ?? selectedStudent ?? '';

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          isStudent
            ? `کارنامه تحصیلی من — ${currentUser.fullName}`
            : isFamily
            ? `کارنامه تحصیلی فرزند — ${learnerLabel}`
            : `کارنامه تحصیلی — ${learnerLabel || 'انتخاب پرونده'}`
        }
        subtitle="فقط کارنامه‌های منتشرشده در این نمای رسمی نمایش داده می‌شوند"
        actions={
          <div className="flex items-center gap-2">
            <RolePermissionBadge level="view_only" scopeLabel="کارنامه منتشرشده" />
            <Button variant="outline" size="sm" icon={<Printer size={15} />} onClick={() => window.print()}>
              چاپ نسخه رسمی
            </Button>
          </div>
        }
      />

      {isTeacher && (
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs flex items-center justify-between gap-3 flex-wrap">
          <p className="text-blue-900 dark:text-blue-200 leading-relaxed">
            این صفحه کارنامهٔ منتشرشدهٔ دانش‌آموزان است. برای وارد کردن یا اصلاح نمرهٔ کلاس‌های خود به دفتر نمره بروید.
          </p>
          <Link to="/grade-entry">
            <Button variant="primary" size="sm" icon={<GraduationCap size={14} />}>دفتر نمره و ثبت نمره</Button>
          </Link>
        </div>
      )}

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
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
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2 text-xs">
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
              tabs={[
                { id: 'all', label: 'همهٔ کارنامه‌ها' },
                { id: 'in_person', label: 'آزمون‌های حضوری' },
                { id: 'online', label: 'سنجش آنلاین و مستمر' },
              ]}
              activeId={activeTab}
              onChange={(id) => setActiveTab(id as typeof activeTab)}
            />
          )}

          {learners.length > 0 && (
            <Card className="text-right border-blue-200 dark:border-blue-900/50 bg-gradient-to-r from-blue-50/40 to-white dark:from-blue-950/20 dark:to-[#182231]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">میانگین از ۲۰</span>
                  <div className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums mt-1">
                    {summary.avg === null ? '—' : formatScore(summary.avg)}
                  </div>
                  <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-0.5 block">
                    بر مبنای نمرات منتشرشده
                  </span>
                </div>

                <div>
                  <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">دروس اعلام‌شده</span>
                  <div className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums mt-1">
                    {toPersianDigits(summary.subjectCount)}
                  </div>
                  <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-0.5 block">
                    در {toPersianDigits(visible.length)} کارنامه
                  </span>
                </div>

                <div>
                  <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">آخرین ابلاغ رسمی</span>
                  <div className="mt-1 text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-1.5">
                    <Calendar size={15} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                    <span>{summary.lastPublished ? formatJalaliDateTime(summary.lastPublished) : '—'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-[#526176] dark:text-[#B3C0D2] block">وضعیت</span>
                  <div className="mt-1 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                    <CheckCircle2 size={16} />
                    <span>منتشرشده و نهایی</span>
                  </div>
                </div>
              </div>
            </Card>
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
            <Card key={card.ulid}>
              <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
                <div className="flex items-center gap-2 text-right">
                  <BookOpenCheck size={18} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                  <div className="text-right">
                    <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                      {KIND_LABEL[card.kind] ?? 'کارنامه تحصیلی'}
                    </h3>
                    <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2]">
                      {card.term ?? '—'} · نسخه {toPersianDigits(card.version)} · {card.studentName}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={card.status === 'published' ? 'success' : 'neutral'}>
                    {card.status === 'published'
                      ? 'منتشرشده'
                      : card.status === 'superseded'
                      ? 'جایگزین‌شده'
                      : 'پیش‌نویس'}
                  </Badge>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <FileText size={12} />
                    {card.publishedAt ? formatJalaliDateTime(card.publishedAt) : '—'}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto pt-2">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-[#DCE3EE] dark:border-[#344257] text-[#526176] dark:text-[#B3C0D2]">
                      <th className="pb-3 pr-2 font-medium">عنوان درس</th>
                      <th className="pb-3 font-medium text-center">نمره خام</th>
                      <th className="pb-3 font-medium text-center">نمره از ۲۰</th>
                      <th className="pb-3 font-medium text-center">نوع ارزشیابی</th>
                      <th className="pb-3 font-medium">توضیح دبیر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE3EE]/60 dark:divide-[#344257]/60">
                    {card.lines.map((line, idx) => (
                      <tr key={`${card.ulid}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 pr-2 font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                          {line.subject ?? '—'}
                        </td>
                        <td className="py-3 text-center font-mono tabular-nums">
                          {line.score === null
                            ? '—'
                            : line.maxScore
                            ? `${formatScore(line.score)} از ${toPersianDigits(line.maxScore)}`
                            : formatScore(line.score)}
                        </td>
                        <td className="py-3 text-center font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                          {outOfTwenty(line)}
                        </td>
                        <td className="py-3 text-center text-[#526176] dark:text-[#B3C0D2]">
                          {line.sourceType ? SOURCE_LABEL[line.sourceType] ?? line.sourceType : '—'}
                        </td>
                        <td className="py-3 text-[#526176] dark:text-[#B3C0D2]">{line.teacherComment ?? '—'}</td>
                      </tr>
                    ))}
                    {card.lines.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          سطر نمره‌ای برای این کارنامه ثبت نشده است.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 pt-4 border-t border-[#DCE3EE] dark:border-[#344257] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#526176] dark:text-[#B3C0D2]">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                  <span>این کارنامه پس از تأیید معاونت آموزشی در سامانه صادر شده است.</span>
                </div>
                <span className="font-mono text-[11px] tabular-nums">شناسه رسمی: {card.ulid}</span>
              </div>
            </Card>
          ))}

          <div className="flex items-center gap-2 text-[11px] text-slate-400 text-right">
            <Award size={13} />
            نمره‌هایی که هنوز منتشر نشده‌اند (پیش‌نویس یا تأییدشده) در این نمای رسمی نمایش داده نمی‌شوند.
          </div>
        </>
      )}
    </div>
  );
};
