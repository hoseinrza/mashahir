import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, Clock, Users, HeartHandshake, Loader2, AlertCircle, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader, EmptyState } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { ApiAcademicService, ApiAttendanceService, AttendanceSessionSummary } from '../../api/data';
import { ApiError } from '../../api/client';

interface AttentionRow {
  id: string;
  studentName: string;
  status: 'absent' | 'late';
  lateMinutes: number | null;
  sessionLabel: string;
}

export const DisciplinaryDeputyDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  const [rows, setRows] = useState<AttentionRow[] | null>(null);
  const [sessionsToday, setSessionsToday] = useState(0);
  const [failedSms, setFailedSms] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);

    setRows(null);
    setError(null);

    (async () => {
      try {
        const [sessions, deliveries] = await Promise.all([
          ApiAcademicService.attendanceSessions(),
          ApiAttendanceService.smsStatus().catch(() => []),
        ]);

        if (cancelled) return;
        setFailedSms(deliveries.filter((d) => d.status === 'failed').length);

        const todaySessions: AttendanceSessionSummary[] = sessions
          .filter((s) => s.heldOn === today)
          .slice(0, 8);

        setSessionsToday(todaySessions.length);

        const details = await Promise.all(
          todaySessions.map((session) =>
            ApiAttendanceService.showSession(session.id)
              .then((detail) => ({ session, roster: detail.roster }))
              .catch(() => ({ session, roster: [] })),
          ),
        );

        if (cancelled) return;

        const attention: AttentionRow[] = [];
        details.forEach(({ session, roster }) => {
          roster.forEach((row) => {
            if (row.status === 'absent' || row.status === 'late') {
              attention.push({
                id: `${session.id}-${row.studentId}`,
                studentName: row.studentName,
                status: row.status,
                lateMinutes: row.lateMinutes,
                sessionLabel: `${session.subject ?? 'درس'} · زنگ ${toPersianDigits(session.period)}`,
              });
            }
          });
        });

        setRows(attention);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت وضعیت انتظامی امروز');
          setRows([]);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [reloadKey]);

  const lateCount = (rows ?? []).filter((r) => r.status === 'late').length;
  const absentCount = (rows ?? []).filter((r) => r.status === 'absent').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="داشبورد معاونت پرورشی و انضباطی"
        subtitle={`کاربر فعال: ${currentUser.fullName} · غیبت‌ها و تأخیرهای امروز، مستقیم از دفاتر کلاسی`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/attendance">
              <Button variant="outline" size="sm" icon={<Clock size={15} />}>
                بررسی تأخیرها و غیبت‌ها
              </Button>
            </Link>
            <Link to="/counseling">
              <Button variant="primary" size="sm" icon={<HeartHandshake size={15} />}>
                ارجاع به مشاور
              </Button>
            </Link>
          </div>
        }
      />

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
            <span className="flex items-center gap-2 font-bold"><AlertCircle size={15} />{error}</span>
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setReloadKey((k) => k + 1)}>
              تلاش دوباره
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">دفاتر ثبت‌شدهٔ امروز</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {rows === null ? '…' : toPersianDigits(sessionsToday)}
            </span>
            <Badge variant="primary">جلسه</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">تأخیرهای امروز</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {rows === null ? '…' : toPersianDigits(lateCount)}
            </span>
            <Badge variant="warning">ثبت در پرونده</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">غیبت‌های امروز</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
              {rows === null ? '…' : toPersianDigits(absentCount)}
            </span>
            <Badge variant="danger">نیازمند پیگیری</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پیامک ناموفق به اولیا</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {failedSms === null ? '…' : toPersianDigits(failedSms)}
            </span>
            {failedSms && failedSms > 0
              ? <Badge variant="danger">تلاش دوباره لازم است</Badge>
              : <Badge variant="success"><CheckCircle2 size={11} /> سالم</Badge>}
          </div>
        </Card>
      </div>

      <Card className="text-right">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-600" />
            موارد نیازمند پیگیری انضباطی امروز
          </h3>
          <Link to="/attendance" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
            دفتر حضور و غیاب
          </Link>
        </div>

        {rows === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال بررسی دفاتر امروز…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="موردی برای پیگیری نیست"
            description="امروز غیبت یا تأخیری در دفاتر کلاسی ثبت نشده است، یا هنوز دبیران دفتر روز را نهایی نکرده‌اند."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">{item.studentName}</strong>
                    <Badge variant={item.status === 'absent' ? 'danger' : 'warning'}>
                      {item.status === 'absent' ? 'غیبت' : 'تأخیر'}
                    </Badge>
                    {item.status === 'late' && item.lateMinutes !== null && (
                      <span className="text-[11px] text-slate-400">{toPersianDigits(item.lateMinutes)} دقیقه تأخیر</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">{item.sessionLabel}</span>
                </div>

                <span className="text-[11px] text-slate-400">
                  برای اصلاح با دلیل، از دفتر حضور و غیاب استفاده کنید
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
