/**
 * Persian number and date utilities for Mashahir-e Ayandeh System
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  return str.replace(/[0-9]/g, (w) => PERSIAN_DIGITS[parseInt(w, 10)] || w);
}

export function formatScore(score: number | undefined | null): string {
  if (score === undefined || score === null) return '—';
  // format with 2 decimals if fraction exists
  const formatted = Number.isInteger(score) ? score.toString() : score.toFixed(2);
  return toPersianDigits(formatted);
}

export function formatTimePersian(timeStr: string): string {
  if (!timeStr) return '';
  return toPersianDigits(timeStr);
}

export function formatPercent(value: number): string {
  return `${toPersianDigits(Math.round(value))}٪`;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
