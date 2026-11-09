import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare, Clock, AlertCircle, Loader2, RefreshCw, MessageSquareWarning, CalendarDays,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader, EmptyState } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { formatJalaliDate } from '../../utils/jalali';
import { ApiAcademicService, ApiAttendanceService, AttendanceSessionSummary } from '../../api/data';
import { ApiError } from '../../api/client';

interface SmsRow {
  id: number;
  status: string;
  channel: string;
  lastError: string | null;
  sentAt: string | null;
}

const SESSION_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  finalized: { label: 'نهایی شده', variant: 'success' },
  draft: { label: 'پیش‌نویس', variant: 'warning' },
  corrected: { label: 'اصلاح‌شده', variant: 'neutral' },
};

export const NazemDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  const [sessions, setSessions] = useState<AttendanceSessionSummary[] | null>(null);
  const [smsRows, setSmsRows] = useState<SmsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    Promise.all([ApiAcademicService.attendanceSessions(), ApiAttendanceService.smsStatus()])
      .then(([sessionRows, deliveries]) => {
        if (cancelled) return;
        setSessions(sessionRows);
        setSmsRows(deliveries);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت وضعیت حضور و غیاب');
      });

    return () => { cancelled = true; };
  }, [reloadKey]);

  const finalized = (sessions ?? []).filter((s) => s.status === 'finalized').length;
  const draft = (sessions ?? []).filter((s) => s.status === 'draft').length;
  const failedSms = (smsRows ?? []).filter((s) => s.status === 'failed').length;
  const sentSms = (smsRows ?? []).filter((s) => s.status === 'sent').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`دفتر نظارت روزانه — ${currentUser.fullName}`}
        subtitle="ناظم و مسئول حضور و غیاب مدرسه · بررسی دفاتر کلاسی، ثبت اصلاحات موجه و رصد پیامک‌ها"
        actions={
          <Link to="/attendance">
            <Button variant="primary" size="sm" icon={<CheckSquare size={15} />}>
              ورود به دفتر حضور و غیاب کلاسی
            </Button>
          </Link>
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
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">جلسات ثبت‌شده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {sessions === null ? '…' : toPersianDigits(sessions.length)}
            </span>
            <Badge variant="primary">دفاتر کلاسی</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">جلسات نهایی‌شده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {sessions === null ? '…' : toPersianDigits(finalized)}
            </span>
            <Badge variant="success">آماده پیامک</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">در انتظار نهایی‌سازی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {sessions === null ? '…' : toPersianDigits(draft)}
            </span>
            <Badge variant="warning">پیش‌نویس</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پیامک‌های ارسال‌شده / ناموفق</span>
          <div className="flex items-baseline justify-between mt-2 gap-2">
            <span className="text-xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {smsRows === null ? '…' : `${toPersianDigits(sentSms)} / ${toPersianDigits(failedSms)}`}
            </span>
            {failedSms > 0
              ? <Badge variant="danger">نیازمند تلاش دوباره</Badge>
              : <Badge variant="success">سالم</Badge>}
          </div>
        </Card>
      </div>

      <Card className="text-right">
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EE] dark:border-[#344257] mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">
              آخرین جلسات ثبت‌شده از دفاتر کلاسی دبیران
            </h3>
            <p className="text-xs text-[#526176] dark:text-[#B3C0D2]">
              هر اصلاح وضعیت دانش‌آموز با درج دلیل در تاریخچهٔ حساس ثبت می‌شود؛ ورود به دفتر برای اصلاح از همین صفحه ممکن است.
            </p>
          </div>
          <Link to="/attendance">
            <Button variant="outline" size="sm">ویرایش کامل و ثبت دلایل</Button>
          </Link>
        </div>

        {sessions === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال دریافت دفاتر…
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="هنوز جلسه‌ای ثبت نشده است"
            description="با نخستین ثبت حضور و غیاب دبیران، جلسات همین‌جا با وضعیت پیش‌نویس یا نهایی نمایش داده می‌شوند."
          />
        ) : (
          <div className="space-y-3">
            {sessions.slice(0, 6).map((session) => {
              const status = SESSION_STATUS[session.status] ?? { label: session.status, variant: 'neutral' as const };
              return (
                <div
                  key={session.id}
                  className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">
                        {session.subject ?? 'درس نامشخص'}
                      </strong>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <span className="text-slate-500 mt-1 flex items-center gap-1">
                      <Clock size={11} />
                      {formatJalaliDate(session.heldOn)} · زنگ {toPersianDigits(session.period)}
                      {session.classroomSubjectId ? ` · کد درس ${toPersianDigits(session.classroomSubjectId)}` : ''}
                    </span>
                  </div>

                  {failedSms > 0 && (
                    <span className="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                      <MessageSquareWarning size={12} /> {toPersianDigits(failedSms)} پیامک ناموفق در صف
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
