import React, { useState } from 'react';
import {
  CheckSquare, FileText, Award, CheckCircle2, User,
  Calendar, AlertCircle, Save
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader, AccessDeniedGate, RolePermissionBadge } from '../components/common';
import { toPersianDigits, formatScore } from '../utils/persian';
import { ExamService } from '../services';

export const EssayGradingPage: React.FC = () => {
  const { currentUser, activeRole, hasAccess } = useAuth();
  const isAuthorized = hasAccess('exam:grade_essay') || activeRole.id === 'teacher' || activeRole.id === 'essay_grader' || activeRole.group === 'school_admin';

  if (!isAuthorized) {
    return (
      <AccessDeniedGate
        title="دسترسی به پنل تصحیح اوراق تشریحی آزمون"
        requiredRoleOrPermission="exam:grade_essay (دبیر یا مصحح آزمون)"
        reason="تصحیح پاسخ‌های تشریحی و درج بارم نمره منحصراً در اختیار کادر ارزیابی آزمون است و سایر کاربران مجاز به ورود به این سامانه نیستند."
        currentRoleTitle={activeRole.persianTitle}
      />
    );
  }

  const exams = ExamService.getExams();
  const mathExam = exams[0];
  const essayQuestion = mathExam.questions?.find((q) => q.type === 'essay');

  // Sample student essay answers needing grading
  const [essaySubmissions, setEssaySubmissions] = useState([
    {
      id: 'sub_essay_1',
      studentName: 'پارسا رادمنش',
      studentNumber: '۴۰۲۱۰۱۰۰۱',
      className: 'کلاس ۱۰۱ (ریاضی)',
      submittedAt: '۱۰:۲۲',
      studentAnswer: 'طرفین معادله را به توان ۲ می‌رسانیم: x + 3 = (x - 3)² = x² - 6x + 9. معادله درجه دو به دست می‌آید: x² - 7x + 6 = 0. با تجزیه: (x - 1)(x - 6) = 0. ریشه‌ها x=1 و x=6 هستند. اما چون x-3 زیر رادیکال برابر ریشه زوج است، x-3 باید بزرگتر یا مساوی صفر باشد (x >= 3). بنابراین ریشه x=1 غیرقابل قبول است و تنها پاسخ x=6 قابل قبول است.',
      score: 4,
      feedback: 'پاسخ کاملاً علمی و با بررسی شرط دامنه و ریشه کاذب نوشته شده است. نمره کامل تعلق می‌گیرد.',
      isGraded: true,
    },
    {
      id: 'sub_essay_2',
      studentName: 'بردیا سلطانی',
      studentNumber: '۴۰۲۱۰۱۰۰۳',
      className: 'کلاس ۱۰۱ (ریاضی)',
      submittedAt: '۱۰:۲۴',
      studentAnswer: 'معادله را به توان ۲ می‌رسانیم و ریشه‌های ۱ و ۶ بدست می‌آیند. هر دو جواب معادله هستند.',
      score: 2,
      feedback: 'ریشه x=1 در معادله اولیه صدق نمی‌کند (جذر ۴ برابر ۲ است ولی ۱-۳ برابر منفی ۲ می‌شود). نمره به دلیل عدم بررسی ریشه کاذب کسر شد.',
      isGraded: false,
    },
  ]);

  const [selectedSub, setSelectedSub] = useState<(typeof essaySubmissions)[0] | null>(null);
  const [scoreInput, setScoreInput] = useState<number>(4);
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openGradingModal = (sub: (typeof essaySubmissions)[0]) => {
    setSelectedSub(sub);
    setScoreInput(sub.score);
    setFeedbackInput(sub.feedback);
    setIsModalOpen(true);
  };

  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;

    setEssaySubmissions((prev) =>
      prev.map((s) =>
        s.id === selectedSub.id
          ? { ...s, score: scoreInput, feedback: feedbackInput, isGraded: true }
          : s
      )
    );

    ExamService.gradeEssayQuestion(
      mathExam.id,
      selectedSub.studentNumber,
      essayQuestion?.id || 'q_5',
      scoreInput,
      feedbackInput,
      currentUser.fullName
    );

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="سامانه تصحیح سوالات تشریحی آزمون‌ها"
        subtitle="ارزیابی پاسخ‌های متنی و استدلالی دانش‌آموزان توسط دبیر یا مصحح مجاز"
      />

      {/* Exam and Question Banner */}
      <Card className="text-right">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="primary">{mathExam.subject}</Badge>
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">{mathExam.title}</span>
        </div>
        <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">
          صورت سوال تشریحی ({toPersianDigits(essayQuestion?.score || 4)} نمره):
        </h3>
        <p className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-1 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
          {essayQuestion?.prompt}
        </p>
      </Card>

      {/* Submissions List */}
      <div className="space-y-3">
        {essaySubmissions.map((sub) => (
          <Card key={sub.id} className="text-right">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#2457C5] flex items-center justify-center font-bold text-xs">
                  {sub.studentName.slice(0, 1)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">{sub.studentName}</h4>
                  <span className="text-[11px] text-[#526176] dark:text-[#B3C0D2]">
                    شماره دانش‌آموزی: <span className="font-mono tabular-nums">{sub.studentNumber}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {sub.isGraded ? (
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg tabular-nums">
                    نمره ثبت‌شده: {formatScore(sub.score)} از {toPersianDigits(4)}
                  </span>
                ) : (
                  <Badge variant="warning">نیازمند تصحیح</Badge>
                )}
                <Button size="sm" variant="outline" onClick={() => openGradingModal(sub)}>
                  {sub.isGraded ? 'ویرایش نمره' : 'تصحیح و ثبت نمره'}
                </Button>
              </div>
            </div>

            <div className="pt-3 space-y-2">
              <span className="text-xs font-bold text-[#526176] dark:text-[#B3C0D2] block">
                متن پاسخ ارسالی دانش‌آموز:
              </span>
              <p className="text-xs text-[#202B3C] dark:text-[#F1F5FB] leading-relaxed bg-[#F7F9FC] dark:bg-[#101722]/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                {sub.studentAnswer}
              </p>

              {sub.feedback && (
                <div className="text-xs text-[#526176] dark:text-[#B3C0D2] pt-2">
                  <strong className="text-[#2457C5] dark:text-[#8BAEFF]">بازخورد مصحح: </strong>
                  <span>{sub.feedback}</span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Grading Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`تصحیح برگه ${selectedSub?.studentName || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveGrade} className="space-y-4 text-right">
          <FormField label="نمره از ۴" required>
            <input
              type="number"
              step="0.5"
              min="0"
              max="4"
              required
              value={scoreInput}
              onChange={(e) => setScoreInput(parseFloat(e.target.value))}
              className="w-full text-sm p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-bold font-mono tabular-nums"
            />
          </FormField>

          <FormField label="بازخورد تشریحی و دلیل نمره" required>
            <textarea
              rows={4}
              required
              value={feedbackInput}
              onChange={(e) => setFeedbackInput(e.target.value)}
              placeholder="توضیح دلایل کسر نمره یا نکات قوت استدلال دانش‌آموز..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" type="submit">
              ثبت و اعمال در کارنامه
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
