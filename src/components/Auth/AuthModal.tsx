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
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guardianConsent, setGuardianConsent] = useState(false);

  const { login, register } = useAuth();

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
        if (formData.role === 'student' && !guardianConsent) {
          setError('A parent or guardian needs to approve student sign-ups. Please confirm before continuing.');
          setLoading(false);
          return;
        }
        await register(
          formData.email,
          formData.password,
          formData.name,
          formData.role,
          formData.grade,
          { guardianConsent },
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const grades = Array.from({ length: 12 }, (_, i) => i + 1);
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
                    {isLogin ? 'Sign in to continue learning' : 'Start your learning journey today'}
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
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, role: 'student' });
                            setGuardianConsent(false);
                          }}
                          className={`p-3 rounded-xl border-2 text-sm font-medium transition-all focus-ring ${
                            formData.role === 'student'
                              ? 'border-brand-teal bg-brand-light-teal text-brand-blue'
                              : 'border-gray-300 text-gray-700 hover:border-brand-teal'
                          }`}
                          aria-pressed={formData.role === 'student'}
                          aria-label="Sign up as a student"
                        >
                          📚 Student
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, role: 'parent' });
                            setGuardianConsent(false);
                          }}
                          className={`p-3 rounded-xl border-2 text-sm font-medium transition-all focus-ring ${
                            formData.role === 'parent'
                              ? 'border-brand-violet bg-brand-light-violet text-brand-blue'
                              : 'border-gray-300 text-gray-700 hover:border-brand-violet'
                          }`}
                          aria-pressed={formData.role === 'parent'}
                          aria-label="Sign up as a parent"
                        >
                          👨‍👩‍👧 Parent
                        </button>
                      </div>
                    </div>

                    {formData.role === 'student' && (
                      <>
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
                                <option key={grade} value={grade}>Grade {grade}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                          <p className="font-semibold">Parent/guardian approval required for learners under 13.</p>
                          <label className="flex items-start space-x-3 text-gray-800">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 text-brand-teal focus:ring-brand-teal border-amber-300 rounded"
                              checked={guardianConsent}
                              onChange={(e) => setGuardianConsent(e.target.checked)}
                            />
                            <span>
                              I am at least 13 or I&apos;m signing up with my parent/guardian present and they approve this account.
                            </span>
                          </label>
                        </div>
                      </>
                    )}

                    {formData.role === 'parent' && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
                        Create your parent account to manage and invite your learners. Students under 13 should sign in under a parent or guardian account.
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
                  disabled={loading || (!isLogin && formData.role === 'student' && !guardianConsent)}
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
