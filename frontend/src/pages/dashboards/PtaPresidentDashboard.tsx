import React from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Vote, MessageSquare, Calendar, CheckCircle2,
  Plus, FileText, ArrowRight, Award
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { PtaService } from '../../services';

export const PtaPresidentDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const meetings = PtaService.getMeetings();
  const surveys = PtaService.getSurveys();
  const feedbacks = PtaService.getFeedbacks();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`میز کار هیئت رئیسه انجمن اولیا و مربیان — ${currentUser.fullName}`}
        subtitle="رئیس انجمن اولیا و مربیان دبیرستان مشاهیر آینده · هماهنگی جلسات مجمع، نظرسنجی‌ها و پیگیری مطالبات والدین"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/pta">
              <Button variant="primary" size="sm" icon={<Plus size={15} />}>
                مدیریت مجمع و نظرسنجی‌ها
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">جلسات برگزارشده مجمع</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {toPersianDigits(meetings.length)}
            </span>
            <Badge variant="primary">سال جاری</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">مشارکت در نظرسنجی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {toPersianDigits(123)}
            </span>
            <Badge variant="success">خانواده فعال</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پیشنهادات واصله</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {toPersianDigits(feedbacks.length)}
            </span>
            <Badge variant="warning">پاسخ‌داده‌شده</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">مصوبات اجرایی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {toPersianDigits(5)}
            </span>
            <Badge variant="neutral">ابلاغ به مدیریت</Badge>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="text-right">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EE] dark:border-[#344257] mb-3">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <Calendar size={16} className="text-[#2457C5]" />
                نشست‌های ماهانه انجمن و پیگیری مصوبات
              </h3>
              <Link to="/pta" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                مشاهده صورت‌جلسات
              </Link>
            </div>

            <div className="space-y-3 text-xs">
              {meetings.map((m) => (
                <div key={m.id} className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{m.title}</strong>
                    <Badge variant={m.status === 'upcoming' ? 'warning' : 'success'}>
                      {m.status === 'upcoming' ? 'پیش‌رو' : 'مصوب'}
                    </Badge>
                  </div>
                  <span className="text-slate-500 block">تاریخ: {m.date} · محل: {m.location}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="text-right">
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <Vote size={16} className="text-[#2457C5]" />
              نظرسنجی فعال اولیا
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              ساعت برگزاری کارگاه‌های مهارت‌افزایی (سیاست: ۱ رای مستقل به ازای هر خانواده)
            </p>
            <Link to="/pta">
              <Button variant="outline" size="sm" className="w-full">
                ورود به سامانه رأی‌گیری
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
};
