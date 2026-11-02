import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, CheckCircle2, AlertCircle, Award, BookOpen,
  ShieldCheck, HeartHandshake, Users, ChevronLeft, Lock, CalendarDays,
} from 'lucide-react';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits, formatScore, cn } from '../../utils/persian';
import { formatJalaliDate } from '../../utils/jalali';
import {
  ApiFamilyService, ApiReportCardService, ApiAttendanceService,
  GuardianChildRow, ReportCardRow, ReportCardLineRow,
} from '../../api/data';
import { ApiError } from '../../api/client';

/** Score on the official /20 scale; a line without a ceiling is already out of ۲۰. */
const outOfTwenty = (line: ReportCardLineRow): number | null => {
  if (line.score === null) return null;
  if (!line.maxScore || line.maxScore === 20) return line.score;
  return (line.score / line.maxScore) * 20;
};

const BANDS = [
  { key: 'excellent', min: 17, label: 'خیلی خوب' },
  { key: 'good', min: 14, label: 'خوب' },
  { key: 'acceptable', min: 10, label: 'قابل قبول' },
  { key: 'needs_work', min: -1, label: 'نیاز به تلاش' },
];
const bandOf = (score20: number | null) =>
  score20 === null ? null : BANDS.find((b) => score20 >= b.min) ?? BANDS[BANDS.length - 1];

const KIND_LABEL: Record<string, string> = {
  in_person: 'کارنامه آزمون‌های حضوری',
  online: 'کارنامه سنجش آنلاین و مستمر',
};

const FlagBadge: React.FC<{ label: string; on: boolean }> = ({ label, on }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold',
      on
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
        : 'bg-slate-100 text-slate-500 dark:bg-[#222F42] dark:text-[#7C8CA5]',
    )}
  >
    {on ? <CheckCircle2 size={11} /> : <Lock size={11} />} {label}
  </span>
);

const LockedTile: React.FC<{ label: string; note: string }> = ({ label, note }) => (
  <Card className="text-right">
    <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">{label}</span>
    <div className="flex items-center gap-2 mt-2">
      <Lock size={17} className="text-slate-400 dark:text-[#5E7391]" />
      <span className="text-xs font-bold text-slate-500 dark:text-[#7C8CA5] leading-relaxed">{note}</span>
    </div>
  </Card>
);

