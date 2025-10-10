import React, { Suspense, useState, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './components/Landing/LandingPage';
import AuthModal from './components/Auth/AuthModal';
import Header from './components/Layout/Header';

const StudentDashboard = lazy(() => import('./components/Student/StudentDashboard'));
const ParentDashboard = lazy(() => import('./components/Parent/ParentDashboard'));
const AdminDashboard = lazy(() => import('./components/Admin/AdminDashboard'));
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const ModulePage = lazy(() => import('./pages/ModulePage'));
const AdminImportPage = lazy(() => import('./pages/AdminImportPage'));

const DashboardView: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      {user.role === 'student' ? (
        <motion.div
          key="student"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <StudentDashboard />
        </motion.div>
      ) : user.role === 'parent' ? (
        <motion.div
          key="parent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <ParentDashboard />
        </motion.div>
      ) : (
        <motion.div
          key="admin"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <AdminDashboard />
        </motion.div>
      )}
    </AnimatePresence>
  );
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
                <DashboardView />
              ) : (
                <LandingPage onGetStarted={() => setShowAuthModal(true)} />
              )
            }
          />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/module/:id" element={<ModulePage />} />
          <Route
            path="/admin/import"
            element={user ? <AdminImportPage /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {!user && (
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
