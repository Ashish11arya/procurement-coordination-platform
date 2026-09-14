import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './modules/auth/context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { RoleGuard } from './components/common/RoleGuard';
import { Role } from './types';

// Auth Pages
import { LoginPage } from './modules/auth/pages/LoginPage';
import { RegisterPage } from './modules/auth/pages/RegisterPage';

// Farmer Pages
import { FarmerDashboardPage } from './modules/farmer/pages/FarmerDashboardPage';
import { NewBookingPage } from './modules/farmer/pages/NewBookingPage';
import { BookingDetailsPage } from './modules/farmer/pages/BookingDetailsPage';
import { LiveQueuePage } from './modules/farmer/pages/LiveQueuePage';
import { YardStatusPage } from './modules/farmer/pages/YardStatusPage';
import { PaymentStatusPage } from './modules/farmer/pages/PaymentStatusPage';
import { BookingHistoryPage } from './modules/farmer/pages/BookingHistoryPage';
import { CentresDirectoryPage } from './modules/farmer/pages/CentresDirectoryPage';
import { FarmerProfilePage } from './modules/farmer/pages/FarmerProfilePage';
import { NotificationsPage } from './modules/farmer/pages/NotificationsPage';
import { PrivacyPolicyPage } from './modules/farmer/pages/PrivacyPolicyPage';

// Centre Operations Pages
import { CentreDashboardPage } from './modules/centre/pages/CentreDashboardPage';
import { CheckInOperatorPage } from './modules/centre/pages/CheckInOperatorPage';
import { WeighingOperatorPage } from './modules/centre/pages/WeighingOperatorPage';
import { QualityOperatorPage } from './modules/centre/pages/QualityOperatorPage';
import { ProcurementOperatorPage } from './modules/centre/pages/ProcurementOperatorPage';
import { CentreQueuePage } from './modules/centre/pages/CentreQueuePage';
import { CentreSchedulePage } from './modules/centre/pages/CentreSchedulePage';
import { CountersManagementPage } from './modules/centre/pages/CountersManagementPage';
import { CentreCapacityPage } from './modules/centre/pages/CentreCapacityPage';
import { CentreExceptionsPage } from './modules/centre/pages/CentreExceptionsPage';

// Government Command Centre Pages
import { CommandDashboardPage } from './modules/government/pages/CommandDashboardPage';
import { StatesOverviewPage } from './modules/government/pages/StatesOverviewPage';
import { DistrictsRollupPage } from './modules/government/pages/DistrictsRollupPage';
import { CentresMonitoringPage } from './modules/government/pages/CentresMonitoringPage';
import { LiveMonitoringPage } from './modules/government/pages/LiveMonitoringPage';
import { BottlenecksPage } from './modules/government/pages/BottlenecksPage';
import { CapacityUtilisationPage } from './modules/government/pages/CapacityUtilisationPage';
import { IntegrationHealthPage } from './modules/government/pages/IntegrationHealthPage';
import { AuditLogsPage } from './modules/government/pages/AuditLogsPage';
import { OperationalAnalyticsPage } from './modules/government/pages/OperationalAnalyticsPage';
import { DemoRunnerPage } from './modules/government/pages/DemoRunnerPage';

