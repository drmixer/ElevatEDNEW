import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  Download,
  Loader2,
  Link2,
  CreditCard,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Lock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useEntitlements } from '../../contexts/EntitlementsContext';
import type {
  AssignmentStatus,
  Parent,
  ParentChildSnapshot,
  PrivacyRequestStatus,
  PrivacyRequestType,
  Subject,
  SkillGapInsight,
  LearningPreferences,
  defaultLearningPreferences,
} from '../../types';
import { fetchParentDashboardData } from '../../services/dashboardService';
import trackEvent from '../../lib/analytics';
import { assignModuleToStudents, fetchChildAssignments } from '../../services/assignmentService';
import { fetchCatalogModules } from '../../services/catalogService';
import {
  fetchGuardianLinks,
  linkGuardianWithCode,
  revokeGuardianLink,
  upsertChildGoals,
} from '../../services/parentService';
import {
  openBillingPortal,
  startCheckoutSession,
} from '../../services/billingService';
import { listPrivacyRequests, submitPrivacyRequest } from '../../services/privacyService';
import { formatSubjectLabel } from '../../lib/subjects';
import { studySkillsModules } from '../../data/studySkillsModules';
import { limitLabel } from '../../lib/entitlements';
import { updateLearningPreferences } from '../../services/profileService';

const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

const PlanTag: React.FC<{ label: string; locked?: boolean }> = ({ label, locked = false }) => (
  <span
    className={`inline-flex items-center text-[11px] px-2 py-1 rounded-full border ${
      locked
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
    }`}
  >
    {locked ? `Locked · ${label}` : `${label} included`}
  </span>
);

const LockedFeature: React.FC<{
  title: string;
  description: string;
  onUpgrade?: () => void;
  ctaLabel?: string;
}> = ({ title, description, onUpgrade, ctaLabel = 'Unlock with Family Plus' }) => (
  <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
        <Lock className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-800">{title}</p>
        <p className="text-xs text-amber-700">{description}</p>
      </div>
    </div>
    {onUpgrade && (
      <button
        type="button"
        onClick={onUpgrade}
        className="inline-flex items-center px-3 py-2 rounded-lg bg-brand-blue text-white text-sm font-semibold hover:bg-brand-blue/90"
      >
        {ctaLabel}
      </button>
    )}
  </div>
);

type GoalFormState = {
  weeklyLessons: string;
  practiceMinutes: string;
  masteryTargets: Record<Subject, string>;
  focusSubject: Subject | 'balanced';
  focusIntensity: 'balanced' | 'focused';
};

