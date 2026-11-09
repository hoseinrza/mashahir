import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Loader2, AlertCircle, RefreshCw, Calendar, BarChart3, Vote, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader, EmptyState, AccessDeniedGate } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { formatJalaliDateTime } from '../../utils/jalali';
import { ApiPtaService, PtaMeetingRow, PtaSurveyRow } from '../../api/data';
import { ApiError } from '../../api/client';

export const PtaPresidentDashboard: React.FC = () => {
  const { currentUser, activeRole, hasAccess } = useAuth();
  const isAuthorized = hasAccess('pta:view') || hasAccess('pta:manage') || hasAccess('pta:vote');

  const [meetings, setMeetings] = useState<PtaMeetingRow[] | null>(null);
  const [surveys, setSurveys] = useState<PtaSurveyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;

    setError(null);

    Promise.all([ApiPtaService.meetings(), ApiPtaService.surveys()])
      .then(([meetingRows, surveyRows]) => {
        if (cancelled) return;
        setMeetings(meetingRows);
        setSurveys(surveyRows);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.firstError() : 'خطا در دریافت دادهٔ انجمن'); });

    return () => { cancelled = true; };
  }, [isAuthorized, reloadKey]);

  const nextMeeting = useMemo(
    () => (meetings ?? []).find((meeting) => meeting.status === 'upcoming') ?? null,
    [meetings],
  );

  const openSurveys = (surveys ?? []).filter((survey) => survey.isOpen);
  const votedCount = (surveys ?? []).filter((survey) => survey.myVote !== null).length;

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی به میز انجمن اولیا"
        requiredRoleOrPermission="pta:view / pta:vote"
        reason="جلسات و نظرسنجی‌های انجمن برای اعضای انجمن اولیا و اولیای دانش‌آموزان نمایش داده می‌شود."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`میز انجمن اولیا و مربیان — ${currentUser.fullName}`}
        subtitle="جلسات پیش‌رو، نظرسنجی‌های باز و مشارکت خانواده‌ها"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReloadKey((k) => k + 1)}>
              به‌روزرسانی
            </Button>
            <Link to="/pta">
              <Button variant="primary" size="sm" icon={<Users size={15} />}>ورود به میز انجمن</Button>
            </Link>
          </div>
        }
      />

      {error && (
        <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200 font-bold">
            <AlertCircle size={15} /> {error}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <div className="text-lg font-bold text-[#2457C5] dark:text-[#8BAEFF]">
            {meetings === null ? '…' : toPersianDigits(meetings.length)}
          </div>
          <div className="text-[11px] text-slate-400">جلسات ثبت‌شده</div>
        </Card>
        <Card className="text-center">
          <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
            {surveys === null ? '…' : toPersianDigits(openSurveys.length)}
          </div>
          <div className="text-[11px] text-slate-400">نظرسنجی باز</div>
        </Card>
        <Card className="text-center">
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
            {surveys === null ? '…' : toPersianDigits(votedCount)}
          </div>
          <div className="text-[11px] text-slate-400">رأی‌های شما</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="text-right">
          <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-[#2457C5]" />
            جلسهٔ پیش‌رو
          </h3>

          {meetings === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#526176] dark:text-[#B3C0D2]">
              <Loader2 size={16} className="animate-spin" /> …
            </div>
          ) : nextMeeting === null ? (
            <EmptyState
              icon={<Users size={20} className="text-[#2457C5]" />}
              title="جلسهٔ پیش‌رویی ثبت نشده"
              description="جلسات آیندهٔ انجمن همراه با دستور جلسه در همین کارت نمایش داده می‌شوند."
            />
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB] block">{nextMeeting.title}</strong>
              <span className="text-[11px] text-slate-500 block mt-1">
                {formatJalaliDateTime(nextMeeting.heldAt)}
                {nextMeeting.location ? ` · ${nextMeeting.location}` : ''}
              </span>
              {nextMeeting.agenda.length > 0 && (
                <ul className="list-disc list-inside text-[11px] text-[#526176] dark:text-[#B3C0D2] mt-2 space-y-0.5">
                  {nextMeeting.agenda.slice(0, 4).map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              )}
            </div>
          )}
        </Card>

        <Card className="text-right">
          <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
            <BarChart3 size={16} className="text-[#2457C5]" />
            نظرسنجی‌های باز
          </h3>

          {surveys === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#526176] dark:text-[#B3C0D2]">
              <Loader2 size={16} className="animate-spin" /> …
            </div>
          ) : openSurveys.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">نظرسنجی بازی وجود ندارد.</p>
          ) : (
            <div className="space-y-2">
              {openSurveys.slice(0, 4).map((survey) => (
                <div key={survey.ulid} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[#202B3C] dark:text-[#F1F5FB]">{survey.title}</strong>
                    <Badge variant={survey.myVote ? 'success' : 'warning'}>
                      {survey.myVote ? <><Vote size={11} /> رأی داده‌اید</> : 'در انتظار رأی شما'}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    {toPersianDigits(survey.totalVotes)} رأی · {survey.closesAt ? `مهلت ${formatJalaliDateTime(survey.closesAt)}` : 'بدون مهلت'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Link to="/pta" className="inline-flex items-center gap-1 mt-3 text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
            <ArrowLeft size={12} /> رفتن به نظرسنجی‌ها
          </Link>
        </Card>
      </div>
    </div>
  );
};
