@php
    use App\Support\Jalali;
    $band_class = fn (string|null $key): string => $key ? 'band-'.$key : '';
@endphp

<section class="page">
    <header class="head">
        <div class="brand">
            <svg width="42" height="42" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="48" height="48" rx="12" fill="#2457C5"/>
                <path d="M12 34C16 33 21 33 24 36C27 33 32 33 36 34V16C32 15 27 15 24 18C21 15 16 15 12 16V34Z" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M24 18V36" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M24 10L27 13L24 16L21 13L24 10Z" fill="#F4B740"/>
            </svg>
            <div>
                <div class="school-name">{{ $school['name'] }}</div>
                <div class="school-sub">{{ $school['level_label'] }} — سامانه مدرسه</div>
            </div>
        </div>

        <div class="doc">
            <div class="title">{{ $sheet['kind_label'] }}</div>
            <div class="subtitle">{{ $sheet['term'] }} — نسخه {{ Jalali::digits($sheet['version']) }}</div>
        </div>

        <div class="serial">
            <div class="strong">برگه {{ Jalali::digits($page) }} از {{ Jalali::digits($pages) }}</div>
            <div>{{ Jalali::iso(now()) }}</div>
        </div>
    </header>

    <div class="identity">
        <div class="field wide">
            <span class="label">نام و نام خانوادگی دانش‌آموز</span>
            <span class="value">{{ $sheet['student_name'] }}</span>
        </div>
        <div class="field">
            <span class="label">کد دانش‌آموزی</span>
            <span class="value">{{ Jalali::digits($sheet['student_code']) }}</span>
        </div>
        <div class="field">
            <span class="label">کلاس</span>
            <span class="value">{{ $sheet['classroom'] }}</span>
        </div>
        <div class="field">
            <span class="label">وضعیت سند</span>
            <span class="value"><span class="status">{{ $sheet['status_label'] }}</span></span>
        </div>
        <div class="field">
            <span class="label">تاریخ انتشار رسمی</span>
            <span class="value">{{ $sheet['published_at'] }}</span>
        </div>
        <div class="field">
            <span class="label">صادرکننده</span>
            <span class="value">{{ $sheet['issued_by'] }}</span>
        </div>
        <div class="field">
            <span class="label">شناسه رسمی کارنامه</span>
            <span class="value" style="direction:ltr">{{ $sheet['ulid'] }}</span>
        </div>
    </div>

    @if (count($sheet['lines']) === 0)
        <div class="empty">سطر نمره‌ای برای این کارنامه ثبت نشده است؛ برگه صادر شده اما جدول ارزشیابی خالی است.</div>
    @else
        <table class="grades">
            <thead>
                <tr>
                    <th style="width: 5%">ردیف</th>
                    <th style="width: 20%">عنوان درس</th>
                    <th style="width: 15%">نوع ارزشیابی</th>
                    <th style="width: 13%">نمره خام</th>
                    <th style="width: 15%">نمره از {{ Jalali::digits(20) }}</th>
                    <th style="width: 13%">سطح توصیفی</th>
                    <th style="width: 19%">توضیح دبیر</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($sheet['lines'] as $line)
                    <tr>
                        <td class="num">{{ Jalali::digits($loop->iteration) }}</td>
                        <td class="subject">{{ $line['subject'] ?? '—' }}</td>
                        <td>{{ $line['source_label'] }}</td>
                        <td class="num">{{ $line['raw_text'] }}</td>
                        <td>
                            <div class="num">{{ $line['score20_text'] }}</div>
                            @if ($line['percent'] !== null)
                                <div class="bar"><i style="width: {{ min(100, max(0, $line['percent'])) }}%"></i></div>
                            @endif
                        </td>
                        <td class="band {{ $band_class($line['band_key']) }}">{{ $line['band_label'] }}</td>
                        <td class="remark">{{ $line['teacher_comment'] ?? '—' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <div class="summary">
        <div class="tile">
            <span class="label">میانگین از {{ Jalali::digits(20) }}</span>
            <span class="value">{{ $sheet['avg']['value'] ?? '—' }}</span>
            <span class="note">مقیاس رسمی همه نمره‌ها</span>
        </div>
        <div class="tile">
            <span class="label">سطح توصیفی میانگین</span>
            <span class="value" style="font-size: 12px">{{ $sheet['avg']['band'] ?? '—' }}</span>
            <span class="note">بر پایهٔ نمره‌های منتشرشده</span>
        </div>
        <div class="tile">
            <span class="label">رتبه در کلاس</span>
            <span class="value" style="font-size: 13px">
                {{ $sheet['rank'] !== null ? Jalali::digits($sheet['rank']).' از '.Jalali::digits($sheet['rank_of']) : '—' }}
            </span>
            <span class="note">{{ $sheet['rank'] !== null ? 'میان کارنامه‌های منتشرشدهٔ هم‌کلاسی‌ها' : 'هم‌کلاسی رتبه‌گیری نشده' }}</span>
        </div>
        <div class="tile">
            <span class="label">درس‌های اعلام‌شده</span>
            <span class="value">{{ Jalali::digits(count($sheet['lines'])) }}</span>
            <span class="note">سطر نمره در این دوره</span>
        </div>
        <div class="tile">
            <span class="label">نوع ارزشیابی</span>
            <span class="value" style="font-size: 12px">{{ $sheet['kind'] === 'online' ? 'آنلاین و مستمر' : 'حضوری' }}</span>
            <span class="note">کارنامه جداگانه برای هر نوع</span>
        </div>
    </div>

    <div class="spread">
        <span>توزیع نمره‌ها در بازه‌های توصیفی:</span>
        <div class="chips">
            @foreach (\App\Modules\Grades\Services\ReportCardSheetService::BANDS as $band)
                <span class="chip {{ $band_class($band['key']) }}">
                    {{ $band['label'] }}: {{ Jalali::digits($sheet['band_counts'][$band['key']] ?? 0) }}
                </span>
            @endforeach
        </div>
    </div>

    <div class="sign">
        <div class="box">
            <div class="who">امضای معاونت آموزشی</div>
            <div class="line">{{ $sheet['issued_by'] }}</div>
        </div>
        <div class="box">
            <div class="who">مهر و امضای مدیر مدرسه</div>
            <div class="line">{{ $school['name'] }}</div>
        </div>
    </div>

    <footer class="foot">
        <span>
            این برگه در {{ $document['generated_at'] }} توسط سامانه و برای «{{ $document['actor'] }}» تولید شده است.
            نمره‌های پیش‌نویس و تأییدشده که هنوز منتشر نشده‌اند در سند رسمی نمی‌آیند.
        </span>
        <span class="code">REF {{ $sheet['ulid'] }} · {{ Jalali::digits($page) }}/{{ Jalali::digits($pages) }}</span>
    </footer>
</section>
