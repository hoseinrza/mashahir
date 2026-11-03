import React, { useState } from 'react';
import {
  Bus, Shield, Clock, CheckCircle2, XCircle, AlertCircle,
  FileText, Users, Eye, Search, Check, AlertTriangle
} from 'lucide-react';
import { Card, Button, Badge, Tabs, PageHeader } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';

export const SpecialRolesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'driver' | 'security' | 'proctor' | 'platform'>('driver');

  // Bus driver state
  const [busStudents, setBusStudents] = useState([
    { id: '1', name: 'پارسا رادمنش', stop: 'ایستگاه ۱: پل رومی', boarded: true, dropped: false, time: '۰۷:۱۰' },
    { id: '2', name: 'آرش کریمی', stop: 'ایستگاه ۲: الهیه', boarded: true, dropped: false, time: '۰۷:۲۰' },
    { id: '3', name: 'بردیا سلطانی', stop: 'ایستگاه ۳: تجریش', boarded: true, dropped: false, time: '۰۷:۳۰' },
    { id: '4', name: 'دانیال محبی', stop: 'ایستگاه ۴: قیطریه', boarded: false, dropped: false, time: '—' },
  ]);

  const toggleBoard = (id: string) => {
    setBusStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, boarded: !s.boarded, time: !s.boarded ? '۰۷:۲۵' : '—' } : s))
    );
  };

  // Security gate verification state
  const [gateStudentId, setGateStudentId] = useState('');
  const [gateCheckResult, setGateCheckResult] = useState<{
    studentName: string;
    allowedPickupName: string;
    relation: string;
    hasCourtRestriction: boolean;
    canRelease: boolean;
    restrictionNote?: string;
  } | null>(null);

  const handleGateVerify = (nationalId: string) => {
    if (nationalId.includes('014') || nationalId.includes('پارسا')) {
      setGateCheckResult({
        studentName: 'پارسا رادمنش (کلاس ۱۰۱)',
        allowedPickupName: 'فریبا کاظمی (مادر - حضانت‌دار) یا محمد صمدی (دایی)',
        relation: 'مادر / دایی معرفی‌شده',
        hasCourtRestriction: true,
        canRelease: true,
        restrictionNote: 'هشدار حقوقی: تحویل دانش‌آموز به پدر (مسعود رادمنش) در این ساعت غیرمجاز است (دادنامه شعبه ۲۴ دادگاه خانواده). تحویل صرفاً به مادر یا دایی مجاز است.',
      });
    } else {
      setGateCheckResult({
        studentName: 'آرش کریمی (کلاس ۱۰۱)',
        allowedPickupName: 'مهندس محسن کریمی یا ناهید باقری',
        relation: 'پدر / مادر',
        hasCourtRestriction: false,
        canRelease: true,
      });
    }
  };

  const tabs = [
    { id: 'driver', label: 'راننده سرویس مدرسه (خط ۳)' },
    { id: 'security', label: 'حراست و گیت ترخیص خروجی' },
    { id: 'proctor', label: 'مراقب سالن آزمون' },
    { id: 'platform', label: 'پشتیبانی فنی و سلامت سامانه' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="پنل نقش‌های عملیاتی، اجرایی و پایش تخصصی"
        subtitle="دسترسی‌های وظیفه‌محور و محدود به حداقل اطلاعات مورد نیاز برای هر نقش عملیاتی"
      />

      <Tabs tabs={tabs} activeId={activeTab} onChange={(id) => setActiveTab(id as any)} />

      {/* 1. School Bus Driver Panel */}
      {activeTab === 'driver' && (
        <Card className="text-right space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
            <div className="flex items-center gap-2">
              <Bus size={20} className="text-[#2457C5] dark:text-[#8BAEFF]" />
              <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                سرویس دانش‌آموزی شماره ۳ (مسیر شمیرانات و قلهک)
              </h3>
            </div>
            <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">
              راننده: حسن نجفی · خودرو: ون هیوندای ۹۲-ایران۴۴
            </span>
          </div>

          <div className="p-3 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>
              <strong>محدوده دسترسی راننده:</strong> بر پایهٔ کنترل دسترسی نقش‌محور، راننده سرویس صرفاً به وضعیت سوار/پیاده شدن دانش‌آموزان خط خود دسترسی دارد و نمرات یا اطلاعات خصوصی خانواده‌ها برای وی غیرقابل دسترس است.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#DCE3EE] dark:border-[#344257] text-[#526176] dark:text-[#B3C0D2]">
                  <th className="pb-3 pr-2 font-medium">نام دانش‌آموز</th>
                  <th className="pb-3 font-medium">ایستگاه سوار شدن</th>
                  <th className="pb-3 font-medium text-center">زمان سوار شدن</th>
                  <th className="pb-3 font-medium text-center">وضعیت</th>
                  <th className="pb-3 font-medium text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3EE]/60 dark:divide-[#344257]/60">
                {busStudents.map((std) => (
                  <tr key={std.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 pr-2 font-bold text-[#202B3C] dark:text-[#F1F5FB]">{std.name}</td>
                    <td className="py-3 text-[#526176] dark:text-[#B3C0D2]">{std.stop}</td>
                    <td className="py-3 text-center font-mono tabular-nums">{std.time}</td>
                    <td className="py-3 text-center">
                      <Badge variant={std.boarded ? 'success' : 'warning'}>
                        {std.boarded ? 'سوار شده' : 'منتظر در ایستگاه'}
                      </Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Button
                        size="sm"
                        variant={std.boarded ? 'outline' : 'primary'}
                        onClick={() => toggleBoard(std.id)}
                      >
                        {std.boarded ? 'لغو سوار شدن' : 'ثبت سوار شدن'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 2. Security Gate Panel */}
      {activeTab === 'security' && (
        <Card className="text-right space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
            <Shield size={20} className="text-[#2457C5] dark:text-[#8BAEFF]" />
            <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">
              گیت حراست و بازرسی ترخیص دانش‌آموزان
            </h3>
          </div>

          <p className="text-xs text-[#526176] dark:text-[#B3C0D2]">
            جهت تطبیق هویت فرد تحویل‌گیرنده با اشخاص مجاز ثبت‌شده در پرونده، کد ملی یا نام دانش‌آموز را وارد نمایید:
          </p>

          <div className="flex gap-2 max-w-md">
            <input
              type="text"
              value={gateStudentId}
              onChange={(e) => setGateStudentId(e.target.value)}
              placeholder="مثال: پارسا رادمنش یا 0145678901"
              className="flex-1 text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleGateVerify(gateStudentId || 'پارسا')}
            >
              استعلام گیت
            </Button>
          </div>

          {gateCheckResult && (
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 text-xs space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB]">{gateCheckResult.studentName}</span>
                <Badge variant={gateCheckResult.hasCourtRestriction ? 'danger' : 'success'}>
                  {gateCheckResult.hasCourtRestriction ? 'دارای تذکر قضایی' : 'ترخیص عادی'}
                </Badge>
              </div>
              <div>
                <strong>اشخاص مجاز به تحویل:</strong> {gateCheckResult.allowedPickupName} ({gateCheckResult.relation})
              </div>
              {gateCheckResult.restrictionNote && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 font-bold text-[11px] border border-rose-200 dark:border-rose-800">
                  {gateCheckResult.restrictionNote}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* 3. Exam Proctor Panel */}
      {activeTab === 'proctor' && (
        <Card className="text-right space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
            <Users size={20} className="text-[#2457C5] dark:text-[#8BAEFF]" />
            <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">
              میز کار مراقب سالن امتحانات (سالن شماره ۲)
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <span>آزمون در حال برگزاری:</span>
              <strong className="block text-sm mt-0.5">آزمون جامع فیزیک ۱</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <span>حاضرین در سالن:</span>
              <strong className="block text-sm mt-0.5 tabular-nums font-bold text-emerald-600">۲۸ داوطلب</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <span>گزارش وقایع یا تخلف:</span>
              <strong className="block text-sm mt-0.5 tabular-nums text-slate-500">۰ مورد</strong>
            </div>
          </div>
        </Card>
      )}

      {/* 4. Platform Diagnostics Panel */}
      {activeTab === 'platform' && (
        <Card className="text-right space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
            <CheckCircle2 size={20} className="text-emerald-600" />
            <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">
              داشبورد عملیاتی پشتیبان فنی پلتفرم مشاهیر
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <span>وضعیت سرویس‌ها:</span>
              <strong className="block text-emerald-600 font-bold mt-1">پایدار و برخط</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <span>تأخیر پاسخ‌دهی (Latency):</span>
              <strong className="block font-mono tabular-nums mt-1">۱۸ میلی‌ثانیه</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <span>ارسال پیامک مخابراتی:</span>
              <strong className="block text-emerald-600 font-bold mt-1">۱۰۰٪ تحویل‌شده</strong>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <span>لایسنس مدرسه:</span>
              <strong className="block font-bold mt-1">سازمانی معتبر</strong>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
