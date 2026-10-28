import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCog, LogOut, RefreshCw, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { SchoolLogo, Button, Card, Badge } from '../components/common';

/**
 * پنل مهمان: کاربر لاگین‌شده‌ای که هنوز هیچ نقشی به او تخصیص نیافته.
 * هیچ داده‌ای جز پروفایل خودش دیده نمی‌شود؛ تا وقتی مدرسه نقش تعیین نکند
 * همین صفحه نمایش داده می‌شود.
 */
export const GuestPanelPage: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC] dark:bg-[#0c1322] text-[#202B3C] dark:text-[#F1F5FB] transition-colors">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0c1322]/85 backdrop-blur-xl border-b border-[#DCE3EE] dark:border-[#223147] px-4 lg:px-8 h-16 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <SchoolLogo className="w-8 h-8" />
          <span className="text-sm font-bold">سامانه مشاهیر آینده</span>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="تغییر پوسته"
        >
          پوسته
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="p-8 text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <UserCog size={30} />
            </div>

            <div>
              <h1 className="text-xl font-black">حساب شما فعال است</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                <b>{currentUser.fullName}</b> عزیز،
                <br />
                هنوز هیچ نقشی به حساب شما تخصیص نیافته است. برای فعال‌سازی
                دسترسی، با دفتر مدرسه تماس بگیرید.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-[#131C2E] rounded-xl p-4 text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Phone size={13} />
                <span>دفتر مدرسه: در ساعات اداری پاسخگوست</span>
              </div>
              <Badge variant="neutral" className="text-[10px]">
                پس از تخصیص نقش، یک‌بار خروج و ورود کافی است
              </Badge>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => window.location.reload()}
              >
                <RefreshCw size={15} className="ml-1" />
                بررسی مجدد دسترسی
              </Button>
              <Button className="flex-1 h-11" onClick={handleLogout}>
                <LogOut size={15} className="ml-1" />
                خروج از حساب
              </Button>
            </div>
          </Card>

          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-6">
            دسترسی شما به هیچ داده‌ای تخصیص نیافته است — پیش‌فرض ممنوع.
          </p>
        </div>
      </main>
    </div>
  );
};
