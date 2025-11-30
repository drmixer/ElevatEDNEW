import React, { useEffect, useRef, useState } from 'react';
import { X, Eye, EyeOff, Mail, Lock, User, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'parent' as UserRole,
    grade: 1,
    age: '',
    guardianContact: '',
    parentEmail: '',
    focusSubject: 'balanced' as 'balanced' | 'math' | 'english' | 'science',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guardianConsent, setGuardianConsent] = useState(false);

  const { login, register } = useAuth();
  const parsedAge = Number.parseInt(formData.age, 10);
  const hasValidAge = Number.isFinite(parsedAge) && parsedAge > 0;
  const isUnder13 = hasValidAge && parsedAge < 13;
  const studentSubmissionBlocked =
    !isLogin &&
    formData.role === 'student' &&
    (!hasValidAge || (isUnder13 && !guardianConsent));

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const focusTrap = (event: KeyboardEvent) => {
      if (!dialogRef.current) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    const initialFocusTarget = firstFieldRef.current ?? closeButtonRef.current;
    initialFocusTarget?.focus();

    document.addEventListener('keydown', focusTrap);
    return () => {
      document.removeEventListener('keydown', focusTrap);
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        if (formData.role === 'student' && !hasValidAge) {
          setError('Tell us the learner’s age so we can route consent correctly.');
          setLoading(false);
          return;
        }

        if (formData.role === 'student' && isUnder13 && !guardianConsent) {
          setError('A parent or guardian needs to approve student sign-ups under age 13.');
          setLoading(false);
          return;
        }

        const consentRecordedAt = new Date().toISOString();
        const consentActor =
          formData.role === 'student' && isUnder13 && guardianConsent
            ? 'guardian_present'
            : 'self_attested_13_plus';

        await register(formData.email, formData.password, formData.name, formData.role, formData.grade, {
          guardianConsent,
          studentAge: hasValidAge ? parsedAge : undefined,
          consentActor,
          consentActorDetails: guardianConsent
            ? formData.guardianContact?.trim() || 'Guardian present during signup'
            : 'Student attested age 13+',
          consentRecordedAt,
          guardianContact: guardianConsent ? formData.guardianContact?.trim() || formData.email : null,
          parentEmail: formData.parentEmail?.trim() || null,
          focusSubject: formData.focusSubject,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const grades = Array.from({ length: 12 }, (_, i) => i + 1); // Grades 1–12
  const headingId = 'auth-modal-title';
  const descriptionId = 'auth-modal-description';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
            ref={dialogRef}
            tabIndex={-1}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-teal to-brand-blue p-6 text-white relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors focus-ring"
                aria-label="Close authentication modal"
                ref={closeButtonRef}
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center space-x-3">
                <img src="https://i.imgur.com/tBePI5o.png" alt="ElevatED" className="h-8 w-8" />
                <div>
                  <h2 className="text-xl font-bold" id={headingId}>
                    {isLogin ? 'Welcome Back!' : 'Join ElevatED'}
                  </h2>
                  <p className="text-sm opacity-90" id={descriptionId}>
                    {isLogin ? 'Sign in to continue learning' : 'Pick who is signing up to keep things clear'}
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal"
                          placeholder="Enter your full name"
                          ref={firstFieldRef}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        I am a...
                      </label>
                      <p className="text-xs text-gray-600 mb-2">
                        Recommended: parents create the family space first, then invite learners or link with a code.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, role: 'parent' });
                            setGuardianConsent(false);
                          }}
                          className={`p-4 rounded-xl border-2 text-left text-sm font-medium transition-all focus-ring ${
                            formData.role === 'parent'
                              ? 'border-brand-violet bg-brand-light-violet text-brand-blue'
                              : 'border-gray-300 text-gray-700 hover:border-brand-violet'
                          }`}
                          aria-pressed={formData.role === 'parent'}
                          aria-label="Sign up as a parent"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base">👨‍👩‍👧 Parent / Guardian</span>
                            <span className="text-[11px] px-2 py-1 rounded-full bg-white text-brand-blue font-semibold">
                              Recommended
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-normal text-brand-dark/80">
                            Create your family space, invite or link learners, set goals, and manage consent.
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, role: 'student' });
                            setGuardianConsent(false);
                          }}
                          className={`p-4 rounded-xl border-2 text-left text-sm font-medium transition-all focus-ring ${
                            formData.role === 'student'
                              ? 'border-brand-teal bg-brand-light-teal text-brand-blue'
                              : 'border-gray-300 text-gray-700 hover:border-brand-teal'
                          }`}
                          aria-pressed={formData.role === 'student'}
                          aria-label="Sign up as a student"
                        >
                          <span className="text-base">📚 I&apos;m a student (with my parent here)</span>
                          <p className="mt-2 text-xs font-normal text-brand-dark/80">
                            Start learning with your parent present. They can link your account and view progress.
                          </p>
                        </button>
                      </div>
                    </div>

                    {formData.role === 'student' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Grade Level
                            </label>
                            <div className="relative">
                              <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                              <select
                                value={formData.grade}
                                onChange={(e) => setFormData({ ...formData, grade: parseInt(e.target.value) })}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal appearance-none"
                              >
                                {grades.map((grade) => (
                                  <option key={grade} value={grade}>
                                    Grade {grade}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Learner age
                            </label>
                            <input
                              type="number"
                              min={5}
                              max={18}
                              required
                              value={formData.age}
                              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal"
                              placeholder="How old is the learner?"
                              aria-describedby="age-consent-hint"
                            />
                            <p id="age-consent-hint" className="mt-1 text-xs text-gray-600">
                              Under-13 accounts require a parent or guardian to co-sign before continuing.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Parent/guardian email
                            </label>
                            <input
                              type="email"
                              value={formData.parentEmail}
                              onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal"
                              placeholder="Parent email for consent and updates"
                            />
                            <p className="mt-1 text-xs text-gray-600">
                              We&apos;ll send consent and progress summaries here. This must be an adult.
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Subject focus (optional)
                            </label>
                            <select
                              value={formData.focusSubject}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  focusSubject: e.target.value as 'balanced' | 'math' | 'english' | 'science',
                                })
                              }
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal"
                            >
                              <option value="balanced">Balanced (all subjects)</option>
                              <option value="math">Math first</option>
                              <option value="english">Reading & Writing first</option>
                              <option value="science">Science first</option>
                            </select>
                            <p className="mt-1 text-xs text-gray-600">
                              We&apos;ll prioritize this subject in today&apos;s plan; you can change it anytime.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                          <p className="font-semibold">Consent for young learners</p>
                          <label className="flex items-start space-x-3 text-gray-800">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 text-brand-teal focus:ring-brand-teal border-amber-300 rounded"
                              checked={guardianConsent}
                              onChange={(e) => setGuardianConsent(e.target.checked)}
                            />
                            <span>
                              Parent/guardian is here and approves this account (required if the learner is under 13).
                            </span>
                          </label>
                          <div className="rounded-lg bg-white text-gray-700 border border-amber-100 p-3 text-xs space-y-2">
                            <p>
                              We collect learning progress to personalize lessons and share weekly summaries with linked
                              guardians. We do not sell student data.
                            </p>
                            <p>
                              Under-13 learners require a parent/guardian co-sign. Ages 13+ may self-attest, but we log
                              who approved, when, and how to reach them for any questions.
                            </p>
                            <Link to="/legal/privacy#coppa" className="text-brand-blue font-semibold hover:text-brand-teal">
                              Read our family privacy commitments
                            </Link>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-amber-800">
                              Parent/guardian name & email (for consent log)
                            </label>
                            <input
                              type="text"
                              value={formData.guardianContact}
                              onChange={(e) => setFormData({ ...formData, guardianContact: e.target.value })}
                              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                              placeholder="e.g., Pat Parent - parent@example.com"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.role === 'parent' && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
                        Create your parent account to manage and invite your learners. Students under 13 should sign in
                        under a parent or guardian account, and you will approve data use during linking.
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      placeholder="Enter your email"
                      ref={isLogin ? firstFieldRef : undefined}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-ring"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm" role="alert" aria-live="assertive">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || studentSubmissionBlocked}
                  className="w-full bg-gradient-to-r from-brand-teal to-brand-blue text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                  >
                  {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <p className="mt-3 text-xs text-gray-500 text-center">
                By continuing you agree to our{' '}
                <Link to="/legal/terms" className="text-brand-blue hover:text-brand-teal font-semibold">
                  Terms
                </Link>{' '}
                and{' '}
                <Link to="/legal/privacy" className="text-brand-blue hover:text-brand-teal font-semibold">
                  Privacy Policy
                </Link>
                . Students under 13 should sign up with a parent/guardian present.
              </p>
              <p className="mt-2 text-[11px] text-gray-500 text-center">
                Parents own the family account and can request data export or deletion anytime from the Family
                Dashboard. Learners keep their view focused on lessons only.
              </p>

              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setGuardianConsent(false);
                    setError('');
                  }}
                  className="text-brand-blue hover:text-brand-teal transition-colors font-medium focus-ring"
                >
                  {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;
