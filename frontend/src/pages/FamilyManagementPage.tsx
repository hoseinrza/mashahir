import React, { useState } from 'react';
import {
  ShieldAlert, ShieldCheck, Users, User, FileText, Check,
  AlertTriangle, Plus, Scale, Clock, Lock, CheckCircle2, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, Tabs, PageHeader, AccessDeniedGate, RolePermissionBadge } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { FamilyService } from '../services';
import { GuardianStudentLink, LegalRestriction, AuthorizedPickup } from '../types';

export const FamilyManagementPage: React.FC = () => {
  const { currentUser, activeRole, hasAccess, switchUser } = useAuth();
  const isAuthorized = hasAccess('family:manage_links') || activeRole.group === 'school_admin' || activeRole.id === 'school_registrar';

  const [links, setLinks] = useState<GuardianStudentLink[]>(() => FamilyService.getLinks());
  const [restrictions, setRestrictions] = useState<LegalRestriction[]>(() => FamilyService.getRestrictions());
  const [pickups, setPickups] = useState<AuthorizedPickup[]>(() => FamilyService.getPickups());

  const [activeTab, setActiveTab] = useState<'links' | 'restrictions' | 'pickups'>('links');

  // Modals
  const [isEditPermsModalOpen, setIsEditPermsModalOpen] = useState(false);
  const [isAddRestrictionModalOpen, setIsAddRestrictionModalOpen] = useState(false);
  const [isAddPickupModalOpen, setIsAddPickupModalOpen] = useState(false);

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی محرمانه به پرونده‌های خانوادگی و احکام قضایی حضانت"
        requiredRoleOrPermission="family:manage_links (مدیر ارشد مدرسه یا مسئول ثبت‌نام)"
        reason="اطلاعات پرونده‌های سرپرستی، احکام دادگاه خانواده و تفکیک اولیای جداشده کاملاً محرمانه بوده و تنها برای مدیر مدرسه و مسئول ثبت‌نام قابل مشاهده و ویرایش است."
        currentRoleTitle={activeRole.persianTitle}
        suggestedRoleId="usr_principal"
        suggestedRoleName="دکتر احمدرضا جلالی (مدیر مدرسه)"
        onSwitchUser={switchUser}
      />
    );
  }

  // Selected link for editing permissions
  const [selectedLink, setSelectedLink] = useState<GuardianStudentLink | null>(null);
  const [permForm, setPermForm] = useState({
    canViewAcademicReport: true,
    canViewAttendance: true,
    canReceiveSmsNotifications: true,
    canSignConsentForms: true,
    canBookCounseling: true,
    canPickupStudent: true,
    reason: '',
  });

  // New Restriction Form
  const [resCourtOrder, setResCourtOrder] = useState('');
  const [resAuthority, setResAuthority] = useState('شعبه ۲۴ دادگاه عمومی حقوقی (خانواده) تهران');
  const [resDate, setResDate] = useState('۱۴۰۳/۰۷/۱۰');
  const [resSummary, setResSummary] = useState('');

  // New Pickup Form
  const [pkName, setPkName] = useState('');
  const [pkNationalId, setPkNationalId] = useState('');
  const [pkPhone, setPkPhone] = useState('');
  const [pkRelation, setPkRelation] = useState('بستگان درجه یک');

  const openPermModal = (link: GuardianStudentLink) => {
    setSelectedLink(link);
    setPermForm({
      canViewAcademicReport: link.canViewAcademicReport,
      canViewAttendance: link.canViewAttendance,
      canReceiveSmsNotifications: link.canReceiveSmsNotifications,
      canSignConsentForms: link.canSignConsentForms,
      canBookCounseling: link.canBookCounseling,
      canPickupStudent: link.canPickupStudent,
      reason: '',
    });
    setIsEditPermsModalOpen(true);
  };

  const handleSavePermissions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLink || !permForm.reason) return;

    const updated = FamilyService.updateLinkPermissions(
      selectedLink.id,
      {
        canViewAcademicReport: permForm.canViewAcademicReport,
        canViewAttendance: permForm.canViewAttendance,
        canReceiveSmsNotifications: permForm.canReceiveSmsNotifications,
        canSignConsentForms: permForm.canSignConsentForms,
        canBookCounseling: permForm.canBookCounseling,
        canPickupStudent: permForm.canPickupStudent,
      },
      currentUser.fullName,
      permForm.reason
    );

    setLinks(updated);
    setIsEditPermsModalOpen(false);
  };

  const handleAddRestriction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resCourtOrder || !resSummary) return;

    const newRes = FamilyService.addLegalRestriction(
      {
        studentId: 'std_parsa',
        restrictedGuardianUserId: 'usr_guardian_masoud',
        courtOrderNumber: resCourtOrder,
        issuingAuthority: resAuthority,
        issueDate: resDate,
        restrictionSummary: resSummary,
        restrictedPermissions: ['pickup:pickup_daily'],
        isEnforced: true,
        verifiedByRegistrarId: currentUser.id,
        auditHistory: [
          {
            date: 'هم‌اکنون',
            action: 'ثبت و تنفیذ حکم قضایی دادگاه خانواده',
            actor: currentUser.fullName,
            reason: resSummary,
          },
        ],
      },
      currentUser.fullName
    );

    setRestrictions([newRes, ...restrictions]);
    setLinks(FamilyService.getLinks());
    setIsAddRestrictionModalOpen(false);
    setResCourtOrder('');
    setResSummary('');
  };

  const handleAddPickup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkName || !pkPhone) return;

    const newPk = FamilyService.addAuthorizedPickup(
      {
        studentId: 'std_parsa',
        fullName: pkName,
        nationalId: pkNationalId,
        phoneNumber: pkPhone,
        relationDescription: pkRelation,
        isAuthorized: true,
        registeredByGuardianId: currentUser.id,
      },
      currentUser.fullName
    );

    setPickups([newPk, ...pickups]);
    setIsAddPickupModalOpen(false);
    setPkName('');
    setPkNationalId('');
    setPkPhone('');
  };

  const tabs = [
    { id: 'links', label: 'پیوندهای ولی و دانش‌آموز (روابط خانوادگی)' },
    { id: 'restrictions', label: 'احکام قضایی و محدودیت‌های سرپرستی', badge: restrictions.length },
    { id: 'pickups', label: 'اشخاص مجاز ترخیص و تحویل دانش‌آموز', badge: pickups.length },
  ];

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
              onClick={() => setIsAddPickupModalOpen(true)}
            >
              افزودن فرد مجاز تحویل
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Scale size={15} />}
              onClick={() => setIsAddRestrictionModalOpen(true)}
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

      <Tabs tabs={tabs} activeId={activeTab} onChange={(id) => setActiveTab(id as any)} />

      {/* Tab 1: Guardian Links */}
      {activeTab === 'links' && (
        <div className="space-y-4">
          {links.map((link) => (
            <Card key={link.id} className="text-right">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={link.relationshipType === 'mother' ? 'success' : link.relationshipType === 'father' ? 'primary' : 'warning'}>
                      {link.relationshipType === 'mother' ? 'مادر' : link.relationshipType === 'father' ? 'پدر' : 'سرپرست / نماینده'}
                    </Badge>
                    <Badge variant={link.verificationStatus === 'verified' ? 'success' : 'warning'}>
                      {link.verificationStatus === 'verified' ? 'مدارک تأیید شده' : 'در انتظار بررسی'}
                    </Badge>
                    {link.hasLegalRestriction && (
                      <Badge variant="danger">دارای محدودیت قضایی</Badge>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                    {link.guardianName} ← {link.studentName}
                  </h3>
                  <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-0.5">
                    مستند راستی‌آزمایی: <span className="font-semibold text-slate-700 dark:text-slate-300">{link.verificationDocumentRef}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openPermModal(link)}>
                    ویرایش مجوزها و دسترسی
                  </Button>
                </div>
              </div>

              {/* Granular Permissions Checklist Display */}
              <div className="pt-3">
                <span className="text-xs font-bold text-[#526176] dark:text-[#B3C0D2] block mb-2">
                  مجوزهای فعال برای این ولی نسبت به این دانش‌آموز:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className={cn('p-2 rounded-xl flex items-center gap-1.5', link.canViewAcademicReport ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 line-through')}>
                    <Check size={14} />
                    <span>مشاهده نمرات و کارنامه</span>
                  </div>

                  <div className={cn('p-2 rounded-xl flex items-center gap-1.5', link.canViewAttendance ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 line-through')}>
                    <Check size={14} />
                    <span>مشاهده حضور و غیاب</span>
                  </div>

                  <div className={cn('p-2 rounded-xl flex items-center gap-1.5', link.canReceiveSmsNotifications ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 line-through')}>
                    <Check size={14} />
                    <span>دریافت پیامک و اعلان</span>
                  </div>

                  <div className={cn('p-2 rounded-xl flex items-center gap-1.5', link.canSignConsentForms ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 line-through')}>
                    <Check size={14} />
                    <span>امضای رضایت‌نامه‌ها</span>
                  </div>

                  <div className={cn('p-2 rounded-xl flex items-center gap-1.5', link.canBookCounseling ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 line-through')}>
                    <Check size={14} />
                    <span>رزرو و پیگیری مشاوره</span>
                  </div>

                  <div className={cn('p-2 rounded-xl flex items-center gap-1.5', link.canPickupStudent ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-bold')}>
                    {link.canPickupStudent ? <Check size={14} /> : <X size={14} />}
                    <span>تحویل فیزیکی از مدرسه {link.canPickupStudent ? '' : '(سلب شده)'}</span>
                  </div>
                </div>

                {link.notes && (
                  <p className="mt-3 text-[11px] text-[#526176] dark:text-[#B3C0D2] bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                    <strong>یادداشت اداری:</strong> {link.notes} (آخرین به‌روزرسانی توسط {link.updatedBy})
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tab 2: Legal Restrictions */}
      {activeTab === 'restrictions' && (
        <div className="space-y-4">
          {restrictions.map((res) => (
            <Card key={res.id} className="text-right border-red-200 dark:border-red-900/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="danger">حکم لازم‌الاجرا قضایی</Badge>
                    <span className="text-xs text-rose-700 dark:text-rose-400 font-bold">
                      دادنامه شماره: {res.courtOrderNumber}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                    مرجع قضایی: {res.issuingAuthority}
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs text-[#526176] dark:text-[#B3C0D2]">
                  <span>تاریخ صدور: {res.issueDate}</span>
                  <span className="text-slate-300">·</span>
                  <span>ثبت در دبیرخانه: {res.registeredDate}</span>
                </div>
              </div>

              <div className="py-3 text-xs space-y-2">
                <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB] block">شرح دستور و الزام حقوقی:</span>
                <p className="text-[#526176] dark:text-[#B3C0D2] bg-red-50/40 dark:bg-red-950/20 p-3 rounded-xl border border-red-200/50 dark:border-red-900/40 leading-relaxed">
                  {res.restrictionSummary}
                </p>
              </div>

              {/* Audit history for restriction */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                <span className="font-bold text-slate-500">سوابق بازبینی و مجریان:</span>
                {res.auditHistory.map((h, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-500">
                    <span>{h.date} — {h.action} توسط <strong>{h.actor}</strong></span>
                    <span>علت: {h.reason}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tab 3: Authorized Pickups */}
      {activeTab === 'pickups' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pickups.map((pk) => (
              <Card key={pk.id} className="text-right">
                <div className="flex items-center justify-between pb-2 border-b border-[#DCE3EE] dark:border-[#344257] mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#2457C5] flex items-center justify-center font-bold text-xs">
                      {pk.fullName.slice(0, 1)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{pk.fullName}</h4>
                      <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2]">{pk.relationDescription}</span>
                    </div>
                  </div>
                  <Badge variant={pk.isAuthorized ? 'success' : 'danger'}>
                    {pk.isAuthorized ? 'مجاز به تحویل' : 'غیرمجاز'}
                  </Badge>
                </div>

                <div className="text-xs space-y-1 text-[#526176] dark:text-[#B3C0D2]">
                  <div>کد ملی: <strong className="font-mono tabular-nums">{pk.nationalId}</strong></div>
                  <div>شماره تماس ضروری: <strong className="font-mono tabular-nums">{pk.phoneNumber}</strong></div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                  توجه: این شخص صرفاً مجاز به ترخیص فیزیکی در درب مدرسه است و هیچ‌گونه دسترسی به کارنامه یا سامانه ندارد.
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Edit Permissions */}
      <Modal
        isOpen={isEditPermsModalOpen}
        onClose={() => setIsEditPermsModalOpen(false)}
        title={`ویرایش مجوزهای ولی (${selectedLink?.guardianName || ''})`}
        maxWidth="md"
      >
        <form onSubmit={handleSavePermissions} className="space-y-4 text-right">
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={permForm.canViewAcademicReport}
                onChange={(e) => setPermForm({ ...permForm, canViewAcademicReport: e.target.checked })}
                className="rounded"
              />
              <span>مشاهده کارنامه، نمرات و سوابق درسی</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={permForm.canViewAttendance}
                onChange={(e) => setPermForm({ ...permForm, canViewAttendance: e.target.checked })}
                className="rounded"
              />
              <span>مشاهده حضور و غیاب و ورود و خروج</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={permForm.canReceiveSmsNotifications}
                onChange={(e) => setPermForm({ ...permForm, canReceiveSmsNotifications: e.target.checked })}
                className="rounded"
              />
              <span>دریافت پیامک‌ها و اعلان‌های انضباطی</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={permForm.canSignConsentForms}
                onChange={(e) => setPermForm({ ...permForm, canSignConsentForms: e.target.checked })}
                className="rounded"
              />
              <span>امضای الکترونیکی رضایت‌نامه‌ها</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={permForm.canBookCounseling}
                onChange={(e) => setPermForm({ ...permForm, canBookCounseling: e.target.checked })}
                className="rounded"
              />
              <span>رزرو و پیگیری جلسات مشاوره</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={permForm.canPickupStudent}
                onChange={(e) => setPermForm({ ...permForm, canPickupStudent: e.target.checked })}
                className="rounded"
              />
              <span>تحویل فیزیکی دانش‌آموز از درب مدرسه</span>
            </label>
          </div>

          <FormField label="دلیل و مستند قانونی تغییر مجوزها (درج در لاگ حساس)" required>
            <textarea
              rows={3}
              required
              value={permForm.reason}
              onChange={(e) => setPermForm({ ...permForm, reason: e.target.value })}
              placeholder="مثال: توافق‌نامه رسمی والدین / دادنامه جدید شعبه..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsEditPermsModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" disabled={!permForm.reason}>
              ثبت تغییرات و ثبت در تاریخچه حساس
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Judicial Restriction */}
      <Modal
        isOpen={isAddRestrictionModalOpen}
        onClose={() => setIsAddRestrictionModalOpen(false)}
        title="ثبت محدودیت قضایی دادگاه خانواده"
        maxWidth="md"
      >
        <form onSubmit={handleAddRestriction} className="space-y-4 text-right">
          <FormField label="شماره دادنامه یا دستور قضایی" required>
            <input
              type="text"
              required
              value={resCourtOrder}
              onChange={(e) => setResCourtOrder(e.target.value)}
              placeholder="مثال: ۱۴۰۳/۱۱۲۲۳/شعبه۲۴"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
            />
          </FormField>

          <FormField label="مرجع صادرکننده حکم" required>
            <input
              type="text"
              required
              value={resAuthority}
              onChange={(e) => setResAuthority(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="شرح و متن حکم پیرامون حضانت و ترخیص" required>
            <textarea
              rows={4}
              required
              value={resSummary}
              onChange={(e) => setResSummary(e.target.value)}
              placeholder="متن محدودیت صادره از دادگاه..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsAddRestrictionModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="danger" type="submit">
              تنفیذ و اعمال فوری محدودیت
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Authorized Pickup */}
      <Modal
        isOpen={isAddPickupModalOpen}
        onClose={() => setIsAddPickupModalOpen(false)}
        title="معرفی شخص مجاز جهت تحویل دانش‌آموز"
        maxWidth="md"
      >
        <form onSubmit={handleAddPickup} className="space-y-4 text-right">
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

          <div className="grid grid-cols-2 gap-3">
            <FormField label="کد ملی" required>
              <input
                type="text"
                required
                value={pkNationalId}
                onChange={(e) => setPkNationalId(e.target.value)}
                placeholder="۰۰۱۴۵۸۹۶۲۱"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
              />
            </FormField>

            <FormField label="شماره تلفن همراه" required>
              <input
                type="text"
                required
                value={pkPhone}
                onChange={(e) => setPkPhone(e.target.value)}
                placeholder="۰۹۱۲..."
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
              />
            </FormField>
          </div>

          <FormField label="نسبت با دانش‌آموز یا عنوان معرفی" required>
            <input
              type="text"
              required
              value={pkRelation}
              onChange={(e) => setPkRelation(e.target.value)}
              placeholder="مثال: عمو / راننده شخصی معتمد خانواده"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsAddPickupModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" type="submit">
              ثبت در فهرست ترخیص مدرسه
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
