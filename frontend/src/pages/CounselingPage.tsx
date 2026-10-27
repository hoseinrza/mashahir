import React, { useState } from 'react';
import {
  HeartHandshake, Calendar, Clock, CheckCircle2, User,
  Plus, Shield, Lock, FileText, ChevronLeft, ChevronRight, Video
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader, AccessDeniedGate } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { CounselingService } from '../services';
import { CounselingAppointment } from '../types';

export const CounselingPage: React.FC = () => {
  const { currentUser, activeRole, activeStudent, switchUser } = useAuth();
  const isBusDriver = activeRole.id === 'bus_driver';

  if (isBusDriver) {
    return (
      <AccessDeniedGate
        title="عدم دسترسی به پرونده‌های مشاوره مدرسه"
        requiredRoleOrPermission="counseling:book یا counseling:manage_sessions"
        reason="بر اساس اصول امنیتی و حریم خصوصی، راننده سرویس فاقد مجوز مشاهده و نوبت‌گیری مشاوره تحصیلی و روانشناسی دانش‌آموزان است."
        currentRoleTitle={activeRole.persianTitle}
        suggestedRoleId="usr_principal"
        suggestedRoleName="دکتر احمدرضا جلالی (مدیر مدرسه)"
        onSwitchUser={switchUser}
      />
    );
  }

  const isCounselor = activeRole.id === 'academic_counselor' || activeRole.id === 'school_psychologist';

  const [appointments, setAppointments] = useState<CounselingAppointment[]>(() =>
    CounselingService.getAppointments()
  );

  // 4-step booking modal
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [topic, setTopic] = useState('برنامه‌ریزی درسی و ارتقای معدل');
  const [selectedCounselorId, setSelectedCounselorId] = useState('usr_counselor_sara');
  const [selectedDate, setSelectedDate] = useState('۱۴۰۳/۰۸/۰۸');
  const [selectedTime, setSelectedTime] = useState('۱۰:۳۰');
  const [sessionType, setSessionType] = useState<'in_person' | 'online'>('in_person');
  const [notes, setNotes] = useState('');

  const counselorsList = [
    {
      id: 'usr_counselor_sara',
      name: 'سارا حسینی',
      specialty: 'مشاور تحصیلی و برنامه‌ریزی کنکور',
      availableSlots: ['۱۰:۳۰', '۱۱:۳۰', '۱۳:۰۰'],
    },
    {
      id: 'usr_psychologist_nima',
      name: 'دکتر نیما رستمی',
      specialty: 'روانشناس بالینی و توانمندسازی فردی',
      availableSlots: ['۱۴:۰۰', '۱۵:۰۰', '۱۶:۰۰'],
    },
  ];

  const handleNextStep = () => {
    if (currentStep < 4) setCurrentStep((prev) => (prev + 1) as any);
  };

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep((prev) => (prev - 1) as any);
  };

  const handleConfirmBooking = () => {
    const counselor = counselorsList.find((c) => c.id === selectedCounselorId);
    const newApt = CounselingService.bookAppointment({
      studentId: activeStudent?.id || 'std_parsa',
      studentName: activeStudent?.fullName || 'پارسا رادمنش',
      requesterId: currentUser.id,
      requesterName: currentUser.fullName,
      requesterRole: activeRole.group === 'family' ? 'guardian' : 'student',
      counselorId: selectedCounselorId,
      counselorName: counselor?.name || 'سارا حسینی',
      counselorSpecialty: selectedCounselorId === 'usr_counselor_sara' ? 'تحصیلی' : 'روانشناختی',
      type: sessionType,
      topic,
      scheduledDate: selectedDate,
      scheduledTime: selectedTime,
    });

    setAppointments([newApt, ...appointments]);
    setIsBookModalOpen(false);
    setCurrentStep(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="مرکز مشاوره و هدایت تحصیلی مدرسه"
        subtitle="برنامه‌ریزی جلسات تخصصی، پایش یادگیری و مشاوره فردی با رعایت کامل حریم خصوصی"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => {
              setCurrentStep(1);
              setIsBookModalOpen(true);
            }}
          >
            رزرو وقت مشاوره جدید
          </Button>
        }
      />

      {/* Appointments List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] text-right">
          جلسات ثبت‌شده و سوابق پیگیری
        </h3>

        {appointments.map((apt) => (
          <Card key={apt.id} className="text-right">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={apt.counselorSpecialty === 'تحصیلی' ? 'primary' : 'warning'}>
                    مشاوره {apt.counselorSpecialty}
                  </Badge>
                  <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                    متقاضی: {apt.requesterName}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                    دانش‌آموز: {apt.studentName}
                  </span>
                </div>
                <h4 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">{apt.topic}</h4>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-left text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                    <Calendar size={13} className="text-[#2457C5]" />
                    <span>{apt.scheduledDate}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 font-mono mt-0.5">
                    <Clock size={13} />
                    <span>ساعت {apt.scheduledTime}</span>
                  </div>
                </div>

                <Badge variant={apt.status === 'confirmed' ? 'success' : apt.status === 'completed' ? 'neutral' : 'warning'}>
                  {apt.status === 'confirmed' ? 'تأیید شده' : apt.status === 'completed' ? 'برگزار شده' : 'در انتظار بررسی'}
                </Badge>
              </div>
            </div>

            <div className="py-3 text-xs space-y-3">
              <div className="flex items-center gap-2 text-slate-500">
                <User size={14} />
                <span>مشاور جلسه: <strong>{apt.counselorName}</strong></span>
                <span className="text-slate-300">·</span>
                <span>نوع جلسه: {apt.type === 'in_person' ? 'حضوری در اتاق مشاوره' : 'آنلاین تصویری'}</span>
              </div>

              {/* Shared Summary visible to all parties */}
              {apt.sharedSummary && (
                <div className="p-3 bg-[#F0F4FA] dark:bg-[#101722]/60 rounded-xl border border-[#DCE3EE] dark:border-[#344257]">
                  <span className="font-bold text-[#2457C5] dark:text-[#8BAEFF] block mb-1">
                    خلاصه قابل اشتراک جلسه و توصیه‌ها:
                  </span>
                  <p className="text-[#202B3C] dark:text-[#F1F5FB] leading-relaxed">{apt.sharedSummary}</p>
                  {apt.followUpPlan && (
                    <span className="block text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                      <strong>برنامه اقدام بعدی:</strong> {apt.followUpPlan}
                    </span>
                  )}
                </div>
              )}

              {/* Strictly Confidential Clinical Notes (Visible only to Counselor/Psychologist role) */}
              {isCounselor && apt.confidentialNotes && (
                <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/40">
                  <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-bold mb-1">
                    <Lock size={14} />
                    <span>یادداشت محرمانه بالینی (صرفاً قابل مشاهده برای مشاور/روانشناس):</span>
                  </div>
                  <p className="text-rose-900 dark:text-rose-200 leading-relaxed font-sans">
                    {apt.confidentialNotes}
                  </p>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* 4-Step Booking Modal */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title="رزرو ۴ مرحله‌ای جلسه مشاوره"
        maxWidth="lg"
      >
        <div className="space-y-6 text-right">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between px-2 text-xs">
            <span className={cn('font-bold', currentStep === 1 ? 'text-[#2457C5] dark:text-[#8BAEFF]' : 'text-slate-400')}>
              ۱. انتخاب موضوع
            </span>
            <span className="text-slate-300">←</span>
            <span className={cn('font-bold', currentStep === 2 ? 'text-[#2457C5] dark:text-[#8BAEFF]' : 'text-slate-400')}>
              ۲. مشاور و زمان
            </span>
            <span className="text-slate-300">←</span>
            <span className={cn('font-bold', currentStep === 3 ? 'text-[#2457C5] dark:text-[#8BAEFF]' : 'text-slate-400')}>
              ۳. نوع و توضیحات
            </span>
            <span className="text-slate-300">←</span>
            <span className={cn('font-bold', currentStep === 4 ? 'text-[#2457C5] dark:text-[#8BAEFF]' : 'text-slate-400')}>
              ۴. تأیید نهایی
            </span>
          </div>

          {/* Step 1: Topic */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <FormField label="موضوع اصلی درخواست مشاوره" required>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
                >
                  <option value="برنامه‌ریزی درسی و ارتقای معدل">برنامه‌ریزی درسی و ارتقای معدل</option>
                  <option value="روش‌های مطالعه و تست‌زنی">روش‌های مطالعه و تست‌زنی</option>
                  <option value="مدیریت اضطراب آزمون و آرامش ذهنی">مدیریت اضطراب آزمون و آرامش ذهنی</option>
                  <option value="هدایت تحصیلی و انتخاب رشته کنکور">هدایت تحصیلی و انتخاب رشته کنکور</option>
                  <option value="مسائل فردی و خانوادگی">مسائل فردی و خانوادگی</option>
                </select>
              </FormField>
            </div>
          )}

          {/* Step 2: Counselor and Slot */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <FormField label="انتخاب مشاور" required>
                <div className="space-y-2">
                  {counselorsList.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCounselorId(c.id)}
                      className={cn(
                        'p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between',
                        selectedCounselorId === c.id
                          ? 'border-[#2457C5] bg-blue-50/50 dark:bg-blue-950/40 text-[#2457C5] dark:text-[#8BAEFF] font-bold'
                          : 'border-[#DCE3EE] dark:border-[#344257]'
                      )}
                    >
                      <div>
                        <span className="text-xs font-bold block">{c.name}</span>
                        <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2]">{c.specialty}</span>
                      </div>
                      <span className="text-xs">{selectedCounselorId === c.id ? '✓ انتخاب شده' : 'انتخاب'}</span>
                    </div>
                  ))}
                </div>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="تاریخ جلسه" required>
                  <input
                    type="text"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
                  />
                </FormField>

                <FormField label="ساعت آزاد" required>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
                  >
                    <option value="۱۰:۳۰">۱۰:۳۰ صبح</option>
                    <option value="۱۱:۳۰">۱۱:۳۰ صبح</option>
                    <option value="۱۳:۰۰">۱۳:۰۰ ظهر</option>
                    <option value="۱۶:۰۰">۱۶:۰۰ عصر</option>
                  </select>
                </FormField>
              </div>
            </div>
          )}

          {/* Step 3: Session type and details */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <FormField label="نحوه برگزاری جلسه" required>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setSessionType('in_person')}
                    className={cn(
                      'p-3 rounded-xl border text-center cursor-pointer transition-all',
                      sessionType === 'in_person'
                        ? 'border-[#2457C5] bg-blue-50/50 dark:bg-blue-950/40 text-[#2457C5] dark:text-[#8BAEFF] font-bold'
                        : 'border-[#DCE3EE] dark:border-[#344257]'
                    )}
                  >
                    <span className="text-xs">جلسه حضوری در دبیرستان</span>
                  </div>
                  <div
                    onClick={() => setSessionType('online')}
                    className={cn(
                      'p-3 rounded-xl border text-center cursor-pointer transition-all',
                      sessionType === 'online'
                        ? 'border-[#2457C5] bg-blue-50/50 dark:bg-blue-950/40 text-[#2457C5] dark:text-[#8BAEFF] font-bold'
                        : 'border-[#DCE3EE] dark:border-[#344257]'
                    )}
                  >
                    <span className="text-xs">جلسه آنلاین تصویری</span>
                  </div>
                </div>
              </FormField>

              <FormField label="توضیحات و نکات اولیه برای مشاور">
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="در صورت وجود نکته خاص یا زمینه قبلی، جهت آمادگی بهتر مشاور بنویسید..."
                  className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
                />
              </FormField>
            </div>
          )}

          {/* Step 4: Final confirmation */}
          {currentStep === 4 && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">موضوع:</span>
                  <strong className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">{topic}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مشاور:</span>
                  <strong className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                    {counselorsList.find((c) => c.id === selectedCounselorId)?.name}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">زمان:</span>
                  <strong className="font-mono tabular-nums text-[#202B3C] dark:text-[#F1F5FB]">
                    {selectedDate} ساعت {selectedTime}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">نوع جلسه:</span>
                  <strong className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                    {sessionType === 'in_person' ? 'حضوری' : 'آنلاین'}
                  </strong>
                </div>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                پس از ثبت نهایی، پیامک یادآوری جلسه ۲۴ ساعت قبل برای شماره همراه شما ارسال خواهد شد.
              </p>
            </div>
          )}

          {/* Modal Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[#DCE3EE] dark:border-[#344257]">
            {currentStep > 1 ? (
              <Button variant="ghost" size="sm" onClick={handlePrevStep} icon={<ChevronRight size={14} />}>
                مرحله قبل
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <Button variant="primary" size="sm" onClick={handleNextStep}>
                مرحله بعد
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={handleConfirmBooking} icon={<CheckCircle2 size={14} />}>
                تأیید و ثبت نهایی وقت
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
