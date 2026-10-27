import React from 'react';
import { Link } from 'react-router-dom';
import {
  HeartHandshake, Calendar, Clock, UserCheck, Lock,
  FileText, CheckCircle2, AlertCircle, Plus, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { CounselingService } from '../../services';

export const CounselorDashboard: React.FC = () => {
  const { currentUser, activeRole } = useAuth();
  const appointments = CounselingService.getAppointments();
  const isPsychologist = activeRole.id === 'school_psychologist';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`میز کار تخصصی مشاوره و روانشناسی — ${currentUser.fullName}`}
        subtitle={`${activeRole.persianTitle} · مدیریت پرونده‌های هدایت تحصیلی و مشاوره‌های فردی با بالاترین سطح رازداری`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/counseling">
              <Button variant="primary" size="sm" icon={<Plus size={15} />}>
                زمان‌بندی جلسه جدید
              </Button>
            </Link>
          </div>
        }
      />

      {/* Confidentiality Reminder */}
      <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 flex items-start gap-3 text-right">
        <Lock size={20} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <strong className="text-[#202B3C] dark:text-[#F1F5FB] block">حفاظت از یادداشت‌های تخصصی و محرمانگی بالینی:</strong>
          <span className="text-[#526176] dark:text-[#B3C0D2]">
            یادداشت‌های محرمانه ثبت‌شده در این پنل صرفاً برای مشاور و روانشناس مربوطه قابل مشاهده بوده و در دسترس سایر دبیران، اولیا یا دانش‌آموزان قرار نخواهد گرفت.
          </span>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">جلسات برگزار شده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {toPersianDigits(18)}
            </span>
            <Badge variant="success">ترم جاری</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">جلسات پیش‌رو</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {toPersianDigits(appointments.filter((a) => a.status === 'confirmed').length)}
            </span>
            <Badge variant="primary">هفته جاری</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پرونده‌های فعال هدایت تحصیلی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {toPersianDigits(24)}
            </span>
            <Badge variant="neutral">پایه دهم و یازدهم</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">نرخ رضایت مراجعین</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              ۹۸٪
            </span>
            <Badge variant="warning">بسیار عالی</Badge>
          </div>
        </Card>
      </div>

      {/* Counseling Schedule & Detailed Cases */}
      <Card className="text-right">
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EE] dark:border-[#344257] mb-4">
          <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
            <Calendar size={16} className="text-[#2457C5]" />
            جدول نوبت‌های مشاوره و وضعیت پرونده‌های مراجعین
          </h3>
          <Link to="/counseling">
            <Button variant="outline" size="sm">
              مدیریت تقویم جلسات
            </Button>
          </Link>
        </div>

        <div className="space-y-4">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="p-4 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 text-xs space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">{apt.studentName}</strong>
                    <Badge variant={apt.counselorSpecialty === 'تحصیلی' ? 'primary' : 'warning'}>
                      مشاوره {apt.counselorSpecialty}
                    </Badge>
                    <span className="text-slate-500">متقاضی: {apt.requesterName}</span>
                  </div>
                  <h4 className="font-semibold text-xs text-[#2457C5] dark:text-[#8BAEFF] mt-1">{apt.topic}</h4>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-slate-500">{apt.scheduledDate} ساعت {apt.scheduledTime}</span>
                  <Badge variant={apt.status === 'confirmed' ? 'success' : 'neutral'}>
                    {apt.status === 'confirmed' ? 'تأیید شده' : 'برگزار شده'}
                  </Badge>
                </div>
              </div>

              {apt.sharedSummary && (
                <div className="p-2.5 bg-white dark:bg-[#182231] rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">خلاصه جلسه:</span>
                  <p className="text-[#526176] dark:text-[#B3C0D2]">{apt.sharedSummary}</p>
                </div>
              )}

              {apt.confidentialNotes && (
                <div className="p-2.5 bg-rose-50/70 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900/50">
                  <span className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1 mb-0.5">
                    <Lock size={12} />
                    <span>یادداشت محرمانه بالینی:</span>
                  </span>
                  <p className="text-rose-900 dark:text-rose-200">{apt.confidentialNotes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
