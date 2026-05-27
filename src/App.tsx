import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import DashboardLayout from './layouts/DashboardLayout';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import DashboardHome from './pages/dashboard/DashboardHome';
import APIsPage from './pages/dashboard/APIsPage';
import LogsPage from './pages/dashboard/LogsPage';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import MergePage from './pages/dashboard/MergePage';
import WorkflowsPage from './pages/dashboard/WorkflowsPage';
import TickerPage from './pages/dashboard/TickerPage';
import AIToolsPage from './pages/dashboard/AIToolsPage';
import SettingsPage from './pages/dashboard/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060810] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
            <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <DashboardHome />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/apis" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <APIsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/logs" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <LogsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/analytics" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AnalyticsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/merge" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <MergePage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/workflows" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <WorkflowsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/ticker" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TickerPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/ai-tools" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AIToolsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard/settings" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <SettingsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
