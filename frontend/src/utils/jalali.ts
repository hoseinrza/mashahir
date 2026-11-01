/**
 * نمایش تاریخ/زمان شمسی — منبع واحد فرمت تاریخ در کل UI.
 * (تقویم persian با Intl؛ شمسی فقط در نمایش، ذخیره‌سازی UTC می‌ماند.)
 */

// ساعت رسمی مدرسه تهران است؛ نمایش باید به همین منطقه قفل شود تا صفحه با
// برگه چاپی (که سرور با Asia/Tehran می‌سازد) یک زمان را بگوید، نه منطقهٔ دستگاه کاربر.
const TEHRAN = 'Asia/Tehran';

const DATE_FMT = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeZone: TEHRAN });
const DATETIME_FMT = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: TEHRAN,
});

// ورودی datetime-local منطقه‌ای ندارد: همان ساعت دیواری که کاربر تایپ کرده است.
const LOCAL_DATETIME_FMT = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** ۱۴۰۵/۸/۶ */
export function formatJalaliDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return DATE_FMT.format(new Date(iso));
  } catch {
    return iso;
  }
}

/** ۱۴۰۵/۸/۶، ۱۹:۵۶ */
export function formatJalaliDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return DATETIME_FMT.format(new Date(iso));
  } catch {
    return iso;
  }
}

/** پیش‌نمایش جلالی برای ورودی datetime-local گرگوری */
export function jalaliPreview(localInputValue: string): string {
  if (!localInputValue) return '';
  try {
    return LOCAL_DATETIME_FMT.format(new Date(localInputValue));
  } catch {
    return '';
  }
}

/** شماره ماه شمسی (۱..۱۲) — پیش‌فرض انتخابگر دوره کارنامه ماهانه. */
export function jalaliMonth(date: Date = new Date()): number {
  const part = new Intl.DateTimeFormat('en-u-ca-persian', { month: 'numeric', day: 'numeric', year: 'numeric', timeZone: TEHRAN })
    .formatToParts(date)
    .find((p) => p.type === 'month');

  return Number(part?.value) || 1;
}
