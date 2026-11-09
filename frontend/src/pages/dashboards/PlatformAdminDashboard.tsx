import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common';
import { ModulePending } from '../../components/common/ModulePending';

export const PlatformAdminDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`کنسول مدیر پلتفرم — ${currentUser.fullName}`}
        subtitle="راه‌اندازی مدرسه‌های جدید، تخصیص مدیر و پایش سلامت سامانه"
      />
      <ModulePending
        title="راه‌اندازی مدرسه از این کنسول انجام نمی‌شود"
        description="بک‌اند فعلی مدرسهٔ جدید نمی‌سازد (مدرسه‌ها با seeder و دادهٔ اولیه ایجاد می‌شوند). این صفحه به‌جای ویزارد نمایشی، وضعیت واقعی را نشان می‌دهد."
        pending={[
          'اندپوینت ساخت و فهرست مدرسه‌ها با کد و شعبه (فقط platform_admin)',
          'تخصیص مدیر مدرسه و تعریف سال تحصیلی در همان درخواست',
          'لاگ ممیزی برای هر مدرسهٔ ساخته‌شده',
        ]}
        backTo={{ href: '/dashboard', label: 'بازگشت به داشبورد' }}
      />
    </div>
  );
};
