import React, { useEffect, useState } from 'react';
import {
  Clock, Shield, AlertCircle, Loader2, RefreshCw, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, SearchInput, PageHeader, AccessDeniedGate, EmptyState } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { ApiAuditService } from '../api/data';
import { ApiError } from '../api/client';
import { AuditEvent } from '../types';

const EVENT_LABEL: Record<AuditEvent['entityType'], string> = {
  attendance: 'حضور و غیاب',
  grade: 'نمره و کارنامه',
  family_link: 'روابط خانوادگی',
  legal_restriction: 'حکم قضایی',
  permission: 'کاربران و دسترسی',
  exam: 'آزمون',
  online_class: 'کلاس آنلاین',
};

const FILTERS: { id: 'all' | AuditEvent['entityType']; label: string }[] = [
  { id: 'all', label: 'همه رویدادها' },
  { id: 'attendance', label: 'حضور و غیاب' },
  { id: 'grade', label: 'نمرات و کارنامه' },
  { id: 'legal_restriction', label: 'احکام قضایی' },
  { id: 'family_link', label: 'روابط خانوادگی' },
  { id: 'permission', label: 'کاربران و نقش‌ها' },
  { id: 'exam', label: 'آزمون' },
  { id: 'online_class', label: 'کلاس آنلاین' },
];

export const AuditLogPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();
  const isAuthorized = hasAccess('audit:view') || activeRole.group === 'school_admin' || activeRole.id === 'ministry_inspector' || activeRole.group === 'platform';

  // The trail is append-only and lives on the server alone — an empty school
  // shows an empty trail, never a fabricated roster.
  const [logs, setLogs] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | AuditEvent['entityType']>('all');

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;

    setLogs(null);
    setError(null);

    ApiAuditService.listEvents()
      .then((events) => { if (!cancelled) setLogs(events); })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت تاریخچهٔ ممیزی');
      });

    return () => { cancelled = true; };
  }, [isAuthorized, reloadKey]);

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی محرمانه به تاریخچه حساس و ممیزی سیستم (Audit Trail)"
        requiredRoleOrPermission="audit:view (مدیر مدرسه، بازرس آموزش و پرورش یا سوپرادمین)"
        reason="ردپای تغییر نمرات، اصلاح حضور و غیاب، و انتساب احکام قضایی تنها برای بازرسان و مدیران ارشد مجاز است."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const filteredLogs = (logs ?? []).filter((log) => {
    if (selectedType !== 'all' && log.entityType !== selectedType) return false;
    if (
      searchQuery &&
      !log.actorName.includes(searchQuery) &&
      !log.description.includes(searchQuery) &&
      !log.action.includes(searchQuery)
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="تاریخچه عملیات حساس و ردپای تغییرات (Audit Trail)"
        subtitle="ثبت شفاف عامل تغییر، زمان، نوع عملیات، رکورد هدف و دلیل ثبت‌شده برای تضمین سلامت اداری"
      />

      <div className="flex items-center justify-between -mt-3">
        <Badge variant="success" className="text-[10px]">
          <Shield size={11} />
          {logs === null ? 'در حال اتصال به سرور…' : `${toPersianDigits(logs.length)} رویداد ثبت‌شده`}
        </Badge>
      </div>

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
            <span className="flex items-center gap-2 font-bold">
              <AlertCircle size={15} />
              {error}
            </span>
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setReloadKey((k) => k + 1)}>
              تلاش دوباره
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DCE3EE] dark:border-[#344257]">
        <div className="flex items-center gap-2 overflow-x-auto">
          {FILTERS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                selectedType === tab.id
                  ? 'bg-[#2457C5] text-white dark:bg-[#8BAEFF] dark:text-[#101722]'
                  : 'bg-white dark:bg-[#182231] text-[#526176] dark:text-[#B3C0D2] border border-[#DCE3EE] dark:border-[#344257]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="جستجو در سوابق و نام کاربران..."
        />
      </div>

      <Card>
        {logs === null && !error ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال دریافت تاریخچهٔ ممیزی…
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={<FileText size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="رویدادی برای نمایش نیست"
            description={
              (logs?.length ?? 0) === 0
                ? 'هنوز عملیات حساسی در این مدرسه ثبت نشده است؛ با نخستین تغییر نمره، حضور و غیاب یا پروندهٔ خانوادگی، ردیف‌ها همین‌جا ظاهر می‌شوند.'
                : 'در این دسته یا با این عبارت جستجو رویدادی پیدا نشد.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#DCE3EE] dark:border-[#344257] text-[#526176] dark:text-[#B3C0D2]">
                  <th className="pb-3 pr-2 font-medium">زمان رویداد</th>
                  <th className="pb-3 font-medium">عامل اقدام (کاربر)</th>
                  <th className="pb-3 font-medium">نوع عملیات</th>
                  <th className="pb-3 font-medium">شرح رویداد</th>
                  <th className="pb-3 font-medium">دلیل ثبت‌شده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3EE]/60 dark:divide-[#344257]/60">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 pr-2 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} className="text-slate-400" />
                        {log.timestamp}
                      </span>
                    </td>
                    <td className="py-3 font-bold text-[#202B3C] dark:text-[#F1F5FB] whitespace-nowrap">
                      {log.actorName}
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <Badge variant="primary">{EVENT_LABEL[log.entityType] ?? 'سایر'}</Badge>
                    </td>
                    <td className="py-3 text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                      {log.description}
                    </td>
                    <td className="py-3">
                      {log.reason ? (
                        <span className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded text-[11px]">
                          {log.reason}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
