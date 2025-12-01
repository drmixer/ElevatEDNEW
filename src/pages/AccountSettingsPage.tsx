import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  UserCheck,
  LogOut,
  ArrowLeft,
  Lock,
  Clock,
  Sparkles,
  Bell,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type {
  SessionLengthPreference,
  Subject,
  Student,
  Parent,
  NotificationPreferences,
  PrivacyRequest,
  PrivacyRequestStatus,
  PrivacyRequestType,
} from '../types';
import { updateLearningPreferences } from '../services/profileService';
import trackEvent from '../lib/analytics';
import { formatSubjectLabel, SUBJECTS } from '../lib/subjects';
import { listPrivacyRequests, submitPrivacyRequest } from '../services/privacyService';
import { updateParentNotifications } from '../services/parentService';

const roleLabels: Record<string, string> = {
  student: 'Student',
  parent: 'Parent/Guardian',
  admin: 'Platform Admin',
};

const AccountSettingsPage: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const studentUser = user?.role === 'student' ? (user as Student) : null;
  const [sessionLength, setSessionLength] = useState<SessionLengthPreference>(
    studentUser?.learningPreferences.sessionLength ?? 'standard',
  );
  const [focusSubject, setFocusSubject] = useState<Subject | 'balanced'>(
    studentUser?.learningPreferences.focusSubject ?? 'balanced',
  );
  const [focusIntensity, setFocusIntensity] = useState<'balanced' | 'focused'>(
    studentUser?.learningPreferences.focusIntensity ?? 'balanced',
  );
  const [prefMessage, setPrefMessage] = useState<string | null>(null);
  const [prefError, setPrefError] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const parentUser = user?.role === 'parent' ? (user as Parent) : null;
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(
    parentUser?.notifications ?? null,
  );
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([]);
  const [privacyRequestType, setPrivacyRequestType] = useState<PrivacyRequestType>('export');
  const [privacyReason, setPrivacyReason] = useState('');
  const [privacyContact, setPrivacyContact] = useState(parentUser?.email ?? '');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(parentUser?.children[0]?.id ?? null);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentUser) return;
    setSessionLength(studentUser.learningPreferences.sessionLength);
    setFocusSubject(studentUser.learningPreferences.focusSubject);
    setFocusIntensity(studentUser.learningPreferences.focusIntensity);
  }, [studentUser?.id, studentUser?.learningPreferences]);

  useEffect(() => {
    if (!parentUser) return;
    setNotificationPrefs(parentUser.notifications);
    setPrivacyContact(parentUser.email ?? '');
  }, [parentUser?.id, parentUser?.notifications, parentUser?.email]);

  useEffect(() => {
    if (!parentUser?.children?.length) return;
    if (!selectedChildId || !parentUser.children.some((child) => child.id === selectedChildId)) {
      setSelectedChildId(parentUser.children[0].id);
    }
  }, [parentUser?.children, parentUser?.children?.length, selectedChildId]);

  const handleSavePreferences = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studentUser) {
      setPrefError('Learning preferences are only available for student accounts.');
      return;
    }
    setSavingPrefs(true);
    setPrefError(null);
    setPrefMessage(null);
    try {
      await updateLearningPreferences(studentUser.id, {
        sessionLength,
        focusSubject,
        focusIntensity,
      });
      setPrefMessage('Saved! Your daily plan will adapt in the next refresh.');
      trackEvent('student_learning_preferences_saved', {
        studentId: studentUser.id,
        sessionLength,
        focusSubject,
        focusIntensity,
      });
      await refreshUser();
    } catch (error) {
      console.error('[Settings] failed to save learning preferences', error);
      setPrefError(error instanceof Error ? error.message : 'Unable to save preferences right now.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const toggleNotificationPref = (key: keyof NotificationPreferences) => {
    setNotificationPrefs((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const handleSaveNotifications = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!parentUser || !notificationPrefs) return;
    setSavingNotifications(true);
    setNotificationMessage(null);
    setNotificationError(null);
    try {
      await updateParentNotifications(parentUser.id, notificationPrefs);
      setNotificationMessage('Updated. We will only send the alerts you keep enabled.');
      trackEvent('parent_notifications_updated', {
        parentId: parentUser.id,
        ...notificationPrefs,
      });
      await refreshUser();
    } catch (error) {
      console.error('[Settings] failed to update notification preferences', error);
      setNotificationError(error instanceof Error ? error.message : 'Unable to save notification preferences.');
    } finally {
      setSavingNotifications(false);
    }
  };

  const loadPrivacyRequests = useCallback(async () => {
    if (!parentUser?.id) return;
    setPrivacyLoading(true);
    setPrivacyError(null);
    try {
      const requests = await listPrivacyRequests({ requesterId: parentUser.id });
      setPrivacyRequests(requests);
    } catch (error) {
      console.error('[Settings] failed to load privacy requests', error);
      setPrivacyError('Could not load requests right now. Please retry.');
    } finally {
      setPrivacyLoading(false);
    }
  }, [parentUser?.id]);

  useEffect(() => {
    if (parentUser?.id) {
      loadPrivacyRequests();
    }
  }, [parentUser?.id, loadPrivacyRequests]);

  const handleSubmitPrivacyRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parentUser || !selectedChildId) {
      setPrivacyError('Select a linked learner to continue.');
      return;
    }
    setPrivacyLoading(true);
    setPrivacyMessage(null);
    setPrivacyError(null);
    try {
      await submitPrivacyRequest({
        requesterId: parentUser.id,
        studentId: selectedChildId,
        requestType: privacyRequestType,
        reason: privacyReason,
        contactEmail: privacyContact || parentUser.email,
        metadata: {
          source: 'account_settings',
          actor: parentUser.name,
        },
      });
      setPrivacyMessage('Request sent. We will confirm via email after verifying guardian status.');
      trackEvent('privacy_request_submitted', {
        parentId: parentUser.id,
        studentId: selectedChildId,
        type: privacyRequestType,
        source: 'account_settings',
      });
      setPrivacyReason('');
      await loadPrivacyRequests();
    } catch (error) {
      console.error('[Settings] failed to submit privacy request', error);
      setPrivacyError(error instanceof Error ? error.message : 'Unable to send your request right now.');
    } finally {
      setPrivacyLoading(false);
    }
  };

  const privacyStatusStyles: Record<PrivacyRequestStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    in_review: 'bg-blue-100 text-blue-800',
    fulfilled: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
  };

  const selectedChild = useMemo(
    () => parentUser?.children?.find((child) => child.id === selectedChildId) ?? null,
    [parentUser?.children, selectedChildId],
  );

  const filteredPrivacyRequests = useMemo(() => {
    if (!selectedChildId) return privacyRequests;
    return privacyRequests.filter((request) => request.studentId === selectedChildId);
  }, [privacyRequests, selectedChildId]);

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
            <p className="text-xs text-slate-500 mt-1">
              ElevatED is for students and parents at home, not school or teacher accounts. Admin tools stay in the
              separate workspace.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={user.role === 'admin' ? '/workspace/admin' : user.role === 'parent' ? '/parent' : '/student'}
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
              School-safe tutor: short, on-topic answers; no personal info collection; safety filters on risky prompts.
            </p>
            <div className="mt-3 grid gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1">What we store</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  <li>• Progress, assignments, and guardian links.</li>
                  <li>• Recent tutor chats for safety review (short retention).</li>
                  <li>• Minimal device/session data to keep accounts secure.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1">Guardrails</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  <li>• Tutor avoids tests/cheats, personal contact info, and off-topic/dating/social advice.</li>
                  <li>• Under-13 accounts stay restricted until guardians approve.</li>
                  <li>• Blocked/flagged chats route to Trust & Safety for review.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1">Need help?</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  <li>• View or submit concerns in the Family Dashboard Safety panel.</li>
                  <li>• Request data export or deletion from this page.</li>
                  <li>• Email support if something feels unsafe or incorrect.</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/parent#safety-privacy"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-light-teal/50 text-brand-teal px-3 py-2 text-sm font-semibold border border-brand-light-teal/60 hover:bg-brand-light-teal/70 transition-colors"
              >
                Go to Family Safety
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </Link>
              <Link
                to="/legal/privacy"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-100 text-slate-800 px-3 py-2 text-sm font-semibold border border-slate-200 hover:bg-slate-200 transition-colors"
              >
                Privacy policy
                <FileText className="h-4 w-4" />
              </Link>
              <a
                href="mailto:support@elevated.edu"
                className="inline-flex items-center gap-2 rounded-lg bg-white text-slate-800 px-3 py-2 text-sm font-semibold border border-slate-200 hover:border-brand-blue hover:text-brand-blue transition-colors"
              >
                Contact support
                <Shield className="h-4 w-4" />
              </a>
            </div>
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

        {studentUser && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 mb-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-brand-teal" />
              <h3 className="text-xl font-bold text-slate-900">Learning style & pacing</h3>
            </div>
            <p className="text-sm text-slate-700">
              Set how long sessions should feel and which subject we should tilt toward when building your adaptive path.
            </p>
            <form onSubmit={handleSavePreferences} className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Preferred session length
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { value: 'short', label: 'Quick boosts', helper: 'About 2 lessons (~15 min)' },
                    { value: 'standard', label: 'Steady pace', helper: '3–4 lessons (~25 min)' },
                    { value: 'long', label: 'Deep dives', helper: 'Up to 5 lessons (~40 min)' },
                  ].map((option) => {
                    const active = sessionLength === option.value;
                    return (
                      <button
                        type="button"
                        key={option.value}
                        onClick={() => setSessionLength(option.value as SessionLengthPreference)}
                        className={`text-left rounded-xl border px-4 py-3 transition-all ${
                          active
                            ? 'border-brand-teal bg-brand-light-teal/40 text-brand-teal shadow-sm'
                            : 'border-slate-200 hover:border-brand-blue'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{option.label}</span>
                          {active && <Sparkles className="h-4 w-4 text-brand-teal" />}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{option.helper}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Subject focus
                  </p>
                  <select
                    value={focusSubject}
                    onChange={(event) =>
                      setFocusSubject(event.target.value as Subject | 'balanced')
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                  >
                    <option value="balanced">Balanced rotation</option>
                    {SUBJECTS.map((subject) => (
                      <option key={subject} value={subject}>
                        {formatSubjectLabel(subject)}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    We’ll prioritize this subject when your plan has open slots.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Focus intensity
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFocusIntensity('balanced')}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        focusIntensity === 'balanced'
                          ? 'border-brand-blue text-brand-blue bg-brand-light-blue/30'
                          : 'border-slate-200 text-slate-700 hover:border-brand-blue'
                      }`}
                    >
                      Balanced
                    </button>
                    <button
                      type="button"
                      onClick={() => setFocusIntensity('focused')}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        focusIntensity === 'focused'
                          ? 'border-brand-teal text-brand-teal bg-brand-light-teal/40'
                          : 'border-slate-200 text-slate-700 hover:border-brand-teal'
                      }`}
                    >
                      Extra emphasis
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Lean into your chosen subject more often while keeping other subjects in the mix.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="submit"
                  disabled={savingPrefs}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-blue text-white text-sm font-semibold hover:bg-brand-blue/90 disabled:opacity-60"
                >
                  {savingPrefs ? 'Saving…' : 'Save preferences'}
                </button>
                {prefMessage && (
                  <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                    {prefMessage}
                  </span>
                )}
                {prefError && (
                  <span className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                    {prefError}
                  </span>
                )}
              </div>
            </form>
          </div>
        )}

        {parentUser && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-brand-blue" />
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Notifications & reports</h3>
                  <p className="text-sm text-slate-600">
                    Choose which alerts we send to your inbox. These settings sync across the Family Dashboard.
                  </p>
                </div>
              </div>
              {notificationPrefs ? (
                <form onSubmit={handleSaveNotifications} className="space-y-3">
                  {(
                    [
                      ['weeklyReports', 'Weekly progress email', 'One summary covering all linked learners.'],
                      ['missedSessions', 'Missed session reminders', 'If a learner skips planned study time.'],
                      ['lowScores', 'Low score alerts', 'When scores dip so you can coach early.'],
                      ['majorProgress', 'Milestones', 'Level-ups, streaks, and standout achievements.'],
                      ['assignments', 'Assignments', 'When new tasks are assigned or overdue.'],
                      ['streaks', 'Streak nudges', 'Small reminders to keep the daily habit.'],
                    ] as Array<[keyof NotificationPreferences, string, string]>
                  ).map(([key, label, helper]) => {
                    const enabled = notificationPrefs[key] ?? false;
                    return (
                      <label
                        key={key}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 hover:border-brand-blue/60"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{label}</p>
                          <p className="text-xs text-slate-600">{helper}</p>
                        </div>
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 text-brand-blue focus:ring-brand-blue border-slate-300 rounded"
                          checked={enabled}
                          onChange={() => toggleNotificationPref(key)}
                        />
                      </label>
                    );
                  })}
                  <div className="flex items-center gap-3 flex-wrap pt-2">
                    <button
                      type="submit"
                      disabled={savingNotifications}
                      className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-blue text-white text-sm font-semibold hover:bg-brand-blue/90 disabled:opacity-60"
                    >
                      {savingNotifications ? 'Saving…' : 'Save notification settings'}
                    </button>
                    {notificationMessage && (
                      <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                        {notificationMessage}
                      </span>
                    )}
                    {notificationError && (
                      <span className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                        {notificationError}
                      </span>
                    )}
                  </div>
                </form>
              ) : (
                <p className="text-sm text-slate-600">Notification settings will appear once your profile loads.</p>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-brand-teal" />
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Data export or deletion</h3>
                    <p className="text-sm text-slate-600">
                      Submit a COPPA/GDPR-style request for a linked learner. We verify guardian links first.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={loadPrivacyRequests}
                  className="p-2 rounded-full border border-slate-200 text-slate-500 hover:text-brand-blue hover:border-brand-blue/40 transition-colors"
                  disabled={privacyLoading}
                  aria-label="Refresh privacy requests"
                >
                  <RefreshCw className={`h-4 w-4 ${privacyLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <form onSubmit={handleSubmitPrivacyRequest} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Learner
                    </label>
                    <select
                      value={selectedChildId ?? ''}
                      onChange={(event) => setSelectedChildId(event.target.value || null)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      disabled={!parentUser?.children?.length}
                    >
                      {!parentUser?.children?.length && <option>No linked learners</option>}
                      {parentUser?.children?.map((child) => (
                        <option key={child.id} value={child.id}>
                          {child.name} (Grade {child.grade})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Request type
                    </label>
                    <select
                      value={privacyRequestType}
                      onChange={(event) => setPrivacyRequestType(event.target.value as PrivacyRequestType)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    >
                      <option value="export">Export learner data</option>
                      <option value="erasure">Delete learner data</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Contact email
                    </label>
                    <input
                      type="email"
                      value={privacyContact}
                      onChange={(event) => setPrivacyContact(event.target.value)}
                      placeholder={parentUser.email}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Reason (optional)
                  </label>
                  <textarea
                    value={privacyReason}
                    onChange={(event) => setPrivacyReason(event.target.value)}
                    rows={2}
                    placeholder="Tell us what you need and how we should scope the export or deletion."
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                  />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="submit"
                    disabled={privacyLoading || !selectedChildId}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-semibold hover:bg-brand-teal/90 disabled:opacity-60"
                  >
                    {privacyLoading ? 'Sending…' : 'Send request'}
                  </button>
                  <p className="text-xs text-slate-600">
                    We acknowledge within 7 days and fulfill after verifying guardian status.
                  </p>
                </div>
              </form>

              {privacyMessage && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  {privacyMessage}
                </p>
              )}
              {privacyError && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {privacyError}
                </p>
              )}

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">Recent requests</h4>
                  {selectedChild && (
                    <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                      {selectedChild.name}
                    </span>
                  )}
                </div>
                {privacyLoading ? (
                  <p className="text-sm text-slate-600">Loading requests…</p>
                ) : filteredPrivacyRequests.length ? (
                  <ul className="space-y-2">
                    {filteredPrivacyRequests.map((request) => (
                      <li
                        key={request.id}
                        className="flex items-start justify-between rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900 capitalize">
                            {request.requestType === 'export' ? 'Export request' : 'Deletion request'}
                          </p>
                          <p className="text-xs text-slate-600">
                            {new Date(request.createdAt).toLocaleDateString()} •{' '}
                            {parentUser.children.find((child) => child.id === request.studentId)?.name ??
                              'Learner'}
                          </p>
                        </div>
                        <span
                          className={`text-[11px] px-2 py-1 rounded-full capitalize ${privacyStatusStyles[request.status]}`}
                        >
                          {request.status.replace('_', ' ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-600">No requests yet.</p>
                )}
                <div className="flex items-start gap-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <Shield className="h-4 w-4 text-brand-blue mt-0.5" />
                  <span>
                    Guardian links and Supabase RLS ensure only approved adults can view or request a child&apos;s data.
                    Each request is logged with your account for auditability.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-brand-blue" />
            <h3 className="text-xl font-bold text-slate-900">Your data & your rights</h3>
          </div>
          <p className="text-sm text-slate-700">
            We make privacy, consent, and control discoverable. Families can export/delete learner data, withdraw
            consent, and control notifications without emailing support.
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-slate-700">
            <li>Under-13 learners require a guardian co-sign; we log who approved and when.</li>
            <li>Data export or deletion requests can be started above or from the Family Dashboard.</li>
            <li>You may withdraw consent at any time via a deletion request or by unlinking a guardian.</li>
            <li>Supabase row-level security ensures only linked guardians and admins can view a child&apos;s records.</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/legal/privacy#coppa"
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
            Guardians can self-serve data exports or deletion requests for a learner in this Settings page or the Family
            Dashboard. Requests are verified against family links and fulfilled by platform admins.
          </p>
          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
            <li>Use the quick request form above to export or delete a linked learner&apos;s data.</li>
            <li>Family Dashboard includes request history, AI summaries, and guardian link management.</li>
            <li>Every request is stamped with your account ID for audit trails.</li>
          </ul>
          <div className="flex items-center gap-3 flex-wrap">
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
            <Link
              to="/legal/privacy#coppa"
              className="text-xs font-semibold text-brand-blue hover:text-brand-teal"
            >
              How we verify guardianship
            </Link>
          </div>
        </div>

        <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="h-5 w-5 text-brand-blue" />
            <h3 className="text-xl font-bold text-slate-900">AI safety guardrails</h3>
          </div>
          <p className="text-sm text-slate-700 mb-3">
            The AI tutor is constrained to safe, family-friendly behavior and keeps personal data out of model prompts.
          </p>
          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
            <li>We scrub emails, phone numbers, and long IDs before sending prompts (see server/ai.ts sanitizer).</li>
            <li>Requests are hashed by learner/IP and rate limited (12 per 5 minutes per learner; 30 per IP).</li>
            <li>We cap context size and sanitize AI responses so PII stays out of chat history.</li>
          </ul>
          <p className="text-xs text-slate-600 mt-2">
            Want a plain-language explanation? Share this with other guardians so they know ElevatED avoids sending PII to
            third-party models and relies on Supabase row-level security for access control.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsPage;
