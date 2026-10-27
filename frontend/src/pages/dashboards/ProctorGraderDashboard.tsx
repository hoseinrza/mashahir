import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, CheckSquare, Award, Clock, Users, Shield, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';

export const ProctorGraderDashboard: React.FC = () => {
  const { currentUser, activeRole } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`میز کار سنجش و تصحیح آزمون‌ها — ${currentUser.fullName}`}
        subtitle={`${activeRole.persianTitle} · تصحیح برگه‌های تشریحی، ثبت نمرات استدلالی و مراقبت جلسات آزمون`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/essay-grading">
              <Button variant="primary" size="sm" icon={<CheckSquare size={15} />}>
                ورود به کارتابل تصحیح تشریحی
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">برگه‌های تخصیص‌یافته</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {toPersianDigits(28)}
            </span>
            <Badge variant="primary">ریاضیات ۱</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">تصحیح‌شده تا کنون</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {toPersianDigits(24)}
            </span>
            <Badge variant="success">۸۵٪ تکمیل</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">باقیمانده در صف</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {toPersianDigits(4)}
            </span>
            <Badge variant="warning">نیازمند بازبینی</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">میانگین نمره تشریحی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              ۳.۴۰ <span className="text-xs font-normal text-slate-500">از ۴</span>
            </span>
            <Badge variant="neutral">مطلوب</Badge>
          </div>
        </Card>
      </div>

      {/* Grading Queue Table */}
      <Card className="text-right">
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EE] dark:border-[#344257] mb-4">
          <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
            <FileText size={16} className="text-[#2457C5]" />
            صف پاسخ‌برگ‌های تشریحی آماده تصحیح
          </h3>
          <Link to="/essay-grading">
            <Button variant="outline" size="sm">
              مشاهده برگه کامل و ثبت نمره
            </Button>
          </Link>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">پارسا رادمنش (کلاس ۱۰۱)</strong>
              <p className="text-slate-500 mt-0.5">حل تشریحی معادله جبری √(x + 3) = x - 3 با بررسی ریشه مضاعف</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">نمره: ۴ از ۴</span>
              <Link to="/essay-grading">
                <Button size="sm" variant="ghost">بازبینی</Button>
              </Link>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">بردیا سلطانی (کلاس ۱۰۱)</strong>
              <p className="text-slate-500 mt-0.5">حل تشریحی سوال ۵ - نیازمند بررسی ریشه کاذب</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="warning">در صف تصحیح</Badge>
              <Link to="/essay-grading">
                <Button size="sm" variant="primary">تصحیح برگه</Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
