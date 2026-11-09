import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { School, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, FormField, PageHeader, AccessDeniedGate } from '../components/common';
import { ApiSchoolsService, SchoolRow, SCHOOL_LEVEL_LABEL } from '../api/data';
import { ApiError } from '../api/client';

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

export const CreateSchoolPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();
  const isAuthorized = hasAccess('schools:manage');

  const [name, setName] = useState('');
  const [level, setLevel] = useState<'elementary' | 'middle' | 'high'>('high');
  const [grading, setGrading] = useState<'numeric' | 'descriptive'>('numeric');
  const [timezone, setTimezone] = useState('Asia/Tehran');
  const [studentHasAccount, setStudentHasAccount] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SchoolRow | null>(null);

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی به دفتر مدارس پلتفرم"
        requiredRoleOrPermission="schools:manage (مدیر پلتفرم)"
        reason="ساخت مدرسه، تعیین سطح و نوع ارزشیابی فقط از کنسول مدیر پلتفرم انجام می‌شود."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      const school = await ApiSchoolsService.create({
        name: name.trim(),
        level,
        gradingType: grading,
        timezone,
        studentHasAccount,
      });
      setCreated(school);
      setName('');
    } catch (err) {
      setError(firstError(err, 'خطا در ساخت مدرسه'));
    } finally {
      setIsSaving(false);
    }
  };

  if (created) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="مدرسه با موفقیت ساخته شد"
          subtitle="اکنون می‌توانید مدیر مدرسه را تخصیص دهید و سال تحصیلی را تعریف کنید"
        />

        <Card className="text-right border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{created.name}</h3>
              <p className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                سطح: {SCHOOL_LEVEL_LABEL[created.level] ?? created.level} ·
                {' '}ارزشیابی: {created.gradingType === 'numeric' ? 'نمره‌ای' : 'توصیفی'} ·
                {' '}منطقهٔ زمانی: {created.timezone}
              </p>
              <p className="text-[11px] text-slate-400 font-mono" dir="ltr">{created.ulid}</p>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/dashboard">
            <Button variant="primary" size="sm" icon={<ArrowLeft size={14} />}>بازگشت به کنسول پلتفرم</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setCreated(null)}>ساخت مدرسهٔ دیگر</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="راه‌اندازی مدرسهٔ جدید"
        subtitle="ساخت مدرسه، تعیین سطح تحصیلی، نوع ارزشیابی و منطقهٔ زمانی"
        actions={
          <Link to="/dashboard">
            <Button variant="outline" size="sm" icon={<ArrowLeft size={14} />}>بازگشت به کنسول</Button>
          </Link>
        }
      />

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200 font-bold">
            <AlertCircle size={15} /> {error}
          </div>
        </Card>
      )}

      <Card className="text-right">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="نام مدرسه" required>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: دبیرستان مشاهیر آینده — شعبهٔ شمال"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="سطح تحصیلی" required>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as 'elementary' | 'middle' | 'high')}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              >
                {Object.entries(SCHOOL_LEVEL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="نوع ارزشیابی" required>
              <select
                value={grading}
                onChange={(e) => setGrading(e.target.value as 'numeric' | 'descriptive')}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              >
                <option value="numeric">نمره‌ای (۰ تا ۲۰)</option>
                <option value="descriptive">توصیفی (ابتدایی)</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="منطقهٔ زمانی">
              <input
                type="text"
                dir="ltr"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
              />
            </FormField>

            <label className="flex items-center gap-2 p-2.5 mt-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={studentHasAccount}
                onChange={(e) => setStudentHasAccount(e.target.checked)}
                className="rounded"
              />
              <span>دانش‌آموزان حساب کاربری می‌گیرند</span>
            </label>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>
              پس از ساخت، مدرسه در فهرست کنسول پلتفرم ظاهر می‌شود و می‌توانید با جست‌وجوی نام یا شمارهٔ موبایل،
              مدیر آن را تخصیص دهید. سال تحصیلی و کلاس‌ها را مدیر مدرسه تعریف می‌کند.
            </span>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" icon={<School size={15} />} disabled={isSaving || !name.trim()}>
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : null}
              {isSaving ? 'در حال ساخت…' : 'ساخت مدرسه'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
