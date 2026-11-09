import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield, CheckCircle2, Search, UserCheck, Loader2, AlertCircle,
  RefreshCw, Lock, Scale, XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader, EmptyState } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { ApiUserService, ApiFamilyService, StudentRow, PickupRow, CourtOrderRow, GuardianFlags } from '../../api/data';
import { ApiError } from '../../api/client';

const FLAG_LABELS: Record<keyof GuardianFlags, string> = {
  can_view_grades: 'مشاهده نمرات',
  can_view_attendance: 'حضور و غیاب',
  can_approve_consent: 'امضای رضایت‌نامه',
  can_receive_sms: 'پیامک و اعلان',
  can_pickup: 'تحویل دانش‌آموز',
};

export const SecurityGuardDashboard: React.FC = () => {
  const { currentUser } = useAuth();

  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<StudentRow | null>(null);

  const [pickups, setPickups] = useState<PickupRow[] | null>(null);
  const [orders, setOrders] = useState<CourtOrderRow[] | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ApiUserService.listStudents()
      .then(setStudents)
      .catch((e) => setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت فهرست دانش‌آموزان'));
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    setIsLoadingDetail(true);
    setPickups(null);
    setOrders(null);
    setError(null);

    Promise.all([
      ApiFamilyService.pickups(selected.ulid),
      ApiFamilyService.courtOrders(selected.ulid).then((r) => r.rows).catch(() => []),
    ])
      .then(([pickupRows, orderRows]) => {
        if (cancelled) return;
        setPickups(pickupRows);
        setOrders(orderRows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.firstError() : 'خطا در استعلام پروندهٔ دانش‌آموز');
      })
      .finally(() => { if (!cancelled) setIsLoadingDetail(false); });

    return () => { cancelled = true; };
  }, [selected]);

  const matches = useMemo(() => {
    if (query.trim().length < 2) return [];
    return (students ?? [])
      .filter((s) => s.fullName.includes(query.trim()) || s.code.includes(query.trim()))
      .slice(0, 8);
  }, [students, query]);

  const deniedFlags = (orders ?? []).flatMap((order) =>
    (Object.keys(order.restrictions) as (keyof GuardianFlags)[])
      .filter((key) => order.restrictions[key] === false),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`پایش تردد و انتظامات گیت — ${currentUser.fullName}`}
        subtitle="مسئول حراست و انتظامات دبیرستان · تطبیق مجوزهای ترخیص، شناسایی افراد مجاز و نظارت بر درب اصلی"
      />

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200">
            <AlertCircle size={15} /> <span className="font-bold">{error}</span>
          </div>
        </Card>
      )}

      <Card className="text-right">
        <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-2 flex items-center gap-2">
          <Shield size={16} className="text-[#2457C5]" />
          استعلام فوری گیت خروجی و اشخاص مجاز تحویل دانش‌آموز
        </h3>
        <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mb-3">
          نام یا کد دانش‌آموز را وارد کنید تا فهرست افراد مجاز به تحویل و محدودیت‌های قضایی او نمایش داده شود:
        </p>

        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            placeholder="مثال: پارسا رادمنش یا S01004"
            className="flex-1 text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
          />
        </div>

        {students === null && (
          <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
            <Loader2 size={14} className="animate-spin" /> در حال دریافت فهرست دانش‌آموزان…
          </div>
        )}

        {query.trim().length >= 2 && matches.length === 0 && students !== null && (
          <p className="text-xs text-slate-400 py-3">دانش‌آموزی با این نام یا کد پیدا نشد.</p>
        )}

        {matches.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 border border-[#DCE3EE] dark:border-[#344257] rounded-xl overflow-hidden">
            {matches.map((student) => (
              <button
                key={student.ulid}
                type="button"
                onClick={() => { setSelected(student); setQuery(student.fullName); }}
                className="w-full text-right p-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer flex items-center justify-between"
              >
                <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">{student.fullName}</span>
                <span className="text-slate-400 font-mono">{student.code}</span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="mt-4 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{selected.fullName}</strong>
                <span className="text-slate-500 mr-2">({selected.code})</span>
              </div>
              <Badge variant={deniedFlags.length > 0 ? 'danger' : 'success'}>
                {deniedFlags.length > 0 ? 'محدودیت قضایی فعال' : 'ترخیص طبق فهرست مجاز'}
              </Badge>
            </div>

            {isLoadingDetail ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 size={14} className="animate-spin" /> در حال استعلام…
              </div>
            ) : (
              <>
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">اشخاص مجاز به تحویل فیزیکی:</span>
                  {(pickups ?? []).length === 0 ? (
                    <p className="text-slate-400">فرد مجاز مستقلی ثبت نشده است؛ تحویل تنها به اولیای دارای مجوز پیوند ممکن است.</p>
                  ) : (
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 pr-2">
                      {(pickups ?? []).map((pk) => (
                        <li key={pk.id} className="flex items-center gap-1.5">
                          <UserCheck size={12} className="text-emerald-600" />
                          {pk.fullName}
                          {pk.relation ? ` (${pk.relation})` : ''}
                          <Badge variant={pk.status === 'active' ? 'success' : 'warning'}>
                            {pk.status === 'active' ? 'مجاز' : 'در انتظار تأیید'}
                          </Badge>
                          {pk.locked && <Lock size={11} className="text-rose-500" />}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {deniedFlags.length > 0 && (
                  <div className="p-3 rounded-lg bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-900 font-bold text-[11px] leading-relaxed">
                    <Scale size={12} className="inline ml-1" />
                    حکم قضایی این دسترسی‌ها را سلب کرده است:
                    {' '}
                    {Array.from(new Set(deniedFlags)).map((flag) => FLAG_LABELS[flag]).join('، ')}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      <Card className="text-right">
        <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#2457C5]" />
          راهنمای گیت
        </h3>
        <ul className="text-xs text-[#526176] dark:text-[#B3C0D2] space-y-1.5 list-disc list-inside pr-2">
          <li>تحویل دانش‌آموز فقط به افراد حاضر در فهرست مجاز و اولیای دارای مجوز «تحویل دانش‌آموز» انجام می‌شود.</li>
          <li>اگر برای دانش‌آموز حکم قضایی فعال باشد، حتی ولیِ دارای مجوز هم در صورت سلب حق ترخیص مجاز نیست.</li>
          <li>هر تغییر در فهرست افراد مجاز با دلیل در تاریخچهٔ حساس ثبت می‌شود؛ در مورد مشکوک، پرونده را به دفتر ارجاع دهید.</li>
        </ul>
        <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-400">
          <XCircle size={12} />
          ردیف‌های «در انتظار تأیید» پیشنهاد ناظم هستند و تا تأیید مدرسه معتبر نیستند.
          <RefreshCw size={12} className="mr-auto" />
          برای فهرست کامل، از بخش مدیریت خانواده استفاده کنید.
        </div>
      </Card>
    </div>
  );
};
