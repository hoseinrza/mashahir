import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Users, BookOpen, CheckCircle2, ArrowRight, ArrowLeft,
  Sparkles, Clock, Sun, Moon, Building2, MapPin, Phone, Mail, ChevronDown,
  Trophy, Microscope, Compass, Landmark, Star, Send, X, Menu, HeartHandshake,
  ShieldCheck, Calendar, ClipboardList, PhoneCall, FileSearch, Award, UserCheck,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { SchoolLogo, Button, Badge } from '../components/common';
import { StudentHonorsShowcase } from '../components/landing/StudentHonorsShowcase';
import { toPersianDigits, cn } from '../utils/persian';
import { AdmissionsApi, GRADE_OPTIONS, toLatinDigits } from '../api/admissions';
import { ApiError } from '../api/client';
import campusImg from '../assets/images/school_building_campus_1791978991140.jpg';
import hallImg from '../assets/images/school_campus_learning_hall_1791821109900.jpg';
import labImg from '../assets/images/school_science_lab_1791978976918.jpg';

const NAV_LINKS = [
  { href: '#about', label: 'معرفی مدرسه' },
  { href: '#departments', label: 'رشته‌ها و دپارتمان‌ها' },
  { href: '#facilities', label: 'امکانات پردیس' },
  { href: '#honors', label: 'تالار افتخارات' },
  { href: '#news', label: 'اخبار و رویدادها' },
  { href: '#faq', label: 'پرسش‌های متداول' },
];

const DEPARTMENTS = [
  {
    id: 'math',
    title: 'ریاضی و فیزیک',
    subtitle: 'هوش مصنوعی، داده، مکانیک و هوافضا',
    icon: <Compass className="w-6 h-6" />,
    accent: 'text-[#2457C5] dark:text-[#8BAEFF] bg-blue-50 dark:bg-blue-950/60',
    features: [
      'کارگاه تخصصی الگوریتم و برنامه‌نویسی پایتون',
      'کلاس‌های هندسه و حسابان با نگاه المپیادی',
      'آزمایشگاه‌های فیزیک مکانیک و الکترومغناطیس',
      'مشاوره اختصاصی رشته‌های فنی دانشگاه شریف و تهران',
    ],
    stat: '۹۹.۱٪ قبولی در دانشگاه‌های دولتی تهران',
  },
  {
    id: 'science',
    title: 'علوم تجربی',
    subtitle: 'پزشکی، دندانپزشکی و بیوتکنولوژی',
    icon: <Microscope className="w-6 h-6" />,
    accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60',
    features: [
      'آزمایشگاه بیولوژی سلولی و ژنتیک مولکولی',
      'دوره‌های آشنایی با بالین و نانوزیست‌فناوری',
      'سنجش مستمر زیست‌شناسی و شیمی کنکور',
      'کارگاه هدایت شغلی با پزشکان متخصص',
    ],
    stat: '۱۲ رتبه زیر ۱۰۰ کشوری در ۳ سال اخیر',
  },
  {
    id: 'humanities',
    title: 'علوم انسانی و دیپلماسی',
    subtitle: 'حقوق، مدیریت مالی و اقتصاد',
    icon: <Landmark className="w-6 h-6" />,
    accent: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60',
    features: [
      'کارگاه‌های مناظره علمی، فن بیان و حقوق اساسی',
      'تحلیل بازارهای مالی و اقتصاد کلان',
      'آموزش فلسفه و منطق با رویکرد تفکر نقادانه',
      'بازدید از نهادهای دیپلماتیک و دادگستری',
    ],
    stat: 'رتبه ۱ و ۳ کنکور علوم انسانی',
  },
  {
    id: 'olympiad',
    title: 'دپارتمان المپیاد و پژوهش',
    subtitle: 'ریاضی، کامپیوتر، فیزیک، شیمی و زیست',
    icon: <Trophy className="w-6 h-6" />,
    accent: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60',
    features: [
      'تیم تدریس متشکل از مدال‌آوران جهانی',
      'اردوهای مطالعاتی شبانه‌روزی المپیاد',
      'باشگاه پژوهشگران جوان و جشنواره خوارزمی',
      'مسیر بورسیه استعدادهای درخشان',
    ],
    stat: '۱۴ مدال جهانی و کشوری در دوره اخیر',
  },
];

const FACILITIES = [
  {
    title: 'مرکز رباتیک و آزمایشگاه نانو',
    desc: 'بازوهای رباتیک صنعتی، پرینتر سه‌بعدی و ایستگاه عیب‌یابی الکترونیک برای پروژه‌های عملی پژوهش‌محور.',
    image: labImg,
    tag: 'پژوهش و فناوری',
  },
  {
    title: 'تالارهای یادگیری تعاملی',
    desc: 'معماری آموزشی روز دنیا، فضاهای گفت‌وگو، آمفی‌تئاتر ۵۰۰ نفره و آکوستیک استاندارد.',
    image: hallImg,
    tag: 'فضای آموزشی',
  },
  {
    title: 'پردیس سبز دانشگاهی',
    desc: 'محیطی آرام و الهام‌بخش با زمین‌های ورزشی روباز و سرپوشیده، استخر اختصاصی و آلاچیق مطالعه.',
    image: campusImg,
    tag: 'محیط پردیس',
  },
];