const ParentDashboard: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const parent = (user as Parent) ?? null;
  const {
    entitlements,
    billingSummary,
    availablePlans,
    loading: entitlementsLoading,
    error: entitlementsError,
    refresh: refreshEntitlements,
  } = useEntitlements();
  const queryClient = useQueryClient();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [insightTab, setInsightTab] = useState<'overview' | 'skill_gaps'>('overview');
  const [moduleSearch, setModuleSearch] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [assignErrorMessage, setAssignErrorMessage] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState<GoalFormState>({
    weeklyLessons: '',
    practiceMinutes: '',
    masteryTargets: {},
    focusSubject: defaultLearningPreferences.focusSubject,
    focusIntensity: defaultLearningPreferences.focusIntensity,
  });
  const [goalMessage, setGoalMessage] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [guardianCode, setGuardianCode] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('');
  const [guardianMessage, setGuardianMessage] = useState<string | null>(null);
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [privacyRequestType, setPrivacyRequestType] = useState<PrivacyRequestType>('export');
  const [privacyReason, setPrivacyReason] = useState('');
  const [privacyContact, setPrivacyContact] = useState(parent?.email ?? '');
  const [privacyMessage, setPrivacyMessage] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [newLearnerName, setNewLearnerName] = useState('');
  const [newLearnerGrade, setNewLearnerGrade] = useState<number>(3);
  const [generatedFamilyCode, setGeneratedFamilyCode] = useState('');
  const [onboardingMessage, setOnboardingMessage] = useState<string | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingPrefs, setOnboardingPrefs] = useState<{
    diagnosticScheduled: boolean;
    dismissed: boolean;
    preparedLearner: boolean;
  }>({
    diagnosticScheduled: false,
    dismissed: false,
    preparedLearner: false,
  });

  const {
    data: dashboard,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['parent-dashboard', parent?.id],
    queryFn: () => fetchParentDashboardData({ ...(parent as Parent) }),
    enabled: Boolean(parent),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!dashboard?.children.length) return;
    if (!selectedChildId) {
      setSelectedChildId(dashboard.children[0].id);
      trackEvent('parent_dashboard_child_auto_select', {
        parentId: parent?.id,
        childId: dashboard.children[0].id,
      });
      return;
    }
    const exists = dashboard.children.some((child) => child.id === selectedChildId);
    if (!exists) {
      setSelectedChildId(dashboard.children[0].id);
    }
  }, [dashboard, selectedChildId, parent?.id]);

  useEffect(() => {
    setPrivacyContact(parent?.email ?? '');
  }, [parent?.email]);

  useEffect(() => {
    if (!parent?.id) return;
    try {
      const saved = localStorage.getItem(`family-onboarding-${parent.id}`);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<typeof onboardingPrefs>;
        setOnboardingPrefs((prev) => ({
          diagnosticScheduled: parsed.diagnosticScheduled ?? prev.diagnosticScheduled,
          dismissed: parsed.dismissed ?? prev.dismissed,
          preparedLearner: parsed.preparedLearner ?? prev.preparedLearner,
        }));
      }
    } catch (storageError) {
      console.warn('[ParentDashboard] Unable to restore onboarding prefs', storageError);
    }
  }, [parent?.id]);

  useEffect(() => {
    if (!parent?.id) return;
    try {
      localStorage.setItem(`family-onboarding-${parent.id}`, JSON.stringify(onboardingPrefs));
    } catch (storageError) {
      console.warn('[ParentDashboard] Unable to persist onboarding prefs', storageError);
    }
  }, [parent?.id, onboardingPrefs]);

  const currentChild: ParentChildSnapshot | null = useMemo(() => {
    if (!dashboard?.children.length) return null;
    return (
      dashboard.children.find((child) => child.id === selectedChildId) ?? dashboard.children[0]
    );
  }, [dashboard, selectedChildId]);

  useEffect(() => {
    if (!currentChild) return;
    const preferences = currentChild.learningPreferences ?? defaultLearningPreferences;
    setGoalMessage(null);
    setGoalError(null);
    setGoalForm({
      weeklyLessons: currentChild.goals?.weeklyLessons
        ? String(currentChild.goals.weeklyLessons)
        : '',
      practiceMinutes: currentChild.goals?.practiceMinutes
        ? String(currentChild.goals.practiceMinutes)
        : '',
      masteryTargets: (currentChild.masteryBySubject ?? []).reduce((acc, item) => {
        const target =
          currentChild.goals?.masteryTargets?.[item.subject] ??
          (item.goal != null ? item.goal : '');
        acc[item.subject] = target === '' ? '' : String(target ?? '');
        return acc;
      }, {} as Record<Subject, string>),
      focusSubject: preferences.focusSubject ?? defaultLearningPreferences.focusSubject,
      focusIntensity: preferences.focusIntensity ?? defaultLearningPreferences.focusIntensity,
    });
  }, [currentChild]);

  useEffect(() => {
    setInsightTab('overview');
  }, [currentChild?.id]);

  const familyActivityData = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.activitySeries.map((point) => ({
      label: new Date(point.date).toLocaleDateString(undefined, { weekday: 'short' }),
      lessons: point.lessonsCompleted,
      minutes: point.practiceMinutes,
    }));
  }, [dashboard]);

  const childMasteryData = useMemo(() => {
    if (!currentChild) return [];
    return currentChild.masteryBySubject.map((subject) => ({
      subject: formatSubjectLabel(subject.subject),
      mastery: Math.round(subject.mastery),
    }));
  }, [currentChild]);

  const lowestSubject = useMemo(() => {
    if (!currentChild?.masteryBySubject?.length) return null;
    return (
      currentChild.masteryBySubject.slice().sort((a, b) => a.mastery - b.mastery)[0] ?? null
    );
  }, [currentChild?.masteryBySubject]);

  const strongestSubject = useMemo(() => {
    if (!currentChild?.masteryBySubject?.length) return null;
    return (
      currentChild.masteryBySubject.slice().sort((a, b) => b.mastery - a.mastery)[0] ?? null
    );
  }, [currentChild?.masteryBySubject]);

  const childSkillGaps: SkillGapInsight[] = useMemo(() => {
    if (!currentChild) return [];
    if (currentChild.skillGaps?.length) return currentChild.skillGaps;
    if (!currentChild.masteryBySubject.length) return [];
    const sorted = currentChild.masteryBySubject.slice().sort((a, b) => a.mastery - b.mastery).slice(0, 2);
    return sorted.map((entry) => {
      const concept = currentChild.focusAreas[0] ?? formatSubjectLabel(entry.subject);
      const status: SkillGapInsight['status'] = entry.mastery < 55 ? 'needs_attention' : 'watch';
      return {
        subject: entry.subject,
        mastery: entry.mastery,
        status,
        summary: `${formatSubjectLabel(entry.subject)} mastery is ${Math.round(entry.mastery)}%.`,
        concepts: currentChild.focusAreas.slice(0, 3).length
          ? currentChild.focusAreas.slice(0, 3)
          : [`${formatSubjectLabel(entry.subject)} foundations`],
        actions: [
          `Assign a ${formatSubjectLabel(entry.subject)} module on ${concept}.`,
          `Encourage a 10-minute practice set to shore up ${concept}.`,
          'Ask the AI tutor to reteach the last tricky concept together.',
        ],
      };
    });
  }, [currentChild]);

  const lessonsProgressPct = computePercent(
    currentChild?.lessonsCompletedWeek ?? 0,
    weeklyLessonsTargetValue ?? null,
  );
  const minutesProgressPct = computePercent(
    currentChild?.practiceMinutesWeek ?? 0,
    practiceMinutesTargetValue ?? null,
  );
  const lessonsStatus = describeProgressStatus(lessonsProgressPct);
  const minutesStatus = describeProgressStatus(minutesProgressPct);

  const weeklySnapshot = useMemo(() => {
    if (!dashboard) return null;
    const lessons = (dashboard.children ?? []).reduce(
      (acc, child) => acc + (child.lessonsCompletedWeek ?? 0),
      0,
    );
    const minutes = (dashboard.children ?? []).reduce(
      (acc, child) => acc + (child.practiceMinutesWeek ?? 0),
      0,
    );
    const topStreak = (dashboard.children ?? []).reduce(
      (max, child) => Math.max(max, child.streakDays ?? 0),
      0,
    );
    const childCount = (dashboard.children ?? []).length;
    const averageMasteryRaw =
      (dashboard.children ?? []).reduce((acc, child) => {
        if (!child.masteryBySubject.length) return acc;
        const avg =
          child.masteryBySubject.reduce((masteryTotal, subject) => masteryTotal + subject.mastery, 0) /
          child.masteryBySubject.length;
        return acc + avg;
      }, 0) / Math.max(childCount, 1);

    const weekStartLabel = dashboard.weeklyReport?.weekStart
      ? new Date(dashboard.weeklyReport.weekStart).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })
      : null;

    return {
      lessons,
      minutes,
      topStreak,
      averageMastery:
        childCount > 0 && Number.isFinite(averageMasteryRaw) ? Math.round(averageMasteryRaw) : null,
      weekStartLabel,
    };
  }, [dashboard]);

  const homeExtensions = currentChild?.homeExtensions ?? [];
  const describeActivityType = (activityType?: string) => {
    if (!activityType) return 'Activity';
    const lookup: Record<string, string> = {
      teacher_led: 'Teacher-led',
      independent: 'Independent practice',
      reflection: 'Reflection',
      project: 'Project',
    };
    return lookup[activityType] ?? activityType.replace(/_/g, ' ');
  };

  const familyOverviewCards = useMemo(() => {
    if (!dashboard?.children?.length) return [];
    return dashboard.children.map((child) => {
      const lowest = child.masteryBySubject.slice().sort((a, b) => a.mastery - b.mastery)[0] ?? null;
      const average =
        child.masteryBySubject.length > 0
          ? child.masteryBySubject.reduce((acc, item) => acc + item.mastery, 0) /
            child.masteryBySubject.length
          : null;

      const needsAttention =
        (lowest?.mastery ?? 100) < 55 ||
        ((child.lessonsCompletedWeek ?? 0) < 3 && (child.practiceMinutesWeek ?? 0) < 150);
      const watchList = average !== null && average < 70;
      const status = needsAttention ? 'attention' : watchList ? 'watch' : 'on_track';

      return {
        child,
        lowest,
        average,
        status,
      };
    });
  }, [dashboard?.children]);

  const showSkeleton = isLoading && !dashboard;
  const showAssignmentsSection =
    typeof import.meta !== 'undefined' &&
    typeof import.meta.env !== 'undefined' &&
    import.meta.env.VITE_SHOW_PARENT_ASSIGNMENTS === 'true';

  const realChildren = useMemo(
    () => (dashboard?.children ?? []).filter((child) => !child.id.startsWith('fallback-')),
    [dashboard?.children],
  );
  const seatLimit = entitlements.seatLimit ?? null;
  const seatsUsed = realChildren.length;
  const seatsRemaining = seatLimit !== null ? Math.max(seatLimit - seatsUsed, 0) : null;
  const seatLimitReached = seatLimit !== null && seatsUsed >= seatLimit;
  const hasRealChildren = realChildren.length > 0;
  const hasGoalsSet = realChildren.some((child) => {
    const hasWeekly = Boolean(child.goals?.weeklyLessons && child.goals.weeklyLessons > 0);
    const hasMinutes = Boolean(child.goals?.practiceMinutes && child.goals.practiceMinutes > 0);
    const hasMastery =
      child.goals?.masteryTargets && Object.keys(child.goals.masteryTargets).length > 0;
    return hasWeekly || hasMinutes || hasMastery;
  });
  const diagnosticCompleted = realChildren.some((child) =>
    (child.recentActivity ?? []).some((activity) => {
      const description = activity.description?.toLowerCase() ?? '';
      return description.includes('diagnostic') || description.includes('assessment');
    }),
  );
  const showDiagnosticEmpty = !diagnosticCompleted && !onboardingPrefs.diagnosticScheduled;
  const showOnboardingChecklist =
    !onboardingPrefs.dismissed && (!hasRealChildren || !hasGoalsSet || showDiagnosticEmpty);
  const learnerStepDone = hasRealChildren || onboardingPrefs.preparedLearner;
  const diagnosticStepDone = diagnosticCompleted || onboardingPrefs.diagnosticScheduled;

  const computePercent = (current: number, target?: number | null) => {
    if (!target || target <= 0) return null;
    return Math.min(Math.round((current / target) * 100), 200);
  };

  const deriveSessionLengthPreference = (
    minutesTarget?: number | null,
    lessonsTarget?: number | null,
    fallback: LearningPreferences['sessionLength'] = defaultLearningPreferences.sessionLength,
  ): LearningPreferences['sessionLength'] => {
    if (!minutesTarget || minutesTarget <= 0) return fallback;
    const lessons = lessonsTarget && lessonsTarget > 0 ? lessonsTarget : 4;
    const avgMinutes = minutesTarget / Math.max(lessons, 1);
    if (avgMinutes < 20) return 'short';
    if (avgMinutes > 45) return 'long';
    return 'standard';
  };

  const describeProgressStatus = (percent: number | null) => {
    if (percent === null) {
      return {
        label: 'No target yet',
        badge: 'bg-slate-100 text-slate-700',
        tone: 'text-slate-600',
      };
    }
    if (percent >= 110) {
      return { label: 'Ahead', badge: 'bg-emerald-100 text-emerald-700', tone: 'text-emerald-700' };
    }
    if (percent >= 80) {
      return { label: 'On track', badge: 'bg-brand-light-teal text-brand-teal', tone: 'text-brand-teal' };
    }
    return { label: 'Behind', badge: 'bg-rose-100 text-rose-700', tone: 'text-rose-700' };
  };

  const weeklyLessonsTarget = currentChild?.goals?.weeklyLessons ?? null;
  const practiceMinutesTarget = currentChild?.goals?.practiceMinutes ?? null;
  const masteryTargets = currentChild?.goals?.masteryTargets ?? {};
  const weeklyLessonsTargetValue = Number.isFinite(Number.parseInt(goalForm.weeklyLessons, 10))
    ? Number.parseInt(goalForm.weeklyLessons, 10)
    : weeklyLessonsTarget;
  const practiceMinutesTargetValue = Number.isFinite(Number.parseInt(goalForm.practiceMinutes, 10))
    ? Number.parseInt(goalForm.practiceMinutes, 10)
    : practiceMinutesTarget;

  const focusConcepts = useMemo(() => {
    if (childSkillGaps.length) {
      return childSkillGaps.flatMap((gap) => gap.concepts).filter(Boolean).slice(0, 2);
    }
    if (currentChild?.focusAreas?.length) {
      return currentChild.focusAreas.slice(0, 2);
    }
    if (lowestSubject) {
      return [`${formatSubjectLabel(lowestSubject.subject)} foundations`];
    }
    return [];
  }, [childSkillGaps, currentChild?.focusAreas, lowestSubject]);

  const masteryBands = useMemo(
    () =>
      (currentChild?.masteryBySubject ?? []).map((entry) => ({
        subject: entry.subject,
        label: formatSubjectLabel(entry.subject),
        mastery: Math.round(entry.mastery),
      })),
    [currentChild?.masteryBySubject],
  );

  const focusSubjectOptions = useMemo(
    () => Array.from(new Set((currentChild?.masteryBySubject ?? []).map((entry) => entry.subject))),
    [currentChild?.masteryBySubject],
  );

  const lessonsProgressPct = computePercent(
    currentChild?.lessonsCompletedWeek ?? 0,
    weeklyLessonsTargetValue ?? null,
  );
  const minutesProgressPct = computePercent(
    currentChild?.practiceMinutesWeek ?? 0,
    practiceMinutesTargetValue ?? null,
  );
  const lessonsStatus = describeProgressStatus(lessonsProgressPct);
  const minutesStatus = describeProgressStatus(minutesProgressPct);

  const childNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (dashboard?.children ?? []).forEach((child) => map.set(child.id, child.name));
    return map;
  }, [dashboard]);

  const childPrivacyRequests = useMemo(() => {
    if (!currentChild) return privacyRequests;
    return privacyRequests.filter((request) => request.studentId === currentChild.id);
  }, [privacyRequests, currentChild]);

  const childProgress = currentChild?.progressSummary;
  const completedLessons = childProgress?.completed ?? currentChild?.lessonsCompletedWeek ?? 0;
  const inProgressLessons = childProgress?.inProgress ?? 0;
  const celebrations = dashboard?.celebrations ?? [];
  const celebrationPrompts = dashboard?.celebrationPrompts ?? [];

  const modulesQuery = useQuery({
    queryKey: ['assignable-modules', moduleSearch],
    queryFn: () =>
      fetchCatalogModules({
        page: 1,
        pageSize: 6,
        sort: 'featured',
        search: moduleSearch || undefined,
      }),
    staleTime: 1000 * 60 * 10,
  });

  const moduleOptions = modulesQuery.data?.data ?? [];

  useEffect(() => {
    if (!moduleOptions.length) {
      return;
    }
    if (!moduleOptions.some((module) => module.id === selectedModuleId)) {
      setSelectedModuleId(moduleOptions[0].id);
    }
  }, [moduleOptions, selectedModuleId]);

  const guardianLinksQuery = useQuery({
    queryKey: ['guardian-links', parent?.id],
    queryFn: () => fetchGuardianLinks(parent?.id ?? ''),
    enabled: Boolean(parent),
    staleTime: 1000 * 60 * 2,
  });
  const guardianLinks = guardianLinksQuery.data ?? [];

  const privacyRequestsQuery = useQuery({
    queryKey: ['privacy-requests', parent?.id],
    queryFn: () => listPrivacyRequests(),
    enabled: Boolean(parent),
    staleTime: 1000 * 60 * 2,
  });
  const privacyRequests = privacyRequestsQuery.data ?? [];

  const {
    data: childAssignments,
    isFetching: assignmentsLoading,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ['child-assignments', selectedChildId],
    queryFn: () => fetchChildAssignments(selectedChildId ?? ''),
    enabled: Boolean(selectedChildId),
    staleTime: 1000 * 60,
  });

  const assignmentsList = childAssignments ?? [];

  const assignModuleMutation = useMutation({
    mutationFn: assignModuleToStudents,
    onSuccess: (result) => {
      setAssignMessage(
        `Assigned ${result.assignedStudents} learner${result.assignedStudents === 1 ? '' : 's'} (${result.lessonsAttached} lessons attached).`,
      );
      setAssignErrorMessage(null);
      setDueDate('');
      refetchAssignments();
      queryClient.invalidateQueries({ queryKey: ['parent-dashboard', parent?.id] });
    },
    onError: (error) => {
      console.error('[Assignments] failed to assign module', error);
      setAssignErrorMessage(error instanceof Error ? error.message : 'Unable to assign module.');
      setAssignMessage(null);
    },
  });

  const goalMutation = useMutation({
    mutationFn: async ({ child }: { child: ParentChildSnapshot }) => {
      if (!parent) {
        throw new Error('You need to be signed in as a parent to save goals.');
      }

      const weeklyLessonsTarget = goalForm.weeklyLessons.trim()
        ? Number.parseInt(goalForm.weeklyLessons.trim(), 10)
        : null;
      const practiceMinutesTarget = goalForm.practiceMinutes.trim()
        ? Number.parseInt(goalForm.practiceMinutes.trim(), 10)
        : null;

      const masteryTargets: Partial<Record<Subject, number>> = {};
      Object.entries(goalForm.masteryTargets).forEach(([subject, value]) => {
        if (value === undefined || value === null) return;
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
          masteryTargets[subject as Subject] = parsed;
        }
      });

      const focusSubject = goalForm.focusSubject ?? 'balanced';
      const focusIntensity = goalForm.focusIntensity === 'focused' ? 'focused' : 'balanced';
      const sessionLength = deriveSessionLengthPreference(
        practiceMinutesTarget,
        weeklyLessonsTarget,
        (child.learningPreferences ?? defaultLearningPreferences).sessionLength,
      );

      await Promise.all([
        upsertChildGoals({
          parentId: parent.id,
          studentId: child.id,
          weeklyLessons: Number.isFinite(weeklyLessonsTarget) ? weeklyLessonsTarget : null,
          practiceMinutes: Number.isFinite(practiceMinutesTarget) ? practiceMinutesTarget : null,
          masteryTargets: Object.keys(masteryTargets).length ? masteryTargets : {},
        }),
        updateLearningPreferences(child.id, {
          sessionLength,
          focusSubject,
          focusIntensity,
        }),
      ]);
    },
    onSuccess: async (_data, variables) => {
      setGoalMessage('Goals updated for this learner.');
      setGoalError(null);
      trackEvent('parent_goals_saved', { parentId: parent?.id, childId: variables.child.id });
      await queryClient.invalidateQueries({ queryKey: ['parent-dashboard', parent?.id] });
      await refreshUser();
    },
    onError: (error) => {
      console.error('[ParentDashboard] failed to save goals', error);
      setGoalMessage(null);
      setGoalError(error instanceof Error ? error.message : 'Unable to save goals right now.');
    },
  });

  const linkGuardianMutation = useMutation({
    mutationFn: async (payload: { code: string; relationship?: string }) => {
      const link = await linkGuardianWithCode(payload.code, payload.relationship);
      return link;
    },
    onSuccess: async (link) => {
      setGuardianMessage('Linked! The learner will now appear in your dashboard.');
      setGuardianError(null);
      setGuardianCode('');
      setGuardianRelationship('');
      guardianLinksQuery.refetch();
      trackEvent('guardian_link_created', { parentId: parent?.id, studentId: link?.studentId });
      await queryClient.invalidateQueries({ queryKey: ['parent-dashboard', parent?.id] });
      await refreshUser();
    },
    onError: (error) => {
      console.error('[ParentDashboard] guardian link failed', error);
      setGuardianMessage(null);
      setGuardianError(error instanceof Error ? error.message : 'Unable to link learner right now.');
    },
  });

  const revokeGuardianMutation = useMutation({
    mutationFn: (linkId: number) => revokeGuardianLink(linkId, parent?.id ?? ''),
    onSuccess: async () => {
      setGuardianMessage('Link revoked. The learner will be removed from your dashboard.');
      setGuardianError(null);
      guardianLinksQuery.refetch();
      trackEvent('guardian_link_revoked', { parentId: parent?.id });
      await queryClient.invalidateQueries({ queryKey: ['parent-dashboard', parent?.id] });
      await refreshUser();
    },
    onError: (error) => {
      console.error('[ParentDashboard] failed to revoke guardian link', error);
      setGuardianMessage(null);
      setGuardianError(error instanceof Error ? error.message : 'Unable to update link.');
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (planSlug: string) => startCheckoutSession(planSlug),
    onSuccess: (url, planSlug) => {
      setBillingError(null);
      setBillingMessage(`Redirecting to secure checkout for ${planSlug}...`);
      window.location.href = url;
    },
    onError: (error) => {
      console.error('[Billing] checkout failed', error);
      setBillingMessage(null);
      setBillingError(error instanceof Error ? error.message : 'Unable to start checkout.');
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => openBillingPortal(),
    onSuccess: (url) => {
      setBillingError(null);
      setBillingMessage('Opening billing portal...');
      window.location.href = url;
    },
    onError: (error) => {
      console.error('[Billing] portal failed', error);
      setBillingMessage(null);
      setBillingError(error instanceof Error ? error.message : 'Unable to open billing portal.');
    },
  });

  const privacyRequestMutation = useMutation({
    mutationFn: submitPrivacyRequest,
    onSuccess: (request) => {
      setPrivacyMessage(
        'Request submitted. Our team will verify guardian status and follow up via email.',
      );
      setPrivacyError(null);
      setPrivacyReason('');
      privacyRequestsQuery.refetch();
      trackEvent('privacy_request_submitted', {
        parentId: parent?.id,
        studentId: request.studentId,
        type: request.requestType,
      });
    },
    onError: (error) => {
      console.error('[Privacy] Failed to submit data rights request', error);
      setPrivacyMessage(null);
      setPrivacyError(
        error instanceof Error ? error.message : 'Unable to send request right now. Try again.',
      );
    },
  });

  const handlePrivacyRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parent || !currentChild) {
      setPrivacyError('Select a learner to submit a request.');
      return;
    }
    setPrivacyMessage(null);
    setPrivacyError(null);

    await privacyRequestMutation.mutateAsync({
      requesterId: parent.id,
      studentId: currentChild.id,
      requestType: privacyRequestType,
      contactEmail: privacyContact || parent.email,
      reason: privacyReason,
    });
  };

  const handleAssignModule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parent || !selectedChildId || !selectedModuleId || assignModuleMutation.isLoading) {
      if (!selectedChildId) {
        setAssignErrorMessage('Select a learner before assigning a module.');
      }
      return;
    }

    setAssignMessage(null);
    setAssignErrorMessage(null);

    const dueAtIso = dueDate ? new Date(`${dueDate}T23:59:00`).toISOString() : undefined;

    await assignModuleMutation.mutateAsync({
      moduleId: selectedModuleId,
      studentIds: [selectedChildId],
      creatorId: parent.id,
      creatorRole: 'parent',
      dueAt: dueAtIso,
    });

    trackEvent('parent_assign_module', {
      parentId: parent.id,
      studentId: selectedChildId,
      moduleId: selectedModuleId,
    });
    await refetch({ throwOnError: false });
  };

  const handleSaveGoals = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentChild) {
      setGoalError('Select a learner first.');
      return;
    }
    setGoalMessage(null);
    setGoalError(null);
    await goalMutation.mutateAsync({ child: currentChild });
    await refetch({ throwOnError: false });
  };

  const handleLinkGuardian = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (seatLimitReached) {
      setGuardianError('You have reached the learner limit for your plan. Upgrade to add another learner.');
      return;
    }
    if (!guardianCode.trim()) {
      setGuardianError('Enter the family link code shared by the learner.');
      return;
    }
    setGuardianMessage(null);
    setGuardianError(null);
    await linkGuardianMutation.mutateAsync({
      code: guardianCode,
      relationship: guardianRelationship,
    });
  };

  const handleGenerateFamilyCode = () => {
    if (seatLimitReached) {
      setOnboardingError('You have reached the learner limit for your plan. Upgrade to add more seats.');
      return;
    }
    if (!newLearnerName.trim()) {
      setOnboardingError('Add your learner name to generate a family link code.');
      return;
    }
    const code = `${newLearnerName.trim().slice(0, 3).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
    setGeneratedFamilyCode(code);
    setOnboardingMessage('Share this code with your learner to enter on their screen.');
    setOnboardingError(null);
    setOnboardingPrefs((prev) => ({ ...prev, preparedLearner: true }));
    trackEvent('parent_generated_family_code', {
      parentId: parent?.id,
      grade: newLearnerGrade,
    });
  };

  const handleScheduleDiagnostic = (when: 'now' | 'later') => {
    setOnboardingPrefs((prev) => ({ ...prev, diagnosticScheduled: true }));
    setOnboardingError(null);
    setOnboardingMessage(
      when === 'now'
        ? 'Great! Start the diagnostic on your learner device to personalize their path.'
        : 'Scheduled for later today. We will remind you in the dashboard.',
    );
    trackEvent('parent_schedule_diagnostic', {
      parentId: parent?.id,
      when,
    });
  };

  const handleDismissOnboarding = () => {
    setOnboardingPrefs((prev) => ({ ...prev, dismissed: true }));
    trackEvent('parent_onboarding_dismissed', { parentId: parent?.id });
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const statusBadgeStyles: Record<AssignmentStatus, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    in_progress: 'bg-amber-100 text-amber-700',
    not_started: 'bg-slate-200 text-slate-600',
  };
  const privacyStatusStyles: Record<PrivacyRequestStatus, string> = {
    pending: 'bg-amber-100 text-amber-700',
    in_review: 'bg-blue-100 text-blue-700',
    fulfilled: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
  };
  const skillGapStatusStyles: Record<SkillGapInsight['status'], string> = {
    needs_attention: 'bg-rose-50 text-rose-700 border-rose-100',
    watch: 'bg-amber-50 text-amber-700 border-amber-100',
    improving: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  };
  const familyStatusStyles: Record<
    'attention' | 'watch' | 'on_track',
    { badge: string; border: string; label: string }
  > = {
    attention: {
      badge: 'bg-rose-100 text-rose-700',
      border: 'border-rose-200',
      label: 'Needs attention this week',
    },
    watch: {
      badge: 'bg-amber-100 text-amber-700',
      border: 'border-amber-200',
      label: 'Monitor progress',
    },
    on_track: {
      badge: 'bg-emerald-100 text-emerald-700',
      border: 'border-emerald-200',
      label: 'On track',
    },
  };

  const sortedPlans = useMemo(
    () => (availablePlans ?? []).slice().sort((a, b) => a.priceCents - b.priceCents),
    [availablePlans],
  );
  const currentPlanSlug = entitlements.planSlug ?? 'family-free';
  const currentPlanPrice = entitlements.priceCents ?? 0;
  const nextPlan =
    sortedPlans.find((plan) => plan.slug !== currentPlanSlug && plan.priceCents > currentPlanPrice) ??
    sortedPlans.find((plan) => plan.slug !== currentPlanSlug);
  const billingLoading = entitlementsLoading;
  const billingErrored = Boolean(entitlementsError);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const currentPeriodEnd = entitlements.renewsAt
    ? new Date(entitlements.renewsAt).toLocaleDateString()
    : null;
  const trialEndsAt = entitlements.trialEndsAt ? new Date(entitlements.trialEndsAt) : null;
  const trialDaysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const subscriptionMetadata = (billingSummary?.subscription?.metadata ?? {}) as Record<string, unknown>;
  const canManageBilling = Boolean((subscriptionMetadata?.stripe_customer_id as string | undefined) ?? null);

  const handleUpgrade = (planSlug?: string) => {
    const fallbackTarget =
      nextPlan?.slug ??
      sortedPlans.find((plan) => plan.slug !== currentPlanSlug)?.slug ??
      'family-plus';
    const target = planSlug ?? fallbackTarget;
    checkoutMutation.mutate(target);
  };

  if (!parent) {
    return null;
  }

  const handleDownloadReport = () => {
    if (!dashboard?.downloadableReport) return;
    trackEvent('parent_dashboard_report_download', {
      parentId: parent.id,
      weekStart: dashboard.weeklyReport?.weekStart,
    });
    const blob = new Blob([dashboard.downloadableReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `elevated-weekly-report-${dashboard.weeklyReport?.weekStart ?? 'summary'}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-brand-violet to-brand-blue rounded-2xl p-6 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold mb-2">Family Command Center</h1>
                <p className="opacity-90">
                  Track progress, celebrate wins, and keep everyone aligned in one dashboard.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleDownloadReport}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors"
                  disabled={!dashboard?.downloadableReport}
                >
                  <Download className="h-4 w-4" />
                  <span>Download Weekly Report</span>
                </button>
                <button
                  onClick={() => {
                    trackEvent('parent_dashboard_refresh', { parentId: parent.id });
                    refetch({ throwOnError: false });
                    refreshEntitlements();
                  }}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors"
                  disabled={isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  <span>{isFetching ? 'Refreshing' : 'Refresh'}</span>
                </button>
                <button className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-colors">
                  <Bell className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {entitlements.isTrialing && trialDaysRemaining !== null && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {trialDaysRemaining <= 1
                  ? 'Trial ends soon'
                  : `Trial ends in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'}`}
              </p>
              <p className="text-xs text-amber-700">
                Keep AI weekly summaries and extra seats by upgrading before the trial ends. If you do nothing,
                your account will move to Family Free.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PlanTag label="Trial" locked />
              <button
                type="button"
                onClick={() => handleUpgrade(nextPlan?.slug ?? 'family-plus')}
                className="inline-flex items-center px-3 py-2 rounded-lg bg-brand-blue text-white text-sm font-semibold hover:bg-brand-blue/90"
              >
                Keep my benefits
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Heads up!</p>
              <p className="text-sm">
                We could not refresh the family insights. Displaying cached metrics instead.
              </p>
            </div>
          </div>
        )}

        {showOnboardingChecklist && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-8"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-blue">
                    Parent-first setup
                  </p>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">Get your family set up in minutes</h3>
                  <p className="text-sm text-slate-700">
                    Follow the three steps: add or link a learner, set starter goals, then kick off a diagnostic now or
                    later today.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => scrollToSection('family-connections')}
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-brand-light-teal text-brand-teal text-sm font-semibold hover:bg-brand-light-teal/80"
                  >
                    Go to Family Connections
                  </button>
                  <button
                    onClick={handleDismissOnboarding}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 hover:border-brand-blue hover:text-brand-blue"
                  >
                    Hide checklist
                  </button>
                </div>
              </div>

              {onboardingMessage && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  {onboardingMessage}
                </p>
              )}
              {onboardingError && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {onboardingError}
                </p>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-brand-teal" />
                      <span className="font-semibold text-gray-900">Step 1: Add or link a learner</span>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-1 rounded-full ${
                        learnerStepDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {learnerStepDone ? 'Done' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700">
                    Enter a learner name and grade to prep their invite. Share the family link code from their screen or
                    the one you generate here.
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {seatLimit !== null
                      ? `Seats used: ${seatsUsed}/${seatLimit}. ${
                          seatLimitReached
                            ? 'Upgrade to add another learner.'
                            : `${seatsRemaining} seat${seatsRemaining === 1 ? '' : 's'} remaining.`
                        }`
                      : 'Family plan seats sync to your subscription.'}
                  </p>
                  {seatLimitReached && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                      <span>You have filled your current seats. Upgrade to link another learner.</span>
                      <button
                        type="button"
                        onClick={() => handleUpgrade(nextPlan?.slug ?? 'family-plus')}
                        className="inline-flex items-center px-2 py-1 rounded-md bg-brand-blue text-white font-semibold hover:bg-brand-blue/90"
                      >
                        Unlock seats
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      value={newLearnerName}
                      onChange={(event) => setNewLearnerName(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      placeholder="Learner name"
                    />
                    <select
                      value={newLearnerGrade}
                      onChange={(event) => setNewLearnerGrade(Number(event.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => (
                        <option key={grade} value={grade}>
                          Grade {grade}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateFamilyCode}
                      disabled={seatLimitReached}
                      className="inline-flex items-center px-3 py-2 rounded-lg bg-brand-blue text-white text-sm font-semibold hover:bg-brand-blue/90 disabled:opacity-60"
                    >
                      Generate family link code
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection('family-connections')}
                      className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 hover:border-brand-blue hover:text-brand-blue"
                    >
                      Link with existing code
                    </button>
                  </div>
                  {generatedFamilyCode && (
                    <div className="rounded-lg bg-white border border-slate-200 p-3 text-xs">
                      Share this with your learner: <span className="font-semibold">{generatedFamilyCode}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-brand-blue" />
                      <span className="font-semibold text-gray-900">Step 2: Set starter goals</span>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-1 rounded-full ${
                        hasGoalsSet ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {hasGoalsSet ? 'Done' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700">
                    Set weekly lessons, minutes, and focus subjects so the AI tutor and family digests stay on track.
                  </p>
                  <button
                    type="button"
                    onClick={() => scrollToSection('goal-planner')}
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-brand-teal text-white text-sm font-semibold hover:bg-brand-teal/90"
                  >
                    Open goal planner
                  </button>
                  {!hasRealChildren && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      Add or link a learner first to unlock goals.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-brand-violet" />
                      <span className="font-semibold text-gray-900">Step 3: Diagnostic</span>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-1 rounded-full ${
                        diagnosticStepDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {diagnosticStepDone ? 'Ready' : 'Not started'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700">
                    Run the adaptive check-in on the learner device now, or schedule it for later today so we can
                    personalize their path.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleScheduleDiagnostic('now')}
                      className="inline-flex items-center px-3 py-2 rounded-lg bg-brand-violet text-white text-sm font-semibold hover:bg-brand-violet/90"
                    >
                      Start diagnostic now
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScheduleDiagnostic('later')}
                      className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 hover:border-brand-blue hover:text-brand-blue"
                    >
                      Schedule later today
                    </button>
                  </div>
                  {showDiagnosticEmpty && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      We have not seen a diagnostic yet. Start one to unlock calibrated lessons and reports.
                    </p>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-600 border-t border-slate-100 pt-3">
                Under-13 consent: linking a learner confirms you are their parent/guardian and agree to our privacy
                policy for storing progress to personalize learning.
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start space-x-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-blue to-brand-violet flex items-center justify-center text-white">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Plan</p>
                <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <span>{entitlements.planName ?? 'Family Free'}</span>
                  <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {entitlements.planStatus ?? 'trialing'}
                  </span>
                  <PlanTag label={entitlements.tier === 'premium' ? 'Premium' : entitlements.tier === 'plus' ? 'Plus' : 'Free'} locked={currentPlanSlug === 'family-free'} />
                </h3>
                <p className="text-sm text-gray-600">
                  {currentPlanPrice > 0
                    ? `${formatPrice(currentPlanPrice)} / month`
                    : 'Start your family plan to unlock more lessons and AI access.'}
                </p>
                <div className="mt-2 text-sm text-gray-600 space-y-1">
                  {billingMessage && <p className="text-emerald-700">{billingMessage}</p>}
                  {billingError && <p className="text-rose-600">{billingError}</p>}
                  {billingErrored && !billingError && (
                    <p className="text-rose-600">
                      Billing data is temporarily unavailable{entitlementsError ? `: ${entitlementsError}` : '.'}
                    </p>
                  )}
                  {currentPeriodEnd && (
                    <p className="text-gray-600">Renews on {currentPeriodEnd}</p>
                  )}
                  {trialEndsAt && (
                    <p className="text-gray-600">
                      Trial ends {trialEndsAt.toLocaleDateString()}
                    </p>
                  )}
                  {entitlements.cancelAt && (
                    <p className="text-gray-600">
                      Scheduled to cancel on {new Date(entitlements.cancelAt).toLocaleDateString()}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mt-2">
                    <span className="inline-flex items-center gap-2 text-gray-700">
                      <Sparkles className="h-3 w-3 text-brand-violet" />
                      AI tutor: {limitLabel(entitlements.aiTutorDailyLimit, 'chats/day')}
                    </span>
                    <span className="inline-flex items-center gap-2 text-gray-700">
                      <Users className="h-3 w-3 text-brand-blue" />
                      Seats: {seatLimit !== null ? `${seatsUsed}/${seatLimit}` : `${seatsUsed}+`}
                    </span>
                    <span className="inline-flex items-center gap-2 text-gray-700">
                      <Target className="h-3 w-3 text-brand-teal" />
                      {entitlements.weeklyAiSummaries ? 'Weekly AI summaries included' : 'Weekly summaries locked on Free'}
                    </span>
                    <span className="inline-flex items-center gap-2 text-gray-700">
                      <TrendingUp className="h-3 w-3 text-brand-blue" />
                      {entitlements.advancedAnalytics ? 'Advanced analytics on' : 'Advanced analytics locked'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {entitlements.isTrialing && trialEndsAt
                      ? `If you don’t upgrade, you’ll move to Family Free after ${trialEndsAt.toLocaleDateString()}.`
                      : 'You can change plans anytime. Downgrades apply at the next renewal.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => portalMutation.mutate()}
                  disabled={!canManageBilling || portalMutation.isLoading || billingLoading}
                  className="px-4 py-2 rounded-xl border border-gray-200 hover:border-gray-300 text-sm font-medium flex items-center space-x-2 disabled:opacity-60"
                >
                  <ShieldCheck className="h-4 w-4 text-brand-blue" />
                  <span>{portalMutation.isLoading ? 'Opening...' : 'Manage billing'}</span>
                </button>

                <button
                  onClick={() => handleUpgrade(nextPlan?.slug ?? currentPlanSlug)}
                  disabled={checkoutMutation.isLoading || billingLoading}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet text-white text-sm font-semibold flex items-center space-x-2 shadow-sm hover:shadow-md disabled:opacity-70"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  <span>
                    {checkoutMutation.isLoading
                      ? 'Redirecting...'
                      : nextPlan
                        ? `Upgrade to ${nextPlan.name}`
                        : 'Change plan'}
                  </span>
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                {sortedPlans.map((plan) => (
                  <span
                    key={plan.slug}
                    className={`px-3 py-1 rounded-full border ${
                      plan.slug === currentPlanSlug ? 'border-brand-blue text-brand-blue' : 'border-gray-200'
                    } ${plan.slug === currentPlanSlug ? 'cursor-default' : 'cursor-pointer'}`}
                    onClick={() => {
                      if (plan.slug !== currentPlanSlug) {
                        handleUpgrade(plan.slug);
                      }
                    }}
                    role="button"
                    aria-label={`Switch to ${plan.name}`}
                  >
                    {plan.name} · {formatPrice(plan.priceCents)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-8"
          id="family-overview"
        >
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-blue">
                  Family overview
                </p>
                <h3 className="text-xl font-bold text-gray-900">This week at a glance</h3>
                <p className="text-sm text-gray-600">
                  Quick read on every learner with streaks, XP, and where to focus next.
                </p>
              </div>
              <div className="text-xs text-gray-500">
                Week of {weeklySnapshot?.weekStartLabel ?? '—'}
              </div>
            </div>

            {showSkeleton ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <SkeletonCard className="h-32" />
                <SkeletonCard className="h-32" />
                <SkeletonCard className="h-32" />
              </div>
            ) : familyOverviewCards.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {familyOverviewCards.map((item) => {
                  const statusStyle = familyStatusStyles[item.status];
                  const lowestLabel = item.lowest
                    ? `${formatSubjectLabel(item.lowest.subject)} ${Math.round(item.lowest.mastery)}%`
                    : 'Mastery pending';
                  const primaryGap = item.child.skillGaps?.[0];
                  return (
                    <div
                      key={item.child.id}
                      className={`rounded-xl border ${statusStyle.border} bg-slate-50/70 p-4 space-y-2`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-violet text-white font-semibold flex items-center justify-center">
                            {item.child.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{item.child.name}</div>
                            <div className="text-xs text-gray-600">
                              Grade {item.child.grade} • Level {item.child.level}
                            </div>
                          </div>
                        </div>
                        <span className={`text-[11px] px-2 py-1 rounded-full ${statusStyle.badge}`}>
                          {statusStyle.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 border border-slate-200">
                          <Clock className="h-3 w-3 text-brand-blue" />
                          {item.child.practiceMinutesWeek} min
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 border border-slate-200">
                          <Target className="h-3 w-3 text-brand-teal" />
                          {item.child.lessonsCompletedWeek} lessons
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 border border-slate-200">
                          <Sparkles className="h-3 w-3 text-brand-violet" />
                          {item.child.streakDays}d streak
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 border border-slate-200">
                          <Star className="h-3 w-3 text-amber-500" />
                          {item.child.xp} XP
                        </span>
                      </div>
                      <div className="text-sm text-gray-800">
                        {primaryGap?.summary ?? `Lowest area: ${lowestLabel}`}
                      </div>
                      <div className="text-xs text-gray-600">
                        {primaryGap?.actions?.[0] ??
                          'Encourage one focused session or a quick practice set to stay on pace.'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Link a learner to see a family snapshot with streaks, XP, and focus areas.
              </p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.09 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-brand-teal to-brand-blue rounded-2xl p-6 text-white">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
                  <Sparkles className="h-4 w-4" />
                  <span>Celebrate</span>
                </div>
                <h3 className="text-xl font-bold">Big wins to share</h3>
                <p className="text-sm text-white/90">
                  Quick prompts for badges, streaks, and milestone moments.
                </p>
                <div className="space-y-2">
                  {celebrations.slice(0, 3).map((moment) => (
                    <div
                      key={moment.id}
                      className="rounded-xl bg-white/10 border border-white/15 p-3 flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">{moment.title}</p>
                        <p className="text-xs text-white/80">{moment.description}</p>
                        <p className="text-[11px] text-white/60">
                          {new Date(moment.occurredAt).toLocaleString([], { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          trackEvent('parent_celebration_share', { parentId: parent.id, momentId: moment.id })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-brand-blue text-xs font-semibold hover:bg-gray-100"
                      >
                        <Bell className="h-4 w-4" />
                        Share
                      </button>
                    </div>
                  ))}
                  {celebrations.length === 0 && (
                    <p className="text-sm text-white/80">
                      Complete missions to surface celebration prompts here.
                    </p>
                  )}
                </div>
              </div>
              <div className="lg:min-w-[260px] bg-white/10 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80 mb-2">
                  Celebration prompts
                </p>
                <ul className="space-y-2 text-sm text-white/90">
                  {(celebrationPrompts.length ? celebrationPrompts : ['Ask: “What are you proud of today?”']).map(
                    (prompt, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-0.5 text-brand-light-teal">✶</span>
                        <span>{prompt}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex flex-wrap gap-4">
            {!hasRealChildren && (
              <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">No learners linked yet</p>
                <p className="text-xs text-slate-600">
                  Add or link your first learner to unlock goals, diagnostics, and progress views.
                </p>
                <button
                  type="button"
                  onClick={() => scrollToSection('family-connections')}
                  className="inline-flex items-center px-3 py-2 rounded-lg bg-brand-blue text-white text-sm font-semibold hover:bg-brand-blue/90"
                >
                  Add a learner
                </button>
              </div>
            )}
            {(dashboard?.children ?? []).map((child) => (
              <button
                key={child.id}
                onClick={() => {
                  setSelectedChildId(child.id);
                  trackEvent('parent_dashboard_child_select', { parentId: parent.id, childId: child.id });
                }}
                className={`flex items-center space-x-3 px-6 py-4 rounded-2xl transition-all ${
                  currentChild?.id === child.id
                    ? 'bg-white shadow-lg border-2 border-brand-teal'
                    : 'bg-white shadow-sm hover:shadow-md'
                }`}
              >
                <div className="w-10 h-10 bg-brand-violet rounded-full flex items-center justify-center text-white font-semibold">
                  {child.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">{child.name}</div>
                  <div className="text-sm text-gray-600">
                    Grade {child.grade} • Level {child.level}
                  </div>
                </div>
              </button>
            ))}
            {showSkeleton && (
              <>
                <SkeletonCard className="h-16 w-48" />
                <SkeletonCard className="h-16 w-48" />
              </>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="mb-8"
        >
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-blue">
                  Weekly pulse
                </p>
                <h3 className="text-xl font-bold text-gray-900">Usage, pace, and focus</h3>
                <p className="text-sm text-gray-600">
                  Time this week, lessons done, quick mastery bands, and what to lean into next.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wide">
                  Focus concepts
                </span>
                {focusConcepts.length ? (
                  focusConcepts.map((concept) => (
                    <span
                      key={concept}
                      className="px-3 py-1 rounded-full bg-brand-light-teal/60 text-brand-teal font-semibold"
                    >
                      {concept}
                    </span>
                  ))
                ) : (
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                    Awaiting diagnostic to suggest focus
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">Time this week</p>
                  <span className={`text-[11px] px-2 py-1 rounded-full ${minutesStatus.badge}`}>
                    {minutesStatus.label}
                  </span>
                </div>
                <p className={`text-2xl font-bold ${minutesStatus.tone}`}>
                  {currentChild?.practiceMinutesWeek ?? 0} min
                </p>
                <p className="text-xs text-gray-600">
                  Target {practiceMinutesTargetValue ? `${practiceMinutesTargetValue} min/week` : 'set a target'}
                </p>
                <div className="h-2 rounded-full bg-white overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-brand-teal"
                    style={{ width: `${Math.min(minutesProgressPct ?? 0, 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">Lessons done</p>
                  <span className={`text-[11px] px-2 py-1 rounded-full ${lessonsStatus.badge}`}>
                    {lessonsStatus.label}
                  </span>
                </div>
                <p className={`text-2xl font-bold ${lessonsStatus.tone}`}>
                  {currentChild?.lessonsCompletedWeek ?? 0} lessons
                </p>
                <p className="text-xs text-gray-600">
                  Target {weeklyLessonsTargetValue ? `${weeklyLessonsTargetValue} /week` : 'set a target'}
                </p>
                <div className="h-2 rounded-full bg-white overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-brand-blue"
                    style={{ width: `${Math.min(lessonsProgressPct ?? 0, 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">Mastery bands</p>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-white text-slate-700 border border-slate-200">
                    By subject
                  </span>
                </div>
                <div className="space-y-2">
                  {masteryBands.length ? (
                    masteryBands.slice(0, 4).map((band) => (
                      <div key={band.subject}>
                        <div className="flex items-center justify-between text-xs text-gray-700">
                          <span>{band.label}</span>
                          <span>{band.mastery}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-white overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-brand-violet"
                            style={{ width: `${Math.min(band.mastery, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-600">
                      We&apos;ll chart mastery by subject once the first lessons are finished.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          {showSkeleton ? (
            <>
              <SkeletonCard className="h-24" />
              <SkeletonCard className="h-24" />
              <SkeletonCard className="h-24" />
              <SkeletonCard className="h-24" />
            </>
          ) : (
            <>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-brand-blue">{currentChild?.level ?? '—'}</div>
                    <div className="text-sm text-gray-600">Current Level</div>
                  </div>
                  <div className="w-12 h-12 bg-brand-light-blue rounded-full flex items-center justify-center">
                    <Star className="h-6 w-6 text-brand-blue" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-brand-teal">{currentChild?.xp ?? '—'}</div>
                    <div className="text-sm text-gray-600">Total XP</div>
                  </div>
                  <div className="w-12 h-12 bg-brand-light-teal rounded-full flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-brand-teal" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-brand-violet">
                      {currentChild?.streakDays ?? '—'}
                    </div>
                    <div className="text-sm text-gray-600">Day Streak</div>
                  </div>
                  <div className="w-12 h-12 bg-brand-light-violet rounded-full flex items-center justify-center">
                    <div className="text-2xl">🔥</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{completedLessons}</div>
                    <div className="text-sm text-gray-600">Completed Lessons</div>
                    <p className="text-xs text-gray-500 mt-1">In progress: {inProgressLessons}</p>
                  </div>
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-gray-600" />
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Weekly Learning Activity</h3>
                <div className="text-sm text-gray-500 flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>Last 7 days</span>
                </div>
              </div>
              <div className="h-64">
                {showSkeleton ? (
                  <SkeletonCard className="h-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={familyActivityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF2FF" />
                      <XAxis dataKey="label" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', borderColor: '#E5E7EB' }}
                        labelStyle={{ color: '#1F2937', fontWeight: 600 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="minutes"
                        stroke="#33D9C1"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="lessons"
                        stroke="#6366F1"
                        strokeWidth={3}
                        strokeDasharray="4 4"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  Recent Activity • {currentChild?.name ?? '—'}
                </h3>
                <div className="flex items-center text-sm text-gray-500 space-x-2">
                  <Sparkles className="h-4 w-4" />
                  <span>AI-curated highlights</span>
                </div>
              </div>
              <div className="space-y-4">
                {showSkeleton ? (
                  <>
                    <SkeletonCard className="h-20" />
                    <SkeletonCard className="h-20" />
                  </>
                ) : (
                  (currentChild?.recentActivity ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border border-gray-200 rounded-xl"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-brand-light-teal rounded-full flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-brand-teal" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{item.description}</div>
                          <div className="text-sm text-gray-600">
                            {new Date(item.occurredAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-brand-teal font-medium">+{item.xp} XP</div>
                    </div>
                  ))
                )}
                {(currentChild?.recentActivity?.length ?? 0) === 0 && !showSkeleton && (
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                    <p className="text-sm text-gray-600">
                      We’ll surface highlights once new learning moments are completed.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Study Skills lane</h3>
                  <p className="text-sm text-gray-600">
                    Help learners build planning, focus, and executive function habits alongside core subjects.
                  </p>
                </div>
                <Link
                  to="/catalog?subject=study_skills"
                  className="text-sm font-semibold text-brand-blue hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {studySkillsModules.slice(0, 3).map((module) => (
                  <div
                    key={module.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-semibold text-brand-blue">{module.duration}</span>
                      <span className="px-2 py-1 rounded-full bg-brand-light-teal/60 text-brand-teal font-semibold">
                        Grades {module.gradeBand}
                      </span>
                    </div>
                    <h4 className="font-semibold text-gray-900">{module.title}</h4>
                    <p className="text-sm text-gray-700">{module.focus}</p>
                    <p className="text-[11px] text-gray-500">{module.habit}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-gray-600">{formatSubjectLabel(module.subject)}</span>
                      <Link
                        to={module.ctaPath ?? '/catalog'}
                        className="inline-flex items-center px-3 py-1 rounded-md bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue/90"
                        onClick={() => trackEvent('parent_study_skills_cta', { parentId: parent?.id })}
                      >
                        Browse
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.48 }}
              id="skill-gaps"
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Sparkles className="h-5 w-5 text-brand-violet" />
                  <h3 className="text-xl font-bold text-gray-900">Learning insights</h3>
                </div>
                <div className="flex items-center bg-slate-100 rounded-full p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setInsightTab('overview')}
                    className={`px-3 py-1 rounded-full font-semibold ${
                      insightTab === 'overview' ? 'bg-white shadow-sm text-brand-violet' : 'text-gray-600'
                    }`}
                  >
                    Adaptive plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setInsightTab('skill_gaps')}
                    className={`px-3 py-1 rounded-full font-semibold ${
                      insightTab === 'skill_gaps' ? 'bg-white shadow-sm text-brand-violet' : 'text-gray-600'
                    }`}
                  >
                    Skill gaps
                  </button>
                </div>
              </div>
              {showSkeleton ? (
                <SkeletonCard className="h-24" />
              ) : insightTab === 'skill_gaps' ? (
                <div className="space-y-3">
                  {childSkillGaps.length ? (
                    childSkillGaps.map((gap) => (
                      <div
                        key={gap.subject}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 capitalize">
                              {formatSubjectLabel(gap.subject)}
                            </p>
                            <p className="text-xs text-slate-600">{gap.summary}</p>
                          </div>
                          <span
                            className={`text-[11px] px-2 py-1 rounded-full border ${skillGapStatusStyles[gap.status]}`}
                          >
                            {gap.status === 'needs_attention'
                              ? 'Needs attention'
                              : gap.status === 'improving'
                              ? 'Improving'
                              : 'Watch'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {gap.concepts.map((concept) => (
                            <span
                              key={concept}
                              className="text-[11px] px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700"
                            >
                              {concept}
                            </span>
                          ))}
                        </div>
                        <ul className="space-y-1">
                          {gap.actions.map((action, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                              <ArrowUpRight className="h-4 w-4 text-brand-blue mt-0.5" />
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-600">
                      Complete a diagnostic and a few lessons to surface skill gaps and plain-language actions.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase text-slate-500">Focus this week</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {lowestSubject
                          ? `${formatSubjectLabel(lowestSubject.subject)} · ${Math.round(lowestSubject.mastery)}%`
                          : 'Waiting on data'}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {lowestSubject
                          ? 'Extra practice and repetition scheduled.'
                          : 'Complete a diagnostic to calibrate.'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase text-slate-500">Easing off</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {strongestSubject
                          ? `${formatSubjectLabel(strongestSubject.subject)} anchored`
                          : 'Pending'}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {strongestSubject
                          ? 'Light reinforcement while gaps close elsewhere.'
                          : 'Need more lessons to compare strengths.'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(currentChild?.adaptivePlanNotes ?? []).map((note, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <Sparkles className="h-4 w-4 text-brand-violet mt-0.5" />
                        <p className="text-sm text-gray-700">{note}</p>
                      </div>
                    ))}
                    {(currentChild?.adaptivePlanNotes?.length ?? 0) === 0 && (
                      <p className="text-sm text-gray-600">
                        Adaptive explanations will appear after the first diagnostic and recommendations.
                      </p>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              id="goal-planner"
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Target className="h-5 w-5 text-brand-blue" />
                  <h3 className="text-xl font-bold text-gray-900">Goals & Targets</h3>
                </div>
                {currentChild?.goalProgress !== undefined && (
                  <span className="text-xs font-semibold text-brand-blue">
                    {Math.round(currentChild.goalProgress ?? 0)}% to goal
                  </span>
                )}
              </div>
              {showDiagnosticEmpty && (
                <div className="mb-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No diagnostic detected yet. Start or schedule one to calibrate goals and difficulty.
                </div>
              )}
              {showSkeleton ? (
                <SkeletonCard className="h-40" />
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                        <span>Weekly lessons</span>
                        <span className="text-xs text-gray-500">
                          {weeklyLessonsTargetValue
                            ? `${currentChild?.lessonsCompletedWeek ?? 0}/${weeklyLessonsTargetValue}`
                            : `${currentChild?.lessonsCompletedWeek ?? 0} completed`}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-brand-blue"
                          style={{
                            width: `${Math.min(
                              computePercent(
                                currentChild?.lessonsCompletedWeek ?? 0,
                                weeklyLessonsTargetValue ?? null,
                              ) ?? 0,
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                        <span>Practice minutes</span>
                        <span className="text-xs text-gray-500">
                          {practiceMinutesTargetValue
                            ? `${currentChild?.practiceMinutesWeek ?? 0}/${practiceMinutesTargetValue}`
                            : `${currentChild?.practiceMinutesWeek ?? 0} minutes`}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-brand-teal"
                          style={{
                            width: `${Math.min(
                              computePercent(
                                currentChild?.practiceMinutesWeek ?? 0,
                                practiceMinutesTargetValue ?? null,
                              ) ?? 0,
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSaveGoals} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="goal-weekly-lessons" className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Weekly lessons goal
                        </label>
                        <input
                          id="goal-weekly-lessons"
                          type="number"
                          min={0}
                          value={goalForm.weeklyLessons}
                          onChange={(event) =>
                            setGoalForm((prev) => ({ ...prev, weeklyLessons: event.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                          placeholder="e.g. 6"
                        />
                      </div>
                      <div>
                        <label htmlFor="goal-practice-minutes" className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Practice minutes goal
                        </label>
                        <input
                          id="goal-practice-minutes"
                          type="number"
                          min={0}
                          value={goalForm.practiceMinutes}
                          onChange={(event) =>
                            setGoalForm((prev) => ({ ...prev, practiceMinutes: event.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                          placeholder="e.g. 240"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-900">Subject emphasis</h4>
                        <span className="text-[11px] px-2 py-1 rounded-full bg-white text-slate-700 border border-slate-200">
                          Shapes the daily plan
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Focus subject
                          </label>
                          <select
                            value={goalForm.focusSubject}
                            onChange={(event) =>
                              setGoalForm((prev) => ({
                                ...prev,
                                focusSubject: (event.target.value as Subject | 'balanced') ?? 'balanced',
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                          >
                            <option value="balanced">Balanced across subjects</option>
                            {(focusSubjectOptions.length ? focusSubjectOptions : (['math', 'english', 'science', 'social_studies'] as Subject[])).map(
                              (subject) => (
                                <option key={subject} value={subject}>
                                  {formatSubjectLabel(subject)}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Emphasis level
                          </label>
                          <select
                            value={goalForm.focusIntensity}
                            onChange={(event) =>
                              setGoalForm((prev) => ({
                                ...prev,
                                focusIntensity: event.target.value === 'focused' ? 'focused' : 'balanced',
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                          >
                            <option value="balanced">Keep things balanced</option>
                            <option value="focused">Prioritize this subject</option>
                          </select>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-gray-600">
                        We pass this into the learning preferences so applyLearningPreferencesToPlan leads with the chosen subject.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-900">Mastery targets</h4>
                        <span className="text-xs text-gray-500">Tune per subject</span>
                      </div>
                        <div className="space-y-3">
                          {(currentChild?.masteryBySubject ?? []).map((subject) => {
                          const targetInput = goalForm.masteryTargets[subject.subject];
                          const parsedTarget =
                            targetInput && targetInput.trim().length
                              ? Number.parseFloat(targetInput)
                              : null;
                          const targetNumber =
                            typeof parsedTarget === 'number' && Number.isFinite(parsedTarget)
                              ? parsedTarget
                              : masteryTargets?.[subject.subject] ?? subject.goal ?? null;
                          const percent = computePercent(subject.mastery, targetNumber ?? null) ?? 0;
                          return (
                            <div key={subject.subject} className="flex items-start gap-3">
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                                  <span className="capitalize">
                                    {subject.subject.replace('_', ' ')}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {targetNumber ? `${Math.round(targetNumber)}% target` : 'Set target'}
                                  </span>
                                </div>
                                <div className="mt-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                                  <div
                                    className="h-2 bg-brand-violet"
                                    style={{ width: `${Math.min(percent, 100)}%` }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {Math.round(subject.mastery)}% mastery
                                  {targetNumber ? ` • ${percent}% of target` : ''}
                                </p>
                              </div>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={goalForm.masteryTargets[subject.subject] ?? ''}
                                onChange={(event) =>
                                  setGoalForm((prev) => ({
                                    ...prev,
                                    masteryTargets: {
                                      ...prev.masteryTargets,
                                      [subject.subject]: event.target.value,
                                    },
                                  }))
                                }
                                className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                              />
                            </div>
                          );
                        })}
                        {(currentChild?.masteryBySubject?.length ?? 0) === 0 && (
                          <p className="text-sm text-gray-600">
                            No mastery data yet. Complete lessons to unlock targets.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={goalMutation.isLoading || !currentChild}
                        className="inline-flex items-center justify-center rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue/90 disabled:opacity-50"
                      >
                        {goalMutation.isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          'Save goals'
                        )}
                      </button>
                      {currentChild?.goalProgress !== undefined && (
                        <span className="text-xs text-gray-600">
                          Avg progress {Math.round(currentChild.goalProgress ?? 0)}%
                        </span>
                      )}
                    </div>
                  </form>

                  {goalMessage && (
                    <p className="mt-3 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                      {goalMessage}
                    </p>
                  )}
                  {goalError && (
                    <p className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                      {goalError}
                    </p>
                  )}
                </>
              )}
            </motion.div>

            {showAssignmentsSection && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                id="assignments"
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <ClipboardList className="h-5 w-5 text-brand-blue" />
                    <h3 className="text-xl font-bold text-gray-900">Module Assignments</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => modulesQuery.refetch()}
                    className="p-2 rounded-full border border-slate-200 text-slate-500 hover:text-brand-blue hover:border-brand-blue/40 transition-colors"
                    disabled={modulesQuery.isFetching}
                  >
                    <RefreshCw className={`h-4 w-4 ${modulesQuery.isFetching ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <form onSubmit={handleAssignModule} className="space-y-4">
                  <div>
                    <label htmlFor="assignment-child" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Learner
                    </label>
                    <select
                      id="assignment-child"
                      value={selectedChildId ?? ''}
                      onChange={(event) => setSelectedChildId(event.target.value || null)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      disabled={showSkeleton || !dashboard?.children.length}
                    >
                      {(dashboard?.children ?? []).map((child) => (
                        <option key={child.id} value={child.id}>
                          {child.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="assignment-module" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Module
                      </label>
                      <select
                        id="assignment-module"
                        value={selectedModuleId ?? ''}
                        onChange={(event) => setSelectedModuleId(Number(event.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                        disabled={!moduleOptions.length || modulesQuery.isLoading}
                      >
                        {moduleOptions.map((module) => (
                          <option key={module.id} value={module.id}>
                            {module.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="assignment-due" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Due date (optional)
                      </label>
                      <input
                        id="assignment-due"
                        type="date"
                        value={dueDate}
                        onChange={(event) => setDueDate(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="assignment-search" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Search library
                    </label>
                    <input
                      id="assignment-search"
                      type="search"
                      value={moduleSearch}
                      onChange={(event) => setModuleSearch(event.target.value)}
                      placeholder="Fractions, writing prompts, STEM"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!selectedChildId || !selectedModuleId || assignModuleMutation.isLoading}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue/90 disabled:opacity-50"
                  >
                    {assignModuleMutation.isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Assigning…
                      </>
                    ) : (
                      'Assign module'
                    )}
                  </button>
                </form>

                {assignMessage && (
                  <p className="mt-3 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                    {assignMessage}
                  </p>
                )}
                {assignErrorMessage && (
                  <p className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                    {assignErrorMessage}
                  </p>
                )}

                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Assignments for {currentChild?.name ?? '—'}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {assignmentsList.length} total
                    </span>
                  </div>
                  {assignmentsLoading ? (
                    <SkeletonCard className="h-16" />
                  ) : assignmentsList.length ? (
                    <ul className="space-y-3">
                      {assignmentsList.map((assignment) => (
                        <li
                          key={assignment.id}
                          className="rounded-xl border border-slate-200 px-4 py-3 flex items-start justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{assignment.title}</p>
                            <p className="text-xs text-gray-500">
                              {assignment.moduleTitle ?? 'Module'}
                              {assignment.dueAt ? ` • Due ${new Date(assignment.dueAt).toLocaleDateString()}` : ''}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${statusBadgeStyles[assignment.status]}`}
                          >
                            {assignment.status.replace('_', ' ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-600">
                      No assignments yet. Pick a module and send it their way.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              id="family-connections"
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Link2 className="h-5 w-5 text-brand-teal" />
                  <h3 className="text-xl font-bold text-gray-900">Family Connections</h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <ShieldCheck className="h-4 w-4 text-brand-teal" />
                  <span>Guardian protected</span>
                  <PlanTag label="Seats" locked={seatLimitReached} />
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Enter the family link code your child sees on their screen. Linking confirms you are the parent/guardian
                and allows you to see progress. Under-13 learners should only be linked by a parent/guardian.
              </p>
              <p className="text-[11px] text-slate-600 mb-2">
                {seatLimit !== null
                  ? `You are using ${seatsUsed}/${seatLimit} seats${seatLimitReached ? '. Free up a seat or upgrade to add another learner.' : ''}`
                  : 'Seats follow your current plan.'}
              </p>
              {seatLimitReached && (
                <LockedFeature
                  title="Learner limit reached"
                  description="Family Free includes one learner. Upgrade to Family Plus to link more students under one plan."
                  onUpgrade={() => handleUpgrade(nextPlan?.slug ?? 'family-plus')}
                />
              )}
              <form onSubmit={handleLinkGuardian} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={guardianCode}
                  onChange={(event) => setGuardianCode(event.target.value)}
                  placeholder="Family link code"
                  disabled={seatLimitReached}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-60"
                />
                <input
                  type="text"
                  value={guardianRelationship}
                  onChange={(event) => setGuardianRelationship(event.target.value)}
                  placeholder="Relationship (optional)"
                  disabled={seatLimitReached}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={linkGuardianMutation.isLoading || seatLimitReached}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-teal/90 disabled:opacity-50"
                >
                  {linkGuardianMutation.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Linking…
                    </>
                  ) : (
                    'Link learner'
                  )}
                </button>
              </form>
              <p className="mt-2 text-[11px] text-slate-600">
                By linking, I confirm I am the parent/guardian and agree to the ElevatED privacy policy for storing
                progress data to personalize learning.
              </p>
              {guardianMessage && (
                <p className="mt-3 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  {guardianMessage}
                </p>
              )}
              {guardianError && (
                <p className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {guardianError}
                </p>
              )}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">Linked learners</h4>
                  <button
                    type="button"
                    onClick={() => guardianLinksQuery.refetch()}
                    className="p-1 rounded-full border border-slate-200 text-slate-500 hover:text-brand-blue hover:border-brand-blue/40 transition-colors"
                    disabled={guardianLinksQuery.isFetching}
                  >
                    <RefreshCw className={`h-4 w-4 ${guardianLinksQuery.isFetching ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                {guardianLinksQuery.isFetching ? (
                  <SkeletonCard className="h-14" />
                ) : guardianLinks.length ? (
                  <ul className="space-y-2">
                    {guardianLinks.map((link) => {
                      const statusBadge =
                        link.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : link.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600';
                      return (
                        <li
                          key={link.id}
                          className="flex items-start justify-between rounded-lg border border-slate-200 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {childNameMap.get(link.studentId) ?? 'Learner'}
                              <span className="text-xs text-gray-500 ml-1">#{link.studentId.slice(0, 6)}</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              {(link.relationship ?? 'Guardian').toString()} • {link.acceptedAt ? new Date(link.acceptedAt).toLocaleDateString() : 'awaiting acceptance'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-2 py-1 rounded-full capitalize ${statusBadge}`}>
                              {link.status}
                            </span>
                            {link.status !== 'revoked' && (
                              <button
                                type="button"
                                onClick={() => revokeGuardianMutation.mutate(link.id)}
                                className="text-xs text-rose-600 hover:text-rose-700"
                                disabled={revokeGuardianMutation.isLoading}
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600">
                    No linked learners yet. Ask your student to share their family link code.
                  </p>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.52 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <ShieldCheck className="h-5 w-5 text-brand-blue" />
                  <h3 className="text-xl font-bold text-gray-900">Data rights & privacy</h3>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wide">
                  COPPA / FERPA
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Request an export or deletion of your learner&apos;s data. We verify guardian links before fulfilling
                requests and confirm via email.
              </p>
              <div className="text-xs text-slate-600 mb-4 rounded-lg bg-slate-50 border border-slate-100 p-3">
                Under-13 accounts stay read-only until consent is captured on this parent profile. Exports and deletions
                are fulfilled only for linked guardians, and we log the request time and contact email for audit.
              </div>
              <form onSubmit={handlePrivacyRequest} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Request type
                    </label>
                    <select
                      value={privacyRequestType}
                      onChange={(event) =>
                        setPrivacyRequestType(event.target.value as PrivacyRequestType)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    >
                      <option value="export">Export learner data</option>
                      <option value="erasure">Delete learner data</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Contact email
                    </label>
                    <input
                      type="email"
                      value={privacyContact}
                      onChange={(event) => setPrivacyContact(event.target.value)}
                      placeholder={parent.email}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
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
                    disabled={privacyRequestMutation.isLoading || !currentChild}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue/90 disabled:opacity-50"
                  >
                    {privacyRequestMutation.isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      'Send request'
                    )}
                  </button>
                  <p className="text-xs text-gray-500">
                    We aim to acknowledge within 7 days. Admin follow-up may be required to complete the request.
                  </p>
                </div>
              </form>
              {privacyMessage && (
                <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  {privacyMessage}
                </p>
              )}
              {privacyError && (
                <p className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {privacyError}
                </p>
              )}

              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Recent requests{currentChild ? ` • ${currentChild.name}` : ''}
                  </h4>
                  <button
                    type="button"
                    onClick={() => privacyRequestsQuery.refetch()}
                    className="p-1 rounded-full border border-slate-200 text-slate-500 hover:text-brand-blue hover:border-brand-blue/40 transition-colors"
                    disabled={privacyRequestsQuery.isFetching}
                  >
                    <RefreshCw className={`h-4 w-4 ${privacyRequestsQuery.isFetching ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                {privacyRequestsQuery.isFetching ? (
                  <SkeletonCard className="h-14" />
                ) : childPrivacyRequests.length ? (
                  <ul className="space-y-2">
                    {childPrivacyRequests.map((request) => (
                      <li
                        key={request.id}
                        className="flex items-start justify-between rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900 capitalize">
                            {request.requestType === 'export' ? 'Export request' : 'Deletion request'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(request.createdAt).toLocaleDateString()} •{' '}
                            {childNameMap.get(request.studentId) ?? 'Learner'}
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
                  <p className="text-sm text-gray-600">
                    No requests yet. Submit an export or deletion request to begin the process.
                  </p>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              id="weekly-snapshot"
              className="bg-gradient-to-br from-brand-light-violet to-white rounded-2xl p-6 shadow-sm border border-brand-light-violet/40"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Sparkles className="h-5 w-5 text-brand-violet" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Weekly Snapshot</h3>
                    <p className="text-xs text-gray-700">
                      Week of {weeklySnapshot?.weekStartLabel ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {dashboard?.weeklyReport?.aiGenerated && (
                    <span className="text-xs uppercase tracking-wide bg-white/30 px-2 py-1 rounded-full">
                      AI generated
                    </span>
                  )}
                  <PlanTag label="Plus" locked={!entitlements.weeklyAiSummaries} />
                </div>
              </div>
              {showSkeleton || billingLoading ? (
                <div className="space-y-3">
                  <SkeletonCard className="h-6" />
                  <SkeletonCard className="h-6" />
                  <SkeletonCard className="h-6" />
                </div>
              ) : entitlements.weeklyAiSummaries ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="rounded-xl bg-white/60 border border-white px-3 py-2">
                      <p className="text-[11px] uppercase text-slate-600">Time spent</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {weeklySnapshot ? Math.round((weeklySnapshot.minutes / 60) * 10) / 10 : 0} hrs
                      </p>
                      <p className="text-[11px] text-slate-600">Across the family</p>
                    </div>
                    <div className="rounded-xl bg-white/60 border border-white px-3 py-2">
                      <p className="text-[11px] uppercase text-slate-600">Lessons completed</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {weeklySnapshot?.lessons ?? 0}
                      </p>
                      <p className="text-[11px] text-slate-600">This week</p>
                    </div>
                    <div className="rounded-xl bg-white/60 border border-white px-3 py-2">
                      <p className="text-[11px] uppercase text-slate-600">Best streak</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {weeklySnapshot?.topStreak ?? 0} days
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Avg mastery {weeklySnapshot?.averageMastery ?? '—'}%
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 mb-4">
                    {dashboard?.weeklyReport?.summary ??
                      'Adaptive summary not available yet—complete a few lessons to train the AI.'}
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-brand-violet mb-2">Highlights</h4>
                      <ul className="space-y-2">
                        {(dashboard?.weeklyReport?.highlights ?? ['Progress signals will appear here once we have a full week of data.']).map(
                          (highlight, index) => (
                            <li key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                              <span className="mt-0.5 text-brand-violet">•</span>
                              <span>{highlight}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-brand-blue mb-2">Recommended Next Steps</h4>
                      <ul className="space-y-2">
                        {(dashboard?.weeklyReport?.recommendations ?? [
                          'Set one small goal for each learner to guide the next digest.',
                        ]).map((recommendation, index) => (
                          <li key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                            <span className="mt-0.5 text-brand-blue">→</span>
                            <span>{recommendation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <LockedFeature
                  title="Weekly AI summaries are a Plus feature"
                  description="Upgrade to Family Plus to keep getting AI-generated highlights and renewal reminders."
                  onUpgrade={() => handleUpgrade(nextPlan?.slug ?? 'family-plus')}
                />
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  Mastery by Subject • {currentChild?.name ?? '—'}
                </h3>
                <PlanTag label="Plus" locked={!entitlements.advancedAnalytics} />
              </div>
              {showSkeleton || billingLoading ? (
                <div className="h-60">
                  <SkeletonCard className="h-full" />
                </div>
              ) : entitlements.advancedAnalytics ? (
                <>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={childMasteryData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEF2FF" />
                        <XAxis dataKey="subject" stroke="#6B7280" />
                        <YAxis stroke="#6B7280" />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', borderColor: '#E5E7EB' }}
                          labelStyle={{ color: '#1F2937', fontWeight: 600 }}
                        />
                        <Bar dataKey="mastery" fill="#971CB5" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {currentChild && (
                    <div className="mt-4 text-xs text-gray-500">
                      Average goal progress{' '}
                      {currentChild.goalProgress !== undefined && currentChild.goalProgress !== null
                        ? `${Math.round(currentChild.goalProgress)}%`
                        : '—'}{' '}
                      · Cohort delta{' '}
                      {currentChild.cohortComparison !== undefined && currentChild.cohortComparison !== null
                        ? `${currentChild.cohortComparison > 0 ? '+' : ''}${currentChild.cohortComparison}`
                        : '—'}
                      %
                    </div>
                  )}
                </>
              ) : (
                <LockedFeature
                  title="Advanced analytics are a Plus feature"
                  description="Upgrade to see mastery by subject, cohort comparisons, and deeper insights."
                  onUpgrade={() => handleUpgrade(nextPlan?.slug ?? 'family-plus')}
                />
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Home extension</h3>
                <span className="text-xs text-gray-500">
                  {currentChild?.name ?? 'Learner'}
                </span>
              </div>
              {showSkeleton ? (
                <div className="space-y-2">
                  <SkeletonCard className="h-20" />
                  <SkeletonCard className="h-20" />
                </div>
              ) : homeExtensions.length > 0 ? (
                <div className="space-y-3">
                  {homeExtensions.slice(0, 3).map((activity) => (
                    <div
                      key={activity.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="font-semibold text-brand-blue">
                          {describeActivityType(activity.activityType)}
                        </span>
                        {activity.estimatedMinutes ? (
                          <span>~{activity.estimatedMinutes} min</span>
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{activity.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                          Home extension
                        </span>
                        {activity.standards && activity.standards[0] && (
                          <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                            {activity.standards[0]}
                          </span>
                        )}
                      </div>
                      {activity.url && (
                        <a
                          href={activity.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-xs font-semibold text-brand-blue hover:underline mt-2"
                        >
                          Share activity ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  We&apos;ll suggest quick at-home activities as soon as this learner completes a bit more work.
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Focus Areas</h3>
              <div className="space-y-3">
                {showSkeleton ? (
                  <>
                    <SkeletonCard className="h-14" />
                    <SkeletonCard className="h-14" />
                  </>
                ) : (
                  (currentChild?.focusAreas ?? []).map((area, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{area}</p>
                        <p className="text-xs text-gray-500">
                          AI recommends a practice set or concept review this week.
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {(currentChild?.focusAreas?.length ?? 0) === 0 && !showSkeleton && (
                  <p className="text-sm text-gray-600">
                    No focus flags this week—keep reinforcing the strengths!
                  </p>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Alert Center</h3>
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <div className="space-y-4">
                {showSkeleton ? (
                  <>
                    <SkeletonCard className="h-16" />
                    <SkeletonCard className="h-16" />
                  </>
                ) : (
                  (dashboard?.alerts ?? []).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border ${
                        alert.type === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : alert.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-blue-50 border-blue-200 text-blue-700'
                      }`}
                    >
                      <p className="text-sm font-semibold">{alert.message}</p>
                      <p className="text-xs mt-1 opacity-80">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
                {(dashboard?.alerts?.length ?? 0) === 0 && !showSkeleton && (
                  <p className="text-sm text-gray-600">
                    No alerts right now. We’ll notify you when the AI spots something important.
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;
