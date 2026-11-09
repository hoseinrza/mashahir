import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HeartHandshake, Loader2, AlertCircle, RefreshCw, CalendarClock, CheckCircle2, Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader, EmptyState } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { formatJalaliDateTime } from '../../utils/jalali';
import { ApiCounselingService, CounselingRow } from '../../api/data';
import { ApiError } from '../../api/client';

export const CounselorDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  const [rows, setRows] = useState<CounselingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    ApiCounselingService.list()
      .then((list) => { if (!cancelled) setRows(list); })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت نوبت‌های مشاوره'); });

    return () => { cancelled = true; };
  }, [reloadKey]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      requested: all.filter((r) => r.status === 'requested').length,
      scheduled: all.filter((r) => r.status === 'scheduled').length,
      completed: all.filter((r) => r.status === 'completed').length,
    };
  }, [rows]);

  const queue = (rows ?? []).filter((r) => r.status === 'requested').slice(0, 5);
  const upcoming = (rows ?? [])
    .filter((r) => r.status === 'scheduled' && r.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`میز مشاوره — ${currentUser.fullName}`}
        subtitle="درخواست‌های تازه، جلسات پیش‌رو و ثبت خلاصهٔ جلسه"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReloadKey((k) => k + 1)}>
              به‌روزرسانی
            </Button>
            <Link to="/counseling">
              <Button variant="primary" size="sm" icon={<HeartHandshake size={15} />}>
                ورود به میز جلسات
              </Button>
            </Link>
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

      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{rows === null ? '…' : toPersianDigits(stats.requested)}</div>
          <div className="text-[11px] text-slate-400">درخواست تازه</div>
        </Card>
        <Card className="text-center">
          <div className="text-lg font-bold text-[#2457C5] dark:text-[#8BAEFF]">{rows === null ? '…' : toPersianDigits(stats.scheduled)}</div>
          <div className="text-[11px] text-slate-400">جلسهٔ پیش‌رو</div>
        </Card>
        <Card className="text-center">
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{rows === null ? '…' : toPersianDigits(stats.completed)}</div>
          <div className="text-[11px] text-slate-400">جلسهٔ برگزارشده</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="text-right">
          <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
            <Users size={16} className="text-[#2457C5]" />
            درخواست‌های در انتظار زمان‌بندی
          </h3>

          {rows === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#526176] dark:text-[#B3C0D2]">
              <Loader2 size={16} className="animate-spin" /> …
            </div>
          ) : queue.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={20} className="text-emerald-600" />}
              title="صف انتظار خالی است"
              description="همهٔ درخواست‌ها زمان‌بندی شده‌اند."
            />
          ) : (
            <div className="space-y-2">
              {queue.map((row) => (
                <div key={row.ulid} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[#202B3C] dark:text-[#F1F5FB]">{row.topic}</strong>
                    <Badge variant="warning">درخواست تازه</Badge>
                  </div>
                  <span className="text-slate-500 mt-1 block">
                    {row.studentName ?? '—'} · درخواست‌کننده: {row.requesterName ?? '—'}
                    {row.type === 'online' ? ' · آنلاین' : ' · حضوری'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Link to="/counseling" className="inline-block mt-3">
            <Button variant="outline" size="sm">مشاهدهٔ همه</Button>
          </Link>
        </Card>

        <Card className="text-right">
          <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
            <CalendarClock size={16} className="text-[#2457C5]" />
            جلسات زمان‌بندی‌شده
          </h3>

          {rows === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#526176] dark:text-[#B3C0D2]">
              <Loader2 size={16} className="animate-spin" /> …
            </div>
          ) : upcoming.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">جلسهٔ زمان‌بندی‌شده‌ای نیست.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((row) => (
                <div key={row.ulid} className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[#202B3C] dark:text-[#F1F5FB]">{row.topic}</strong>
                    <span className="text-slate-500 text-[11px]">{formatJalaliDateTime(row.scheduledAt)}</span>
                  </div>
                  <span className="text-slate-500 mt-1 block">{row.studentName ?? '—'} · مشاور: {row.counselorName ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
