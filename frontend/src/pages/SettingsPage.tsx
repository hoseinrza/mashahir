import React, { useEffect, useState } from 'react';
import {
  Bell, Moon, Sun, Lock, Save, Loader2, AlertCircle, CheckCircle2, RefreshCw, School, Smartphone, Video,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { Card, Button, Badge, FormField, PageHeader } from '../components/common';
import { ApiNotificationCenter, ApiSchoolSettingsService, ApiUserService } from '../api/data';
import { ApiError } from '../api/client';

/** The notification types the backend actually emits, with their Persian labels. */
const PREF_TYPES: { type: string; label: string }[] = [
  { type: 'attendance.absence', label: 'پیامک ثبت غیبت در آغاز ساعت کلاسی' },
  { type: 'attendance.late', label: 'پیامک ثبت تأخیر ورود' },
  { type: 'transport.bus_absent', label: 'سوارنشدن دانش‌آموز در سرویس مدرسه' },
  { type: 'exam.published', label: 'اطلاع‌رسانی آزمون‌های آنلاین منتشرشده' },
  { type: 'assignment.created', label: 'اطلاع‌رسانی تکلیف جدید کلاس' },
  { type: 'consent.request', label: 'درخواست رضایت‌نامه و اردو' },
  { type: 'announcement', label: 'بخشنامه و اطلاعیهٔ رسمی مدرسه' },
  { type: 'counseling.requested', label: 'درخواست جدید نوبت مشاوره (برای مشاور)' },
  { type: 'pta.meeting_created', label: 'جلسهٔ جدید انجمن اولیا و مربیان' },
  { type: 'pta.survey_created', label: 'نظرسنجی جدید انجمن اولیا و مربیان' },
];

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

export const SettingsPage: React.FC = () => {
  const { currentUser, activeRole, hasAccess, hasPassword } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const canManageSchool = hasAccess('schools:settings');

  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [mandatory, setMandatory] = useState<string[]>([]);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // ── Login password (self-service; username = own mobile number) ──
  const [pwNew, setPwNew] = useState('');
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // ── School-level OTP switch (own immediate-save checkbox, not the bulk
  //    text form — the bulk loader stringifies booleans) ──
  const [otpLoginEnabled, setOtpLoginEnabled] = useState<boolean | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

  // ── School-level policy (FR-35) — only for schools.settings holders ──
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<Record<string, string> | null>(null);
  const [schoolError, setSchoolError] = useState<string | null>(null);
  const [isSavingSchool, setIsSavingSchool] = useState(false);

  // ── Alocom (الوکام) online-class credentials — the principal connects ──
  const [alocomUsername, setAlocomUsername] = useState('');
  const [alocomPassword, setAlocomPassword] = useState('');
  const [alocomConfigured, setAlocomConfigured] = useState(false);
  const [alocomBusy, setAlocomBusy] = useState(false);
  const [alocomMsg, setAlocomMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageSchool) return;
    let cancelled = false;

    ApiSchoolSettingsService.get()
      .then((payload) => {
        if (cancelled) return;

        // otp_login_enabled is a REAL boolean with its own toggle — the text
        // form would corrupt it ("true" string / null on empty).
        const { otp_login_enabled: otpSetting, ...rest } = payload.settings;
        setOtpLoginEnabled(otpSetting === undefined || otpSetting === null ? true : Boolean(otpSetting));

        const asText: Record<string, string> = {};
        Object.entries(rest).forEach(([key, value]) => {
          asText[key] = value === null || value === undefined
            ? ''
            : typeof value === 'string' ? value : JSON.stringify(value);
        });

        setSchoolName(payload.school?.name ?? null);
        setSchoolSettings(asText);
        setAlocomUsername(payload.alocomUsername ?? '');
        setAlocomConfigured(payload.alocomConfigured);
      })
      .catch((e) => { if (!cancelled) setSchoolError(firstError(e, 'خطا در دریافت تنظیمات مدرسه')); });

    return () => { cancelled = true; };
  }, [canManageSchool]);

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolSettings) return;

    setIsSavingSchool(true);
    setSchoolError(null);

    try {
      const entries = Object.entries(schoolSettings).map(([key, value]) => ({
        key,
        value: value === '' ? null : value,
      }));
      await ApiSchoolSettingsService.save(entries);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setSchoolError(firstError(err, 'خطا در ذخیرهٔ تنظیمات مدرسه'));
    } finally {
      setIsSavingSchool(false);
    }
  };

  // Connect/disconnect the school's Alocom organizer account: the save is a
  // LIVE login attempt against Alocom — wrong credentials never stick.
  const handleSaveAlocom = async () => {
    setAlocomBusy(true);
    setAlocomMsg(null);
    try {
      await ApiSchoolSettingsService.save([
        { key: 'alocom_credentials', value: { username: alocomUsername.trim(), password: alocomPassword } },
      ]);
      const payload = await ApiSchoolSettingsService.get();
      setAlocomUsername(payload.alocomUsername ?? '');
      setAlocomConfigured(payload.alocomConfigured);
      setAlocomPassword('');
      setAlocomMsg('اتصال الوکام برقرار شد — «برگزاری کلاس آنلاین» با بستر الوکام هم در دسترس است.');
    } catch (err) {
      setAlocomMsg(firstError(err, 'خطا در اتصال به الوکام'));
    } finally {
      setAlocomBusy(false);
    }
  };

  const handleDisconnectAlocom = async () => {
    setAlocomBusy(true);
    setAlocomMsg(null);
    try {
      await ApiSchoolSettingsService.save([
        { key: 'alocom_credentials', value: { username: '', password: '' } },
      ]);
      setAlocomUsername('');
      setAlocomConfigured(false);
      setAlocomMsg('اتصال الوکام قطع شد.');
    } catch (err) {
      setAlocomMsg(firstError(err, 'خطا در قطع اتصال الوکام'));
    } finally {
      setAlocomBusy(false);
    }
  };

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

  const handleToggleOtp = async () => {
    if (otpLoginEnabled === null || otpBusy) return;

    const next = !otpLoginEnabled;
    setOtpLoginEnabled(next);
    setOtpBusy(true);
    setSchoolError(null);

    try {
      await ApiSchoolSettingsService.save([{ key: 'otp_login_enabled', value: next }]);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setOtpLoginEnabled(!next);
      setSchoolError(firstError(err, 'خطا در ذخیرهٔ وضعیت ورود پیامکی'));
    } finally {
      setOtpBusy(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNew.length < 8) {
      setPwError('رمز عبور باید دست‌کم ۸ نویسه باشد.');
      return;
    }
    if (hasPassword && pwCurrent.length === 0) {
      setPwError('رمز فعلی را وارد نمایید.');
      return;
    }

    setPwBusy(true);
    setPwError(null);
    try {
      await ApiUserService.setOwnPassword({
        password: pwNew,
        currentPassword: hasPassword ? pwCurrent : undefined,
      });
      setPwNew('');
      setPwCurrent('');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setPwError(firstError(err, 'خطا در ذخیرهٔ رمز عبور'));
    } finally {
      setPwBusy(false);
    }
  };

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

            <div className="pt-3 border-t border-[#DCE3EE] dark:border-[#344257]">
              <h4 className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-1.5">
                <Lock size={13} /> رمز عبور ورود (یوزرنیم = شمارهٔ همراه)
              </h4>
              <form onSubmit={handleSetPassword} className="space-y-2.5 text-xs">
                {hasPassword && (
                  <FormField label="رمز فعلی">
                    <input
                      type="password" dir="ltr"
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
                    />
                  </FormField>
                )}
                <FormField label={hasPassword ? 'رمز جدید' : 'رمز عبور جدید'}>
                  <input
                    type="password" dir="ltr"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    placeholder="دست‌کم ۸ نویسه"
                    className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
                  />
                </FormField>
                {pwError && (
                  <p className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle size={12} /> {pwError}
                  </p>
                )}
                <Button type="submit" size="sm" variant="outline" disabled={pwBusy}>
                  {pwBusy ? <Loader2 size={13} className="animate-spin" /> : 'ذخیرهٔ رمز'}
                </Button>
              </form>
            </div>
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

      {canManageSchool && (
        <Card className="text-right">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#DCE3EE] dark:border-[#344257] mb-4">
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
              <School size={16} className="text-[#2457C5]" />
              تنظیمات مدرسه {schoolName ? `— ${schoolName}` : ''}
            </h3>
            <Badge variant="primary">سیاست‌های مشترک مدرسه</Badge>
          </div>

          {schoolError && (
            <div className="mb-3 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle size={14} /> {schoolError}
            </div>
          )}

          {/* Immediate-save boolean — kept out of the bulk text form on purpose. */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs cursor-pointer mb-4">
            <span className="space-y-0.5">
              <span className="flex items-center gap-2 font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                <Smartphone size={13} className="text-[#2457C5]" /> ورود با کد پیامکی (OTP)
              </span>
              <span className="block text-[10px] text-slate-400">
                خاموش کردن = کاربران این مدرسه فقط با شمارهٔ موبایل و رمز عبور وارد می‌شوند
              </span>
            </span>
            <span className="flex items-center gap-2">
              {otpBusy && <Loader2 size={12} className="animate-spin text-slate-400" />}
              <input
                type="checkbox"
                checked={otpLoginEnabled ?? true}
                disabled={otpBusy || otpLoginEnabled === null}
                onChange={handleToggleOtp}
                className="rounded"
              />
            </span>
          </label>

          {schoolSettings === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#526176] dark:text-[#B3C0D2]">
              <Loader2 size={18} className="animate-spin" /> در حال دریافت تنظیمات مدرسه…
            </div>
          ) : (
            <form onSubmit={handleSaveSchool} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="سیاست رضایت‌نامه">
                  <select
                    value={schoolSettings.consent_policy ?? ''}
                    onChange={(e) => setSchoolSettings({ ...schoolSettings, consent_policy: e.target.value })}
                    className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
                  >
                    <option value="">پیش‌فرض (رضایت یکی از اولیا)</option>
                    <option value="one_parent">رضایت یکی از اولیا</option>
                    <option value="both_parents">رضایت هر دو ولی</option>
                  </select>
                </FormField>

                <FormField label="ساعت سکوت پیامک (مثلاً ۲۱:۰۰ تا ۰۷:۰۰)">
                  <input
                    type="text"
                    dir="ltr"
                    value={schoolSettings.sms_quiet_hours ?? ''}
                    onChange={(e) => setSchoolSettings({ ...schoolSettings, sms_quiet_hours: e.target.value })}
                    placeholder="21:00-07:00"
                    className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
                  />
                </FormField>

                <FormField label="قالب کارنامه">
                  <input
                    type="text"
                    value={schoolSettings.report_card_template ?? ''}
                    onChange={(e) => setSchoolSettings({ ...schoolSettings, report_card_template: e.target.value })}
                    placeholder="standard / official"
                    className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
                  />
                </FormField>

                <FormField label="بازهٔ مجاز اصلاح حضور و غیاب">
                  <input
                    type="text"
                    value={schoolSettings.attendance_edit_window ?? ''}
                    onChange={(e) => setSchoolSettings({ ...schoolSettings, attendance_edit_window: e.target.value })}
                    placeholder="same_day"
                    className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
                  />
                </FormField>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400">
                  این مقادیر روی سیاست رضایت‌نامه، پیامک و قالب کارنامهٔ کل مدرسه اثر می‌گذارند.
                </span>
                <Button type="submit" variant="primary" size="sm" icon={<Save size={14} />} disabled={isSavingSchool}>
                  {isSavingSchool ? 'در حال ذخیره…' : 'ذخیرهٔ تنظیمات مدرسه'}
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {canManageSchool && (
        <Card className="text-right">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#DCE3EE] dark:border-[#344257] mb-4">
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
              <Video size={16} className="text-[#2457C5]" /> کلاس آنلاین الوکام
            </h3>
            <Badge variant={alocomConfigured ? 'success' : 'neutral'}>
              {alocomConfigured ? 'متصل' : 'متصل نشده'}
            </Badge>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
            یوزر و پسورد حساب سازمان‌دهی (Organizer) الوکام مدرسه را وارد کنید؛ سامانه همان لحظه به الوکام وصل می‌شود و از آن پس
            «برگزاری کلاس آنلاین» با بستر الوکام هم در دسترس است — مدرس و دانش‌آموز بدون حساب جداگانه، با لینک اختصاصی خودشان وارد کلاس می‌شوند.
          </p>

          {alocomMsg && (
            <div className={`mb-3 flex items-center gap-2 text-xs ${alocomMsg.startsWith('اتصال الوکام برقرار') || alocomMsg.startsWith('اتصال الوکام قطع') ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
              <AlertCircle size={14} /> {alocomMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="یوزر الوکام">
              <input
                type="text"
                dir="ltr"
                value={alocomUsername}
                onChange={(e) => setAlocomUsername(e.target.value)}
                placeholder="organizer username"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
              />
            </FormField>

            <FormField label={alocomConfigured ? 'رمز الوکام (برای تغییر بنویسید)' : 'رمز الوکام'}>
              <input
                type="password"
                dir="ltr"
                value={alocomPassword}
                onChange={(e) => setAlocomPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
              />
            </FormField>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400">
              رمز در پایگاه داده رمزنگاری می‌شود و هرگز نمایش داده نمی‌شود؛ ذخیره با تست اتصال زندهٔ الوکام انجام می‌شود.
            </span>
            <div className="flex items-center gap-2">
              {alocomConfigured && (
                <Button variant="ghost" size="sm" disabled={alocomBusy} onClick={handleDisconnectAlocom}>قطع اتصال</Button>
              )}
              <Button
                variant="primary"
                size="sm"
                disabled={alocomBusy || alocomUsername.trim() === '' || alocomPassword === ''}
                onClick={handleSaveAlocom}
                icon={alocomBusy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              >
                {alocomBusy ? 'در حال اتصال…' : 'ذخیره و اتصال'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
