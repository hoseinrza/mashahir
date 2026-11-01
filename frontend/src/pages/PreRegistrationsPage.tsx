import React, { useCallback, useEffect, useState } from 'react';
import {
  ClipboardList, Phone, Trophy, Hash, CalendarClock, RefreshCw,
  Inbox, CheckCircle2, Users, Sparkles, School,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Card, Button, Badge, PageHeader, AccessDeniedGate, Tabs, Modal, EmptyState, FormField,
} from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import {
  AdmissionsApi, PreRegistrationRow, PreRegistrationStats,
  PRE_REGISTRATION_STATUS_TITLES, gradeLabel,
} from '../api/admissions';

const STATUS_BADGE: Record<string, 'primary' | 'neutral' | 'success' | 'warning' | 'danger'> = {
  new: 'primary',
  contacted: 'neutral',
  exam_scheduled: 'warning',
  accepted: 'success',
  waitlist: 'warning',
  rejected: 'danger',
};

const STATUS_TABS = [
  { id: 'all', label: 'همه درخواست‌ها' },
  { id: 'new', label: 'جدید' },
  { id: 'contacted', label: 'تماس اولیه' },
  { id: 'exam_scheduled', label: 'وقت آزمون' },
  { id: 'accepted', label: 'پذیرفته‌شده' },
  { id: 'waitlist', label: 'لیست انتظار' },
  { id: 'rejected', label: 'ردشده' },
];

