import React, { useState } from 'react';
import {
  Settings, User, Bell, Moon, Sun, Shield, Lock,
  Smartphone, Mail, CheckCircle2, Save
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { Card, Button, Badge, FormField, PageHeader } from '../components/common';
import { toPersianDigits } from '../utils/persian';

export const SettingsPage: React.FC = () => {
  const { currentUser, activeRole } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [smsAttendance, setSmsAttendance] = useState(true);
  const [smsGrades, setSmsGrades] = useState(true);
  const [smsExams, setSmsExams] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="تنظیمات حساب کاربری و ترجیحات سیستم"
        subtitle="مدیریت اطلاعات فردی، تنظیمات اطلاع‌رسانی پیامکی و ظاهر سامانه"
      />

      {savedSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>تنظیمات با موفقیت ذخیره شد.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="text-right space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
            <div className="w-12 h-12 rounded-2xl bg-[#2457C5]/10 text-[#2457C5] flex items-center justify-center font-bold text-lg">
              {currentUser.fullName.slice(0, 1)}
            </div>
            <div>
              <h3 className="font-bold text-base text-[#202B3C] dark:text-[#F1F5FB]">{currentUser.fullName}</h3>
              <Badge variant="primary">{activeRole.persianTitle}</Badge>
            </div>
          </div>

          <div className="text-xs space-y-2 text-[#526176] dark:text-[#B3C0D2]">
            <div className="flex items-center justify-between">
              <span>کد ملی:</span>
              <strong className="font-mono tabular-nums text-[#202B3C] dark:text-[#F1F5FB]">{currentUser.nationalId}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>شماره همراه:</span>
              <strong className="font-mono tabular-nums text-[#202B3C] dark:text-[#F1F5FB]">{currentUser.phoneNumber}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>رایانامه (ایمیل):</span>
              <strong className="font-mono text-[#202B3C] dark:text-[#F1F5FB]">{currentUser.email}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>تاریخ عضویت:</span>
              <strong className="font-mono tabular-nums text-[#202B3C] dark:text-[#F1F5FB]">{currentUser.createdAt}</strong>
            </div>
          </div>
        </Card>

        {/* Preferences Form (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="text-right">
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-4 flex items-center gap-2">
              <Bell size={16} className="text-[#2457C5]" />
              تنظیمات دریافت پیامک و اعلان‌ها
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
                  <span>ارسال پیامک ثبت غیبت و تأخیر در آغاز ساعت کلاسی</span>
                  <input
                    type="checkbox"
                    checked={smsAttendance}
                    onChange={(e) => setSmsAttendance(e.target.checked)}
                    className="rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
                  <span>ارسال پیامک ثبت نمرات تکالیف و کارنامه رسمی</span>
                  <input
                    type="checkbox"
                    checked={smsGrades}
                    onChange={(e) => setSmsGrades(e.target.checked)}
                    className="rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
                  <span>ارسال پیامک اطلاع‌رسانی آزمون‌های آنلاین و نشست‌های اولیا</span>
                  <input
                    type="checkbox"
                    checked={smsExams}
                    onChange={(e) => setSmsExams(e.target.checked)}
                    className="rounded"
                  />
                </label>
              </div>

              <div className="pt-4 border-t border-[#DCE3EE] dark:border-[#344257] flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#526176] dark:text-[#B3C0D2]">تم سامانه:</span>
                  <Button type="button" variant="outline" size="sm" onClick={toggleTheme}>
                    {theme === 'dark' ? 'حالت روز (روشن)' : 'حالت شب (تیره)'}
                  </Button>
                </div>

                <Button type="submit" variant="primary" size="sm" icon={<Save size={14} />}>
                  ذخیره تنظیمات
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
