import React, { useState } from 'react';
import {
  BookOpen, Plus, Calendar, Clock, CheckCircle2, FileText,
  Upload, Award, Send, ChevronDown, Filter, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge, Modal, FormField, PageHeader, EmptyState, AccessDeniedGate } from '../components/common';
import { toPersianDigits, formatScore, cn } from '../utils/persian';
import { AssignmentService } from '../services';
import { Assignment, Submission } from '../types';
import { INITIAL_CLASSROOMS } from '../data/mockData';

export const AssignmentsPage: React.FC = () => {
  const { currentUser, activeRole, hasAccess, activeStudent, switchUser } = useAuth();
  const isBusDriver = activeRole.id === 'bus_driver';

  if (isBusDriver) {
    return (
      <AccessDeniedGate
        title="عدم دسترسی به تکالیف درسی کلاسی"
        requiredRoleOrPermission="assignment:create یا assignment:submit (دبیران، دانش‌آموزان یا اولیا)"
        reason="بر اساس اصول ۱۸ و ۴۰ سند جامع حاکمیت داده، حساب راننده سرویس فاقد دسترسی به تکالیف و محتوای آموزشی دانش‌آموزان است."
        currentRoleTitle={activeRole.persianTitle}
        suggestedRoleId="usr_principal"
        suggestedRoleName="دکتر احمدرضا جلالی (مدیر مدرسه)"
        onSwitchUser={switchUser}
      />
    );
  }

  const canCreate = hasAccess('assignment:create');
  const isStudent = activeRole.group === 'student' || activeRole.id === 'active_student';
  const isParent = activeRole.group === 'family' || activeRole.id === 'guardian';

  const [assignments, setAssignments] = useState<Assignment[]>(() => AssignmentService.getAssignments());
  const [submissions, setSubmissions] = useState<Submission[]>(() => AssignmentService.getSubmissions());

  // Filter
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);

  // Active items for modals
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('حسابان و ریاضیات ۱');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('۱۴۰۳/۰۸/۰۵');
  const [newDueTime, setNewDueTime] = useState('۲۳:۵۹');

  const [studentSubmitText, setStudentSubmitText] = useState('');
  const [studentSubmitFile, setStudentSubmitFile] = useState<string>('');

  const [gradeScore, setGradeScore] = useState<number>(20);
  const [gradeFeedback, setGradeFeedback] = useState<string>('');

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    const created = AssignmentService.createAssignment(
      {
        classroomId: 'cls_101',
        className: 'کلاس ۱۰۱ (ریاضی و فیزیک)',
        subject: newSubject,
        title: newTitle,
        description: newDescription,
        teacherId: currentUser.id,
        teacherName: currentUser.fullName,
        dueDate: newDueDate,
        dueTime: newDueTime,
        maxScore: 20,
      },
      currentUser.fullName
    );

    setAssignments([created, ...assignments]);
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDescription('');
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment) return;

    const submitted = AssignmentService.submitAssignment({
      assignmentId: activeAssignment.id,
      studentId: isStudent ? currentUser.id : 'std_parsa',
      studentName: isStudent ? currentUser.fullName : 'پارسا رادمنش',
      content: studentSubmitText,
      fileName: studentSubmitFile || 'پاسخ_تکلیف_دانش‌آموز.pdf',
    });

    setSubmissions([submitted, ...submissions.filter((s) => s.id !== submitted.id)]);
    setIsSubmitModalOpen(false);
    setStudentSubmitText('');
  };

  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmission) return;

    const updated = AssignmentService.gradeSubmission(
      activeSubmission.id,
      Number(gradeScore),
      gradeFeedback,
      currentUser.fullName
    );

    setSubmissions(updated);
    setIsGradeModalOpen(false);
  };

  const openSubmitDialog = (asg: Assignment) => {
    setActiveAssignment(asg);
    setStudentSubmitText('');
    setStudentSubmitFile('');
    setIsSubmitModalOpen(true);
  };

  const openGradeDialog = (sub: Submission) => {
    setActiveSubmission(sub);
    setGradeScore(sub.score ?? 20);
    setGradeFeedback(sub.feedback ?? 'تمرین با دقت انجام شده است.');
    setIsGradeModalOpen(true);
  };

  const filteredAssignments = assignments.filter((a) => {
    if (selectedSubject === 'all') return true;
    return a.subject.includes(selectedSubject);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت تکالیف و پروژه‌های درسی"
        subtitle="ارائه تمرین، ارسال پاسخ، بررسی برگه و نمره‌دهی تفصیلی همراه با بازخورد کیفی"
        actions={
          canCreate && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              تعریف تکلیف جدید
            </Button>
          )
        }
      />

      {/* Filter Bar */}
      <div className="flex items-center gap-3 pb-2 border-b border-[#DCE3EE] dark:border-[#344257]">
        <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">فیلتر درس:</span>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['all', 'حسابان', 'فیزیک', 'فارسی'].map((subj) => (
            <button
              key={subj}
              onClick={() => setSelectedSubject(subj)}
              className={cn(
                'px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer',
                selectedSubject === subj
                  ? 'bg-[#2457C5] text-white dark:bg-[#8BAEFF] dark:text-[#101722]'
                  : 'bg-white dark:bg-[#182231] text-[#526176] dark:text-[#B3C0D2] border border-[#DCE3EE] dark:border-[#344257]'
              )}
            >
              {subj === 'all' ? 'همه دروس' : subj}
            </button>
          ))}
        </div>
      </div>

      {/* Assignment List */}
      <div className="space-y-4">
        {filteredAssignments.map((asg) => {
          // Find student submission if viewing as student or parent
          const studentId = isStudent ? currentUser.id : activeStudent?.id || 'std_parsa';
          const mySubmission = submissions.find(
            (s) => s.assignmentId === asg.id && (s.studentId === studentId || s.studentId === 'std_parsa')
          );

          // All submissions for this assignment (for teachers)
          const allSubmissionsForAsg = submissions.filter((s) => s.assignmentId === asg.id);

          return (
            <Card key={asg.id} className="text-right">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-3 border-b border-[#DCE3EE]/60 dark:border-[#344257]/60">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="primary">{asg.subject}</Badge>
                    <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">{asg.className}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">مدرس: {asg.teacherName}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#202B3C] dark:text-[#F1F5FB]">{asg.title}</h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-left text-xs">
                    <span className="text-[#526176] dark:text-[#B3C0D2] block">مهلت تحویل:</span>
                    <strong className="text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                      {asg.dueDate} ساعت {asg.dueTime}
                    </strong>
                  </div>
                </div>
              </div>

              <p className="text-xs md:text-sm text-[#526176] dark:text-[#B3C0D2] py-3 leading-relaxed">
                {asg.description}
              </p>

              {/* Student / Parent View of Submission */}
              {(isStudent || isParent) && (
                <div className="p-3.5 rounded-xl bg-[#F0F4FA] dark:bg-[#101722]/60 border border-[#DCE3EE] dark:border-[#344257] mt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB] block">
                        وضعیت ارسال پاسخ {isParent ? `دانش‌آموز (${mySubmission?.studentName || 'فرزند'})` : 'شما'}:
                      </span>
                      {mySubmission ? (
                        <div className="mt-1">
                          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">
                            پاسخ در تاریخ <strong className="font-mono tabular-nums">{mySubmission.submissionDate}</strong> ثبت شده است.
                          </span>
                          {mySubmission.fileName && (
                            <span className="block text-[11px] text-[#2457C5] dark:text-[#8BAEFF] mt-0.5">
                              فایل ضمیمه: {mySubmission.fileName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-700 dark:text-amber-400 mt-1 block">
                          هنوز پاسخی ارسال نشده است.
                        </span>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {mySubmission?.status === 'graded' ? (
                        <div className="text-left">
                          <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 tabular-nums">
                            نمره: {formatScore(mySubmission.score)} از {toPersianDigits(asg.maxScore)}
                          </span>
                        </div>
                      ) : mySubmission ? (
                        <Badge variant="warning">در انتظار تصحیح توسط دبیر</Badge>
                      ) : isStudent ? (
                        <Button size="sm" variant="primary" onClick={() => openSubmitDialog(asg)}>
                          ارسال پاسخ تکلیف
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {mySubmission?.feedback && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                      <span className="font-bold text-[#2457C5] dark:text-[#8BAEFF]">بازخورد و نکات اصلاحی دبیر ({mySubmission.gradedBy}):</span>
                      <p className="text-[#202B3C] dark:text-[#F1F5FB] mt-1">{mySubmission.feedback}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Teacher View of All Submissions */}
              {canCreate && (
                <div className="mt-3 pt-3 border-t border-[#DCE3EE] dark:border-[#344257]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#202B3C] dark:text-[#F1F5FB]">
                      پاسخ‌های تحویل داده شده توسط دانش‌آموزان ({toPersianDigits(allSubmissionsForAsg.length)} مورد)
                    </span>
                  </div>

                  {allSubmissionsForAsg.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">هنوز پاسخی تحویل داده نشده است.</p>
                  ) : (
                    <div className="space-y-2">
                      {allSubmissionsForAsg.map((sub) => (
                        <div
                          key={sub.id}
                          className="p-3 rounded-xl bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">{sub.studentName}</span>
                              <span className="text-[11px] text-slate-400 font-mono">{sub.submissionDate}</span>
                            </div>
                            <p className="text-[#526176] dark:text-[#B3C0D2] mt-0.5 line-clamp-1">{sub.content}</p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {sub.status === 'graded' ? (
                              <span className="font-black text-emerald-700 dark:text-emerald-400 tabular-nums px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
                                نمره: {formatScore(sub.score)}
                              </span>
                            ) : (
                              <Badge variant="warning">نیازمند نمره</Badge>
                            )}
                            <Button size="sm" variant="outline" onClick={() => openGradeDialog(sub)}>
                              {sub.status === 'graded' ? 'ویرایش نمره' : 'ثبت نمره'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Modal: Create Assignment */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="تعریف تکلیف جدید برای کلاس"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4 text-right">
          <FormField label="عنوان تکلیف" required>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="مثال: تمرین‌های معادلات درجه دوم و رسم سهمی"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="درس مربوطه" required>
              <select
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
              >
                <option value="حسابان و ریاضیات ۱">حسابان و ریاضیات ۱</option>
                <option value="فیزیک ۱ و آزمایشگاه">فیزیک ۱ و آزمایشگاه</option>
                <option value="شیمی ۱">شیمی ۱</option>
                <option value="فارسی و نگارش ۱">فارسی و نگارش ۱</option>
              </select>
            </FormField>

            <FormField label="مهلت تحویل (تاریخ شمسی)" required>
              <input
                type="text"
                required
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
              />
            </FormField>
          </div>

          <FormField label="توضیحات و دستورالعمل تکلیف" required>
            <textarea
              rows={4}
              required
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="جزئیات تمرین، صفحات کتاب، روش ارسال و معیارهای نمره‌دهی..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" type="submit">
              انتشار و ابلاغ تکلیف به کلاس
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Student Submit */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title={`ارسال پاسخ: ${activeAssignment?.title || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleStudentSubmit} className="space-y-4 text-right">
          <FormField label="متن یا توضیحات پاسخ تکلیف" required>
            <textarea
              rows={4}
              required
              value={studentSubmitText}
              onChange={(e) => setStudentSubmitText(e.target.value)}
              placeholder="توضیح مراحل حل، خلاصه نتایج یا فرمول‌های استفاده‌شده..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <FormField label="نام فایل ضمیمه (شبیه‌سازی فایل PDF یا تصویر)">
            <input
              type="text"
              value={studentSubmitFile}
              onChange={(e) => setStudentSubmitFile(e.target.value)}
              placeholder="مثال: پاسخ_تمرین_ریاضی_پارسا_رادمنش.pdf"
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsSubmitModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" icon={<Send size={14} />}>
              ارسال نهایی به دبیر
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Grade Submission */}
      <Modal
        isOpen={isGradeModalOpen}
        onClose={() => setIsGradeModalOpen(false)}
        title={`ثبت نمره برای ${activeSubmission?.studentName || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveGrade} className="space-y-4 text-right">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
            <span className="font-bold text-[#202B3C] dark:text-[#F1F5FB]">متن ارسالی دانش‌آموز:</span>
            <p className="text-[#526176] dark:text-[#B3C0D2]">{activeSubmission?.content}</p>
          </div>

          <FormField label="نمره از ۲۰" required>
            <input
              type="number"
              step="0.25"
              min="0"
              max="20"
              required
              value={gradeScore}
              onChange={(e) => setGradeScore(parseFloat(e.target.value))}
              className="w-full text-sm p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none font-mono tabular-nums font-bold"
            />
          </FormField>

          <FormField label="بازخورد کیفی و توضیحات دبیر">
            <textarea
              rows={3}
              value={gradeFeedback}
              onChange={(e) => setGradeFeedback(e.target.value)}
              placeholder="نقاط قوت برگه و مباحثی که نیاز به تمرین مجدد دارد..."
              className="w-full text-xs p-2.5 bg-white dark:bg-[#182231] border border-[#DCE3EE] dark:border-[#344257] rounded-xl focus:outline-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsGradeModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" type="submit">
              ثبت و ذخیره در کارنامه
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
