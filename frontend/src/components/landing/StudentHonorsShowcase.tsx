import React, { useState } from 'react';
import {
  Trophy, Award, Star, Medal, Sparkles, GraduationCap,
  ExternalLink, Search, CheckCircle2, ChevronLeft, X,
  Compass, Microscope, Landmark, Cpu, BookOpen, Quote
} from 'lucide-react';
import { toPersianDigits, cn } from '../../utils/persian';
import { Badge, Button } from '../common';

export interface HonorItem {
  id: string;
  name: string;
  honor: string;
  category: 'world_olympiad' | 'konkur_top' | 'national_olympiad' | 'kharazmi_ai';
  medalType: 'gold' | 'silver' | 'bronze' | 'rank_top';
  field: string;
  year: string;
  destination: string;
  gpaOrScore: string;
  mentor: string;
  quote: string;
  details: string;
  tags: string[];
}

export const StudentHonorsShowcase: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHonor, setSelectedHonor] = useState<HonorItem | null>(null);

  const categories = [
    { id: 'all', label: 'همه افتخارات', count: 8 },
    { id: 'world_olympiad', label: 'المپیادهای جهانی', count: 2 },
    { id: 'konkur_top', label: 'رتبه‌های برتر کنکور', count: 3 },
    { id: 'national_olympiad', label: 'المپیادهای کشوری', count: 2 },
    { id: 'kharazmi_ai', label: 'رباتیک و خوارزمی', count: 1 },
  ];

  const honorsData: HonorItem[] = [
    {
      id: 'h1',
      name: 'آرش کریمی',
      honor: 'مدال طلای المپیاد جهانی کامپیوتر (IOI 2024)',
      category: 'world_olympiad',
      medalType: 'gold',
      field: 'ریاضی و فیزیک · دیپلم افتخار بین‌المللی',
      year: '۱۴۰۳',
      destination: 'مهندسی کامپیوتر دانشگاه صنعتی شریف',
      gpaOrScore: 'نمره کامل الگوریتم و کدنویسی عملی',
      mentor: 'دکتر علیرضا فرید (مربی تیم ملی المپیاد)',
      quote: 'کارگاه‌های حل مسئله و تفکر الگوریتمی مشاهیر آینده، باور ناممکن‌ها را برایم ممکن ساخت.',
      details: 'کسب مدال طلای المپیاد بین‌المللی انفورماتیک (مصر) با رقابت میان ۳۶۰ شرکت‌کننده از ۹۰ کشور جهان پس از طی ۲ سال دوره فشرده در باشگاه پژوهشگران مشاهیر آینده.',
      tags: ['طلای جهانی', 'IOI 2024', 'کامپیوتر شریف']
    },
    {
      id: 'h2',
      name: 'سارا جلالی',
      honor: 'رتبه ۴ کشوری کنکور سراسری علوم تجربی',
      category: 'konkur_top',
      medalType: 'rank_top',
      field: 'علوم تجربی · رتبه ۱ منطقه ۱ تهران',
      year: '۱۴۰۲',
      destination: 'پزشکی دانشگاه علوم پزشکی تهران',
      gpaOrScore: 'درصد زیست‌شناسی ۹۶٪ · درصد شیمی ۹۲٪',
      mentor: 'دکتر احمدرضا جلالی و تیم مشاوران ارشد کنکور',
      quote: 'پایش موشکافانه هفتگی در پرتال مدرسه و برنامه‌ریزی شخصی، استرس کنکور را به یک مسیر لذت‌بخش تبدیل کرد.',
      details: 'کسب رتبه تک‌رقمی در کنکور سراسری با ثبت رکوردهای درخشان در آزمون‌های شبیه‌ساز و معدل کتبی نهایی ۲۰ در تمامی دروس پایه دوازدهم.',
      tags: ['رتبه ۴ کشور', 'پزشکی تهران', 'معدل ۲۰']
    },
    {
      id: 'h3',
      name: 'محمدمهدی تهرانی',
      honor: 'رتبه ۱۲ کنکور ریاضی و مدال نقره المپیاد فیزیک',
      category: 'konkur_top',
      medalType: 'silver',
      field: 'ریاضی و فیزیک · دوره ۲۴ نخبگان',
      year: '۱۴۰۳',
      destination: 'مهندسی کامپیوتر دانشگاه صنعتی شریف',
      gpaOrScore: 'تراز ۱۱۸۵۰ کنکور سراسری',
      mentor: 'مهندس محسن کریمی (سرپرست دپارتمان ریاضی)',
      quote: 'تعادل دقیق میان المپیاد و مباحث تستی کنکور، نقطه قوت بزرگ برنامه‌ریزی دبیرستان مشاهیر بود.',
      details: 'دارنده مدال نقره مرحله کشوری المپیاد فیزیک ایران و پذیرش در رشته مهندسی کامپیوتر شریف با درصدهای بالای ۹۰ در حسابان و هندسه.',
      tags: ['رتبه ۱۲ کشور', 'نقره المپیاد فیزیک', 'صنعتی شریف']
    },
    {
      id: 'h4',
      name: 'هلیا صادقی',
      honor: 'مدال نقره المپیاد جهانی زیست‌شناسی (IBO)',
      category: 'world_olympiad',
      medalType: 'silver',
      field: 'علوم تجربی و زیست‌شناسی مولکولی',
      year: '۱۴۰۲',
      destination: 'بیوتکنولوژی و پزشکی دانشگاه تهران',
      gpaOrScore: 'رتبه نخست بخش آزمایشگاهی و بیوشیمی بالینی',
      mentor: 'دکتر مریم مهدوی (استاد آزمایشگاه جامع نانو)',
      quote: 'آزمایشگاه بیولوژی سلولی مشاهیر آینده به ما یاد داد که فرضیات علمی را در عمل بیازماییم.',
      details: 'کسب مدال نقره جهانی در رقابت‌های بین‌المللی زیست‌شناسی با ارائه مقاله علمی در زمینه ساخت نانوحامل‌های دارویی هدفمند.',
      tags: ['نقره جهانی', 'IBO', 'پژوهش سلولی']
    },
    {
      id: 'h5',
      name: 'علیرضا شمس',
      honor: 'رتبه ۱ کشوری کنکور سراسری علوم انسانی',
      category: 'konkur_top',
      medalType: 'rank_top',
      field: 'علوم انسانی، دیپلماسی و حقوق بین‌الملل',
      year: '۱۴۰۲',
      destination: 'حقوق دانشگاه تهران',
      gpaOrScore: 'درصد ۱۰۰ در منطق و فلسفه و جامعه‌شناسی',
      mentor: 'استاد فراهانی (سرپرست باشگاه مناظره)',
      quote: 'کارگاه‌های مناظره و تفکر نقادانه مشاهیر آینده، درک من از علوم انسانی را دگرگون ساخت.',
      details: 'کسب عنوان رتبه نخست کشوری گروه علوم انسانی با بالاترین تراز ثبت‌شده سال و کسب طلای المپیاد ادبی مرحله نهایی.',
      tags: ['رتبه ۱ کشوری', 'حقوق تهران', 'المپیاد ادبی']
    },
    {
      id: 'h6',
      name: 'پرهام کاظمی',
      honor: 'مقام نخست جشنواره جوان خوارزمی و ثبت اختراع',
      category: 'kharazmi_ai',
      medalType: 'gold',
      field: 'فناوری نانو و رباتیک محیط زیست',
      year: '۱۴۰۳',
      destination: 'مهندسی مکانیک دانشگاه صنعتی شریف',
      gpaOrScore: 'گواهی ثبت اختراع کشوری به شماره ۱۰۲۸۴۹',
      mentor: 'مهندس سینا مرادی (سرپرست کارگاه‌های نوآوری)',
      quote: 'حمایت کامل مدرسه در تأمین تجهیزات سه‌بعدی و ایستگاه الکترونیک، ثبت اختراعم را میسر کرد.',
      details: 'طراحی و ساخت نمونه صنعتی ربات تصفیه پساب‌های صنعتی با غشاهای نانومتری و دریافت تندیس طلایی جشنواره خوارزمی.',
      tags: ['جشنواره خوارزمی', 'ثبت اختراع', 'رباتیک نانو']
    },
    {
      id: 'h7',
      name: 'کیانوش رستمی',
      honor: 'مدال طلای المپیاد کشوری نجوم و اخترفیزیک',
      category: 'national_olympiad',
      medalType: 'gold',
      field: 'ریاضی و اخترفیزیک محاسباتی',
      year: '۱۴۰۳',
      destination: 'عضو تیم ملی المپیاد نجوم ایران',
      gpaOrScore: 'معافیت کامل از کنکور سراسری',
      mentor: 'مهندس بهزاد ناصری (مسئول رصدخانه مجتمع)',
      quote: 'شب‌های رصدی در کویر و شب‌کاری در رصدخانه مدرسه، بهترین خاطرات علمی دوران تحصیل من بود.',
      details: 'کسب مدال طلای کشوری و راهیابی به اردوی نهایی تیم ملی المپیاد بین‌المللی نجوم و اخترفیزیک (IOAA).',
      tags: ['طلای کشوری', 'المپیاد نجوم', 'اخترفیزیک']
    },
    {
      id: 'h8',
      name: 'روژان داوودی',
      honor: 'مقام اول هکاتون ملی هوش مصنوعی و داده‌کاوی',
      category: 'national_olympiad',
      medalType: 'gold',
      field: 'پایه یازدهم ریاضی · کلاب هوش مصنوعی',
      year: '۱۴۰۳',
      destination: 'پذیرش مستقیم نخبگان بنیاد ملی',
      gpaOrScore: 'طراحی مدل پردازش زبان فارسی دانش‌آموزی',
      mentor: 'مهندس پوریا شمس (مدیر فناوری مجتمع)',
      quote: 'در مشاهیر آینده، هوش مصنوعی از سال دهم به عنوان یک ابزار قدرتمند پژوهشی تدریس می‌شود.',
      details: 'توسعه سیستم هوشمند پایش و پیش‌بینی بازده تحصیلی با استفاده از یادگیری ماشین و کسب تندیس برترین تیم پژوهشی دانش‌آموزی.',
      tags: ['هوش مصنوعی', 'هکاتون ملی', 'پژوهشگر جوان']
    }
  ];

  const filteredHonors = honorsData.filter((item) => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      item.name.includes(searchQuery) ||
      item.honor.includes(searchQuery) ||
      item.field.includes(searchQuery) ||
      item.destination.includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  const getMedalVisual = (type: HonorItem['medalType']) => {
    switch (type) {
      case 'gold':
        return {
          icon: <Medal className="w-5 h-5 text-amber-500" />,
          badgeClass: 'bg-gradient-to-r from-amber-400/20 to-yellow-500/20 text-amber-300 border-amber-400/40',
          title: 'مدال طلا',
          glow: 'from-amber-500/20 to-yellow-500/5',
          borderHover: 'group-hover:border-amber-400/80',
          badgeText: 'نشان زرین طلا'
        };
      case 'silver':
        return {
          icon: <Medal className="w-5 h-5 text-slate-300" />,
          badgeClass: 'bg-gradient-to-r from-slate-200/20 to-slate-400/20 text-slate-200 border-slate-300/40',
          title: 'مدال نقره',
          glow: 'from-slate-400/20 to-slate-600/5',
          borderHover: 'group-hover:border-slate-300/80',
          badgeText: 'نشان سیمین نقره'
        };
      case 'bronze':
        return {
          icon: <Medal className="w-5 h-5 text-amber-700" />,
          badgeClass: 'bg-gradient-to-r from-amber-700/20 to-amber-900/20 text-amber-200 border-amber-700/40',
          title: 'مدال برنز',
          glow: 'from-amber-700/20 to-amber-900/5',
          borderHover: 'group-hover:border-amber-600/80',
          badgeText: 'نشان برنز'
        };
      case 'rank_top':
      default:
        return {
          icon: <Trophy className="w-5 h-5 text-emerald-400" />,
          badgeClass: 'bg-gradient-to-r from-emerald-400/20 to-teal-500/20 text-emerald-300 border-emerald-400/40',
          title: 'رتبه برتر',
          glow: 'from-emerald-500/20 to-teal-500/5',
          borderHover: 'group-hover:border-emerald-400/80',
          badgeText: 'رتبه تک‌رقمی کنکور'
        };
    }
  };

  return (
    <section id="honors" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-[#090e17] text-white relative overflow-hidden">
      {/* Decorative ambient lights */}
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 text-right">
        
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 mb-12 border-b border-slate-800/80 pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/30 text-xs font-bold mb-3">
              <Trophy size={14} className="text-amber-400" />
              <span>تالار افتخارات علمی و بین‌المللی</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-snug">
              مدال‌آوران المپیاد و رتبه‌های درخشان کنکور مشاهیر آینده
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
              گواهی صادق بر اثربخشی شیوه آموزشی و هدایت نخبگان؛ فرزندانی که با پشتکار، هدایت اساتید مرجع و امکانات تراز اول، نام ایران و مدرسه را جاودانه ساختند.
            </p>
          </div>

          {/* Key Honor Metrics Counters */}
          <div className="flex items-center gap-4 sm:gap-6 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shrink-0">
            <div className="text-center px-2">
              <strong className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums block">
                {toPersianDigits(14)}
              </strong>
              <span className="text-[10px] text-slate-400">مدال جهانی و ملی</span>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="text-center px-2">
              <strong className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums block">
                {toPersianDigits(9)}
              </strong>
              <span className="text-[10px] text-slate-400">رتبه زیر ۱۰ کنکور</span>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="text-center px-2">
              <strong className="text-2xl sm:text-3xl font-black text-blue-400 tabular-nums block">
                {toPersianDigits(100)}٪
              </strong>
              <span className="text-[10px] text-slate-400">ورود به دانشگاه‌های برتر</span>
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
            {categories.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2',
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                      : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800'
                  )}
                >
                  <span>{cat.label}</span>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded-md font-mono',
                    isSelected ? 'bg-slate-950/20 text-slate-900' : 'bg-slate-800 text-slate-400'
                  )}>
                    {toPersianDigits(cat.count)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام، رشته یا مدال..."
              className="w-full pr-10 pl-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Honors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredHonors.map((honor) => {
            const visual = getMedalVisual(honor.medalType);
            return (
              <div
                key={honor.id}
                onClick={() => setSelectedHonor(honor)}
                className={cn(
                  'group relative rounded-3xl bg-slate-900/90 border border-slate-800/90 p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-500/10 cursor-pointer overflow-hidden',
                  visual.borderHover
                )}
              >
                {/* Subtle top gradient glow on hover */}
                <div className={cn('absolute -top-12 -right-12 w-36 h-36 bg-gradient-to-br rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity', visual.glow)} />

                <div>
                  {/* Top Bar: Medal Tag & Year */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border', visual.badgeClass)}>
                      {visual.icon}
                      <span>{visual.badgeText}</span>
                    </span>
                    <span className="text-xs font-mono text-slate-500 font-semibold">{honor.year}</span>
                  </div>

                  {/* Student Name & Honor Title */}
                  <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition-colors mb-1.5 flex items-center justify-between">
                    <span>{honor.name}</span>
                    <Sparkles size={15} className="text-amber-400/40 group-hover:text-amber-400 transition-colors" />
                  </h3>

                  <strong className="text-xs text-amber-300 font-bold block mb-3 leading-snug">
                    {honor.honor}
                  </strong>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-4">
                    {honor.details}
                  </p>
                </div>

                {/* Footer Info: Destination & Click Action */}
                <div className="pt-4 border-t border-slate-800/80">
                  <div className="flex items-center gap-2 text-[11px] text-slate-300 mb-3">
                    <GraduationCap size={15} className="text-blue-400 shrink-0" />
                    <span className="truncate">{honor.destination}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 group-hover:translate-x-[-2px] transition-transform">
                    <span>مشاهده شناسنامه و بیوگرافی علمی</span>
                    <ChevronLeft size={15} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredHonors.length === 0 && (
          <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800">
            <Trophy size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-sm font-bold text-slate-400">موردی با این عبارت یافت نشد</p>
            <button
              onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
              className="mt-3 text-xs text-amber-400 font-bold hover:underline"
            >
              نمایش همه افتخارات
            </button>
          </div>
        )}

        {/* Motivational Banner */}
        <div className="mt-14 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-blue-600/10 border border-amber-400/20 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-right">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
              <Star size={28} />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-black text-white">
                آیا فرزند شما نخبه المپیادی یا رتبه برتر بعدی ایران است؟
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                سهمیه‌های ویژه جذب استعدادهای درخشان و بورسیه‌های تحصیلی ۳۰ الی ۱۰۰ درصدی برای سال تحصیلی ۱۴۰۴-۱۴۰۵
              </p>
            </div>
          </div>

          <a href="#admissions" className="shrink-0">
            <Button variant="primary" size="md" className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-400/20">
              پیش‌ثبت‌نام و بررسی سهمیه نخبگان
            </Button>
          </a>
        </div>
      </div>

      {/* Honor Detail Modal (شناسنامه افتخار و بیوگرافی علمی) */}
      {selectedHonor && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 max-w-xl w-full rounded-3xl p-6 sm:p-8 text-right relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedHonor(null)}
              className="absolute left-5 top-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shrink-0">
                {selectedHonor.name.slice(0, 1)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-white">{selectedHonor.name}</h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                    دوره {selectedHonor.year}
                  </span>
                </div>
                <span className="text-xs text-amber-400 font-bold block mt-0.5">
                  {selectedHonor.honor}
                </span>
              </div>
            </div>

            {/* Key Information Badges */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block mb-0.5">رشته تحصیلی و گرایش</span>
                <span className="text-xs font-bold text-white block">{selectedHonor.field}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block mb-0.5">مقصد پذیرش دانشگاهی</span>
                <span className="text-xs font-bold text-emerald-400 block">{selectedHonor.destination}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block mb-0.5">نمره، تراز یا رتبه شاخص</span>
                <span className="text-xs font-bold text-blue-300 block font-mono">{selectedHonor.gpaOrScore}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block mb-0.5">استاد راهنما و تیم المپیاد</span>
                <span className="text-xs font-bold text-amber-300 block">{selectedHonor.mentor}</span>
              </div>
            </div>

            {/* Details Narrative */}
            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>شرح دستاورد و افتخار ثبت‌شده:</span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                {selectedHonor.details}
              </p>
            </div>

            {/* Student Quote */}
            {selectedHonor.quote && (
              <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-400/20 relative mb-6">
                <Quote size={20} className="text-amber-400/30 absolute left-3 bottom-3" />
                <p className="text-xs text-amber-200/90 leading-relaxed italic">
                  «{selectedHonor.quote}»
                </p>
                <span className="text-[10px] text-amber-400/70 font-bold block mt-1">
                  — پیام {selectedHonor.name} به دانش‌آموزان مشاهیر آینده
                </span>
              </div>
            )}

            {/* Tags Strip */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {selectedHonor.tags.map((tag, idx) => (
                <span key={idx} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                  #{tag}
                </span>
              ))}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">
                دانش‌آموخته رسمی دبیرستان مشاهیر آینده
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSelectedHonor(null)}
                className="text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-500"
              >
                بستن پنجره
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
