import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Printer, Users, AlertCircle, Loader2, FileText, Calendar, Layers,
  Search, CheckSquare, Square, ShieldCheck, Info,
} from 'lucide-react';
import {
  Card, Button, Badge, PageHeader, EmptyState, AccessDeniedGate, RolePermissionBadge, Tabs,
} from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { formatJalaliDateTime } from '../utils/jalali';
import { ApiReportCardService, ApiReportCardPrintService, ReportCardRow } from '../api/data';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

/** Server-side cap of one print document (ReportCardSheetService::MAX_SHEETS). */
const SHEET_CAP = 60;

const KIND_LABEL: Record<string, string> = {
  in_person: 'حضوری',
  online: 'آنلاین و مستمر',
};

interface LearnerRow {
  key: string;
  ulid: string | null;
  name: string;
  cards: ReportCardRow[];
  lastPublished: string | null;
}

export const ReportCardPrintPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();

  // The bulk console is a staff tool: students and guardians hold export_pdf
  // only for their own card's «چاپ نسخه رسمی» button, never for this page.
  const isStaff = activeRole.group === 'school_admin' || activeRole.group === 'platform' || activeRole.group === 'faculty';
  const canPrint = isStaff && hasAccess('reportcards:export_pdf');

  const [cards, setCards] = useState<ReportCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'in_person' | 'online'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCards(await ApiReportCardService.list());
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت کارنامه‌ها');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canPrint) load();
    else setLoading(false);
  }, [canPrint, load]);

  // The printer only knows published sheets; drafts stay on the screen.
  const learners = useMemo(() => {
    const map = new Map<string, LearnerRow>();
    cards
      .filter((c) => c.status === 'published')
      .forEach((c) => {
        const key = c.studentUlid ?? c.studentName;
        const row = map.get(key) ?? { key, ulid: c.studentUlid, name: c.studentName, cards: [], lastPublished: null };
        row.cards.push(c);
        if (c.publishedAt && (!row.lastPublished || c.publishedAt > row.lastPublished)) row.lastPublished = c.publishedAt;
        map.set(key, row);
      });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  }, [cards]);

  const filtered = useMemo(
    () =>
      learners.filter(
        (l) =>
          (kind === 'all' || l.cards.some((c) => c.kind === kind)) &&
          (query.trim() === '' || l.name.includes(query.trim())),
      ),
    [learners, kind, query],
  );

  // A selection is kept across filtering, but only printable rows are counted.
  const printableKeys = useMemo(
    () => new Set(filtered.filter((l) => l.ulid !== null).map((l) => l.key)),
    [filtered],
  );

  const selectedPrintable = useMemo(
    () => Array.from(selected).filter((key) => printableKeys.has(key)),
    [selected, printableKeys],
  );

  const selectedSheets = useMemo(
    () =>
      filtered
        .filter((l) => selected.has(l.key) && l.ulid !== null)
        .reduce((sum, l) => sum + l.cards.filter((c) => kind === 'all' || c.kind === kind).length, 0),
    [filtered, selected, kind],
  );

  const headRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!headRef.current) return;
    headRef.current.checked = printableKeys.size > 0 && selectedPrintable.length === printableKeys.size;
    headRef.current.indeterminate = selectedPrintable.length > 0 && selectedPrintable.length < printableKeys.size;
  }, [printableKeys, selectedPrintable]);

  const openDocument = async (path: Promise<string>, label: string) => {
    setBusy(label);
    setNotice(null);
    try {
      const url = await path;
      const tab = window.open(url, '_blank');
      if (!tab) {
        setNotice('مرورگر تب جدید را بست؛ پنجره‌های پاپ‌آپ را برای این سایت اجازه دهید.');
      }
    } catch (e) {
      setNotice(e instanceof ApiError ? e.firstError() : 'خطا در تولید سند چاپ');
    } finally {
      setBusy(null);
    }
  };

  const printSelection = () =>
    openDocument(
      ApiReportCardPrintService.bundle({
        students: selectedPrintable.map((key) => learners.find((l) => l.key === key)?.ulid as string),
        kind: kind === 'all' ? undefined : kind,
      }),
      'selection',
    );

  const printAll = () =>
    openDocument(
      ApiReportCardPrintService.bundle({ all: true, kind: kind === 'all' ? undefined : kind }),
      'all',
    );

  const printOne = (ulid: string) =>
    openDocument(ApiReportCardPrintService.bundle({ students: [ulid] }), `student:${ulid}`);

  if (!canPrint) {
    return (
      <AccessDeniedGate
        title="عدم دسترسی به چاپ رسمی کارنامه"
        requiredRoleOrPermission="reportcards.export_pdf"
        reason="چاپ گروهی ابزار کادر آموزشی (مدیر و معاونت) است. دانش‌آموز و ولی نسخهٔ رسمی کارنامهٔ خود را از دکمهٔ «چاپ نسخه رسمی» در صفحهٔ کارنامه صادر می‌کنند، نه از این کنسول."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="چاپ دسته‌جمعی کارنامه‌ها"
        subtitle="قالب ثابت A4 — یک برگه برای هر دانش‌آموز، آماده چاپ یا ذخیره به‌صورت PDF"
        actions={
          <div className="flex items-center gap-2">
            <RolePermissionBadge level="full" scopeLabel="صدور سند رسمی کارنامه" />
            <Button
              variant="outline"
              size="sm"
              icon={<Layers size={15} />}
              onClick={printAll}
              loading={busy === 'all'}
            >
              چاپ همهٔ کارنامه‌های منتشرشده
            </Button>
          </div>
        }
      />

      <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
        <div className="flex items-start gap-3 text-xs leading-relaxed text-blue-900 dark:text-blue-200">
          <Info size={17} className="shrink-0 mt-0.5" />
          <p>
            همهٔ برگه‌ها از یک قالب ثابت صادر می‌شوند: سربرگ مدرسه، مشخصات دانش‌آموز، جدول نمره با ستون
            «نمره خام»، «نمره از {toPersianDigits(20)}»، سطح توصیفی و توضیح دبیر، خلاصهٔ میانگین، و کادر
            مهر و امضا. فقط کارنامه‌های <b>منتشرشده</b> چاپ می‌شوند و پیش‌نویس هرگز روی کاغذ نمی‌آید؛
            سقف هر سند {toPersianDigits(SHEET_CAP)} برگه است.
          </p>
        </div>
      </Card>

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
              <AlertCircle size={15} />
              <span className="font-bold">{error}</span>
            </div>
            <Button variant="primary" size="sm" onClick={load}>تلاش دوباره</Button>
          </div>
        </Card>
      )}

      {notice && (
        <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle size={15} />
            <span className="font-bold">{notice}</span>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={30} className="animate-spin text-[#2457C5]" />
        </div>
      ) : learners.length === 0 ? (
        <Card>
          <EmptyState
            title="کارنامه منتشرشده‌ای برای چاپ وجود ندارد"
            description="پس از تأیید نمرات توسط معاونت آموزشی و انتشار رسمی، برگه‌ها در این صفحه قابل انتخاب و چاپ می‌شوند."
          />
        </Card>
      ) : (
        <>
          <Tabs
            tabs={[
              { id: 'all', label: `همهٔ أنواع (${toPersianDigits(learners.length)})` },
              { id: 'in_person', label: 'آزمون‌های حضوری' },
              { id: 'online', label: 'سنجش آنلاین' },
            ]}
            activeId={kind}
            onChange={(id) => setKind(id as typeof kind)}
          />

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                <input
                  ref={headRef}
                  type="checkbox"
                  className="w-4 h-4 accent-[#2457C5] cursor-pointer"
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) printableKeys.forEach((k) => next.add(k));
                    else printableKeys.forEach((k) => next.delete(k));
                    setSelected(next);
                  }}
                />
                انتخاب همه در این نمای فیلترشده
              </label>

              <div className="relative">
                <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="جست‌وجوی نام دانش‌آموز"
                  className="w-56 pe-3 ps-8 py-2 text-xs rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#101722] text-[#202B3C] dark:text-[#F1F5FB]"
                />
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#DCE3EE] dark:border-[#344257] text-[#526176] dark:text-[#B3C0D2]">
                    <th className="pb-2.5 pr-2 font-medium w-10"></th>
                    <th className="pb-2.5 font-medium">دانش‌آموز</th>
                    <th className="pb-2.5 font-medium text-center">برگه‌های منتشرشده</th>
                    <th className="pb-2.5 font-medium">آخرین ابلاغ</th>
                    <th className="pb-2.5 font-medium text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE3EE]/60 dark:divide-[#344257]/60">
                  {filtered.map((row) => {
                    const checked = selected.has(row.key);
                    return (
                      <tr key={row.key} className={cn('transition-colors', checked && 'bg-blue-50/60 dark:bg-blue-950/20')}>
                        <td className="py-2.5 pr-2">
                          <input
                            type="checkbox"
                            disabled={row.ulid === null}
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(selected);
                              if (e.target.checked) next.add(row.key);
                              else next.delete(row.key);
                              setSelected(next);
                            }}
                            className="w-4 h-4 accent-[#2457C5] cursor-pointer disabled:cursor-not-allowed"
                            aria-label={`انتخاب ${row.name}`}
                          />
                        </td>
                        <td className="py-2.5 font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                          {row.name}
                          <span className="block mt-0.5 text-[11px] font-normal text-[#526176] dark:text-[#B3C0D2]">
                            {row.cards.map((c) => KIND_LABEL[c.kind] ?? c.kind).join(' + ')}
                            {' · '}
                            نسخه {toPersianDigits(Math.max(...row.cards.map((c) => c.version)))}
                          </span>
                        </td>
                        <td className="py-2.5 text-center">
                          <Badge variant="primary">
                            <FileText size={12} />
                            {toPersianDigits(row.cards.length)}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-[#526176] dark:text-[#B3C0D2]">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={13} />
                            {row.lastPublished ? formatJalaliDateTime(row.lastPublished) : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Printer size={14} />}
                            disabled={row.ulid === null}
                            loading={busy === `student:${row.ulid}`}
                            onClick={() => row.ulid && printOne(row.ulid)}
                          >
                            چاپ تکی
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        با این فیلترها دانش‌آموزی با کارنامهٔ منتشرشده پیدا نشد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 pt-4 border-t border-[#DCE3EE] dark:border-[#344257] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-[#526176] dark:text-[#B3C0D2]">
                <span className="flex items-center gap-1.5">
                  <Users size={15} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                  {toPersianDigits(selectedPrintable.length)} دانش‌آموز انتخاب شده
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText size={15} className="text-[#2457C5] dark:text-[#8BAEFF]" />
                  {toPersianDigits(selectedSheets)} برگه چاپ می‌شود
                </span>
                {selectedSheets > SHEET_CAP && (
                  <Badge variant="warning">
                    <AlertCircle size={12} />
                    بیش از {toPersianDigits(SHEET_CAP)} برگه؛ سرور سند را برمی‌گرداند اما فقط {toPersianDigits(SHEET_CAP)} برگهٔ اول
                  </Badge>
                )}
              </div>

              <Button
                variant="primary"
                icon={selectedPrintable.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                disabled={selectedPrintable.length === 0}
                loading={busy === 'selection'}
                onClick={printSelection}
              >
                چاپ دسته‌جمعی ({toPersianDigits(selectedPrintable.length)} دانش‌آموز)
              </Button>
            </div>
          </Card>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck size={13} />
            دامنهٔ دسترسی در بک‌اند اعمال می‌شود: آنچه در این جدول می‌بینید، همان چیزی است که قابل چاپ هم هست.
          </div>
        </>
      )}
    </div>
  );
};
