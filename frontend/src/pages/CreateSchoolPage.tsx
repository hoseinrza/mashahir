import React from 'react';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/common';
import { ModulePending } from '../components/common/ModulePending';

export const CreateSchoolPage: React.FC = () => {
  const { activeRole } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="راه‌اندازی مدرسهٔ جدید"
        subtitle={`ایجاد مدرسه، تعریف سال تحصیلی و تخصیص مدیر — نقش فعال: ${activeRole.persianTitle}`}
      />
      <ModulePending
        title="ساخت مدرسه از طریق API ممکن نیست"
        description="بک‌اند فعلی اندپوینت ساخت مدرسه ندارد و مدرسه‌ها از seeder می‌آیند. ویزارد قبلی فقط در حافظهٔ مرورگر مدرسه می‌ساخت؛ به همین دلیل غیرفعال شده است."
        pending={[
          'اندپوینت POST /v1/schools با کد مدرسه، شعبه و سال تحصیلی',
          'تخصیص مدیر مدرسه در همان تراکنش',
          'دسترسی انحصاری platform_admin و ثبت در لاگ ممیزی',
        ]}
        backTo={{ href: '/dashboard', label: 'بازگشت به داشبورد' }}
      />
    </div>
  );
};
