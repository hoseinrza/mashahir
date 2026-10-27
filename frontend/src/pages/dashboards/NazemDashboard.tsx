import React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare, Clock, Users, ShieldCheck, AlertCircle,
  FileCheck, Send, CheckCircle2, Save
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { AttendanceService } from '../../services';

export const NazemDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const allRecords = AttendanceService.getAll();
  const presentCount = allRecords.filter((a) => a.status === 'present').length;
  const absentCount = allRecords.filter((a) => a.status === 'absent').length;
  const lateCount = allRecords.filter((a) => a.status === 'late').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`دفتر نظارت روزانه — ${currentUser.fullName}`}
        subtitle="ناظم و مسئول حضور و غیاب مدرسه · بررسی دفاتر کلاسی، ثبت اصلاحات موجه و رصد پیامک‌ها"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/attendance">
              <Button variant="primary" size="sm" icon={<CheckSquare size={15} />}>
                ورود به دفتر حضور و غیاب کلاسی
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کل حاضرین ثبت‌شده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {toPersianDigits(presentCount)}
            </span>
            <Badge variant="success">۹۶٪ حضور</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">غیبت‌های امروز</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
              {toPersianDigits(absentCount)}
            </span>
            <Badge variant="danger">نیازمند پیگیری</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">تأخیرهای صبحگاهی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {toPersianDigits(lateCount)}
            </span>
            <Badge variant="warning">ثبت در پرونده</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">وضعیت ارسال پیامک‌ها</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              ۱۰۰٪
            </span>
            <Badge variant="primary">مخابرات فعال</Badge>
          </div>
        </Card>
      </div>

      {/* Roster & Quick Justification */}
      <Card className="text-right">
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EE] dark:border-[#344257] mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">
              آخرین رکوردهای ارسالی از دفاتر کلاسی دبیران
            </h3>
            <p className="text-xs text-[#526176] dark:text-[#B3C0D2]">
              هرگونه اصلاح در وضعیت دانش‌آموزان همراه با درج دلیل در تاریخچه حساس (Audit) ذخیره می‌گردد.
            </p>
          </div>
          <Link to="/attendance">
            <Button variant="outline" size="sm">
              ویرایش کامل و ثبت دلایل
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {allRecords.slice(0, 5).map((rec) => (
            <div
              key={rec.id}
              className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">{rec.studentName}</strong>
                  <Badge variant={rec.status === 'present' ? 'success' : rec.status === 'absent' ? 'danger' : 'warning'}>
                    {rec.status === 'present' ? 'حاضر' : rec.status === 'absent' ? 'غایب' : 'تأخیر'}
                  </Badge>
                </div>
                <span className="text-slate-500 mt-1 block">
                  ثبت‌شده توسط: دبیر کلاس · ساعت {rec.recordedAt} {rec.note ? `(${rec.note})` : ''}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {rec.lastModifiedReason && (
                  <span className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded text-[11px]">
                    دلیل اصلاح: {rec.lastModifiedReason}
                  </span>
                )}
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  پیامک ولی: ارسال شد ✓
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