export const ParentDashboard: React.FC = () => {
  const [children, setChildren] = useState<GuardianChildRow[]>([]);
  const [selectedUlid, setSelectedUlid] = useState<string | null>(null);
  const [cards, setCards] = useState<ReportCardRow[]>([]);
  const [timeline, setTimeline] = useState<{ date: string; period: number; subject: string | null; status: string; late_minutes: number | null }[]>([]);
  const [attendanceDenied, setAttendanceDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selected = children.find((c) => c.studentUlid === selectedUlid) ?? children[0] ?? null;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await ApiFamilyService.childrenWithFlags();
        if (!alive) return;
        setChildren(rows);
        setSelectedUlid(rows[0]?.studentUlid ?? null);
      } catch {
        if (alive) setError('خطا در دریافت پروندهٔ فرزندان');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Per-child data: the server already cuts everything to this guardian's
  // per-link flags — the flag here only decides what the UI bothers asking for.
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setCards([]);
    setTimeline([]);
    setAttendanceDenied(false);
    (async () => {
      try {
        const all = await ApiReportCardService.list();
        if (alive) setCards(all.filter((c) => c.studentUlid === selected.studentUlid));
      } catch {
        // empty list stays; the grades tile is flag-gated anyway
      }
      if (!selected.flags.can_view_attendance) {
        if (alive) setAttendanceDenied(true);
        return;
      }
      try {
        const rows = await ApiAttendanceService.studentTimeline(selected.studentUlid);
        if (alive) setTimeline(rows);
      } catch (e) {
        if (alive && e instanceof ApiError && e.status === 404) setAttendanceDenied(true);
      }
    })();
    return () => { alive = false; };
  }, [selected?.studentUlid, selected?.flags.can_view_attendance]);

  const childCards = useMemo(
    () => cards.filter((c) => c.status === 'published').sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')),
    [cards],
  );

  const gradesSummary = useMemo(() => {
    const scored = childCards.flatMap((c) => c.lines).map((l) => ({ s20: outOfTwenty(l) })).filter((x) => x.s20 !== null);
    const avg = scored.length === 0 ? null : scored.reduce((sum, x) => sum + (x.s20 as number), 0) / scored.length;
    const newestRanked = childCards.find((c) => c.rank !== null) ?? null;
    return {
      avg,
      band: bandOf(avg),
      rank: newestRanked?.rank ?? null,
      rankOf: newestRanked?.rankOf ?? null,
    };
  }, [childCards]);

  const attendanceSummary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = timeline.filter((r) => r.date === today);
    const absents = timeline.filter((r) => r.status === 'absent').length;
    const lates = timeline.filter((r) => r.status === 'late').length;
    const presents = timeline.length - absents;
    const rate = timeline.length === 0 ? null : Math.round((presents / timeline.length) * 100);
    return { todayRows, absents, lates, rate };
  }, [timeline]);

  const newestCard = childCards[0] ?? null;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="داشبورد اولیا" subtitle="در حال دریافت پروندهٔ فرزندان…" />
        <Card>
          <div className="py-12 text-center text-sm text-[#526176] dark:text-[#B3C0D2]">در حال بارگذاری…</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`داشبورد اولیا — پورتال تحصیلی ${selected?.studentName || 'فرزند'}`}
        subtitle={selected ? `پیوند شما: ${selected.linkLabel}` : 'پروندهٔ فرزند یافت نشد'}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/counseling">
              <Button variant="outline" size="sm" icon={<HeartHandshake size={15} />}>
                رزرو مشاوره
              </Button>
            </Link>
            <Link to="/report-card">
              <Button variant="primary" size="sm" icon={<Award size={15} />}>
                مشاهده کارنامه رسمی
              </Button>
            </Link>
          </div>
        }
      />

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200">
            <AlertCircle size={15} />
            <span className="font-bold">{error}</span>
          </div>
        </Card>
      )}

      {/* Child switcher — یک ولی می‌تواند چند فرزند داشته باشد */}
      {children.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {children.map((c) => (
            <button
              key={c.studentUlid}
              type="button"
              onClick={() => setSelectedUlid(c.studentUlid)}
              className={cn(
                'rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors',
                c.studentUlid === selected?.studentUlid
                  ? 'border-[#2457C5] bg-[#F0F4FA] text-[#202B3C] dark:bg-[#182231] dark:text-[#F1F5FB]'
                  : 'border-[#DCE3EE] text-[#526176] hover:border-[#2457C5]/60 dark:border-[#344257] dark:text-[#B3C0D2]',
              )}
            >
              {c.studentName}
            </button>
          ))}
        </div>
      )}

      {/* Legal & Privacy Banner (Crucial for Separated / Independent Parents) */}
      <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex items-start gap-3">
        <ShieldCheck size={20} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0 mt-0.5" />
        <div className="text-right text-xs text-[#202B3C] dark:text-[#F1F5FB] leading-relaxed">
          <p className="font-bold">امنیت و استقلال کامل داده‌های خانوادگی:</p>
          <p className="text-[#526176] dark:text-[#B3C0D2] mt-0.5">
            حساب کاربری شما به صورت کاملاً مستقل مدیریت می‌شود. شماره تماس، پیام‌های ارسالی، سوابق ورود و درخواست‌های شما تحت هیچ شرایطی به ولی دیگر یا سایر اولیا نمایش داده نمی‌شود.
          </p>
          {selected && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Badge variant="primary">{selected.linkLabel}</Badge>
              <FlagBadge label="نمرات" on={selected.flags.can_view_grades} />
              <FlagBadge label="حضور و غیاب" on={selected.flags.can_view_attendance} />
              <FlagBadge label="تحویل‌گیری" on={selected.flags.can_pickup} />
              <FlagBadge label="پیامک" on={selected.flags.can_receive_sms} />
            </div>
          )}
        </div>
      </div>

      {!selected ? (
        <Card>
          <div className="py-12 text-center text-sm text-[#526176] dark:text-[#B3C0D2]">
            هیچ پیوند فعالی بین حساب شما و دانش‌آموزان مدرسه ثبت نشده است؛ با دفتر مدرسه تماس بگیرید.
          </div>
        </Card>
      ) : (
        <>
          {/* KPI Overview Strip — هر کاشی فقط با مجوز همان پیوند پر می‌شود */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {selected.flags.can_view_grades ? (
              <Card className="text-right">
                <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">میانگین کل از ۲۰</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
                    {gradesSummary.avg === null ? '—' : formatScore(gradesSummary.avg)}
                  </span>
                  {gradesSummary.band && <Badge variant="success">{gradesSummary.band.label}</Badge>}
                </div>
                <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] block mt-1">
                  رتبه در کلاس:{' '}
                  <strong className="tabular-nums">
                    {gradesSummary.rank !== null ? `${toPersianDigits(gradesSummary.rank)} از ${toPersianDigits(gradesSummary.rankOf ?? 0)}` : '—'}
                  </strong>
                </span>
              </Card>
            ) : (
              <LockedTile label="نمرات و کارنامه" note="برای این پیوند فعال نیست" />
            )}

            {selected.flags.can_view_attendance && !attendanceDenied ? (
              <Card className="text-right">
                <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">حضور امروز</span>
                <div className="flex items-center gap-2 mt-2">
                  {attendanceSummary.todayRows.some((r) => r.status === 'absent') ? (
                    <>
                      <AlertCircle size={20} className="text-rose-600 dark:text-rose-400" />
                      <span className="text-lg font-bold text-rose-700 dark:text-rose-400">غایب</span>
                    </>
                  ) : attendanceSummary.todayRows.length > 0 ? (
                    <>
                      <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">حاضر</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-slate-500 dark:text-[#7C8CA5]">ثبتی برای امروز نیست</span>
                  )}
                </div>
                <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] block mt-1">
                  {attendanceSummary.todayRows.length > 0
                    ? `${toPersianDigits(attendanceSummary.todayRows.length)} جلسهٔ ثبت‌شده امروز`
                    : 'بر پایهٔ جلسات ثبت‌شده'}
                </span>
              </Card>
            ) : (
              <LockedTile label="حضور امروز" note="برای این پیوند فعال نیست" />
            )}

            {selected.flags.can_view_attendance && !attendanceDenied ? (
              <Card className="text-right">
                <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">غیبت و تأخیر (ترم)</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
                    {toPersianDigits(attendanceSummary.absents)} <span className="text-xs font-normal text-slate-500">غیبت</span>
                  </span>
                  <Badge variant="neutral">{toPersianDigits(attendanceSummary.lates)} تأخیر</Badge>
                </div>
                <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] block mt-1">
                  نرخ حضور: <strong className="tabular-nums">{attendanceSummary.rate === null ? '—' : `${toPersianDigits(attendanceSummary.rate)}٪`}</strong>
                </span>
              </Card>
            ) : (
              <LockedTile label="غیبت و تأخیر" note="برای این پیوند فعال نیست" />
            )}

            <Card className="text-right">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کارنامه‌های منتشرشده</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
                  {selected.flags.can_view_grades ? toPersianDigits(childCards.length) : '—'}
                </span>
                {selected.flags.can_view_grades && newestCard?.publishedAt && (
                  <Badge variant="neutral">{formatJalaliDate(newestCard.publishedAt)}</Badge>
                )}
              </div>
              <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] block mt-1">آخرین ابلاغ رسمی</span>
            </Card>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {selected.flags.can_view_grades ? (
                <>
                  {/* Published cards of this child */}
                  <Card>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                        <Award size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                        کارنامه‌های منتشرشدهٔ فرزند
                      </h3>
                      <Link to="/report-card" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline flex items-center gap-1">
                        <span>کارنامه کامل تشریحی</span>
                        <ChevronLeft size={14} />
                      </Link>
                    </div>
                    {childCards.length === 0 ? (
                      <div className="py-6 text-center text-xs text-[#526176] dark:text-[#B3C0D2]">
                        هنوز کارنامه‌ای منتشر نشده است.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {childCards.map((c) => (
                          <div
                            key={c.ulid}
                            className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 text-right flex items-center justify-between gap-3 flex-wrap"
                          >
                            <div>
                              <span className="font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB] block">
                                {KIND_LABEL[c.kind] ?? 'کارنامه تحصیلی'}
                              </span>
                              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                                {c.term ?? '—'} · نسخه {toPersianDigits(c.version)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {c.rank !== null && c.rankOf !== null && (
                                <Badge variant="primary">
                                  رتبه {toPersianDigits(c.rank)} از {toPersianDigits(c.rankOf)}
                                </Badge>
                              )}
                              <span className="px-2 py-0.5 text-xs font-black rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 tabular-nums">
                                {formatScore(
                                  (() => {
                                    const scored = c.lines.map((l) => outOfTwenty(l)).filter((x): x is number => x !== null);
                                    return scored.length === 0 ? 0 : scored.reduce((s, x) => s + x, 0) / scored.length;
                                  })(),
                                )}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  {/* Per-subject lines of the newest card */}
                  {newestCard && (
                    <Card>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                          <BookOpen size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                          نمرات آخرین کارنامه — {newestCard.term ?? '—'}
                        </h3>
                        <Link to="/report-card" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                          مشاهده همه
                        </Link>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="border-b border-[#DCE3EE] dark:border-[#344257] text-[#526176] dark:text-[#B3C0D2]">
                              <th className="pb-2 font-medium">عنوان درس</th>
                              <th className="pb-2 font-medium text-center">نمره از ۲۰</th>
                              <th className="pb-2 font-medium text-center">سطح توصیفی</th>
                              <th className="pb-2 font-medium text-center">توضیح دبیر</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#DCE3EE]/60 dark:divide-[#344257]/60">
                            {newestCard.lines.map((line, idx) => {
                              const s20 = outOfTwenty(line);
                              const band = bandOf(s20);
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                  <td className="py-2.5 font-bold text-[#202B3C] dark:text-[#F1F5FB]">{line.subject ?? '—'}</td>
                                  <td className="py-2.5 text-center font-black tabular-nums text-[#202B3C] dark:text-[#F1F5FB]">
                                    {s20 === null ? '—' : formatScore(s20)}
                                  </td>
                                  <td className="py-2.5 text-center">
                                    {band ? (
                                      <Badge variant={band.key === 'excellent' ? 'success' : band.key === 'good' ? 'primary' : band.key === 'acceptable' ? 'warning' : 'danger'}>
                                        {band.label}
                                      </Badge>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="py-2.5 text-center text-[#526176] dark:text-[#B3C0D2]">
                                    {line.teacherComment ?? '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <div className="py-8 text-center text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed flex flex-col items-center gap-2">
                    <Lock size={18} className="text-slate-400" />
                    <span>
                      مشاهدهٔ نمرات و کارنامهٔ {selected.studentName} برای پیوند شما («{selected.linkLabel}») فعال نیست.
                      <br />
                      در صورت نیاز با دفتر مدرسه تماس بگیرید.
                    </span>
                  </div>
                </Card>
              )}

              {/* Attendance history — فقط با مجوز حضور */}
              {selected.flags.can_view_attendance && !attendanceDenied && (
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                      <CalendarDays size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                      آخرین جلسات ثبت‌شدهٔ حضور
                    </h3>
                    <Link to="/attendance" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                      گزارش کامل حضور
                    </Link>
                  </div>
                  {timeline.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[#526176] dark:text-[#B3C0D2]">رکوردی ثبت نشده است.</div>
                  ) : (
                    <div className="space-y-2">
                      {timeline.slice(0, 8).map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 text-xs"
                        >
                          <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">{r.subject ?? '—'}</span>
                          <span className="text-[#526176] dark:text-[#B3C0D2] tabular-nums">
                            {formatJalaliDate(r.date)} · زنگ {toPersianDigits(r.period)}
                          </span>
                          {r.status === 'present' && <Badge variant="success">حاضر</Badge>}
                          {r.status === 'absent' && <Badge variant="danger">غایب</Badge>}
                          {r.status === 'late' && (
                            <Badge variant="warning">
                              تأخیر{r.late_minutes ? ` ${toPersianDigits(r.late_minutes)} دقیقه` : ''}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* Right Col: Quick Access */}
            <div className="space-y-6">
              <Card>
                <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
                  <GraduationCap size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                  مجوزهای پیوند شما
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <FlagBadge label="نمرات و کارنامه" on={selected.flags.can_view_grades} />
                  <FlagBadge label="حضور و غیاب" on={selected.flags.can_view_attendance} />
                  <FlagBadge label="تأیید رضایت‌نامه" on={selected.flags.can_approve_consent} />
                  <FlagBadge label="تحویل‌گیری حضوری" on={selected.flags.can_pickup} />
                  <FlagBadge label="پیامک" on={selected.flags.can_receive_sms} />
                </div>
                <p className="text-[10px] text-[#526176] dark:text-[#B3C0D2] mt-3 leading-relaxed">
                  این مجوزها بر اساس نوع پیوند و — در صورت وجود — دادنامهٔ قضایی توسط مدرسه تنظیم شده‌اند و تغییرشان فقط از مسیر دفتر مدرسه ممکن است.
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3">دسترسی‌های سریع اولیا</h3>
                <div className="space-y-2">
                  <Link to="/consent-forms" className="block">
                    <div className="p-2.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                        <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">رضایت‌نامه‌های اردو و فعالیت</span>
                      </div>
                      <ChevronLeft size={14} className="text-slate-400" />
                    </div>
                  </Link>

                  <Link to="/pta" className="block">
                    <div className="p-2.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                        <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">انجمن اولیا و نظرسنجی‌ها</span>
                      </div>
                      <ChevronLeft size={14} className="text-slate-400" />
                    </div>
                  </Link>

                  <Link to="/counseling" className="block">
                    <div className="p-2.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <HeartHandshake size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                        <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">درخواست جلسه با مشاور</span>
                      </div>
                      <ChevronLeft size={14} className="text-slate-400" />
                    </div>
                  </Link>

                  <Link to="/performance-analytics" className="block">
                    <div className="p-2.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Award size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                        <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">تحلیل هوشمند عملکرد</span>
                      </div>
                      <ChevronLeft size={14} className="text-slate-400" />
                    </div>
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
