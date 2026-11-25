import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TenantProvider, useTenant } from './contexts/TenantContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ActivitiesLockPage } from './pages/ActivitiesLockPage';
import { BillingPage } from './pages/BillingPage';
import { LandingPricingPage } from './pages/LandingPricingPage';
import { LegalPage } from './pages/LegalPage';
import { LoginPage } from './pages/LoginPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { ReportsPage } from './pages/ReportsPage';
import { RoomDashboardPage } from './pages/RoomDashboardPage';
import { SchoolDashboardPage } from './pages/SchoolDashboardPage';
import { SchoolProfileBrandingPage } from './pages/SchoolProfileBrandingPage';
import { SchoolSignupPage } from './pages/SchoolSignupPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { TeacherDashboardPage } from './pages/TeacherDashboardPage';
import { TimetableEditorPage } from './pages/TimetableEditorPage';

function ProtectedSchoolRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, authReady, isSuperAdmin } = useAuth();
  const { school, loadingTenant, tenantSlug } = useTenant();

  if (!authReady || loadingTenant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-500">กำลังตรวจสอบสิทธิ์และข้อมูลโรงเรียน...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to={tenantSlug ? `/s/${tenantSlug}/login` : '/login'} replace />;
  }

  if (!school) {
    if (isSuperAdmin) {
      return <Navigate to="/super-admin" replace />;
    }
    return <Navigate to="/signup" replace />;
  }

  return <>{children}</>;
}

function ProtectedSuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, authReady, isSuperAdmin } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-500">กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}

function RootRouterEntry() {
  const { tenantSlug } = useTenant();
  if (tenantSlug) {
    return <Navigate to={`/s/${tenantSlug}/login`} replace />;
  }
  return <LandingPricingPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <TenantProvider>
                <Routes>
                  <Route path="/" element={<RootRouterEntry />} />
                  <Route path="/signup" element={<SchoolSignupPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/s/:slug/login" element={<LoginPage />} />
                  <Route path="/s/:slug" element={<Navigate to="login" replace />} />
                  <Route path="/privacy" element={<LegalPage mode="privacy" />} />
                  <Route path="/terms" element={<LegalPage mode="terms" />} />

                  <Route
                    path="/app/dashboard"
                    element={
                      <ProtectedSchoolRoute>
                        <SchoolDashboardPage />
                      </ProtectedSchoolRoute>
                    }
                  />
                  <Route
                    path="/app/teacher-dashboard"
                    element={
                      <ProtectedSchoolRoute>
                        <TeacherDashboardPage />
                      </ProtectedSchoolRoute>
                    }
                  />
                  <Route
                    path="/app/room-dashboard"
                    element={
                      <ProtectedSchoolRoute>
                        <RoomDashboardPage />
                      </ProtectedSchoolRoute>
                    }
                  />
                  <Route
                    path="/app/timetable"
                    element={
                      <ProtectedSchoolRoute>
                        <TimetableEditorPage />
                      </ProtectedSchoolRoute>
                    }
                  />
                  <Route
                    path="/app/activities"
                    element={
                      <ProtectedSchoolRoute>
                        <ActivitiesLockPage />
                      </ProtectedSchoolRoute>
                    }
                  />
                  <Route
                    path="/app/master-data"
                    element={
                      <ProtectedSchoolRoute>
                        <MasterDataPage />
                      </ProtectedSchoolRoute>
                    }
                  />
                  <Route
                    path="/app/reports"
                    element={
                      <ProtectedSchoolRoute>
                        <ReportsPage />
                      </ProtectedSchoolRoute>
                    }
                  />
                  <Route
                    path="/app/branding"
                    element={
                      <ProtectedSchoolRoute>
                        <SchoolProfileBrandingPage />
                      </ProtectedSchoolRoute>
                    }
                  />
                  <Route
                    path="/app/billing"
                    element={
                      <ProtectedSchoolRoute>
                        <BillingPage />
                      </ProtectedSchoolRoute>
                    }
                  />

                  <Route
                    path="/super-admin"
                    element={
                      <ProtectedSuperAdminRoute>
                        <SuperAdminPage />
                      </ProtectedSuperAdminRoute>
                    }
                  />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </TenantProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
