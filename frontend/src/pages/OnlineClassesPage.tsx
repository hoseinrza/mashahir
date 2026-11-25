import React, { useEffect, useState } from 'react';
import { Video, Plus, LogIn, X, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader } from '../components/common';
import { JalaliDateTimePicker } from '../components/common/JalaliDatePicker';
import { toPersianDigits } from '../utils/persian';
import { formatJalaliDateTime, jalaliPreview } from '../utils/jalali';
import { api, ApiError } from '../api/client';

/**
 * کلاس آنلاین بر بستر اسکای‌روم: معلم/مدیر برمی‌دارد، همه با لینک مستقیم و با
 * نام واقعی خودشان وارد می‌شوند (نقش معلم = ارائه‌دهنده). کلاس می‌تواند
 * زمان‌بندی داشته باشد؛ ورود فقط داخل پنجره‌ی زمانی آن باز است. برای دمو
 * درایور fake فعال است؛ با SKYROOM_DRIVER=skyroom و SKYROOM_URL واقعی به
 * سرویس اصلی وصل می‌شود.
 */

type Availability = 'open' | 'scheduled' | 'ended' | 'closed';

interface OnlineClassRow {
  ulid: string;
  title: string;
  provider: 'skyroom' | 'alocom';
  subject: string | null;
  classroom: string | null;
  teacher: string | null;
  status: 'active' | 'closed';
  availability: Availability;
  starts_at: string | null;
  ends_at: string | null;
}

const PROVIDER_LABEL: Record<OnlineClassRow['provider'], string> = {
  skyroom: 'اسکای‌روم',
  alocom: 'الوکام',
};

const AVAILABILITY_META: Record<Availability, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  open: { label: 'باز', variant: 'success' },
  scheduled: { label: 'زمان‌بندی‌شده', variant: 'warning' },
  ended: { label: 'تمام‌شده', variant: 'neutral' },
  closed: { label: 'بسته‌شده', variant: 'neutral' },
};

