import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck, Users, ShieldAlert, Award, FileText, CheckCircle2,
  Clock, ArrowRight, UserPlus, Scale, Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, PageHeader } from '../../components/common';
import { toPersianDigits } from '../../utils/persian';
import { FamilyService } from '../../services';

export const RegistrarDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const links = FamilyService.getLinks();
  const restrictions = FamilyService.getRestrictions();
  const pickups = FamilyService.getPickups();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`میز کار امور اداری و ثبت‌نام — ${currentUser.fullName}`}
        subtitle="مسئول دفتر و ثبت‌نام دبیرستان · راستی‌آزمایی مدارک، پیوندهای خانوادگی، احکام حضانت و صدور گواهی‌ها"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/family-management">
              <Button variant="primary" size="sm" icon={<ShieldAlert size={15} />}>
                مدیریت احکام قضایی و روابط خانوادگی
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">کل پرونده‌های ثبت‌نامی</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#2457C5] dark:text-[#8BAEFF] tabular-nums">
              {toPersianDigits(84)}
            </span>
            <Badge variant="primary">دوره دوم</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">پیوندهای خانوادگی تاییدشده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {toPersianDigits(links.filter((l) => l.verificationStatus === 'verified').length)}
            </span>
            <Badge variant="success">احراز هویت کامل</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">احکام قضایی تنفیذشده</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
              {toPersianDigits(restrictions.length)}
            </span>
            <Badge variant="danger">دادگاه خانواده</Badge>
          </div>
        </Card>

        <Card className="text-right">
          <span className="text-xs text-[#526176] dark:text-[#B3C0D2]">اشخاص مجاز ترخیص</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-[#202B3C] dark:text-[#F1F5FB] tabular-nums">
              {toPersianDigits(pickups.length)}
            </span>
            <Badge variant="neutral">کارت ترخیص</Badge>
          </div>
        </Card>
      </div>

      {/* Tasks Overview */}
      <Card className="text-right space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EE] dark:border-[#344257]">
          <div>
            <h3 className="text-sm font-bold text-[#202B3C] dark:text-[#F1F5FB]">
              آخرین پرونده‌های خانوادگی و احراز مدارک اولیا
            </h3>
            <p className="text-xs text-[#526176] dark:text-[#B3C0D2]">
              تطبیق شناسنامه‌ها، وکالت‌نامه‌های اداری، احکام حضانت و تفکیک حریم خصوصی والدین جداشده
            </p>
          </div>
          <Link to="/family-management">
            <Button variant="outline" size="sm">
              مشاهده پرونده کامل حقوقی
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {links.map((link) => (
            <div
              key={link.id}
              className="p-3.5 rounded-xl border border-[#DCE3EE] dark:border-[#344257] bg-[#F7F9FC] dark:bg-[#101722]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <strong className="text-sm text-[#202B3C] dark:text-[#F1F5FB]">{link.guardianName}</strong>
                  <span className="text-slate-400">←</span>
                  <span className="font-semibold">{link.studentName}</span>
                  <Badge variant={link.relationshipType === 'mother' ? 'success' : link.relationshipType === 'father' ? 'primary' : 'warning'}>
                    {link.relationshipType === 'mother' ? 'مادر' : link.relationshipType === 'father' ? 'پدر' : 'نماینده / سرپرست'}
                  </Badge>
                </div>
                <span className="text-slate-500 mt-1 block">
                  مستند احراز: {link.verificationDocumentRef} · {link.notes || ''}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {link.hasLegalRestriction && (
                  <Badge variant="danger">محدودیت ترخیص دادگاه</Badge>
                )}
                <Badge variant={link.verificationStatus === 'verified' ? 'success' : 'warning'}>
                  {link.verificationStatus === 'verified' ? 'تایید شده' : 'در حال بررسی'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
