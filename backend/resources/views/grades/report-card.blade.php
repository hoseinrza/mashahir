<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="utf-8">
    <title>کارنامه — {{ $card->student?->fullName() }}</title>
    <style>
        body { font-family: Tahoma, sans-serif; direction: rtl; padding: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #444; padding: 8px; text-align: center; }
        th { background: #eee; }
        .meta { color: #333; font-size: 13px; }
    </style>
</head>
<body>
    <h2>کارنامه {{ $card->kind === 'online' ? 'آنلاین' : 'حضوری' }} (نسخه {{ $card->version }})</h2>
    <div class="meta">
        دانش‌آموز: <b>{{ $card->student?->fullName() }}</b> —
        کد: {{ $card->student?->student_code }} —
        دوره: {{ $card->term?->title }} —
        وضعیت: {{ $card->status }} —
        تاریخ انتشار: {{ $card->published_at?->format('Y-m-d H:i') }}
    </div>
    <table>
        <tr><th>درس</th><th>نمره</th></tr>
        @foreach ($card->lines as $line)
            <tr>
                <td>{{ $line->subject?->title }}</td>
                <td>{{ $line->score }}</td>
            </tr>
        @endforeach
    </table>
</body>
</html>
