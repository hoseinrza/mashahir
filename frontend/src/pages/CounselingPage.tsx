import React from 'react';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/common';
import { ModulePending } from '../components/common/ModulePending';

export const CounselingPage: React.FC = () => {
  const { activeRole } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="مشاورهٔ تحصیلی و روان‌شناختی"
        subtitle={`جلسات مشاوره، نوبت‌دهی و پیگیری — نقش فعال: ${activeRole.persianTitle}`}
      />
      <ModulePending
        title="این ماژول هنوز به سرور وصل نیست"
        description="بک‌اند سامانه هنوز ماژول مشاوره را ندارد؛ پیش‌تر این صفحه با دادهٔ نمایشی کار می‌کرد و نوبت‌ها و خلاصه‌جلسه‌های ساختگی نشان می‌داد. تا آماده‌شدن API، به‌جای دادهٔ جعلی خالی می‌ماند."
        pending={[
          'مدل نوبت و جلسهٔ مشاوره با وضعیت و محرمانگی یادداشت‌ها',
          'اندپوینت درخواست نوبت (دانش‌آموز/ولی) و تأیید (مشاور)',
          'گزارش خلاصهٔ قابل اشتراک با ولی، جدا از یادداشت محرمانه',
        ]}
        backTo={{ href: '/dashboard', label: 'بازگشت به داشبورد' }}
      />
    </div>
  );
};
