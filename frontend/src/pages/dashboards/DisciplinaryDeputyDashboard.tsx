import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, Clock, CheckCircle2, AlertTriangle, Users,
  HeartHandshake, MessageSquare, Calendar, Award
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { INITIAL_ATTENDANCE } from '../../data/mockData';

export const DisciplinaryDeputyDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const attendanceToday = INITIAL_ATTENDANCE;

  const lateStudents = attendanceToday.filter((a) => a.status === 'late');
  const absentStudents = attendanceToday.filter((a) => a.status === 'absent');

  return (
    <div className="space-y-6">
      <PageHeader
        title="داشبورد معاونت پرورشی و انضباطی"
        subtitle={`کاربر فعال: ${currentUser.fullName} · پایش رفتار آموزشی، انضباط کلاسی و امور تربیتی`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/attendance">
              <Button variant="outline" size="sm" icon={<Clock size={15} />}>
                بررسی تأخیرها و غیبت‌ها
              </Button>
            </Link>
            <Link to="/counseling">
              <Button variant="primary" size="sm" icon={<HeartHandshake size={15} />}>
                ارجاع به مشاور تربیتی
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">میانگین نمره انضباط</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              ۱۹.۸۵
            </span>
            <Badge variant="success">بسیار مطلوب</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">تأخیرهای امروز صبح</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {toPersianDigits(lateStudents.length)} <span className="text-xs font-normal text-slate-500">مورد</span>
            </span>
            <Badge variant="warning">ثبت پیامک</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">غیبت‌های غیرموجه</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
              {toPersianDigits(absentStudents.length)} <span className="text-xs font-normal text-slate-500">نفر</span>
            </span>
            <Badge variant="danger">تماس پیگیری</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">فعالیت‌های فرهنگی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {toPersianDigits(4)}
            </span>
            <Badge variant="primary">جشنواره و مسابقات</Badge>
          </div>
        </Card>
      </div>

      {/* Action lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <ShieldAlert size={16} className="text-amber-600" />
                موارد نیازمند پیگیری انضباطی و تماس با اولیا
              </h3>
              <Link to="/attendance" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                دفتر حضور و غیاب
              </Link>
            </div>

            <div className="space-y-3">
              {lateStudents.concat(absentStudents).map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">{item.studentName}</strong>
                      <Badge variant={item.status === 'absent' ? 'danger' : 'warning'}>
                        {item.status === 'absent' ? 'غیبت صبح' : 'تأخیر ورود'}
                      </Badge>
                    </div>
                    <span className="text-xs text-slate-500 mt-1 block">
                      علت ثبت‌شده: {item.note || 'تأخیر صبحگاهی'} · ثبت ساعت {item.recordedAt}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-emerald-600 font-bold">
                      پیامک به ولی ارسال شد ✓
                    </span>
                    <Button variant="outline" size="sm">
                      تماس تلفنی
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <Award size={16} className="text-[#2457C5]" />
              رویدادهای پرورشی و اردویی جاری
            </h3>
            <div className="space-y-2.5 text-xs text-right">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <strong className="block text-[#202B3C] dark:text-[#F1F5FB]">اردوی علمی پارک فناوری پردیس</strong>
                <span className="text-slate-500">تاریخ: ۵ آبان‌ماه · رضایت‌نامه‌ها در دست امضا</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <strong className="block text-[#202B3C] dark:text-[#F1F5FB]">مسابقه کتابخوانی و خلاصه اثر</strong>
                <span className="text-slate-500">پایان مهلت ثبت‌نام: ۲۸ مهرماه</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
