import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, FileText, CheckCircle2, Award, Calendar,
  TrendingUp, Clock, AlertCircle, Eye
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';

export const InspectorDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`پورتال نظارت و ارزیابی عملکرد — ${currentUser.fullName}`}
        subtitle="بازرس وزارت آموزش و پرورش · دسترسی نظارتی فقط‌خواندنی به شاخص‌های کلان آموزشی، انضباطی و سلامت اداری"
      />

      {/* Read-only notification badge */}
      <div className="p-3.5 rounded-2xl bg-slate-900 text-white text-xs flex items-center justify-between text-right">
        <div className="flex items-center gap-2">
          <Eye size={18} className="text-amber-400" />
          <span>حالت نظارتی فعال: کلیه گزارش‌ها به صورت برخط و مستند استخراج شده است (فاقد امکان ویرایش اطلاعات).</span>
        </div>
        <Badge variant="warning">دوره مأموریت پاییز ۱۴۰۳</Badge>
      </div>

      {/* Key Compliance Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">نرخ حضور دانش‌آموزان</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              ۹۶.۴٪
            </span>
            <Badge variant="success">شاخص عالی</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پوشش برنامه درسی مصوب</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              ۱۰۰٪
            </span>
            <Badge variant="primary">مطابق سرفصل</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">تطبیق احکام قضایی حضانت</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              ۱۰۰٪
            </span>
            <Badge variant="success">تنفیذ کامل</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">نسبت معلم به دانش‌آموز</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              ۱ به ۷
            </span>
            <Badge variant="neutral">استاندارد تیزهوشان</Badge>
          </div>
        </Card>
      </div>

      <Card className="text-right space-y-4">
        <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] pb-2 border-b border-[#DCE3EE] dark:border-[#344257]">
          ارزیابی شاخص‌های سلامت سازمانی و مقررات آموزشی
        </h3>

        <div className="space-y-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between">
            <div>
              <strong className="block text-[#202B3C] dark:text-[#F1F5FB]">انطباق دفاتر حضور و غیاب با پیامک‌های ارسالی به اولیا</strong>
              <span className="text-slate-500">تمامی غیبت‌ها دارای پیامک ثبت‌شده با زمان قطعی مخابرات هستند.</span>
            </div>
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between">
            <div>
              <strong className="block text-[#202B3C] dark:text-[#F1F5FB]">تفکیک حساب و حریم خصوصی والدین جداشده</strong>
              <span className="text-slate-500">دادنامه‌های شعبه ۲۴ دادگاه خانواده به صورت کامل و مستند در پرونده ثبت شده‌اند.</span>
            </div>
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between">
            <div>
              <strong className="block text-[#202B3C] dark:text-[#F1F5FB]">سلامت سیستم ارزیابی و تصحیح آزمون‌های آنلاین</strong>
              <span className="text-slate-500">سوالات تستی با کلید رسمی و سوالات تشریحی با مستندات استدلالی مصحح تصحیح شده‌اند.</span>
            </div>
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          </div>
        </div>
      </Card>
    </div>
  );
};