/** مقدار پیش‌فرض datetime-local: همین ساعت گردشده به دقیقه بعدی. */
const defaultStartLocal = (): string => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const OnlineClassesPage: React.FC = () => {
  const { hasAccess } = useAuth();
  const canCreate = hasAccess('online_classes:create');
  const canManage = hasAccess('online_classes:manage');

  const [classes, setClasses] = useState<OnlineClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The school holds Alocom credentials — the provider option lights up.
  const [alocomReady, setAlocomReady] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [subjects, setSubjects] = useState<{ id: number; label: string }[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [startLocal, setStartLocal] = useState(defaultStartLocal);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [provider, setProvider] = useState<'skyroom' | 'alocom'>('skyroom');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    api<{ data: OnlineClassRow[]; alocom_ready: boolean }>('/v1/online-classes')
      .then((r) => { setClasses(r.data ?? []); setAlocomReady(Boolean(r.alocom_ready)); })
      .catch((e) => setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت کلاس‌ها'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const openCreate = () => {
    setTitle('');
    setStartLocal(defaultStartLocal());
    setDurationMinutes(60);
    // Alocom is the default when the school connected its account.
    setProvider(alocomReady ? 'alocom' : 'skyroom');
    setFormError(null);
    api<{ data: { id: number; subject: string; classroom: string; teacher?: string | null }[] }>('/v1/academic/my-subjects')
      .then((r) => {
        setSubjects((r.data ?? []).map((s) => ({
          id: s.id,
          label: s.subject + ' — ' + s.classroom + (s.teacher ? ' — ' + s.teacher : ''),
        })));
        setSubjectId(r.data?.[0]?.id ?? null);
      })
      .catch(() => setSubjects([]));
    setIsCreateOpen(true);
  };

  const createClass = async () => {
    setFormError(null);
    if (!title || subjectId === null) {
      setFormError('عنوان و درس-کلاس الزامی است.');
      return;
    }
    const start = new Date(startLocal);
    if (Number.isNaN(start.getTime())) {
      setFormError('زمان شروع نامعتبر است.');
      return;
    }
    setSaving(true);
    try {
      await api('/v1/online-classes', {
        method: 'POST',
        body: {
          classroom_subject_id: subjectId,
          title,
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + durationMinutes * 60 * 1000).toISOString(),
          provider,
        },
      });
      setIsCreateOpen(false);
      reload();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.firstError() : 'خطا در برگزاری کلاس');
    } finally {
      setSaving(false);
    }
  };

  const enterClass = async (ulid: string) => {
    setError(null);
    try {
      const r = await api<{ url: string }>('/v1/online-classes/' + ulid + '/enter');
      window.open(r.url, '_blank', 'noopener');
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در ورود به کلاس');
    }
  };

  const closeClass = async (ulid: string) => {
    try {
      await api('/v1/online-classes/' + ulid + '/close', { method: 'POST' });
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا');
    }
  };

  const deleteClass = async (ulid: string) => {
    try {
      await api('/v1/online-classes/' + ulid, { method: 'DELETE' });
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="کلاس‌های آنلاین"
        subtitle={canManage
          ? 'ایجاد، مدیریت و ورود به کلاس‌های آنلاین مدرسه — بر بستر الوکام یا اسکای‌روم، با ورود مستقیم و بدون حساب جداگانه'
          : canCreate
            ? 'برگزاری کلاس زنده برای درس‌کلاس‌های خودتان — بر بستر الوکام یا اسکای‌روم، با ورود مستقیم'
            : 'کلاس‌های آنلاین کلاس شما — دکمه ورود در بازه برگزاری کلاس فعال می‌شود'}
      />

      <div className="flex justify-end">
        {canCreate && (
          <Button onClick={openCreate} icon={<Plus size={15} />}>برگزاری کلاس آنلاین</Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={26} className="animate-spin text-[#2457C5]" /></div>
      ) : classes.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          هنوز کلاس آنلاینی برگزار نشده است.
        </Card>
      ) : (
        <div className="grid gap-4">
          {classes.map((c) => {
            const meta = AVAILABILITY_META[c.availability] ?? AVAILABILITY_META.closed;
            const enterable = c.availability === 'open';
            return (
              <Card key={c.ulid} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold">{c.title}</h3>
                    <Badge variant={c.provider === 'alocom' ? 'primary' : 'neutral'}>{PROVIDER_LABEL[c.provider] ?? c.provider}</Badge>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {[c.subject, c.classroom, c.teacher].filter(Boolean).join(' — ')}
                  </p>
                  {(c.starts_at || c.ends_at) && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock size={11} />
                      {c.starts_at ? formatJalaliDateTime(c.starts_at) : '—'}
                      {c.ends_at ? ' تا ' + formatJalaliDateTime(c.ends_at) : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {enterable ? (
                    <Button variant="primary" size="sm" onClick={() => enterClass(c.ulid)} icon={<LogIn size={13} />}>
                      ورود به کلاس
                    </Button>
                  ) : c.availability === 'scheduled' && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                      ورود از زمان شروع باز می‌شود
                    </span>
                  )}
                  {canManage && (
                    <>
                      {c.status === 'active' && (
                        <Button variant="outline" size="sm" onClick={() => closeClass(c.ulid)}>بستن</Button>
                      )}
                      <Button variant="danger" size="sm" onClick={() => deleteClass(c.ulid)} icon={<X size={13} />}>حذف</Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="برگزاری کلاس آنلاین جدید">
        <div className="space-y-4">
          <FormField label="بستر برگزاری" required>
            <select value={provider} onChange={(e) => setProvider(e.target.value as 'skyroom' | 'alocom')}
              className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none">
              <option value="alocom">الوکام{alocomReady ? '' : ' — اتصال مدرسه برقرار نیست'}</option>
              <option value="skyroom">اسکای‌روم</option>
            </select>
          </FormField>
          <FormField label="درس و کلاس" required>
            <select value={subjectId ?? ''} onChange={(e) => setSubjectId(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none">
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </FormField>
          <FormField label="عنوان کلاس" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً کلاس آنلاین ریاضی — فصل ۲"
              className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none focus:ring-2 focus:ring-[#2457C5]/40" />
          </FormField>
          <FormField label="زمان شروع" required>
            <div className="space-y-1">
              <JalaliDateTimePicker value={startLocal} onChange={setStartLocal} />
              {jalaliPreview(startLocal) && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">شروع: {jalaliPreview(startLocal)}</p>
              )}
            </div>
          </FormField>
          <FormField label="مدت کلاس">
            <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border border-[#DCE3EE] dark:border-[#223147] bg-white dark:bg-[#131C2E] text-sm outline-none">
              <option value={45}>{toPersianDigits(45)} دقیقه</option>
              <option value={60}>{toPersianDigits(60)} دقیقه</option>
              <option value={90}>{toPersianDigits(90)} دقیقه</option>
              <option value={120}>{toPersianDigits(120)} دقیقه</option>
            </select>
          </FormField>
          {formError && (
            <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
              <AlertTriangle size={14} /> {formError}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>انصراف</Button>
          <Button onClick={createClass} disabled={saving} icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}>
            برگزاری
          </Button>
        </div>
      </Modal>
    </div>
  );
};
