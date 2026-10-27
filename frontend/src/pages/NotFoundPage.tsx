import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home } from 'lucide-react';
import { Card, Button } from '../components/common';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="text-center p-8 max-w-md space-y-4">
        <AlertCircle size={44} className="mx-auto text-amber-500" />
        <h2 className="text-lg font-bold text-[#202B3C] dark:text-[#F1F5FB]">صفحه مورد نظر یافت نشد</h2>
        <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
          آدرس وارد شده معتبر نیست یا ممکن است دسترسی شما به این صفحه بر اساس نقش جاری محدود شده باشد.
        </p>
        <Link to="/" className="inline-block pt-2">
          <Button variant="primary" size="sm" icon={<Home size={15} />}>
            بازگشت به داشبورد اصلی
          </Button>
        </Link>
      </Card>
    </div>
  );
};
