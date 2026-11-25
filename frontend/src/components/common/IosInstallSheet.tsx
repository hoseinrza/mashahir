import React, { useEffect, useState } from 'react';
import { Share, Plus, X } from 'lucide-react';
import { cn } from '../../utils/persian';

/**
 * راهنمای «افزودن به صفحهٔ اصلی» برای iPhone — Safari دکمهٔ install خودکار
 * ندارد (قبلinstallprompt کروم را پشتیبانی نمی‌کند)، پس برای یوزر ایجنت آیفون
 * یک bottom-sheet با راهنمای سه‌مرحله‌ای بالا می‌آید. در سه حالت هرگز نشان
 * داده نمی‌شود: داخل اپ native (پوستهٔ Capacitor)، وقتی اپ از قبل روی هوم
 * نصب و standalone باز شده، و وقتی کاربر «دیگر نشان نده» زده باشد؛ بستن
 * ساده هم هفت‌روز cooldown می‌گذارد.
 */

const SEEN_KEY = 'mashahir_ios_a2hs_seen_at';
const FOREVER_KEY = 'mashahir_ios_a2hs_forever';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** iPhone / iPod user agent — iPad's desktop-class UA stays out on purpose. */
const isIosUserAgent = (): boolean => /iphone|ipod/i.test(navigator.userAgent);

/** Already installed: iOS home-screen web app or any standalone display mode. */
const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches
  || (window.navigator as unknown as { standalone?: boolean }).standalone === true;

/** Inside the packaged Capacitor shell — the icon already lives on the home screen. */
const isNativeShell = (): boolean =>
  Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

export const IosInstallSheet: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIosUserAgent() || isStandalone() || isNativeShell()) return;
    if (localStorage.getItem(FOREVER_KEY) === '1') return;

    const last = Number(localStorage.getItem(SEEN_KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) return;

    // Rise after the first paint, never over the splash of the page itself.
    const timer = setTimeout(() => {
      setVisible(true);
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = (forever: boolean) => {
    setVisible(false);
    localStorage.setItem(SEEN_KEY, String(Date.now()));
    if (forever) localStorage.setItem(FOREVER_KEY, '1');
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs animate-in fade-in"
      onClick={() => dismiss(false)}
    >
      {/* Bottom sheet — dvh-safe: iOS Safari/WKWebView resize 100vh under the keyboard. */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-x border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] shadow-2xl p-5 pb-safe animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600" />

        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">
            مشاهیر آینده را به صفحهٔ اصلی اضافه کن
          </h3>
          <button
            onClick={() => dismiss(false)}
            className="p-1 rounded-lg text-[#526176] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors cursor-pointer shrink-0"
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>

        <ol className="space-y-3 text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
          <li className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-xl bg-[#EAF1FB] dark:bg-[#1D2B44] text-[#2457C5] dark:text-[#8BAEFF] flex items-center justify-center shrink-0">
              <Share size={14} />
            </span>
            <span className="pt-1">
              <strong className="text-[#202B3C] dark:text-[#F1F5FB]">قدم ۱ —</strong> در Safari، نوار پایین روی دکمهٔ
              <span className="inline-flex items-center gap-1 mx-1 font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                <Share size={13} className="inline" /> اشتراک‌گذاری
              </span>
              (مربع با فلش رو به بالا) بزن.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-xl bg-[#EAF1FB] dark:bg-[#1D2B44] text-[#2457C5] dark:text-[#8BAEFF] flex items-center justify-center shrink-0">
              <Plus size={14} />
            </span>
            <span className="pt-1">
              <strong className="text-[#202B3C] dark:text-[#F1F5FB]">قدم ۲ —</strong> از فهرست بازشده گزینهٔ
              <span className="mx-1 font-bold text-[#202B3C] dark:text-[#F1F5FB]">Add to Home Screen</span>
              (افزودن به صفحهٔ اصلی) را انتخاب کن.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-xl bg-[#EAF1FB] dark:bg-[#1D2B44] text-[#2457C5] dark:text-[#8BAEFF] flex items-center justify-center shrink-0">
              ✓
            </span>
            <span className="pt-1">
              <strong className="text-[#202B3C] dark:text-[#F1F5FB]">قدم ۳ —</strong> «افزودن» را بزن؛ آیکون مدرسه روی
              صفحهٔ اصلی می‌نشیند و اپ مثل یک اپ واقعی، تمام‌صفحه و بدون نوار Safari باز می‌شود.
            </span>
          </li>
        </ol>

        <div className="flex items-center justify-between gap-2 pt-4 mt-1 border-t border-[#DCE3EE]/70 dark:border-[#344257]/70">
          <button
            onClick={() => dismiss(true)}
            className={cn('text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer')}
          >
            دیگر نشان نده
          </button>
          <button
            onClick={() => dismiss(false)}
            className="text-xs font-bold px-4 py-2 rounded-xl bg-[#2457C5] hover:bg-[#1d49ab] text-white shadow-sm transition-colors cursor-pointer"
          >
            فهمیدم
          </button>
        </div>
      </div>
    </div>
  );
};
