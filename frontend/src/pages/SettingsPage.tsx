import React, { useEffect, useState } from 'react';
import {
  Bell, Moon, Sun, Lock, Save, Loader2, AlertCircle, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { Card, Button, Badge, PageHeader } from '../components/common';
import { ApiNotificationCenter } from '../api/data';
import { ApiError } from '../api/client';

/** The notification types the backend actually emits, with their Persian labels. */
const PREF_TYPES: { type: string; label: string }[] = [
  { type: 'attendance.absence', label: 'پیامک ثبت غیبت در آغاز ساعت کلاسی' },
  { type: 'attendance.late', label: 'پیامک ثبت تأخیر ورود' },
  { type: 'exam.published', label: 'اطلاع‌رسانی آزمون‌های آنلاین منتشرشده' },
  { type: 'assignment.created', label: 'اطلاع‌رسانی تکلیف جدید کلاس' },
  { type: 'consent.request', label: 'درخواست رضایت‌نامه و اردو' },
  { type: 'announcement', label: 'بخشنامه و اطلاعیهٔ رسمی مدرسه' },
];

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

export const SettingsPage: React.FC = () => {
  const { currentUser, activeRole } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [mandatory, setMandatory] = useState<string[]>([]);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setIsForbidden(false);

    ApiNotificationCenter.listPreferences()
      .then((result) => {
        if (cancelled) return;

        const map: Record<string, boolean> = {};
        PREF_TYPES.forEach(({ type }) => {
          const row = result.rows.find((r) => r.type === type && r.channel === 'sms');
          map[type] = row?.enabled ?? true;
        });

        setPrefs(map);
        setMandatory(result.mandatory);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
          setIsForbidden(true);
          setPrefs({});
          return;
        }
        setError(firstError(e, 'خطا در دریافت تنظیمات اعلان'));
        setPrefs({});
      });

    return () => { cancelled = true; };
  }, [reloadKey]);

  const handleToggle = async (type: string) => {
    if (prefs === null) return;
    if (mandatory.includes(type)) return;

    const next = !prefs[type];
    setPrefs({ ...prefs, [type]: next });
    setBusyType(type);
    setError(null);

    try {
      await ApiNotificationCenter.setPreference(type, 'sms', next);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      setPrefs({ ...prefs, [type]: !next });
      setError(firstError(e, 'خطا در ذخیرهٔ تنظیم اعلان'));
    } finally {
      setBusyType(null);
    }
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
          <span>تنظیمات ذخیره شد.</span>
        </div>
      )}

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
            <span className="flex items-center gap-2 font-bold"><AlertCircle size={15} />{error}</span>
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setReloadKey((k) => k + 1)}>
              تلاش دوباره
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              <span>شماره همراه (ورود):</span>
              <strong className="font-mono tabular-nums text-[#202B3C] dark:text-[#F1F5FB]" dir="ltr">
                {currentUser.phoneNumber || '—'}
              </strong>
            </div>
            <p className="text-[11px] text-slate-400 pt-2">
              تغییر شمارهٔ ورود و کد ملی از طریق دفتر مدرسه و با ثبت دلیل انجام می‌شود؛ از این صفحه قابل ویرایش نیست.
            </p>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="text-right">
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-4 flex items-center gap-2">
              <Bell size={16} className="text-[#2457C5]" />
              تنظیمات دریافت پیامک و اعلان‌ها
            </h3>

            {isForbidden ? (
              <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                برای نقش فعال شما تنظیمات کانال اعلان در دسترس نیست؛ این ترجیحات برای اولیای دانش‌آموز و کادر مدرسه فعال است.
              </p>
            ) : prefs === null ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#526176] dark:text-[#B3C0D2]">
                <Loader2 size={18} className="animate-spin" /> در حال دریافت تنظیمات…
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {PREF_TYPES.map(({ type, label }) => {
                  const locked = mandatory.includes(type);
                  return (
                    <label
                      key={type}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer ${
                        locked
                          ? 'bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40'
                          : 'bg-slate-50 dark:bg-slate-800/40'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {label}
                        {locked && (
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <Lock size={11} /> اجباری (ش۱۴)
                          </span>
                        )}
                      </span>

                      <span className="flex items-center gap-2">
                        {busyType === type && <Loader2 size={12} className="animate-spin text-slate-400" />}
                        <input
                          type="checkbox"
                          checked={prefs[type] ?? true}
                          disabled={locked || busyType === type}
                          onChange={() => handleToggle(type)}
                          className="rounded"
                        />
                      </span>
                    </label>
                  );
                })}

                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  پیام‌های غیبت و تأخیر مدرسه اجباری‌اند و قابل خاموش‌کردن نیستند؛ سایر اعلان‌ها با کلید بالا مدیریت می‌شوند.
                </p>
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-[#DCE3EE] dark:border-[#344257] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#526176] dark:text-[#B3C0D2]">تم سامانه:</span>
                <Button type="button" variant="outline" size="sm" onClick={toggleTheme}
                  icon={theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}>
                  {theme === 'dark' ? 'حالت روز (روشن)' : 'حالت شب (تیره)'}
                </Button>
              </div>

              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Save size={12} /> هر کلید بلافاصله روی سرور ذخیره می‌شود
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
