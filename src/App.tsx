import React, { Suspense, useState, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EntitlementsProvider } from './contexts/EntitlementsContext';
import LandingPage from './components/Landing/LandingPage';
import AuthModal from './components/Auth/AuthModal';
import Header from './components/Layout/Header';
import type { UserRole } from './types';

const StudentDashboard = lazy(() => import('./components/Student/StudentDashboard'));
const ParentDashboard = lazy(() => import('./components/Parent/ParentDashboard'));
const AdminDashboard = lazy(() => import('./components/Admin/AdminDashboard'));
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const ModulePage = lazy(() => import('./pages/ModulePage'));
const AdminImportPage = lazy(() => import('./pages/AdminImportPage'));
const LessonPlayerPage = lazy(() => import('./pages/LessonPlayerPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'));

const DashboardContainer: React.FC<{ children: React.ReactElement; transitionKey: string }> = ({
  children,
  transitionKey,
}) => (
  <AnimatePresence mode="wait">
    <motion.div
      key={transitionKey}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);

const roleHome = (role?: UserRole | null) => {
  if (!role) return '/';
  if (role === 'admin') return '/workspace/admin';
  return `/${role}`;
};

const ProtectedRoute: React.FC<{ children: React.ReactElement; allowedRoles: UserRole[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return children;
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <img
            src="https://i.imgur.com/tBePI5o.png"
            alt="ElevatED Logo"
            className="h-16 w-auto mx-auto mb-4 animate-pulse"
          />
          <div className="text-xl font-semibold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Loading ElevatED...
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="font-inter min-h-screen bg-slate-50">
      {user && <Header />}
      <Suspense
        fallback={
          <div className="min-h-[50vh] flex items-center justify-center">
            <div className="animate-pulse text-gray-500 text-sm">Loading…</div>
          </div>
        }
      >
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                <Navigate to={roleHome(user.role)} replace />
              ) : (
                <LandingPage onGetStarted={() => setShowAuthModal(true)} />
              )
            }
          />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/module/:id" element={<ModulePage />} />
          <Route path="/lesson/:id" element={<LessonPlayerPage />} />
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <DashboardContainer transitionKey="student">
                  <StudentDashboard />
                </DashboardContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent"
            element={
              <ProtectedRoute allowedRoles={['parent']}>
                <DashboardContainer transitionKey="parent">
                  <ParentDashboard />
                </DashboardContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DashboardContainer transitionKey="admin">
                  <Navigate to="/workspace/admin" replace />
                </DashboardContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/import"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Navigate to="/workspace/admin/import" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DashboardContainer transitionKey="admin-workspace">
                  <AdminDashboard />
                </DashboardContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/admin/import"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminImportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['student', 'parent', 'admin']}>
                <AccountSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="*" element={<Navigate to={roleHome(user?.role ?? null)} replace />} />
        </Routes>
      </Suspense>
      {!user && <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <EntitlementsProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </EntitlementsProvider>
    </AuthProvider>
  );
}

export default App;