const PILLARS = [
  {
    icon: <Microscope size={26} />,
    color: 'bg-blue-50 text-[#2457C5] dark:bg-blue-950/60 dark:text-[#8BAEFF]',
    title: 'آموزش عمیق و پژوهش‌محور',
    desc: 'یادگیری از طریق تجربه و آزمایش در آزمایشگاه‌های پیشرفته؛ به‌جای حفظیات صرف، کاربرد واقعی علم را می‌آموزند.',
  },
  {
    icon: <Trophy size={26} />,
    color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
    title: 'المپیاد، کنکور و قهرمان‌سازی',
    desc: 'دپارتمان تخصصی المپیاد با مربیان مدال‌آور جهانی، آزمون‌های شبیه‌ساز استاندارد و پایش مستمر تراز.',
  },
  {
    icon: <HeartHandshake size={26} />,
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    title: 'سلامت روان و مشاوره مستمر',
    desc: 'تیم روانشناسان مدرسه، مدیریت استرس، تعادل خواب و برنامه‌ریزی شخصی هر دانش‌آموز را پایش می‌کند.',
  },
  {
    icon: <ShieldCheck size={26} />,
    color: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
    title: 'پرتال شفاف برای خانواده‌ها',
    desc: 'گزارش هفتگی اولیا، حضور و غیاب برخط، کارنامه تحلیلی و جلسات منظم دبیر–خانواده در پرتال هوشمند.',
  },
];

const ADMISSION_STEPS = [
  {
    icon: <ClipboardList size={18} />,
    title: 'تکمیل فرم پیش‌ثبت‌نام',
    desc: 'مشخصات دانش‌آموز را در فرم همین صفحه وارد کنید؛ بلافاصله کد رهگیری دریافت می‌کنید.',
  },
  {
    icon: <PhoneCall size={18} />,
    title: 'تماس کارشناس پذیرش',
    desc: 'کارشناسان دفتر پذیرش حداکثر تا ۴۸ ساعت کاری برای تکمیل اطلاعات و راهنمایی تماس می‌گیرند.',
  },
  {
    icon: <FileSearch size={18} />,
    title: 'آزمون سنجش استعداد',
    desc: 'آزمون کتبی شامل سنجش استعداد تحلیلی و تحصیلی بر مبنای پایه تحصیلی فعلی داوطلب.',
  },
  {
    icon: <UserCheck size={18} />,
    title: 'اعلام نتیجه و ثبت‌نام نهایی',
    desc: 'نتایج حداکثر یک هفته پس از آزمون اعلام و مدارک ثبت‌نام نهایی تکمیل می‌شود.',
  },
];

const NEWS = [
  {
    date: '۲۲ فروردین ۱۴۰۵',
    title: 'آغاز پیش‌ثبت‌نام آزمون ورودی پایه‌های دهم و هفتم سال تحصیلی ۱۴۰۵–۱۴۰۶',
    desc: 'داوطلبان پس از ثبت مشخصات اولیه، کد رهگیری دریافت کرده و کارت ورود به جلسه آزمون سنجش استعداد تحلیلی صادر می‌شود.',
    category: 'پذیرش و ثبت‌نام',
    tone: 'primary' as const,
  },
  {
    date: '۱۸ فروردین ۱۴۰۵',
    title: 'درخشش تیم رباتیک مشاهیر آینده و کسب مقام اول مسابقات ملی',
    desc: 'تیم ۵ نفره پایه یازدهم با ربات امدادگر هوشمند مدال طلا گرفت و به رقابت‌های آسیایی راه یافت.',
    category: 'افتخارات پژوهشی',
    tone: 'success' as const,
  },
  {
    date: '۱۰ فروردین ۱۴۰۵',
    title: 'همایش انتخاب رشته و تحلیل کارنامه با حضور اساتید شریف و تهران',
    desc: 'سلسله کارگاه‌های هدایت شغلی با همراهی اولیا و روانشناسان تحصیلی در سالن همایش‌های رازی برگزار شد.',
    category: 'رویدادهای تحصیلی',
    tone: 'neutral' as const,
  },
];

const FAQS = [
  {
    q: 'آزمون ورودی شامل چه مباحثی است؟',
    a: 'آزمون در دو بخش «سنجش استعداد تحلیلی» (هوش و حل مسئله) و «استعداد تحصیلی» (ریاضیات، علوم پایه و ادبیات بر مبنای پایه قبلی) طراحی می‌شود؛ همه سوالات مفهومی و چهارگزینه‌ای هستند.',
  },
  {
    q: 'برای مدال‌آوران و رتبه‌های برتر بورسیه دارید؟',
    a: 'بله؛ بر اساس آیین‌نامه جذب استعدادهای درخشان، به برگزیدگان مسابقات علمی، مدال‌آوران مرحله دوم المپیادها و دارندگان معدل ۲۰ بورسیه ۳۰ تا ۱۰۰ درصدی تعلق می‌گیرد.',
  },
  {
    q: 'ساعات آموزشی و فعالیت‌های فوق‌برنامه چگونه است؟',
    a: 'آموزش از ۷:۳۰ تا ۱۴:۳۰ است و کارگاه‌های المپیاد، تکالیف هدایت‌شده، آزمایشگاه و فعالیت ورزشی تا ۱۶:۳۰ با حضور دبیران راهنما ادامه دارد.',
  },
  {
    q: 'اولیا چه امکاناتی در پرتال هوشمند دارند؟',
    a: 'مشاهده برخط حضور و غیاب با اطلاع‌رسانی پیامکی، کارنامه‌های تحلیلی، آزمون‌های برخط زمان‌دار، آرشیو تکالیف، تقویم جلسات مشاوره و سامانه رضایت‌نامه اردوها.',
  },
];

const EMPTY_FORM = {
  studentName: '',
  grade: '10_math',
  lastGpa: '',
  parentPhone: '',
  currentSchool: '',
  hasHonor: false,
  honorDesc: '',
};

