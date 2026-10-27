import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SchoolCreationWizard } from '../components/schools/SchoolCreationWizard';
import { PageHeader } from '../components/common';
import { useAuth } from '../context/AuthContext';

export const CreateSchoolPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, activeRole } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="تأسیس و راه‌اندازی واحد آموزشی جدید"
        subtitle="فرآیند پنج مرحله‌ای ایجاد مدرسه، انتصاب کادر، تعریف کلاس‌ها، ثبت دانش‌آموزان و انتساب اولیا"
      />

      <SchoolCreationWizard
        onComplete={(createdSchool) => {
          navigate('/user-management');
        }}
        onCancel={() => {
          navigate('/dashboard');
        }}
      />
    </div>
  );
};
