<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * Gregorian → Jalali for anything the server renders (the official report-card
 * sheet). The UI converts dates in the browser; a printed document has to carry
 * the same calendar, so the conversion lives here rather than in Blade files.
 */
final class Jalali
{
    /** The first month of the solar year; the school year starts at index 7. */
    public const MONTHS = [
        1 => 'فروردین', 2 => 'اردیبهشت', 3 => 'خرداد', 4 => 'تیر',
        5 => 'مرداد', 6 => 'شهریور', 7 => 'مهر', 8 => 'آبان',
        9 => 'آذر', 10 => 'دی', 11 => 'بهمن', 12 => 'اسفند',
    ];

    public static function monthName(int $month): string
    {
        return self::MONTHS[$month] ?? (string) $month;
    }

    /** "day month-name year", all in Persian digits. */
    public static function date(?Carbon $at): string
    {
        if ($at === null) {
            return '—';
        }

        [$y, $m, $d] = self::parts($at);

        return self::digits($d).' '.self::monthName($m).' '.self::digits($y);
    }

    /** The day above plus the Tehran wall-clock time. */
    public static function dateTime(?Carbon $at): string
    {
        if ($at === null) {
            return '—';
        }

        return self::date($at).' — '.self::digits($at->copy()->setTimezone('Asia/Tehran')->format('H:i'));
    }

    /** The compact "yyyy/mm/dd" form used in a document header. */
    public static function iso(?Carbon $at): string
    {
        if ($at === null) {
            return '—';
        }

        [$y, $m, $d] = self::parts($at);

        return self::digits(sprintf('%04d/%02d/%02d', $y, $m, $d));
    }

    /** Latin digits never belong on a Persian official sheet. */
    public static function digits(string|int|float|null $value): string
    {
        if ($value === null) {
            return '—';
        }

        // 0x30..0x39 → 0x6F0..0x6F9: the Persian digit block sits 0x6C0 above ASCII.
        $converted = preg_replace_callback(
            '/[0-9]/',
            fn (array $m) => mb_chr(ord($m[0]) + 0x6C0, 'UTF-8'),
            (string) $value,
        );

        return str_replace('.', "\u{066B}", $converted);
    }

    /**
     * @return array{0:int,1:int,2:int} year, month, day
     */
    private static function parts(Carbon $at): array
    {
        $calendar = \IntlCalendar::createInstance('Asia/Tehran', 'en_US@calendar=persian');
        $calendar->setTime($at->getTimestamp() * 1000.0);

        return [
            $calendar->get(\IntlCalendar::FIELD_YEAR),
            $calendar->get(\IntlCalendar::FIELD_MONTH) + 1,
            $calendar->get(\IntlCalendar::FIELD_DAY_OF_MONTH),
        ];
    }
}