function formatJalali(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export const PreRegistrationsPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();
  const isAuthorized = hasAccess('preregistrations:view') || activeRole.group === 'school_admin';

  const [rows, setRows] = useState<PreRegistrationRow[] | null>(null);
  const [stats, setStats] = useState<PreRegistrationStats | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<PreRegistrationRow | null>(null);
  const [editStatus, setEditStatus] = useState('new');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await AdmissionsApi.list(status);
      setRows(result.data ?? []);
      setStats(result.stats ?? null);
    } catch {
      setLoadError('بارگذاری درخواست‌های پیش‌ثبت‌نام ناموفق بود؛ اتصال به سرور مدرسه را بررسی کنید.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) void load(statusFilter);
  }, [isAuthorized, statusFilter, load]);

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="مشاهده درخواست‌های پیش‌ثبت‌نام لندینگ مدرسه"
        requiredRoleOrPermission="preregistrations:view (مدیر مدرسه یا مسئول دفتر)"
        reason="درخواست‌های ثبت‌شده در فرم عمومی پیش‌ثبت‌نام، داده پذیرش مدرسه است و تنها برای مدیر و مسئول دفتر نمایش داده می‌شود."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const openEdit = (row: PreRegistrationRow) => {
    setEditing(row);
    setEditStatus(row.status);
    setEditNotes(row.admin_notes ?? '');
    setSaveError(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await AdmissionsApi.update(editing.ulid, {
        status: editStatus,
        admin_notes: editNotes.trim() || null,
      });
      setRows((prev) => (prev ?? []).map((r) => (r.ulid === result.data.ulid ? result.data : r)));
      setEditing(null);
      void load(statusFilter);
    } catch {
      setSaveError('ذخیره تغییرات ناموفق بود؛ دوباره تلاش کنید.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="پیش‌ثبت‌نام‌های پذیرش لندینگ مدرسه"
        subtitle="درخواست‌های ثبت‌شده در فرم عمومی وب‌سایت — مستقیماً به چرخه پذیرش شما می‌آیند"
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
            onClick={() => void load(statusFilter)}
          >
            به‌روزرسانی
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کل درخواست‌ها</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {toPersianDigits(stats?.total ?? 0)}
            </span>
            <ClipboardList size={18} className="text-slate-300 dark:text-slate-600" />
          </div>
        </Card>
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">در انتظار بررسی (جدید)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {toPersianDigits(stats?.new ?? 0)}
            </span>
            <Inbox size={18} className="text-blue-200 dark:text-blue-900" />
          </div>
        </Card>
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">ثبت‌شده امروز</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {toPersianDigits(stats?.today ?? 0)}
            </span>
            <CalendarClock size={18} className="text-amber-200 dark:text-amber-900" />
          </div>
        </Card>
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پذیرفته‌شده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {toPersianDigits(stats?.accepted ?? 0)}
            </span>
            <CheckCircle2 size={18} className="text-emerald-200 dark:text-emerald-900" />
          </div>
        </Card>
      </div>

      {/* Status filter */}
      <Tabs
        tabs={STATUS_TABS}
        activeId={statusFilter}
        onChange={setStatusFilter}
        className="w-fit max-w-full"
      />

      {/* List */}
      {loadError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300 text-right">
          {loadError}
        </div>
      )}

      {rows === null || loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse bg-slate-200/70 dark:bg-slate-800/50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Inbox size={24} />}
          title="درخواستی در این وضعیت نیست"
          description="با انتشار لندینگ مدرسه، فرم‌های پرشده اولیا بلافاصله همین‌جا نمایش داده می‌شوند."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.ulid} className="text-right" hoverable>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Identity */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={cn(
                      'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-black',
                      row.has_honor
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                        : 'bg-[#F0F4FA] dark:bg-[#222F42] text-[#2457C5] dark:text-[#8BAEFF]',
                    )}
                  >
                    {row.has_honor ? <Trophy size={20} /> : <School size={20} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-black">{row.student_name}</strong>
                      <Badge variant={STATUS_BADGE[row.status] ?? 'neutral'}>{row.status_title}</Badge>
                      {row.has_honor && (
                        <Badge variant="warning">
                          <Sparkles size={12} />
                          استعداد درخشان
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-1.5">
                      {gradeLabel(row.grade)}
                      {row.current_school ? ` · ${row.current_school}` : ''}
                      {row.last_gpa ? ` · معدل ${toPersianDigits(row.last_gpa)}` : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-[#526176] dark:text-[#8DA0BE]">
                      <span className="inline-flex items-center gap-1.5" dir="ltr">
                        <Phone size={13} className="rotate-90" />
                        <span className="font-mono">{toPersianDigits(row.parent_phone)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Hash size={13} />
                        <span className="font-mono">{row.tracking_code}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock size={13} />
                        {formatJalali(row.created_at)}
                      </span>
                    </div>
                    {row.has_honor && row.honor_desc && (
                      <p className="mt-2 text-[11px] p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-900/50 text-amber-800 dark:text-amber-300">
                        افتخار: {row.honor_desc}
                      </p>
                    )}
                    {row.admin_notes && (
                      <p className="mt-2 text-[11px] text-[#526176] dark:text-[#B3C0D2]">
                        یادداشت دبیرخانه: <span className="font-semibold">{row.admin_notes}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => openEdit(row)}>
                    بررسی و تغییر وضعیت
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title="بررسی درخواست پیش‌ثبت‌نام">
        {editing && (
          <div className="space-y-5 text-right">
            <div className="p-3.5 rounded-xl bg-[#F7F9FC] dark:bg-[#101722] border border-[#DCE3EE] dark:border-[#344257] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#526176] dark:text-[#B3C0D2]">دانش‌آموز:</span>
                <strong>{editing.student_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#526176] dark:text-[#B3C0D2]">پایه / رشته:</span>
                <strong>{gradeLabel(editing.grade)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#526176] dark:text-[#B3C0D2]">موبایل ولی:</span>
                <strong className="font-mono" dir="ltr">{toPersianDigits(editing.parent_phone)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#526176] dark:text-[#B3C0D2]">کد رهگیری:</span>
                <strong className="font-mono">{editing.tracking_code}</strong>
              </div>
              {editing.has_honor && editing.honor_desc && (
                <div className="flex justify-between gap-4">
                  <span className="text-[#526176] dark:text-[#B3C0D2] shrink-0">افتخار:</span>
                  <strong className="text-left">{editing.honor_desc}</strong>
                </div>
              )}
            </div>

            <FormField label="وضعیت در چرخه پذیرش" required>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(PRE_REGISTRATION_STATUS_TITLES).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setEditStatus(value)}
                    className={cn(
                      'p-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer',
                      editStatus === value
                        ? 'border-[#2457C5] dark:border-[#8BAEFF] bg-blue-50 dark:bg-blue-950/40 text-[#2457C5] dark:text-[#8BAEFF]'
                        : 'border-[#DCE3EE] dark:border-[#344257] text-[#526176] dark:text-[#B3C0D2] hover:border-slate-300',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="یادداشت دبیرخانه (تماس، وقت آزمون و ...)" hint="این یادداشت در پرونده درخواست ذخیره می‌شود.">
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="مثال: با ولی تماس گرفتیم؛ آزمون هفته دوم آبان ساعت ۱۰"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] text-xs focus:ring-2 focus:ring-[#2457C5]/30 outline-none resize-none text-right"
              />
            </FormField>

            {saveError && (
              <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">{saveError}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                انصراف
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={() => void saveEdit()}>
                ذخیره وضعیت
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
