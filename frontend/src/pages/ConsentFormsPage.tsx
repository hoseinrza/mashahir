import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, Calendar, Clock, CheckCircle2, XCircle, Check, AlertCircle,
  Users, Plus, Loader2, Inbox, RefreshCw, FileText, ChevronDown, Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, PageHeader, FormField, EmptyState, SearchInput } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { formatJalaliDateTime } from '../utils/jalali';
import { JalaliDateTimePicker } from '../components/common/JalaliDatePicker';
import { ApiConsentService, ApiAcademicService, ConsentRow, ConsentResponseRow } from '../api/data';
import { ApiError } from '../api/client';

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

const POLICY_LABEL: Record<string, string> = {
  one_parent: 'رضایت یکی از اولیا کافی است',
  both_parents: 'رضایت هر دو ولی لازم است',
};

/**
 * The parents' real consent inbox: trips and activities of their children,
 * straight from the API. Approval follows the link's can_approve_consent
 * flag — the server has the final word (court orders included).
 */
const FamilyConsentInbox: React.FC = () => {
  const [rows, setRows] = useState<ConsentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await ApiConsentService.list());
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت رضایت‌نامه‌ها');
      setRows([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const respond = async (row: ConsentRow, decision: 'approved' | 'rejected') => {
    setBusy(row.ulid);
    setError(null);
    setNotice(null);
    try {
      await ApiConsentService.respond(row.ulid, decision);
      setNotice(decision === 'approved' ? 'پاسخ شما (موافقم) به‌عنوان سند رسمی ثبت شد.' : 'پاسخ شما (موافق نیستم) ثبت شد.');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در ثبت پاسخ');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="رضایت‌نامه‌های فرزند — اردوها و فعالیت‌ها"
        subtitle="هر اردو یا فعالیتی که مدرسه برای فرزند شما ثبت می‌کند، همین‌جا برای تأیید یا رد می‌آید"
      />

      {notice && (
        <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={15} /> <span className="font-bold">{notice}</span>
          </div>
        </Card>
      )}
      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200">
            <AlertCircle size={15} /> <span className="font-bold">{error}</span>
          </div>
        </Card>
      )}

      {rows === null ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال دریافت…
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox size={24} />}
            title="رضایت‌نامه‌ای در انتظار شما نیست"
            description="اردوها و فعالیت‌های جدیدی که مدرسه برای فرزند شما ثبت می‌کند، همین‌جا برای تأیید می‌آید."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const decided = row.myDecision !== null;
            return (
              <Card key={row.ulid} className="text-right">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <Badge variant="primary">
                      <Users size={12} /> {row.studentName}
                    </Badge>
                    <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB] truncate">{row.title}</h3>
                  </div>
                  {decided ? (
                    row.myDecision === 'approved'
                      ? <Badge variant="success"><CheckCircle2 size={12} /> موافقم</Badge>
                      : <Badge variant="danger"><XCircle size={12} /> موافق نیستم</Badge>
                  ) : (
                    <Badge variant="warning"><Clock size={12} /> در انتظار تصمیم شما</Badge>
                  )}
                </div>

                {row.body && (
                  <p className="text-xs md:text-sm text-[#526176] dark:text-[#B3C0D2] py-3 leading-relaxed whitespace-pre-line">
                    {row.body}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {row.dueAt ? `مهلت پاسخ: ${formatJalaliDateTime(row.dueAt)}` : 'بدون مهلت مشخص'}
                  </span>
                  <span>
                    {POLICY_LABEL[row.policy] ?? 'سیاست پاسخ مدرسه'}
                    {row.satisfied ? ' — تأمین شده' : ''}
                  </span>
                </div>

                {!decided && !row.satisfied && (
                  <div className="flex items-center justify-end gap-2 pt-3">
                    <Button variant="outline" size="sm" disabled={busy === row.ulid} onClick={() => respond(row, 'rejected')}>
                      <XCircle size={14} /> موافق نیستم
                    </Button>
                    <Button variant="primary" size="sm" disabled={busy === row.ulid} onClick={() => respond(row, 'approved')}>
                      {busy === row.ulid ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} تأیید می‌کنم
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ResponseLine: React.FC<{ response: ConsentResponseRow }> = ({ response }) => (
  <div className="flex items-center justify-between text-[11px] text-[#526176] dark:text-[#B3C0D2] py-1">
    <span className="flex items-center gap-1">
      {response.decision === 'approved'
        ? <CheckCircle2 size={12} className="text-emerald-600" />
        : <XCircle size={12} className="text-rose-600" />}
      {response.decision === 'approved' ? 'موافقت ثبت شد' : 'مخالفت ثبت شد'}
    </span>
    <span className="tabular-nums">{formatJalaliDateTime(response.decidedAt)}</span>
  </div>
);

/** Staff console: open consent requests per learner and read the answers. */
const StaffConsentConsole: React.FC = () => {
  const { hasAccess } = useAuth();
  const canManage = hasAccess('consents:manage');

  const [rows, setRows] = useState<ConsentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<'all' | 'waiting' | 'satisfied'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [students, setStudents] = useState<{ ulid: string; fullName: string }[] | null>(null);
  const [targetStudent, setTargetStudent] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [policy, setPolicy] = useState<'one_parent' | 'both_parents' | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setRows(null);
    setError(null);

    ApiConsentService.list()
      .then((list) => { if (!cancelled) setRows(list); })
      .catch((e) => { if (!cancelled) setError(firstError(e, 'خطا در دریافت رضایت‌نامه‌ها')); });

    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    ApiAcademicService.studentsInScope()
      .then((list) => {
        setStudents(list);
        setTargetStudent((prev) => prev || list[0]?.ulid || '');
      })
      .catch(() => setStudents([]));
  }, []);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      satisfied: all.filter((r) => r.satisfied).length,
      waiting: all.filter((r) => !r.satisfied).length,
    };
  }, [rows]);

  const filtered = (rows ?? []).filter((row) => {
    if (filter === 'waiting' && row.satisfied) return false;
    if (filter === 'satisfied' && !row.satisfied) return false;
    if (searchQuery && !row.title.includes(searchQuery) && !row.studentName.includes(searchQuery)) return false;
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudent || title.trim().length < 3) return;

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await ApiConsentService.create({
        studentUlid: targetStudent,
        title: title.trim(),
        body: body.trim() || undefined,
        dueAt: dueAt || null,
        policy: policy || undefined,
      });

      setIsCreateOpen(false);
      setTitle('');
      setBody('');
      setDueAt('');
      setPolicy('');
      setReloadKey((k) => k + 1);
      setNotice('رضایت‌نامه ثبت شد و برای اولیای این دانش‌آموز اعلان رفت.');
    } catch (err) {
      setError(firstError(err, 'خطا در ثبت رضایت‌نامه'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="رضایت‌نامه‌ها، اردوها و مجوز فعالیت‌های مدرسه"
        subtitle="برای هر دانش‌آموز رضایت‌نامه ثبت کنید؛ پاسخ اولیا بر پایهٔ سیاست مدرسه (یک ولی یا هر دو ولی) و با احتساب احکام قضایی سنجیده می‌شود"
        actions={
          canManage && (
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setIsCreateOpen(true)}>
              ثبت رضایت‌نامهٔ جدید
            </Button>
          )
        }
      />

      {notice && (
        <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
            <Check size={15} /> <span className="font-bold">{notice}</span>
          </div>
        </Card>
      )}

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
            <span className="flex items-center gap-2 font-bold"><AlertCircle size={15} />{error}</span>
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setReloadKey((k) => k + 1)}>
              تلاش دوباره
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <div className="text-lg font-bold text-[#202B3C] dark:text-[#F1F5FB]">{toPersianDigits(stats.total)}</div>
          <div className="text-[11px] text-slate-400">کل رضایت‌نامه‌ها</div>
        </Card>
        <Card className="text-center">
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{toPersianDigits(stats.satisfied)}</div>
          <div className="text-[11px] text-slate-400">تأمین‌شده</div>
        </Card>
        <Card className="text-center">
          <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{toPersianDigits(stats.waiting)}</div>
          <div className="text-[11px] text-slate-400">در انتظار پاسخ</div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DCE3EE] dark:border-[#344257]">
        <div className="flex items-center gap-2">
          {[
            { id: 'all' as const, label: 'همه' },
            { id: 'waiting' as const, label: 'در انتظار پاسخ' },
            { id: 'satisfied' as const, label: 'تأمین‌شده' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                filter === tab.id
                  ? 'bg-[#2457C5] text-white dark:bg-[#8BAEFF] dark:text-[#101722]'
                  : 'bg-white dark:bg-[#182231] text-[#526176] dark:text-[#B3C0D2] border border-[#DCE3EE] dark:border-[#344257]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="جستجو در عنوان یا نام دانش‌آموز..." />
      </div>

      {rows === null ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
            <Loader2 size={18} className="animate-spin" /> در حال دریافت رضایت‌نامه‌ها…
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
            title="رضایت‌نامه‌ای برای نمایش نیست"
            description={
              (rows?.length ?? 0) === 0
                ? 'هنوز رضایت‌نامه‌ای در این مدرسه ثبت نشده است؛ با دکمهٔ «ثبت رضایت‌نامهٔ جدید» نخستین مورد را برای یک دانش‌آموز باز کنید.'
                : 'در این دسته یا با این عبارت جستجو موردی پیدا نشد.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const overdue = !row.satisfied && row.dueAt !== null && new Date(row.dueAt).getTime() < Date.now();
            const open = expanded === row.ulid;

            return (
              <Card key={row.ulid} className="text-right">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <Badge variant="primary"><Users size={12} /> {row.studentName}</Badge>
                    <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{row.title}</h3>
                    {row.satisfied ? (
                      <Badge variant="success"><ShieldCheck size={12} /> تأمین شده</Badge>
                    ) : overdue ? (
                      <Badge variant="danger"><Clock size={12} /> مهلت گذشته</Badge>
                    ) : (
                      <Badge variant="warning"><Clock size={12} /> در انتظار پاسخ</Badge>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : row.ulid)}
                    className="flex items-center gap-1 text-[11px] text-[#2457C5] dark:text-[#8BAEFF] cursor-pointer shrink-0"
                  >
                    {toPersianDigits(row.responses.length)} پاسخ ثبت‌شده
                    <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
                  </button>
                </div>

                {row.body && (
                  <p className="text-xs text-[#526176] dark:text-[#B3C0D2] py-2 leading-relaxed whitespace-pre-line">
                    {row.body}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
                  <span>{POLICY_LABEL[row.policy] ?? 'سیاست پاسخ مدرسه'}</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {row.dueAt ? `مهلت: ${formatJalaliDateTime(row.dueAt)}` : 'بدون مهلت'}
                  </span>
                </div>

                {open && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {row.responses.length === 0 ? (
                      <p className="text-[11px] text-slate-400">هنوز پاسخی از اولیا ثبت نشده است.</p>
                    ) : (
                      row.responses.map((response, index) => (
                        <ResponseLine key={index} response={response} />
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create consent modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="ثبت رضایت‌نامه / مجوز فعالیت" maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4 text-right">
          <FormField label="دانش‌آموز" required>
            <select
              value={targetStudent}
              onChange={(e) => setTargetStudent(e.target.value)}
              required
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              {students === null && <option value="">در حال دریافت فهرست…</option>}
              {students !== null && students.length === 0 && <option value="">دانش‌آموزی در دسترس نیست</option>}
              {(students ?? []).map((s) => <option key={s.ulid} value={s.ulid}>{s.fullName}</option>)}
            </select>
          </FormField>

          <FormField label="عنوان رضایت‌نامه یا اردو" required>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: اردوی علمی موزهٔ علوم"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="توضیحات، مقصد و نکات ایمنی">
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="زمان حرکت، مقصد، وسیلهٔ ایاب و ذهاب و مواردی که ولی باید بداند..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="مهلت پاسخ اولیا">
              <JalaliDateTimePicker value={dueAt} onChange={setDueAt} />
            </FormField>

            <FormField label="سیاست پاسخ">
              <select
                value={policy}
                onChange={(e) => setPolicy(e.target.value as 'one_parent' | 'both_parents' | '')}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              >
                <option value="">پیش‌فرض مدرسه</option>
                <option value="one_parent">رضایت یکی از اولیا</option>
                <option value="both_parents">رضایت هر دو ولی</option>
              </select>
            </FormField>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>با ثبت این مورد، برای همهٔ اولیای دارای پرچم «امضای رضایت‌نامه» اعلان درون‌برنامه‌ای ارسال می‌شود؛ دبیر کلاس فقط اطلاع می‌یابد و به خود رضایت‌نامه دسترسی ندارد.</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || !targetStudent || title.trim().length < 3}>
              {isSaving ? 'در حال ثبت…' : 'ثبت و ارسال برای اولیا'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/** Learners never sign their own consents — the guardian does. */
const StudentConsentNotice: React.FC = () => (
  <div className="space-y-6">
    <PageHeader
      title="رضایت‌نامه‌ها و اردوهای مدرسه"
      subtitle="تأیید یا رد رضایت‌نامه‌های اردو و فعالیت با ولی دانش‌آموز است"
    />
    <Card>
      <EmptyState
        icon={<ShieldCheck size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
        title="این بخش در اختیار ولی شماست"
        description="هر رضایت‌نامه‌ای که مدرسه برای شما ثبت کند، برای تأیید به پنل ولی ارسال می‌شود. نتیجهٔ پاسخ را می‌توانید از اعلان‌های خودتان پیگیری کنید."
      />
    </Card>
  </div>
);

/** Teachers are notified about a trip, never allowed into the consent file. */
const TeacherConsentNotice: React.FC = () => (
  <div className="space-y-6">
    <PageHeader
      title="رضایت‌نامه‌ها و اردوهای مدرسه"
      subtitle="مدیریت و مشاهدهٔ پاسخ رضایت‌نامه‌ها در اختیار مدیر، معاون و دفتر مدرسه است"
    />
    <Card>
      <EmptyState
        icon={<FileText size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
        title="شما از اردو و فعالیت کلاس خود باخبر می‌شوید"
        description="با ثبت هر رضایت‌نامه برای دانش‌آموزان کلاس شما، یک اعلان دریافت می‌کنید؛ اما متن رضایت‌نامه، پاسخ اولیا و اسناد آن در دسترس دبیر نیست."
      />
    </Card>
  </div>
);

export const ConsentFormsPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();

  if (activeRole.group === 'family') return <FamilyConsentInbox />;
  if (activeRole.group === 'student') return <StudentConsentNotice />;

  if (!hasAccess('consents:view_results') && !hasAccess('consents:manage')) {
    return <TeacherConsentNotice />;
  }

  return <StaffConsentConsole />;
};
