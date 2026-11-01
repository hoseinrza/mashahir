/**
 * Schedule helpers shared by the role dashboards.
 * The backend indexes the Iranian school week from 0 = Saturday.
 */

import { toPersianDigits } from './persian';

export const WEEKDAY_NAMES = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
] as const;

export function todayWeekday(now: Date = new Date()): number {
  return (now.getDay() + 1) % 7;
}

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? '—';
}

/** "08:00:00" from the API → "۰۸:۰۰". */
export function formatPeriodTime(hhmmss: string | null | undefined): string {
  if (!hhmmss) return '—';
  const [h, m] = hhmmss.split(':');
  return toPersianDigits(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}

/** Minutes since midnight for a local clock reading. */
export function minutesOfDay(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function timeToMinutes(hhmmss: string): number {
  const [h, m] = hhmmss.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
