import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap, Users, BookOpen, Award, CheckCircle2, ArrowRight, ArrowLeft,
  Sparkles, Clock, Sun, Moon, Building2, MapPin, Phone, Mail, ChevronDown,
  ChevronUp, Trophy, Microscope, Compass, Landmark, Star, Send, X, Menu,
  CheckSquare, HeartHandshake, ShieldCheck, ArrowUpRight, Calendar, UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { SchoolLogo, Button, Badge } from '../components/common';
import { StudentHonorsShowcase } from '../components/landing/StudentHonorsShowcase';
import { toPersianDigits, cn } from '../utils/persian';

export const LandingPage: React.FC = () => {
  const { switchUser, switchContext, currentUser, activeRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Pre-registration form state
  const [regForm, setRegForm] = useState({
    studentName: '',
    grade: '10_math',
    lastGpa: '',
    parentPhone: '',
    currentSchool: '',
    hasHonor: false,
    honorDesc: ''
  });
  const [regSubmitted, setRegSubmitted] = useState(false);
  const [regTrackingCode, setRegTrackingCode] = useState('');

  const handlePreRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.studentName || !regForm.parentPhone) return;
    const tracking = `MA-${Math.floor(100000 + Math.random() * 900000)}`;
    setRegTrackingCode(tracking);
    setRegSubmitted(true);
  };

  const departments = [
    {
      id: 'math',
      title: 'رشته ریاضی و فیزیک',
      subtitle: 'مهندسی داده، هوش مصنوعی، مکانیک و هوافضا',
      icon: <Compass className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
      features: [
        'کارگاه تخصصی الگوریتم و برنامه‌نویسی پایتون',
        'کلاس‌های هندسه و حسابان المپیادی',
        'آزمایشگاه‌های فیزیک مکانیک و الکترومغناطیس',
        'مشاوره اختصاصی رشته‌های فنی دانشگاه شریف و تهران'
      ],
      stats: '۹۹.۱٪ قبولی در دانشگاه‌های دولتی تهران'
    },
    {
      id: 'science',
      title: 'رشته علوم تجربی',
      subtitle: 'پزشکی، دندانپزشکی، داروسازی و بیوتکنولوژی',
      icon: <Microscope className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
      features: [
        'آزمایشگاه بیولوژی سلولی و ژنتیک مولکولی',
        'دوره‌های آشنایی با بالین و نانوزیست‌فناوری',
        'سنجش‌های مستمر زیست‌شناسی و شیمی کنکور',
        'آمار چشمگیر قبولی‌های پزشکی دانشگاه علوم پزشکی تهران'
      ],
      stats: '۱۲ رتبه زیر ۱۰۰ کشوری در ۳ سال اخیر'
    },
    {
      id: 'humanities',
      title: 'رشته علوم انسانی و دیپلماسی',
      subtitle: 'حقوق، مدیریت مالی، علوم سیاسی و اقتصاد',
      icon: <Landmark className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
      features: [
        'کارگاه‌های مناظره علمی، فن بیان و حقوق اساسی',
        'تحلیل بازارهای مالی و اقتصاد کلان',
        'آموزش فلسفه و منطق نوین با رویکرد تفکر نقادانه',
        'اردوهای بازدید از نهادهای دیپلماتیک و دادگستری'
      ],
      stats: 'رتبه ۱ و ۳ کنکور علوم انسانی'
    },
    {
      id: 'olympiad',
      title: 'دپارتمان المپیاد و پژوهش‌های نوآورانه',
      subtitle: 'ریاضی، کامپیوتر، فیزیک، شیمی، زیست و نجوم',
      icon: <Trophy className="w-6 h-6 text-purple-600 dark:text-purple-400" />,
      features: [
        'تیم تدریس متشکل از دارندگان مدال‌های طلای جهانی',
        'اردوهای مطالعاتی شبانه‌روزی المپیاد',
        'باشگاه پژوهشگران جوان و جشنواره خوارزمی',
        'معافیت از کنکور سراسری با مدال‌های طلای کشوری'
      ],
      stats: '۱۴ مدال جهانی و کشوری در دوره اخیر'
    }
  ];


  const facilities = [
    {
      title: 'مرکز رباتیک و آزمایشگاه نانو',
      desc: 'مجهز به بازوهای رباتیک صنعتی، پرینترهای سه‌بعدی و ایستگاه‌های عیب‌یابی الکترونیک برای پروژه‌های عملی پژوهش‌محور دانش‌آموزان.',
      image: '/src/assets/images/school_science_lab_1791978976918.jpg',
      tag: 'پژوهش و فناوری'
    },
    {
      title: 'پردیس معماری و تالارهای یادگیری تعاملی',
      desc: 'طراحی منطبق بر جدیدترین استانداردهای معماری آموزشی روز دنیا، فضاهای گفت‌وگو، آمفی‌تئاتر ۵۰۰ نفره و آکوستیک استاندارد.',
      image: '/src/assets/images/school_campus_learning_hall_1791821109900.jpg',
      tag: 'فضای آموزشی'
    },
    {
      title: 'پردیس سبز و محوطه سرسبز دانشگاهی',
      desc: 'محیطی آرام، پرنشاط و الهام‌بخش با زمین‌های ورزشی روباز و سرپوشیده، استخر اختصاصی و آلاچیق‌های مطالعه در فضای باز.',
      image: '/src/assets/images/school_building_campus_1791978991140.jpg',
      tag: 'محیط پردیس'
    }
  ];

  const schoolNews = [
    {
      date: '۲۲ فروردین ۱۴۰۴',
      title: 'آغاز پیش‌ثبت‌نام آزمون ورودی پایه‌های دهم و هفتم سال تحصیلی ۱۴۰۴-۱۴۰۵',
      desc: 'داوطلبان گرامی می‌توانند پس از ثبت مشخصات اولیه، کارت ورود به جلسه آزمون سنجش استعداد تحلیلی را دریافت نمایند.',
      category: 'پذیرش و ثبت‌نام',
      badgeColor: 'primary' as const
    },
    {
      date: '۱۸ فروردین ۱۴۰۴',
      title: 'درخشش مجدد تیم رباتیک مشاهیر آینده در مسابقات ملی و کسب مقام اول کشوری',
      desc: 'تیم ۵ نفره دانش‌آموزان پایه یازدهم با ساخت ربات امدادگر هوشمند موفق به کسب مدال طلا و راهیابی به رقابت‌های آسیایی شدند.',
      category: 'افتخارات پژوهشی',
      badgeColor: 'success' as const
    },
    {
      date: '۱۰ فروردین ۱۴۰۴',
      title: 'برگزاری همایش بزرگ انتخاب رشته و تحلیل کارنامه کنکور با حضور اساتید شریف و تهران',
      desc: 'سلسله کارگاه‌های هدایت شغلی با همراهی اولیا و روانشناسان تحصیلی مجتمع در سالن همایش‌های رازی برگزار شد.',
      category: 'رویدادهای تحصیلی',
      badgeColor: 'neutral' as const
    }
  ];

  const faqs = [
    {
      q: 'آزمون ورودی دبیرستان مشاهیر آینده شامل چه مباحثی است؟',
      a: 'آزمون ورودی شامل دو بخش سنجش استعداد تحلیلی (هوش و حل مسئله) و استعداد تحصیلی (ریاضیات، علوم پایه و ادبیات فارسی بر مبنای پایه قبلی) است. سوالات کاملاً مفهومی و چهارگزینه‌ای طراحی شده‌اند.'
    },
    {
      q: 'آیا برای داوطلبان دارای مدال‌های المپیاد یا رتبه‌های خاص تخفیف یا بورس تعلق می‌گیرد؟',
      a: 'بله، مجتمع مشاهیر آینده بر اساس آیین‌نامه جذب استعدادهای درخشان، به برگزیدگان مسابقات علمی، مدال‌آوران مرحله دوم المپیادها و دارندگان معدل ۲۰ بورسیه‌های تحصیلی ۳۰ الی ۱۰۰ درصدی اعطا می‌کند.'
    },
    {
      q: 'ساعات فعالیت آموزشی و فوق‌برنامه‌های مدرسه به چه صورت است؟',
      a: 'ساعات آموزشی از ۷:۳۰ صبح تا ۱۴:۳۰ است و کارگاه‌های المپیاد، تکالیف هدایت‌شده (Self-Study)، آزمایشگاه‌ها و فعالیت‌های ورزشی تا ساعت ۱۶:۳۰ در فضایی مجهز و با حضور دبیران راهنما برگزار می‌شود.'
    },
    {
      q: 'پرتال هوشمند مدرسه چه امکاناتی در اختیار اولیا و دانش‌آموزان قرار می‌دهد؟',
      a: 'پرتال جامع مشاهیر آینده دسترسی آنلاین به حضور و غیاب کلاسی با اطلاع‌رسانی آنی پیامکی، کارنامه‌های تحلیلی مقایسه‌ای، آزمون‌های برخط زمان‌دار، آرشیو تکالیف، تقویم جلسات با مشاوران و سامانه‌های رضایت‌نامه اردو را فراهم می‌کند.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0c1322] text-[#1e293b] dark:text-[#f8fafc] selection:bg-[#2457C5]/20 selection:text-[#2457C5]">
      
      {/* 1. Header (School Official Two-Tier Navigation) */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md border-b border-[#E2E8F0] dark:border-[#1e293b] transition-all shadow-xs">
        {/* Tier 1 (Top Row): Logo, School Identity & Primary Actions */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80">
          
          {/* Right: School Brand & Identity */}
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="منوی سایت"
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <Link to="/" className="flex items-center gap-3.5 group select-none">
              <div className="relative">
                <SchoolLogo size={42} />
                <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0c1322] rounded-full" />
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-[#1e3a8a] dark:text-[#93c5fd] tracking-tight group-hover:text-blue-600 transition-colors">
                    مشاهیر آینده
                  </span>
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900">
                    استعدادهای درخشان
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                  مجتمع آموزشی و دبیرستان دوره اول و دوم متوسطه نظری
                </span>
              </div>
            </Link>
          </div>

          {/* Left: Portals & Primary Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer"
              title={theme === 'dark' ? 'حالت روز' : 'حالت شب'}
            >
              {theme === 'dark' ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} />}
            </button>

            <a href="#admissions" className="hidden sm:inline-flex">
              <Button variant="outline" size="sm" className="text-xs font-bold">
                پیش‌ثبت‌نام
              </Button>
            </a>

            {/* Smart School Portal Access Button */}
            <Link to="/dashboard">
              <Button
                variant="primary"
                size="sm"
                icon={<ArrowRight size={15} className="rotate-180" />}
                className="text-xs font-bold shadow-sm bg-[#1e40af] hover:bg-[#1d4ed8]"
              >
                ورود به پرتال هوشمند
              </Button>
            </Link>
          </div>
        </div>

        {/* Tier 2 (Bottom Row - یک پله پایین‌تر): Main Academic Navigation Items */}
        <div className="hidden lg:block bg-slate-50/70 dark:bg-[#0f172a]/60 border-t border-slate-100 dark:border-slate-800/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-4">
            <nav className="flex items-center gap-7 xl:gap-9 text-xs font-bold text-slate-600 dark:text-slate-300">
              <a href="#about" className="hover:text-[#1e40af] dark:hover:text-[#93c5fd] transition-colors py-2 relative hover:after:w-full after:w-0 after:h-0.5 after:bg-blue-600 after:absolute after:bottom-0 after:right-0 after:transition-all">
                معرفی مدرسه
              </a>
              <a href="#departments" className="hover:text-[#1e40af] dark:hover:text-[#93c5fd] transition-colors py-2 relative hover:after:w-full after:w-0 after:h-0.5 after:bg-blue-600 after:absolute after:bottom-0 after:right-0 after:transition-all">
                رشته‌ها و دپارتمان‌ها
              </a>
              <a href="#honors" className="hover:text-[#1e40af] dark:hover:text-[#93c5fd] transition-colors py-2 relative hover:after:w-full after:w-0 after:h-0.5 after:bg-blue-600 after:absolute after:bottom-0 after:right-0 after:transition-all">
                تالار افتخارات و کنکور
              </a>
              <a href="#facilities" className="hover:text-[#1e40af] dark:hover:text-[#93c5fd] transition-colors py-2 relative hover:after:w-full after:w-0 after:h-0.5 after:bg-blue-600 after:absolute after:bottom-0 after:right-0 after:transition-all">
                امکانات پردیس
              </a>
              <a href="#news" className="hover:text-[#1e40af] dark:hover:text-[#93c5fd] transition-colors py-2 relative hover:after:w-full after:w-0 after:h-0.5 after:bg-blue-600 after:absolute after:bottom-0 after:right-0 after:transition-all">
                اخبار و رویدادها
              </a>
              <a href="#admissions" className="hover:text-[#1e40af] dark:hover:text-[#93c5fd] transition-colors py-2 relative hover:after:w-full after:w-0 after:h-0.5 after:bg-blue-600 after:absolute after:bottom-0 after:right-0 after:transition-all">
                پیش‌ثبت‌نام ۱۴۰۴
              </a>
            </nav>

            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <Sparkles size={13} className="text-amber-500 shrink-0" />
              <span>سال تحصیلی ۱۴۰۴-۱۴۰۵ · پیش‌ثبت‌نام آزمون ورودی</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1322] px-4 py-5 space-y-4">
            <div className="space-y-1">
              <a
                href="#about"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                معرفی و رسالت مدرسه
              </a>
              <a
                href="#departments"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                رشته‌های تحصیلی و دپارتمان‌ها
              </a>
              <a
                href="#honors"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                افتخارات، المپیاد و رتبه‌های برتر
              </a>
              <a
                href="#facilities"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                امکانات پردیس و آزمایشگاه‌ها
              </a>
              <a
                href="#news"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                اخبار و رویدادهای تحصیلی
              </a>
              <a
                href="#admissions"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                فرم پیش‌ثبت‌نام سال جدید
              </a>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <Link
                to="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 text-white font-bold text-xs"
              >
                ورود به پرتال اولیا، دانش‌آموزان و دبیران
              </Link>
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs"
              >
                تغییر نقش دمو (آزمایش پرتال)
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* 2. Hero Section (Prestige School Front) */}
      <section className="relative overflow-hidden py-12 lg:py-20 px-4 sm:px-6 lg:px-8 border-b border-[#E2E8F0] dark:border-[#1e293b]">
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-amber-500/10 dark:bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Right Column: Hero Narrative */}
          <div className="lg:col-span-7 text-right space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold">
              <Sparkles size={14} className="text-amber-500" />
              <span>سال تحصیلی ۱۴۰۴-۱۴۰۵ · پذیرش دوره‌های اول و دوم متوسطه</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white leading-[1.3] tracking-tight">
              پرورش نخبگان علمی و ساختن آینده‌ای درخشان در <span className="text-blue-700 dark:text-blue-400">مجتمع آموزشی مشاهیر آینده</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              مجتمع آموزشی مشاهیر آینده با بهره‌گیری از اساتید برجسته کشور، پیشرفته‌ترین آزمایشگاه‌های تحقیقاتی، دپارتمان تخصصی المپیاد و کنکور، و رویکرد تربیتی مهارت‌محور، محیطی امن و بالنده برای رشد همه‌جانبه دانش‌آموزان مستعد ایران فراهم آورده است.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <a href="#admissions">
                <Button variant="primary" size="lg" icon={<Send size={16} className="rotate-180" />} className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm font-bold shadow-md">
                  پیش‌ثبت‌نام آزمون ورودی
                </Button>
              </a>

              <Link to="/dashboard">
                <Button variant="outline" size="lg" icon={<GraduationCap size={18} />} className="text-xs sm:text-sm font-bold border-slate-300 dark:border-slate-700">
                  ورود به پرتال هوشمند دانش‌آموزان و اولیا
                </Button>
              </Link>
            </div>

            {/* Prestige Badges Strip */}
            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <span>رتبه‌های تک‌رقمی کنکور</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <span>مدال‌های المپیاد جهانی</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <span>آزمایشگاه نانو و روباتیک</span>
              </div>
            </div>
          </div>

          {/* Left Column: Campus Photography Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-2xl group">
              <img
                src="/src/assets/images/school_building_campus_1791978991140.jpg"
                alt="نمای پردیس مجتمع آموزشی و دبیرستان مشاهیر آینده"
                className="w-full h-80 sm:h-96 lg:h-[430px] object-cover transition-transform duration-700 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent flex flex-col justify-end p-6 text-right text-white">
                <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 font-black text-[11px] mb-2">
                  <Star size={13} fill="currentColor" />
                  <span>پردیس مرکزی شمیرانات</span>
                </div>
                <h3 className="text-lg font-black text-white">دبیرستان استعدادهای درخشان مشاهیر آینده</h3>
                <p className="text-xs text-slate-200 mt-1">محیطی آکادمیک با معماری اصیل و استانداردهای روز بین‌المللی</p>
              </div>
            </div>

            {/* Floating Achievement Card */}
            <div className="absolute -bottom-6 -left-4 sm:left-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xl flex items-center gap-3 max-w-xs text-right">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Trophy size={24} />
              </div>
              <div>
                <strong className="text-xs font-black text-slate-900 dark:text-white block">
                  ۱۴ مدال جهانی و کشوری
                </strong>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  در المپیادهای علمی ریاضی، کامپیوتر و فیزیک
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Key Figures & Academic Trust Markers (آمار و ارقام مدرسه) */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#111927] border-b border-[#E2E8F0] dark:border-[#1e293b]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 text-right">
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">قبولی دانشگاه‌های سطح یک</span>
            <strong className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 tabular-nums block">
              ۹۸.۴٪
            </strong>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 block">
              شریف، تهران، امیرکبیر و علوم پزشکی تهران
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">مدال‌های المپیادهای ملی و جهانی</span>
            <strong className="text-3xl sm:text-4xl font-black text-amber-500 tabular-nums block">
              {toPersianDigits(14)} نشان
            </strong>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 block">
              طلا، نقره و برنز جهانی در دوره اخیر
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">سابقه آموزش نخبگان</span>
            <strong className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums block">
              {toPersianDigits(24)} سال
            </strong>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 block">
              درخشش مستمر در نظام آموزشی برتر کشور
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">هوشمندسازی و پایش فردی</span>
            <strong className="text-3xl sm:text-4xl font-black text-purple-600 dark:text-purple-400 tabular-nums block">
              ۱۰۰٪
            </strong>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 block">
              پرتال جامع، گزارش هفتگی اولیا و مشاوره مستمر
            </span>
          </div>
        </div>
      </section>

      {/* 4. About the School / Pillars (درباره مجتمع و ارکان آموزشی) */}
      <section id="about" className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-right">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="primary">درباره مجتمع مشاهیر آینده</Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-3">
            نگاهی به چشم‌انداز، فلسفه و رسالت تربیتی ما
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
            ما بر این باوریم که هر دانش‌آموز استعدادی یگانه است. هدف ما در مشاهیر آینده، تنها موفقیت در آزمون‌ها نیست، بلکه تربیت انسان‌هایی اندیشمند، خلاق، مسئولیت‌پذیر و توانمند برای ساختن فردای میهن است.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-7 rounded-3xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Award size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">آموزش عمیق و پژوهش‌محور</h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              یادگیری از طریق تجربه، آزمایش در آزمایشگاه‌های پیشرفته و تبیین کاربردهای عملی مباحث علمی به جای حفظیات صرف، بنیاد برنامه درسی ماست.
            </p>
          </div>

          <div className="p-7 rounded-3xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <HeartHandshake size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">روانشناسی و سلامت فردی</h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              تیم مشاوران و روانشناسان متخصص مدرسه به صورت مستمر وضعیت روحی، مدیریت استرس، تعادل خواب و برنامه‌ریزی شخصی هر دانش‌آموز را پایش می‌کنند.
            </p>
          </div>

          <div className="p-7 rounded-3xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Users size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">پیوند شفاف با خانواده‌ها</h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              ارتباط هفتگی اولیا با دبیران و مشاوران از طریق جلسات اختصاصی و پرتال هوشمند، ضامن همراهی همگام خانه و مدرسه در مسیر رشد فرزندان است.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Academic Departments & Programs (رشته‌ها و دپارتمان‌ها) */}
      <section id="departments" className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#101722]/60 border-y border-[#E2E8F0] dark:border-[#1e293b]">
        <div className="max-w-7xl mx-auto text-right">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <Badge variant="primary">دپارتمان‌های آموزشی</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-3">
              مسیرهای تخصصی دانش‌آموزان در دوره دوم متوسطه
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
              برنامه‌ریزی دقیق درسی، تفکیک سرفصل‌های کنکور و المپیاد، و حضور دبیران مرجع و طراحان آزمون‌های برتر کشوری
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="p-7 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col justify-between hover:border-blue-500 transition-all hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-white dark:bg-slate-700 shadow-xs">
                        {dept.icon}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">{dept.title}</h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{dept.subtitle}</span>
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-2.5 my-6 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    {dept.features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2.5">
                        <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs font-bold text-blue-700 dark:text-blue-400">
                  <span>{dept.stats}</span>
                  <a href="#admissions" className="hover:underline flex items-center gap-1">
                    <span>ثبت‌نام این رشته</span>
                    <ArrowLeft size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Campus & Facilities Tour (امکانات مدرن پردیس) */}
      <section id="facilities" className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-right">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="primary">پردیس و تجهیزات</Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-3">
            امکانات و فضاهای یادگیری در تراز جهانی
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
            محیطی مجهز برای تلفیق نظریه و عمل با تجهیزات فوق‌پیشرفته روباتیک، نانوفناوری و سالن‌های اختصاصی مطالعه
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {facilities.map((fac, idx) => (
            <div
              key={idx}
              className="rounded-3xl overflow-hidden bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col group hover:shadow-xl transition-all"
            >
              <div className="relative h-60 overflow-hidden">
                <img
                  src={fac.image}
                  alt={fac.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-bold px-3 py-1 rounded-full">
                  {fac.tag}
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{fac.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{fac.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Student Honors & Olympiads Showcase Component (تالار افتخارات علمی و مدال‌ها) */}
      <StudentHonorsShowcase />

      {/* 8. Latest School News & Events (اخبار و رویدادهای مدرسه) */}
      <section id="news" className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-right">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-12">
          <div>
            <Badge variant="primary">اطلاعیه‌ها و رویدادها</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mt-3">
              تازه‌ترین اخبار مجتمع آموزشی مشاهیر آینده
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            پوشش اخبار علمی، المپیادها و بخشنامه‌های مهم
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {schoolNews.map((news, idx) => (
            <div
              key={idx}
              className="p-6 rounded-3xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:shadow-lg transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3 text-xs">
                  <Badge variant={news.badgeColor}>{news.category}</Badge>
                  <span className="text-slate-400 font-mono flex items-center gap-1">
                    <Calendar size={13} />
                    <span>{news.date}</span>
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 leading-snug">
                  {news.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {news.desc}
                </p>
              </div>

              <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400">
                <a href="#admissions" className="hover:underline flex items-center gap-1">
                  <span>جزئیات کامل</span>
                  <ArrowLeft size={14} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 9. Smart School Portal Access Section (درگاه پرتال هوشمند مدرسه) */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-blue-50/70 dark:bg-blue-950/20 border-y border-blue-100 dark:border-blue-900/60">
        <div className="max-w-7xl mx-auto text-right">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Badge variant="primary">پرتال الکترونیک و هوشمند</Badge>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
              پرتال جامع دانش‌آموزان، اولیا و کادر آموزشی
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              سامانه یکپارچه مدیریت یادگیری و ارزیابی مدرسه مشاهیر آینده، در تمام طول شبانه‌روز در دسترس خانواده‌ها و همکاران گرامی است.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Student Portal Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold mb-4">
                  <GraduationCap size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">پرتال دانش‌آموزان</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  مشاهده تکالیف، شرکت در آزمون‌های تستی و تشریحی، دریافت فایل‌های درسی و کارنامه مستمر
                </p>
              </div>
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="w-full text-xs font-bold">
                  ورود دانش‌آموز
                </Button>
              </Link>
            </div>

            {/* Parent Portal Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold mb-4">
                  <HeartHandshake size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">پرتال اولیا و خانواده</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  پایش برخط حضور و غیاب، کارنامه تحلیلی، رضایت‌نامه‌ها و رزرو جلسات مشاوره با مدرسه
                </p>
              </div>
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="w-full text-xs font-bold">
                  ورود اولیای گرامی
                </Button>
              </Link>
            </div>

            {/* Faculty Portal Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold mb-4">
                  <BookOpen size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">پرتال دبیران و اساتید</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  ثبت دفاتر کلاسی، طراحی و بارگذاری تکالیف، تصحیح اوراق و ثبت نمرات مستمر و نهایی
                </p>
              </div>
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="w-full text-xs font-bold">
                  ورود همکاران آموزشی
                </Button>
              </Link>
            </div>

            {/* Admin & Management Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold mb-4">
                  <Building2 size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">مدیریت و دبیرخانه</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  نظارت کلان بر نمرات و غیبت‌ها، صدور کارنامه‌ها، پاسخگویی به اولیا و کنترل مدارک
                </p>
              </div>
              <Link to="/login">
                <Button variant="primary" size="sm" className="w-full text-xs font-bold bg-[#1e40af]">
                  ورود مدیران / دمو
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Interactive Admissions & Pre-Registration (پیش‌ثبت‌نام آنلاین آزمون ورودی) */}
      <section id="admissions" className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-right">
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 sm:p-10 shadow-xl">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
              سال تحصیلی ۱۴۰۴-۱۴۰۵
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              فرم پیش‌ثبت‌نام و تعیین وقت آزمون ورودی
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2">
              پس از تکمیل این فرم، کد رهگیری صادر شده و کارشناسان پذیرش جهت تعیین زمان آزمون با شما تماس خواهند گرفت.
            </p>
          </div>

          {regSubmitted ? (
            <div className="p-8 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-xl font-black text-emerald-800 dark:text-emerald-200">
                درخواست پیش‌ثبت‌نام با موفقیت ثبت شد
              </h3>
              <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 max-w-md mx-auto leading-relaxed">
                دانش‌آموز گرامی <strong>{regForm.studentName}</strong>، اطلاعات اولیه شما ثبت شد. جهت پیگیری، کد رهگیری زیر را یادداشت فرمایید:
              </p>
              <div className="inline-block px-6 py-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 font-mono text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-wider">
                {regTrackingCode}
              </div>
              <div className="pt-4 flex justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRegSubmitted(false);
                    setRegForm({
                      studentName: '',
                      grade: '10_math',
                      lastGpa: '',
                      parentPhone: '',
                      currentSchool: '',
                      hasHonor: false,
                      honorDesc: ''
                    });
                  }}
                  className="text-xs"
                >
                  ثبت فرم جدید
                </Button>
                <Link to="/dashboard">
                  <Button variant="primary" size="sm" className="text-xs bg-blue-600">
                    مشاهده پرتال مدرسه
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePreRegister} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    نام و نام خانوادگی دانش‌آموز <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regForm.studentName}
                    onChange={(e) => setRegForm({ ...regForm, studentName: e.target.value })}
                    placeholder="مثال: آرمان رضایی"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    شماره همراه ولی / اولیا <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={regForm.parentPhone}
                    onChange={(e) => setRegForm({ ...regForm, parentPhone: e.target.value })}
                    placeholder="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    پایه و رشته درخواستی <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={regForm.grade}
                    onChange={(e) => setRegForm({ ...regForm, grade: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="7_general">پایه هفتم (دوره اول متوسطه)</option>
                    <option value="8_general">پایه هشتم (دوره اول متوسطه)</option>
                    <option value="9_general">پایه نهم (دوره اول متوسطه)</option>
                    <option value="10_math">پایه دهم · رشته ریاضی و فیزیک</option>
                    <option value="10_science">پایه دهم · رشته علوم تجربی</option>
                    <option value="10_humanities">پایه دهم · رشته علوم انسانی</option>
                    <option value="11_math">پایه یازدهم · رشته ریاضی و فیزیک</option>
                    <option value="11_science">پایه یازدهم · رشته علوم تجربی</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    معدل نوبت اول یا پایانی سال قبل
                  </label>
                  <input
                    type="text"
                    value={regForm.lastGpa}
                    onChange={(e) => setRegForm({ ...regForm, lastGpa: e.target.value })}
                    placeholder="مثال: ۱۹.۸۵"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    نام مدرسه و شهر فعلی
                  </label>
                  <input
                    type="text"
                    value={regForm.currentSchool}
                    onChange={(e) => setRegForm({ ...regForm, currentSchool: e.target.value })}
                    placeholder="مثال: مدرسه شهید بهشتی تهران"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={regForm.hasHonor}
                      onChange={(e) => setRegForm({ ...regForm, hasHonor: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      دارای رتبه در المپیادها، مسابقات علمی یا جشنواره خوارزمی هستم (جهت بررسی سهمیه استعداد درخشان)
                    </span>
                  </label>

                  {regForm.hasHonor && (
                    <input
                      type="text"
                      value={regForm.honorDesc}
                      onChange={(e) => setRegForm({ ...regForm, honorDesc: e.target.value })}
                      placeholder="عنوان افتخار یا رتبه کسب‌شده..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  اطلاعات با رعایت کامل حریم خصوصی محفوظ است.
                </span>
                <Button type="submit" variant="primary" size="lg" className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm font-bold">
                  ثبت درخواست و دریافت کد پیگیری
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* 11. Frequently Asked Questions (پرسش‌های متداول اولیا) */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-right">
        <div className="text-center mb-10">
          <Badge variant="primary">راهنمای اولیا</Badge>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
            پرسش‌های متداول داوطلبان و اولیای گرامی
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-right cursor-pointer"
                >
                  <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                    {faq.q}
                  </span>
                  {isOpen ? <ChevronUp size={18} className="text-blue-600 shrink-0" /> : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 12. Contact, Campus Address & Footer (اطلاعات رسمی مدرسه) */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1322] text-xs text-slate-600 dark:text-slate-400 pt-14 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-12 text-right">
          
          {/* Col 1: Brand & Ministry license */}
          <div className="space-y-3.5 md:col-span-1">
            <div className="flex items-center gap-3">
              <SchoolLogo size={36} />
              <div>
                <strong className="text-sm font-black text-slate-900 dark:text-white block">
                  مشاهیر آینده
                </strong>
                <span className="text-[10px] text-slate-400">مجتمع آموزشی استعدادهای درخشان</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              تحت نظارت رسمی وزارت آموزش و پرورش، اداره کل آموزش و پرورش شهر تهران (منطقه ۱). کد واحد آموزشی: ۱۷۳۴۰۹
            </p>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">دسترسی سریع</h4>
            <ul className="space-y-2 text-[11px]">
              <li>
                <a href="#about" className="hover:text-blue-600">معرفی و اهداف مجتمع</a>
              </li>
              <li>
                <a href="#departments" className="hover:text-blue-600">رشته‌های دوره دوم متوسطه</a>
              </li>
              <li>
                <a href="#honors" className="hover:text-blue-600">افتخارات و مدال‌آوران المپیاد</a>
              </li>
              <li>
                <a href="#facilities" className="hover:text-blue-600">آزمایشگاه‌ها و پردیس</a>
              </li>
              <li>
                <a href="#admissions" className="hover:text-blue-600">پیش‌ثبت‌نام سال جدید</a>
              </li>
            </ul>
          </div>

          {/* Col 3: Portal Links */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">پرتال و سامانه‌ها</h4>
            <ul className="space-y-2 text-[11px]">
              <li>
                <Link to="/dashboard" className="hover:text-blue-600">پرتال دانش‌آموزان و تکالیف</Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-blue-600">پرتال اولیا و کارنامه هوشمند</Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-blue-600">دفتر الکترونیک دبیران</Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-blue-600">تغییر نقش دمو و بررسی پرتال</Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact & Campus Info */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">ارتباط با دبیرخانه و پذیرش</h4>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-start gap-2">
                <MapPin size={15} className="text-blue-600 shrink-0 mt-0.5" />
                <span>تهران، شمیرانات، خیابان شریعتی، بالاتر از پل رومی، خیابان مشاهیر، پلاک ۱۲</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={15} className="text-blue-600 shrink-0" />
                <span className="font-mono">۰۲۱-۲۲۰۰۵۵۴۴ · ۰۲۱-۲۲۰۰۵۵۴۵</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={15} className="text-blue-600 shrink-0" />
                <span className="font-mono">info@mashahir-school.ir</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-blue-600 shrink-0" />
                <span>ساعات پاسخگویی: شنبه تا چهارشنبه ۷:۳۰ الی ۱۶:۰۰</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <span>
            کلیه حقوق مادی و معنوی این پایگاه متعلق به «مجتمع آموزشی و دبیرستان مشاهیر آینده» است. © ۱۴۰۳-۱۴۰۴
          </span>
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
              ورود به سامانه پرتال
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
