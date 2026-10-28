import React, { useEffect, useState } from 'react';
import { Video, Plus, LogIn, X, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader } from '../components/common';
import { toPersianDigits } from '../utils/persian';
import { api, ApiError } from '../api/client';

/**
 * کلاس آنلاین بر بستر اسکای‌روم: معلم/مدیر برمی‌دارد، همه با لینک مستقیم
 * وارد می‌شوند. برای دمو درایور fake فعال است؛ با SKYROOM_DRIVER=skyroom و
 * SKYROOM_URL واقعی به سرویس اصلی وصل می‌شود.
 */

interface OnlineClassRow {
  ulid: string;
  title: string;
  subject: string | null;
  classroom: string | null;
  status: 'active' | 'closed';
}

export const OnlineClassesPage: React.FC = () => {
  const { hasAccess } = useAuth();
  const canCreate = hasAccess('online_classes:create');
  const canManage = hasAccess('online_classes:manage');

  const [classes, setClasses] = useState<OnlineClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [subjects, setSubjects] = useState<{ id: number; label: string }[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    api<{ data: OnlineClassRow[] }>('/v1/online-classes')
      .then((r) => setClasses(r.data ?? []))
      .catch((e) => setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت کلاس‌ها'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const openCreate = () => {
    setTitle('');
    setFormError(null);
    api<{ data: { id: number; subject: string; classroom: string }[] }>('/v1/academic/my-subjects')
      .then((r) => {
        setSubjects((r.data ?? []).map((s) => ({ id: s.id, label: s.subject + ' — ' + s.classroom })));
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
    setSaving(true);
    try {
      await api('/v1/online-classes', {
        method: 'POST',
        body: { classroom_subject_id: subjectId, title },
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
        title="کلاس‌های آنلاین (اسکای‌روم)"
        subtitle="برگزاری کلاس زنده با ورود مستقیم از همین‌جا — بدون نیاز به حساب جداگانه اسکای‌روم"
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
          {classes.map((c) => (
            <Card key={c.ulid} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold">{c.title}</h3>
                  <Badge variant={c.status === 'active' ? 'success' : 'neutral'}>
                    {c.status === 'active' ? 'فعال' : 'بسته‌شده'}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {[c.subject, c.classroom].filter(Boolean).join(' — ')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.status === 'active' && (
                  <Button variant="primary" size="sm" onClick={() => enterClass(c.ulid)} icon={<LogIn size={13} />}>
                    ورود به کلاس
                  </Button>
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
          ))}
        </div>
      )}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="برگزاری کلاس آنلاین جدید">
        <div className="space-y-4">
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
