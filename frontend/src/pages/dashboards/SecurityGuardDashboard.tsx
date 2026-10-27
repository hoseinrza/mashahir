import React, { useState } from 'react';
import {
  Shield, CheckCircle2, AlertTriangle, Search, UserCheck,
  Clock, ShieldAlert, ArrowLeftRight, Check, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { FamilyService } from '../../services';

export const SecurityGuardDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const pickups = FamilyService.getPickups();
  const restrictions = FamilyService.getRestrictions();

  const [searchStudent, setSearchStudent] = useState('');
  const [lookupResult, setLookupResult] = useState<{
    studentName: string;
    studentClass: string;
    allowedPersons: string[];
    courtWarning?: string;
    canRelease: boolean;
  } | null>(null);

  const handleLookup = () => {
    if (searchStudent.includes('پارسا') || searchStudent.includes('014') || searchStudent === '') {
      setLookupResult({
        studentName: 'پارسا رادمنش',
        studentClass: 'کلاس ۱۰۱ (دهم ریاضی)',
        allowedPersons: ['فریبا کاظمی (مادر - حضانت‌دار)', 'محمد صمدی (دایی معرفی‌شده کتبی)'],
        courtWarning: 'هشدار حقوقی بسیار مهم: تحویل دانش‌آموز به پدر (مسعود رادمنش) در این ساعت غیرمجاز است (دادنامه شعبه ۲۴ دادگاه خانواده). تحویل صرفاً به مادر یا دایی مجاز است.',
        canRelease: true,
      });
    } else {
      setLookupResult({
        studentName: 'آرش کریمی',
        studentClass: 'کلاس ۱۰۱ (دهم ریاضی)',
        allowedPersons: ['مهندس محسن کریمی (پدر)', 'ناهید باقری (مادر)'],
        canRelease: true,
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`پایش تردد و انتظامات گیت — ${currentUser.fullName}`}
        subtitle="مسئول حراست و انتظامات دبیرستان · تطبیق مجوزهای ترخیص، شناسایی افراد مجاز و نظارت بر درب اصلی"
      />

      {/* Quick Lookup Bar */}
      <Card className="text-right">
        <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-2 flex items-center gap-2">
          <Shield size={16} className="text-[#2457C5]" />
          استعلام فوری گیت خروجی و اشخاص مجاز تحویل دانش‌آموز
        </h3>
        <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mb-3">
          کد ملی دانش‌آموز یا نام او را وارد کنید تا فهرست اشخاص مجاز به تحویل گرفتن و احکام منع ترخیص نمایش داده شود:
        </p>

        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={searchStudent}
            onChange={(e) => setSearchStudent(e.target.value)}
            placeholder="مثال: پارسا رادمنش یا ۴۰۲۱۰۱۰۰۱"
            className="flex-1 text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
          />
          <Button variant="primary" size="sm" onClick={handleLookup}>
            استعلام پرونده
          </Button>
        </div>

        {lookupResult && (
          <div className="mt-4 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{lookupResult.studentName}</strong>
                <span className="text-slate-500 mr-2">({lookupResult.studentClass})</span>
              </div>
              <Badge variant={lookupResult.courtWarning ? 'danger' : 'success'}>
                {lookupResult.courtWarning ? 'هشدار حقوقی فعال' : 'ترخیص عادی مجاز'}
              </Badge>
            </div>

            <div>
              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">اشخاص مجاز به تحویل فیزیکی:</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 pr-2">
                {lookupResult.allowedPersons.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>

            {lookupResult.courtWarning && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-900 font-bold text-[11px] leading-relaxed">
                {lookupResult.courtWarning}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Registered Pickups list */}
      <Card className="text-right">
        <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3">
          فهرست اشخاص دارای کارت ترخیص مصوب در سامانه
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {pickups.map((pk) => (
            <div
              key={pk.id}
              className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 space-y-1"
            >
              <div className="flex items-center justify-between">
                <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">{pk.fullName}</strong>
                <Badge variant="success">مجاز</Badge>
              </div>
              <div className="text-slate-500">نسبت: {pk.relationDescription}</div>
              <div className="text-slate-400 font-mono">تماس: {pk.phoneNumber}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
