import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ParentDashboard } from './dashboards/ParentDashboard';
import { StudentDashboard } from './dashboards/StudentDashboard';
import { TeacherDashboard } from './dashboards/TeacherDashboard';
import { PrincipalDashboard } from './dashboards/PrincipalDashboard';
import { EducationalDeputyDashboard } from './dashboards/EducationalDeputyDashboard';
import { DisciplinaryDeputyDashboard } from './dashboards/DisciplinaryDeputyDashboard';
import { NazemDashboard } from './dashboards/NazemDashboard';
import { CounselorDashboard } from './dashboards/CounselorDashboard';
import { RegistrarDashboard } from './dashboards/RegistrarDashboard';
import { BusDriverDashboard } from './dashboards/BusDriverDashboard';
import { SecurityGuardDashboard } from './dashboards/SecurityGuardDashboard';
import { ProctorGraderDashboard } from './dashboards/ProctorGraderDashboard';
import { PtaPresidentDashboard } from './dashboards/PtaPresidentDashboard';
import { InspectorDashboard } from './dashboards/InspectorDashboard';
import { PlatformAdminDashboard } from './dashboards/PlatformAdminDashboard';

export const DashboardRouter: React.FC = () => {
  const { activeRole, hasAccess } = useAuth();

  switch (activeRole.id) {
    // 1. School Admin
    case 'school_principal':
      return <PrincipalDashboard />;
    case 'educational_deputy':
      return <EducationalDeputyDashboard />;
    case 'disciplinary_deputy':
      return <DisciplinaryDeputyDashboard />;
    case 'attendance_supervisor':
      return <NazemDashboard />;

    // 2. Faculty
    case 'teacher':
    case 'substitute_teacher':
    case 'intern_teacher':
      return <TeacherDashboard />;
    case 'essay_grader':
    case 'exam_proctor':
      return <ProctorGraderDashboard />;

    // 3. Support & Health
    case 'academic_counselor':
    case 'school_psychologist':
    case 'health_officer':
      return <CounselorDashboard />;

    // 4. Operations
    case 'school_registrar':
      return <RegistrarDashboard />;
    case 'bus_driver':
      return <BusDriverDashboard />;
    case 'security_guard':
      return <SecurityGuardDashboard />;

    // 5. Family
    case 'guardian':
    case 'legal_guardian':
    case 'temporary_delegate':
    case 'pickup_authorized_person':
      return <ParentDashboard />;

    // 6. Student
    case 'active_student':
    case 'guest_student':
    case 'alumnus_student':
      return <StudentDashboard />;

    // 7. PTA
    case 'pta_president':
    case 'pta_class_rep':
    case 'pta_member':
      return <PtaPresidentDashboard />;

    // 8. External & Platform
    case 'ministry_inspector':
      return <InspectorDashboard />;
    case 'platform_super_admin':
    case 'platform_tech_support':
      return <PlatformAdminDashboard />;

    default:
      // Custom school roles: a bus driver is whoever holds transport.board.
      if (hasAccess('transport:board')) return <BusDriverDashboard />;
      // A counselor is whoever manages the counseling bench.
      if (hasAccess('counseling:manage')) return <CounselorDashboard />;
      // Fallback by group
      if (activeRole.group === 'family') return <ParentDashboard />;
      if (activeRole.group === 'student') return <StudentDashboard />;
      // A PTA officer is whoever can vote or manage the association.
      if (hasAccess('pta:manage') || hasAccess('pta:vote')) return <PtaPresidentDashboard />;
      if (activeRole.group === 'faculty') return <TeacherDashboard />;
      return <PrincipalDashboard />;
  }
};