// Root redirector based on authenticated user's role
const RootRedirect: React.FC = () => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Initializing Government DPI...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case Role.FARMER:
      return <Navigate to="/dashboard" replace />;
    case Role.CHECKIN_OPERATOR:
      return <Navigate to="/centre/check-in" replace />;
    case Role.WEIGHING_OPERATOR:
      return <Navigate to="/centre/weighing" replace />;
    case Role.QUALITY_OPERATOR:
      return <Navigate to="/centre/quality" replace />;
    case Role.PROCUREMENT_OPERATOR:
      return <Navigate to="/centre/procurement" replace />;
    case Role.CENTRE_ADMIN:
      return <Navigate to="/centre/dashboard" replace />;
    case Role.GOVERNMENT_ADMIN:
    case Role.STATE_ADMIN:
    case Role.DISTRICT_ADMIN:
    case Role.AUDITOR:
    case Role.SYSTEM_ADMIN:
      return <Navigate to="/admin/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes & Statutory Notices */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

          {/* Demonstration Runner Route (Open to Evaluators & Staff) */}
          <Route element={<AppLayout />}>
            <Route path="/demo" element={<DemoRunnerPage />} />
          </Route>

          {/* Authenticated Application Shell */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            {/* Root Intelligent Redirection */}
            <Route path="/" element={<RootRedirect />} />

            {/* ========================================================= */}
            {/* Farmer Portal Routes (Role.FARMER)                         */}
            {/* ========================================================= */}
            <Route
              path="/dashboard"
              element={
                <RoleGuard allowedRoles={[Role.FARMER]}>
                  <FarmerDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="/book"
              element={
                <RoleGuard allowedRoles={[Role.FARMER]}>
                  <NewBookingPage />
                </RoleGuard>
              }
            />
            <Route
              path="/booking/:id"
              element={
                <RoleGuard allowedRoles={[Role.FARMER, Role.CENTRE_ADMIN, Role.GOVERNMENT_ADMIN]}>
                  <BookingDetailsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/live-queue"
              element={
                <RoleGuard allowedRoles={[Role.FARMER]}>
                  <LiveQueuePage />
                </RoleGuard>
              }
            />
            <Route
              path="/status"
              element={
                <RoleGuard allowedRoles={[Role.FARMER]}>
                  <YardStatusPage />
                </RoleGuard>
              }
            />
            <Route
              path="/payment-status"
              element={
                <RoleGuard allowedRoles={[Role.FARMER]}>
                  <PaymentStatusPage />
                </RoleGuard>
              }
            />
            <Route
              path="/history"
              element={
                <RoleGuard allowedRoles={[Role.FARMER]}>
                  <BookingHistoryPage />
                </RoleGuard>
              }
            />
            <Route
              path="/centres"
              element={
                <RoleGuard allowedRoles={[Role.FARMER, Role.CENTRE_ADMIN, Role.GOVERNMENT_ADMIN]}>
                  <CentresDirectoryPage />
                </RoleGuard>
              }
            />
            <Route
              path="/profile"
              element={
                <RoleGuard allowedRoles={[Role.FARMER]}>
                  <FarmerProfilePage />
                </RoleGuard>
              }
            />
            <Route
              path="/notifications"
              element={
                <RoleGuard allowedRoles={[Role.FARMER]}>
                  <NotificationsPage />
                </RoleGuard>
              }
            />

            {/* ========================================================= */}
            {/* Centre Operations Routes (Role Isolation Enforced)        */}
            {/* ========================================================= */}
            <Route
              path="/centre/dashboard"
              element={
                <RoleGuard
                  allowedRoles={[
                    Role.CENTRE_ADMIN,
                    Role.CHECKIN_OPERATOR,
                    Role.WEIGHING_OPERATOR,
                    Role.QUALITY_OPERATOR,
                    Role.PROCUREMENT_OPERATOR,
                    Role.GOVERNMENT_ADMIN,
                    Role.STATE_ADMIN,
                    Role.DISTRICT_ADMIN,
                  ]}
                >
                  <CentreDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="/centre/check-in"
              element={
                <RoleGuard allowedRoles={[Role.CHECKIN_OPERATOR, Role.CENTRE_ADMIN]}>
                  <CheckInOperatorPage />
                </RoleGuard>
              }
            />
            <Route
              path="/centre/weighing"
              element={
                <RoleGuard allowedRoles={[Role.WEIGHING_OPERATOR, Role.CENTRE_ADMIN]}>
                  <WeighingOperatorPage />
                </RoleGuard>
              }
            />
            <Route
              path="/centre/quality"
              element={
                <RoleGuard allowedRoles={[Role.QUALITY_OPERATOR, Role.CENTRE_ADMIN]}>
                  <QualityOperatorPage />
                </RoleGuard>
              }
            />
            <Route
              path="/centre/procurement"
              element={
                <RoleGuard allowedRoles={[Role.PROCUREMENT_OPERATOR, Role.CENTRE_ADMIN]}>
                  <ProcurementOperatorPage />
                </RoleGuard>
              }
            />
            <Route
              path="/centre/queue"
              element={
                <RoleGuard
                  allowedRoles={[
                    Role.CENTRE_ADMIN,
                    Role.CHECKIN_OPERATOR,
                    Role.WEIGHING_OPERATOR,
                    Role.QUALITY_OPERATOR,
                    Role.PROCUREMENT_OPERATOR,
                    Role.GOVERNMENT_ADMIN,
                  ]}
                >
                  <CentreQueuePage />
                </RoleGuard>
              }
            />
            <Route
              path="/centre/schedule"
              element={
                <RoleGuard allowedRoles={[Role.CENTRE_ADMIN, Role.GOVERNMENT_ADMIN]}>
                  <CentreSchedulePage />
                </RoleGuard>
              }
            />
            <Route
              path="/centre/counters"
              element={
                <RoleGuard allowedRoles={[Role.CENTRE_ADMIN, Role.GOVERNMENT_ADMIN]}>
                  <CountersManagementPage />
                </RoleGuard>
              }
            />
            <Route
              path="/centre/capacity"
              element={
                <RoleGuard allowedRoles={[Role.CENTRE_ADMIN, Role.GOVERNMENT_ADMIN]}>
                  <CentreCapacityPage />
                </RoleGuard>
              }
            />
            <Route
              path="/centre/exceptions"
              element={
                <RoleGuard allowedRoles={[Role.CENTRE_ADMIN, Role.GOVERNMENT_ADMIN]}>
                  <CentreExceptionsPage />
                </RoleGuard>
              }
            />

            {/* ========================================================= */}
            {/* Government Command Centre Routes                          */}
            {/* ========================================================= */}
            <Route
              path="/admin/dashboard"
              element={
                <RoleGuard allowedRoles={[Role.GOVERNMENT_ADMIN, Role.STATE_ADMIN, Role.DISTRICT_ADMIN, Role.AUDITOR, Role.SYSTEM_ADMIN]}>
                  <CommandDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/states"
              element={
                <RoleGuard allowedRoles={[Role.GOVERNMENT_ADMIN, Role.STATE_ADMIN, Role.SYSTEM_ADMIN]}>
                  <StatesOverviewPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/districts"
              element={
                <RoleGuard allowedRoles={[Role.GOVERNMENT_ADMIN, Role.STATE_ADMIN, Role.DISTRICT_ADMIN, Role.SYSTEM_ADMIN]}>
                  <DistrictsRollupPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/centres"
              element={
                <RoleGuard allowedRoles={[Role.GOVERNMENT_ADMIN, Role.STATE_ADMIN, Role.DISTRICT_ADMIN, Role.CENTRE_ADMIN]}>
                  <CentresMonitoringPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/live-monitoring"
              element={
                <RoleGuard allowedRoles={[Role.GOVERNMENT_ADMIN, Role.STATE_ADMIN, Role.SYSTEM_ADMIN]}>
                  <LiveMonitoringPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/bottlenecks"
              element={
                <RoleGuard allowedRoles={[Role.GOVERNMENT_ADMIN, Role.STATE_ADMIN, Role.DISTRICT_ADMIN]}>
                  <BottlenecksPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/utilisation"
              element={
                <RoleGuard allowedRoles={[Role.GOVERNMENT_ADMIN, Role.STATE_ADMIN, Role.SYSTEM_ADMIN]}>
                  <CapacityUtilisationPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/integrations"
              element={
                <RoleGuard allowedRoles={[Role.GOVERNMENT_ADMIN, Role.SYSTEM_ADMIN]}>
                  <IntegrationHealthPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <RoleGuard allowedRoles={[Role.GOVERNMENT_ADMIN, Role.AUDITOR, Role.SYSTEM_ADMIN]}>
                  <AuditLogsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <RoleGuard allowedRoles={[Role.GOVERNMENT_ADMIN, Role.STATE_ADMIN, Role.DISTRICT_ADMIN, Role.SYSTEM_ADMIN]}>
                  <OperationalAnalyticsPage />
                </RoleGuard>
              }
            />
          </Route>

          {/* Catch-all 404 Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