export const LandingPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [activeDept, setActiveDept] = useState('math');

  // Pre-registration form (public intake → admission pipeline of the school)
  const [regForm, setRegForm] = useState(EMPTY_FORM);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regTrackingCode, setRegTrackingCode] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);

  const dept = DEPARTMENTS.find((d) => d.id === activeDept) ?? DEPARTMENTS[0];

  const handlePreRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const phone = toLatinDigits(regForm.parentPhone).replace(/[\s-]/g, '');
    const normalizedPhone = phone.startsWith('+98')
      ? `0${phone.slice(3)}`
      : phone.startsWith('98') && phone.length === 12
        ? `0${phone.slice(2)}`
        : phone;

    if (!regForm.studentName.trim() || regForm.studentName.trim().length < 3) {
      setRegError('نام و نام خانوادگی دانش‌آموز را کامل وارد کنید.');
      return;
    }
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setRegError('شماره همراه ولی معتبر نیست؛ نمونه صحیح: ۰۹۱۲۳۴۵۶۷۸۹');
      return;
    }

    setRegSubmitting(true);
    try {
      const result = await AdmissionsApi.submit({
        student_name: regForm.studentName.trim(),
        grade: regForm.grade,
        parent_phone: normalizedPhone,
        last_gpa: regForm.lastGpa ? toLatinDigits(regForm.lastGpa) : undefined,
        current_school: regForm.currentSchool.trim() || undefined,
        has_honor: regForm.hasHonor,
        honor_desc: regForm.hasHonor ? regForm.honorDesc.trim() : undefined,
      });
      setRegTrackingCode(result.tracking_code);
    } catch (err) {
      setRegError(
        err instanceof ApiError
          ? err.firstError()
          : 'ارتباط با سرور مدرسه برقرار نشد؛ لطفاً چند لحظه بعد دوباره تلاش کنید.',
      );
    } finally {
      setRegSubmitting(false);
    }
  };

  const resetForm = () => {
    setRegForm(EMPTY_FORM);
    setRegTrackingCode(null);
    setRegError(null);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070D19] text-[#101A2C] dark:text-[#F1F5FB] selection:bg-[#2457C5]/20 selection:text-[#2457C5]">

      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-50 bg-white/85 dark:bg-[#0A1120]/85 backdrop-blur-xl pt-[env(safe-area-inset-top)] border-b border-[#E4E9F2] dark:border-[#1B2740]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-4">

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="منوی سایت"
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <Link to="/" className="flex items-center gap-3 group select-none">
              <SchoolLogo size={44} className="transition-transform group-hover:scale-105" />
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black tracking-tight group-hover:text-[#2457C5] dark:group-hover:text-[#8BAEFF] transition-colors">
                    مشاهیر آینده
                  </span>
                  <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100/80 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                    استعدادهای درخشان
                  </span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-[#526176] dark:text-[#8DA0BE] font-medium hidden sm:block">
                  مجتمع آموزشی دوره اول و دوم متوسطه نظری
                </span>
              </div>
            </Link>
          </div>

          <nav className="hidden lg:flex items-center gap-7 text-[13px] font-semibold text-[#3D4C63] dark:text-[#B3C0D2]">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hover:text-[#2457C5] dark:hover:text-[#8BAEFF] transition-colors relative py-2 hover:after:w-full after:w-0 after:h-[2px] after:bg-amber-500 after:absolute after:bottom-0 after:right-0 after:transition-all after:rounded-full"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'حالت روز' : 'حالت شب'}
              aria-label="تغییر پوسته"
            >
              {theme === 'dark' ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} />}
            </button>

            <a href="#admissions" className="hidden sm:block">
              <Button variant="outline" size="sm" className="text-xs font-bold">
                پیش‌ثبت‌نام
              </Button>
            </a>

            <Link to="/dashboard">
              <Button
                variant="primary"
                size="sm"
                icon={<ArrowRight size={15} className="rotate-180" />}
                className="text-xs font-bold"
              >
                ورود به پرتال
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E4E9F2] dark:border-[#1B2740] bg-white dark:bg-[#0A1120] px-4 py-4 space-y-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-[13px] font-bold text-[#3D4C63] dark:text-[#B3C0D2] hover:bg-[#F0F4FA] dark:hover:bg-[#141E33]"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#admissions"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2.5 rounded-xl text-[13px] font-bold text-[#2457C5] dark:text-[#8BAEFF] hover:bg-[#F0F4FA] dark:hover:bg-[#141E33]"
            >
              فرم پیش‌ثبت‌نام سال تحصیلی جدید
            </a>
          </div>
        )}
      </header>

      {/* ═══ Hero ═══ */}
      <section className="relative overflow-hidden">
        {/* decorative background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-60 dark:opacity-40"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(36,87,197,0.13) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'linear-gradient(to bottom, black, transparent 85%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 85%)',
          }}
        />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-400/15 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* Narrative */}
          <div className="lg:col-span-7 text-right space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/70 text-amber-700 dark:text-amber-300 text-xs font-bold">
              <Sparkles size={14} />
              <span>پذیرش سال تحصیلی ۱۴۰۵–۱۴۰۶ آغاز شد</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[3.4rem] font-black leading-[1.25] tracking-tight">
              اینجا استعدادها،{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-l from-[#2457C5] via-[#3E6FD9] to-[#7EA2F5] dark:from-[#8BAEFF] dark:via-[#9DBEFF] dark:to-[#D6E4FF]">
                  آینده ایران
                </span>
                <span className="absolute bottom-1 right-0 left-0 h-3 bg-amber-300/50 dark:bg-amber-500/25 -rotate-1 rounded-sm" />
              </span>{' '}
              را می‌سازند
            </h1>

            <p className="text-sm sm:text-base text-[#526176] dark:text-[#9DB0CC] leading-8 max-w-2xl">
              مجتمع آموزشی مشاهیر آینده با اساتید برجسته کشور، آزمایشگاه‌های تحقیقاتی پیشرفته، دپارتمان تخصصی
              المپیاد و کنکور و رویکرد تربیتی مهارت‌محور، مسیر رشد همه‌جانبه دانش‌آموزان مستعد را هموار می‌کند.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a href="#admissions">
                <Button
                  variant="primary"
                  size="lg"
                  icon={<Send size={16} className="rotate-180" />}
                  className="text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/20"
                >
                  پیش‌ثبت‌نام آزمون ورودی
                </Button>
              </a>
              <a href="#facilities">
                <Button variant="outline" size="lg" icon={<Building2 size={17} />} className="text-xs sm:text-sm font-bold">
                  گشتی در پردیس
                </Button>
              </a>
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-4 pt-6 max-w-lg">
              {[
                { value: '۹۸.۴٪', label: 'قبولی دانشگاه‌های برتر', color: 'text-[#2457C5] dark:text-[#8BAEFF]' },
                { value: toPersianDigits(14), label: 'مدال ملی و جهانی', color: 'text-amber-600 dark:text-amber-400' },
                { value: toPersianDigits(24), label: 'سال پرورش نخبه', color: 'text-emerald-600 dark:text-emerald-400' },
              ].map((s) => (
                <div key={s.label} className="text-right border-r-2 border-amber-400/70 pr-3">
                  <div className={cn('text-xl sm:text-2xl font-black tabular-nums', s.color)}>{s.value}</div>
                  <div className="text-[10px] sm:text-[11px] text-[#526176] dark:text-[#8DA0BE] font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual composition */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-[2rem] overflow-hidden shadow-2xl shadow-blue-900/20 border-4 border-white dark:border-[#141E33] group">
              <img
                src={campusImg}
                alt="نمای پردیس مجتمع آموزشی مشاهیر آینده"
                className="w-full h-80 sm:h-96 lg:h-[440px] object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-0 right-0 p-6 text-right text-white">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-400 text-slate-950 font-black text-[11px] mb-2">
                  <Star size={13} fill="currentColor" />
                  پردیس مرکزی شمیرانات
                </span>
                <h3 className="text-lg font-black">دبیرستان استعدادهای درخشان</h3>
                <p className="text-xs text-slate-200 mt-1">محیطی آکادمیک با استانداردهای روز بین‌المللی</p>
              </div>
            </div>

            {/* floating medal card */}
            <div className="absolute -bottom-7 -right-3 sm:-right-6 bg-white dark:bg-[#141E33] border border-[#E4E9F2] dark:border-[#26334F] rounded-2xl p-4 shadow-xl flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Trophy size={24} />
              </div>
              <div className="text-right">
                <strong className="text-xs font-black block">۱۴ مدال جهانی و کشوری</strong>
                <span className="text-[11px] text-[#526176] dark:text-[#8DA0BE]">المپیادهای ریاضی، کامپیوتر و فیزیک</span>
              </div>
            </div>

            {/* small overlapping image */}
            <div className="hidden md:block absolute -top-6 -left-4 rounded-2xl overflow-hidden border-4 border-white dark:border-[#141E33] shadow-xl w-36 rotate-3">
              <img src={hallImg} alt="تالار یادگیری" className="w-full h-24 object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Admission deadline strip ═══ */}
      <div className="px-4 sm:px-6 lg:px-8 -mt-2 pb-4">
        <div className="max-w-7xl mx-auto">
          <a
            href="#admissions"
            className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-l from-amber-50 via-white to-white dark:from-amber-950/30 dark:via-[#0E1729] dark:to-[#0E1729] border border-amber-200 dark:border-amber-900/70 hover:border-amber-400 transition-colors group"
          >
            <div className="flex items-center gap-3 text-right">
              <span className="w-10 h-10 rounded-xl bg-amber-400/90 text-slate-950 flex items-center justify-center shrink-0">
                <Clock size={20} />
              </span>
              <div>
                <strong className="text-sm font-black text-amber-800 dark:text-amber-300 block">
                  مهلت پیش‌ثبت‌نام پایه‌های هفتم تا یازدهم محدود است
                </strong>
                <span className="text-[11px] text-[#526176] dark:text-[#9DB0CC]">
                  ظرفیت هر پایه ۲۴ نفر است؛ ثبت درخواست کمتر از یک دقیقه طول می‌کشد.
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 group-hover:gap-3 transition-all">
              رزرو وقت آزمون
              <ArrowLeft size={15} />
            </span>
          </a>
        </div>
      </div>

      {/* ═══ Stats band ═══ */}
      <section className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { v: '۹۸.۴٪', l: 'قبولی دانشگاه‌های سطح یک', d: 'شریف، تهران، امیرکبیر و علوم پزشکی', c: 'text-[#2457C5] dark:text-[#8BAEFF]' },
            { v: `${toPersianDigits(14)} نشان`, l: 'مدال المپیاد ملی و جهانی', d: 'طلا، نقره و برنز در دوره اخیر', c: 'text-amber-600 dark:text-amber-400' },
            { v: `${toPersianDigits(24)} سال`, l: 'سابقه آموزش نخبگان', d: 'درخشش مستمر در آموزش کشور', c: 'text-emerald-600 dark:text-emerald-400' },
            { v: '۱۰۰٪', l: 'هوشمندسازی و پایش فردی', d: 'پرتال جامع و گزارش هفتگی اولیا', c: 'text-purple-600 dark:text-purple-400' },
          ].map((s) => (
            <div
              key={s.l}
              className="p-5 rounded-2xl bg-white dark:bg-[#0E1729] border border-[#E4E9F2] dark:border-[#1B2740] text-right hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <strong className={cn('text-2xl sm:text-3xl font-black tabular-nums block', s.c)}>{s.v}</strong>
              <span className="text-xs font-bold mt-1.5 block">{s.l}</span>
              <span className="text-[11px] text-[#526176] dark:text-[#8DA0BE] mt-1 block leading-5">{s.d}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ ۰۱ · About / Pillars ═══ */}
      <section id="about" className="py-16 lg:py-20 px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <SectionHead
            index="۰۱"
            eyebrow="معرفی مدرسه"
            title="فلسفه تربیتی ما در چهار ارکان"
            desc="ما بر این باوریم هر دانش‌آموز یک استعداد یگانه است؛ رسالت ما پرورش انسان‌های اندیشمند، خلاق و مسئولیت‌پذیر است، نه فقط قبولی در آزمون‌ها."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PILLARS.map((p, i) => (
              <div
                key={p.title}
                className="group p-6 rounded-3xl bg-white dark:bg-[#0E1729] border border-[#E4E9F2] dark:border-[#1B2740] hover:border-[#2457C5]/40 dark:hover:border-[#8BAEFF]/40 hover:shadow-xl transition-all text-right"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={cn('w-12 h-12 p-3 rounded-2xl', p.color)}>{p.icon}</div>
                  <span className="text-2xl font-black text-slate-100 dark:text-slate-800/80 select-none">
                    {toPersianDigits(String(i + 1).padStart(2, '0'))}
                  </span>
                </div>
                <h3 className="text-sm font-black mb-2">{p.title}</h3>
                <p className="text-xs text-[#526176] dark:text-[#9DB0CC] leading-6">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ۰۲ · Departments (interactive selector) ═══ */}
      <section
        id="departments"
        className="py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#0A1120]/70 border-y border-[#E4E9F2] dark:border-[#1B2740] scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto">
          <SectionHead
            index="۰۲"
            eyebrow="دپارتمان‌های آموزشی"
            title="مسیر تخصصی دانش‌آموز را انتخاب کنید"
            desc="برنامه‌ریزی دقیق درسی، تفکیک سرفصل‌های کنکور و المپیاد، و حضور دبیران مرجع و طراحان آزمون‌های برتر کشوری."
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Selector */}
            <div className="lg:col-span-5 space-y-3">
              {DEPARTMENTS.map((d) => {
                const isActive = d.id === activeDept;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setActiveDept(d.id)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-2xl border text-right transition-all cursor-pointer',
                      isActive
                        ? 'border-[#2457C5]/60 dark:border-[#8BAEFF]/50 bg-blue-50/60 dark:bg-blue-950/20 shadow-sm'
                        : 'border-[#E4E9F2] dark:border-[#1B2740] bg-white dark:bg-[#0E1729] hover:border-slate-300 dark:hover:border-[#26334F]',
                    )}
                  >
                    <span className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', d.accent)}>
                      {d.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={cn('text-sm font-black block', isActive ? 'text-[#2457C5] dark:text-[#8BAEFF]' : '')}>
                        {d.title}
                      </span>
                      <span className="text-[11px] text-[#526176] dark:text-[#8DA0BE] block mt-0.5 truncate">{d.subtitle}</span>
                    </span>
                    <ArrowLeft
                      size={16}
                      className={cn('shrink-0 transition-opacity', isActive ? 'text-[#2457C5] dark:text-[#8BAEFF]' : 'opacity-20')}
                    />
                  </button>
                );
              })}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-7">
              <div className="h-full p-7 rounded-3xl bg-gradient-to-bl from-slate-50 to-white dark:from-[#101B30] dark:to-[#0E1729] border border-[#E4E9F2] dark:border-[#1B2740] flex flex-col text-right">
                <div className="flex items-center gap-3 mb-5">
                  <span className={cn('w-12 h-12 rounded-xl flex items-center justify-center', dept.accent)}>{dept.icon}</span>
                  <div>
                    <h3 className="text-lg font-black">{dept.title}</h3>
                    <span className="text-xs text-[#526176] dark:text-[#8DA0BE]">{dept.subtitle}</span>
                  </div>
                </div>

                <ul className="space-y-3 flex-1">
                  {dept.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-[13px] text-[#3D4C63] dark:text-[#B3C0D2]">
                      <CheckCircle2 size={17} className="text-emerald-500 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-5 mt-5 border-t border-dashed border-[#E4E9F2] dark:border-[#1B2740] flex items-center justify-between gap-3">
                  <Badge variant="primary">{dept.stat}</Badge>
                  <a href="#admissions">
                    <Button size="sm" variant="outline" className="text-xs font-bold">
                      ثبت‌نام در این رشته
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ۰۳ · Facilities ═══ */}
      <section id="facilities" className="py-16 lg:py-20 px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <SectionHead
            index="۰۳"
            eyebrow="پردیس و تجهیزات"
            title="فضاهای یادگیری در تراز جهانی"
            desc="تلفیق نظریه و عمل با تجهیزات فوق‌پیشرفته رباتیک، نانوفناوری و سالن‌های اختصاصی مطالعه."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FACILITIES.map((f) => (
              <div
                key={f.title}
                className="group rounded-3xl overflow-hidden bg-white dark:bg-[#0E1729] border border-[#E4E9F2] dark:border-[#1B2740] hover:shadow-2xl transition-all"
              >
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={f.image}
                    alt={f.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />
                  <span className="absolute top-4 right-4 bg-white/90 dark:bg-[#0E1729]/90 backdrop-blur text-[11px] font-bold px-3 py-1 rounded-full border border-white/40 dark:border-white/10">
                    {f.tag}
                  </span>
                </div>
                <div className="p-6 text-right">
                  <h3 className="text-sm font-black mb-2">{f.title}</h3>
                  <p className="text-xs text-[#526176] dark:text-[#9DB0CC] leading-6">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Honors showcase (interactive component) ═══ */}
      <div id="honors" className="scroll-mt-24">
        <StudentHonorsShowcase />
      </div>

      {/* ═══ ۰۴ · News ═══ */}
      <section id="news" className="py-16 lg:py-20 px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <SectionHead
            index="۰۴"
            eyebrow="اخبار و رویدادها"
            title="تازه‌ترین اخبار مجتمع آموزشی"
            desc="پوشش اخبار علمی، المپیادها، بخشنامه‌های پذیرش و رویدادهای آموزشی."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {NEWS.map((n) => (
              <article
                key={n.title}
                className="group p-6 rounded-3xl bg-white dark:bg-[#0E1729] border border-[#E4E9F2] dark:border-[#1B2740] hover:shadow-xl hover:border-[#2457C5]/30 dark:hover:border-[#8BAEFF]/30 transition-all text-right"
              >
                <div className="flex items-center justify-between mb-4">
                  <Badge variant={n.tone}>{n.category}</Badge>
                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                    <Calendar size={13} />
                    {n.date}
                  </span>
                </div>
                <h3 className="text-sm font-black leading-7 mb-2 group-hover:text-[#2457C5] dark:group-hover:text-[#8BAEFF] transition-colors">
                  {n.title}
                </h3>
                <p className="text-xs text-[#526176] dark:text-[#9DB0CC] leading-6">{n.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ۰۵ · Admissions: steps + pre-registration form ═══ */}
      <section
        id="admissions"
        className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#0A1120]/70 border-y border-[#E4E9F2] dark:border-[#1B2740] scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto">
          <SectionHead
            index="۰۵"
            eyebrow="پذیرش ۱۴۰۵–۱۴۰۶"
            title="پیش‌ثبت‌نام آزمون ورودی، در چهار گام"
            desc="فرم زیر مستقیماً در سامانه پذیرش مدرسه ثبت می‌شود؛ مدیر و دفتر پذیرش بلافاصله درخواست شما را می‌بینند و کد رهگیری دریافت می‌کنید."
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Steps timeline */}
            <div className="lg:col-span-5 text-right">
              <div className="relative pr-7 space-y-7">
                <span className="absolute right-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-amber-400 via-[#2457C5]/40 to-transparent" />
                {ADMISSION_STEPS.map((step, i) => (
                  <div key={step.title} className="relative flex items-start gap-4">
                    <span
                      className={cn(
                        'absolute -right-7 w-8 h-8 rounded-full flex items-center justify-center border-2 text-[11px] font-black',
                        i === 0
                          ? 'bg-amber-400 border-amber-400 text-slate-950'
                          : 'bg-white dark:bg-[#0E1729] border-[#2457C5]/40 dark:border-[#8BAEFF]/40 text-[#2457C5] dark:text-[#8BAEFF]',
                      )}
                    >
                      {i === 0 ? <ClipboardList size={15} /> : toPersianDigits(i + 1)}
                    </span>
                    <div className="pr-8">
                      <h4 className="text-sm font-black flex items-center gap-2">
                        <span className="text-[#2457C5] dark:text-[#8BAEFF]">{step.icon}</span>
                        {step.title}
                      </h4>
                      <p className="text-xs text-[#526176] dark:text-[#9DB0CC] leading-6 mt-1.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* admissions desk */}
              <div className="mt-8 p-5 rounded-2xl bg-slate-50 dark:bg-[#0E1729] border border-[#E4E9F2] dark:border-[#1B2740] space-y-2.5 text-xs">
                <strong className="text-xs font-black block mb-1">دفتر پذیرش و دبیرخانه</strong>
                <div className="flex items-center gap-2 text-[#526176] dark:text-[#9DB0CC]">
                  <Phone size={15} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0" />
                  <span className="font-mono">۰۲۱-۲۲۰۰۵۵۴۴ (داخلی ۲ · پذیرش)</span>
                </div>
                <div className="flex items-center gap-2 text-[#526176] dark:text-[#9DB0CC]">
                  <Clock size={15} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0" />
                  <span>شنبه تا چهارشنبه، ۷:۳۰ تا ۱۶:۰۰</span>
                </div>
              </div>
            </div>

            {/* Form card */}
            <div className="lg:col-span-7">
              <div className="relative rounded-3xl bg-white dark:bg-[#0E1729] border border-[#E4E9F2] dark:border-[#26334F] shadow-xl shadow-blue-900/5 overflow-hidden">
                <div className="h-1.5 bg-gradient-to-l from-amber-400 via-[#2457C5] to-[#2457C5]" />

                {regTrackingCode ? (
                  <div className="p-8 sm:p-10 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 size={36} />
                    </div>
                    <h3 className="text-lg font-black">درخواست شما در سامانه پذیرش ثبت شد</h3>
                    <p className="text-xs sm:text-sm text-[#526176] dark:text-[#9DB0CC] leading-6 max-w-md mx-auto">
                      درخواست پیش‌ثبت‌نام <strong>{regForm.studentName}</strong> به مدیر و دفتر پذیرش مدرسه ارسال شد.
                      کارشناسان ما برای تعیین وقت آزمون با شما تماس می‌گیرند.
                    </p>
                    <div className="inline-block px-6 py-3 rounded-xl bg-slate-50 dark:bg-[#0A1120] border border-emerald-300 dark:border-emerald-800">
                      <span className="text-[10px] text-[#526176] dark:text-[#8DA0BE] block mb-1">کد رهگیری شما</span>
                      <span className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-[0.2em]">
                        {regTrackingCode}
                      </span>
                    </div>
                    <div className="flex justify-center gap-3 pt-2">
                      <Button variant="outline" size="sm" onClick={resetForm} className="text-xs">
                        ثبت درخواست جدید
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePreRegister} className="p-6 sm:p-8 space-y-5 text-right">
                    <div className="flex items-center gap-3 pb-4 border-b border-dashed border-[#E4E9F2] dark:border-[#1B2740]">
                      <span className="w-11 h-11 rounded-2xl bg-[#2457C5] dark:bg-[#8BAEFF] text-white dark:text-[#101722] flex items-center justify-center">
                        <GraduationCap size={22} />
                      </span>
                      <div>
                        <h3 className="text-sm font-black">فرم پیش‌ثبت‌نام آنلاین</h3>
                        <span className="text-[11px] text-[#526176] dark:text-[#8DA0BE]">
                          پاسخ به همه پرسش‌های ستاره‌دار الزامی است
                        </span>
                      </div>
                    </div>

                    {regError && (
                      <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                        <X size={16} className="shrink-0" />
                        {regError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="نام و نام خانوادگی دانش‌آموز" required>
                        <input
                          type="text"
                          required
                          value={regForm.studentName}
                          onChange={(e) => setRegForm({ ...regForm, studentName: e.target.value })}
                          placeholder="مثال: آرمان رضایی"
                          className={inputCls}
                        />
                      </Field>

                      <Field label="شماره همراه ولی / اولیا" required>
                        <input
                          type="tel"
                          required
                          dir="ltr"
                          value={regForm.parentPhone}
                          onChange={(e) => setRegForm({ ...regForm, parentPhone: e.target.value })}
                          placeholder="09123456789"
                          className={cn(inputCls, 'font-mono text-left')}
                        />
                      </Field>

                      <Field label="پایه و رشته درخواستی" required>
                        <select
                          value={regForm.grade}
                          onChange={(e) => setRegForm({ ...regForm, grade: e.target.value })}
                          className={inputCls}
                        >
                          {GRADE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="معدل نوبت اول یا پایانی سال قبل">
                        <input
                          type="text"
                          dir="ltr"
                          value={regForm.lastGpa}
                          onChange={(e) => setRegForm({ ...regForm, lastGpa: e.target.value })}
                          placeholder="19.5"
                          className={cn(inputCls, 'font-mono text-left')}
                        />
                      </Field>

                      <div className="sm:col-span-2">
                        <Field label="نام مدرسه و شهر فعلی">
                          <input
                            type="text"
                            value={regForm.currentSchool}
                            onChange={(e) => setRegForm({ ...regForm, currentSchool: e.target.value })}
                            placeholder="مثال: مدرسه شهید بهشتی تهران"
                            className={inputCls}
                          />
                        </Field>
                      </div>

                      <div className="sm:col-span-2 space-y-2.5">
                        <label className="flex items-start gap-2.5 cursor-pointer select-none p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50">
                          <input
                            type="checkbox"
                            checked={regForm.hasHonor}
                            onChange={(e) => setRegForm({ ...regForm, hasHonor: e.target.checked })}
                            className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                          />
                          <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 leading-6">
                            دارای رتبه در المپیادها، مسابقات علمی یا جشنواره خوارزمی هستم
                            <span className="block text-[10px] font-normal text-amber-700/80 dark:text-amber-400/80">
                              جهت بررسی سهمیه استعداد درخشان و بورسیه
                            </span>
                          </span>
                        </label>

                        {regForm.hasHonor && (
                          <input
                            type="text"
                            value={regForm.honorDesc}
                            onChange={(e) => setRegForm({ ...regForm, honorDesc: e.target.value })}
                            placeholder="عنوان افتخار یا رتبه کسب‌شده (مثال: مدال برنز المپیاد ریاضی کشوری)"
                            className={inputCls}
                          />
                        )}
                      </div>
                    </div>

                    <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-dashed border-[#E4E9F2] dark:border-[#1B2740]">
                      <span className="text-[11px] text-[#526176] dark:text-[#8DA0BE] flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                        اطلاعات شما فقط برای فرایند پذیرش استفاده و محفوظ نگه‌داری می‌شود.
                      </span>
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        loading={regSubmitting}
                        icon={regSubmitting ? undefined : <Send size={16} className="rotate-180" />}
                        className="text-xs sm:text-sm font-bold w-full sm:w-auto shadow-lg shadow-blue-600/20"
                      >
                        {regSubmitting ? 'در حال ثبت...' : 'ثبت درخواست و دریافت کد رهگیری'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ۰۶ · FAQ ═══ */}
      <section id="faq" className="py-16 lg:py-20 px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="max-w-3xl mx-auto">
          <SectionHead
            index="۰۶"
            eyebrow="راهنمای اولیا"
            title="پرسش‌های متداول داوطلبان و اولیا"
          />
          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={faq.q}
                  className={cn(
                    'rounded-2xl border bg-white dark:bg-[#0E1729] overflow-hidden transition-colors',
                    isOpen
                      ? 'border-[#2457C5]/40 dark:border-[#8BAEFF]/40'
                      : 'border-[#E4E9F2] dark:border-[#1B2740]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-right cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-bold">{faq.q}</span>
                    <span
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all',
                        isOpen
                          ? 'bg-amber-400 text-slate-950 rotate-180'
                          : 'bg-slate-100 dark:bg-[#1B2740] text-slate-400',
                      )}
                    >
                      <ChevronDown size={15} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-[#526176] dark:text-[#9DB0CC] leading-7 border-t border-dashed border-[#E4E9F2] dark:border-[#1B2740] pt-3.5 text-right">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-[#E4E9F2] dark:border-[#1B2740] bg-white dark:bg-[#0A1120] pt-14 pb-8 px-4 sm:px-6 lg:px-8 text-xs">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-10 text-right">

          <div className="space-y-3.5">
            <div className="flex items-center gap-3">
              <SchoolLogo size={38} />
              <div>
                <strong className="text-sm font-black block">مشاهیر آینده</strong>
                <span className="text-[10px] text-[#8DA0BE]">مجتمع آموزشی استعدادهای درخشان</span>
              </div>
            </div>
            <p className="text-[11px] text-[#526176] dark:text-[#8DA0BE] leading-6">
              تحت نظارت رسمی وزارت آموزش و پرورش، اداره کل آموزش و پرورش شهر تهران (منطقه ۱). کد واحد آموزشی: ۱۷۳۴۰۹
            </p>
            <a href="#admissions">
              <Button variant="outline" size="sm" icon={<Send size={13} className="rotate-180" />} className="text-[11px] font-bold">
                پیش‌ثبت‌نام سال تحصیلی جدید
              </Button>
            </a>
          </div>

          <div>
            <h4 className="font-black text-xs mb-4">دسترسی سریع</h4>
            <ul className="space-y-2.5 text-[11px] text-[#526176] dark:text-[#8DA0BE]">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="hover:text-[#2457C5] dark:hover:text-[#8BAEFF] transition-colors">{l.label}</a>
                </li>
              ))}
              <li>
                <a href="#admissions" className="hover:text-[#2457C5] dark:hover:text-[#8BAEFF] transition-colors">پیش‌ثبت‌نام سال جدید</a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-black text-xs mb-4">پرتال و سامانه‌ها</h4>
            <ul className="space-y-2.5 text-[11px] text-[#526176] dark:text-[#8DA0BE]">
              <li><Link to="/dashboard" className="hover:text-[#2457C5] dark:hover:text-[#8BAEFF]">پرتال دانش‌آموزان و تکالیف</Link></li>
              <li><Link to="/dashboard" className="hover:text-[#2457C5] dark:hover:text-[#8BAEFF]">پرتال اولیا و کارنامه هوشمند</Link></li>
              <li><Link to="/dashboard" className="hover:text-[#2457C5] dark:hover:text-[#8BAEFF]">دفتر الکترونیک دبیران</Link></li>
              <li><Link to="/login" className="hover:text-[#2457C5] dark:hover:text-[#8BAEFF]">ورود کادر آموزشی و مدیریت</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-black text-xs mb-4">ارتباط با دبیرخانه</h4>
            <div className="space-y-2.5 text-[11px] text-[#526176] dark:text-[#8DA0BE]">
              <div className="flex items-start gap-2">
                <MapPin size={15} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0 mt-0.5" />
                <span>تهران، شمیرانات، خیابان شریعتی، بالاتر از پل رومی، خیابان مشاهیر، پلاک ۱۲</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={15} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0" />
                <span className="font-mono">۰۲۱-۲۲۰۰۵۵۴۴ · ۰۲۱-۲۲۰۰۵۵۴۵</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={15} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0" />
                <span className="font-mono" dir="ltr">info@mashahir-school.ir</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-[#2457C5] dark:text-[#8BAEFF] shrink-0" />
                <span>شنبه تا چهارشنبه ۷:۳۰ الی ۱۶:۰۰</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-dashed border-[#E4E9F2] dark:border-[#1B2740] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <span>کلیه حقوق مادی و معنوی این پایگاه متعلق به «مجتمع آموزشی و دبیرستان مشاهیر آینده» است. © ۱۴۰۴–۱۴۰۵</span>
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-[#2457C5] dark:text-[#8BAEFF] font-bold hover:underline">ورود به سامانه پرتال</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* ── Shared bits ─────────────────────────────────────────────────────────── */

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-[#DCE3EE] dark:border-[#26334F] bg-[#F8FAFD] dark:bg-[#0A1120] text-[13px] focus:ring-2 focus:ring-[#2457C5]/30 focus:border-[#2457C5]/50 outline-none transition placeholder:text-slate-400';

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-bold text-[#3D4C63] dark:text-[#B3C0D2] mb-1.5 text-right">
      {label}
      {required && <span className="text-rose-500 mr-1">*</span>}
    </label>
    {children}
  </div>
);

const SectionHead: React.FC<{ index: string; eyebrow: string; title: string; desc?: string }> = ({
  index,
  eyebrow,
  title,
  desc,
}) => (
  <div className="text-center max-w-2xl mx-auto mb-12">
    <div className="inline-flex items-center gap-2.5 mb-4">
      <span className="font-mono text-[11px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/70 rounded-md px-1.5 py-0.5">
        {index}
      </span>
      <span className="text-[11px] font-black text-[#526176] dark:text-[#8DA0BE] tracking-wide">{eyebrow}</span>
      <span className="w-8 h-px bg-amber-400/70" />
    </div>
    <h2 className="text-2xl sm:text-3xl lg:text-[2.1rem] font-black leading-[1.4] tracking-tight">{title}</h2>
    {desc && (
      <p className="text-xs sm:text-[13px] text-[#526176] dark:text-[#9DB0CC] mt-3.5 leading-7">{desc}</p>
    )}
  </div>
);
