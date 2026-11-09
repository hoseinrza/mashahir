import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert, Users, Plus, Scale, Lock, Check, X, Loader2,
  AlertCircle, RefreshCw, UserCheck, Link2Off, CalendarDays, Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, Tabs, PageHeader, AccessDeniedGate, EmptyState } from '../components/common';
import { cn } from '../utils/persian';
import { formatJalaliDate } from '../utils/jalali';
import { JalaliDatePicker } from '../components/common/JalaliDatePicker';
import {
  ApiFamilyService, ApiAcademicService,
  GuardianFlags, GuardianLinkRow, CourtOrderRow, PickupRow, GUARDIAN_LINK_TYPES,
} from '../api/data';
import { ApiError } from '../api/client';

type TabId = 'links' | 'restrictions' | 'pickups';

const FLAG_FIELDS: { key: keyof GuardianFlags; label: string }[] = [
  { key: 'can_view_grades', label: 'مشاهده نمرات و کارنامه' },
  { key: 'can_view_attendance', label: 'مشاهده حضور و غیاب' },
  { key: 'can_approve_consent', label: 'امضای رضایت‌نامه‌ها' },
  { key: 'can_receive_sms', label: 'دریافت پیامک و اعلان' },
  { key: 'can_pickup', label: 'تحویل فیزیکی دانش‌آموز از مدرسه' },
];

const FLAG_LABELS: Record<keyof GuardianFlags, string> = {
  can_view_grades: 'مشاهده نمرات',
  can_view_attendance: 'حضور و غیاب',
  can_approve_consent: 'امضای رضایت‌نامه',
  can_receive_sms: 'پیامک و اعلان',
  can_pickup: 'تحویل دانش‌آموز',
};

const EMPTY_FLAGS: GuardianFlags = {
  can_view_grades: false,
  can_view_attendance: false,
  can_approve_consent: false,
  can_pickup: false,
  can_receive_sms: false,
};

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  active: { label: 'پیوند فعال', variant: 'success' },
  pending: { label: 'در انتظار تأیید مدرسه', variant: 'warning' },
  ended: { label: 'پایان یافته', variant: 'neutral' },
  rejected: { label: 'رد شده', variant: 'danger' },
};

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

