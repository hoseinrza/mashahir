import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Smartphone, ShieldCheck, AlertTriangle, Sun, Moon,
  Loader2, KeyRound, CheckCircle2, Users, School, GraduationCap, BookOpen,
  HeartHandshake, BellRing, ClipboardCheck, EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { SchoolLogo, Button, Badge } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { ApiError } from '../api/client';
import type { RoleOption } from '../api/client';

/**
 * ورود واقعی: فقط کد یکبارمصرف پیامکی.
 * شماره → کد (۶ خانه با پرش خودکار) → انتخاب نقش (چندمدرسه‌ای/چندنقشی) → داشبورد.
 */

const ROLE_ICONS: Record<string, React.ReactNode> = {
  teacher: <BookOpen size={17} />,
  school_admin: <ShieldCheck size={17} />,
  academic_deputy: <ClipboardCheck size={17} />,
  guardian: <HeartHandshake size={17} />,
  student: <GraduationCap size={17} />,
  office_manager: <School size={17} />,
  platform_admin: <School size={17} />,
};

const ROLE_COLORS: Record<string, string> = {
  teacher: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
  school_admin: 'text-[#2457C5] dark:text-[#8BAEFF] bg-[#2457C5]/10',
  academic_deputy: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50',
  guardian: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50',
  student: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
  office_manager: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50',
  platform_admin: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/50',
};

