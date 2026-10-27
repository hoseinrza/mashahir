import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Server, Shield, Cpu, Activity, CheckCircle2, Lock,
  Globe, Database, Layers, ArrowRight, Building2, Plus,
  Users, BookOpen, GraduationCap, Phone, MapPin, Eye, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { SchoolService, ClassroomService, UserService } from '../../services';
import { School } from '../../types';
import { SchoolCreationWizard } from '../../components/schools/SchoolCreationWizard';

export const PlatformAdminDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [schools, setSchools] = useState<School[]>(() => SchoolService.getAll());
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const handleSchoolCreated = (newSchool: School) => {
    setSchools(SchoolService.getAll());
    setIsWizardOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`مرکز مدیریت کلان پلتفرم — ${currentUser.fullName}`}
        subtitle="مدیریت واحدهای آموزشی، نظارت بر سلامت زیرساخت، مجوزهای پلتفرم و انطباق امنیتی"
      />

      {/* WIZARD EMBEDDED IF ACTIVE */}
      {isWizardOpen ? (
        <SchoolCreationWizard
          onComplete={handleSchoolCreated}
          onCancel={() => setIsWizardOpen(false)}
        />
      ) : (
        <>
          {/* Top Action Banner for School Creation */}
          <div className="p-6 rounded-3xl bg-gradient-to-l from-[#2457C5] to-[#1e3a8a] text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 text-right">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold">
                <Sparkles size={14} className="text-amber-300" />
                <span>فرآیند ویژه مدیر ارشد پلتفرم</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black">
                ایجاد، راه‌اندازی و پیکربندی واحد آموزشی جدید
              </h2>
              <p className="text-xs text-blue-100 max-w-2xl leading-relaxed">
                با اجرای این ویزارد ۵ مرحله‌ای، هویت مدرسه ثبت شده، کادر مدیریتی و آموزشی (با انتخاب یا ایجاد کاربر) منتسب، کلاس‌های درسی ایجاد و دانش‌آموزان همراه اولیا به مدرسه متصل می‌گردند.
              </p>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsWizardOpen(true)}
              icon={<Plus size={18} />}
              className="bg-white text-[#2457C5] hover:bg-blue-50 border-white shrink-0 font-bold shadow-md cursor-pointer"
            >
              شروع ویزارد تأسیس مدرسه
            </Button>
          </div>

          {/* RBAC Ethical & Privacy Guard Banner */}
          <div className="p-4 rounded-2xl bg-amber-50/90 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-900/50 text-xs leading-relaxed flex items-start gap-3 text-right">
            <Lock size={20} className="shrink-0 mt-0.5 text-amber-700" />
            <div>
              <strong className="block text-sm font-bold">محدودیت ذاتی دسترسی ادمین کل پلتفرم به داده‌های شخصی:</strong>
              <span>
                مطابق با اصل تفکیک قلمرو دسترسی، مدیر کل پلتفرم و پشتیبان فنی به هیچ عنوان مجاز به مشاهده نمرات کلاسی، متن تکالیف، مکاتبات خصوصی خانواده‌ها و یادداشت‌های پرونده مشاوره نیستند.
              </span>
            </div>
          </div>

          {/* Platform Level Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="text-right">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">مدارس متصل به شبکه</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
                  {toPersianDigits(schools.length)} <span className="text-xs font-normal text-slate-500">واحد فعال</span>
                </span>
                <Badge variant="primary">پلتفرم کشوری</Badge>
              </div>
            </Card>

            <Card className="text-right">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پایداری سیستم (Uptime)</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ۹۹.۹۸٪
                </span>
                <Badge variant="success">سبز</Badge>
              </div>
            </Card>

            <Card className="text-right">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">تأخیر پاسخ‌دهی API</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] font-mono tabular-nums">
                  ۲۴ ms
                </span>
                <Badge variant="neutral">بهینه</Badge>
              </div>
            </Card>

            <Card className="text-right">
              <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">سلامت پایگاه داده و قواعد</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ۱۰۰٪
                </span>
                <Badge variant="success">تضمین‌شده</Badge>
              </div>
            </Card>
          </div>

          {/* Connected Schools Directory */}
          <Card className="text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
              <div>
                <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                  فهرست واحدهای آموزشی تأسیس‌شده در پلتفرم
                </h3>
                <p className="text-xs text-slate-500">
                  واحدهای تحت پوشش سامانه با امکان مدیریت کادر، کلاس‌ها و دسترسی‌ها
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsWizardOpen(true)}
                icon={<Plus size={16} />}
              >
                تأسیس واحد جدید
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schools.map((school) => {
                const schoolClassrooms = ClassroomService.getBySchool(school.id);
                return (
                  <div
                    key={school.id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:shadow-xs transition-all space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#2457C5]/10 text-[#2457C5] dark:text-[#8BAEFF] flex items-center justify-center font-bold">
                          <Building2 size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-[#202B3C] dark:text-[#F1F5FB]">
                            {school.name}
                          </h4>
                          <span className="text-xs text-slate-500">{school.branch}</span>
                        </div>
                      </div>
                      <Badge variant="primary">{toPersianDigits(school.academicYear)}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-slate-400 block">کد سازمانی:</span>
                        <strong className="font-mono">{school.code}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">مدیر ارشد:</span>
                        <strong className="text-[#202B3C] dark:text-[#F1F5FB]">{school.principalName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">ظرفیت کل:</span>
                        <strong className="font-mono">{toPersianDigits(school.capacity || 300)} نفر</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">کلاس‌های ثبت‌شده:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400">{toPersianDigits(schoolClassrooms.length || 6)} کلاس</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-mono">{school.phone}</span>
                      <Link
                        to="/user-management"
                        className="inline-flex items-center gap-1 font-bold text-[#2457C5] dark:text-[#8BAEFF] hover:underline"
                      >
                        <span>مدیریت کادر، کلاس‌ها و دانش‌آموزان</span>
                        <ArrowRight size={13} className="rotate-180" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Services and Infrastructure */}
          <Card className="text-right space-y-4">
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] pb-2 border-b border-[#DCE3EE] dark:border-[#344257]">
              وضعیت زیرسیستم‌ها و میکروسرویس‌های فعال
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <strong className="text-[#202B3C] dark:text-[#F1F5FB]">موتور ارزیابی و تصحیح آزمون</strong>
                  <Badge variant="success">برخط</Badge>
                </div>
                <span className="text-slate-500">پردازش لحظه‌ای کلیدهای چهارگزینه‌ای</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <strong className="text-[#202B3C] dark:text-[#F1F5FB]">درگاه ارسال پیامک مخابرات</strong>
                  <Badge variant="success">فعال</Badge>
                </div>
                <span className="text-slate-500">ارسال خودکار وضعیت حضور و غیاب اولیا</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <strong className="text-[#202B3C] dark:text-[#F1F5FB]">موتور تطبیق احکام قضایی</strong>
                  <Badge variant="success">فعال</Badge>
                </div>
                <span className="text-slate-500">اعمال برخط دادنامه‌های دادگاه خانواده</span>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
