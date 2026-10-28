import React, { useState } from 'react';
import {
  AlertCircle, CheckCircle2, ChevronRight, X, Search,
  Calendar, Clock, ShieldAlert, ChevronDown, UserCheck, School,
  Lock, ArrowRight, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, toPersianDigits } from '../../utils/persian';

// School Insignia Logo SVG
export const SchoolLogo: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 36 }) => (
  <div className={cn('relative flex items-center justify-center shrink-0', className)}>
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#2457C5" />
      {/* Stylized open book / wings of wisdom emblem */}
      <path d="M12 34C16 33 21 33 24 36C27 33 32 33 36 34V16C32 15 27 15 24 18C21 15 16 15 12 16V34Z" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 18V36" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 10L27 13L24 16L21 13L24 10Z" fill="#F4B740" />
    </svg>
  </div>
);

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-medium transition-colors cursor-pointer select-none whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2457C5]/40 rounded-xl';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[36px]',
    md: 'text-sm px-4 py-2 gap-2 min-h-[44px]',
    lg: 'text-base px-6 py-2.5 gap-2.5 min-h-[48px]',
  };

  const variantStyles = {
    primary: 'bg-[#2457C5] hover:bg-[#1c469f] text-white shadow-sm dark:bg-[#8BAEFF] dark:text-[#101722] dark:hover:bg-[#759eff]',
    secondary: 'bg-[#F0F4FA] hover:bg-[#E2E8F4] text-[#202B3C] dark:bg-[#222F42] dark:text-[#F1F5FB] dark:hover:bg-[#2c3b52]',
    outline: 'border border-[#DCE3EE] hover:bg-[#F0F4FA] text-[#202B3C] dark:border-[#344257] dark:hover:bg-[#222F42] dark:text-[#F1F5FB]',
    danger: 'bg-[#B42318] hover:bg-[#911d13] text-white shadow-sm dark:bg-[#ef4444] dark:hover:bg-[#dc2626]',
    ghost: 'hover:bg-black/5 dark:hover:bg-white/5 text-[#526176] hover:text-[#202B3C] dark:text-[#B3C0D2] dark:hover:text-white',
  };

  return (
    <button
      className={cn(baseStyle, sizeStyles[size], variantStyles[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ml-1" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};

// Card
export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}> = ({ children, className = '', onClick, hoverable = false }) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-[#FFFFFF] dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-2xl p-5 transition-all',
        hoverable && 'hover:border-[#2457C5]/40 dark:hover:border-[#8BAEFF]/40 cursor-pointer shadow-sm hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  );
};

// Badge
export const Badge: React.FC<{
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
  className?: string;
}> = ({ children, variant = 'neutral', className = '' }) => {
  const variantStyles = {
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    danger: 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    primary: 'bg-blue-50 text-[#2457C5] border border-blue-200 dark:bg-blue-950/60 dark:text-[#8BAEFF] dark:border-blue-800',
  };

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap', variantStyles[variant], className)}>
      {children}
    </span>
  );
};

// Tabs
export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
}

export const Tabs: React.FC<{
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}> = ({ tabs, activeId, onChange, className = '' }) => {
  return (
    <div className={cn('flex items-center gap-1 p-1 bg-[#F0F4FA] dark:bg-[#101722] rounded-xl overflow-x-auto no-scrollbar', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer select-none',
              isActive
                ? 'bg-white dark:bg-[#182231] text-[#2457C5] dark:text-[#8BAEFF] shadow-sm'
                : 'text-[#526176] dark:text-[#B3C0D2] hover:text-[#202B3C] dark:hover:text-white'
            )}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={cn(
                'px-1.5 py-0.5 text-[11px] rounded-md tabular-nums',
                isActive ? 'bg-[#2457C5]/10 text-[#2457C5] dark:bg-[#8BAEFF]/20 dark:text-[#8BAEFF]' : 'bg-slate-200 dark:bg-slate-800'
              )}>
                {toPersianDigits(tab.badge)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// Modal
export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}> = ({ isOpen, onClose, title, children, maxWidth = 'lg' }) => {
  if (!isOpen) return null;

  const widthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className={cn('w-full max-h-[calc(100vh-2rem)] overflow-y-auto bg-white dark:bg-[#182231] rounded-2xl border border-[#DCE3EE] dark:border-[#344257] shadow-xl', widthStyles[maxWidth])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DCE3EE] dark:border-[#344257]">
          <h3 className="text-base font-semibold text-[#202B3C] dark:text-[#F1F5FB]">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#526176] hover:bg-[#F0F4FA] dark:hover:bg-[#222F42] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// Confirmation Dialog
export const ConfirmationDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
}> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'تأیید و ثبت',
  confirmVariant = 'primary',
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="space-y-4">
        <p className="text-sm text-[#526176] dark:text-[#B3C0D2] leading-relaxed">{description}</p>
        <div className="flex items-center justify-end gap-3 pt-3">
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button
            variant={confirmVariant}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Search Input
export const SearchInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = 'جستجو...', className = '' }) => {
  return (
    <div className={cn('relative flex items-center min-w-[220px]', className)}>
      <Search className="absolute right-3.5 text-[#526176] dark:text-[#B3C0D2]" size={16} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pr-10 pl-4 py-2 text-sm bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl text-[#202B3C] dark:text-[#F1F5FB] placeholder-[#526176] focus:outline-none focus:ring-2 focus:ring-[#2457C5]/30"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute left-3 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

// Form Field
export const FormField: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, error, children }) => {
  return (
    <div className="space-y-1.5 text-right">
      <label className="block text-xs font-semibold text-[#202B3C] dark:text-[#F1F5FB]">
        {label}
        {required && <span className="text-[#B42318] mr-1">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-[#526176] dark:text-[#B3C0D2]">{hint}</p>}
      {error && <p className="text-[11px] text-[#B42318] dark:text-red-400 font-medium">{error}</p>}
    </div>
  );
};

// Select Component
export const Select: React.FC<{
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}> = ({ value, onChange, options, className = '' }) => {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl pr-3.5 pl-9 py-2 text-sm text-[#202B3C] dark:text-[#F1F5FB] focus:outline-none focus:ring-2 focus:ring-[#2457C5]/30 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 text-[#526176] pointer-events-none" size={16} />
    </div>
  );
};

// Empty State
export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}> = ({ title, description, actionLabel, onAction, icon }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white/60 dark:bg-[#182231]/40 border border-dashed border-[#DCE3EE] dark:border-[#344257] rounded-2xl">
      <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[#F0F4FA] dark:bg-[#222F42] text-[#2457C5] dark:text-[#8BAEFF] mb-3">
        {icon || <AlertCircle size={24} />}
      </div>
      <h4 className="text-sm font-semibold text-[#202B3C] dark:text-[#F1F5FB] mb-1">{title}</h4>
      <p className="text-xs text-[#526176] dark:text-[#B3C0D2] max-w-sm mb-4 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

// Skeleton Placeholder
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return <div className={cn('animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg', className)} />;
};

// Page Header
export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-[#DCE3EE] dark:border-[#344257]">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#202B3C] dark:text-[#F1F5FB] tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-[#526176] dark:text-[#B3C0D2] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
};

// Breadcrumbs
export const Breadcrumbs: React.FC<{
  items: { label: string; href?: string }[];
}> = ({ items }) => {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-[#526176] dark:text-[#B3C0D2] mb-3">
      {items.map((it, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <ChevronRight size={12} className="rotate-180 text-slate-400" />}
          <span className={cn(idx === items.length - 1 ? 'font-semibold text-[#202B3C] dark:text-[#F1F5FB]' : '')}>
            {it.label}
          </span>
        </React.Fragment>
      ))}
    </nav>
  );
};

// Status Indicator
export const StatusIndicator: React.FC<{
  status: 'active' | 'pending' | 'restricted' | 'completed';
  label: string;
}> = ({ status, label }) => {
  const configs = {
    active: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200',
    pending: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200',
    restricted: 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200',
    completed: 'text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200',
  };

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border', configs[status])}>
      {label}
    </span>
  );
};

// Visual Access Denied Gate for restricted pages
export const AccessDeniedGate: React.FC<{
  title?: string;
  requiredRoleOrPermission?: string;
  reason?: string;
  currentRoleTitle?: string;
}> = ({
  title = 'عدم دسترسی به این بخش',
  requiredRoleOrPermission = 'مجوز مدیریت ارشد یا مسئول اداری',
  reason = 'این صفحه طبق ماتریس دسترسی RBAC سامانه مشاهیر آینده، تنها برای نقش‌های دارای اختیارات قانونی مشخص فعال است.',
  currentRoleTitle,
}) => {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-right">
      <Card className="border-rose-200 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/20 shadow-md">
        <div className="flex flex-col items-center text-center p-6 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/80 text-[#B42318] dark:text-rose-400 flex items-center justify-center shadow-xs border border-rose-200 dark:border-rose-800">
            <Lock size={30} />
          </div>

          <div>
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
              قلمرو دسترسی مسدود است (Access Restricted)
            </span>
            <h2 className="text-xl font-black text-[#202B3C] dark:text-[#F1F5FB] mt-2">{title}</h2>
            <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-1.5 max-w-md leading-relaxed">
              {reason}
            </p>
          </div>

          <div className="w-full bg-white dark:bg-[#182231] border border-rose-200/80 dark:border-rose-900/60 rounded-2xl p-4 text-right text-xs space-y-2">
            {currentRoleTitle && (
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[#526176] dark:text-[#B3C0D2]">نقش فعال شما:</span>
                <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">{currentRoleTitle}</span>
              </div>
            )}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[#526176] dark:text-[#B3C0D2]">مجوز مورد نیاز:</span>
              <span className="font-mono text-rose-700 dark:text-rose-400 font-semibold">{requiredRoleOrPermission}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#526176] dark:text-[#B3C0D2]">سیاست امنیتی:</span>
              <span className="text-amber-700 dark:text-amber-400 font-medium">حفاظت از حریم خصوصی و اصل حداقل دسترسی</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
              icon={<ArrowRight size={14} className="rotate-180" />}
            >
              بازگشت به داشبورد مجاز
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Visual Role Permission Badge for headers and page cards
export const RolePermissionBadge: React.FC<{
  level: 'full' | 'view_only' | 'restricted' | 'special';
  scopeLabel?: string;
}> = ({ level, scopeLabel }) => {
  const configs = {
    full: {
      text: 'دسترسی کامل (ثبت و ویرایش)',
      className: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
      icon: <CheckCircle2 size={13} className="text-emerald-600" />,
    },
    view_only: {
      text: 'دسترسی فقط‌خواندنی (مشاهده)',
      className: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
      icon: <ShieldCheck size={13} className="text-blue-600" />,
    },
    restricted: {
      text: 'دسترسی محدودشده قانونی',
      className: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
      icon: <ShieldAlert size={13} className="text-amber-600" />,
    },
    special: {
      text: 'دسترسی اجرایی و گیت',
      className: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
      icon: <Lock size={13} className="text-purple-600" />,
    },
  };

  const current = configs[level];

  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border', current.className)}>
      {current.icon}
      <span>{current.text}</span>
      {scopeLabel && <span className="font-normal opacity-80">({scopeLabel})</span>}
    </div>
  );
};
