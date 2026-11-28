<?php

namespace App\Modules\Imports\Services;

use RuntimeException;
use ZipArchive;

/**
 * Reads the data rows of a school roster file: CSV or Excel (xlsx).
 *
 * xlsx is parsed with ZipArchive + SimpleXML — both ship with PHP and the
 * production bootstrap (php8.4-zip, php8.4-xml) — so no spreadsheet package
 * rides along: shared strings AND inline strings, the first worksheet resolved
 * through the workbook rels, dense rows padded/truncated to the header width
 * by the caller. The old binary .xls (OLE2) is refused with a conversion hint.
 */
final class SpreadsheetReader
{
    public const LEGACY_XLS_MESSAGE = 'فرمت .xls قدیمی پشتیبانی نمی‌شود؛ فایل را در Excel با Save As به xlsx یا csv تبدیل کنید.';

    /** @return list<list<?string>> every row (header included), cells trimmed or null */
    public static function rows(string $path): array
    {
        $magic = (string) (@file_get_contents($path, false, null, 0, 8));

        if (str_starts_with($magic, "PK\x03\x04")) {
            return self::xlsxRows($path);
        }

        if (self::isLegacyXlsMagic($magic)) {
            throw new RuntimeException(self::LEGACY_XLS_MESSAGE);
        }

        $rows = [];
        $handle = fopen($path, 'r');
        if ($handle === false) {
            return $rows;
        }

        try {
            while (($raw = fgetcsv($handle, 0, ',')) !== false) {
                $rows[] = array_map(fn ($v) => $v === null ? null : trim((string) $v), $raw);
            }
        } finally {
            fclose($handle);
        }

        return $rows;
    }

    /** OLE2 compound document — the container every legacy .xls ships in. */
    public static function looksLikeLegacyXls(string $path): bool
    {
        return self::isLegacyXlsMagic((string) (@file_get_contents($path, false, null, 0, 8)));
    }

    private static function isLegacyXlsMagic(string $magic): bool
    {
        return str_starts_with($magic, "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1");
    }

    /** @return list<list<?string>> */
    private static function xlsxRows(string $path): array
    {
        $zip = new ZipArchive;
        if ($zip->open($path, ZipArchive::RDONLY) !== true) {
            throw new RuntimeException('فایل اکسل باز نشد؛ فایل را در Excel باز و دوباره با فرمت xlsx ذخیره کنید.');
        }

        try {
            $shared = self::sharedStrings($zip);
            $sheetXml = self::firstSheetXml($zip);

            $main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
            $rows = [];

            foreach ($sheetXml->children($main)->sheetData->row as $row) {
                $cells = [];

                foreach ($row->children($main)->c as $cell) {
                    // SimpleXML quirk: after children(ns), bracket-style
                    // attribute access returns empty — attributes() works.
                    $attrs = $cell->attributes();
                    $letters = preg_replace('/\d/', '', (string) ($attrs['r'] ?? ''));
                    if ($letters === null || $letters === '') {
                        continue;
                    }

                    $index = self::columnIndex($letters);
                    $type = (string) ($attrs['t'] ?? 'n');

                    if ($type === 'inlineStr') {
                        $text = self::textOf($cell->children($main)->is);
                    } else {
                        $value = (string) ($cell->v ?? '');
                        $text = $type === 's' ? ($shared[(int) $value] ?? '') : $value;
                    }

                    $text = trim($text);
                    $cells[$index] = $text !== '' ? $text : null;
                }

                if ($cells === []) {
                    $rows[] = [];
                    continue;
                }

                // Dense row: A..last used column, gaps are null.
                $width = max(array_keys($cells)) + 1;
                $rows[] = array_replace(array_fill(0, $width, null), $cells);
            }

            return $rows;
        } finally {
            $zip->close();
        }
    }

    /** @return list<string> */
    private static function sharedStrings(ZipArchive $zip): array
    {
        $xml = self::load($zip, 'xl/sharedStrings.xml');
        if ($xml === null) {
            return [];
        }

        $main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
        $strings = [];

        foreach ($xml->children($main)->si as $si) {
            $strings[] = self::textOf($si);
        }

        return $strings;
    }

    private static function firstSheetXml(ZipArchive $zip): \SimpleXMLElement
    {
        $rels = self::load($zip, 'xl/_rels/workbook.xml.rels');
        $targets = [];

        if ($rels !== null) {
            foreach ($rels->Relationship as $relationship) {
                $targets[(string) $relationship['Id']] = (string) $relationship['Target'];
            }
        }

        $workbook = self::load($zip, 'xl/workbook.xml');
        if ($workbook === null) {
            throw new RuntimeException('ساختار فایل اکسل خوانده نشد.');
        }

        // The FIRST worksheet in workbook order — not simply sheet1.xml,
        // which breaks when sheets were reordered or renamed.
        $main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
        $r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
        $workbook->registerXPathNamespace('main', $main);
        $workbook->registerXPathNamespace('r', $r);
        $sheet = $workbook->xpath('//main:sheet')[0] ?? null;
        $relationshipId = $sheet !== null ? (string) ($sheet->attributes($r)->id ?? '') : '';

        $target = $targets[$relationshipId] ?? 'worksheets/sheet1.xml';
        $target = ltrim($target, '/');
        if (! str_starts_with($target, 'xl/')) {
            $target = 'xl/' . $target;
        }

        $sheetXml = self::load($zip, $target);
        if ($sheetXml === null) {
            throw new RuntimeException('برگهٔ اول فایل اکسل خوانده نشد.');
        }

        return $sheetXml;
    }

    private static function load(ZipArchive $zip, string $entry): ?\SimpleXMLElement
    {
        $xml = $zip->getFromName($entry);
        if ($xml === false) {
            return null;
        }

        $parsed = simplexml_load_string($xml);
        if ($parsed === false) {
            throw new RuntimeException('ساختار فایل اکسل خوانده نشد.');
        }

        return $parsed;
    }

    /** Concatenated <t> text of a shared/inline string node (rich runs included). */
    private static function textOf(\SimpleXMLElement $node): string
    {
        $main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
        $text = '';

        foreach ($node->children($main) as $child) {
            $name = $child->getName();
            if ($name === 't') {
                $text .= (string) $child;
            } elseif ($name === 'r') {
                foreach ($child->children($main) as $run) {
                    if ($run->getName() === 't') {
                        $text .= (string) $run;
                    }
                }
            }
        }

        return $text;
    }

    private static function columnIndex(string $letters): int
    {
        $index = 0;
        foreach (str_split(strtoupper($letters)) as $letter) {
            $index = $index * 26 + (ord($letter) - ord('A') + 1);
        }

        return $index - 1;
    }
}
