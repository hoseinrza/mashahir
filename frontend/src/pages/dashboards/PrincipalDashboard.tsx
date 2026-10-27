import React from 'react';
import { Link } from 'react-router-dom';
import {
  Users, School, ShieldAlert, Award, FileText, CheckCircle2,
  AlertTriangle, Clock, ArrowRight, Plus, Megaphone, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { AuditService, FamilyService } from '../../services';

export const PrincipalDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const auditLogs = AuditService.getAll();
  const legalRestrictions = FamilyService.getRestrictions();

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

      {/* Critical Legal Governance Alert */}
      <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 text-right">
          <ShieldAlert size={22} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-amber-950 dark:text-amber-200 block text-sm">
              نظارت بر حقوق والدین جداشده و احکام قضایی حضانت
            </span>
            <p className="text-[#526176] dark:text-[#B3C0D2] mt-1 leading-relaxed">
              تعداد <strong className="tabular-nums font-bold text-amber-900 dark:text-amber-200">{toPersianDigits(legalRestrictions.length)}</strong> پرونده با حکم قضایی در سامانه اعمال گردیده است. استقلال حساب‌های والدین جداشده تضمین شده و دسترسی آموزشی پدر (مسعود رادمنش) بدون حق ترخیص فیزیکی طبق دادنامه برقرار است.
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کل دانش‌آموزان ثبت‌نامی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {toPersianDigits(84)}
            </span>
            <Badge variant="primary">۳ کلاس</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">نرخ حضور امروز مدرسه</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              ۹۶.۴٪
            </span>
            <Badge variant="success">وضعیت مطلوب</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">میانگین معدل مدرسه</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              ۱۸.۴۰
            </span>
            <Badge variant="neutral">ترم اول</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">عملیات حساس ثبت‌شده (Audit)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-slate-700 dark:text-slate-300 tabular-nums">
              {toPersianDigits(auditLogs.length)}
            </span>
            <Badge variant="neutral">امروز</Badge>
          </div>
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

            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 text-right"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-[#202B3C] dark:text-[#F1F5FB]">{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                  </div>
                  <p className="text-xs text-[#526176] dark:text-[#B3C0D2]">{log.description}</p>
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span>ثبت‌کننده: <strong>{log.actorName}</strong> ({log.actorRole})</span>
                    {log.reason && <span className="text-amber-700 dark:text-amber-400">علت: {log.reason}</span>}
                  </div>
                </div>
              ))}
            </div>
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
