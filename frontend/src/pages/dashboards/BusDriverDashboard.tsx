import React, { useState } from 'react';
import {
  Bus, Clock, MapPin, CheckCircle2, AlertCircle, Phone,
  Users, Navigation, Check, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';

export const BusDriverDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  const [passengers, setPassengers] = useState([
    { id: '1', name: 'پارسا رادمنش', grade: 'دهم ریاضی', stop: 'ایستگاه ۱: پل رومی، خیابان شریعتی', boarded: true, dropped: false, time: '۰۷:۱۰', guardianPhone: '۰۹۱۳۴۴۴۵۵۶۶' },
    { id: '2', name: 'آرش کریمی', grade: 'دهم ریاضی', stop: 'ایستگاه ۲: الهیه، خیابان فرشته', boarded: true, dropped: false, time: '۰۷:۲۰', guardianPhone: '۰۹۱۲۴۴۴۴۴۴۴' },
    { id: '3', name: 'بردیا سلطانی', grade: 'دهم ریاضی', stop: 'ایستگاه ۳: میدان تجریش، خروجی فناخسرو', boarded: true, dropped: false, time: '۰۷:۳۰', guardianPhone: '۰۹۱۲۱۱۱۲۲۳۳' },
    { id: '4', name: 'دانیال محبی', grade: 'دهم ریاضی', stop: 'ایستگاه ۴: بلوار قیطریه، جنب بوستان', boarded: false, dropped: false, time: '—', guardianPhone: '۰۹۱۳۷۷۷۸۸۹۹' },
    { id: '5', name: 'سینا فرهادی', grade: 'دهم ریاضی', stop: 'ایستگاه ۵: پاسداران، نبش بهستان پنجم', boarded: true, dropped: false, time: '۰۷:۴۲', guardianPhone: '۰۹۱۸۹۹۰۰۱۱' },
  ]);

  const toggleBoard = (id: string) => {
    setPassengers((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, boarded: !p.boarded, time: !p.boarded ? '۰۷:۲۵' : '—' }
          : p
      )
    );
  };

  const toggleDrop = (id: string) => {
    setPassengers((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, dropped: !p.dropped } : p
      )
    );
  };

  const boardedCount = passengers.filter((p) => p.boarded).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`سرویس دانش‌آموزی — ${currentUser.fullName}`}
        subtitle="راننده خط ۳ (مسیر شمیرانات و قلهک) · ثبت لحظه‌ای سوار و پیاده شدن دانش‌آموزان در ایستگاه‌ها"
      />

      {/* RBAC Boundary Card */}
      <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-900/50 text-xs flex items-center gap-2 text-right">
        <ShieldCheck size={18} className="shrink-0" />
        <span>
          <strong>حفاظت از حریم خصوصی:</strong> مطابق معماری امنیت سامانه، راننده سرویس به هیچ‌یک از سوابق تحصیلی، نمرات، کارنامه یا پرونده خانوادگی دانش‌آموزان دسترسی ندارد و صرفاً اطلاعات ایستگاه و تردد را مدیریت می‌کند.
        </span>
      </div>

      {/* Route Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کل سرنشینان خط</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {toPersianDigits(passengers.length)} <span className="text-xs font-normal text-slate-500">نفر</span>
            </span>
            <Badge variant="primary">ظرفیت کامل</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">سوارشده تا این لحظه</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {toPersianDigits(boardedCount)} <span className="text-xs font-normal text-slate-500">نفر</span>
            </span>
            <Badge variant="success">در مسیر مدرسه</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">ایستگاه‌های باقیمانده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {toPersianDigits(passengers.length - boardedCount)}
            </span>
            <Badge variant="warning">در حال حرکت</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">زمان تخمینی ورود</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] font-mono tabular-nums">
              ۰۷:۵۰
            </span>
            <Badge variant="neutral">درب مدرسه</Badge>
          </div>
        </Card>
      </div>

      {/* Passenger Roster */}
      <Card className="text-right">
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EE] dark:border-[#344257] mb-4">
          <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
            <Bus size={16} className="text-[#2457C5]" />
            فهرست مسافران خط ۳ (نوبت صبح)
          </h3>
          <span className="text-xs text-slate-500">خودرو: ون هیوندای ۹۲-ایران۴۴</span>
        </div>

        <div className="space-y-3">
          {passengers.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">{p.name}</strong>
                  <span className="text-slate-500">({p.grade})</span>
                  <Badge variant={p.boarded ? 'success' : 'warning'}>
                    {p.boarded ? 'سوار شده' : 'منتظر در ایستگاه'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 mt-1.5">
                  <MapPin size={13} className="text-[#2457C5] shrink-0" />
                  <span>{p.stop}</span>
                  {p.boarded && <span className="font-mono tabular-nums text-slate-400 mr-2">(ساعت {p.time})</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant={p.boarded ? 'outline' : 'primary'}
                  onClick={() => toggleBoard(p.id)}
                >
                  {p.boarded ? 'لغو سوار شدن' : 'ثبت سوار شدن'}
                </Button>
                <Button
                  size="sm"
                  variant={p.dropped ? 'secondary' : 'outline'}
                  onClick={() => toggleDrop(p.id)}
                >
                  {p.dropped ? 'پیاده شد ✓' : 'ثبت پیاده شدن'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
