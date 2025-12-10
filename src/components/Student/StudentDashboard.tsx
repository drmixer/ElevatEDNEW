import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  Clock,
  Flag,
  Map,
  ArrowRight,
  Play,
  RefreshCw,
  Sparkles,
  Gift,
  Palette,
  Crown,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Bot,
  Flame,
  Info,
  Copy,
  X,
  Mail,
  Send,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useEntitlements } from '../../contexts/EntitlementsContext';
import type {
  AvatarOption,
  BadgeCategory,
  DashboardLesson,
  LearningPathItem,
  LearningPreferences,
  Mission,
  Student,
  StudentReflection,
  Subject,
  CelebrationMoment,
  ParentCheckIn,
} from '../../types';
const OnboardingFlow = lazy(() => import('./OnboardingFlow'));
const LearningAssistant = lazy(() => import('./LearningAssistant'));
import { fetchStudentDashboardData } from '../../services/dashboardService';
import type { StudentStats } from '../../services/statsService';
import trackEvent from '../../lib/analytics';
import { formatSubjectLabel, SUBJECTS } from '../../lib/subjects';
import { studySkillsModules } from '../../data/studySkillsModules';
import { saveTutorPersona } from '../../services/avatarService';
import { updateLearningPreferences } from '../../services/profileService';
import { tutorNameErrorMessage, validateTutorName } from '../../../shared/nameSafety';
import { fetchReflections, saveReflection, toggleReflectionShare } from '../../services/reflectionService';
import {
  fetchPreferences,
  listAvatars as listCatalogAvatars,
  listTutorPersonas,
  updatePreferences as updateStudentPreferences,
} from '../../services/onboardingService';
import type {
  CatalogAvatar,
  StudentPathEntry,
  TutorPersona as CatalogTutorPersona,
} from '../../services/onboardingService';
import { describePathEntryReason, humanizeStandard } from '../../lib/pathReason';
import {
  consumeAdaptiveFlash,
  studentPathQueryKey,
  studentDashboardQueryKey,
  studentStatsQueryKey,
  useStudentPath,
  useStudentStats,
  type AdaptiveFlash,
} from '../../hooks/useStudentData';
import { fetchFamilyLinkCode, rotateFamilyLinkCode } from '../../services/familyService';
import {
  acknowledgeCheckIn,
  describeCheckInStatus,
  listStudentCheckIns,
  markCheckInsDelivered,
} from '../../services/checkInService';

const PATH_STATUS_RANK: Record<LearningPathItem['status'], number> = {
  in_progress: 0,
  not_started: 1,
  completed: 2,
  mastered: 3,
};

const PATH_STATUS_LABELS: Record<LearningPathItem['status'], string> = {
  not_started: 'Ready',
  in_progress: 'In progress',
  completed: 'Completed',
  mastered: 'Mastered',
};

const PATH_STATUS_STYLES: Record<LearningPathItem['status'], string> = {
  not_started: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  mastered: 'bg-purple-50 text-purple-700',
};

const CHECK_IN_BADGES: Record<ParentCheckIn['status'], string> = {
  sent: 'bg-amber-50 text-amber-700 border-amber-200',
  delivered: 'bg-blue-50 text-blue-700 border-blue-200',
  seen: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

type MicroTaskStatus = 'pending' | 'done' | 'skipped';

type MicroTask = {
  id: string;
  label: string;
  helper: string;
  minutes: number;
  type: 'new' | 'review' | 'spaced';
  subject?: Subject;
  lessonId?: string | null;
  hint?: string;
};

type StudentNudge = {
  id: string;
  type: 'recap' | 'quick_check' | 'try_again';
  title: string;
  body: string;
  targetUrl: string | null;
  detail?: string | null;
};

const pathEntryReasonSlug = (entry: StudentPathEntry): string => {
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.reason === 'string') return meta.reason.toLowerCase();
  if (entry.type === 'lesson' && meta.source === 'placement') return 'placement';
  return entry.type;
};

