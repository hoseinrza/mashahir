/**
 * نمایش تاریخ/زمان شمسی — منبع واحد فرمت تاریخ در کل UI.
 * (تقویم persian با Intl؛ شمسی فقط در نمایش، ذخیره‌سازی UTC می‌ماند.)
 */

const DATE_FMT = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium' });
const DATETIME_FMT = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
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
    return DATETIME_FMT.format(new Date(localInputValue));
  } catch {
    return '';
  }
}
