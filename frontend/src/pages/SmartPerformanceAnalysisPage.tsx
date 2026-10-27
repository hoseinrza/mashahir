import React, { useState } from 'react';
import {
  Sparkles, TrendingUp, CheckCircle2, AlertCircle, BookOpen,
  Target, Award, Lightbulb, Compass, FileCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../components/common';
import { toPersianDigits, formatScore } from '../utils/persian';

export const SmartPerformanceAnalysisPage: React.FC = () => {
  const { activeStudent } = useAuth();
  const studentName = activeStudent?.fullName || 'پارسا رادمنش';

  // State to simulate switching student with sufficient vs insufficient data
  const [hasSufficientData, setHasSufficientData] = useState(true);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`تحلیل هوشمند و شناختی یادگیری — ${studentName}`}
        subtitle="پایش الگوهای حل تمرین، نقاط قوت، مباحث تمرینی و شواهد عینی عملکرد آموزشی"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHasSufficientData(!hasSufficientData)}
            >
              {hasSufficientData ? 'نمایش حالت داده ناکافی' : 'نمایش گزارش تحلیل کامل'}
            </Button>
          </div>
        }
      />

      {/* AI Simulation Disclaimer Banner */}
      <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2 text-right">
        <Sparkles size={16} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0" />
        <span>
          <strong>یادداشت روش‌شناختی:</strong> این گزارش یک تحلیل الگوریتمی و شبیه‌سازی‌شده بر مبنای داده‌های ثبت‌شده در آزمون‌ها و تکالیف است و جایگزین ارزیابی حضوری دبیران و مشاوران نمی‌باشد.
        </span>
      </div>

      {!hasSufficientData ? (
        <Card className="text-center py-12 space-y-3">
          <AlertCircle size={36} className="mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">داده کافی وجود ندارد</h3>
          <p className="text-xs text-[#526176] dark:text-[#B3C0D2] max-w-md mx-auto">
            برای این دانش‌آموز هنوز تعداد تکالیف و آزمون‌های مستمر به حد نصاب آماری (حداقل ۳ تمرین و ۲ آزمون) نرسیده است. پس از ثبت نمرات بیشتر، تحلیل به‌صورت خودکار ترسیم می‌شود.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Top Analytical Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Strengths */}
            <Card className="text-right border-emerald-200 dark:border-emerald-900/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <CheckCircle2 size={18} />
                  <span>نقاط قوت برجسته در یادگیری</span>
                </div>
                <Badge variant="success">عملکرد عالی</Badge>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs">
                  <h4 className="font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                    هندسه تحلیلی، معادلات درجه دوم و رسم سهمی
                  </h4>
                  <p className="text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                    دانش‌آموز در رسم منحنی‌های جبری، تشخیص نقطه راس و تقارن سهمی مهارت کامل نشان داده است.
                  </p>
                  <div className="mt-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-900/30 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <strong>شاهد و مستند عینی:</strong> نمره ۱۹.۵ در تکلیف هفتگی حسابان و پاسخ صحیح به سوالات ۱ و ۳ آزمون آنلاین دوره‌ای.
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs">
                  <h4 className="font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                    درک واژگان و مهارت تحلیلی زبان انگلیسی تخصصی
                  </h4>
                  <p className="text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                    تسلط بر متن‌های علمی و سرعت ترجمه ریدینگ بالاتر از میانگین کلاس است.
                  </p>
                  <div className="mt-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-900/30 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <strong>شاهد و مستند عینی:</strong> نمره ۱۹.۸۰ در آزمون آنلاین زبان و احراز رتبه ۱ در کلاس ۱۰۱.
                  </div>
                </div>
              </div>
            </Card>

            {/* 2. Areas for Practice */}
            <Card className="text-right border-amber-200 dark:border-amber-900/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                  <Target size={18} />
                  <span>مباحث نیازمند تمرین و تقویت مهارتی</span>
                </div>
                <Badge variant="warning">فرصت بهبود</Badge>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                  <h4 className="font-bold text-amber-950 dark:text-amber-200 mb-1">
                    محاسبه عدم قطعیت و دقت ابزارها در فیزیک
                  </h4>
                  <p className="text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                    در گزارش کار آزمایشگاه، محاسبه رقم‌های بامعنی و قوانین گرد کردن نیازمند بازبینی و مرور است.
                  </p>
                  <div className="mt-2 pt-2 border-t border-amber-200/50 dark:border-amber-900/30 text-[11px] text-amber-800 dark:text-amber-400">
                    <strong>شاهد و مستند عینی:</strong> بازخورد استاد کریمی در برگه آزمایشگاه و کسر ۱ نمره از بخش خطاسنجی.
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                  <h4 className="font-bold text-amber-950 dark:text-amber-200 mb-1">
                    بررسی شرط دامنه در ریشه‌های غیرقابل قبول معادلات گویا
                  </h4>
                  <p className="text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                    در تست‌های زمان‌دار، گاهی فراموشی بررسی مخرج صفر موجب انتخاب گزینه‌های دام‌دار می‌شود.
                  </p>
                  <div className="mt-2 pt-2 border-t border-amber-200/50 dark:border-amber-900/30 text-[11px] text-amber-800 dark:text-amber-400">
                    <strong>شاهد و مستند عینی:</strong> پاسخ سوال شماره ۲ کوییز آنلاین هفتگی.
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* 3. Progress Trend & Pedagogical Suggestions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Progress Trend */}
            <Card className="text-right">
              <div className="flex items-center gap-2 mb-3 text-[#2457C5] dark:text-[#8BAEFF] font-bold text-sm">
                <TrendingUp size={18} />
                <span>روند پیشرفت در طول نیم‌سال تحصیلی</span>
              </div>
              <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed mb-4">
                تغییرات معدل و بازدهی یادگیری در طول ماه‌های مهر تا دی نشان‌دهنده شیب صعودی پایدار با ثبات رفتاری بالا است.
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  <span>مهر ماه (شروع سال تحصیلی):</span>
                  <strong className="font-mono tabular-nums">۱۸.۲۰</strong>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  <span>آبان ماه (آزمون‌های میان‌ترم):</span>
                  <strong className="font-mono tabular-nums">۱۸.۶۵</strong>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  <span>آذر ماه (سنجش مستمر آنلاین):</span>
                  <strong className="font-mono tabular-nums">۱۹.۰۰</strong>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#2457C5] dark:text-[#8BAEFF] font-bold">
                  <span>دی ماه (کارنامه نهایی نوبت اول):</span>
                  <strong className="font-mono tabular-nums text-sm">۱۹.۱۲</strong>
                </div>
              </div>
            </Card>

            {/* Pedagogical Suggestions */}
            <Card className="text-right">
              <div className="flex items-center gap-2 mb-3 text-[#2457C5] dark:text-[#8BAEFF] font-bold text-sm">
                <Lightbulb size={18} />
                <span>پیشنهادهای آموزشی و توصیه‌های تکمیلی</span>
              </div>
              <div className="space-y-2.5 text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#2457C5]/10 text-[#2457C5] flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    ۱
                  </span>
                  <span>
                    <strong>تکنیک خلاصه‌نویسی گام‌ها:</strong> تهیه برگه فرمول‌های کلیدی و دام‌های تستی برای فصل اندازه‌گیری و بردارها قبل از آزمون بعدی.
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#2457C5]/10 text-[#2457C5] flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    ۲
                  </span>
                  <span>
                    <strong>تثبیت با تست‌های زمان‌دار:</strong> حل روزانه ۵ تست منتخب ریاضی با کنترل زمان‌سنج جهت افزایش سرعت تشخیص دامنه.
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#2457C5]/10 text-[#2457C5] flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    ۳
                  </span>
                  <span>
                    <strong>مشاوره تحصیلی:</strong> پیگیری زمان‌بندی مرور دروس عمومی مطابق برنامه هفتگی تنظیم‌شده با خانم حسینی.
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
