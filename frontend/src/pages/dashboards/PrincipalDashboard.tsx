import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, School, ShieldAlert, Award, CheckCircle2,
  Clock, ArrowRight, Megaphone, ShieldCheck,
  ClipboardList, Inbox, Video, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits, formatScore } from '../../utils/persian';
import { AlertTriangle } from 'lucide-react';
import { AdmissionsApi, PreRegistrationStats } from '../../api/admissions';
import { AuditEvent } from '../../types';
import {
  ApiAcademicService, ApiAuditService, ApiFamilyService, ApiReportCardService,
  GuardianLinkRow, ReportCardRow,
} from '../../api/data';

const outOfTwenty = (maxScore: number | null | undefined, score: number | null | undefined): number | null => {
  if (score === null || score === undefined) return null;
  if (!maxScore || maxScore === 20) return score;
  return (score / maxScore) * 20;
};

export const PrincipalDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  // ── every tile reads a live endpoint — no fabricated numbers ──
  const [auditEvents, setAuditEvents] = useState<AuditEvent[] | null>(null);
  const [links, setLinks] = useState<GuardianLinkRow[] | null>(null);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [classCount, setClassCount] = useState<number | null>(null);
  const [publishedCards, setPublishedCards] = useState<ReportCardRow[] | null>(null);
  const [prStats, setPrStats] = useState<PreRegistrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([
        ApiAuditService.listEvents(),
        ApiFamilyService.listAllLinks(),
        ApiAcademicService.studentsInScope(),
        ApiAcademicService.classrooms(),
        ApiReportCardService.list(),
        AdmissionsApi.list(),
      ]);
      if (cancelled) return;

      const [auditR, linksR, studentsR, classroomsR, cardsR, admissionsR] = results;
      setAuditEvents(auditR.status === 'fulfilled' ? auditR.value : []);
      setLinks(linksR.status === 'fulfilled' ? linksR.value : []);
      setStudentCount(studentsR.status === 'fulfilled' ? studentsR.value.length : null);
      setClassCount(classroomsR.status === 'fulfilled' ? classroomsR.value.length : null);
      setPublishedCards(cardsR.status === 'fulfilled' ? cardsR.value.filter((c) => c.status === 'published') : []);
      if (admissionsR.status === 'fulfilled') setPrStats(admissionsR.value.stats);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const restrictedCases = useMemo(
    () => (links ?? []).filter((l) => l.status === 'active' && l.linkType.startsWith('separated')),
    [links],
  );

  const schoolGrades = useMemo(() => {
    const lines = (publishedCards ?? []).flatMap((c) =>
      c.lines.map((l) => {
        const max = l.maxScore ?? 20;
        return l.score === null ? null : (!max || max === 20 ? l.score : (l.score / max) * 20);
      }).filter((x): x is number => x !== null),
    );
    const avg = lines.length === 0 ? null : lines.reduce((s, x) => s + x, 0) / lines.length;
    return { avg, publishedCount: (publishedCards ?? []).length };
  }, [publishedCards]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="داشبورد راهبردی مدیریت — دبیرستان مشاهیر آینده"
        subtitle={`مدیریت: ${currentUser.fullName} · پایش کلیه فرایندهای آموزشی، حقوقی و انضباطی`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/announcements">
              <Button variant="outline" size="sm" icon={<Megaphone size={15} />}>
                صدور بخشنامه رسمی
              </Button>
            </Link>
            <Link to="/family-management">
              <Button variant="primary" size="sm" icon={<ShieldAlert size={15} />}>
                مدیریت ارتباطات خانوادگی
              </Button>
            </Link>
          </div>
        }
      />

      {loadError && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200">
            <AlertTriangle size={15} /> <span className="font-bold">{loadError}</span>
          </div>
        </Card>
      )}

      {/* Critical Legal Governance Alert — شمارش واقعی پیوندهای جداشده/محدود */}
      <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 text-right">
          <ShieldAlert size={22} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-amber-950 dark:text-amber-200 block text-sm">
              نظارت بر حقوق والدین جداشده و احکام قضایی حضانت
            </span>
            <p className="text-[#526176] dark:text-[#B3C0D2] mt-1 leading-relaxed">
              تعداد <strong className="tabular-nums font-bold text-amber-900 dark:text-amber-200">{toPersianDigits(restrictedCases?.length ?? 0)}</strong> پیوند فعال با محدودیت قضایی در سامانه اعمال شده است؛
              پرچم‌های هر پیوند (نمرات، حضور، تأیید رضایت‌نامه، ترخیص) سمت سرور تضمین می‌شود. جزئیات در مدیریت ارتباطات خانوادگی.
            </p>
          </div>
        </div>
        <Link to="/family-management" className="shrink-0">
          <Button variant="outline" size="sm">
            بررسی پرونده
          </Button>
        </Link>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پیش‌ثبت‌نام‌های جدید لندینگ</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {toPersianDigits(prStats?.new ?? 0)}
            </span>
            <Badge variant="warning">پذیرش</Badge>
          </div>
          <Link to="/pre-registrations" className="text-[11px] text-[#2457C5] dark:text-[#8BAEFF] font-bold hover:underline inline-flex items-center gap-1 mt-2">
            بررسی درخواست‌ها
            <ArrowRight size={12} className="rotate-180" />
          </Link>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">ثبت‌شده امروز</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {toPersianDigits(prStats?.today ?? 0)}
            </span>
            <Inbox size={17} className="text-blue-200 dark:text-blue-900" />
          </div>
          <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-2 block">
            از فرم وب‌سایت مدرسه
          </span>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کل دانش‌آموزان ثبت‌نامی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {studentCount === null ? '—' : toPersianDigits(studentCount)}
            </span>
            {classCount !== null && <Badge variant="primary">{toPersianDigits(classCount)} کلاس</Badge>}
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کارنامه‌های منتشرشده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {publishedCards === null ? '—' : toPersianDigits(publishedCards.length)}
            </span>
            <Award size={17} className="text-emerald-200 dark:text-emerald-900" />
          </div>
          <Link to="/report-card" className="text-[11px] text-[#2457C5] dark:text-[#8BAEFF] font-bold hover:underline inline-flex items-center gap-1 mt-2">
            مشاهده کارنامه‌ها
            <ArrowRight size={12} className="rotate-180" />
          </Link>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">میانگین نمرات منتشرشده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {schoolGrades.avg === null ? '—' : formatScore(schoolGrades.avg)}
            </span>
            <Badge variant="neutral">از ۲۰</Badge>
          </div>
        </Card>
      </div>

      {/* Audit tile strip — live event count */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">عملیات حساس ثبت‌شده (Audit)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-slate-700 dark:text-slate-300 tabular-nums">
              {auditEvents === null ? '—' : toPersianDigits(auditEvents.length)}
            </span>
            <Clock size={17} className="text-slate-300" />
          </div>
          <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-2 block">
            آخرین رویدادهای ممیزی‌شده سامانه
          </span>
        </Card>
      </div>

      {/* Main Grid: Management Controls & Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Audit Events Feed */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <Clock size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                گزارش زنده عملیات حساس اداری و آموزشی (Audit Trail)
              </h3>
              <Link to="/audit-logs" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                مشاهده گزارش کامل
              </Link>
            </div>

            {auditEvents === null ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#526176] dark:text-[#B3C0D2]">
                <Loader2 size={18} className="animate-spin" /> در حال دریافت…
              </div>
            ) : auditEvents.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#526176] dark:text-[#B3C0D2]">
                هنوز عملیات حساسی ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-3">
                {auditEvents.slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 text-right"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#202B3C] dark:text-[#F1F5FB]">{log.description}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                      <span>ثبت‌کننده: <strong>{log.actorName}</strong></span>
                      {log.reason && <span className="text-amber-700 dark:text-amber-400">علت: {log.reason}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Management Quick Navigation */}
        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3">
              دسترسی‌های سریع مدیریتی
            </h3>
            <div className="space-y-2 text-xs">
              <Link to="/family-management" className="block">
                <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20 hover:bg-red-100/40 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={16} className="text-red-700 dark:text-red-400" />
                    <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">مدیریت پرونده‌های حضانت و اولیا</span>
                  </div>
                  <Badge variant="danger">حساس</Badge>
                </div>
              </Link>

              <Link to="/user-management" className="block">
                <div className="p-3 rounded-xl border border-[#DCE3EE] dark:border-[#344257] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                    <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">مدیریت کاربران و انتساب نقش‌ها</span>
                  </div>
                  <ArrowRight size={14} className="rotate-180 text-slate-400" />
                </div>
              </Link>

              <Link to="/classrooms" className="block">
                <div className="p-3 rounded-xl border border-[#DCE3EE] dark:border-[#344257] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <School size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                    <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">کلاس‌ها و برنامهٔ هفتگی</span>
                  </div>
                  <ArrowRight size={14} className="rotate-180 text-slate-400" />
                </div>
              </Link>

              <Link to="/online-classes" className="block">
                <div className="p-3 rounded-xl border border-[#DCE3EE] dark:border-[#344257] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                    <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">کلاس‌های آنلاین مدرسه (اسکای‌روم)</span>
                  </div>
                  <ArrowRight size={14} className="rotate-180 text-slate-400" />
                </div>
              </Link>

              <Link to="/pre-registrations" className="block">
                <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-amber-600 dark:text-amber-400" />
                    <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">پیش‌ثبت‌نام‌های پذیرش لندینگ</span>
                  </div>
                  <ArrowRight size={14} className="rotate-180 text-slate-400" />
                </div>
              </Link>

              <Link to="/roles-permissions" className="block">
                <div className="p-3 rounded-xl border border-[#DCE3EE] dark:border-[#344257] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <School size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                    <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">ماتریس مجوزها و نقش‌های سفارشی</span>
                  </div>
                  <ArrowRight size={14} className="rotate-180 text-slate-400" />
                </div>
              </Link>

              <Link to="/announcements" className="block">
                <div className="p-3 rounded-xl border border-[#DCE3EE] dark:border-[#344257] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Megaphone size={16} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                    <span className="font-semibold text-[#202B3C] dark:text-[#F1F5FB]">انتشار بخشنامه‌ها و اعلانات رسمی</span>
                  </div>
                  <ArrowRight size={14} className="rotate-180 text-slate-400" />
                </div>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
