import React, { useState } from 'react';
import { Mail, RotateCcw, ShieldCheck } from 'lucide-react';
import supabase from '../../lib/supabaseClient';
import type { UserRole } from '../../types';
import recordReliabilityCheckpoint from '../../lib/reliability';

const ResendVerificationCard: React.FC = () => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('parent');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setError('Enter an email to resend the verification link.');
      return;
    }
    if (cooldown) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo,
        },
      });

      if (resendError) {
        setError(resendError.message ?? 'Unable to resend verification email right now.');
        recordReliabilityCheckpoint('auth_resend_verification', 'error', {
          email: email.trim(),
          role,
          reason: resendError.message ?? 'unknown',
        });
      } else {
        setMessage('If an account exists, we sent a fresh verification link to that email.');
        setCooldown(true);
        setTimeout(() => setCooldown(false), 15000);
        recordReliabilityCheckpoint('auth_resend_verification', 'success', {
          email: email.trim(),
          role,
        });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to resend verification email.');
      recordReliabilityCheckpoint('auth_resend_verification', 'error', {
        email: email.trim(),
        role,
        reason: submitError instanceof Error ? submitError.message : 'unknown',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="p-6 md:p-8 flex flex-col justify-center bg-gradient-to-br from-brand-light-teal/60 via-white to-brand-light-blue/50">
          <div className="flex items-center gap-3 text-brand-blue mb-3">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Email verification</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">Need a new verification link?</h3>
          <p className="mt-2 text-sm text-slate-700">
            Enter your email and role and we&apos;ll resend the confirmation. We don&apos;t reveal whether an account exists for
            privacy—check the inbox and spam folder for the latest link.
          </p>
          <ul className="mt-4 text-sm text-slate-700 space-y-1">
            <li>• Uses the same redirect as signup so you land in the right dashboard.</li>
            <li>• Works for parents or students who changed emails and need a fresh link.</li>
            <li>• Support can help at <a className="text-brand-blue font-semibold" href="mailto:support@elevated.edu">support@elevated.edu</a>.</li>
          </ul>
        </div>
        <div className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full pl-10 pr-3 py-3 rounded-lg border border-slate-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 text-sm"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">I&apos;m signing in as</label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['parent', 'Parent/Guardian'],
                    ['student', 'Student'],
                  ] as Array<[UserRole, string]>
                ).map(([value, label]) => {
                  const active = role === value;
                  return (
                    <button
                      type="button"
                      key={value}
                      onClick={() => setRole(value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        active
                          ? 'border-brand-teal bg-brand-light-teal/60 text-brand-blue'
                          : 'border-slate-200 text-slate-700 hover:border-brand-blue'
                      }`}
                      aria-pressed={active}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || cooldown}
              className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-brand-blue text-white text-sm font-semibold py-3 hover:bg-brand-blue/90 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <RotateCcw className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : cooldown ? (
                'Sent — check your inbox'
              ) : (
                'Resend verification link'
              )}
            </button>
            {message && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                {message}
              </p>
            )}
            {error && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResendVerificationCard;
