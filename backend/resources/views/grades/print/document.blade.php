<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $document['title'] }} — {{ $school['name'] }}</title>
    <style>
        /* Fixed A4 sheet: the same structure for one card or for a whole class. */
        @page { size: A4 portrait; margin: 10mm; }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            padding: 16px 0 40px;
            background: #eef1f6;
            font-family: Tahoma, "Segoe UI", sans-serif;
            direction: rtl;
            color: #1a2230;
            font-size: 11px;
            line-height: 1.7;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .page {
            width: 210mm;
            min-height: 296mm;
            margin: 0 auto 14px;
            padding: 9mm 9mm 7mm;
            background: #fff;
            border: 1px solid #ccd4e2;
            display: flex;
            flex-direction: column;
        }

        .page:last-of-type { margin-bottom: 0; }

        @media print {
            body { background: #fff; padding: 0; }
            .no-print { display: none !important; }
            .page { width: auto; min-height: auto; margin: 0; border: 0; break-after: page; page-break-after: always; }
            .page:last-of-type { break-after: auto; page-break-after: auto; }
        }

        .toolbar {
            width: 210mm;
            margin: 0 auto 12px;
            padding: 10px 14px;
            background: #fff;
            border: 1px solid #ccd4e2;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            font-size: 11px;
        }

        .toolbar button {
            font-family: inherit;
            font-size: 12px;
            font-weight: bold;
            border: 0;
            border-radius: 8px;
            padding: 8px 18px;
            background: #2457C5;
            color: #fff;
            cursor: pointer;
        }

        .toolbar .hint { color: #56637a; }

        /* ── letterhead ── */
        .head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #2457C5;
        }

        .head .brand { display: flex; align-items: center; gap: 9px; }

        .head .school-name { font-size: 15px; font-weight: 900; color: #2457C5; }

        .head .school-sub { font-size: 10px; color: #56637a; }

        .head .doc { text-align: center; flex: 1; }

        .head .doc .title { font-size: 14px; font-weight: 900; letter-spacing: -.2px; }

        .head .doc .subtitle { font-size: 10px; color: #56637a; }

        .head .serial { text-align: left; font-size: 10px; color: #56637a; direction: ltr; }

        .head .serial .strong { font-weight: bold; color: #1a2230; }

        /* ── identity band ── */
        .identity {
            margin-top: 9px;
            border: 1px solid #ccd4e2;
            border-radius: 8px;
            padding: 8px 10px;
            background: #f7f9fd;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px 10px;
        }

        .field .label { font-size: 9px; color: #6b7a92; display: block; }

        .field .value { font-size: 11.5px; font-weight: bold; }

        .field.wide { grid-column: span 2; }

        .status {
            display: inline-block;
            padding: 1px 8px;
            border-radius: 6px;
            background: #e6f4ea;
            color: #14663a;
            border: 1px solid #9dc9ae;
            font-size: 10px;
            font-weight: bold;
        }

        /* ── grades table ── */
        table.grades { width: 100%; border-collapse: collapse; margin-top: 11px; }

        table.grades th, table.grades td {
            border: 1px solid #ccd4e2;
            padding: 6px 7px;
            text-align: center;
            font-size: 10.5px;
        }

        table.grades th { background: #eef3fb; color: #29405f; font-weight: 800; }

        table.grades td.subject { text-align: right; font-weight: bold; }

        table.grades td.remark { text-align: right; color: #3d4a60; font-size: 10px; }

        table.grades tbody tr:nth-child(even) td { background: #fbfcfe; }

        .num { font-variant-numeric: tabular-nums; font-weight: bold; }

        .bar { height: 4px; border-radius: 3px; background: #dfe6f0; margin-top: 4px; overflow: hidden; }

        .bar i { display: block; height: 100%; background: #2457C5; }

        .band { font-size: 9.5px; font-weight: bold; }

        .band-excellent { color: #12703a; }
        .band-good { color: #2457C5; }
        .band-acceptable { color: #96610a; }
        .band-needs_work { color: #a4271c; }

        .empty { padding: 18px; text-align: center; color: #6b7a92; border: 1px dashed #ccd4e2; margin-top: 11px; }

        /* ── summary + signature ── */
        .summary {
            margin-top: 11px;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
        }

        .tile { border: 1px solid #ccd4e2; border-radius: 8px; padding: 7px 9px; }

        .tile .label { font-size: 9px; color: #6b7a92; display: block; }

        .tile .value { font-size: 15px; font-weight: 900; color: #2457C5; font-variant-numeric: tabular-nums; }

        .tile .note { font-size: 9px; color: #6b7a92; }

        .spread { margin-top: 11px; border: 1px solid #ccd4e2; border-radius: 8px; padding: 8px 10px; font-size: 10px; }

        .spread .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 5px; }

        .chip { border: 1px solid #ccd4e2; border-radius: 20px; padding: 1px 9px; background: #f7f9fd; }

        .sign {
            margin-top: auto;
            padding-top: 14px;
            display: flex;
            justify-content: space-between;
            gap: 16px;
        }

        .sign .box { width: 45%; }

        .sign .who { font-size: 10px; color: #6b7a92; }

        .sign .line { margin-top: 26px; border-top: 1px dashed #9aa8be; padding-top: 4px; font-size: 10px; font-weight: bold; }

        .foot {
            margin-top: 10px;
            padding-top: 6px;
            border-top: 1px solid #ccd4e2;
            display: flex;
            justify-content: space-between;
            gap: 10px;
            font-size: 8.5px;
            color: #6b7a92;
        }

        .foot .code { direction: ltr; font-family: monospace; }
    </style>
</head>
<body>
    <div class="toolbar no-print">
        <span class="hint">
            {{ \App\Support\Jalali::digits($document['sheets']) }} برگه کارنامه آماده چاپ — هر برگه یک صفحه A4.
            در پنجره چاپ، «Save as PDF» گزینه خروجی PDF است.
        </span>
        <button type="button" onclick="window.print()">چاپ</button>
    </div>

    @foreach ($sheets as $sheet)
        @include('grades.print.sheet', [
            'sheet' => $sheet,
            'page' => $loop->iteration,
            'pages' => $document['sheets'],
        ])
    @endforeach

    <script>
        // The document is produced for the printer; opening it should already be the print dialog.
        window.addEventListener('load', function () {
            setTimeout(function () { window.print(); }, 400);
        });
    </script>
</body>
</html>
