import React, { useEffect, useState } from 'react';
import {
  Clock, Shield, User, Filter, Search, AlertCircle,
  FileText, CheckCircle2, Calendar, Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, SearchInput, PageHeader, AccessDeniedGate, RolePermissionBadge } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { AuditService } from '../services';
import { ApiAuditService } from '../api/data';
import { AuditEvent } from '../types';

export const AuditLogPage: React.FC = () => {
  const { currentUser, activeRole, hasAccess, switchUser } = useAuth();
  const isAuthorized = hasAccess('audit:view') || activeRole.group === 'school_admin' || activeRole.id === 'ministry_inspector' || activeRole.group === 'platform';

  const [mockLogs] = useState<AuditEvent[]>(() => AuditService.getAll());
  const [liveLogs, setLiveLogs] = useState<AuditEvent[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Live backend data (audit_logs are append-only); falls back to the demo
  // roster when the API is unreachable.
  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;
    ApiAuditService.listEvents()
      .then((events) => { if (!cancelled) setLiveLogs(events); })
      .catch(() => { /* keep mock data */ });
    return () => { cancelled = true; };
  }, [isAuthorized]);

  const logs = liveLogs ?? mockLogs;
  const isLive = liveLogs !== null;

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی محرمانه به تاریخچه حساس و ممیزی سیستم (Audit Trail)"
        requiredRoleOrPermission="audit:view (مدیر مدرسه، بازرس آموزش و پرورش یا سوپرادمین)"
        reason="ردپای تغییر نمرات، اصلاح حضور و غیاب، و انتساب احکام قضایی تنها برای بازرسان و مدیران ارشد مجاز است."
        currentRoleTitle={activeRole.persianTitle}
        suggestedRoleId="usr_principal"
        suggestedRoleName="دکتر احمدرضا جلالی (مدیر مدرسه)"
        onSwitchUser={switchUser}
      />
    );
  }

  const filteredLogs = logs.filter((log) => {
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

      <div className="flex justify-start -mt-3">
        <Badge variant={isLive ? 'success' : 'warning'} className="text-[10px]">
          <Radio size={11} />
          {isLive ? 'متصل به سرور — داده واقعی (فقط‌افزودنی)' : 'داده نمایشی — سرور در دسترس نیست'}
        </Badge>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DCE3EE] dark:border-[#344257]">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'all', label: 'همه رویدادها' },
            { id: 'attendance', label: 'حضور و غیاب' },
            { id: 'grade', label: 'نمرات و تکالیف' },
            { id: 'legal_restriction', label: 'احکام قضایی' },
            { id: 'family_link', label: 'روابط خانوادگی' },
            { id: 'exam', label: 'تصحیح آزمون' },
          ].map((tab) => (
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
                    {log.timestamp}
                  </td>
                  <td className="py-3 font-bold text-[#202B3C] dark:text-[#F1F5FB] whitespace-nowrap">
                    <div>{log.actorName}</div>
                    <span className="text-[10px] text-slate-400 font-normal">{log.actorRole}</span>
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <Badge variant="primary">{log.action}</Badge>
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
      </Card>
    </div>
  );
};
