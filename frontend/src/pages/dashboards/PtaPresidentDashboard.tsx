import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common';
import { ModulePending } from '../../components/common/ModulePending';

export const PtaPresidentDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`میز انجمن اولیا و مربیان — ${currentUser.fullName}`}
        subtitle="جلسات انجمن، صورت‌جلسه‌ها، نظرسنجی‌ها و بازخورد خانواده‌ها"
      />
      <ModulePending
        title="ماژول انجمن اولیا هنوز API ندارد"
        description="جلسات، مصوبات و نظرسنجی‌های انجمن در بک‌اند نگه‌داری نمی‌شوند؛ این صفحه فعلاً خالی است تا صورت‌جلسه و آمار ساختگی نمایش داده نشود."
        pending={[
          'جدول جلسات انجمن با دستور جلسه، صورت‌جلسه و مصوبات',
          'نظرسنجی با سیاست ضدتکرار رأی (هر ولی / هر خانواده)',
          'دسترسی‌های رئیس انجمن، مدیر مدرسه و اولیا',
        ]}
        backTo={{ href: '/dashboard', label: 'بازگشت به داشبورد' }}
      />
    </div>
  );
};
