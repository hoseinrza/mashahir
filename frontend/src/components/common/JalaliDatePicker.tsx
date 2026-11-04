import React from 'react';
import DatePickerModule from 'react-multi-date-picker';
import DateObject from 'react-date-object';
import gregorian from 'react-date-object/calendars/gregorian';
import gregorian_en from 'react-date-object/locales/gregorian_en';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import { cn } from '../../utils/persian';

/**
 * The package's CJS interop nests the real component: namespace.default =
 * forwardRef component. Unwrap defensively for both interop shapes.
 */
const DatePicker = (() => {
  const mod = DatePickerModule as unknown as { default?: unknown };
  return ((typeof mod?.default === 'object' || typeof mod?.default === 'function')
    ? mod.default
    : DatePickerModule) as React.ComponentType<Record<string, unknown>>;
})();

/**
 * Single Jalali date picker for the whole app: the calendar, digits and
 * weekday names are Persian; the value contract stays Gregorian ISO
 * (YYYY-MM-DD) so every API payload remains untouched.
 */
export const JalaliDatePicker: React.FC<{
  value: string | null | undefined; // ISO «YYYY-MM-DD» (Gregorian) or empty
  onChange: (iso: string) => void; // emits Gregorian ISO; '' on clear
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, placeholder = 'انتخاب تاریخ', disabled, className }) => {
  // The incoming value is Gregorian ISO — parse it on the Gregorian base;
  // the calendar prop below is what DISPLAYS it as Jalali (۱۴۰۵/۰۸/۱۳).
  const dateObject = value ? new DateObject(value) : undefined;

  return (
    <DatePicker
      value={dateObject}
      onChange={(d: unknown) => {
        const picked = d as DateObject | null;
        if (!picked || !picked.isValid) {
          onChange('');
          return;
        }
        onChange(new DateObject(picked).convert(gregorian, gregorian_en).format('YYYY-MM-DD'));
      }}
      calendar={persian}
      locale={persian_fa}
      calendarPosition="bottom-right"
      disabled={disabled}
      inputClass={cn(
        'w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl text-[#202B3C] dark:text-[#F1F5FB] focus:outline-none focus:border-[#2457C5] transition-colors',
        className,
      )}
      placeholder={placeholder}
      editable={false}
      fixRelativePosition
    />
  );
};

/**
 * Date + time in one row: Jalali calendar for the date, native time input
 * beside it. The value contract is «YYYY-MM-DDTHH:mm» (datetime-local shape)
 * so existing payloads stay untouched.
 */
export const JalaliDateTimePicker: React.FC<{
  value: string | null | undefined; // «YYYY-MM-DDTHH:mm» or empty
  onChange: (v: string) => void; // emits datetime-local shape; '' on clear
  disabled?: boolean;
  dateClassName?: string;
  timeClassName?: string;
  className?: string;
}> = ({ value, onChange, disabled, dateClassName, timeClassName, className }) => {
  const [datePart, timePartRaw] = (value ?? '').split('T');
  const time = (timePartRaw ?? '').slice(0, 5);

  const onDate = (iso: string) => {
    if (!iso) {
      onChange('');
      return;
    }
    onChange(`${iso}T${time || '00:00'}`);
  };

  const onTime = (t: string) => {
    const base = datePart || new Date().toISOString().slice(0, 10);
    onChange(`${base}T${t || '00:00'}`);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 min-w-[150px]">
        <JalaliDatePicker value={datePart || undefined} onChange={onDate} disabled={disabled} className={dateClassName} />
      </div>
      <input
        type="time"
        value={time}
        disabled={disabled}
        onChange={(e) => onTime(e.target.value)}
        className={cn(
          'text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl text-[#202B3C] dark:text-[#F1F5FB] focus:outline-none focus:border-[#2457C5] transition-colors',
          timeClassName,
        )}
      />
    </div>
  );
};