const formatAgo = (input: Date | string): string => {
  const date = input instanceof Date ? input : new Date(input);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

const describeTutorTone = (tone?: string | null): string => {
  switch (tone) {
    case 'calm':
      return 'Calm coach';
    case 'structured':
      return 'Step-by-step';
    case 'bold':
      return 'Hype';
    case 'concise':
      return 'Quiet expert';
    default:
      return 'Supportive';
  }
};

const defaultPalette = { background: '#EEF2FF', accent: '#6366F1', text: '#1F2937' };

const parsePalette = (metadata?: Record<string, unknown> | null) => {
  const palette = (metadata?.palette as { background?: string; accent?: string; text?: string } | undefined) ?? undefined;
  return {
    background: palette?.background ?? defaultPalette.background,
    accent: palette?.accent ?? defaultPalette.accent,
    text: palette?.text ?? defaultPalette.text,
  };
};

const toAvatarOption = (avatar: CatalogAvatar): AvatarOption => {
  const metadata = (avatar.metadata ?? {}) as Record<string, unknown>;
  const tags = Array.isArray(metadata.tags)
    ? metadata.tags.filter((tag): tag is string => typeof tag === 'string')
    : undefined;
  const rarity = typeof metadata.rarity === 'string' ? (metadata.rarity as AvatarOption['rarity']) : undefined;
  const minXp =
    typeof metadata.minXp === 'number'
      ? (metadata.minXp as number)
      : typeof metadata.minXp === 'string'
        ? Number.parseInt(metadata.minXp as string, 10)
        : undefined;
  const requiredStreak =
    typeof metadata.requiredStreak === 'number'
      ? (metadata.requiredStreak as number)
      : typeof metadata.requiredStreak === 'string'
        ? Number.parseInt(metadata.requiredStreak as string, 10)
        : undefined;
  const description =
    typeof metadata.description === 'string' && metadata.description.trim().length
      ? metadata.description
      : avatar.category === 'tutor'
        ? 'Tutor look'
        : 'Starter look';

  return {
    id: avatar.id,
    label: avatar.name,
    description,
    minXp: Number.isFinite(minXp) ? (minXp as number) : undefined,
    requiredStreak: Number.isFinite(requiredStreak) ? (requiredStreak as number) : undefined,
    palette: parsePalette(metadata),
    icon: typeof metadata.icon === 'string' ? metadata.icon : '⭐️',
    rarity,
    kind: avatar.category === 'tutor' ? 'tutor' : 'student',
    tags,
    tone: typeof metadata.tone === 'string' ? (metadata.tone as AvatarOption['tone']) : undefined,
  };
};

const pickDiagnosticFocus = (metadata: Record<string, unknown> | null | undefined, upNext: StudentPathEntry[]): string | null => {
  const strandEstimatesRaw = Array.isArray(metadata?.strand_estimates) ? metadata?.strand_estimates : [];
  const strandEstimates = strandEstimatesRaw
    .map((entry) => ({
      strand: (entry as Record<string, unknown>).strand as string | undefined,
      accuracy:
        typeof (entry as Record<string, unknown>).accuracyPct === 'number'
          ? ((entry as Record<string, unknown>).accuracyPct as number)
          : typeof (entry as Record<string, unknown>).accuracy_pct === 'number'
            ? ((entry as Record<string, unknown>).accuracy_pct as number)
            : null,
    }))
    .filter((entry) => entry.strand && entry.accuracy != null) as Array<{ strand: string; accuracy: number }>;
  const weakest = strandEstimates.sort((a, b) => a.accuracy - b.accuracy)[0];
  if (weakest?.strand) {
    return humanizeStandard(weakest.strand);
  }
  const goalFocus = typeof metadata?.goal_focus === 'string' ? metadata.goal_focus : null;
  if (goalFocus) return humanizeStandard(goalFocus);
  const nextStandard = upNext[0]?.target_standard_codes?.[0];
  if (nextStandard) return humanizeStandard(nextStandard);
  return null;
};

const StudentDashboard: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const student = (user as Student) ?? null;
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const [activeView, setActiveView] = useState<'dashboard' | 'onboarding' | 'lesson'>('dashboard');
  const [activeTab, setActiveTab] = useState<'today' | 'journey'>('today');
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'all'>('all');
  const [missionCadence, setMissionCadence] = useState<'daily' | 'weekly'>('daily');
  const [achievementFilter, setAchievementFilter] = useState<BadgeCategory | 'all'>('all');
  const [equippedAvatarId, setEquippedAvatarId] = useState<string>('avatar-starter');
  const [todayLaneState, setTodayLaneState] = useState<Record<string, 'done' | 'skipped'>>({});
  const [microPlanState, setMicroPlanState] = useState<Record<string, MicroTaskStatus>>({});
  const [microPlanHistory, setMicroPlanHistory] = useState<Array<{ date: string; completed: boolean }>>([]);
  const writingPrompt =
    'Write 3-4 sentences about a time you solved a problem by trying a new strategy. Explain the steps and what changed.';
  const [writingResponse, setWritingResponse] = useState('');
  const [writingFeedback, setWritingFeedback] = useState<string | null>(null);
  const [avatarFeedback, setAvatarFeedback] = useState<string | null>(null);
  const readingSet = {
    passage:
      'Jalen noticed the school garden was wilting in the heat, so he organized a rotating schedule where each friend watered the plants before class. Within a week, the garden looked stronger, and teachers thanked the group for their teamwork.',
    question: 'What was Jalen’s main goal when he created the watering schedule?',
    options: [
      'To avoid doing any work himself',
      'To prove he could be a leader',
      'To keep the garden healthy by sharing the task',
      'To convince teachers to cancel morning classes',
    ],
    answer: 2,
  };
  const [readingAnswer, setReadingAnswer] = useState<number | null>(null);
  const [readingFeedback, setReadingFeedback] = useState<string | null>(null);
  const [autoRoutedDiagnostic, setAutoRoutedDiagnostic] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarCatalog, setAvatarCatalog] = useState<CatalogAvatar[]>([]);
  const [tutorPersonas, setTutorPersonas] = useState<CatalogTutorPersona[]>([]);
  const [tutorPersonaId, setTutorPersonaId] = useState<string | null>(null);
  const [personalizationLoading, setPersonalizationLoading] = useState(false);
  const [personalizationError, setPersonalizationError] = useState<string | null>(null);
  const [tutorNameInput, setTutorNameInput] = useState<string>(student?.tutorName ?? '');
  const [tutorFeedback, setTutorFeedback] = useState<string | null>(null);
  const [tutorSaving, setTutorSaving] = useState(false);
  const [tutorFlowStartedAt, setTutorFlowStartedAt] = useState<number | null>(null);
  const [tutorFlowLogged, setTutorFlowLogged] = useState<boolean>(false);
  const [weeklyPlanIntensity, setWeeklyPlanIntensity] = useState<'light' | 'normal' | 'challenge'>(
    student?.learningPreferences?.weeklyPlanIntensity ?? 'normal',
  );
  const [weeklyPlanFocus, setWeeklyPlanFocus] = useState<Subject | 'balanced'>(
    (student?.learningPreferences?.weeklyPlanFocus as Subject | 'balanced') ??
      student?.learningPreferences?.focusSubject ??
      'balanced',
  );
  const [weeklyIntent, setWeeklyIntent] = useState<'precision' | 'speed' | 'stretch' | 'balanced'>(
    student?.learningPreferences?.weeklyIntent ?? 'balanced',
  );
  const [studyMode, setStudyMode] = useState<'catch_up' | 'keep_up' | 'get_ahead'>(
    student?.learningPreferences?.studyMode ?? 'keep_up',
  );
  const studyModeLocked = student.learningPreferences.studyModeLocked ?? false;
  const [weeklyPlanStatusTracked, setWeeklyPlanStatusTracked] = useState(false);
  const [celebrationQueue, setCelebrationQueue] = useState<CelebrationMoment[]>([]);
  const [celebrationShownIds, setCelebrationShownIds] = useState<Set<string>>(new Set());
  const [reflections, setReflections] = useState<StudentReflection[]>([]);
  const [reflectionModalOpen, setReflectionModalOpen] = useState(false);
  const [reflectionQuestion, setReflectionQuestion] = useState<string>('what_learned');
  const [reflectionText, setReflectionText] = useState<string>('');
  const [reflectionShare, setReflectionShare] = useState<boolean>(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [reflectionSaving, setReflectionSaving] = useState(false);
  const [studyModePromptLogged, setStudyModePromptLogged] = useState(false);
  const [studyModeBannerLogged, setStudyModeBannerLogged] = useState(false);
  const [reflectionTimerStarted, setReflectionTimerStarted] = useState(false);
  const [adaptiveFlash, setAdaptiveFlash] = useState<AdaptiveFlash | null>(null);
  const [planBannerDismissed, setPlanBannerDismissed] = useState(false);
  const [lessonSummaryDismissed, setLessonSummaryDismissed] = useState(false);
  const [upNextUpdatedAt, setUpNextUpdatedAt] = useState<number | null>(null);
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(new Set());
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [acknowledgingCheckIn, setAcknowledgingCheckIn] = useState<string | null>(null);
  const upNextChangeTracked = useRef<boolean>(false);
  const lastUpNextEventSignature = useRef<string | null>(null);
  const lastAdaptiveFlashTracked = useRef<number | null>(null);
  const adaptiveRefreshRef = useRef<number | null>(null);
  const lastNudgeTracked = useRef<string | null>(null);
  const [familyCodeMessage, setFamilyCodeMessage] = useState<string | null>(null);
  const [familyCodeError, setFamilyCodeError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const {
    upNext: upNextEntries,
    isLoading: pathIsLoading,
    isFetching: pathIsFetching,
    refresh: refreshStudentPath,
    path: studentPath,
  } = useStudentPath(student?.id);
  const pathLoading = pathIsLoading || pathIsFetching;

  const {
    data: dashboard,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['student-dashboard', student?.id],
    queryFn: () => fetchStudentDashboardData({ ...(student as Student) }),
    enabled: Boolean(student),
    staleTime: 1000 * 60 * 2,
  });

  const {
    data: studentStatsData,
    isFetching: statsFetching,
  } = useStudentStats(student?.id);

  const [todayKey, setTodayKey] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const interval = setInterval(() => {
      const next = new Date().toISOString().slice(0, 10);
      setTodayKey((current) => (current === next ? current : next));
    }, 1000 * 60 * 10);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setTodayKey(new Date().toISOString().slice(0, 10));
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) return;
    try {
      const raw = localStorage.getItem(`student-nudges-dismissed-${student.id}`);
      if (raw) {
        setDismissedNudges(new Set(JSON.parse(raw) as string[]));
      }
    } catch (error) {
      console.warn('[StudentDashboard] Failed to load dismissed nudges', error);
    }
  }, [student?.id]);

  const familyCodeQuery = useQuery({
    queryKey: ['family-link-code', student?.id],
    queryFn: fetchFamilyLinkCode,
    enabled: Boolean(student),
    staleTime: 5 * 60 * 1000,
  });

  const familyLinkCode = familyCodeQuery.data?.code ?? student?.familyLinkCode ?? null;

  const {
    data: checkIns,
    isFetching: _checkInsFetching,
  } = useQuery({
    queryKey: ['student-checkins', student?.id],
    queryFn: () => listStudentCheckIns(student!.id, 8),
    enabled: Boolean(student?.id),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!student?.id || !checkIns?.length) return;
    const undeliveredIds = checkIns.filter((entry) => entry.status === 'sent').map((entry) => entry.id);
    if (!undeliveredIds.length) return;
    markCheckInsDelivered(undeliveredIds)
      .then(() => queryClient.invalidateQueries({ queryKey: ['student-checkins', student.id] }).catch(() => undefined))
      .catch((error) => console.warn('[StudentDashboard] Failed to mark check-ins delivered', error));
  }, [checkIns, queryClient, student?.id]);

  const rotateFamilyCodeMutation = useMutation({
    mutationFn: rotateFamilyLinkCode,
    onSuccess: (payload) => {
      queryClient.setQueryData(['family-link-code', student?.id], payload);
      setFamilyCodeMessage('New Family Link code generated.');
      setFamilyCodeError(null);
      trackEvent('student_family_code_rotated', { studentId: student?.id });
    },
    onError: (err) => {
      setFamilyCodeError(err instanceof Error ? err.message : 'Unable to refresh the code right now.');
      setFamilyCodeMessage(null);
    },
  });

  const hasGuardianLink = useMemo(() => {
    if (familyCodeQuery.data?.linked) return true;
    if (student?.parentId && student.parentId !== student.id) return true;
    return false;
  }, [familyCodeQuery.data?.linked, student?.id, student?.parentId]);

  const missingGuardian = !hasGuardianLink;

  const studentStats = useMemo(() => {
    if (studentStatsData) return studentStatsData;
    return {
      xpTotal: student?.xp ?? 0,
      streakDays: student?.streakDays ?? 0,
      badges: student?.badges?.length ?? 0,
      badgeDetails: student?.badges ?? [],
      recentEvents: [],
      masteryAvg: null,
      pathProgress: { completed: 0, remaining: 0, percent: null },
      avgAccuracy: null,
      weeklyTimeMinutes: 0,
      modulesMastered: { count: 0, items: [] },
      focusStandards: [],
      latestQuizScore: null,
      struggle: false,
    } satisfies StudentStats;
  }, [student?.badges, student?.streakDays, student?.xp, studentStatsData]);

  const handleCopyFamilyCode = async () => {
    if (!familyLinkCode || typeof navigator === 'undefined' || !navigator.clipboard) {
      setFamilyCodeError('Copy is unavailable in this browser. Share the code manually.');
      setFamilyCodeMessage(null);
      return;
    }
    try {
      await navigator.clipboard.writeText(familyLinkCode);
      setFamilyCodeMessage('Code copied to your clipboard.');
      setFamilyCodeError(null);
      trackEvent('student_family_code_copied', { studentId: student?.id });
    } catch (copyError) {
      console.error('[Student] Failed to copy family code', copyError);
      setFamilyCodeError('Unable to copy the code right now.');
      setFamilyCodeMessage(null);
    }
  };

  const pathMetadata = useMemo(
    () => ((studentPath?.metadata ?? {}) as Record<string, unknown> | null | undefined),
    [studentPath?.metadata],
  );

  const pathFocus = useMemo(
    () => pickDiagnosticFocus(pathMetadata, upNextEntries),
    [pathMetadata, upNextEntries],
  );

  const upNextSignature = useMemo(
    () => upNextEntries.map((entry) => `${entry.id}:${entry.status}:${entry.position ?? ''}`).join('|'),
    [upNextEntries],
  );

  const upNextRecentlyUpdated = useMemo(
    () => (upNextUpdatedAt ? Date.now() - upNextUpdatedAt < 8000 : false),
    [upNextUpdatedAt],
  );

  useEffect(() => {
    if (!upNextSignature) return;
    if (!upNextChangeTracked.current) {
      upNextChangeTracked.current = true;
      return;
    }
    setUpNextUpdatedAt(Date.now());
    const timeout = setTimeout(() => setUpNextUpdatedAt(null), 8000);
    return () => clearTimeout(timeout);
  }, [upNextSignature]);

  useEffect(() => {
    if (!upNextRecentlyUpdated || !upNextEntries.length) return;
    if (lastUpNextEventSignature.current === upNextSignature) return;
    lastUpNextEventSignature.current = upNextSignature;
    const reason = pathEntryReasonSlug(upNextEntries[0]);
    trackEvent('upnext_updated', {
      reason,
      entry_id: upNextEntries[0].id,
    });
  }, [upNextEntries, upNextRecentlyUpdated, upNextSignature]);

  const upNextSubtitle = useMemo(() => {
    if (pathFocus) {
      return `Built from your diagnostic results - starting with ${pathFocus} to strengthen that area.`;
    }
    return 'Built from your diagnostic - start with the first card below.';
  }, [pathFocus]);

  const adaptiveFocusLabel = useMemo(() => {
    const flashStandard =
      humanizeStandard(adaptiveFlash?.primaryStandard ?? null) ??
      humanizeStandard(adaptiveFlash?.misconceptions?.[0] ?? null);
    if (flashStandard) return flashStandard;
    const upNextStandard = humanizeStandard(upNextEntries[0]?.target_standard_codes?.[0] ?? null);
    return pathFocus ?? upNextStandard;
  }, [adaptiveFlash?.misconceptions, adaptiveFlash?.primaryStandard, pathFocus, upNextEntries]);

  const adaptiveBannerCopy = useMemo(() => {
    if (!adaptiveFlash) return null;
    const reason = (adaptiveFlash.nextReason ?? '').toLowerCase();
    const difficulty = adaptiveFlash.targetDifficulty ?? null;
    const focusLabel = adaptiveFocusLabel ?? 'your latest work';
    const misLabels = (adaptiveFlash.misconceptions ?? [])
      .map((code) => humanizeStandard(code))
      .filter(Boolean) as string[];
    const focusPhrase = misLabels.length ? misLabels.slice(0, 2).join(', ') : focusLabel;
    if (reason === 'remediation' || (adaptiveFlash.misconceptions?.length ?? 0) > 0) {
      return {
        title: 'Plan updated for review',
        body: `We added a short review on ${focusPhrase} to help you solidify that concept.`,
      };
    }
    if (reason === 'stretch' || (difficulty ?? 0) >= 4) {
      return {
        title: 'Plan updated for stretch',
        body: `Nice work! We nudged your practice to a slightly harder level around ${focusPhrase}.`,
      };
    }
    if (difficulty && difficulty <= 2) {
      return {
        title: 'Plan tuned for comfort',
        body: `We're keeping practice gentle while you build confidence on ${focusPhrase}.`,
      };
    }
    return {
      title: 'Plan refreshed',
      body: `Your path just updated based on your latest progress.`,
    };
  }, [adaptiveFlash, adaptiveFocusLabel]);

  const lessonSummary = useMemo(() => {
    if (!adaptiveFlash || adaptiveFlash.eventType !== 'lesson_completed') return null;
    const practiced = adaptiveFocusLabel ?? "today's lesson";
    const nextReason = (adaptiveFlash.nextReason ?? '').toLowerCase();
    const nextStep =
      nextReason === 'remediation'
        ? `Next step: quick review on ${adaptiveFocusLabel ?? 'recent skills'}.`
        : nextReason === 'stretch'
          ? `Next step: stretch practice on ${adaptiveFocusLabel ?? 'the next skill'}.`
          : adaptiveFlash.nextTitle
            ? `Next step: ${adaptiveFlash.nextTitle}.`
            : 'Next step: keep the streak going tomorrow.';
    return { practiced, nextStep };
  }, [adaptiveFlash, adaptiveFocusLabel]);

  const showSkeleton = isLoading && !dashboard;

  useEffect(() => {
    if (!student?.id) return;
    const flash = consumeAdaptiveFlash(student.id);
    if (flash) {
      setAdaptiveFlash(flash);
      setPlanBannerDismissed(false);
      setLessonSummaryDismissed(false);
    }
  }, [student?.id]);

  useEffect(() => {
    if (!adaptiveFlash) return;
    if (lastAdaptiveFlashTracked.current === adaptiveFlash.createdAt) return;
    lastAdaptiveFlashTracked.current = adaptiveFlash.createdAt ?? Date.now();
    trackEvent('adaptive_banner_ready', {
      event_type: adaptiveFlash.eventType,
      next_reason: adaptiveFlash.nextReason ?? null,
      target_difficulty: adaptiveFlash.targetDifficulty ?? null,
    });
  }, [adaptiveFlash]);

  useEffect(() => {
    if (!adaptiveFlash || !student?.id) return;
    const signature = adaptiveFlash.createdAt ?? Date.now();
    if (adaptiveRefreshRef.current === signature) return;
    adaptiveRefreshRef.current = signature;
    void refreshStudentPath().catch(() => undefined);
    void refetch({ throwOnError: false });
    void queryClient.invalidateQueries({ queryKey: studentDashboardQueryKey(student.id) }).catch(() => undefined);
  }, [adaptiveFlash, queryClient, refetch, refreshStudentPath, student?.id]);

  useEffect(() => {
    if (!student) return;
    if (dashboard?.equippedAvatarId || student.studentAvatarId || student.avatar) {
      setEquippedAvatarId(
        dashboard?.equippedAvatarId ?? student.studentAvatarId ?? student.avatar ?? 'avatar-starter',
      );
    }
  }, [dashboard?.equippedAvatarId, student]);

  useEffect(() => {
    if (!student) return;
    setPersonalizationLoading(true);
    setPersonalizationError(null);
    Promise.all([fetchPreferences(), listCatalogAvatars('student'), listTutorPersonas()])
      .then(([prefs, avatars, personas]) => {
        setAvatarCatalog(avatars);
        setTutorPersonas(personas);
        const resolvedPersonaId = prefs.tutor_persona_id ?? personas[0]?.id ?? null;
        setTutorPersonaId(resolvedPersonaId);
        if (prefs.avatar_id) {
          setEquippedAvatarId(prefs.avatar_id);
        }
      })
      .catch((err) => {
        console.warn('[StudentDashboard] Unable to load personalization catalogs', err);
        setPersonalizationError('Unable to load avatar and persona options right now.');
      })
      .finally(() => setPersonalizationLoading(false));
  }, [student]);

  useEffect(() => {
    if (!student) return;
    setTutorNameInput(student.tutorName ?? '');
    setWeeklyPlanIntensity(student.learningPreferences.weeklyPlanIntensity ?? 'normal');
    setWeeklyPlanFocus(
      (student.learningPreferences.weeklyPlanFocus as Subject | 'balanced') ??
        student.learningPreferences.focusSubject ??
        'balanced',
    );
    setWeeklyIntent(student.learningPreferences.weeklyIntent ?? 'balanced');
    setStudyMode(student.learningPreferences.studyMode ?? 'keep_up');
  }, [student]);

  useEffect(() => {
    if (!student || tutorFlowLogged || personalizationLoading) return;
    const personaForMetrics = tutorPersonaId ?? tutorPersonas[0]?.id ?? 'persona-calm-coach';
    setTutorFlowLogged(true);
    const startedAt = Date.now();
    setTutorFlowStartedAt(startedAt);
    trackEvent('tutor_onboarding_started', {
      source: 'dashboard',
      grade_band: gradeBand,
      locale: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
    });
    trackEvent('tutor_onboarding_step_completed', {
      step: 'intro',
      persona_id: personaForMetrics,
      avatar_id: personaForMetrics,
      provided_name: Boolean(student.tutorName?.trim()),
    });
  }, [gradeBand, student, tutorFlowLogged, personalizationLoading, tutorPersonaId, tutorPersonas]);

  useEffect(() => {
    if (!student) return;
    fetchReflections(10)
      .then((rows) => setReflections(rows))
      .catch((err) => console.warn('[Reflections] Unable to load', err));
  }, [student, student?.id]);

  useEffect(() => {
    if (!student) return;
    if (studyModeExpired) {
      trackEvent('study_mode_expired', { mode: studyMode, grade_band: gradeBand });
    }
  }, [gradeBand, studyMode, studyModeExpired, student]);

  useEffect(() => {
    if (!student) return;
    const needsPrompt = studyModeExpired || !studyModeSetAt;
    if (needsPrompt && !studyModePromptLogged) {
      trackEvent('study_mode_prompt_shown', {
        surface: 'dashboard',
        reason: studyModeExpired ? 'expired' : 'first_time',
        grade_band: gradeBand,
      });
      setStudyModePromptLogged(true);
    }
  }, [gradeBand, studyModeExpired, studyModePromptLogged, studyModeSetAt, student]);

  useEffect(() => {
    if (!student || studyModeBannerLogged) return;
    trackEvent('study_mode_banner_viewed', { mode: studyMode, surface: 'dashboard', parent_locked: parentGoalActive });
    setStudyModeBannerLogged(true);
  }, [parentGoalActive, studyMode, studyModeBannerLogged, student]);

  useEffect(() => {
    if (!student || !dashboard || weeklyPlanStatusTracked) return;
    trackEvent('weekly_plan_viewed', {
      source: 'dashboard',
      grade_band: gradeBand,
      parent_goal: parentGoalActive,
    });
    trackEvent('weekly_plan_status', {
      lessons_target: weeklyPlanTargets.lessons,
      lessons_done: lessonsThisWeek,
      minutes_target: weeklyPlanTargets.minutes,
      minutes_done: minutesThisWeek,
      status: weeklyPlanStatus,
      parent_goal: parentGoalActive,
    });
    setWeeklyPlanStatusTracked(true);
  }, [
    dashboard,
    gradeBand,
    lessonsThisWeek,
    minutesThisWeek,
    parentGoalActive,
    student,
    weeklyPlanStatus,
    weeklyPlanStatusTracked,
    weeklyPlanTargets.lessons,
    weeklyPlanTargets.minutes,
  ]);

  useEffect(() => {
    if (parentGoalActive && student?.learningPreferences?.focusSubject) {
      setWeeklyPlanFocus(student.learningPreferences.focusSubject as Subject | 'balanced');
    }
    if (parentGoalActive) {
      setWeeklyPlanIntensity('normal');
    }
  }, [parentGoalActive, student?.learningPreferences?.focusSubject]);

  const openReflectionModal = useCallback(
    (questionId?: string, reason?: string) => {
      setReflectionQuestion(questionId ?? 'what_learned');
      setReflectionText('');
      setReflectionError(null);
      setReflectionShare(false);
      setReflectionModalOpen(true);
      trackEvent('reflection_prompt_shown', {
        reason: reason ?? 'manual',
        lesson_id: dashboard?.activeLessonId,
        subject: dashboard?.todayActivities?.[0]?.subject ?? null,
      });
    },
    [dashboard?.activeLessonId, dashboard?.todayActivities],
  );

  useEffect(() => {
    if (!student || reflectionTimerStarted) return;
    const timer = setTimeout(() => {
      if (!reflectionModalOpen) {
        openReflectionModal('what_learned', 'long_session');
      }
    }, 20 * 60 * 1000);
    setReflectionTimerStarted(true);
    return () => clearTimeout(timer);
  }, [openReflectionModal, reflectionModalOpen, reflectionTimerStarted, student]);

  useEffect(() => {
    const handleReflectionPrompt = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string; questionId?: string }>).detail ?? {};
      openReflectionModal(detail.questionId, detail.reason);
    };
    window.addEventListener('reflection:prompt', handleReflectionPrompt as EventListener);
    return () => window.removeEventListener('reflection:prompt', handleReflectionPrompt as EventListener);
  }, [openReflectionModal]);

  useEffect(() => {
    if (autoRoutedDiagnostic || !student) return;
    if (!dashboard?.quickStats.assessmentCompleted && !showSkeleton) {
      setActiveView('onboarding');
      setAutoRoutedDiagnostic(true);
    }
  }, [autoRoutedDiagnostic, dashboard?.quickStats.assessmentCompleted, showSkeleton, student]);

  const activityChartData = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.dailyActivity.map((entry) => ({
      label: new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short' }),
      lessons: entry.lessonsCompleted,
      minutes: entry.practiceMinutes,
      xp: entry.xpEarned,
    }));
  }, [dashboard]);

  const masteryDisplay = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.subjectMastery.map((item) => ({
      ...item,
      label: formatSubjectLabel(item.subject),
    }));
  }, [dashboard]);

  const lessonsThisWeek = useMemo(() => {
    if (!dashboard?.dailyActivity) return 0;
    return dashboard.dailyActivity.reduce((acc, entry) => acc + (entry.lessonsCompleted ?? 0), 0);
  }, [dashboard?.dailyActivity]);

  const minutesThisWeek = useMemo(() => {
    if (!dashboard?.dailyActivity) return 0;
    return dashboard.dailyActivity.reduce((acc, entry) => acc + (entry.practiceMinutes ?? 0), 0);
  }, [dashboard?.dailyActivity]);

  const learningPath: LearningPathItem[] = useMemo(() => {
    if (dashboard?.profile?.learningPath?.length) return dashboard.profile.learningPath;
    if (student?.learningPath?.length) return student.learningPath;
    return [];
  }, [dashboard?.profile?.learningPath, student?.learningPath]);

  const journeyGroups = useMemo(() => {
    const buckets = new Map<Subject, LearningPathItem[]>();
    learningPath.forEach((item) => {
      const list = buckets.get(item.subject) ?? [];
      list.push(item);
      buckets.set(item.subject, list);
      });

    return Array.from(buckets.entries()).map(([subject, items]) => ({
      subject,
      label: formatSubjectLabel(subject),
      items: items.slice().sort((a, b) => PATH_STATUS_RANK[a.status] - PATH_STATUS_RANK[b.status]),
    }));
  }, [learningPath]);

  const journeyPeekAhead = useMemo(
    () =>
      learningPath
        .filter((item) => item.status !== 'completed' && item.status !== 'mastered')
        .sort((a, b) => PATH_STATUS_RANK[a.status] - PATH_STATUS_RANK[b.status])
        .slice(0, 4),
    [learningPath],
  );

  const badges = useMemo(() => {
    const fallbackBadges = student?.badges ?? [];
    const pool =
      dashboard?.profile?.badges?.length && dashboard.profile.badges.length > 0
        ? dashboard.profile.badges
        : dashboard?.recentBadges?.length
        ? dashboard.recentBadges
        : fallbackBadges;
    return pool.slice().sort((a, b) => {
      const aTime = a.earnedAt instanceof Date ? a.earnedAt.getTime() : new Date(a.earnedAt).getTime();
      const bTime = b.earnedAt instanceof Date ? b.earnedAt.getTime() : new Date(b.earnedAt).getTime();
      return bTime - aTime;
    });
  }, [dashboard?.profile?.badges, dashboard?.recentBadges, student?.badges]);

  const filteredBadges = useMemo(() => {
    if (achievementFilter === 'all') return badges;
    return badges.filter((badge) => (badge.category ?? 'general') === achievementFilter);
  }, [achievementFilter, badges]);

  const badgeCategories = useMemo(
    () => Array.from(new Set<BadgeCategory | 'general'>(badges.map((badge) => badge.category ?? 'general'))),
    [badges],
  );

  const studentAvatarOptions = useMemo(
    () => avatarCatalog.filter((avatar) => avatar.category === 'student').map(toAvatarOption),
    [avatarCatalog],
  );

  const selectedTutorPersona = useMemo(
    () => tutorPersonas.find((persona) => persona.id === tutorPersonaId) ?? null,
    [tutorPersonas, tutorPersonaId],
  );

  const missions = dashboard?.missions ?? [];
  const visibleMissions = missions.filter((mission) => mission.cadence === missionCadence);
  const activeMission = visibleMissions[0] ?? missions[0] ?? null;

  const missionProgress = (mission: Mission) => {
    const total = mission.tasks.reduce((acc, task) => acc + task.target, 0);
    const current = mission.tasks.reduce(
      (acc, task) => acc + Math.min(task.progress, task.target),
      0,
    );
    if (total === 0) return 0;
    return Math.min(Math.round((current / total) * 100), 120);
  };

  const isAvatarUnlocked = (option: AvatarOption) => {
    const xp = dashboard?.profile?.xp ?? student?.xp ?? 0;
    const streak = dashboard?.profile?.streakDays ?? student?.streakDays ?? 0;
    const meetsXp = option.minXp ? xp >= option.minXp : true;
    const meetsStreak = option.requiredStreak ? streak >= option.requiredStreak : true;
    return meetsXp && meetsStreak;
  };

  const gradeBand = useMemo(() => {
    if (!student?.grade) return 'unknown';
    if (student.grade <= 5) return 'g3-5';
    if (student.grade <= 8) return 'g6-8';
    return 'g9-plus';
  }, [student?.grade]);

  const tutorNameValidation = useMemo(() => {
    const trimmed = tutorNameInput.trim();
    if (!trimmed.length) {
      return { ok: true as const, value: '', normalized: '' };
    }
    return validateTutorName(trimmed);
  }, [tutorNameInput]);

  const tutorNameError =
    tutorNameInput.trim().length === 0 || tutorNameValidation.ok
      ? null
      : tutorNameErrorMessage(tutorNameValidation);

  const selectedPersonaPalette = selectedTutorPersona
    ? parsePalette((selectedTutorPersona.metadata ?? {}) as Record<string, unknown>)
    : defaultPalette;
  const selectedPersonaIcon =
    typeof ((selectedTutorPersona?.metadata ?? {}) as Record<string, unknown>).icon === 'string'
      ? (((selectedTutorPersona?.metadata ?? {}) as Record<string, unknown>).icon as string)
      : '🤝';
  const selectedPersonaAvatarId =
    typeof ((selectedTutorPersona?.metadata ?? {}) as Record<string, unknown>).avatar_id === 'string'
      ? (((selectedTutorPersona?.metadata ?? {}) as Record<string, unknown>).avatar_id as string)
      : null;
  const personaPreviewLine =
    selectedTutorPersona?.sample_replies?.[0] ??
    selectedTutorPersona?.prompt_snippet ??
    selectedTutorPersona?.constraints ??
    'Your tutor will keep responses short, safe, and on-topic.';

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

  const celebrationMoments = useMemo(() => dashboard?.celebrationMoments ?? [], [dashboard?.celebrationMoments]);
  const parentGoals = dashboard?.parentGoals ?? null;
  const parentGoalActive = Boolean(parentGoals?.weeklyLessons || parentGoals?.practiceMinutes);
  const activeCelebration = celebrationQueue[0] ?? null;
  const quickStats = dashboard?.quickStats;
  const studyModeSetAt = useMemo(
    () =>
      student.learningPreferences.studyModeSetAt
        ? new Date(student.learningPreferences.studyModeSetAt)
        : null,
    [student.learningPreferences.studyModeSetAt],
  );
  const studyModeExpired =
    studyModeSetAt != null
      ? Date.now() - studyModeSetAt.getTime() > 1000 * 60 * 60 * 24 * 7
      : false;

  const handleOnboardingComplete = async (result?: { pathEntries?: StudentPathEntry[] } | null) => {
    setActiveView('dashboard');
    setActiveTab('journey');
    if (result?.pathEntries?.length) {
      queryClient.setQueryData(studentPathQueryKey(student?.id), {
        path: studentPath,
        entries: result.pathEntries,
        next: result.pathEntries[0] ?? null,
      });
    }
    trackEvent('onboarding_completed', { studentId: student.id });
    await refreshUser().catch(() => undefined);
    await Promise.all([
      refetch({ throwOnError: false }),
      refreshStudentPath().catch(() => undefined),
    ]);
  };

  const persistDismissedNudges = (next: Set<string>) => {
    if (!student?.id) return;
    try {
      localStorage.setItem(`student-nudges-dismissed-${student.id}`, JSON.stringify(Array.from(next)));
    } catch (error) {
      console.warn('[StudentDashboard] Failed to persist dismissed nudges', error);
    }
  };

  const handleDismissNudge = (nudge: StudentNudge, reason: 'dismiss' | 'cta' = 'dismiss') => {
    const next = new Set(dismissedNudges);
    next.add(nudge.id);
    setDismissedNudges(next);
    persistDismissedNudges(next);
    trackEvent('student_nudge_dismissed', {
      studentId: student.id,
      nudge_id: nudge.id,
      type: nudge.type,
      reason,
    });
  };

  const handleNudgeCta = (nudge: StudentNudge) => {
    trackEvent('student_nudge_cta', {
      studentId: student.id,
      nudge_id: nudge.id,
      type: nudge.type,
      detail: nudge.detail,
    });
    handleDismissNudge(nudge, 'cta');
    if (nudge.targetUrl) {
      window.open(nudge.targetUrl, '_blank', 'noopener');
    } else {
      setActiveTab('today');
    }
  };

  const todaysPlan = useMemo(() => dashboard?.todaysPlan ?? [], [dashboard?.todaysPlan]);
  const todayActivities = useMemo(() => dashboard?.todayActivities ?? [], [dashboard?.todayActivities]);
  const filteredPlan =
    subjectFilter === 'all'
      ? todaysPlan
      : todaysPlan.filter((lesson) => lesson.subject === subjectFilter);
  const extensionActivities = todayActivities.filter((activity) => activity.homeExtension);
  const activeLessonId = dashboard?.activeLessonId ?? null;
  const recommendedLesson =
    todaysPlan.find((lesson) => lesson.id === activeLessonId) ??
    todaysPlan.find((lesson) => lesson.status !== 'completed') ??
    todaysPlan[0] ??
    null;
  const todaysPlanProgress = useMemo(() => {
    const total = todaysPlan.length;
    const completed = todaysPlan.filter((lesson) => lesson.status === 'completed').length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { completed, total, pct };
  }, [todaysPlan]);
  const nextAssessment = (dashboard?.upcomingAssessments ?? [])[0] ?? null;
  const diagnosticStatus: 'not_started' | 'scheduled' | 'completed' =
    quickStats?.assessmentCompleted
      ? 'completed'
      : nextAssessment
        ? 'scheduled'
        : 'not_started';
  const studentCoverage = useMemo(() => {
    const total = todaysPlanProgress.total;
    const pct = todaysPlanProgress.total ? todaysPlanProgress.pct : null;
    const needMoreData = total < 3 || !quickStats?.assessmentCompleted;
    return { pct, needMoreData };
  }, [todaysPlanProgress, quickStats?.assessmentCompleted]);

  const nudgeTargetUrl = recommendedLesson?.launchUrl ?? dashboard?.nextLessonUrl ?? null;

  const contextualNudge = useMemo<StudentNudge | null>(() => {
    if (!adaptiveFlash || adaptiveFlash.eventType !== 'lesson_completed') return null;
    const focusLabel = adaptiveFocusLabel ?? 'this concept';
    const accuracy = studentStats.avgAccuracy;
    const reason = (adaptiveFlash.nextReason ?? '').toLowerCase();
    let type: StudentNudge['type'] = 'recap';
    if (
      reason === 'remediation' ||
      (adaptiveFlash.misconceptions?.length ?? 0) > 0 ||
      (accuracy != null && accuracy < 70)
    ) {
      type = 'try_again';
    } else if (reason === 'stretch' || (accuracy != null && accuracy < 85)) {
      type = 'quick_check';
    }
    const detail =
      humanizeStandard(adaptiveFlash.misconceptions?.[0] ?? null) ??
      adaptiveFocusLabel ??
      focusLabel;
    const id = `${adaptiveFlash.createdAt ?? Date.now()}-${type}-${detail}`;
    if (dismissedNudges.has(id)) return null;
    const bodyCopy: Record<StudentNudge['type'], string> = {
      recap: `Do a 1-minute recap on ${detail} to lock it in.`,
      quick_check: `Take a 3-question quick check on ${detail} while it's fresh.`,
      try_again: `Try a short redo on ${detail} to boost confidence.`,
    };
    const titleCopy: Record<StudentNudge['type'], string> = {
      recap: '1-minute recap',
      quick_check: 'Quick check time',
      try_again: 'Try again to boost mastery',
    };
    return {
      id,
      type,
      title: titleCopy[type],
      body: bodyCopy[type],
      targetUrl: nudgeTargetUrl,
      detail,
    };
  }, [adaptiveFlash, adaptiveFocusLabel, dismissedNudges, nudgeTargetUrl, studentStats.avgAccuracy]);

  const currentPlanFocus = useMemo(() => {
    if (parentGoalActive && student?.learningPreferences?.focusSubject) {
      return student.learningPreferences.focusSubject as Subject | 'balanced';
    }
    return weeklyPlanFocus;
  }, [parentGoalActive, student?.learningPreferences?.focusSubject, weeklyPlanFocus]);

  const latestCheckIn = useMemo(() => (checkIns ?? [])[0] ?? null, [checkIns]);

  useEffect(() => {
    if (!student || !dashboard || !quickStats) return;
    const snapshotKey = `celebration-snapshot-${student.id}`;
    const seenKey = `celebration-seen-${student.id}`;
    let seen = celebrationShownIds;
    try {
      const storedSeen = localStorage.getItem(seenKey);
      if (storedSeen) {
        seen = new Set(JSON.parse(storedSeen) as string[]);
        setCelebrationShownIds(seen);
      }
    } catch (error) {
      console.warn('[Celebrations] Failed to parse seen celebrations', error);
    }

    const snapshot = (() => {
      try {
        const raw = localStorage.getItem(snapshotKey);
        return raw
          ? (JSON.parse(raw) as { level?: number; streakDays?: number; avgAccuracy?: number | null; modulesMastered?: number })
          : {};
      } catch {
        return {};
      }
    })();

    const modulesMasteredCount = studentStats.modulesMastered?.count ?? 0;
    const avgAccuracy = studentStats.avgAccuracy ?? null;
    const candidates: CelebrationMoment[] = [];
    if (quickStats.level && (!snapshot.level || quickStats.level > snapshot.level)) {
      candidates.push({
        id: `level-${quickStats.level}`,
        title: `Level up!`,
        description: `You reached level ${quickStats.level} by finishing lessons.`,
        kind: 'level',
        occurredAt: new Date().toISOString(),
        prompt: 'Start your next lesson to keep the momentum.',
        studentId: student.id,
      });
    }

    const streakMilestones = [3, 7, 14, 30];
    const streakDays = quickStats.streakDays ?? student.streakDays;
    const reachedMilestone = streakMilestones.find(
      (milestone) => streakDays >= milestone && (!snapshot.streakDays || snapshot.streakDays < milestone),
    );
    if (reachedMilestone) {
      candidates.push({
        id: `streak-${reachedMilestone}-${streakDays}`,
        title: `${reachedMilestone}-day streak!`,
        description: `You learned for ${reachedMilestone} days in a row.`,
        kind: 'streak',
        occurredAt: new Date().toISOString(),
        prompt: 'Stay on a roll—try one more lesson today.',
        studentId: student.id,
      });
    }

    if (
      avgAccuracy != null &&
      snapshot.avgAccuracy != null &&
      avgAccuracy - snapshot.avgAccuracy >= 5
    ) {
      candidates.push({
        id: `accuracy-${Math.round(avgAccuracy * 10)}`,
        title: 'Accuracy up!',
        description: `Your average accuracy improved to ${avgAccuracy}%.`,
        kind: 'milestone',
        occurredAt: new Date().toISOString(),
        prompt: 'Keep the streak by doing a quick recap.',
        studentId: student.id,
        notifyParent: true,
      });
    }

    if (modulesMasteredCount > (snapshot.modulesMastered ?? 0)) {
      const latestMastery = studentStats.modulesMastered?.items?.[0];
      candidates.push({
        id: `mastery-${modulesMasteredCount}`,
        title: 'New mastery unlocked',
        description: latestMastery?.title
          ? `You mastered ${latestMastery.title}.`
          : 'You mastered a new module.',
        kind: 'mastery',
        occurredAt: new Date().toISOString(),
        prompt: 'Choose your next challenge or review to lock it in.',
        studentId: student.id,
        notifyParent: true,
      });
    }

    const serverCelebrations = celebrationMoments ?? [];
    const queue = [...candidates, ...serverCelebrations]
      .filter((celebration) => !seen.has(celebration.id))
      .slice(0, 2);

    if (queue.length) {
      setCelebrationQueue(queue);
      queue.forEach((item) => {
        trackEvent('celebration_shown', {
          kind: item.kind,
          id: item.id,
          level: quickStats.level,
          streak_days: streakDays,
          avatar_id: (item as { avatarId?: string }).avatarId,
          mission_id: (item as { missionId?: string }).missionId,
        });
      });
    }

    try {
      localStorage.setItem(
        snapshotKey,
        JSON.stringify({
          level: quickStats.level,
          streakDays,
          avgAccuracy,
          modulesMastered: modulesMasteredCount,
        }),
      );
      localStorage.setItem(seenKey, JSON.stringify(Array.from(seen)));
    } catch (error) {
      console.warn('[Celebrations] Failed to persist snapshot', error);
    }
  }, [celebrationMoments, celebrationShownIds, dashboard, quickStats, student, studentStats.avgAccuracy, studentStats.modulesMastered?.count]);

  useEffect(() => {
    if (!contextualNudge || !student?.id) return;
    if (lastNudgeTracked.current === contextualNudge.id) return;
    lastNudgeTracked.current = contextualNudge.id;
    trackEvent('student_nudge_shown', {
      studentId: student.id,
      nudge_id: contextualNudge.id,
      type: contextualNudge.type,
      detail: contextualNudge.detail,
    });
  }, [contextualNudge, student?.id]);

  const weeklyPlanTargets = useMemo(() => {
    const lessonBase = parentGoals?.weeklyLessons ?? 5;
    const minutesBase = parentGoals?.practiceMinutes ?? 60;
    const factor =
      parentGoalActive || !lessonBase
        ? 1
        : weeklyPlanIntensity === 'light'
          ? 0.8
          : weeklyPlanIntensity === 'challenge'
            ? 1.2
            : 1;
    return {
      lessons: Math.max(1, Math.round(lessonBase * factor)),
      minutes: Math.max(15, Math.round(minutesBase * factor)),
    };
  }, [parentGoalActive, parentGoals?.practiceMinutes, parentGoals?.weeklyLessons, weeklyPlanIntensity]);

  const weeklyPlanExpectedLessons = useMemo(() => {
    const today = new Date();
    const dayOfWeek = ((today.getDay() + 6) % 7) + 1; // Monday=1
    return Math.ceil((weeklyPlanTargets.lessons * dayOfWeek) / 7);
  }, [weeklyPlanTargets.lessons]);

  const weeklyPlanStatus = useMemo(() => {
    if (!weeklyPlanTargets.lessons) return 'on_track';
    if (lessonsThisWeek >= weeklyPlanExpectedLessons) return 'on_track';
    if (lessonsThisWeek >= weeklyPlanExpectedLessons - 1) return 'almost';
    return 'behind';
  }, [lessonsThisWeek, weeklyPlanExpectedLessons, weeklyPlanTargets.lessons]);

  const dismissCelebration = (celebration: CelebrationMoment, reason: 'auto' | 'close' | 'cta') => {
    const nextQueue = celebrationQueue.slice(1);
    setCelebrationQueue(nextQueue);
    const updatedSeen = new Set(celebrationShownIds);
    updatedSeen.add(celebration.id);
    setCelebrationShownIds(updatedSeen);
    try {
      localStorage.setItem(`celebration-seen-${student.id}`, JSON.stringify(Array.from(updatedSeen)));
    } catch (error) {
      console.warn('[Celebrations] Failed to persist seen ids', error);
    }
    trackEvent('celebration_dismissed', { kind: celebration.kind, id: celebration.id, reason });
  };

  const journeyNarrative = dashboard?.aiRecommendations ?? [];
  const journeyFocusAreas = useMemo(
    () => dashboard?.profile?.weaknesses ?? [],
    [dashboard?.profile?.weaknesses],
  );
  const journeyStrengths = dashboard?.profile?.strengths ?? [];
  const microPlanStorageKey = student ? `micro-plan-v1-${student.id}` : null;

  const computePlanCompleted = useCallback((state: Record<string, MicroTaskStatus>) => {
    const statuses = Object.values(state);
    if (!statuses.length) return false;
    return statuses.every((status) => status === 'done');
  }, []);

  const microPlanTasks = useMemo<MicroTask[]>(() => {
    const tasks: MicroTask[] = [];
    const primary =
      recommendedLesson ??
      todaysPlan.find((lesson) => lesson.status !== 'completed') ??
      todaysPlan[0] ??
      null;
    if (primary) {
      tasks.push({
        id: `micro-new-${primary.id}`,
        label: primary.title,
        helper: 'New learning pick for today.',
        minutes: 7,
        type: 'new',
        subject: primary.subject,
        lessonId: primary.id,
        hint: primary.suggestionReason ?? undefined,
      });
    }

    const reviewPick =
      todaysPlan.find((lesson) => lesson.status === 'completed' && lesson.id !== primary?.id) ??
      todaysPlan.find((lesson) => lesson.id !== primary?.id) ??
      null;

    if (reviewPick) {
      tasks.push({
        id: `micro-review-${reviewPick.id}`,
        label: `Review ${reviewPick.title}`,
        helper: 'Speed-run the tricky step you remember.',
        minutes: 5,
        type: 'review',
        subject: reviewPick.subject,
        lessonId: reviewPick.id,
      });
    }

    const spacedLabel =
      adaptiveFocusLabel ??
      (journeyFocusAreas.length ? humanizeStandard(journeyFocusAreas[0]) ?? journeyFocusAreas[0] : null) ??
      todayActivities[0]?.title ??
      null;

    if (spacedLabel) {
      const slug = spacedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      tasks.push({
        id: `micro-spaced-${slug || 'focus'}`,
        label: spacedLabel.startsWith('Spaced') ? spacedLabel : `Spaced recall: ${spacedLabel}`,
        helper: '3-minute retrieval: explain it aloud or jot the steps.',
        minutes: 3,
        type: 'spaced',
        subject: reviewPick?.subject ?? primary?.subject,
        lessonId: reviewPick?.id ?? primary?.id ?? null,
      });
    }

    if (tasks.length === 0) {
      tasks.push(
        {
          id: 'micro-new-fallback',
          label: 'Adaptive warm-up',
          helper: 'Short new practice set picked for you.',
          minutes: 7,
          type: 'new',
          subject: 'math',
          lessonId: null,
        },
        {
          id: 'micro-spaced-fallback',
          label: 'Spaced recall: yesterday’s notes',
          helper: 'Talk through the main idea for 3 minutes.',
          minutes: 3,
          type: 'spaced',
          subject: 'english',
          lessonId: null,
        },
        {
          id: 'micro-review-fallback',
          label: 'Quick review checkpoint',
          helper: 'Re-run one mistake from yesterday and fix it.',
          minutes: 5,
          type: 'review',
          subject: 'science',
          lessonId: null,
        },
      );
    }

    return tasks.slice(0, 3);
  }, [adaptiveFocusLabel, journeyFocusAreas, recommendedLesson, todayActivities, todaysPlan]);

  useEffect(() => {
    if (!microPlanTasks.length) {
      setMicroPlanState((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }
    setMicroPlanState((prev) => {
      const next: Record<string, MicroTaskStatus> = {};
      microPlanTasks.forEach((task) => {
        next[task.id] = prev[task.id] ?? 'pending';
      });
      const changed =
        microPlanTasks.some((task) => prev[task.id] !== next[task.id]) ||
        Object.keys(prev).some((key) => !(key in next));
      return changed ? next : prev;
    });
  }, [microPlanTasks]);

  const microPlanMinutes = useMemo(
    () => microPlanTasks.reduce((acc, task) => acc + task.minutes, 0),
    [microPlanTasks],
  );

  const microPlanProgress = useMemo(() => {
    const total = microPlanTasks.length;
    const completed = microPlanTasks.filter((task) => microPlanState[task.id] === 'done').length;
    const skipped = microPlanTasks.filter((task) => microPlanState[task.id] === 'skipped').length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, skipped, pct };
  }, [microPlanState, microPlanTasks]);

  const microPlanCompletedToday = microPlanProgress.total > 0 && microPlanProgress.completed === microPlanProgress.total;

  const microPlanStreakDays = useMemo(() => {
    const completedDates = new Set(
      microPlanHistory.filter((entry) => entry.completed).map((entry) => entry.date),
    );
    if (microPlanCompletedToday) {
      completedDates.add(todayKey);
    }
    let streak = 0;
    const cursor = new Date(`${todayKey}T00:00:00`);
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (completedDates.has(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [microPlanCompletedToday, microPlanHistory, todayKey]);

  const spacedReviewTask = microPlanTasks.find((task) => task.type === 'spaced') ?? null;

  useEffect(() => {
    if (!microPlanStorageKey) return;
    try {
      const raw = localStorage.getItem(microPlanStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        date?: string;
        tasks?: Record<string, MicroTaskStatus>;
        history?: Array<{ date?: string; completed?: boolean }>;
      };
      const history = Array.isArray(parsed.history)
        ? parsed.history
            .filter((entry) => typeof entry?.date === 'string')
            .map((entry) => ({
              date: entry.date as string,
              completed: Boolean(entry.completed),
            }))
        : [];

      if (parsed.date && parsed.date !== todayKey) {
        const previousCompleted = computePlanCompleted(parsed.tasks ?? {});
        const nextHistory = [...history, { date: parsed.date, completed: previousCompleted }];
        setMicroPlanHistory(nextHistory.slice(-30));
        setMicroPlanState({});
      } else {
        setMicroPlanHistory(history.slice(-30));
        setMicroPlanState(parsed.tasks ?? {});
      }
    } catch (storageError) {
      console.warn('[StudentDashboard] Failed to load micro plan state', storageError);
    }
  }, [computePlanCompleted, microPlanStorageKey, todayKey]);

  useEffect(() => {
    if (!microPlanStorageKey) return;
    try {
      const payload = {
        date: todayKey,
        tasks: microPlanState,
        history: microPlanHistory.slice(-30),
      };
      localStorage.setItem(microPlanStorageKey, JSON.stringify(payload));
    } catch (storageError) {
      console.warn('[StudentDashboard] Failed to persist micro plan state', storageError);
    }
  }, [microPlanHistory, microPlanState, microPlanStorageKey, todayKey]);

  if (!student) {
    return null;
  }

  if (activeView === 'onboarding') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-500">
            Loading onboarding…
          </div>
        }
      >
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      </Suspense>
    );
  }

  const handleMicroTaskStateChange = (taskId: string, status: MicroTaskStatus) => {
    const task = microPlanTasks.find((entry) => entry.id === taskId);
    setMicroPlanState((prev) => {
      const current = prev[taskId] ?? 'pending';
      const next = current === status ? 'pending' : status;
      return { ...prev, [taskId]: next };
    });
    trackEvent('student_micro_plan_action', {
      studentId: student.id,
      task_id: taskId,
      task_type: task?.type ?? 'unknown',
      status,
      subject: task?.subject ?? 'unknown',
    });
  };

  const handleRefresh = async () => {
    trackEvent('student_dashboard_refresh', { studentId: student.id });
    await Promise.all([
      refetch({ throwOnError: false }),
      refreshStudentPath().catch((pathError) => {
        console.warn('[StudentDashboard] Unable to refresh adaptive path', pathError);
      }),
      queryClient.invalidateQueries({ queryKey: studentStatsQueryKey(student?.id) }).catch(() => undefined),
    ]);
  };

  const handleStartLesson = (lesson: DashboardLesson) => {
    trackEvent('lesson_start_click', {
      studentId: student.id,
      lessonId: lesson.id,
      status: lesson.status,
    });
    if (activeCelebration) {
      trackEvent('celebration_next_activity_started', {
        kind: activeCelebration.kind,
        id: activeCelebration.id,
        activity_type: 'lesson',
      });
      dismissCelebration(activeCelebration, 'cta');
    }
    if (lesson.launchUrl) {
      window.open(lesson.launchUrl, '_blank', 'noopener');
    }
    setActiveView('lesson');
  };

  const handleAcknowledgeCheckIn = async (checkIn: ParentCheckIn) => {
    if (!checkIn?.id) return;
    setAcknowledgingCheckIn(checkIn.id);
    setCheckInError(null);
    try {
      const updated = await acknowledgeCheckIn(checkIn.id);
      queryClient.setQueryData(['student-checkins', student.id], (prev: ParentCheckIn[] | undefined) =>
        prev ? prev.map((entry) => (entry.id === updated.id ? updated : entry)) : [updated],
      );
      trackEvent('parent_checkin_seen', {
        studentId: student.id,
        checkin_id: checkIn.id,
        status: 'seen',
      });
    } catch (error) {
      setCheckInError(error instanceof Error ? error.message : 'Unable to confirm receipt right now.');
    } finally {
      setAcknowledgingCheckIn(null);
    }
  };

  const handleWritingSubmit = () => {
    const trimmed = writingResponse.trim();
    if (!trimmed) {
      setWritingFeedback('Add 2-4 sentences so we can coach your flow.');
      return;
    }
    const sentenceCount = trimmed.split(/[.!?]/).filter((sentence) => sentence.trim().length > 0).length;
    const hasTransition = /(first|then|next|because|finally|after)/i.test(trimmed);
    const hasReflection = /(learned|realized|so that|this helped)/i.test(trimmed);
    const feedbackParts = [];
    if (sentenceCount < 3) {
      feedbackParts.push('Add one more sentence with a concrete detail or result.');
    }
    if (!hasTransition) {
      feedbackParts.push('Use a transition like "then" or "because" to show how events connect.');
    }
    if (!hasReflection) {
      feedbackParts.push('Close with what changed for you or what you learned.');
    }
    if (!feedbackParts.length) {
      feedbackParts.push('Great sequencing and clarity—tighten one sentence to keep it concise.');
    }
    feedbackParts.push('Feedback runs locally and is not stored.');
    setWritingFeedback(feedbackParts.join(' '));
  };

  const handleReadingSelect = (index: number) => {
    setReadingAnswer(index);
    if (index === readingSet.answer) {
      setReadingFeedback('Yes—sharing the task kept the plants healthy and showed teamwork.');
    } else {
      setReadingFeedback('Look for the reason he organized friends. Hint: the garden was wilting and needed care.');
    }
  };

  const handleSaveReflectionEntry = async () => {
    const trimmed = reflectionText.trim();
    if (trimmed.length < 10) {
      setReflectionError('Add at least a short sentence (10+ characters).');
      return;
    }
    if (trimmed.length > 220) {
      setReflectionError('Keep it under 220 characters.');
      return;
    }
    setReflectionSaving(true);
    setReflectionError(null);
    try {
      const newEntry = await saveReflection({
        questionId: reflectionQuestion,
        responseText: trimmed,
        lessonId: dashboard?.activeLessonId ?? undefined,
        subject: dashboard?.todayActivities?.[0]?.subject ?? undefined,
        sentiment: undefined,
        shareWithParent: reflectionShare,
      });
      setReflections((prev) => [newEntry, ...prev].slice(0, 10));
      setReflectionModalOpen(false);
      setReflectionText('');
      trackEvent('reflection_submitted', {
        question_id: reflectionQuestion,
        length: trimmed.length,
        lesson_id: dashboard?.activeLessonId,
        subject: dashboard?.todayActivities?.[0]?.subject ?? null,
      });
      if (reflectionShare) {
        trackEvent('reflection_share_toggled', { shared: true, source: 'prompt' });
      }
    } catch (err) {
      console.error('[Reflections] Save failed', err);
      setReflectionError(err instanceof Error ? err.message : 'Unable to save right now.');
    } finally {
      setReflectionSaving(false);
    }
  };

  const handleToggleReflectionShare = async (id: string, share: boolean) => {
    setReflections((prev) => prev.map((entry) => (entry.id === id ? { ...entry, shareWithParent: share } : entry)));
    try {
      await toggleReflectionShare(id, share);
      trackEvent('reflection_share_toggled', { shared: share, source: 'dashboard' });
    } catch (err) {
      console.warn('[Reflections] Toggle share failed', err);
      setReflections((prev) => prev.map((entry) => (entry.id === id ? { ...entry, shareWithParent: !share } : entry)));
    }
  };

  const persistWeeklyPlanPrefs = async (updates: Partial<LearningPreferences>) => {
    if (!student) return;
    const merged: LearningPreferences = {
      ...student.learningPreferences,
      ...updates,
    };
    try {
      await updateLearningPreferences(student.id, merged);
    } catch (error) {
      console.warn('[StudentDashboard] Unable to persist weekly plan prefs', error);
    }
  };

  const handleWeeklyPlanIntensityChange = (value: 'light' | 'normal' | 'challenge') => {
    if (parentGoalActive) return;
    if (value === weeklyPlanIntensity) return;
    setWeeklyPlanIntensity(value);
    setWeeklyPlanStatusTracked(false);
    trackEvent('weekly_plan_intensity_changed', {
      from: weeklyPlanIntensity,
      to: value,
      parent_override: parentGoalActive,
    });
    void persistWeeklyPlanPrefs({ weeklyPlanIntensity: value });
  };

  const handleWeeklyPlanFocusChange = (value: Subject | 'balanced') => {
    if (parentGoalActive) return;
    if (value === weeklyPlanFocus) return;
    setWeeklyPlanFocus(value);
    setWeeklyPlanStatusTracked(false);
    trackEvent('weekly_plan_focus_changed', {
      from: weeklyPlanFocus,
      to: value,
      parent_override: parentGoalActive,
    });
    void persistWeeklyPlanPrefs({ weeklyPlanFocus: value, focusSubject: value === 'balanced' ? 'balanced' : value });
  };

  const handleWeeklyIntentChange = (value: 'precision' | 'speed' | 'stretch' | 'balanced') => {
    if (value === weeklyIntent) return;
    setWeeklyIntent(value);
    trackEvent('weekly_intent_changed', { from: weeklyIntent, to: value });
    void persistWeeklyPlanPrefs({ weeklyIntent: value });
  };

  const handleStudyModeChange = (
    value: 'catch_up' | 'keep_up' | 'get_ahead',
    source: 'dashboard' | 'expired_confirm' = 'dashboard',
  ) => {
    if (value === studyMode && source !== 'expired_confirm') return;
    if ((parentGoalActive || studyModeLocked) && value === 'get_ahead') return;
    setStudyMode(value);
    trackEvent('study_mode_set', {
      mode: value,
      source,
      grade_band: gradeBand,
    });
    void persistWeeklyPlanPrefs({ studyMode: value, studyModeSetAt: new Date().toISOString() });
  };

  const handleSelectTutorPersona = (personaId: string) => {
    setTutorPersonaId(personaId);
    trackEvent('tutor_onboarding_step_completed', {
      step: 'persona',
      persona_id: personaId,
      avatar_id: personaId,
      provided_name: Boolean(tutorNameInput.trim()),
    });
  };

  const handleSaveTutorPersona = async () => {
    if (!tutorPersonaId) {
      setTutorFeedback('Pick a tutor persona to continue.');
      return;
    }
    setTutorFeedback(null);
    const trimmedName = tutorNameInput.trim();
    const validation = trimmedName.length ? validateTutorName(trimmedName) : { ok: true, value: '', normalized: '' };
    if (!validation.ok) {
      setTutorFeedback(tutorNameErrorMessage(validation));
      return;
    }
    trackEvent('tutor_onboarding_step_completed', {
      step: 'name',
      persona_id: tutorPersonaId,
      avatar_id: tutorPersonaId,
      provided_name: Boolean(trimmedName),
    });
    setTutorSaving(true);
    try {
      await updateStudentPreferences({ tutorPersonaId });
      await saveTutorPersona({
        name: trimmedName.length ? validation.value : null,
        avatarId: selectedPersonaAvatarId ?? undefined,
      });
      const durationSec = tutorFlowStartedAt ? Math.round((Date.now() - tutorFlowStartedAt) / 1000) : null;
      trackEvent('tutor_onboarding_completed', {
        persona_id: tutorPersonaId,
        avatar_id: tutorPersonaId,
        name_set: Boolean(trimmedName),
        duration_sec: durationSec,
      });
      setTutorFeedback(
        trimmedName.length
          ? `Saved! Your tutor will introduce as ${validation.value}.`
          : 'Saved! We will use the default tutor name.',
      );
      await refreshUser();
    } catch (error) {
      console.error('[StudentDashboard] Failed to save tutor persona', error);
      setTutorFeedback(error instanceof Error ? error.message : 'Unable to save tutor settings right now.');
    } finally {
      setTutorSaving(false);
    }
  };

  const handleRandomizeTutorPersona = () => {
    if (!tutorPersonas.length) return;
    const next = tutorPersonas[Math.floor(Math.random() * tutorPersonas.length)];
    handleSelectTutorPersona(next.id);
  };

  const handleEquipAvatar = async (option: AvatarOption) => {
    if (!isAvatarUnlocked(option)) {
      setAvatarFeedback('Keep working on missions to unlock this avatar.');
      return;
    }
    setAvatarSaving(true);
    setAvatarFeedback(null);
    try {
      const prefs = await updateStudentPreferences({ avatarId: option.id });
      setEquippedAvatarId(prefs.avatar_id ?? option.id);
      setAvatarFeedback(`Equipped ${option.label}!`);
      trackEvent('avatar_equipped', { studentId: student.id, avatarId: option.id });
      await refreshUser();
    } catch (error) {
      console.error('[StudentDashboard] Failed to equip avatar', error);
      setAvatarFeedback(error instanceof Error ? error.message : 'Unable to equip avatar right now.');
    } finally {
      setAvatarSaving(false);
    }
  };

  const updateTodayStripState = (key: string, state: 'done' | 'skipped') => {
    setTodayLaneState((prev) => ({ ...prev, [key]: state }));
    trackEvent('student_today_lane_action', { studentId: student.id, key, state });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-brand-teal to-brand-blue rounded-2xl p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold mb-2">Welcome back, {student.name}! 🌟</h1>
                <p className="opacity-90">
                  Your AI tutor has fresh insights lined up—let’s keep the momentum going.
                </p>
                <div className="flex flex-wrap gap-3 mt-4">
                  {recommendedLesson && (
                    <button
                      onClick={() => handleStartLesson(recommendedLesson)}
                      className="inline-flex items-center space-x-2 bg-white text-brand-violet px-4 py-2 rounded-xl font-semibold hover:bg-gray-100 transition-colors focus-ring"
                    >
                      <Play className="h-4 w-4" />
                      <span>
                        {recommendedLesson.status === 'completed'
                          ? 'Review next lesson'
                          : 'Resume next lesson'}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('journey')}
                    className="inline-flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-semibold transition-colors focus-ring"
                  >
                    <Map className="h-4 w-4" />
                    <span>View My Journey</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleRefresh}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors focus-ring"
                  disabled={isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  <span>{isFetching ? 'Refreshing' : 'Refresh'}</span>
                </button>
                <div className="text-right">
                  <div className="text-3xl font-bold">
                    {quickStats?.totalXp ?? student.xp}
                  </div>
                  <div className="text-sm opacity-90">Total XP</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {studentStats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            className="mb-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Live stats</p>
                  {statsFetching && <span className="text-[11px] text-slate-500">Refreshing…</span>}
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Accuracy</p>
                    <p className="text-lg font-bold text-slate-800">
                      {studentStats.avgAccuracy != null ? `${studentStats.avgAccuracy}%` : '—'}
                    </p>
                    <p className="text-xs text-slate-600">
                      Latest quiz {studentStats.latestQuizScore != null ? `${studentStats.latestQuizScore}%` : '—'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Weekly time</div>
                    <div className="font-semibold">{Math.round(studentStats.weeklyTimeMinutes)} min</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Plan streak</div>
                    <div className="font-semibold">{microPlanStreakDays} days</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Login streak: {studentStats.streakDays}d
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Progress</p>
                  {studentStats.struggle && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">
                      <Flame className="h-3.5 w-3.5" /> Focus needed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Path completion</p>
                    <p className="text-lg font-bold text-slate-800">
                      {studentStats.pathProgress.percent != null ? `${studentStats.pathProgress.percent}%` : '—'}
                    </p>
                    <p className="text-xs text-slate-600">
                      {studentStats.pathProgress.completed} done · {studentStats.pathProgress.remaining} remaining
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Modules mastered</div>
                    <div className="font-semibold">{studentStats.modulesMastered.count}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Badges</div>
                    <div className="font-semibold">{studentStats.badges}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Focus standards</p>
                {studentStats.focusStandards.length > 0 ? (
                  <div className="space-y-2">
                    {studentStats.focusStandards.map((standard) => (
                      <div
                        key={standard.code}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{standard.code}</p>
                          <p className="text-xs text-slate-600">{standard.samples} recent questions</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{Math.round(standard.accuracy)}%</p>
                          <p className="text-xs text-slate-600">accuracy</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">Keep up the streak—no focus areas flagged.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {pathLoading && (
          <div className="mb-6 animate-pulse bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="h-4 bg-slate-200 rounded w-32 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="h-20 rounded-xl bg-slate-100" />
              ))}
            </div>
          </div>
        )}

        {!pathLoading && upNextEntries.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Up Next</p>
                  <h3 className="text-lg font-bold text-slate-900">Placement-powered path</h3>
                  <p className="text-sm text-slate-600">{upNextSubtitle}</p>
                  <p className="text-xs text-slate-500">
                    Your plan updates as you finish lessons and practice. Watch "Up Next" change as you learn.
                  </p>
                  {upNextRecentlyUpdated && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                      Updated just now
                    </span>
                  )}
                </div>
              </div>
              {adaptiveBannerCopy && !planBannerDismissed && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="mb-4 rounded-xl border border-brand-blue/30 bg-brand-blue/5 px-4 py-3 flex items-start gap-3"
                >
                  <Sparkles className="h-4 w-4 text-brand-blue mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{adaptiveBannerCopy.title}</p>
                    <p className="text-xs text-slate-600">{adaptiveBannerCopy.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlanBannerDismissed(true)}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label="Dismiss plan update"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
              {lessonSummary && !lessonSummaryDismissed && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3">
                  <Bot className="h-4 w-4 text-emerald-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      Tutor caught today's focus: {lessonSummary.practiced}
                    </p>
                    <p className="text-xs text-slate-700">{lessonSummary.nextStep}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLessonSummaryDismissed(true)}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label="Dismiss tutor summary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {contextualNudge && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mb-4 rounded-xl border border-brand-violet/30 bg-brand-light-violet/40 px-4 py-3 flex items-start gap-3"
                >
                  <Sparkles className="h-4 w-4 text-brand-violet mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{contextualNudge.title}</p>
                    <p className="text-xs text-slate-700">{contextualNudge.body}</p>
                    {contextualNudge.detail && (
                      <p className="text-[11px] text-slate-500 mt-1">Focus: {contextualNudge.detail}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleNudgeCta(contextualNudge)}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-blue/90 focus-ring"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {contextualNudge.type === 'recap'
                        ? 'Start recap'
                        : contextualNudge.type === 'quick_check'
                          ? 'Do quick check'
                          : 'Try again'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismissNudge(contextualNudge)}
                      className="text-[11px] text-slate-500 hover:text-slate-700 focus-ring"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}
              {latestCheckIn && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">From your grown-up</p>
                          <p className="text-[11px] text-slate-500">
                            {formatAgo(latestCheckIn.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${CHECK_IN_BADGES[latestCheckIn.status]}`}
                        >
                          {describeCheckInStatus(latestCheckIn.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-800 leading-snug">{latestCheckIn.message}</p>
                      {checkInError && (
                        <p className="mt-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1">
                          {checkInError}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={latestCheckIn.status === 'seen' || acknowledgingCheckIn === latestCheckIn.id}
                          onClick={() => handleAcknowledgeCheckIn(latestCheckIn)}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 focus-ring"
                        >
                          {acknowledgingCheckIn === latestCheckIn.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5" />
                          )}
                          I saw this
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            trackEvent('parent_checkin_reply_tap', { studentId: student.id, checkin_id: latestCheckIn.id });
                            setActiveTab('journey');
                            document.getElementById('assistant')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-blue/50 focus-ring"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Reply in tutor
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {upNextEntries.slice(0, 5).map((entry, index) => {
                  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
                  const title =
                    (meta.module_title as string | undefined) ??
                    (meta.module_slug as string | undefined) ??
                    `Module ${entry.position}`;
                  const reasonCopy = describePathEntryReason(entry);
                  const reasonSlug = pathEntryReasonSlug(entry);
                  const reasonLabel =
                    reasonSlug === 'placement'
                      ? 'Diagnostic pick'
                      : reasonSlug === 'remediation' || reasonSlug === 'review'
                        ? 'Review boost'
                        : reasonSlug === 'stretch'
                          ? 'Stretch'
                          : 'Path pick';
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.05 }}
                      className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm flex items-start space-x-3"
                    >
                      <div className="h-10 w-10 rounded-full bg-sky-100 text-sky-700 font-semibold flex items-center justify-center">
                        {entry.position}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{title}</p>
                        <p className="text-xs text-slate-600 capitalize">
                          {entry.type} · {entry.status === 'not_started' ? 'Ready' : entry.status}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700">
                            <Info className="h-3 w-3 text-brand-blue" />
                            {reasonLabel}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600 capitalize">
                            {entry.type}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-600 leading-snug">{reasonCopy}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {missingGuardian && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6"
          >
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">No parent/guardian linked yet</p>
                  <p className="text-xs text-slate-600">
                    Share your Family Link code with your parent so they can connect their account and see your progress.
                    Learners under 13 should have a parent present while using ElevatED.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyFamilyCode}
                    disabled={!familyLinkCode}
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-brand-light-teal text-brand-teal text-sm font-semibold hover:bg-brand-light-teal/80 disabled:opacity-60"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFamilyCodeMessage(null);
                      rotateFamilyCodeMutation.mutate();
                    }}
                    className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 hover:border-brand-blue hover:text-brand-blue disabled:opacity-60"
                    disabled={rotateFamilyCodeMutation.isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${rotateFamilyCodeMutation.isLoading ? 'animate-spin' : ''}`} />
                    {rotateFamilyCodeMutation.isLoading ? 'Refreshing…' : 'New code'}
                  </button>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
                {familyLinkCode ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">Family Link code</span>
                      <span className="font-mono text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded px-2 py-1">
                        {familyLinkCode}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-600">
                      Parents enter this on their dashboard under Family Connections.
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 ${familyCodeQuery.isFetching ? 'animate-spin' : ''}`} />
                    Fetching your Family Link code…
                  </div>
                )}
                {familyCodeMessage && (
                  <p className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
                    {familyCodeMessage}
                  </p>
                )}
                {familyCodeError && (
                  <p className="mt-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1">
                    {familyCodeError}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {!entitlementsLoading && entitlements.lessonLimit && entitlements.lessonLimit !== 'unlimited' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mb-6"
          >
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {entitlements.planName ?? 'Free'} limit
                </p>
                <p className="text-xs text-amber-700">
                  You’ve completed {lessonsThisWeek} lesson{lessonsThisWeek === 1 ? '' : 's'} this
                  week. The Free plan includes up to {entitlements.lessonLimit} lessons each month; we’ll
                  remind you before you run out. Invite your parent to upgrade for more lessons and tutor time.
                </p>
              </div>
              <div className="text-[11px] font-semibold text-amber-800 px-2 py-1 rounded-full bg-white/70 border border-amber-200">
                Plan: {entitlements.planSlug ?? 'individual-free'}
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
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
                    <div className="text-2xl font-bold text-brand-blue">
                      {quickStats?.level ?? student.level}
                    </div>
                    <div className="text-sm text-gray-700">Current Level</div>
                  </div>
                  <div className="w-12 h-12 bg-brand-light-blue rounded-full flex items-center justify-center">
                    <Star className="h-6 w-6 text-brand-blue" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-brand-violet">
                      {microPlanStreakDays}
                    </div>
                    <div className="text-sm text-gray-700">Plan streak (15-min lane)</div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Login streak: {quickStats?.streakDays ?? student.streakDays}d
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-brand-light-violet rounded-full flex items-center justify-center">
                    <div className="text-2xl">🔥</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-brand-teal">
                      {dashboard?.recentBadges.length ?? student.badges.length}
                    </div>
                    <div className="text-sm text-gray-700">Badges Earned</div>
                  </div>
                  <div className="w-12 h-12 bg-brand-light-teal rounded-full flex items-center justify-center">
                    <Trophy className="h-6 w-6 text-brand-teal" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      {quickStats ? `${quickStats.hoursThisWeek}h` : '—'}
                    </div>
                    <div className="text-sm text-gray-700">Hours This Week</div>
                  </div>
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <Clock className="h-6 w-6 text-gray-600" />
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>

        {activeMission && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="bg-gradient-to-r from-brand-violet to-brand-blue rounded-2xl p-6 text-white mb-8"
          >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  <Map className="h-4 w-4" />
                  <span>Missions</span>
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold">{activeMission.title}</h3>
                  <span className="px-2 py-1 rounded-full text-[11px] bg-white/15 border border-white/10">
                    {missionCadence === 'daily' ? 'Daily' : 'Weekly'}
                  </span>
                </div>
                <p className="text-sm text-white/90">{activeMission.description}</p>
                {activeMission.highlight && (
                  <p className="text-xs text-white/80">{activeMission.highlight}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {(['daily', 'weekly'] as const).map((cadence) => (
                    <button
                      key={cadence}
                      type="button"
                      onClick={() => setMissionCadence(cadence)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        missionCadence === cadence
                          ? 'bg-white text-brand-violet border-white shadow-sm'
                          : 'border-white/30 text-white hover:bg-white/10'
                      }`}
                    >
                      {cadence === 'daily' ? 'Mission of the day' : 'Weekly quest'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-[220px] bg-white/10 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Progress</span>
                  <span>{missionProgress(activeMission)}%</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                  <div
                    className="bg-white h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(missionProgress(activeMission), 120)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-white/80 mt-2">
                  <span>Status: {activeMission.status.replace('_', ' ')}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/20 text-[11px]">
                    <Gift className="h-3 w-3" />
                    +{activeMission.rewardXp} XP
                  </span>
                </div>
                {activeMission.expiresAt && (
                  <p className="text-[11px] text-white/60 mt-1">
                    Resets{' '}
                    {new Date(activeMission.expiresAt).toLocaleString([], {
                      weekday: 'short',
                      hour: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {activeMission.tasks.map((task) => {
                const pct = Math.min(Math.round((task.progress / task.target) * 100), 120);
                return (
                  <div key={task.label} className="bg-white/10 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{task.label}</span>
                      <span>
                        {Math.min(task.progress, task.target)}/{task.target} {task.unit}
                      </span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                      <div
                        className="bg-white h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {task.subject && task.subject !== 'any' && (
                      <p className="text-[11px] text-white/70 mt-1">
                        Focus: {formatSubjectLabel(task.subject as Subject)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {error && (
          <div className="mb-8 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Heads up!</p>
              <p className="text-sm">
                We could not reach the learning analytics service. Showing your latest cached data instead.
              </p>
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6"
        >
          <div className="inline-flex bg-white rounded-full p-1 shadow-sm border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                activeTab === 'today' ? 'bg-brand-blue text-white shadow' : 'text-gray-700 hover:text-brand-blue'
              }`}
            >
              Today&apos;s Focus
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('journey')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                activeTab === 'journey' ? 'bg-brand-teal text-white shadow' : 'text-gray-700 hover:text-brand-teal'
              }`}
            >
              My Journey
            </button>
          </div>
          <div className="text-xs text-gray-500 flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-brand-violet" />
            <span>Adaptive path synced to your diagnostic</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {activeTab === 'today' ? (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-brand-light-blue/60"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
                        <Clock className="h-4 w-4" />
                        <span>15-minute plan</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Daily micro tasks</h3>
                      <p className="text-sm text-gray-600">
                        2–3 quick wins mixing new + review. Finish this lane to keep your streak alive.
                      </p>
                      <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <Flame className="h-3.5 w-3.5" />
                          Plan streak {microPlanStreakDays}d
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          Login streak {quickStats?.streakDays ?? student.streakDays}d
                        </span>
                      </div>
                    </div>
                    <div className="min-w-[220px] rounded-xl bg-brand-light-blue/30 border border-brand-light-blue/50 p-3 shadow-inner">
                      <div className="text-xs uppercase tracking-wide text-brand-blue font-semibold">Today&apos;s lane</div>
                      <div className="text-3xl font-bold text-brand-blue mt-1">
                        {microPlanProgress.total ? `${microPlanProgress.completed}/${microPlanProgress.total}` : '—'}
                      </div>
                      <p className="text-xs text-brand-blue/80">
                        ~{microPlanMinutes} min • {microPlanProgress.pct}% done
                      </p>
                      <div className="mt-2 h-2 rounded-full bg-white/80 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-blue to-brand-violet transition-all"
                          style={{ width: `${microPlanProgress.pct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-brand-blue/80">
                        {microPlanCompletedToday ? 'Logged for today—nice work.' : 'Complete micro tasks to extend your streak.'}
                      </p>
                    </div>
                  </div>
                  {spacedReviewTask && (
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-dashed border-brand-blue/50 bg-brand-light-blue/30 px-4 py-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-brand-blue font-semibold">Spaced review prompt</p>
                        <p className="text-sm font-semibold text-brand-blue">
                          {spacedReviewTask.label}
                        </p>
                        <p className="text-[11px] text-brand-blue/80">
                          Take 3 minutes to recall and mark it done to protect today&apos;s streak.
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleMicroTaskStateChange(spacedReviewTask.id, 'done')}
                          className="inline-flex items-center gap-1 rounded-full bg-brand-blue text-white px-3 py-2 text-xs font-semibold hover:bg-brand-blue/90"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Log review
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMicroTaskStateChange(spacedReviewTask.id, 'skipped')}
                          className="inline-flex items-center gap-1 rounded-full border border-brand-blue/40 text-brand-blue px-3 py-2 text-xs font-semibold hover:border-brand-blue"
                        >
                          <X className="h-3 w-3" />
                          Skip today
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {microPlanTasks.map((task) => {
                      const status = microPlanState[task.id] ?? 'pending';
                      const statusStyles =
                        status === 'done'
                          ? 'border-emerald-200 bg-emerald-50'
                          : status === 'skipped'
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-slate-200 bg-white';
                      const pill =
                        task.type === 'new'
                          ? 'New'
                          : task.type === 'review'
                            ? 'Review'
                            : 'Spaced';
                      return (
                        <div key={task.id} className={`rounded-xl border p-4 ${statusStyles}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                <Clock className="h-3.5 w-3.5 text-brand-blue" />
                                <span>{pill}</span>
                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{task.minutes} min</span>
                              </div>
                              <h4 className="text-sm font-semibold text-gray-900 line-clamp-2">{task.label}</h4>
                              <p className="text-xs text-gray-600 line-clamp-2">{task.helper}</p>
                              {task.hint && <p className="text-[11px] text-brand-blue line-clamp-1">Why: {task.hint}</p>}
                              {task.subject && (
                                <p className="text-[11px] text-gray-500 capitalize">Subject: {formatSubjectLabel(task.subject)}</p>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 text-[11px]">
                              <button
                                type="button"
                                onClick={() => handleMicroTaskStateChange(task.id, 'done')}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border font-semibold ${
                                  status === 'done'
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                                }`}
                              >
                                <CheckCircle className="h-3 w-3" />
                                Done
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMicroTaskStateChange(task.id, 'skipped')}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border font-semibold ${
                                  status === 'skipped'
                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
                                }`}
                              >
                                <X className="h-3 w-3" />
                                Skip
                              </button>
                            </div>
                          </div>
                          {spacedReviewTask && spacedReviewTask.id === task.id && (
                            <div className="mt-3 rounded-lg border border-dashed border-brand-blue/40 bg-brand-light-blue/40 px-3 py-2 text-[11px] text-brand-blue">
                              Spaced review counts toward your streak—log it once you finish.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {microPlanTasks.length === 0 && (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-gray-600">
                      We&apos;ll drop in today&apos;s micro tasks once your plan syncs.
                    </div>
                  )}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
                >
              {renderCelebration()}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                    <Target className="h-4 w-4" />
                    <span>This week&apos;s plan</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mt-1">
                    {weeklyPlanTargets.lessons} lessons • {weeklyPlanTargets.minutes} minutes • focus:{' '}
                    {currentPlanFocus === 'balanced'
                      ? 'Balanced'
                      : formatSubjectLabel(currentPlanFocus as Subject)}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Stay on track with a simple weekly target. Adjust how this week feels anytime.
                    {parentGoalActive ? ' Targets set by your parent.' : ''}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                    weeklyPlanStatus === 'on_track'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : weeklyPlanStatus === 'almost'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}
                      aria-label="Weekly plan status"
                    >
                      {weeklyPlanStatus === 'on_track'
                        ? 'On track'
                        : weeklyPlanStatus === 'almost'
                          ? 'Almost there'
                          : 'Behind'}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between text-sm font-semibold text-gray-800">
                        <span>Lessons</span>
                        <span>
                          {lessonsThisWeek}/{weeklyPlanTargets.lessons}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-teal to-brand-blue transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((lessonsThisWeek / weeklyPlanTargets.lessons) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Expected by today: {weeklyPlanExpectedLessons} lesson
                        {weeklyPlanExpectedLessons === 1 ? '' : 's'}.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between text-sm font-semibold text-gray-800">
                        <span>Minutes</span>
                        <span>
                          {minutesThisWeek}/{weeklyPlanTargets.minutes}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-teal to-brand-blue transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((minutesThisWeek / weeklyPlanTargets.minutes) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">Minutes include practice and lessons.</p>
                  </div>
                </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">Today / This week</p>
                      <span
                        className={`text-[11px] px-2 py-1 rounded-full ${
                          studentCoverage.needMoreData
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}
                      >
                        {studentCoverage.needMoreData ? 'Need more data' : 'Dialed in'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600">
                      Coverage {studentCoverage.pct ?? '—'}% of this week&apos;s grade-level plan.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-800">Weekly goals</p>
                          <span className="text-[11px] font-semibold text-slate-600">
                            {todaysPlanProgress.pct}% plan
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {lessonsThisWeek}/{weeklyPlanTargets.lessons} lessons • {minutesThisWeek}/
                          {weeklyPlanTargets.minutes} min
                        </p>
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => updateTodayStripState('goal', 'done')}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-semibold ${
                              todayLaneState.goal === 'done'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            <CheckCircle className="h-3 w-3" />
                            Done
                          </button>
                          <button
                            type="button"
                            onClick={() => updateTodayStripState('goal', 'skipped')}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-semibold ${
                              todayLaneState.goal === 'skipped'
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            <X className="h-3 w-3" />
                            Skip
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-800">Diagnostic / milestone</p>
                          <span
                            className={`text-[11px] px-2 py-1 rounded-full border ${
                              diagnosticStatus === 'completed'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : diagnosticStatus === 'scheduled'
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {diagnosticStatus === 'completed' ? 'Done' : diagnosticStatus === 'scheduled' ? 'Scheduled' : 'Not started'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {nextAssessment
                            ? nextAssessment.title
                            : 'Take the diagnostic to calibrate your path.'}
                        </p>
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => updateTodayStripState('assessment', 'done')}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-semibold ${
                              todayLaneState.assessment === 'done'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            <CheckCircle className="h-3 w-3" />
                            I&apos;m on it
                          </button>
                          <button
                            type="button"
                            onClick={() => updateTodayStripState('assessment', 'skipped')}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-semibold ${
                              todayLaneState.assessment === 'skipped'
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            <X className="h-3 w-3" />
                            Remind me
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-800">Adaptive pick</p>
                          <span className="text-[11px] font-semibold text-slate-600">
                            {recommendedLesson ? PATH_STATUS_LABELS[recommendedLesson.status] : 'Ready soon'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {recommendedLesson ? recommendedLesson.title : 'We’ll suggest the next lesson.'}
                        </p>
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => recommendedLesson && handleStartLesson(recommendedLesson)}
                            disabled={!recommendedLesson}
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 font-semibold bg-brand-blue text-white border-brand-blue hover:bg-brand-blue/90 disabled:opacity-50"
                          >
                            Start
                          </button>
                          <button
                            type="button"
                            onClick={() => updateTodayStripState('adaptive', 'skipped')}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-semibold ${
                              todayLaneState.adaptive === 'skipped'
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            <X className="h-3 w-3" />
                            Skip
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-2">Today I want to...</p>
                      {studyModeExpired && (
                        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                          It&apos;s been a while since you picked a mode. Keep &ldquo;{studyMode.replace('_', ' ')}&rdquo; or choose again.
                          <button
                            type="button"
                            onClick={() => handleStudyModeChange(studyMode, 'expired_confirm')}
                            className="ml-2 underline font-semibold"
                          >
                            Keep it
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {([
                          { id: 'catch_up', label: 'Catch up', helper: 'More review and reassurance' },
                          { id: 'keep_up', label: 'Keep up', helper: 'Stay on plan' },
                          { id: 'get_ahead', label: 'Get ahead', helper: 'Stretch and challenge' },
                        ] as const).map((option) => {
                          const active = studyMode === option.id;
                          const disabled = (parentGoalActive || studyModeLocked) && option.id === 'get_ahead';
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => handleStudyModeChange(option.id)}
                              disabled={disabled}
                              className={`px-3 py-2 rounded-xl border text-sm text-left transition ${
                                active
                                  ? 'bg-brand-violet text-white border-brand-violet shadow-sm'
                                  : 'bg-white text-gray-800 border-slate-200 hover:border-brand-violet/60'
                              } ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                              <div className="font-semibold">{option.label}</div>
                              <div className="text-[11px] text-gray-600">{option.helper}</div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">
                        {parentGoalActive || studyModeLocked
                          ? 'Some modes may be locked to match your parent or teacher plan.'
                          : 'We remember your last pick for 7 days.'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-2">This week feels</p>
                      <div className="inline-flex rounded-full border border-slate-200 bg-gray-50 p-1 text-sm font-semibold">
                        {(['light', 'normal', 'challenge'] as const).map((value) => {
                          const active = weeklyPlanIntensity === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => handleWeeklyPlanIntensityChange(value)}
                              disabled={parentGoalActive}
                              className={`px-3 py-1.5 rounded-full capitalize transition-colors ${
                                active
                                  ? 'bg-brand-blue text-white shadow'
                                  : 'text-gray-700 hover:text-brand-blue'
                              }`}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                      {parentGoalActive && (
                        <p className="mt-1 text-xs text-gray-500">Set by your parent.</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-2">Focus</p>
                      <div className="flex flex-wrap gap-2">
                        {(['balanced', ...SUBJECTS] as Array<Subject | 'balanced'>).map((subject) => {
                          const active = currentPlanFocus === subject;
                          return (
                            <button
                              key={subject}
                              type="button"
                              onClick={() => handleWeeklyPlanFocusChange(subject)}
                              disabled={parentGoalActive}
                              className={`px-3 py-1.5 rounded-full border text-sm transition ${
                                active
                                  ? 'bg-brand-teal text-white border-brand-teal shadow-sm'
                                  : 'border-slate-200 text-gray-700 hover:border-brand-teal/60'
                              }`}
                            >
                              {subject === 'balanced' ? 'Balanced' : formatSubjectLabel(subject)}
                            </button>
                          );
                        })}
                      </div>
                      {parentGoalActive && (
                        <p className="mt-1 text-xs text-gray-500">Focus set by your parent.</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-2">Weekly intent</p>
                      <div className="flex flex-wrap gap-2">
                        {(['balanced', 'precision', 'speed', 'stretch'] as const).map((intent) => {
                          const active = weeklyIntent === intent;
                          const helper =
                            intent === 'precision'
                              ? 'Slow down, maximize accuracy'
                              : intent === 'speed'
                                ? 'Keep pacing brisk'
                                : intent === 'stretch'
                                  ? 'Lean into challenge'
                                  : 'Balanced';
                          return (
                            <button
                              key={intent}
                              type="button"
                              onClick={() => handleWeeklyIntentChange(intent)}
                              className={`px-3 py-1.5 rounded-full border text-sm transition ${
                                active
                                  ? 'bg-amber-100 text-amber-800 border-amber-200 shadow-sm'
                                  : 'border-slate-200 text-gray-700 hover:border-amber-300'
                              }`}
                            >
                              <div className="font-semibold capitalize">{intent}</div>
                              <div className="text-[11px] text-gray-500">{helper}</div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Adjusts tutor tone and small XP nudges to match your goal this week.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (recommendedLesson) {
                          trackEvent('weekly_plan_started_next', {
                            lesson_id: recommendedLesson.id,
                            subject: recommendedLesson.subject,
                            plan_status: weeklyPlanStatus,
                            parent_goal: parentGoalActive,
                          });
                          handleStartLesson(recommendedLesson);
                        }
                      }}
                      disabled={!recommendedLesson}
                      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                        recommendedLesson
                          ? 'bg-brand-blue text-white hover:bg-brand-blue/90'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      <Play className="h-4 w-4" />
                      <span>{recommendedLesson ? 'Start next lesson' : 'No lesson ready'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('journey')}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-brand-blue/60 focus-ring"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>See my journey</span>
                    </button>
                  </div>
                </motion.div>

                {!showSkeleton && !(dashboard?.quickStats.assessmentCompleted ?? student.assessmentCompleted) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-r from-brand-violet to-brand-blue rounded-2xl p-6 text-white"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold mb-2">Complete Your Assessment</h3>
                        <p className="opacity-90 mb-4">
                          Take our adaptive diagnostic to unlock a precision learning path tailored by AI.
                        </p>
                        <button
                          onClick={() => setActiveView('onboarding')}
                          className="bg-white text-brand-violet px-6 py-2 rounded-xl font-semibold hover:bg-gray-100 transition-colors focus-ring"
                        >
                          Start Assessment
                        </button>
                      </div>
                      <div className="text-6xl opacity-80">
                        <Brain className="h-16 w-16" />
                      </div>
                    </div>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">My takeaways</h3>
                      <p className="text-sm text-gray-600">Save quick reflections after tough lessons or chats.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openReflectionModal()}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-blue text-white px-3 py-2 text-sm font-semibold hover:bg-brand-blue/90 focus-ring"
                    >
                      <Sparkles className="h-4 w-4" />
                      Add reflection
                    </button>
                  </div>
                  {reflections.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-gray-600">
                      No reflections yet. Capture one after your next lesson or when something feels tricky.
                    </div>
                  )}
                  <div className="space-y-3">
                    {reflections.slice(0, 3).map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {entry.questionId === 'what_learned'
                              ? 'What I learned'
                              : entry.questionId === 'try_next'
                                ? 'What I will try next'
                                : 'Confidence check'}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500">
                            <span>{formatAgo(entry.createdAt)}</span>
                            <label className="inline-flex items-center gap-1 text-[11px]">
                              <input
                                type="checkbox"
                                checked={Boolean(entry.shareWithParent)}
                                onChange={(e) => void handleToggleReflectionShare(entry.id, e.target.checked)}
                              />
                              <span>Share</span>
                            </label>
                          </div>
                        </div>
                        <p className="text-sm text-gray-800 mt-1">{entry.responseText}</p>
                        {entry.subject && (
                          <p className="mt-1 text-[11px] text-gray-500">Subject: {entry.subject}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Today's Focus</h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Target className="h-4 w-4" />
                      <span>
                        {subjectFilter === 'all'
                          ? `${todaysPlan.length} lessons queued`
                          : `${filteredPlan.length} in ${formatSubjectLabel(subjectFilter)}`}
                      </span>
                    </div>
                  </div>
                  {!showSkeleton && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mb-4">
                      <div className="inline-flex items-center gap-2 font-semibold text-brand-teal">
                        <Target className="h-4 w-4" />
                        <span>
                          {todaysPlanProgress.completed}/{todaysPlanProgress.total} done
                        </span>
                      </div>
                      <div className="flex-1 min-w-[160px] h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-teal to-brand-blue transition-all"
                          style={{ width: `${todaysPlanProgress.pct}%` }}
                        />
                      </div>
                      <div className="inline-flex items-center gap-1 text-gray-500">
                        <span>Plan streak {microPlanStreakDays}d</span>
                        <span className="text-gray-300">•</span>
                        <span>Login {quickStats?.streakDays ?? student.streakDays}d</span>
                        <span className="text-gray-300">•</span>
                        <span>{quickStats?.totalXp ?? student.xp} XP</span>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(['all', ...SUBJECTS] as Array<Subject | 'all'>).map((subject) => {
                      const active = subjectFilter === subject;
                      const label =
                        subject === 'all' ? 'All subjects' : formatSubjectLabel(subject as Subject);
                      return (
                        <button
                          key={subject}
                          type="button"
                          onClick={() => setSubjectFilter(subject)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            active
                              ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
                              : 'border-gray-200 text-gray-700 hover:border-brand-blue/60'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {showSkeleton ? (
                    <div className="space-y-4">
                      <SkeletonCard className="h-24" />
                      <SkeletonCard className="h-24" />
                      <SkeletonCard className="h-24" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredPlan.map((lesson, index) => (
                        <motion.div
                          key={lesson.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + index * 0.08 }}
                          className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow ${
                            activeLessonId === lesson.id ? 'border-brand-teal shadow-lg' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-4">
                            <div
                              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                lesson.status === 'completed' ? 'bg-green-100' : 'bg-gray-100'
                              }`}
                            >
                              {lesson.status === 'completed' ? (
                                <CheckCircle className="h-6 w-6 text-green-600" />
                              ) : (
                                <Play className="h-6 w-6 text-gray-600" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{lesson.title}</h4>
                              <div className="flex items-center space-x-3 text-sm text-gray-600">
                                <span className="capitalize">{formatSubjectLabel(lesson.subject)}</span>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    lesson.difficulty === 'easy'
                                      ? 'bg-green-100 text-green-800'
                                      : lesson.difficulty === 'medium'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {lesson.difficulty}
                                </span>
                              </div>
                              {lesson.suggestionReason && (
                                <p className="text-xs text-brand-blue mt-1">{lesson.suggestionReason}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between md:justify-end md:space-x-4 w-full md:w-auto">
                            <div className="text-right">
                              <div className="text-sm font-medium text-brand-teal">
                                +{lesson.xpReward} XP
                              </div>
                              {lesson.dueAt && (
                                <div className="text-xs text-gray-500">
                                  Due{' '}
                                  {new Date(lesson.dueAt).toLocaleTimeString([], {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </div>
                              )}
                            </div>
                            {lesson.status !== 'completed' && (
                              <button
                                onClick={() => handleStartLesson(lesson)}
                                className="bg-brand-teal text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-blue transition-colors"
                              >
                                Start
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                      {filteredPlan.length === 0 && (
                        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                          <p className="text-sm text-gray-600">
                            {subjectFilter === 'all'
                              ? 'Your AI coach will assign fresh lessons after you complete the diagnostic.'
                              : `No ${formatSubjectLabel(subjectFilter)} lessons queued today—check another subject or refresh recommendations.`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="bg-white rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Today&apos;s practice & activities</h3>
                    <div className="text-xs text-gray-500">
                      {extensionActivities.length} home extension{extensionActivities.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  {showSkeleton ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <SkeletonCard className="h-28" />
                      <SkeletonCard className="h-28" />
                    </div>
                  ) : todayActivities.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {todayActivities.slice(0, 4).map((activity) => (
                        <div
                          key={activity.id}
                          className="p-4 rounded-xl border border-gray-200 bg-slate-50 hover:border-brand-blue/40 transition-colors"
                        >
                          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-gray-500">
                            <span className="font-semibold text-brand-blue">
                              {describeActivityType(activity.activityType)}
                            </span>
                            {activity.estimatedMinutes ? (
                              <span>~{activity.estimatedMinutes} min</span>
                            ) : null}
                          </div>
                          <h4 className="text-sm font-semibold text-gray-900 mt-1">{activity.title}</h4>
                          {activity.description && (
                            <p className="text-xs text-gray-600 mt-1 line-clamp-3">{activity.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            {activity.homeExtension && (
                              <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                                Home extension
                              </span>
                            )}
                            {activity.standards && activity.standards[0] && (
                              <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                                {activity.standards[0]}
                              </span>
                            )}
                            {activity.skills && activity.skills[0] && (
                              <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                                {activity.skills[0].replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                          {activity.url && (
                            <a
                              href={activity.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-xs font-semibold text-brand-blue hover:underline mt-3"
                            >
                              Open activity ↗
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-sm text-gray-600">
                      We&apos;ll drop in practice and extension activities once your plan refreshes.
                    </div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Weekly Activity Pulse</h3>
                    <div className="flex items-center text-sm text-gray-500 space-x-2">
                      <Sparkles className="h-4 w-4" />
                      <span>Adaptive streak insights</span>
                    </div>
                  </div>
                  <div className="h-64">
                    {showSkeleton ? (
                      <SkeletonCard className="h-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={activityChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#EEF2FF" />
                          <XAxis dataKey="label" stroke="#6B7280" />
                          <YAxis stroke="#6B7280" />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', borderColor: '#E5E7EB' }}
                            labelStyle={{ color: '#1F2937', fontWeight: 600 }}
                          />
                          <defs>
                            <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#33D9C1" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#33D9C1" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="minutes"
                            stroke="#33D9C1"
                            fill="url(#activityGradient)"
                            strokeWidth={3}
                            dot={{ r: 4 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Study Skills & Executive Functioning</h3>
                      <p className="text-sm text-gray-600">
                        Short, safe routines to plan, focus, and get ready for learning.
                      </p>
                    </div>
                    <Link
                      to="/catalog?subject=study_skills"
                      className="text-sm font-semibold text-brand-blue hover:underline"
                    >
                      Browse all
                    </Link>
                  </div>
                  <div className="flex overflow-x-auto gap-3 pb-2 -mx-1 px-1">
                    {studySkillsModules.map((module) => (
                      <div
                        key={module.id}
                        className="min-w-[240px] bg-gradient-to-br from-white to-brand-light-blue/30 border border-slate-100 rounded-xl p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="font-semibold text-brand-blue">{module.duration}</span>
                          <span className="px-2 py-1 rounded-full bg-brand-light-teal/60 text-brand-teal font-semibold">
                            Grades {module.gradeBand}
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-900 mt-2">{module.title}</h4>
                        <p className="text-xs text-gray-600 line-clamp-3 mt-1">{module.description}</p>
                        <p className="text-[11px] text-gray-500 mt-2">
                          {formatSubjectLabel(module.subject)} • {module.habit}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[11px] text-gray-600">{module.focus}</span>
                          <Link
                            to={module.ctaPath ?? '/catalog'}
                            className="inline-flex items-center px-2 py-1 rounded-md bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue/90"
                          >
                            Start
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.52 }}
                  className="bg-white rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-gray-900">Writing Coach (ELA)</h3>
                    <span className="text-xs text-gray-500">Feedback stays on this device</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">
                    {writingPrompt}
                  </p>
                  <textarea
                    value={writingResponse}
                    onChange={(event) => {
                      setWritingResponse(event.target.value);
                      setWritingFeedback(null);
                    }}
                    rows={4}
                    placeholder="Draft 3-4 sentences here..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Keep names or personal details out. Focus on clear steps and what you learned.
                    </p>
                    <button
                      type="button"
                      onClick={handleWritingSubmit}
                      className="inline-flex items-center px-3 py-2 rounded-lg bg-brand-blue text-white text-sm font-semibold hover:bg-brand-blue/90"
                    >
                      Get feedback
                    </button>
                  </div>
                  {writingFeedback && (
                    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      {writingFeedback}
                    </div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.58 }}
                  className="bg-white rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Upcoming Milestones</h3>
                    <div className="flex items-center text-sm text-gray-500 space-x-2">
                      <Sparkles className="h-4 w-4" />
                      <span>Stay assessment-ready</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {(dashboard?.upcomingAssessments ?? []).map((assessment) => (
                      <div
                        key={assessment.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border border-gray-200 rounded-xl"
                      >
                        <div>
                          <h4 className="font-semibold text-gray-900">{assessment.title}</h4>
                          <p className="text-sm text-gray-600">
                            {assessment.scheduledAt
                              ? `Scheduled ${new Date(assessment.scheduledAt).toLocaleString([], {
                                  weekday: 'short',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}`
                              : 'Flexible timing'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                              assessment.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : assessment.status === 'overdue'
                                ? 'bg-rose-100 text-rose-600'
                                : 'bg-blue-100 text-blue-600'
                            }`}
                          >
                            {assessment.status === 'completed'
                              ? 'Completed'
                              : assessment.status === 'overdue'
                              ? 'Overdue'
                              : 'Scheduled'}
                          </span>
                          {assessment.masteryTarget && (
                            <div className="text-xs text-gray-500 mt-1">
                              Target mastery: {assessment.masteryTarget}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {(dashboard?.upcomingAssessments?.length ?? 0) === 0 && (
                      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                        <p className="text-sm text-gray-600">
                          No assessments scheduled yet. Complete today's focus to unlock your next diagnostic.
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-r from-brand-teal to-brand-blue rounded-2xl p-6 text-white"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">My Journey</p>
                      <h3 className="text-2xl font-bold">Your learning path</h3>
                      <p className="text-sm text-white/90">
                        See how today&apos;s plan ladders up to the skills we&apos;re prioritizing.
                      </p>
                      <ul className="text-sm space-y-2">
                        {(journeyNarrative.length
                          ? journeyNarrative
                          : ['Adaptive recommendations will appear after your next check-in.']
                        )
                          .slice(0, 3)
                          .map((tip, idx) => (
                            <li key={idx} className="flex items-start space-x-2">
                              <Sparkles className="h-4 w-4 mt-0.5" />
                              <span>{tip}</span>
                            </li>
                          ))}
                      </ul>
                      <div className="flex flex-wrap gap-3">
                        {recommendedLesson && (
                          <button
                            onClick={() => handleStartLesson(recommendedLesson)}
                            className="inline-flex items-center space-x-2 bg-white text-brand-blue px-4 py-2 rounded-xl font-semibold hover:bg-gray-100 transition-colors focus-ring"
                          >
                            <ArrowRight className="h-4 w-4" />
                            <span>Start recommended lesson</span>
                          </button>
                        )}
                        <button
                          onClick={() => setActiveTab('today')}
                          className="inline-flex items-center space-x-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-semibold transition-colors focus-ring"
                        >
                          <Target className="h-4 w-4" />
                          <span>Back to Today</span>
                        </button>
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4 min-w-[220px] space-y-2">
                      <div className="flex items-center space-x-2 text-sm font-semibold">
                        <Flag className="h-4 w-4 text-white" />
                        <span>Focus areas</span>
                      </div>
                      {(journeyFocusAreas.length
                        ? journeyFocusAreas
                        : ['We will pick a focus after your next diagnostic.']
                      )
                        .slice(0, 3)
                        .map((area, index) => (
                          <p key={index} className="text-sm text-white/90 flex items-center space-x-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-white/80" />
                            <span>{area}</span>
                          </p>
                        ))}
                      {journeyStrengths.length > 0 && (
                        <div className="pt-2 border-t border-white/20">
                          <p className="text-xs uppercase tracking-wide text-white/70 mb-1">Strengths</p>
                          {journeyStrengths.slice(0, 2).map((strength, index) => (
                            <p key={index} className="text-sm text-white/90">
                              {strength}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Path by subject</h3>
                    <div className="text-sm text-gray-500">Peek ahead at upcoming modules</div>
                  </div>
                  {showSkeleton ? (
                    <div className="space-y-3">
                      <SkeletonCard className="h-20" />
                      <SkeletonCard className="h-20" />
                    </div>
                  ) : journeyGroups.length ? (
                    <div className="space-y-5">
                      {journeyGroups.map((group) => (
                        <div key={group.subject} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 rounded-full bg-brand-light-teal text-brand-teal flex items-center justify-center font-semibold">
                                {group.label.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{group.label}</p>
                                <p className="text-xs text-gray-500">{group.items.length} steps ahead</p>
                              </div>
                            </div>
                            <span className="text-xs text-gray-500">Stay on track</span>
                          </div>
                          <div className="flex overflow-x-auto gap-3 pb-2">
                            {group.items.map((item, index) => (
                              <div
                                key={item.id}
                                className="min-w-[230px] bg-gradient-to-br from-white to-brand-light-blue/30 border border-slate-100 rounded-xl p-4 shadow-sm"
                              >
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                  <span>Level {index + 1}</span>
                                  <span
                                    className={`px-2 py-1 rounded-full font-semibold ${PATH_STATUS_STYLES[item.status]}`}
                                  >
                                    {PATH_STATUS_LABELS[item.status]}
                                  </span>
                                </div>
                                <h4 className="font-semibold text-gray-900 truncate">{item.topic}</h4>
                                <p className="text-xs text-brand-blue mt-1">{item.concept}</p>
                                <p className="text-xs text-gray-500 mt-2">
                                  {formatSubjectLabel(item.subject)} • {item.xpReward} XP
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                      <p className="text-sm text-gray-600">
                        We’ll display your personalized path once you complete the diagnostic.
                      </p>
                    </div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Peek ahead</h3>
                    <div className="text-xs text-gray-500">Preview, then return to today&apos;s pick</div>
                  </div>
                  {showSkeleton ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SkeletonCard className="h-24" />
                      <SkeletonCard className="h-24" />
                    </div>
                  ) : journeyPeekAhead.length ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {journeyPeekAhead.map((item, index) => (
                        <div key={item.id} className="border border-gray-200 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-gray-900">{item.topic}</h4>
                            <span
                              className={`text-[11px] px-2 py-1 rounded-full font-semibold ${PATH_STATUS_STYLES[item.status]}`}
                            >
                              {PATH_STATUS_LABELS[item.status]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">{formatSubjectLabel(item.subject)}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Level {index + 1} • {item.xpReward} XP
                          </p>
                          <p className="text-xs text-brand-blue mt-2">
                            {item.concept || 'Adaptive practice'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                      <p className="text-sm text-gray-600">
                        Peek-ahead previews unlock after your first set of recommendations.
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-4">
                    We’ll keep nudging you toward {recommendedLesson ? `"${recommendedLesson.title}"` : "today's focus"} first.
                  </p>
                </motion.div>
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Subject Mastery</h3>
              <div className="space-y-4">
                {showSkeleton
                  ? [0, 1, 2, 3].map((idx) => <SkeletonCard key={idx} className="h-16" />)
                  : masteryDisplay.map((subject) => (
                      <div key={subject.subject}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="h-4 w-4 text-brand-blue" />
                            <span className="font-semibold text-gray-900">{subject.label}</span>
                          </div>
                          <span className="text-sm text-gray-600">
                            {Math.round(subject.mastery)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-brand-teal to-brand-blue h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(subject.mastery, 100)}%` }}
                          />
                        </div>
                        {subject.goal && (
                          <p className="text-xs text-gray-500 mt-1">
                            Goal {subject.goal}% · Cohort avg {subject.cohortAverage ?? '—'}%
                          </p>
                        )}
                      </div>
                    ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">Boost Reading This Week</h3>
              <p className="text-sm text-gray-600 mb-3">
                One-minute comprehension check. No responses leave this page.
              </p>
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                {readingSet.passage}
              </div>
              <p className="text-sm font-semibold text-gray-900 mt-3">{readingSet.question}</p>
              <div className="space-y-2 mt-2">
                {readingSet.options.map((option, index) => {
                  const isSelected = readingAnswer === index;
                  const isCorrect = readingAnswer != null && index === readingSet.answer;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleReadingSelect(index)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                        isSelected
                          ? isCorrect
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-rose-300 bg-rose-50 text-rose-700'
                          : 'border-slate-200 hover:border-brand-blue/50'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {readingFeedback && (
                <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {readingFeedback}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">My Achievements</h3>
                  <p className="text-sm text-gray-600">Badges by subject, streaks, and milestones.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAchievementFilter('all')}
                    className={`px-3 py-1 rounded-full border ${
                      achievementFilter === 'all'
                        ? 'bg-brand-blue text-white border-brand-blue'
                        : 'border-gray-200 text-gray-700 hover:border-brand-blue/60'
                    }`}
                  >
                    All
                  </button>
                  {badgeCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setAchievementFilter(category as BadgeCategory)}
                      className={`px-3 py-1 rounded-full border ${
                        achievementFilter === category
                          ? 'bg-brand-teal text-white border-brand-teal'
                          : 'border-gray-200 text-gray-700 hover:border-brand-teal/60'
                      }`}
                    >
                      {category === 'math' ||
                      category === 'english' ||
                      category === 'science' ||
                      category === 'social_studies' ||
                      category === 'study_skills'
                        ? formatSubjectLabel(category as Subject)
                        : category === 'general'
                        ? 'General'
                        : (category as string).replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              {showSkeleton ? (
                <div className="space-y-4">
                  <SkeletonCard className="h-20" />
                  <SkeletonCard className="h-20" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredBadges.slice(0, 6).map((badge, index) => (
                    <motion.div
                      key={badge.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.08 }}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{badge.icon}</div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{badge.name}</h4>
                          <p className="text-sm text-gray-600">{badge.description}</p>
                          <p className="text-xs text-gray-400">
                            {badge.earnedAt ? new Date(badge.earnedAt).toLocaleString() : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-brand-light-teal text-brand-teal font-semibold">
                          {(badge.category ?? 'general').replace('_', ' ')}
                        </span>
                        <div className="text-[11px] text-gray-500 mt-1 capitalize">{badge.rarity}</div>
                      </div>
                    </motion.div>
                  ))}
                  {filteredBadges.length === 0 && (
                    <p className="text-sm text-gray-600">
                      Your next badge is within reach—complete lessons to unlock it.
                    </p>
                  )}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-brand-light-blue/40"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">AI Tutor Persona</h3>
                  <p className="text-sm text-gray-600">
                    Meet your tutor—pick a persona and name. They are a helper, not your teacher, and won’t help you cheat.
                  </p>
                  {personalizationError && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mt-2">
                      {personalizationError}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Bot className="h-4 w-4 text-brand-blue" />
                  <span>
                    {(tutorNameInput.trim() || student.tutorName || 'Tutor').slice(0, 22)} •{' '}
                    {selectedTutorPersona?.name ?? 'Persona'}
                  </span>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-1 space-y-3">
                  <label className="block text-sm font-semibold text-gray-800">
                    Tutor name
                    <input
                      type="text"
                      value={tutorNameInput}
                      onChange={(e) => setTutorNameInput(e.target.value)}
                      placeholder="e.g., Coach Sky"
                      maxLength={24}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
                    />
                  </label>
                  <p className="text-xs text-gray-500">
                    We filter names for classroom safety. Leave blank to keep the default.
                  </p>
                  {tutorNameError && (
                    <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-2 py-1">
                      {tutorNameError}
                    </p>
                  )}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: selectedPersonaPalette.background }}
                      >
                        <span className="text-lg" aria-hidden>
                          {selectedPersonaIcon}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {tutorNameInput.trim() || student.tutorName || 'Your tutor'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {selectedTutorPersona?.constraints ?? 'Short, safe guidance for every answer.'}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Your tutor will introduce with this name and keep a {describeTutorTone(selectedTutorPersona?.tone).toLowerCase()} tone.
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1 italic">Example: “{personaPreviewLine}”</p>
                  </div>
                </div>
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {personalizationLoading && (
                    <div className="col-span-2 text-sm text-gray-500">Loading personas…</div>
                  )}
                  {!personalizationLoading &&
                    tutorPersonas.map((persona) => {
                      const metadata = (persona.metadata ?? {}) as Record<string, unknown>;
                      const palette = parsePalette(metadata);
                      const icon = typeof metadata.icon === 'string' ? metadata.icon : '🧠';
                      const sample =
                        (persona.sample_replies?.find((reply) => typeof reply === 'string') as string | undefined) ??
                        persona.prompt_snippet ??
                        persona.constraints ??
                        '';
                      const isSelected = tutorPersonaId === persona.id;
                      return (
                        <button
                          key={persona.id}
                          type="button"
                          onClick={() => handleSelectTutorPersona(persona.id)}
                          className={`flex items-start gap-3 rounded-xl border p-3 text-left transition shadow-sm ${
                            isSelected
                              ? 'border-brand-blue ring-2 ring-brand-blue/30 bg-brand-light-blue/30'
                              : 'border-gray-200 hover:border-brand-blue/50 bg-white'
                          }`}
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: palette.background }}
                          >
                            <span aria-hidden className="text-lg">
                              {icon}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{persona.name}</span>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">
                                {describeTutorTone(persona.tone)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600">
                              {persona.constraints ?? persona.prompt_snippet ?? 'Safe, on-task assistant.'}
                            </p>
                            {sample && <p className="text-[11px] text-gray-500 line-clamp-2">“{sample}”</p>}
                          </div>
                        </button>
                      );
                    })}
                  {!personalizationLoading && !tutorPersonas.length && (
                    <p className="text-sm text-gray-600">No tutor personas are available right now.</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRandomizeTutorPersona}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-brand-blue/60 focus-ring"
                >
                  <Sparkles className="h-4 w-4 text-brand-violet" />
                  Surprise me
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveTutorPersona()}
                  disabled={
                    tutorSaving ||
                    personalizationLoading ||
                    !tutorPersonaId ||
                    (!!tutorNameError && tutorNameInput.trim().length > 0)
                  }
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                    tutorSaving ||
                    personalizationLoading ||
                    !tutorPersonaId ||
                    (!!tutorNameError && tutorNameInput.trim().length > 0)
                      ? 'bg-gray-200 text-gray-500'
                      : 'bg-brand-blue text-white hover:bg-brand-blue/90'
                  }`}
                >
                  {tutorSaving ? 'Saving...' : 'Save tutor look'}
                </button>
                {tutorFeedback && (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                    {tutorFeedback}
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
              id="avatar-lab"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Avatar Lab</h3>
                  <p className="text-sm text-gray-600">Student-only looks unlocked with XP and streaks.</p>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Palette className="h-4 w-4 text-brand-violet" />
                  <span>Equipped: {equippedAvatarId}</span>
                </div>
              </div>
              <div className="flex overflow-x-auto gap-3 pb-2 -mx-1 px-1">
                {personalizationLoading && (
                  <div className="text-sm text-gray-500 px-2 py-1">Loading avatars…</div>
                )}
                {!personalizationLoading &&
                  studentAvatarOptions.map((option) => {
                    const unlocked = isAvatarUnlocked(option);
                    const isEquipped = equippedAvatarId === option.id;
                    const requirementParts: string[] = [];
                    if (option.minXp) requirementParts.push(`${option.minXp} XP`);
                    if (option.requiredStreak) requirementParts.push(`${option.requiredStreak}-day streak`);
                    const requirementText = requirementParts.length
                      ? `Requires ${requirementParts.join(' • ')}`
                      : 'Starter look';
                    return (
                      <div
                        key={option.id}
                        className="min-w-[220px] rounded-xl border border-slate-200 bg-gradient-to-br from-white to-brand-light-blue/30 p-4 shadow-sm"
                        style={{ borderColor: isEquipped ? '#22c55e' : undefined }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-2xl">{option.icon}</div>
                          <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                            {option.rarity ?? 'starter'}
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-900 mt-2">{option.label}</h4>
                        <p className="text-xs text-gray-600 line-clamp-3">{option.description}</p>
                        <p className="text-[11px] text-gray-500 mt-2">{requirementText}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: option.palette.background }}
                          >
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: option.palette.accent }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleEquipAvatar(option)}
                            disabled={!unlocked || avatarSaving}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                              isEquipped
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : unlocked && !avatarSaving
                                  ? 'bg-brand-blue text-white'
                                  : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {isEquipped
                              ? 'Equipped'
                              : avatarSaving && !isEquipped
                                ? 'Saving...'
                                : unlocked
                                  ? 'Equip'
                                  : 'Locked'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
              {avatarFeedback && (
                <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {avatarFeedback}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
              className="bg-gradient-to-br from-brand-light-violet to-white rounded-2xl p-6 shadow-sm border border-brand-light-violet/40"
            >
              <div className="flex items-center space-x-3 mb-4">
                <Sparkles className="h-5 w-5 text-brand-violet" />
                <h3 className="text-xl font-bold text-gray-900">AI Insights</h3>
              </div>
              <div className="space-y-3">
                {(dashboard?.aiRecommendations ?? []).map((tip, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 bg-white/80 border border-white rounded-xl p-3 shadow-sm"
                  >
                    <div className="mt-1 text-brand-violet">✶</div>
                    <p className="text-sm text-gray-700">{tip}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-brand-violet" />
                  <h3 className="text-xl font-bold text-gray-900">Celebration Moments</h3>
                </div>
                <div className="text-xs text-gray-500">Share wins with your family</div>
              </div>
              <div className="space-y-3">
                {celebrationMoments.map((moment) => (
                  <div
                    key={moment.id}
                    className="flex items-start justify-between gap-3 p-3 border border-gray-200 rounded-xl"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{moment.title}</p>
                      <p className="text-xs text-gray-600">{moment.description}</p>
                      <p className="text-[11px] text-gray-400">
                        {new Date(moment.occurredAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        trackEvent('celebration_share', { studentId: student.id, momentId: moment.id })
                      }
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue/90"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>{moment.notifyParent ? 'Share with family' : 'Celebrate'}</span>
                    </button>
                  </div>
                ))}
                {celebrationMoments.length === 0 && (
                  <p className="text-sm text-gray-600">
                    Complete today's mission to unlock a celebration.
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
              <h3 className="text-xl font-bold text-gray-900 mb-6">XP Timeline</h3>
              <div className="space-y-4">
                {(dashboard?.xpTimeline ?? []).map((event) => (
                  <div key={event.date} className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-full bg-brand-light-teal flex items-center justify-center text-brand-teal font-semibold">
                      +{event.xpEarned}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{event.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(event.date).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {reflectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reflection</p>
                <h4 className="text-lg font-bold text-gray-900">Jot a quick takeaway</h4>
                <p className="text-sm text-gray-600">Takes &lt;10s. Share with family if you want.</p>
              </div>
              <button
                onClick={() => {
                  setReflectionModalOpen(false);
                  trackEvent('reflection_skipped', { reason: 'skip' });
                }}
                className="p-1 rounded-full hover:bg-slate-100 focus-ring"
                aria-label="Close reflection"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-800">
                Prompt
                <select
                  value={reflectionQuestion}
                  onChange={(e) => setReflectionQuestion(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
                >
                  <option value="what_learned">What did you learn?</option>
                  <option value="try_next">What will you try next time?</option>
                  <option value="confidence">How confident do you feel? (Low / Medium / High)</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-gray-800">
                Your takeaway
                <textarea
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                  maxLength={220}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
                  placeholder="One thing I’d try differently next time is..."
                />
              </label>
              <div className="flex items-center gap-2 text-sm">
                <input
                  id="reflection-share"
                  type="checkbox"
                  checked={reflectionShare}
                  onChange={(e) => setReflectionShare(e.target.checked)}
                />
                <label htmlFor="reflection-share" className="text-gray-700">
                  Share with parent/guardian
                </label>
              </div>
              {reflectionError && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-2 py-1">
                  {reflectionError}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setReflectionModalOpen(false);
                  trackEvent('reflection_skipped', { reason: 'skip' });
                }}
                className="text-sm font-semibold text-gray-600 hover:text-gray-800 focus-ring"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={() => void handleSaveReflectionEntry()}
                disabled={reflectionSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-blue text-white px-4 py-2 text-sm font-semibold hover:bg-brand-blue/90 focus-ring disabled:opacity-50"
              >
                {reflectionSaving ? 'Saving...' : 'Save reflection'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={<div className="px-4 py-8 text-sm text-gray-500">Loading assistant…</div>}>
        <LearningAssistant />
      </Suspense>
    </div>
  );
};

export default StudentDashboard;
  const renderCelebration = () => {
    if (!activeCelebration) return null;
    const isMission = activeCelebration.kind === 'mission';
    const isAvatar = activeCelebration.kind === 'avatar';
    const isLevel = activeCelebration.kind === 'level';
    const isStreak = activeCelebration.kind === 'streak';
    const icon = isLevel ? <Star className="h-5 w-5 text-amber-500" /> : isStreak ? <Flame className="h-5 w-5 text-orange-500" /> : isAvatar ? <Palette className="h-5 w-5 text-brand-violet" /> : <Trophy className="h-5 w-5 text-emerald-500" />;
    const primaryLabel =
      recommendedLesson && (isLevel || isStreak || isMission)
        ? 'Start next lesson'
        : isAvatar
          ? 'Change avatar'
          : 'View my journey';
    const onPrimaryClick = () => {
      trackEvent('celebration_cta_clicked', {
        kind: activeCelebration.kind,
        id: activeCelebration.id,
        cta: recommendedLesson && (isLevel || isStreak || isMission) ? 'start_lesson' : isAvatar ? 'avatar' : 'journey',
      });
      if (recommendedLesson && (isLevel || isStreak || isMission)) {
        handleStartLesson(recommendedLesson);
      } else if (isAvatar) {
        document.getElementById('avatar-lab')?.scrollIntoView({ behavior: 'smooth' });
        dismissCelebration(activeCelebration, 'cta');
      } else {
        setActiveTab('journey');
        dismissCelebration(activeCelebration, 'cta');
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-4 rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-emerald-50 p-4 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="mt-1">{icon}</div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{activeCelebration.title}</p>
                <p className="text-sm text-gray-700">{activeCelebration.description}</p>
                {activeCelebration.prompt && (
                  <p className="text-xs text-gray-600 mt-1">{activeCelebration.prompt}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissCelebration(activeCelebration, 'close')}
                className="text-gray-500 hover:text-gray-700 focus-ring rounded-full p-1"
                aria-label="Dismiss celebration"
              >
                X
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onPrimaryClick}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue/90 focus-ring"
              >
                <Sparkles className="h-4 w-4" />
                <span>{primaryLabel}</span>
              </button>
              {isAvatar && (
                <button
                  type="button"
                  onClick={() => {
                    trackEvent('celebration_cta_clicked', { kind: activeCelebration.kind, id: activeCelebration.id, cta: 'avatar' });
                    document.getElementById('avatar-lab')?.scrollIntoView({ behavior: 'smooth' });
                    dismissCelebration(activeCelebration, 'cta');
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:border-brand-violet/60 focus-ring"
                >
                  <Palette className="h-4 w-4 text-brand-violet" />
                  <span>Open Avatar Lab</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };
