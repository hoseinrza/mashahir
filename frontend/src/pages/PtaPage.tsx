import React, { useState } from 'react';
import {
  Users, Vote, MessageSquare, Calendar, CheckCircle2,
  Clock, Plus, Send, AlertCircle, FileText, ChevronLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, Tabs, PageHeader } from '../components/common';
import { toPersianDigits, cn } from '../utils/persian';
import { PtaService } from '../services';
import { CommitteeMeeting, Survey, FeedbackItem } from '../types';

export const PtaPage: React.FC = () => {
  const { currentUser, activeRole } = useAuth();
  const isPtaAdmin = activeRole.id === 'pta_president' || activeRole.group === 'school_admin';

  const [activeTab, setActiveTab] = useState<'meetings' | 'surveys' | 'feedback'>('meetings');
  const [meetings] = useState<CommitteeMeeting[]>(() => PtaService.getMeetings());
  const [surveys, setSurveys] = useState<Survey[]>(() => PtaService.getSurveys());
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(() => PtaService.getFeedbacks());

  // Survey voting state
  const [userVotedSurveyId, setUserVotedSurveyId] = useState<string | null>(null);

  // New feedback modal
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<'آموزشی' | 'انضباطی' | 'امکانات' | 'برنامه‌ریزی'>('برنامه‌ریزی');
  const [feedbackDescription, setFeedbackDescription] = useState('');

  const handleVote = (surveyId: string, optionId: string) => {
    const updated = PtaService.voteSurvey(surveyId, optionId, currentUser.id);
    setSurveys(updated);
    setUserVotedSurveyId(surveyId);
  };

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackTitle || !feedbackDescription) return;

    const newFb = PtaService.submitFeedback({
      senderName: currentUser.fullName,
      senderRole: activeRole.persianTitle,
      category: feedbackCategory,
      title: feedbackTitle,
      description: feedbackDescription,
    });

    setFeedbacks([newFb, ...feedbacks]);
    setIsFeedbackModalOpen(false);
    setFeedbackTitle('');
    setFeedbackDescription('');
  };

  const tabs = [
    { id: 'meetings', label: 'نشست‌ها و مصوبات مجمع' },
    { id: 'surveys', label: 'نظرسنجی‌ها و رأی‌گیری آنلاین' },
    { id: 'feedback', label: 'پیشنهادها، انتقادها و پاسخ مدیریت' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="انجمن اولیا و مربیان دبیرستان مشاهیر آینده"
        subtitle="مشارکت فعال خانواده‌ها در تصمیم‌گیری‌ها، نظرسنجی‌ها و پیگیری مطالبات آموزشی"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => setIsFeedbackModalOpen(true)}
          >
            ثبت پیشنهاد یا انتقاد
          </Button>
        }
      />

      <Tabs tabs={tabs} activeId={activeTab} onChange={(id) => setActiveTab(id as any)} />

      {/* Tab 1: Meetings & Resolutions */}
      {activeTab === 'meetings' && (
        <div className="space-y-4">
          {meetings.map((m) => (
            <Card key={m.id} className="text-right">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={m.status === 'upcoming' ? 'warning' : 'success'}>
                      {m.status === 'upcoming' ? 'نشست پیش‌رو' : 'برگزار شده'}
                    </Badge>
                    <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">محل: {m.location}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">{m.title}</h3>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#526176] dark:text-[#B3C0D2]">
                  <div className="flex items-center gap-1 font-mono tabular-nums">
                    <Calendar size={14} className="text-[#2457C5]" />
                    <span>{m.date}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono tabular-nums">
                    <Clock size={14} />
                    <span>ساعت {m.time}</span>
                  </div>
                </div>
              </div>

              {/* Agenda */}
              <div className="py-3 text-xs space-y-2">
                <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB] block">دستور جلسه نشست:</span>
                <ul className="list-disc list-inside space-y-1 text-[#526176] dark:text-[#B3C0D2] pr-2 leading-relaxed">
                  {m.agenda.map((ag, idx) => (
                    <li key={idx}>{ag}</li>
                  ))}
                </ul>
              </div>

              {/* Minutes & Resolutions if completed */}
              {m.resolutions && m.resolutions.length > 0 && (
                <div className="mt-2 p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 block mb-1">
                    مصوبات قطعی هیئت رئیسه و امنا:
                  </span>
                  <ul className="space-y-1 text-emerald-800 dark:text-emerald-300 pr-2 list-disc list-inside">
                    {m.resolutions.map((res, rIdx) => (
                      <li key={rIdx}>{res}</li>
                    ))}
                  </ul>
                  {m.minutes && (
                    <p className="mt-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                      <strong>خلاصه صورت‌جلسه:</strong> {m.minutes}
                    </p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Tab 2: Surveys & Polls */}
      {activeTab === 'surveys' && (
        <div className="space-y-4">
          {surveys.map((srv) => {
            const totalVotes = srv.options.reduce((acc, o) => acc + o.votesCount, 0);
            const hasVoted = srv.userVotedOptionId !== undefined || userVotedSurveyId === srv.id;

            return (
              <Card key={srv.id} className="text-right">
                <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EE] dark:border-[#344257] mb-3">
                  <div>
                    <Badge variant="primary">نظرسنجی رسمی انجمن</Badge>
                    <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB] mt-1">{srv.title}</h3>
                  </div>
                  <span className="text-xs text-rose-700 dark:text-rose-400 font-mono">
                    مهلت: {srv.expiresAt}
                  </span>
                </div>

                <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed mb-4">
                  {srv.description}
                </p>

                {/* Anti-Duplicate Voting Policy Flag */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 mb-4 flex items-center justify-between">
                  <span>سیاست رأی‌گیری: <strong>{srv.scopeType === 'per_family' ? 'هر خانواده ۱ رأی مستقل' : 'هر کاربر ۱ رأی'}</strong></span>
                  <span className="text-slate-400">مجموع آرا: <strong className="tabular-nums font-bold text-[#2457C5] dark:text-[#8BAEFF]">{toPersianDigits(totalVotes)}</strong> رأی</span>
                </div>

                {/* Options and voting bars */}
                <div className="space-y-2.5">
                  {srv.options.map((opt) => {
                    const percent = totalVotes > 0 ? Math.round((opt.votesCount / totalVotes) * 100) : 0;
                    const isMyChoice = srv.userVotedOptionId === opt.id;

                    return (
                      <div
                        key={opt.id}
                        onClick={() => !hasVoted && handleVote(srv.id, opt.id)}
                        className={cn(
                          'p-3 rounded-xl border transition-all text-xs select-none',
                          !hasVoted && 'hover:border-[#2457C5] cursor-pointer',
                          isMyChoice
                            ? 'border-[#2457C5] bg-blue-50/70 dark:bg-blue-950/40 font-bold'
                            : 'border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231]'
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span>{opt.text} {isMyChoice && <span className="text-[#2457C5] mr-1">(رأی شما)</span>}</span>
                          <span className="font-mono tabular-nums text-slate-500">
                            {toPersianDigits(percent)}٪ ({toPersianDigits(opt.votesCount)} رأی)
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#2457C5] dark:bg-[#8BAEFF] h-full rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasVoted && (
                  <div className="mt-3 text-center text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    ✓ رأی شما با موفقیت در این نظرسنجی ثبت گردید.
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Tab 3: Feedback & Suggestions */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          {feedbacks.map((fb) => (
            <Card key={fb.id} className="text-right">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#DCE3EE] dark:border-[#344257] mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="primary">{fb.category}</Badge>
                  <h4 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{fb.title}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">{fb.submittedDate}</span>
                  <Badge variant={fb.status === 'responded' ? 'success' : 'warning'}>
                    {fb.status === 'responded' ? 'پاسخ داده شد' : 'در دست بررسی'}
                  </Badge>
                </div>
              </div>

              <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed py-2">
                {fb.description}
              </p>
              <div className="text-[11px] text-slate-400">
                ارسال‌شده توسط: <strong>{fb.senderName}</strong> ({fb.senderRole})
              </div>

              {fb.schoolResponse && (
                <div className="mt-3 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs">
                  <span className="font-bold text-[#2457C5] dark:text-[#8BAEFF] block mb-1">
                    پاسخ رسمی مدیریت دبیرستان ({fb.respondedBy}):
                  </span>
                  <p className="text-[#202B3C] dark:text-[#F1F5FB] leading-relaxed">{fb.schoolResponse}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Feedback Modal */}
      <Modal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        title="ثبت پیشنهاد یا انتقاد به مدیریت و انجمن اولیا"
        maxWidth="md"
      >
        <form onSubmit={handleSendFeedback} className="space-y-4 text-right">
          <FormField label="دسته‌بندی موضوع" required>
            <select
              value={feedbackCategory}
              onChange={(e) => setFeedbackCategory(e.target.value as any)}
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            >
              <option value="برنامه‌ریزی">برنامه‌ریزی و تقویم آموزشی</option>
              <option value="آموزشی">کیفیت تدریس و تکالیف</option>
              <option value="انضباطی">امور پرورشی و انضباطی</option>
              <option value="امکانات">تجهیزات، کتابخانه و آزمایشگاه</option>
            </select>
          </FormField>

          <FormField label="عنوان پیشنهاد یا نظر" required>
            <input
              type="text"
              required
              value={feedbackTitle}
              onChange={(e) => setFeedbackTitle(e.target.value)}
              placeholder="مثال: افزایش زمان استراحت بین زنگ‌های فیزیک"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="شرح تفصیلی پیشنهاد" required>
            <textarea
              rows={4}
              required
              value={feedbackDescription}
              onChange={(e) => setFeedbackDescription(e.target.value)}
              placeholder="نکات خود را به صورت شفاف و سازنده جهت طرح در جلسه هیئت مدیره انجمن بنویسید..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsFeedbackModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" icon={<Send size={14} />}>
              ارسال به شورای انجمن اولیا
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
