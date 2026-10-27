import React from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, BookOpen, Users, Calendar, Award, CheckCircle2,
  Clock, Plus, FileText, ArrowRight, TrendingUp, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits, formatScore } from '../../utils/persian';
import { INITIAL_CLASSROOMS, INITIAL_REPORT_CARDS } from '../../data/mockData';
import { AssignmentService, ExamService } from '../../services';

export const EducationalDeputyDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const classrooms = INITIAL_CLASSROOMS;
  const assignments = AssignmentService.getAssignments();
  const exams = ExamService.getExams();
  const reportCards = INITIAL_REPORT_CARDS;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`داشبورد معاونت آموزشی — ${currentUser.fullName}`}
        subtitle="نظارت بر فرآیند تدریس، برنامه‌ریزی تقویم درسی، تایید کارنامه‌ها و پایش دبیران"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/exams">
              <Button variant="outline" size="sm" icon={<Calendar size={15} />}>
                تقویم امتحانات
              </Button>
            </Link>
            <Link to="/report-card">
              <Button variant="primary" size="sm" icon={<Award size={15} />}>
                بررسی و تایید کارنامه‌ها
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کلاس‌های دوره دوم</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {toPersianDigits(classrooms.length)}
            </span>
            <Badge variant="primary">۸۴ دانش‌آموز</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">میانگین پیشرفت آموزشی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              ۱۸.۷۵
            </span>
            <Badge variant="success">شیب مثبت</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">تکالیف فعال کلاسی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {toPersianDigits(assignments.length)}
            </span>
            <Badge variant="neutral">هفته جاری</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">آزمون‌های برنامه‌ریزی‌شده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {toPersianDigits(exams.length)}
            </span>
            <Badge variant="warning">مهر و آبان</Badge>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Class Performance & Teacher Supervision */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <BookOpen size={16} className="text-[#2457C5]" />
                پایش کلاس‌ها و وضعیت دروس پایه دهم و یازدهم
              </h3>
              <Link to="/user-management" className="text-xs text-[#2457C5] dark:text-[#8BAEFF] hover:underline">
                تخصیص دبیران
              </Link>
            </div>

            <div className="space-y-3">
              {classrooms.map((cls) => (
                <div
                  key={cls.id}
                  className="p-4 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 text-right flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#202B3C] dark:text-[#F1F5FB]">{cls.name}</span>
                      <Badge variant="primary">{cls.grade}</Badge>
                    </div>
                    <span className="text-xs text-[#526176] dark:text-[#B3C0D2] mt-1 block">
                      دبیر راهنما: مهندس کریمی · ظرفیت: {toPersianDigits(cls.studentCount)} نفر · اتاق {toPersianDigits(cls.roomNumber)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg">
                      معدل کلاس: ۱۸.۴۰
                    </span>
                    <Link to="/attendance">
                      <Button variant="outline" size="sm">
                        مشاهده دفتر کلاسی
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Pending Report Card Approvals */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] flex items-center gap-2">
                <Award size={16} className="text-[#2457C5]" />
                کارنامه‌های نهایی نیازمند تایید و صدور
              </h3>
              <Badge variant="success">آماده صدور رسمی</Badge>
            </div>
            <p className="text-xs text-[#526176] dark:text-[#B3C0D2] leading-relaxed mb-3">
              نمرات نوبت اول کلاس‌های ۱۰۱ و ۱۰۲ توسط دبیران مربوطه نهایی و ثبت شده‌اند. پس از بررسی میانگین‌ها، کارنامه‌ها آماده تنفیذ نهایی هستند.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-500">تعداد کارنامه‌های بازبینی‌شده: <strong>۸۴ فقره</strong></span>
              <Link to="/report-card">
                <Button variant="primary" size="sm">
                  مشاهده و صدور دسته‌جمعی
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* Right Col: Academic Calendar & Teacher Load */}
        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB] mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-[#2457C5]" />
              رویدادهای تقویم آموزشی هفته
            </h3>
            <div className="space-y-2.5 text-xs text-right">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <strong className="block text-[#202B3C] dark:text-[#F1F5FB]">کوییز آنلاین مستمر ریاضی دهم</strong>
                <span className="text-slate-500 font-mono">شنبه ۲۸ مهرماه · ساعت ۱۰:۰۰</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <strong className="block text-[#202B3C] dark:text-[#F1F5FB]">شورای دبیران و هم‌اندیشی دروس پایه</strong>
                <span className="text-slate-500 font-mono">دوشنبه ۳۰ مهرماه · ساعت ۱۴:۳۰</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <strong className="block text-[#202B3C] dark:text-[#F1F5FB]">آزمون سالنی حضوری میان‌ترم فیزیک</strong>
                <span className="text-slate-500 font-mono">۱۰ آبان‌ماه · ساعت ۰۸:۳۰</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
