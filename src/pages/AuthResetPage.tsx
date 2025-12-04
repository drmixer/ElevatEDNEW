import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const AuthResetPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Surface Supabase hash errors (expired/invalid links) instead of silently failing.
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      if (hash) {
        const params = new URLSearchParams(hash);
        const errCode = params.get('error_code');
        const errDescription = params.get('error_description');
        if (errCode) {
          setError(errDescription ?? 'This reset link is invalid or expired. Please request a new one.');
        }
      }
    }

    // Ensure we pull any session from the URL hash when arriving from the reset email.
    supabase.auth.getSession().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    // If the user is already logged in, redirect them home.
    navigate('/', { replace: true });
  }, [navigate, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }
      await refreshUser();
      setStatus('Password updated. You can now sign in.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-blue-50 px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Reset your password</h1>
            <p className="text-sm text-gray-600">Set a new password to finish signing in.</p>
          </div>
          <div className="h-3 w-3 rounded-full bg-teal-500 animate-pulse" aria-hidden />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:ring-2 focus:ring-brand-teal focus:outline-none"
              placeholder="At least 8 characters"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:ring-2 focus:ring-brand-teal focus:outline-none"
              placeholder="Re-enter password"
              required
            />
          </div>
          {status && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm" role="status">
              {status}
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm" role="alert">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-brand-teal to-brand-blue text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            {submitting ? 'Updating...' : 'Update password'}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-4 text-center">
          If this link is expired, request a new reset email from the{' '}
          <Link to="/" className="text-brand-blue hover:text-brand-teal font-semibold">
            sign in page
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default AuthResetPage;
