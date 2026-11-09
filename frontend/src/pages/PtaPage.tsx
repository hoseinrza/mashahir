import React, { useEffect, useState } from 'react';
import {
  Users, Plus, Loader2, AlertCircle, RefreshCw, Calendar, MapPin, CheckCircle2,
  FileText, BarChart3, Pencil, Lock, Unlock, Vote,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, Tabs, PageHeader, AccessDeniedGate, EmptyState } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { formatJalaliDateTime } from '../utils/jalali';
import { JalaliDateTimePicker } from '../components/common/JalaliDatePicker';
import { ApiPtaService, PtaMeetingRow, PtaSurveyRow, PTA_STATUS_LABEL } from '../api/data';
import { ApiError } from '../api/client';

type TabId = 'meetings' | 'surveys';

const firstError = (e: unknown, fallback: string): string =>
  e instanceof ApiError ? e.firstError() : fallback;

const MEETING_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' | 'danger' }> = {
  upcoming: { label: PTA_STATUS_LABEL.upcoming, variant: 'warning' },
  held: { label: PTA_STATUS_LABEL.held, variant: 'success' },
  cancelled: { label: PTA_STATUS_LABEL.cancelled, variant: 'neutral' },
};

export const PtaPage: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();
  const canManage = hasAccess('pta:manage');
  const canVote = hasAccess('pta:vote');
  const canView = hasAccess('pta:view') || canManage || canVote;

  const [tab, setTab] = useState<TabId>('meetings');
  const [meetings, setMeetings] = useState<PtaMeetingRow[] | null>(null);
  const [surveys, setSurveys] = useState<PtaSurveyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  // Create meeting
  const [isMeetingOpen, setIsMeetingOpen] = useState(false);
  const [mTitle, setMTitle] = useState('');
  const [mDate, setMDate] = useState('');
  const [mLocation, setMLocation] = useState('');
  const [mAgenda, setMAgenda] = useState('');

  // Edit meeting (minutes / status)
  const [editMeeting, setEditMeeting] = useState<PtaMeetingRow | null>(null);
  const [emStatus, setEmStatus] = useState('held');
  const [emMinutes, setEmMinutes] = useState('');
  const [emResolutions, setEmResolutions] = useState('');
  const [emAgenda, setEmAgenda] = useState('');

  // Create survey
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);
  const [sTitle, setSTitle] = useState('');
  const [sDescription, setSDescription] = useState('');
  const [sOptions, setSOptions] = useState<string[]>(['', '']);
  const [sPolicy, setSPolicy] = useState<'per_guardian' | 'per_family'>('per_guardian');
  const [sClosesAt, setSClosesAt] = useState('');

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;

    setError(null);

    Promise.all([ApiPtaService.meetings(), ApiPtaService.surveys()])
      .then(([meetingRows, surveyRows]) => {
        if (cancelled) return;
        setMeetings(meetingRows);
        setSurveys(surveyRows);
      })
      .catch((e) => { if (!cancelled) setError(firstError(e, 'خطا در دریافت دادهٔ انجمن اولیا')); });

    return () => { cancelled = true; };
  }, [canView, reloadKey]);

  if (!canView) {
    return (
      <AccessDeniedGate
        title="دسترسی به انجمن اولیا و مربیان"
        requiredRoleOrPermission="pta:view / pta:vote / pta:manage"
        reason="جلسات و نظرسنجی‌های انجمن برای اعضای انجمن، اولیا و کادر مجاز مدرسه نمایش داده می‌شود."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mTitle.trim() || !mDate) return;

    setIsSaving(true);
    setError(null);
    try {
      await ApiPtaService.createMeeting({
        title: mTitle.trim(),
        heldAt: mDate,
        location: mLocation.trim() || undefined,
        agenda: mAgenda.split('\n').map((s) => s.trim()).filter(Boolean),
      });
      setIsMeetingOpen(false);
      setMTitle('');
      setMDate('');
      setMLocation('');
      setMAgenda('');
      setReloadKey((k) => k + 1);
      setNotice('جلسهٔ انجمن ثبت شد.');
    } catch (err) {
      setError(firstError(err, 'خطا در ثبت جلسه'));
    } finally {
      setIsSaving(false);
    }
  };

  const openMeetingEdit = (meeting: PtaMeetingRow) => {
    setEditMeeting(meeting);
    setEmStatus(meeting.status === 'upcoming' ? 'held' : meeting.status);
    setEmMinutes(meeting.minutes ?? '');
    setEmResolutions(meeting.resolutions.join('\n'));
    setEmAgenda(meeting.agenda.join('\n'));
    setError(null);
  };

  const handleUpdateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMeeting) return;

    setIsSaving(true);
    setError(null);
    try {
      await ApiPtaService.updateMeeting(editMeeting.ulid, {
        status: emStatus,
        minutes: emMinutes.trim() || null,
        resolutions: emResolutions.split('\n').map((s) => s.trim()).filter(Boolean),
        agenda: emAgenda.split('\n').map((s) => s.trim()).filter(Boolean),
      });
      setEditMeeting(null);
      setReloadKey((k) => k + 1);
      setNotice('صورت‌جلسه ذخیره شد.');
    } catch (err) {
      setError(firstError(err, 'خطا در ذخیرهٔ صورت‌جلسه'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    const options = sOptions.map((text) => text.trim()).filter(Boolean);
    if (!sTitle.trim() || options.length < 2) return;

    setIsSaving(true);
    setError(null);
    try {
      await ApiPtaService.createSurvey({
        title: sTitle.trim(),
        description: sDescription.trim() || undefined,
        options: options.map((text, index) => ({ id: `opt_${index + 1}`, text })),
        policy: sPolicy,
        closesAt: sClosesAt || null,
      });
      setIsSurveyOpen(false);
      setSTitle('');
      setSDescription('');
      setSOptions(['', '']);
      setSClosesAt('');
      setReloadKey((k) => k + 1);
      setNotice('نظرسنجی ایجاد شد.');
    } catch (err) {
      setError(firstError(err, 'خطا در ایجاد نظرسنجی'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleVote = async (survey: PtaSurveyRow, optionId: string) => {
    setVoting(`${survey.ulid}:${optionId}`);
    setError(null);
    try {
      await ApiPtaService.vote(survey.ulid, optionId);
      setReloadKey((k) => k + 1);
      setNotice('رأی شما ثبت شد.');
    } catch (err) {
      setError(firstError(err, 'خطا در ثبت رأی'));
    } finally {
      setVoting(null);
    }
  };

  const toggleSurvey = async (survey: PtaSurveyRow) => {
    try {
      await ApiPtaService.updateSurvey(survey.ulid, { isActive: !survey.isActive });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(firstError(e, 'خطا در تغییر وضعیت نظرسنجی'));
    }
  };

  const tabs = [
    { id: 'meetings', label: 'جلسات و صورت‌جلسه‌ها', badge: meetings?.length ?? 0 },
    { id: 'surveys', label: 'نظرسنجی‌ها', badge: surveys?.length ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="انجمن اولیا و مربیان"
        subtitle="جلسات، صورت‌جلسه و مصوبات؛ نظرسنجی خانواده‌ها با سیاست ضدتکرار رأی"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReloadKey((k) => k + 1)}>
              به‌روزرسانی
            </Button>
            {canManage && tab === 'meetings' && (
              <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setIsMeetingOpen(true)}>
                جلسهٔ جدید
              </Button>
            )}
            {canManage && tab === 'surveys' && (
              <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setIsSurveyOpen(true)}>
                نظرسنجی جدید
              </Button>
            )}
          </div>
        }
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
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
            <span className="flex items-center gap-2 font-bold"><AlertCircle size={15} />{error}</span>
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setReloadKey((k) => k + 1)}>
              تلاش دوباره
            </Button>
          </div>
        </Card>
      )}

      <Tabs tabs={tabs} activeId={tab} onChange={(id) => setTab(id as TabId)} />

      {tab === 'meetings' && (
        meetings === null ? (
          <Card>
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
              <Loader2 size={18} className="animate-spin" /> در حال دریافت جلسات…
            </div>
          </Card>
        ) : meetings.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
              title="جلسه‌ای ثبت نشده است"
              description="با ثبت نخستین جلسه، دستور جلسه و پس از برگزاری صورت‌جلسه و مصوبات همین‌جا ثبت می‌شود."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {meetings.map((meeting) => {
              const badge = MEETING_BADGE[meeting.status] ?? { label: meeting.status, variant: 'neutral' as const };
              return (
                <Card key={meeting.ulid} className="text-right">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{meeting.title}</h3>
                    </div>
                    {canManage && (
                      <Button size="sm" variant="outline" icon={<Pencil size={13} />} onClick={() => openMeetingEdit(meeting)}>
                        صورت‌جلسه / وضعیت
                      </Button>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 mt-2 flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1"><Calendar size={11} /> {formatJalaliDateTime(meeting.heldAt)}</span>
                    {meeting.location && <span className="flex items-center gap-1"><MapPin size={11} /> {meeting.location}</span>}
                  </div>

                  {meeting.agenda.length > 0 && (
                    <div className="mt-2">
                      <span className="text-[11px] font-bold text-[#526176] dark:text-[#B3C0D2] block mb-1">دستور جلسه:</span>
                      <ul className="list-disc list-inside text-xs text-[#526176] dark:text-[#B3C0D2] space-y-0.5 pr-1">
                        {meeting.agenda.map((item, index) => <li key={index}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {meeting.minutes && (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed">
                      <strong className="flex items-center gap-1 mb-1"><FileText size={11} /> صورت‌جلسه:</strong>
                      {meeting.minutes}
                    </div>
                  )}

                  {meeting.resolutions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {meeting.resolutions.map((resolution, index) => (
                        <span key={index} className="text-[11px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 px-2 py-1 rounded-lg">
                          مصوبه: {resolution}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      )}

      {tab === 'surveys' && (
        surveys === null ? (
          <Card>
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#526176] dark:text-[#B3C0D2]">
              <Loader2 size={18} className="animate-spin" /> در حال دریافت نظرسنجی‌ها…
            </div>
          </Card>
        ) : surveys.length === 0 ? (
          <Card>
            <EmptyState
              icon={<BarChart3 size={22} className="text-[#2457C5] dark:text-[#8BAEFF]" />}
              title="نظرسنجی فعالی نیست"
              description="نظرسنجی‌ها با گزینه‌های مشخص و سیاست رأی (هر ولی یا هر خانواده) ساخته می‌شوند."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {surveys.map((survey) => {
              const maxVotes = Math.max(1, ...survey.options.map((o) => o.votes));
              return (
                <Card key={survey.ulid} className="text-right">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={survey.isOpen ? 'success' : 'neutral'}>
                        {survey.isOpen ? 'باز برای رأی' : 'بسته'}
                      </Badge>
                      <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{survey.title}</h3>
                      <Badge variant="primary">
                        {survey.policy === 'per_family' ? 'هر خانواده یک رأی' : 'هر ولی یک رأی'}
                      </Badge>
                    </div>

                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={survey.isActive ? <Lock size={13} /> : <Unlock size={13} />}
                        onClick={() => toggleSurvey(survey)}
                      >
                        {survey.isActive ? 'بستن نظرسنجی' : 'بازکردن'}
                      </Button>
                    )}
                  </div>

                  {survey.description && (
                    <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-2 leading-relaxed">{survey.description}</p>
                  )}

                  <div className="mt-3 space-y-2">
                    {survey.options.map((option) => {
                      const percent = survey.totalVotes === 0 ? 0 : Math.round((option.votes / survey.totalVotes) * 100);
                      const mine = survey.myVote === option.id;

                      return (
                        <div key={option.id} className={cn('p-2.5 rounded-xl border', mine ? 'border-[#2457C5] bg-blue-50/40 dark:bg-blue-950/20' : 'border-[#DCE3EE] dark:border-[#344257]')}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex items-center gap-1.5 font-semibold text-[#202B3C] dark:text-[#F1F5FB]">
                              {mine && <CheckCircle2 size={13} className="text-[#2457C5]" />}
                              {option.text}
                            </span>
                            <span className="text-slate-400 tabular-nums text-[11px]">
                              {toPersianDigits(option.votes)} رأی ({toPersianDigits(percent)}٪)
                            </span>
                          </div>

                          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-[#2457C5] dark:bg-[#8BAEFF]" style={{ width: `${Math.round((option.votes / maxVotes) * 100)}%` }} />
                          </div>

                          {canVote && survey.isOpen && !survey.myVote && (
                            <div className="mt-2 flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                icon={<Vote size={13} />}
                                disabled={voting === `${survey.ulid}:${option.id}`}
                                onClick={() => handleVote(survey, option.id)}
                              >
                                {voting === `${survey.ulid}:${option.id}` ? 'در حال ثبت…' : 'رأی می‌دهم'}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
                    <span>مجموع آرا: {toPersianDigits(survey.totalVotes)}</span>
                    <span>{survey.closesAt ? `مهلت: ${formatJalaliDateTime(survey.closesAt)}` : 'بدون مهلت'}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Create meeting */}
      <Modal isOpen={isMeetingOpen} onClose={() => setIsMeetingOpen(false)} title="جلسهٔ جدید انجمن اولیا" maxWidth="md">
        <form onSubmit={handleCreateMeeting} className="space-y-4 text-right">
          <FormField label="عنوان جلسه" required>
            <input
              type="text"
              required
              value={mTitle}
              onChange={(e) => setMTitle(e.target.value)}
              placeholder="جلسهٔ ماهانهٔ انجمن اولیا"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="زمان جلسه" required>
              <JalaliDateTimePicker value={mDate} onChange={setMDate} />
            </FormField>
            <FormField label="محل برگزاری">
              <input
                type="text"
                value={mLocation}
                onChange={(e) => setMLocation(e.target.value)}
                placeholder="سالن اجتماعات"
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              />
            </FormField>
          </div>

          <FormField label="دستور جلسه (هر خط یک بند)">
            <textarea
              rows={3}
              value={mAgenda}
              onChange={(e) => setMAgenda(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsMeetingOpen(false)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving || !mTitle.trim() || !mDate}>
              {isSaving ? 'در حال ثبت…' : 'ثبت جلسه'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit meeting */}
      <Modal
        isOpen={editMeeting !== null}
        onClose={() => setEditMeeting(null)}
        title={`صورت‌جلسه — ${editMeeting?.title ?? ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleUpdateMeeting} className="space-y-4 text-right">
          <FormField label="وضعیت جلسه">
            <select
              value={emStatus}
              onChange={(e) => setEmStatus(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              <option value="upcoming">پیش‌رو</option>
              <option value="held">برگزار شد</option>
              <option value="cancelled">لغو شد</option>
            </select>
          </FormField>

          <FormField label="دستور جلسه (هر خط یک بند)">
            <textarea
              rows={3}
              value={emAgenda}
              onChange={(e) => setEmAgenda(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="صورت‌جلسه">
            <textarea
              rows={4}
              value={emMinutes}
              onChange={(e) => setEmMinutes(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="مصوبات (هر خط یک مصوبه)">
            <textarea
              rows={3}
              value={emResolutions}
              onChange={(e) => setEmResolutions(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setEditMeeting(null)}>انصراف</Button>
            <Button variant="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'در حال ذخیره…' : 'ذخیرهٔ صورت‌جلسه'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create survey */}
      <Modal isOpen={isSurveyOpen} onClose={() => setIsSurveyOpen(false)} title="نظرسنجی جدید انجمن" maxWidth="md">
        <form onSubmit={handleCreateSurvey} className="space-y-4 text-right">
          <FormField label="عنوان نظرسنجی" required>
            <input
              type="text"
              required
              value={sTitle}
              onChange={(e) => setSTitle(e.target.value)}
              placeholder="ساعت شروع کلاس‌ها در زمستان"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="توضیحات">
            <textarea
              rows={2}
              value={sDescription}
              onChange={(e) => setSDescription(e.target.value)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="space-y-2">
            <span className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] block">گزینه‌ها (حداقل دو مورد):</span>
            {sOptions.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => setSOptions(sOptions.map((o, i) => (i === index ? e.target.value : o)))}
                  placeholder={`گزینهٔ ${index + 1}`}
                  className="flex-1 text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
                />
                {sOptions.length > 2 && (
                  <Button size="sm" variant="ghost" type="button" onClick={() => setSOptions(sOptions.filter((_, i) => i !== index))}>
                    حذف
                  </Button>
                )}
              </div>
            ))}
            {sOptions.length < 10 && (
              <Button size="sm" variant="outline" type="button" icon={<Plus size={13} />} onClick={() => setSOptions([...sOptions, ''])}>
                افزودن گزینه
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="سیاست رأی">
              <select
                value={sPolicy}
                onChange={(e) => setSPolicy(e.target.value as 'per_guardian' | 'per_family')}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              >
                <option value="per_guardian">هر ولی یک رأی</option>
                <option value="per_family">هر خانواده یک رأی</option>
              </select>
            </FormField>
            <FormField label="مهلت رأی (اختیاری)">
              <JalaliDateTimePicker value={sClosesAt} onChange={setSClosesAt} />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsSurveyOpen(false)}>انصراف</Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSaving || !sTitle.trim() || sOptions.filter((o) => o.trim()).length < 2}
            >
              {isSaving ? 'در حال ایجاد…' : 'ایجاد نظرسنجی'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
