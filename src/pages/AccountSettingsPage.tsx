import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ShieldCheck, FileText, UserCheck, LogOut, ArrowLeft, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const roleLabels: Record<string, string> = {
  student: 'Student',
  parent: 'Parent/Guardian',
  admin: 'Platform Admin',
};

const AccountSettingsPage: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">Account</p>
            <h1 className="text-3xl font-extrabold text-slate-900">Settings & Privacy</h1>
            <p className="text-sm text-slate-600 mt-1">
              Manage legal notices, privacy preferences, and safety expectations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={user.role === 'admin' ? '/admin' : user.role === 'parent' ? '/parent' : '/student'}
              className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 hover:border-brand-blue hover:text-brand-blue"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to dashboard
            </Link>
            <button
              onClick={logout}
              className="inline-flex items-center px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm font-semibold hover:bg-rose-100"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <UserCheck className="h-5 w-5 text-brand-blue" />
              <h2 className="text-lg font-semibold text-slate-900">Account</h2>
            </div>
            <p className="text-sm text-slate-600 mb-1">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
            <p className="mt-2 text-xs font-semibold text-brand-blue uppercase tracking-wide">
              {roleLabels[user.role] ?? user.role}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className="h-5 w-5 text-brand-teal" />
              <h2 className="text-lg font-semibold text-slate-900">Privacy & Safety</h2>
            </div>
            <p className="text-sm text-slate-600">
              We avoid sending student PII to third parties and rely on Supabase row-level security to govern access.
              Parents can request data export/deletion from the Family Dashboard.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="h-5 w-5 text-brand-violet" />
              <h2 className="text-lg font-semibold text-slate-900">Admin controls</h2>
            </div>
            <p className="text-sm text-slate-600">
              Admin-only access is checked via <code className="px-1">is_platform_admin</code>. Sensitive admin
              dashboards log access events for accountability.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-brand-blue" />
            <h3 className="text-xl font-bold text-slate-900">Legal notices</h3>
          </div>
          <p className="text-sm text-slate-700">
            Review how ElevatED protects learners, families, and schools. These documents are written with COPPA/FERPA
            expectations in mind.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/legal/privacy"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-blue text-white font-semibold hover:bg-brand-blue/90"
            >
              Privacy Policy
            </Link>
            <Link
              to="/legal/terms"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 text-slate-800 font-semibold hover:border-brand-blue hover:text-brand-blue"
            >
              Terms of Service
            </Link>
          </div>
        </div>

        <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="h-5 w-5 text-brand-teal" />
            <h3 className="text-xl font-bold text-slate-900">Data rights</h3>
          </div>
          <p className="text-sm text-slate-700 mb-3">
            Guardians can self-serve data exports or deletion requests for a learner. Requests are verified against
            family links and fulfilled by platform admins.
          </p>
          {user.role === 'parent' ? (
            <Link
              to="/parent"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-teal text-white font-semibold hover:bg-brand-teal/90"
            >
              Open Family Dashboard
            </Link>
          ) : (
            <p className="text-xs text-slate-600">
              Switch to a parent account to submit data rights requests on behalf of a learner.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsPage;
