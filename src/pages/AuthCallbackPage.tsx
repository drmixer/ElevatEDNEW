import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const roleHome = (role?: string | null) => {
  if (!role) return '/';
  if (role === 'admin') return '/workspace/admin';
  return `/${role}`;
};

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState('Verifying your email...');
  const [error, setError] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setError(null);
      setStatus('Verifying your email...');
      try {
        // Process the Supabase URL hash/session if present, then refresh the profile.
        await supabase.auth.getSession();
        await refreshUser();
        if (!cancelled) {
          setStatus('Finishing sign-in...');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to verify your session. Please try signing in again.');
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  useEffect(() => {
    if (user && !error) {
      navigate(roleHome(user.role), { replace: true });
    }
  }, [error, navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-blue-50 px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Finishing up…</h1>
          <div className="h-3 w-3 rounded-full bg-teal-500 animate-pulse" aria-hidden />
        </div>
        <p className="text-sm text-gray-700" aria-live="polite">
          {error ? (
            <>
              We couldn’t verify your session: <span className="text-red-700">{error}</span>
            </>
          ) : (
            status
          )}
        </p>
        <div className="mt-4 text-sm text-gray-600">
          {!user && !error && <p>If this takes more than a few seconds, check your email verification link and try again.</p>}
          {error && (
            <p className="mt-2">
              You can return to the <Link to="/" className="text-brand-blue hover:text-brand-teal font-semibold">home page</Link> and start over.
            </p>
          )}
          {error && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-700">If your link expired, resend the verification email:</p>
              <button
                type="button"
                onClick={async () => {
                  setResendError(null);
                  setResendStatus(null);
                  setResendLoading(true);
                  try {
                    const session = await supabase.auth.getSession();
                    const email =
                      session.data.session?.user?.email ??
                      (session.data.session?.user?.user_metadata?.email as string | undefined) ??
                      null;
                    if (!email) {
                      throw new Error('No email found for this session. Please sign up or sign in again.');
                    }
                    const { error: resendErr } = await supabase.auth.resend({
                      type: 'signup',
                      email,
                    });
                    if (resendErr) {
                      throw resendErr;
                    }
                    setResendStatus('Verification email re-sent. Please check your inbox and spam folder.');
                  } catch (resendCatch) {
                    setResendError(
                      resendCatch instanceof Error
                        ? resendCatch.message
                        : 'Unable to resend verification email. Please try signing in again.',
                    );
                  } finally {
                    setResendLoading(false);
                  }
                }}
                disabled={resendLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-blue text-white px-3 py-2 text-sm font-semibold hover:bg-brand-blue/90 disabled:opacity-60 focus-ring"
              >
                {resendLoading ? 'Sending…' : 'Resend verification email'}
              </button>
              {resendStatus && <p className="text-xs text-emerald-700">{resendStatus}</p>}
              {resendError && <p className="text-xs text-red-700">{resendError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
