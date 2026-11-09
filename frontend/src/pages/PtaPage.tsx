import React from 'react';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/common';
import { ModulePending } from '../components/common/ModulePending';

export const PtaPage: React.FC = () => {
  const { activeRole } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="انجمن اولیا و مربیان"
        subtitle={`جلسات، صورت‌جلسه‌ها، مصوبات و نظرسنجی خانواده‌ها — نقش فعال: ${activeRole.persianTitle}`}
      />
      <ModulePending
        title="این ماژول هنوز API ندارد"
        description="جلسات و نظرسنجی‌های انجمن در بک‌اند ذخیره نمی‌شوند. نسخهٔ قبلی این صفحه صورت‌جلسه و نتایج رأی ساختگی نشان می‌داد؛ تا ساخت ماژول، صفحه خالی می‌ماند."
        pending={[
          'جدول جلسات انجمن با دستور جلسه، صورت‌جلسه و مصوبات',
          'نظرسنجی با سیاست ضدتکرار رأی و مهلت پاسخ',
          'دسترسی رئیس انجمن، مدیر و اولیا با تفکیک داده',
        ]}
        backTo={{ href: '/dashboard', label: 'بازگشت به داشبورد' }}
      />
    </div>
  );
};
