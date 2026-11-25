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
import { TransportPage } from './pages/TransportPage';
import { ExamsManagementPage } from './pages/ExamsManagementPage';
import { StudentExamsPage } from './pages/StudentExamsPage';
import { EssayGradingPage } from './pages/EssayGradingPage';
import { ReportCardPage } from './pages/ReportCardPage';
import { ClassroomsPage } from './pages/ClassroomsPage';
import { GradeEntryPage } from './pages/GradeEntryPage';
import { SmartPerformanceAnalysisPage } from './pages/SmartPerformanceAnalysisPage';
import { ReportCycleAdminPage } from './pages/ReportCycleAdminPage';
import { ReportCardPrintPage } from './pages/ReportCardPrintPage';
import { MyReportCyclePage } from './pages/MyReportCyclePage';
import { CounselingPage } from './pages/CounselingPage';
import { PtaPage } from './pages/PtaPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { NotificationsCenterPage } from './pages/NotificationsCenterPage';
import { ConsentFormsPage } from './pages/ConsentFormsPage';
import { FamilyManagementPage } from './pages/FamilyManagementPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { RolesPermissionsPage } from './pages/RolesPermissionsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { PreRegistrationsPage } from './pages/PreRegistrationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { CreateSchoolPage } from './pages/CreateSchoolPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { IosInstallSheet } from './components/common/IosInstallSheet';

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
              path="/transport"
              element={
                <DashboardLayout>
                  <TransportPage />
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
              path="/classrooms"
              element={
                <DashboardLayout>
                  <ClassroomsPage />
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
              path="/grade-entry"
              element={
                <DashboardLayout>
                  <GradeEntryPage />
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
              path="/report-cycle-admin"
              element={
                <DashboardLayout>
                  <ReportCycleAdminPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/report-card-print"
              element={
                <DashboardLayout>
                  <ReportCardPrintPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/my-report-cycle"
              element={
                <DashboardLayout>
                  <MyReportCyclePage />
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
              path="/pre-registrations"
              element={
                <DashboardLayout>
                  <PreRegistrationsPage />
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
        <IosInstallSheet />
      </AuthProvider>
    </ThemeProvider>
  );
}
