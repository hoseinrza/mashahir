import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardLayout } from './layouts/DashboardLayout';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardRouter } from './pages/DashboardRouter';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { AttendancePage } from './pages/AttendancePage';
import { OnlineClassesPage } from './pages/OnlineClassesPage';
import { OnlineExamPage } from './pages/OnlineExamPage';
import { ExamsManagementPage } from './pages/ExamsManagementPage';
import { StudentExamsPage } from './pages/StudentExamsPage';
import { EssayGradingPage } from './pages/EssayGradingPage';
import { ReportCardPage } from './pages/ReportCardPage';
import { SmartPerformanceAnalysisPage } from './pages/SmartPerformanceAnalysisPage';
import { CounselingPage } from './pages/CounselingPage';
import { PtaPage } from './pages/PtaPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { NotificationsCenterPage } from './pages/NotificationsCenterPage';
import { ConsentFormsPage } from './pages/ConsentFormsPage';
import { FamilyManagementPage } from './pages/FamilyManagementPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { RolesPermissionsPage } from './pages/RolesPermissionsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { SpecialRolesPage } from './pages/SpecialRolesPage';
import { SettingsPage } from './pages/SettingsPage';
import { CreateSchoolPage } from './pages/CreateSchoolPage';
import { NotFoundPage } from './pages/NotFoundPage';

function ExamsRoleRouter() {
  const { activeRole } = useAuth();
  // Students (and guardians) get the REAL exam-taking experience;
  // staff get the design/management console.
  const isStudentSide = activeRole.group === 'student' || activeRole.group === 'family';
  return isStudentSide ? <StudentExamsPage /> : <ExamsManagementPage />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Landing page as main entry guiding to all roles and modules */}
            <Route path="/" element={<LandingPage />} />

            {/* Demo Login and Role selection */}
            <Route path="/login" element={<LoginPage />} />

            {/* Main Unified Dashboard routed according to active user role */}
            <Route
              path="/dashboard"
              element={
                <DashboardLayout>
                  <DashboardRouter />
                </DashboardLayout>
              }
            />
            <Route
              path="/online-classes"
              element={
                <DashboardLayout>
                  <OnlineClassesPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/assignments"
              element={
                <DashboardLayout>
                  <AssignmentsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/attendance"
              element={
                <DashboardLayout>
                  <AttendancePage />
                </DashboardLayout>
              }
            />
            <Route
              path="/exams"
              element={
                <DashboardLayout>
                  <ExamsRoleRouter />
                </DashboardLayout>
              }
            />
            <Route
              path="/essay-grading"
              element={
                <DashboardLayout>
                  <EssayGradingPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/report-card"
              element={
                <DashboardLayout>
                  <ReportCardPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/performance-analytics"
              element={
                <DashboardLayout>
                  <SmartPerformanceAnalysisPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/counseling"
              element={
                <DashboardLayout>
                  <CounselingPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/pta"
              element={
                <DashboardLayout>
                  <PtaPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/announcements"
              element={
                <DashboardLayout>
                  <AnnouncementsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/notifications"
              element={
                <DashboardLayout>
                  <NotificationsCenterPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/consent-forms"
              element={
                <DashboardLayout>
                  <ConsentFormsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/family-management"
              element={
                <DashboardLayout>
                  <FamilyManagementPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/create-school"
              element={
                <DashboardLayout>
                  <CreateSchoolPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/user-management"
              element={
                <DashboardLayout>
                  <UserManagementPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/roles-permissions"
              element={
                <DashboardLayout>
                  <RolesPermissionsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <DashboardLayout>
                  <AuditLogPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/special-roles"
              element={
                <DashboardLayout>
                  <SpecialRolesPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/settings"
              element={
                <DashboardLayout>
                  <SettingsPage />
                </DashboardLayout>
              }
            />

            {/* Fallback 404 */}
            <Route
              path="*"
              element={
                <DashboardLayout>
                  <NotFoundPage />
                </DashboardLayout>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
