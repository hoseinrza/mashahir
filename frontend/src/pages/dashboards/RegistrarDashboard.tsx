import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, Users, Loader2, AlertCircle, RefreshCw, FileCheck, Link2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader, EmptyState } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { ApiFamilyService, GuardianLinkRow } from '../../api/data';
import { ApiError } from '../../api/client';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  active: { label: 'فعال', variant: 'success' },
  pending: { label: 'در انتظار تأیید', variant: 'warning' },
  ended: { label: 'پایان یافته', variant: 'neutral' },
  rejected: { label: 'رد شده', variant: 'danger' },
};

export const RegistrarDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  const [links, setLinks] = useState<GuardianLinkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    ApiFamilyService.listAllLinks()
      .then((rows) => { if (!cancelled) setLinks(rows); })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت پرونده‌های خانوادگی'); });

    return () => { cancelled = true; };
  }, [reloadKey]);

  const active = (links ?? []).filter((l) => l.status === 'active').length;
  const pending = (links ?? []).filter((l) => l.status === 'pending').length;
  const ended = (links ?? []).filter((l) => l.status === 'ended').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`میز کار امور اداری و ثبت‌نام — ${currentUser.fullName}`}
        subtitle="مسئول دفتر و ثبت‌نام دبیرستان · راستی‌آزمایی مدارک، پیوندهای خانوادگی، احکام حضانت و صدور گواهی‌ها"
        actions={
          <Link to="/family-management">
            <Button variant="primary" size="sm" icon={<ShieldAlert size={15} />}>
              مدیریت احکام قضایی و روابط خانوادگی
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
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کل پرونده‌های خانوادگی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {links === null ? '…' : toPersianDigits(links.length)}
            </span>
            <Badge variant="primary"><Users size={11} /> پیوند ولی</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پیوندهای فعال</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {links === null ? '…' : toPersianDigits(active)}
            </span>
            <Badge variant="success"><FileCheck size={11} /> تأییدشده</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">در انتظار تأیید مدرسه</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {links === null ? '…' : toPersianDigits(pending)}
            </span>
            <Badge variant="warning">نیازمند بررسی</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پیوندهای پایان‌یافته</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-slate-500 tabular-nums">
              {links === null ? '…' : toPersianDigits(ended)}
            </span>
            <Badge variant="neutral">تاریخچه</Badge>
          </div>
        </Card>
      </div>

      <Card className="text-right space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
          <div>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">
              آخرین پرونده‌های خانوادگی و احراز مدارک اولیا
            </h3>
            <p className="text-xs text-[#526176] dark:text-[#B3C0D2]">
              هر پیوند با مجوزهای مستقل خودش ثبت می‌شود؛ احکام قضایی می‌توانند مجوزها را فوراً سلب کنند.
            </p>
          </div>
          <Link to="/family-management">
            <Button variant="outline" size="sm">مشاهده پرونده کامل حقوقی</Button>
          </Link>
        </div>

        {links === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال دریافت پرونده‌ها…
          </div>
        ) : links.length === 0 ? (
          <EmptyState
            icon={<Link2 size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="پرونده‌ای ثبت نشده است"
            description="با نخستین درخواست ولی از پنل خودش، پیوندها با وضعیت «در انتظار تأیید» همین‌جا ظاهر می‌شوند."
          />
        ) : (
          <div className="space-y-3">
            {links.slice(0, 8).map((link) => {
              const status = STATUS_BADGE[link.status] ?? { label: link.status, variant: 'neutral' as const };
              return (
                <div
                  key={link.id}
                  className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">{link.guardianName ?? 'ولی بدون حساب'}</strong>
                      <span className="text-slate-400">←</span>
                      <span className="font-semibold">{link.studentName}</span>
                      <Badge variant="primary">{link.linkTypeLabel}</Badge>
                    </div>
                    <span className="text-slate-500 mt-1 block">
                      {link.flags.can_pickup ? 'مجاز به تحویل دانش‌آموز' : 'بدون مجوز تحویل'} ·
                      {' '}{link.flags.can_view_grades ? 'مشاهدهٔ نمرات دارد' : 'بدون دسترسی به نمرات'}
                    </span>
                  </div>

                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
