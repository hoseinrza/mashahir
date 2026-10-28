import React, { useState, useEffect } from 'react';
import {
  FileText, Clock, CheckCircle2, Bookmark, ArrowLeft, ArrowRight,
  AlertCircle, Check, RotateCcw, Award, ShieldAlert, Sparkles,
  Plus, Users, BookOpen, Layers, Lock, Eye, Calendar
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader, AccessDeniedGate } from '../components/common';
import { toPersianDigits, formatScore, cn } from '../utils/persian';
import { ExamService } from '../services';
import { Exam, ExamAttempt } from '../types';

export const OnlineExamPage: React.FC = () => {
  const { currentUser, activeRole, hasAccess } = useAuth();

  const isBusDriver = activeRole.id === 'bus_driver';
  const isFamily = activeRole.group === 'family';
  const isStudent = activeRole.group === 'student';
  const isTeacher = activeRole.id === 'teacher' || activeRole.group === 'faculty';
  const isAdmin = activeRole.group === 'school_admin' || activeRole.group === 'platform';

  // Section 18 & 31: Bus driver has no access to exams
  if (isBusDriver) {
    return (
      <AccessDeniedGate
        title="عدم دسترسی به سامانه آزمون‌های آنلاین"
        requiredRoleOrPermission="exam:take یا exam:create (دانش‌آموزان یا دبیران)"
        reason="طبق مفاد ماده ۱۸ و ۳۱ سند جامع حاکمیت داده، حساب راننده سرویس فاقد هرگونه دسترسی به محتوای آموزشی و آزمون‌های آنلاین است."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  // Active view tab for Staff: 'manage' vs 'take'
  const defaultTab = isTeacher || isAdmin ? 'manage' : 'take';
  const [activeTab, setActiveTab] = useState<'manage' | 'take'>(defaultTab);

  const [exams, setExams] = useState<Exam[]>(() => ExamService.getExams());
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || 'ex_1');

  const activeExam = exams.find((e) => e.id === selectedExamId) || exams[0];
  const questions = activeExam?.questions || [];

  // Create Exam Modal
  const [isCreateExamOpen, setIsCreateExamOpen] = useState(false);
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamSubject, setNewExamSubject] = useState('ریاضیات و حسابان');
  const [newExamClass, setNewExamClass] = useState('کلاس ۱۰۱ (دهم ریاضی الف)');
  const [newExamDuration, setNewExamDuration] = useState(60);
  const [newExamTotalScore, setNewExamTotalScore] = useState(20);
  const [newExamDate, setNewExamDate] = useState('۱۴۰۳/۰۸/۱۰');
  const [newExamDescription, setNewExamDescription] = useState('');

  // Interactive Test Room State
  const [inExamMode, setInExamMode] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [timeLeftSeconds, setTimeLeftSeconds] = useState((activeExam?.durationMinutes || 45) * 60);
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [finalScoreResult, setFinalScoreResult] = useState<{ autoScore: number; maxScore: number } | null>(null);

  // Timer countdown when in exam mode
  useEffect(() => {
    if (!inExamMode || isSubmitted) return;
    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [inExamMode, isSubmitted]);

  // Handle select multiple choice
  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    setAutoSaveStatus('saving');
    setTimeout(() => setAutoSaveStatus('saved'), 400);
  };

  // Handle essay change
  const handleEssayChange = (questionId: string, text: string) => {
    setEssayAnswers((prev) => ({ ...prev, [questionId]: text }));
    setAutoSaveStatus('saving');
    setTimeout(() => setAutoSaveStatus('saved'), 500);
  };

  // Toggle flag
  const toggleFlag = (questionId: string) => {
    setFlaggedQuestions((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  // Final submission calculation
  const handleSubmitExam = () => {
    let autoScore = 0;
    questions.forEach((q) => {
      if (q.type === 'multiple_choice' && selectedAnswers[q.id] === q.correctOptionIndex) {
        autoScore += q.score;
      }
    });

    const attempt: ExamAttempt = {
      id: `att_${Date.now()}`,
      examId: activeExam.id,
      studentId: currentUser.id,
      studentName: currentUser.fullName,
      startedAt: '۱۰:۰۰',
      submittedAt: '۱۰:۲۲',
      isCompleted: true,
      autoScore,
      answers: questions.map((q) => ({
        questionId: q.id,
        selectedOption: selectedAnswers[q.id],
        essayAnswer: essayAnswers[q.id],
        isFlaggedForReview: flaggedQuestions[q.id],
        scoreAwarded: q.type === 'multiple_choice' ? (selectedAnswers[q.id] === q.correctOptionIndex ? q.score : 0) : undefined,
      })),
    };

    ExamService.saveAttempt(attempt);
    setFinalScoreResult({ autoScore, maxScore: 16 });
    setIsSubmitted(true);
    setIsConfirmSubmitOpen(false);
  };

  const handleCreateExamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamTitle.trim()) return;

    const created = ExamService.createExam(
      {
        classroomId: 'cls_101',
        className: newExamClass,
        type: 'online',
        title: newExamTitle,
        subject: newExamSubject,
        teacherId: currentUser.id,
        teacherName: currentUser.fullName,
        durationMinutes: newExamDuration,
        totalScore: newExamTotalScore,
        date: newExamDate,
        startTime: '۱۰:۰۰',
        isPublished: true,
        description: newExamDescription || 'آزمون آنلاین دوره‌ای با نظارت هوشمند و سوالات استاندارد.',
        questions: [
          {
            id: `q_${Date.now()}_1`,
            type: 'multiple_choice',
            prompt: 'سوال ۱: کدام گزینه بیانگر ضابطه تابع وارون‌پذیر در دامنه مشخص است؟',
            options: ['f(x) = x² + 1', 'f(x) = 2x - 3', 'f(x) = |x|', 'f(x) = [x]'],
            correctOptionIndex: 1,
            score: 4,
          },
        ],
      },
      currentUser.fullName
    );

    setExams(ExamService.getExams());
    setSelectedExamId(created.id);
    setIsCreateExamOpen(false);
    setNewExamTitle('');
  };

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const timeFormatted = `${toPersianDigits(minutes.toString().padStart(2, '0'))}:${toPersianDigits(seconds.toString().padStart(2, '0'))}`;

  const currentQ = questions[currentQuestionIndex];

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          isTeacher || isAdmin
            ? 'مدیریت و بانک آزمون‌های آنلاین مدرسه'
            : isFamily
            ? 'گزارش آزمون‌های آنلاین فرزند'
            : 'سامانه آزمون‌های آنلاین من'
        }
        subtitle="سامانه یکپارچه طراحی، زمان‌بندی، شرکت در آزمون زمان‌دار و تصحیح برخط"
        actions={
          (isTeacher || isAdmin) && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => setIsCreateExamOpen(true)}
            >
              طراحی آزمون جدید
            </Button>
          )
        }
      />

      {/* Tabs for Teachers and Admins */}
      {(isTeacher || isAdmin) && (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('manage')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
              activeTab === 'manage'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            )}
          >
            <Layers size={14} />
            <span>بانک و مدیریت آزمون‌ها ({toPersianDigits(exams.length)})</span>
          </button>
          <button
            onClick={() => setActiveTab('take')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
              activeTab === 'take'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            )}
          >
            <Eye size={14} />
            <span>اتاق شرکت در آزمون (پیش‌نمایش تعاملی)</span>
          </button>
        </div>
      )}

      {/* TAB 1: EXAM MANAGEMENT TABLE FOR TEACHERS & ADMINS */}
      {activeTab === 'manage' && (isTeacher || isAdmin) && (
        <div className="space-y-4">
          <Card className="text-right">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <FileText size={16} className="text-[#2457C5]" />
              فهرست آزمون‌های آنلاین تعریف‌شده
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 pb-2">
                    <th className="py-2.5 px-3">عنوان آزمون</th>
                    <th className="py-2.5 px-3">درس</th>
                    <th className="py-2.5 px-3">طراح</th>
                    <th className="py-2.5 px-3 text-center">مدت زمان</th>
                    <th className="py-2.5 px-3 text-center">نمره کل</th>
                    <th className="py-2.5 px-3">تاریخ برگزاری</th>
                    <th className="py-2.5 px-3 text-center">وضعیت چرخه عمر</th>
                    <th className="py-2.5 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {exams.map((ex) => (
                    <tr key={ex.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">{ex.title}</td>
                      <td className="py-3 px-3 text-blue-600 dark:text-blue-400">{ex.subject}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{ex.teacherName}</td>
                      <td className="py-3 px-3 text-center font-mono">{toPersianDigits(ex.durationMinutes)} دقیقه</td>
                      <td className="py-3 px-3 text-center font-mono font-bold">{toPersianDigits(ex.totalScore)} نمره</td>
                      <td className="py-3 px-3 font-mono">{ex.date}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 size={11} />
                          منتشرشده و فعال
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedExamId(ex.id);
                            setActiveTab('take');
                          }}
                          className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 text-[#2457C5] dark:text-[#8BAEFF] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          مشاهده اتاق
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: ACTIVE TEST ROOM (STUDENT TAKING OR PREVIEW) */}
      {(activeTab === 'take' || isStudent || isFamily) && (
        <div className="space-y-4">
          {/* If not yet entered exam room */}
          {!inExamMode && !isSubmitted && (
            <Card className="text-right">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="primary">{activeExam.subject}</Badge>
                    <Badge variant="warning">زمان‌دار</Badge>
                    <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">مدرس: {activeExam.teacherName}</span>
                  </div>
                  <h2 className="text-xl font-bold text-[#202B3C] dark:text-[#F1F5FB]">{activeExam.title}</h2>
                  <p className="text-xs md:text-sm text-[#526176] dark:text-[#B3C0D2] mt-3 leading-relaxed max-w-2xl">
                    {activeExam.description}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-xs">
                    <div className="p-3 bg-[#F0F4FA] dark:bg-[#101722] rounded-xl">
                      <span className="text-[#526176] dark:text-[#B3C0D2] block">تعداد سوالات:</span>
                      <strong className="text-sm font-bold tabular-nums">{toPersianDigits(questions.length)} سوال</strong>
                    </div>
                    <div className="p-3 bg-[#F0F4FA] dark:bg-[#101722] rounded-xl">
                      <span className="text-[#526176] dark:text-[#B3C0D2] block">مدت زمان آزمون:</span>
                      <strong className="text-sm font-bold tabular-nums">{toPersianDigits(activeExam.durationMinutes)} دقیقه</strong>
                    </div>
                    <div className="p-3 bg-[#F0F4FA] dark:bg-[#101722] rounded-xl">
                      <span className="text-[#526176] dark:text-[#B3C0D2] block">نمره کل:</span>
                      <strong className="text-sm font-bold tabular-nums">{toPersianDigits(activeExam.totalScore)} نمره</strong>
                    </div>
                    <div className="p-3 bg-[#F0F4FA] dark:bg-[#101722] rounded-xl">
                      <span className="text-[#526176] dark:text-[#B3C0D2] block">فرصت آزمون:</span>
                      <strong className="text-sm font-bold text-emerald-600">۱ بار</strong>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-center justify-center p-6 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/40 min-w-[220px]">
                  <Clock size={36} className="text-[#2457C5] dark:text-[#8BAEFF] mb-2" />
                  <span className="text-xs font-semibold text-[#202B3C] dark:text-[#F1F5FB] mb-3">آزمون آماده شروع است</span>
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    onClick={() => setInExamMode(true)}
                  >
                    شروع آزمون آنلاین
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* In Exam Mode: Interactive Test Room */}
          {inExamMode && !isSubmitted && (
            <div className="space-y-4">
              {/* Top Sticky Test Bar */}
              <div className="bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB]">{activeExam.title}</span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[#526176] dark:text-[#B3C0D2]">وضعیت ذخیره:</span>
                    <span className={cn('text-[11px] font-semibold', autoSaveStatus === 'saved' ? 'text-emerald-600' : 'text-amber-600')}>
                      {autoSaveStatus === 'saved' ? 'ذخیره شد ✓' : 'در حال ذخیره...'}
                    </span>
                  </div>
                </div>

                {/* Timer & Finish Button */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-800 dark:text-rose-300 font-mono text-sm font-black tabular-nums">
                    <Clock size={16} />
                    <span>{timeFormatted}</span>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsConfirmSubmitOpen(true)}
                  >
                    پایان و تحویل آزمون
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Question Area (3 Cols) */}
                <div className="lg:col-span-3">
                  {currentQ && (
                    <Card className="text-right space-y-6">
                      {/* Question Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-xl bg-[#2457C5] text-white flex items-center justify-center font-bold text-xs tabular-nums">
                            {toPersianDigits(currentQuestionIndex + 1)}
                          </span>
                          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                            {currentQ.type === 'multiple_choice' ? 'سوال تستی (۴ گزینه)' : 'سوال تشریحی تحلیلی'}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs font-bold text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
                            {toPersianDigits(currentQ.score)} نمره
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleFlag(currentQ.id)}
                          className={cn(
                            'flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl transition-colors cursor-pointer',
                            flaggedQuestions[currentQ.id]
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold'
                              : 'text-slate-400 hover:text-slate-600'
                          )}
                        >
                          <Bookmark size={14} />
                          <span>علامت‌گذاری برای بررسی</span>
                        </button>
                      </div>

                      {/* Prompt */}
                      <p className="text-sm md:text-base font-semibold text-[#202B3C] dark:text-[#F1F5FB] leading-relaxed">
                        {currentQ.prompt}
                      </p>

                      {/* Multiple Choice Options */}
                      {currentQ.type === 'multiple_choice' && currentQ.options && (
                        <div className="space-y-3">
                          {currentQ.options.map((opt, optIdx) => {
                            const isSelected = selectedAnswers[currentQ.id] === optIdx;
                            return (
                              <div
                                key={optIdx}
                                onClick={() => handleSelectOption(currentQ.id, optIdx)}
                                className={cn(
                                  'p-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between cursor-pointer transition-all',
                                  isSelected
                                    ? 'border-[#2457C5] bg-blue-50/70 text-[#2457C5] dark:bg-blue-950/40 dark:border-[#8BAEFF] dark:text-[#8BAEFF]'
                                    : 'border-[#DCE3EE] dark:border-[#344257] hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                )}
                              >
                                <span>{opt}</span>
                                <div
                                  className={cn(
                                    'w-5 h-5 rounded-full border flex items-center justify-center shrink-0',
                                    isSelected
                                      ? 'border-[#2457C5] bg-[#2457C5] text-white dark:border-[#8BAEFF] dark:bg-[#8BAEFF] dark:text-slate-900'
                                      : 'border-slate-300 dark:border-slate-600'
                                  )}
                                >
                                  {isSelected && <Check size={12} />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Essay Question Area */}
                      {currentQ.type === 'essay' && (
                        <div className="space-y-2">
                          <textarea
                            rows={6}
                            placeholder="پاسخ تشریحی، فرمول‌ها و مراحل استدلال خود را در این بخش بنویسید..."
                            value={essayAnswers[currentQ.id] || ''}
                            onChange={(e) => handleEssayChange(currentQ.id, e.target.value)}
                            className="w-full text-xs sm:text-sm p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-white dark:bg-[#182231] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                          />
                        </div>
                      )}

                      {/* Navigation between Questions */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentQuestionIndex === 0}
                          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                        >
                          سوال قبلی
                        </Button>

                        <span className="text-xs text-slate-400 font-mono">
                          {toPersianDigits(currentQuestionIndex + 1)} از {toPersianDigits(questions.length)}
                        </span>

                        <Button
                          variant="primary"
                          size="sm"
                          disabled={currentQuestionIndex === questions.length - 1}
                          onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                        >
                          سوال بعدی
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Question Navigator Grid (1 Col) */}
                <div className="space-y-4">
                  <Card className="text-right">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3">
                      نقشه پاسخ‌برگ سوالات
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {questions.map((q, idx) => {
                        const isAnswered = selectedAnswers[q.id] !== undefined || Boolean(essayAnswers[q.id]?.trim());
                        const isCurrent = idx === currentQuestionIndex;
                        const isFlagged = flaggedQuestions[q.id];

                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => setCurrentQuestionIndex(idx)}
                            className={cn(
                              'h-9 rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer relative',
                              isCurrent && 'ring-2 ring-blue-600 ring-offset-2',
                              isAnswered
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                            )}
                          >
                            <span>{toPersianDigits(idx + 1)}</span>
                            {isFlagged && (
                              <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-1 right-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* After Submission Result Screen */}
          {isSubmitted && finalScoreResult && (
            <Card className="text-center p-8 space-y-4 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">آزمون شما با موفقیت ثبت و تحویل شد</h3>
              <p className="text-xs text-slate-500">
                پاسخ‌های شما در سامانه ذخیره شده و بخش تستی به صورت خودکار تصحیح گردید.
              </p>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-sm font-bold text-emerald-600 font-mono">
                نمره بخش تستی: {toPersianDigits(finalScoreResult.autoScore)} از {toPersianDigits(finalScoreResult.maxScore)} نمره
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsSubmitted(false)}>
                بازگشت به فهرست آزمون‌ها
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* MODAL: CONFIRM EXAM SUBMISSION */}
      <Modal
        isOpen={isConfirmSubmitOpen}
        onClose={() => setIsConfirmSubmitOpen(false)}
        title="تأیید تحویل نهایی آزمون آنلاین"
        maxWidth="md"
      >
        <div className="space-y-4 text-right">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            آیا از ثبت و پایان آزمون اطمینان دارید؟ پس از تحویل، امکان بازگشت به سوالات و ویرایش گزینه‌ها وجود نخواهد داشت.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsConfirmSubmitOpen(false)}>
              ادامه پاسخگویی
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmitExam}>
              تأیید و تحویل برگه
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: CREATE NEW EXAM (TEACHER / ADMIN) */}
      <Modal
        isOpen={isCreateExamOpen}
        onClose={() => setIsCreateExamOpen(false)}
        title="طراحی و زمان‌بندی آزمون آنلاین جدید"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateExamSubmit} className="space-y-4 text-right">
          <FormField label="عنوان آزمون" required>
            <input
              type="text"
              placeholder="مثلاً: آزمون آنلاین فصل دوم فیزیک و ترمودینامیک"
              value={newExamTitle}
              onChange={(e) => setNewExamTitle(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="عنوان درس" required>
              <input
                type="text"
                value={newExamSubject}
                onChange={(e) => setNewExamSubject(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                required
              />
            </FormField>

            <FormField label="کلاس هدف" required>
              <input
                type="text"
                value={newExamClass}
                onChange={(e) => setNewExamClass(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                required
              />
            </FormField>

            <FormField label="مدت زمان به دقیقه" required>
              <input
                type="number"
                value={newExamDuration}
                onChange={(e) => setNewExamDuration(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                required
              />
            </FormField>

            <FormField label="نمره کل آزمون" required>
              <input
                type="number"
                value={newExamTotalScore}
                onChange={(e) => setNewExamTotalScore(Number(e.target.value))}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                required
              />
            </FormField>
          </div>

          <FormField label="توضیحات و دستورالعمل آزمون">
            <textarea
              rows={3}
              value={newExamDescription}
              onChange={(e) => setNewExamDescription(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setIsCreateExamOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" size="sm" type="submit">
              طراحی و انتشار آزمون
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