export const LoginPage: React.FC = () => {
  const { requestOtp, verifyOtp, switchRole, pendingRoles, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [step, setStep] = useState<'phone' | 'code' | 'roles'>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const switchingRef = useRef(false);

  // Already authenticated → dashboard
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  // Resend countdown
  useEffect(() => {
    if (step !== 'code' || otpTimer <= 0) return;
    const t = setInterval(() => setOtpTimer((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [step, otpTimer]);

  // Roles arrived → advance (single role auto-switches)
  useEffect(() => {
    if (pendingRoles.length === 0) return;
    setIsSubmitting(false);
    if (pendingRoles.length === 1) void handleSwitchRole(pendingRoles[0].id);
    else setStep('roles');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRoles]);

  const toAscii = (v: string) => v.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const errorText = (e: unknown) =>
    e instanceof ApiError ? e.firstError() : e instanceof Error ? e.message : 'خطای نامشخص در ارتباط با سرور';

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const clean = toAscii(phoneInput.trim()).replace(/\D/g, '');
    if (clean.length < 10) {
      setAuthError('لطفاً شماره موبایل معتبر وارد نمایید.');
      return;
    }
    setIsSubmitting(true);
    try {
      await requestOtp(clean);
      setPhoneInput(clean);
      setDigits(['', '', '', '', '', '']);
      setOtpTimer(60);
      setStep('code');
    } catch (err) {
      setAuthError(errorText(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setAuthError(null);
    const code = digits.join('');
    if (code.length !== 6) {
      setAuthError('کد ۶ رقمی را کامل وارد نمایید.');
      return;
    }
    setIsSubmitting(true);
    try {
      await verifyOtp(phoneInput, code);
    } catch (err) {
      setAuthError(errorText(err));
      setIsSubmitting(false);
    }
  };

  const handleSwitchRole = async (userRoleId: number) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await switchRole(userRoleId);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setAuthError(errorText(err));
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await requestOtp(phoneInput);
      setOtpTimer(60);
    } catch (err) {
      setAuthError(errorText(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── segmented OTP helpers ──
  const setDigitAt = (idx: number, raw: string) => {
    const digit = toAscii(raw).replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = digit;
      return next;
    });
    if (digit && idx < 5) digitRefs.current[idx + 1]?.focus();
  };

  const onDigitKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      digitRefs.current[idx - 1]?.focus();
    }
  };

  const onDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = toAscii(e.clipboardData.getData('text')).replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      return next;
    });
    digitRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const codeComplete = digits.every((d) => d !== '');

  const themeBtn = (
    <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="تغییر پوسته">
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );

  return (
    <div className="min-h-screen flex bg-[#F7F9FC] dark:bg-[#0c1322] text-[#202B3C] dark:text-[#F1F5FB] transition-colors">
      {/* ── Brand panel (desktop) ── */}
      <aside className="hidden lg:flex flex-col justify-between w-[42%] p-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1B3A8F 0%, #2457C5 45%, #4C7FF0 100%)' }}>
      <div className="absolute inset-0 opacity-20" style={{
        background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.25) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,.18) 0, transparent 45%)',
      }} />
        <div className="relative flex items-center gap-3 text-white">
          <SchoolLogo className="w-11 h-11" />
          <div>
            <p className="font-black text-lg leading-tight">مشاهیر آینده</p>
            <p className="text-[11px] text-blue-100">سامانه یکپارچه آموزشی</p>
          </div>
        </div>

        <div className="relative space-y-7 text-white">
          <h2 className="text-3xl font-black leading-relaxed">
            یک سامانه،
            <br />
            کل مدرسه در یک نگاه
          </h2>
          <ul className="space-y-4 text-sm">
            {[
              [<BellRing key="a" size={16} />, 'حضور و غیاب با پیامک خودکار به اولیا'],
              [<ClipboardCheck key="b" size={16} />, 'آزمون آنلاین و کارنامه در دو نسخه جدا'],
              [<HeartHandshake key="c" size={16} />, 'حریم خصوصی کامل خانواده‌ها، حتی ولی‌های جداشده'],
            ].map(([icon, text], i) => (
              <li key={i} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
                <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">{icon}</span>
                {text as string}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-blue-100 leading-relaxed">
          کنترل دسترسی فقط سمت سرور؛ هیچ کاربری اطلاعاتی خارج از مجوزش نمی‌بیند.
        </p>
      </aside>

      {/* ── Form side ── */}
      <main className="flex-1 flex flex-col relative">
        <div className="pt-[env(safe-area-inset-top)] border-b border-[#DCE3EE] dark:border-[#223147]">
          <div className="flex items-center justify-between px-5 lg:px-8 h-16">
            <div className="lg:hidden flex items-center gap-2">
              <SchoolLogo className="w-8 h-8" />
              <span className="text-sm font-bold">مشاهیر آینده</span>
            </div>
            <Link to="/" className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-[#2457C5] transition-colors">
              <ArrowRight size={14} /> صفحه معرفی
            </Link>
            {themeBtn}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-5">
          <div className="w-full max-w-md">
            {/* step indicator */}
            <div className="flex items-center justify-center gap-2 mb-8" dir="ltr">
              {['شماره', 'کد', 'نقش'].map((label, i) => {
                const idx = { phone: 0, code: 1, roles: 2 }[step];
                const active = i <= idx;
                return (
                  <React.Fragment key={label}>
                    {i > 0 && <span className={cn('w-8 h-0.5 rounded', active ? 'bg-[#2457C5] dark:bg-[#8BAEFF]' : 'bg-slate-200 dark:bg-slate-700')} />}
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                        active ? 'bg-[#2457C5] text-white dark:bg-[#8BAEFF] dark:text-[#101722]' : 'bg-slate-200 text-slate-500 dark:bg-slate-700',
                      )}>{toPersianDigits(i + 1)}</span>
                      <span className={cn('text-[10px]', active ? 'font-bold text-[#2457C5] dark:text-[#8BAEFF]' : 'text-slate-400')}>{label}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* ── Step: phone ── */}
            {step === 'phone' && (
              <form onSubmit={handleSendOtp} className="space-y-5">
                <div className="text-center mb-2">
                  <h1 className="text-2xl font-black">ورود به سامانه</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">کد یکبارمصرف به موبایل شما پیامک می‌شود</p>
                </div>
                <div className="relative" dir="ltr">
                  <Smartphone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel" inputMode="numeric" autoFocus dir="ltr"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="۰۹۱۲ · · ·  · · ·  · ·"
                    className="w-full h-12 pr-4 pl-11 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-center text-base font-bold tracking-widest focus:ring-2 focus:ring-[#2457C5]/40 focus:border-[#2457C5] outline-none transition-all"
                  />
                </div>
                {authError && (
                  <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
                    <AlertTriangle size={14} className="shrink-0" /> {authError}
                  </div>
                )}
                <Button type="submit" className="w-full h-12 text-sm" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : (
                    <span className="flex items-center gap-2"><KeyRound size={15} /> دریافت کد ورود</span>
                  )}
                </Button>
                <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
                  <EyeOff size={12} /> ورود با رمز عبور وجود ندارد — امن‌تر و ساده‌تر
                </p>
              </form>
            )}

            {/* ── Step: code ── */}
            {step === 'code' && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="text-center">
                  <p className="text-sm">کد ۶ رقمی به شماره زیر ارسال شد</p>
                  <p className="text-sm font-bold mt-1" dir="ltr">{toPersianDigits(phoneInput)}</p>
                </div>

                <div dir="ltr" className="flex justify-center gap-2" onPaste={onDigitPaste}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { digitRefs.current[i] = el; }}
                      type="tel" inputMode="numeric" maxLength={1} autoFocus={i === 0}
                      value={d ? toPersianDigits(d) : ''}
                      onChange={(e) => setDigitAt(i, e.target.value)}
                      onKeyDown={(e) => onDigitKeyDown(i, e)}
                      className={cn(
                        'w-12 h-14 rounded-xl border text-center text-xl font-black outline-none transition-all',
                        d ? 'border-[#2457C5] dark:border-[#8BAEFF] ring-2 ring-[#2457C5]/20 dark:ring-[#8BAEFF]/20'
                          : 'border-[#DCE3EE] dark:border-[#223147]',
                        'bg-white dark:bg-[#131C2E] focus:border-[#2457C5] focus:ring-2 focus:ring-[#2457C5]/30',
                      )}
                    />
                  ))}
                </div>

                {authError && (
                  <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
                    <AlertTriangle size={14} className="shrink-0" /> {authError}
                  </div>
                )}

                <Button type="submit" className="w-full h-12 text-sm" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : (
                    <span className="flex items-center gap-2"><ShieldCheck size={15} /> تأیید و ورود</span>
                  )}
                </Button>

                <div className="flex items-center justify-between text-xs">
                  <button type="button" onClick={() => { setStep('phone'); setAuthError(null); }}
                    className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-[#2457C5]">
                    <ArrowRight size={13} /> اصلاح شماره
                  </button>
                  {otpTimer > 0 ? (
                    <span className="text-slate-400">ارسال مجدد تا {toPersianDigits(otpTimer)} ثانیه</span>
                  ) : (
                    <button type="button" onClick={handleResend} disabled={isSubmitting}
                      className="text-[#2457C5] dark:text-[#8BAEFF] font-bold">ارسال مجدد کد</button>
                  )}
                </div>
              </form>
            )}

            {/* ── Step: roles ── */}
            {step === 'roles' && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                  <h1 className="text-lg font-black mt-2">کد تأیید شد</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">نقش فعال خود را انتخاب کنید</p>
                </div>

                {authError && (
                  <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
                    <AlertTriangle size={14} className="shrink-0" /> {authError}
                  </div>
                )}

                <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pl-0.5">
                  {pendingRoles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => handleSwitchRole(role.id)}
                      disabled={isSubmitting}
                      className="w-full text-right p-4 rounded-2xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] hover:border-[#2457C5] hover:ring-2 hover:ring-[#2457C5]/20 transition-all disabled:opacity-50 flex items-center gap-3"
                    >
                      <span className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', ROLE_COLORS[role.role_key] ?? ROLE_COLORS.platform_admin)}>
                        {ROLE_ICONS[role.role_key] ?? <Users size={18} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold">{role.role_title}</span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <School size={11} /> {role.school_name}
                        </span>
                      </span>
                      <ArrowLeft size={15} className="text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="px-5 py-4 text-center text-[11px] text-slate-400 dark:text-slate-500 border-t border-[#DCE3EE] dark:border-[#223147]">
          شماره شما در سامانه نیست؟ با دفتر مدرسه تماس بگیرید — دسترسی هر کاربر دقیقاً برابر مجوز اوست.
        </footer>
      </main>
    </div>
  );
};
