import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Smartphone, Lock, Eye, EyeOff, ShieldCheck,
  AlertTriangle, Sun, Moon, Loader2, KeyRound, CheckCircle2, Users, School,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { SchoolLogo, Button, Card, Badge, FormField } from '../components/common';
import { ApiError } from '../api/client';

/**
 * Real login: SMS OTP only (the backend has no passwords).
 * phone → code → (role selection when the user holds several assignments)
 * → role-scoped session on /dashboard.
 */

export const LoginPage: React.FC = () => {
  const {
    requestOtp, verifyOtp, switchRole, pendingRoles, isAuthenticated,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [step, setStep] = useState<'phone' | 'code' | 'roles'>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  // Already authenticated (restored session): straight to the dashboard.
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  // Countdown for resend
  useEffect(() => {
    if (step !== 'code' || otpTimer <= 0) return;
    const interval = setInterval(() => setOtpTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [step, otpTimer]);

  const toAsciiDigits = (value: string) =>
    value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

  const errorText = (error: unknown): string => {
    if (error instanceof ApiError) return error.firstError();
    if (error instanceof Error) return error.message;
    return 'خطای نامشخص در ارتباط با سرور';
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanPhone = toAsciiDigits(phoneInput.trim()).replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setAuthError('لطفاً شماره تلفن همراه معتبر وارد نمایید.');
      return;
    }

    setIsSubmitting(true);
    try {
      await requestOtp(cleanPhone);
      setPhoneInput(cleanPhone);
      setOtpCodeInput('');
      setOtpTimer(60);
      setStep('code');
    } catch (error) {
      setAuthError(errorText(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanCode = toAsciiDigits(otpCodeInput.trim());
    if (cleanCode.length !== 6) {
      setAuthError('کد ۶ رقمی ارسال‌شده را وارد نمایید.');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyOtp(phoneInput, cleanCode);
      // Role step (or auto-switch) happens once pendingRoles updates.
    } catch (error) {
      setAuthError(errorText(error));
      setIsSubmitting(false);
    }
  };

  const handleSwitchRole = async (userRoleId: number) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await switchRole(userRoleId);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setAuthError(errorText(error));
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await requestOtp(phoneInput);
      setOtpTimer(60);
    } catch (error) {
      setAuthError(errorText(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  // pendingRoles updates after verifyOtp → advance to the selection step.
  useEffect(() => {
    if (pendingRoles.length === 0) return;
    setIsSubmitting(false);
    if (pendingRoles.length === 1) {
      void handleSwitchRole(pendingRoles[0].id);
    } else {
      setStep('roles');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRoles]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC] dark:bg-[#0c1322] text-[#202B3C] dark:text-[#F1F5FB] transition-colors">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0c1322]/85 backdrop-blur-xl border-b border-[#DCE3EE] dark:border-[#223147] px-4 lg:px-8 h-16 flex items-center justify-between shadow-2xs">
        <Link
          to="/"
          className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#2457C5] dark:hover:text-[#8BAEFF] transition-colors"
        >
          <ArrowRight size={16} />
          بازگشت به صفحه اصلی
        </Link>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="تغییر پوسته"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <SchoolLogo className="w-16 h-16 mx-auto mb-4" />
            <h1 className="text-2xl font-black">ورود به سامانه مشاهیر آینده</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              ورود تنها با کد یکبارمصرف پیامکی انجام می‌شود
            </p>
          </div>

          <Card className="p-6">
            {step === 'phone' && (
              <form onSubmit={handleSendOtp} className="space-y-5">
                <FormField label="شماره موبایل ثبت‌شده" required hint="همان شماره‌ای که مدرسه در پرونده ثبت کرده است">
                  <div className="relative" dir="ltr">
                    <Smartphone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoFocus
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="0912..."
                      className="w-full h-11 pr-4 pl-10 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] focus:ring-2 focus:ring-[#2457C5]/40 focus:border-[#2457C5] outline-none transition-all"
                    />
                  </div>
                </FormField>

                {authError && (
                  <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
                    <AlertTriangle size={15} className="shrink-0" />
                    {authError}
                  </div>
                )}

                <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (
                    <span className="flex items-center gap-2 justify-center">
                      <KeyRound size={16} />
                      دریافت کد ورود
                    </span>
                  )}
                </Button>
              </form>
            )}

            {step === 'code' && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Smartphone size={14} />
                  کد به شماره <b dir="ltr">{phoneInput}</b> ارسال شد
                  <button
                    type="button"
                    onClick={() => { setStep('phone'); setAuthError(null); }}
                    className="text-[#2457C5] dark:text-[#8BAEFF] font-bold"
                  >
                    اصلاح شماره
                  </button>
                </div>

                <FormField label="کد ۶ رقمی" required>
                  <div className="relative" dir="ltr">
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showCode ? 'text' : 'password'}
                      inputMode="numeric"
                      autoFocus
                      maxLength={6}
                      value={otpCodeInput}
                      onChange={(e) => setOtpCodeInput(e.target.value)}
                      placeholder="______"
                      className="w-full h-11 pr-4 pl-10 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] tracking-[0.5em] text-center text-lg font-bold focus:ring-2 focus:ring-[#2457C5]/40 focus:border-[#2457C5] outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label="نمایش کد"
                    >
                      {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>

                {authError && (
                  <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
                    <AlertTriangle size={15} className="shrink-0" />
                    {authError}
                  </div>
                )}

                <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (
                    <span className="flex items-center gap-2 justify-center">
                      <ShieldCheck size={16} />
                      ورود به سامانه
                    </span>
                  )}
                </Button>

                <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                  {otpTimer > 0 ? (
                    <span>ارسال مجدد کد تا <b>{otpTimer}</b> ثانیه دیگر</span>
                  ) : (
                    <button type="button" onClick={handleResend} disabled={isSubmitting} className="text-[#2457C5] dark:text-[#8BAEFF] font-bold">
                      ارسال مجدد کد
                    </button>
                  )}
                </div>
              </form>
            )}

            {step === 'roles' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3">
                  <CheckCircle2 size={15} className="shrink-0" />
                  کد تأیید شد؛ لطفاً نقش فعال خود را انتخاب کنید
                </div>

                {authError && (
                  <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
                    <AlertTriangle size={15} className="shrink-0" />
                    {authError}
                  </div>
                )}

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {pendingRoles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => handleSwitchRole(role.id)}
                      disabled={isSubmitting}
                      className="w-full text-right p-4 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] hover:border-[#2457C5] hover:ring-2 hover:ring-[#2457C5]/20 transition-all disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#2457C5]/10 text-[#2457C5] dark:text-[#8BAEFF] flex items-center justify-center">
                            <Users size={17} />
                          </div>
                          <div>
                            <div className="text-sm font-bold">{role.role_title}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <School size={11} />
                              {role.school_name}
                            </div>
                          </div>
                        </div>
                        <ArrowLeft size={16} className="text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  <Badge variant="neutral" className="text-[10px]">
                    تعویض نقش بعداً از هدر داشبورد نیز ممکن است
                  </Badge>
                </div>
              </div>
            )}
          </Card>

          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-6 leading-relaxed">
            شماره شما در سامانه ثبت نشده؟ با دفتر مدرسه تماس بگیرید.
            <br />
            هیچ کاربری اطلاعاتی خارج از مجوزش نمی‌بیند.
          </p>
        </div>
      </main>
    </div>
  );
};
