import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common';
import { ModulePending } from '../../components/common/ModulePending';

export const CounselorDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`میز مشاوره — ${currentUser.fullName}`}
        subtitle="جلسات مشاورهٔ تحصیلی و روان‌شناختی، نوبت‌دهی و پیگیری پرونده‌های دانش‌آموزان"
      />
      <ModulePending
        title="ماژول مشاوره هنوز به سرور وصل نشده است"
        description="در نسخهٔ فعلی، بک‌اند سامانه ماژول مشاوره (نوبت‌ها، جلسات، خلاصهٔ محرمانه و پیگیری) را ندارد؛ بنابراین این صفحه به‌جای دادهٔ نمایشی، خالی می‌ماند تا آمار ساختگی به شما نشان داده نشود."
        pending={[
          'جدول نوبت‌ها و جلسات مشاوره با تاریخ و وضعیت (درخواست، تأیید، انجام‌شده، لغو)',
          'دسترسی‌های تفکیک‌شده: خلاصهٔ قابل اشتراک برای ولی و یادداشت محرمانهٔ مشاور',
          'تست‌های دسترسی برای نقش‌های مشاور، دانش‌آموز و ولی',
        ]}
        backTo={{ href: '/dashboard', label: 'بازگشت به داشبورد' }}
      />
    </div>
  );
};