export const FamilyManagementPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();
  const isAuthorized = hasAccess('family:manage_links') || activeRole.group === 'school_admin' || activeRole.id === 'school_registrar';

  const [activeTab, setActiveTab] = useState<TabId>('links');
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Guardian links ─────────────────────────────────────────────
  const [links, setLinks] = useState<GuardianLinkRow[] | null>(null);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [linksReload, setLinksReload] = useState(0);

  // ── Students of the school (court-order / pickup tabs are per learner) ──
  const [students, setStudents] = useState<{ ulid: string; fullName: string }[] | null>(null);
  const [selectedStudent, setSelectedStudent] = useState('');

  // ── Court orders ───────────────────────────────────────────────
  const [courtOrders, setCourtOrders] = useState<CourtOrderRow[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersReload, setOrdersReload] = useState(0);
  const [summaryOnly, setSummaryOnly] = useState(false);

  // ── Pickup list ────────────────────────────────────────────────
  const [pickups, setPickups] = useState<PickupRow[] | null>(null);
  const [pickupsError, setPickupsError] = useState<string | null>(null);
  const [pickupsReload, setPickupsReload] = useState(0);

  // ── Modals ─────────────────────────────────────────────────────
  const [linkModal, setLinkModal] = useState<{ mode: 'approve' | 'edit'; link: GuardianLinkRow } | null>(null);
  const [linkFlags, setLinkFlags] = useState<GuardianFlags>(EMPTY_FLAGS);
  const [linkType, setLinkType] = useState('primary');
  const [linkReason, setLinkReason] = useState('');

  const [endTarget, setEndTarget] = useState<GuardianLinkRow | null>(null);
  const [endReason, setEndReason] = useState('');

  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const [courtDenied, setCourtDenied] = useState<Partial<Record<keyof GuardianFlags, boolean>>>({});
  const [courtFrom, setCourtFrom] = useState('');
  const [courtTo, setCourtTo] = useState('');
  const [courtReason, setCourtReason] = useState('');

  const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
  const [pkName, setPkName] = useState('');
  const [pkPhone, setPkPhone] = useState('');
  const [pkRelation, setPkRelation] = useState('');
  const [pkReason, setPkReason] = useState('');

  const [toggleTarget, setToggleTarget] = useState<PickupRow | null>(null);
  const [toggleReason, setToggleReason] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const loadLinks = useCallback(() => {
    setLinks(null);
    setLinksError(null);
    ApiFamilyService.listAllLinks()
      .then(setLinks)
      .catch((e) => setLinksError(firstError(e, 'خطا در دریافت پیوندهای ولی')));
  }, []);

  useEffect(() => { if (isAuthorized) loadLinks(); }, [isAuthorized, loadLinks, linksReload]);

  useEffect(() => {
    if (!isAuthorized) return;
    ApiAcademicService.studentsInScope()
      .then((rows) => {
        setStudents(rows);
        setSelectedStudent((prev) => prev || rows[0]?.ulid || '');
      })
      .catch(() => setStudents([]));
  }, [isAuthorized]);

  useEffect(() => {
    if (activeTab !== 'restrictions' || !selectedStudent) return;
    let cancelled = false;

    setCourtOrders(null);
    setOrdersError(null);

    ApiFamilyService.courtOrders(selectedStudent)
      .then((r) => {
        if (cancelled) return;
        setCourtOrders(r.rows);
        setSummaryOnly(r.summaryOnly);
      })
      .catch((e) => { if (!cancelled) setOrdersError(firstError(e, 'خطا در دریافت احکام قضایی')); });

    return () => { cancelled = true; };
  }, [activeTab, selectedStudent, ordersReload]);

  useEffect(() => {
    if (activeTab !== 'pickups' || !selectedStudent) return;
    let cancelled = false;

    setPickups(null);
    setPickupsError(null);

    ApiFamilyService.pickups(selectedStudent)
      .then((rows) => { if (!cancelled) setPickups(rows); })
      .catch((e) => { if (!cancelled) setPickupsError(firstError(e, 'خطا در دریافت فهرست تحویل‌گیری')); });

    return () => { cancelled = true; };
  }, [activeTab, selectedStudent, pickupsReload]);

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی محرمانه به پرونده‌های خانوادگی و احکام قضایی حضانت"
        requiredRoleOrPermission="family:manage_links (مدیر مدرسه یا مسئول ثبت‌نام)"
        reason="اطلاعات پرونده‌های سرپرستی، احکام دادگاه خانواده و تفکیک اولیای جداشده کاملاً محرمانه بوده و تنها برای مدیر مدرسه و مسئول ثبت‌نام قابل مشاهده و ویرایش است."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const openLinkModal = (mode: 'approve' | 'edit', link: GuardianLinkRow) => {
    setLinkFlags({ ...link.flags });
    setLinkType(link.linkType || 'primary');
    setLinkReason('');
    setActionError(null);
    setLinkModal({ mode, link });
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkModal || linkReason.trim().length < 5) return;

    setIsSaving(true);
    setActionError(null);
    try {
      const payload = { flags: linkFlags, linkType, reason: linkReason.trim() };
      if (linkModal.mode === 'approve') {
        await ApiFamilyService.approveLink(linkModal.link.id, payload);
      } else {
        await ApiFamilyService.updateLink(linkModal.link.id, payload);
      }
      setLinkModal(null);
      setLinksReload((k) => k + 1);
    } catch (err) {
      setActionError(firstError(err, 'خطا در ذخیرهٔ مجوزهای پیوند'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endTarget || endReason.trim().length < 5) return;

    setIsSaving(true);
    setActionError(null);
    try {
      await ApiFamilyService.endLink(endTarget.id, endReason.trim());
      setEndTarget(null);
      setEndReason('');
      setLinksReload((k) => k + 1);
    } catch (err) {
      setActionError(firstError(err, 'خطا در پایان پیوند ولی'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCourtOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || courtReason.trim().length < 5) return;

    const denied = (Object.keys(courtDenied) as (keyof GuardianFlags)[])
      .filter((key) => courtDenied[key] === true);

    if (denied.length === 0) {
      setActionError('دست‌کم یک دسترسی را برای سلب انتخاب کنید.');
      return;
    }

    setIsSaving(true);
    setActionError(null);
    try {
      await ApiFamilyService.createCourtOrder({
        studentUlid: selectedStudent,
        restrictions: Object.fromEntries(denied.map((key) => [key, false])),
        validFrom: courtFrom || null,
        validTo: courtTo || null,
        reason: courtReason.trim(),
      });
      setIsCourtModalOpen(false);
      setCourtDenied({});
      setCourtFrom('');
      setCourtTo('');
      setCourtReason('');
      setOrdersReload((k) => k + 1);
    } catch (err) {
      setActionError(firstError(err, 'خطا در ثبت حکم قضایی'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || pkName.trim().length < 3 || pkPhone.trim().length < 10 || pkReason.trim().length < 5) return;

    setIsSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const result = await ApiFamilyService.createPickup(selectedStudent, {
        fullName: pkName.trim(),
        phone: pkPhone.trim(),
        relation: pkRelation.trim() || undefined,
        reason: pkReason.trim(),
      });

      setIsPickupModalOpen(false);
      setPkName('');
      setPkPhone('');
      setPkRelation('');
      setPkReason('');
      setPickupsReload((k) => k + 1);

      if (result.suggestionOnly) {
        setNotice('ثبت شد؛ این ردیف پیشنهاد ناظم است و تا تأیید مدرسه در فهرست فعال قرار نمی‌گیرد.');
      }
    } catch (err) {
      setActionError(firstError(err, 'خطا در ثبت فرد مجاز تحویل'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toggleTarget || toggleReason.trim().length < 5) return;

    setIsSaving(true);
    setActionError(null);
    try {
      await ApiFamilyService.updatePickup(toggleTarget.id, {
        status: toggleTarget.status === 'active' ? 'inactive' : 'active',
        reason: toggleReason.trim(),
      });
      setToggleTarget(null);
      setToggleReason('');
      setPickupsReload((k) => k + 1);
    } catch (err) {
      setActionError(firstError(err, 'خطا در تغییر وضعیت فرد مجاز'));
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    {
      id: 'links',
      label: 'پیوندهای ولی و دانش‌آموز (روابط خانوادگی)',
      badge: links?.filter((l) => l.status === 'pending').length || undefined,
    },
    { id: 'restrictions', label: 'احکام قضایی و محدودیت‌های سرپرستی', badge: courtOrders?.length || undefined },
    { id: 'pickups', label: 'اشخاص مجاز ترخیص و تحویل دانش‌آموز', badge: pickups?.length || undefined },
  ];

  const studentSelector = (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <label className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB]">دانش‌آموز:</label>
      <select
        value={selectedStudent}
        onChange={(e) => setSelectedStudent(e.target.value)}
        className="text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none min-w-[220px]"
      >
        {students === null && <option value="">در حال دریافت فهرست دانش‌آموزان…</option>}
        {students !== null && students.length === 0 && <option value="">دانش‌آموزی در دسترس نیست</option>}
        {(students ?? []).map((s) => (
          <option key={s.ulid} value={s.ulid}>{s.fullName}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت ارتباطات خانوادگی، حضانت و اشخاص مجاز تحویل"
        subtitle="تفکیک حساب والدین جداشده، اعمال دادنامه‌های قضایی، تعیین دقیق مجوزها و نظارت بر ترخیص دانش‌آموزان"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => {
                setActionError(null);
                setNotice(null);
                setIsPickupModalOpen(true);
                setActiveTab('pickups');
              }}
            >
              افزودن فرد مجاز تحویل
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Scale size={15} />}
              onClick={() => {
                setActionError(null);
                setIsCourtModalOpen(true);
                setActiveTab('restrictions');
              }}
            >
              ثبت محدودیت قضایی دادگاه
            </Button>
          </div>
        }
      />

      {/* Legal & Anti-Disclosure Notice */}
      <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs leading-relaxed space-y-2 text-right">
        <div className="flex items-center gap-2 text-amber-400 font-bold">
          <ShieldAlert size={18} />
          <span>قواعد قطعی حقوقی و حریم خصوصی در سامانه مشاهیر آینده:</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-300 pr-2">
          <li><strong>تفکیک مطلق اطلاعات:</strong> پدر و مادر جداشده دو حساب کاملاً مستقل دارند. شماره تلفن، آدرس، پیام‌ها و یادداشت‌های شخصی یکی هرگز برای دیگری قابل مشاهده نیست.</li>
          <li><strong>حق ذاتی آموزش:</strong> صرف جدایی والدین مانع دریافت کارنامه و اطلاع از وضعیت درسی فرزند نیست، مگر حکم صریح قضایی ثبت و تنفیذ شده باشد.</li>
          <li><strong>استقلال مجوز ترخیص:</strong> حق تحویل فیزیکی دانش‌آموز از درب مدرسه کاملاً مستقل از مجوز مشاهده کارنامه است. شخص مجاز تحویل (مانند دایی یا راننده) حق دسترسی به نمرات را نخواهد داشت.</li>
        </ul>
      </div>

      {(actionError || notice) && (
        <Card className={cn(
          'text-xs',
          actionError
            ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
            : 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200',
        )}>
          <div className="flex items-center gap-2 font-bold">
            {actionError ? <AlertCircle size={15} /> : <Info size={15} />}
            <span>{actionError ?? notice}</span>
          </div>
        </Card>
      )}

      <Tabs tabs={tabs} activeId={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      {/* ── Tab 1: Guardian links ───────────────────────────────── */}
      {activeTab === 'links' && (
        <div className="space-y-4">
          {linksError && (
            <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
                <span className="flex items-center gap-2 font-bold"><AlertCircle size={15} />{linksError}</span>
                <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setLinksReload((k) => k + 1)}>
                  تلاش دوباره
                </Button>
              </div>
            </Card>
          )}

          {links === null && !linksError ? (
            <Card>
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
                <Loader2 size={18} className="animate-spin" /> در حال دریافت پیوندهای خانواده…
              </div>
            </Card>
          ) : (links ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon={<Users size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
                title="هنوز پیوندی ثبت نشده است"
                description="با نخستین درخواست ولی از پنل خودش یا ثبت مستقیم مسئول دفتر، پیوندها همین‌جا با وضعیت «در انتظار تأیید» ظاهر می‌شوند."
              />
            </Card>
          ) : (
            (links ?? []).map((link) => {
              const status = STATUS_BADGE[link.status] ?? { label: link.status, variant: 'neutral' as const };
              return (
                <Card key={link.id} className="text-right">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="primary">{link.linkTypeLabel}</Badge>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {link.endsOn && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <CalendarDays size={11} /> تا {formatJalaliDate(link.endsOn)}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                        {link.guardianName ?? 'ولی بدون حساب کاربری'} ← {link.studentName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {link.status === 'pending' && (
                        <Button size="sm" variant="primary" icon={<UserCheck size={14} />} onClick={() => openLinkModal('approve', link)}>
                          تأیید و فعال‌سازی
                        </Button>
                      )}
                      {link.status === 'active' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openLinkModal('edit', link)}>
                            ویرایش مجوزها
                          </Button>
                          <Button size="sm" variant="ghost" icon={<Link2Off size={14} />} onClick={() => { setEndReason(''); setEndTarget(link); }}>
                            پایان پیوند
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-3">
                    <span className="text-xs font-bold text-[#526176] dark:text-[#B3C0D2] block mb-2">
                      مجوزهای مؤثر این ولی نسبت به این دانش‌آموز (پس از اعمال احکام قضایی):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {FLAG_FIELDS.map((field) => {
                        const granted = link.flags[field.key];
                        return (
                          <div
                            key={field.key}
                            className={cn(
                              'p-2 rounded-xl flex items-center gap-1.5',
                              granted
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 line-through',
                            )}
                          >
                            {granted ? <Check size={14} /> : <X size={14} />}
                            <span>{FLAG_LABELS[field.key]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Tab 2: Court orders ─────────────────────────────────── */}
      {activeTab === 'restrictions' && (
        <div className="space-y-4">
          {studentSelector}

          {summaryOnly && (
            <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30">
              <p className="text-xs text-amber-900 dark:text-amber-200">
                بر پایهٔ سطح دسترسی شما، تنها «شرح محدودیت» نمایش داده می‌شود و ارجاع به سند دادگاه پنهان است (ش۱۶).
              </p>
            </Card>
          )}

          {ordersError && (
            <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
                <span className="flex items-center gap-2 font-bold"><AlertCircle size={15} />{ordersError}</span>
                <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setOrdersReload((k) => k + 1)}>
                  تلاش دوباره
                </Button>
              </div>
            </Card>
          )}

          {courtOrders === null && !ordersError ? (
            <Card>
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
                <Loader2 size={18} className="animate-spin" /> در حال دریافت احکام…
              </div>
            </Card>
          ) : (courtOrders ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon={<Scale size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
                title="حکم قضایی برای این دانش‌آموز ثبت نشده است"
                description="تا زمانی که حکمی ثبت نشود، مجوزهای پیوند ولی بدون قید اعمال می‌شوند. ثبت حکم، دسترسی‌های انتخابی را فوراً سلب می‌کند."
              />
            </Card>
          ) : (
            (courtOrders ?? []).map((order) => {
              const denied = (Object.keys(order.restrictions) as (keyof GuardianFlags)[])
                .filter((key) => order.restrictions[key] === false);
              return (
                <Card key={order.id} className="text-right border-red-200 dark:border-red-900/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
                    <div className="flex items-center gap-2">
                      <Badge variant="danger">حکم لازم‌الاجرا قضایی</Badge>
                      <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                        اعتبار: {formatJalaliDate(order.validFrom)} تا {formatJalaliDate(order.validTo)}
                      </span>
                    </div>
                    {order.fileUlid && (
                      <span className="text-[11px] text-slate-500 font-mono" dir="ltr">سند: {order.fileUlid}</span>
                    )}
                  </div>

                  <div className="pt-3">
                    <span className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] block mb-2">
                      دسترسی‌های سلب‌شده با این حکم:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {denied.length === 0 && <span className="text-xs text-slate-400">—</span>}
                      {denied.map((key) => (
                        <span key={key} className="text-[11px] bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-lg">
                          سلب: {FLAG_LABELS[key]}
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Tab 3: Authorized pickups ───────────────────────────── */}
      {activeTab === 'pickups' && (
        <div className="space-y-4">
          {studentSelector}

          {pickupsError && (
            <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
                <span className="flex items-center gap-2 font-bold"><AlertCircle size={15} />{pickupsError}</span>
                <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setPickupsReload((k) => k + 1)}>
                  تلاش دوباره
                </Button>
              </div>
            </Card>
          )}

          {pickups === null && !pickupsError ? (
            <Card>
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
                <Loader2 size={18} className="animate-spin" /> در حال دریافت فهرست…
              </div>
            </Card>
          ) : (pickups ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon={<UserCheck size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
                title="فرد مجاز تحویل ثبت نشده است"
                description="برای این دانش‌آموز هنوز کسی جز اولیای پیوند فعال مجاز به ترخیص نیست؛ با دکمهٔ «افزودن فرد مجاز تحویل» یک ردیف بسازید."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(pickups ?? []).map((pk) => (
                <Card key={pk.id} className="text-right">
                  <div className="flex items-center justify-between pb-2 border-b border-[#DCE3EE] dark:border-[#344257] mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#2457C5] flex items-center justify-center font-bold text-xs">
                        {pk.fullName.slice(0, 1)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{pk.fullName}</h4>
                        <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2]">{pk.relation ?? 'نسبت ثبت نشده'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {pk.locked && <Lock size={12} className="text-rose-500" />}
                      <Badge variant={pk.status === 'active' ? 'success' : 'warning'}>
                        {pk.status === 'active' ? 'مجاز به تحویل' : 'پیشنهاد — در انتظار تأیید'}
                      </Badge>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    {pk.isLinkedGuardian
                      ? 'این شخص خودش یکی از اولیای پیوند فعال است.'
                      : 'این شخص صرفاً مجاز به ترخیص فیزیکی است و هیچ دسترسی‌ای به سامانه ندارد.'}
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pk.locked}
                      onClick={() => { setToggleReason(''); setToggleTarget(pk); }}
                    >
                      {pk.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: approve / edit link ──────────────────────────── */}
      <Modal
        isOpen={linkModal !== null}
        onClose={() => setLinkModal(null)}
        title={
          linkModal?.mode === 'approve'
            ? `تأیید پیوند ولی (${linkModal?.link.guardianName ?? '—'} ← ${linkModal?.link.studentName ?? ''})`
            : `ویرایش مجوزهای ولی (${linkModal?.link.guardianName ?? '—'})`
        }
        maxWidth="md"
      >
        <form onSubmit={handleSaveLink} className="space-y-4 text-right">
          <FormField label="نوع رابطه / سرپرستی" required>
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              {Object.entries(GUARDIAN_LINK_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FormField>

          <div className="space-y-2 text-xs">
            {FLAG_FIELDS.map((field) => (
              <label key={field.key} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkFlags[field.key]}
                  onChange={(e) => setLinkFlags({ ...linkFlags, [field.key]: e.target.checked })}
                  className="rounded"
                />
                <span>{field.label}</span>
              </label>
            ))}
          </div>

          <FormField label="دلیل تغییر مجوزها (درج در لاگ حساس)" required>
            <textarea
              rows={3}
              required
              value={linkReason}
              onChange={(e) => setLinkReason(e.target.value)}
              placeholder="مثال: توافق‌نامه رسمی والدین / دادنامه جدید شعبه..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setLinkModal(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || linkReason.trim().length < 5}>
              {isSaving ? 'در حال ذخیره…' : linkModal?.mode === 'approve' ? 'تأیید و فعال‌سازی پیوند' : 'ثبت تغییرات و ثبت در تاریخچه'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: end link ─────────────────────────────────────── */}
      <Modal
        isOpen={endTarget !== null}
        onClose={() => setEndTarget(null)}
        title={`پایان پیوند ولی (${endTarget?.guardianName ?? '—'} ← ${endTarget?.studentName ?? ''})`}
        maxWidth="sm"
      >
        <form onSubmit={handleEndLink} className="space-y-4 text-right">
          <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
            با پایان پیوند، دسترسی این ولی به‌صورت فوری قطع می‌شود؛ تاریخچه و سوابق حفظ می‌شوند.
          </p>
          <FormField label="دلیل پایان پیوند (درج در لاگ حساس)" required>
            <textarea
              rows={3}
              required
              value={endReason}
              onChange={(e) => setEndReason(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEndTarget(null)}>انصراف</Button>
            <Button variant="danger" type="submit" disabled={isSaving || endReason.trim().length < 5}>
              {isSaving ? 'در حال ثبت…' : 'پایان پیوند و قطع دسترسی'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: create court order ───────────────────────────── */}
      <Modal
        isOpen={isCourtModalOpen}
        onClose={() => setIsCourtModalOpen(false)}
        title="ثبت محدودیت قضایی دادگاه خانواده"
        maxWidth="md"
      >
        <form onSubmit={handleCreateCourtOrder} className="space-y-4 text-right">
          {studentSelector}

          <div className="space-y-2 text-xs">
            <span className="text-[11px] font-bold text-[#526176] dark:text-[#B3C0D2] block">
              دسترسی‌هایی که این حکم سلب می‌کند:
            </span>
            {FLAG_FIELDS.map((field) => (
              <label key={field.key} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={courtDenied[field.key] === true}
                  onChange={(e) => setCourtDenied({ ...courtDenied, [field.key]: e.target.checked })}
                  className="rounded"
                />
                <span>{field.label}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="اعتبار از تاریخ (اختیاری)">
              <JalaliDatePicker value={courtFrom} onChange={setCourtFrom} placeholder="بدون محدودیت شروع" />
            </FormField>
            <FormField label="اعتبار تا تاریخ (اختیاری)">
              <JalaliDatePicker value={courtTo} onChange={setCourtTo} placeholder="بدون انقضا" />
            </FormField>
          </div>

          <FormField label="شرح و مستند حکم (درج در لاگ حساس)" required>
            <textarea
              rows={3}
              required
              value={courtReason}
              onChange={(e) => setCourtReason(e.target.value)}
              placeholder="مثال: دادنامهٔ شعبهٔ ۲۴ دادگاه خانوادهٔ تهران — سلب حق ترخیص"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCourtModalOpen(false)}>انصراف</Button>
            <Button variant="danger" type="submit" disabled={isSaving || !selectedStudent || courtReason.trim().length < 5}>
              {isSaving ? 'در حال ثبت…' : 'تنفیذ و اعمال فوری محدودیت'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: create pickup authorization ──────────────────── */}
      <Modal
        isOpen={isPickupModalOpen}
        onClose={() => setIsPickupModalOpen(false)}
        title="معرفی شخص مجاز جهت تحویل دانش‌آموز"
        maxWidth="md"
      >
        <form onSubmit={handleCreatePickup} className="space-y-4 text-right">
          {studentSelector}

          <FormField label="نام و نام خانوادگی فرد" required>
            <input
              type="text"
              required
              value={pkName}
              onChange={(e) => setPkName(e.target.value)}
              placeholder="مثال: علی احمدی"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="شماره تلفن همراه" required>
              <input
                type="text"
                required
                dir="ltr"
                value={pkPhone}
                onChange={(e) => setPkPhone(e.target.value)}
                placeholder="0912..."
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
              />
            </FormField>

            <FormField label="نسبت با دانش‌آموز">
              <input
                type="text"
                value={pkRelation}
                onChange={(e) => setPkRelation(e.target.value)}
                placeholder="مثال: عمو / راننده شخصی معتمد"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
          </div>

          <FormField label="دلیل ثبت (درج در لاگ حساس)" required>
            <textarea
              rows={2}
              required
              value={pkReason}
              onChange={(e) => setPkReason(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsPickupModalOpen(false)}>انصراف</Button>
            <Button
              variant="primary"
              type="submit"
              icon={<Plus size={14} />}
              disabled={isSaving || !selectedStudent || pkName.trim().length < 3 || pkPhone.trim().length < 10 || pkReason.trim().length < 5}
            >
              {isSaving ? 'در حال ثبت…' : 'ثبت در فهرست ترخیص مدرسه'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: toggle pickup status ─────────────────────────── */}
      <Modal
        isOpen={toggleTarget !== null}
        onClose={() => setToggleTarget(null)}
        title={toggleTarget?.status === 'active' ? 'غیرفعال‌سازی فرد مجاز' : 'فعال‌سازی فرد مجاز'}
        maxWidth="sm"
      >
        <form onSubmit={handleTogglePickup} className="space-y-4 text-right">
          <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
            {toggleTarget?.fullName} {toggleTarget?.status === 'active' ? 'از فهرست ترخیص خارج می‌شود' : 'به فهرست ترخیص بازمی‌گردد'}.
          </p>
          <FormField label="دلیل تغییر (درج در لاگ حساس)" required>
            <textarea
              rows={3}
              required
              value={toggleReason}
              onChange={(e) => setToggleReason(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setToggleTarget(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || toggleReason.trim().length < 5}>
              {isSaving ? 'در حال ثبت…' : 'ثبت تغییر'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
