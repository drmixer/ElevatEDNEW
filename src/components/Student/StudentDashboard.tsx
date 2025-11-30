import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  Mission,
  Student,
  Subject,
} from '../../types';
const AssessmentFlow = lazy(() => import('./AssessmentFlow'));
const LearningAssistant = lazy(() => import('./LearningAssistant'));
import { fetchStudentDashboardData } from '../../services/dashboardService';
import trackEvent from '../../lib/analytics';
import type { AssessmentResult } from '../../services/assessmentService';
import { formatSubjectLabel, SUBJECTS } from '../../lib/subjects';
import { studySkillsModules } from '../../data/studySkillsModules';
import { saveStudentAvatar, saveTutorPersona } from '../../services/avatarService';
import { TUTOR_AVATARS, isStudentAvatarUnlocked } from '../../../shared/avatarManifests';
import { tutorNameErrorMessage, validateTutorName } from '../../../shared/nameSafety';

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

const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

const StudentDashboard: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const student = (user as Student) ?? null;
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const [activeView, setActiveView] = useState<'dashboard' | 'assessment' | 'lesson'>('dashboard');
  const [activeTab, setActiveTab] = useState<'today' | 'journey'>('today');
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'all'>('all');
  const [missionCadence, setMissionCadence] = useState<'daily' | 'weekly'>('daily');
  const [achievementFilter, setAchievementFilter] = useState<BadgeCategory | 'all'>('all');
  const [equippedAvatarId, setEquippedAvatarId] = useState<string>('avatar-starter');
  const [assessmentNarrative, setAssessmentNarrative] = useState<string[]>([]);
  const [assessmentFocusAreas, setAssessmentFocusAreas] = useState<string[]>([]);
  const [assessmentStrengths, setAssessmentStrengths] = useState<string[]>([]);
  const missingGuardian = !student?.parentId;
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
  const [tutorNameInput, setTutorNameInput] = useState<string>(student?.tutorName ?? '');
  const [tutorAvatarId, setTutorAvatarId] = useState<string>(student?.tutorAvatarId ?? TUTOR_AVATARS[0].id);
  const [tutorFeedback, setTutorFeedback] = useState<string | null>(null);
  const [tutorSaving, setTutorSaving] = useState(false);

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

  const showSkeleton = isLoading && !dashboard;

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
    setTutorNameInput(student.tutorName ?? '');
    setTutorAvatarId(student.tutorAvatarId ?? TUTOR_AVATARS[0].id);
  }, [student?.tutorName, student?.tutorAvatarId]);

  useEffect(() => {
    if (autoRoutedDiagnostic || !student) return;
    if (!dashboard?.quickStats.assessmentCompleted && !showSkeleton) {
      setActiveView('assessment');
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

  const isAvatarUnlocked = (option: AvatarOption) =>
    isStudentAvatarUnlocked(option, {
      xp: dashboard?.profile?.xp ?? student?.xp ?? 0,
      streakDays: dashboard?.profile?.streakDays ?? student?.streakDays ?? 0,
    });

  const selectedTutorAvatar = useMemo(
    () => TUTOR_AVATARS.find((option) => option.id === tutorAvatarId) ?? TUTOR_AVATARS[0],
    [tutorAvatarId],
  );

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

  const celebrationMoments = dashboard?.celebrationMoments ?? [];
  const avatarOptions = dashboard?.avatarOptions ?? [];

  const handleAssessmentComplete = async (result?: AssessmentResult | null) => {
    setActiveView('dashboard');
    setActiveTab('journey');
    if (result) {
      setAssessmentNarrative(result.planMessages ?? []);
      setAssessmentFocusAreas(result.weaknesses ?? []);
      setAssessmentStrengths(result.strengths ?? []);
    } else {
      setAssessmentNarrative([]);
      setAssessmentFocusAreas([]);
      setAssessmentStrengths([]);
    }
    trackEvent('assessment_complete_reroute', { studentId: student.id });
    await refetch({ throwOnError: false });
  };

  const todaysPlan = dashboard?.todaysPlan ?? [];
  const filteredPlan =
    subjectFilter === 'all'
      ? todaysPlan
      : todaysPlan.filter((lesson) => lesson.subject === subjectFilter);
  const todayActivities = dashboard?.todayActivities ?? [];
  const extensionActivities = todayActivities.filter((activity) => activity.homeExtension);
  const quickStats = dashboard?.quickStats;
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

  if (!student) {
    return null;
  }

  if (activeView === 'assessment') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-500">
            Loading assessment experience…
          </div>
        }
      >
        <AssessmentFlow onComplete={handleAssessmentComplete} />
      </Suspense>
    );
  }

  const journeyNarrative = assessmentNarrative.length
    ? assessmentNarrative
    : dashboard?.aiRecommendations ?? [];
  const journeyFocusAreas =
    assessmentFocusAreas.length > 0 ? assessmentFocusAreas : dashboard?.profile?.weaknesses ?? [];
  const journeyStrengths =
    assessmentStrengths.length > 0 ? assessmentStrengths : dashboard?.profile?.strengths ?? [];

  const handleRefresh = async () => {
    trackEvent('student_dashboard_refresh', { studentId: student.id });
    await refetch({ throwOnError: false });
  };

  const handleStartLesson = (lesson: DashboardLesson) => {
    trackEvent('lesson_start_click', {
      studentId: student.id,
      lessonId: lesson.id,
      status: lesson.status,
    });
    if (lesson.launchUrl) {
      window.open(lesson.launchUrl, '_blank', 'noopener');
    }
    setActiveView('lesson');
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

  const handleSaveTutorPersona = async () => {
    setTutorFeedback(null);
    const trimmedName = tutorNameInput.trim();
    const validation = trimmedName.length ? validateTutorName(trimmedName) : { ok: true, value: '', normalized: '' };
    if (!validation.ok) {
      setTutorFeedback(tutorNameErrorMessage(validation));
      return;
    }
    setTutorSaving(true);
    try {
      await saveTutorPersona({
        name: trimmedName.length ? validation.value : null,
        avatarId: tutorAvatarId,
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

  const handleRandomizeTutorAvatar = () => {
    const next = TUTOR_AVATARS[Math.floor(Math.random() * TUTOR_AVATARS.length)];
    setTutorAvatarId(next.id);
  };

  const handleEquipAvatar = async (option: AvatarOption) => {
    if (!isAvatarUnlocked(option)) {
      setAvatarFeedback('Keep working on missions to unlock this avatar.');
      return;
    }
    setAvatarSaving(true);
    setAvatarFeedback(null);
    try {
      await saveStudentAvatar(option.id);
      setEquippedAvatarId(option.id);
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
                    Ask your parent to create a parent account and link you with the family code shown on their screen.
                    Learners under 13 should have a parent present while using ElevatED.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => trackEvent('student_request_parent_link', { studentId: student.id })}
                  className="inline-flex items-center px-3 py-2 rounded-lg bg-brand-light-teal text-brand-teal text-sm font-semibold hover:bg-brand-light-teal/80"
                >
                  I will ask my parent
                </button>
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
                  {entitlements.planName ?? 'Family Free'} limit
                </p>
                <p className="text-xs text-amber-700">
                  You’ve completed {lessonsThisWeek} lesson{lessonsThisWeek === 1 ? '' : 's'} this
                  week. Family Free includes up to {entitlements.lessonLimit} lessons each month; we’ll
                  remind you before you run out.
                </p>
              </div>
              <div className="text-[11px] font-semibold text-amber-800 px-2 py-1 rounded-full bg-white/70 border border-amber-200">
                Plan: {entitlements.planSlug ?? 'family-free'}
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
                      {quickStats?.streakDays ?? student.streakDays}
                    </div>
                    <div className="text-sm text-gray-700">Day Streak</div>
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
                          onClick={() => setActiveView('assessment')}
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
                        <span>Streak {quickStats?.streakDays ?? student.streakDays}</span>
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
                          No assessments scheduled yet. Complete today’s focus to unlock your next diagnostic.
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
                    Name your tutor and pick a calm, school-safe avatar just for them.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Bot className="h-4 w-4 text-brand-blue" />
                  <span>
                    {(tutorNameInput.trim() || student.tutorName || 'Tutor').slice(0, 22)} • {selectedTutorAvatar.label}
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
                        style={{ backgroundColor: selectedTutorAvatar.palette.background }}
                      >
                        <span className="text-lg" aria-hidden>
                          {selectedTutorAvatar.icon}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {tutorNameInput.trim() || student.tutorName || 'Your tutor'}
                        </div>
                        <div className="text-xs text-gray-500">{selectedTutorAvatar.description}</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Your tutor will introduce with this name and keep a {selectedTutorAvatar.tone ?? 'calm'} tone.
                    </p>
                  </div>
                </div>
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TUTOR_AVATARS.map((avatar) => {
                    const isSelected = tutorAvatarId === avatar.id;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setTutorAvatarId(avatar.id)}
                        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition shadow-sm ${
                          isSelected
                            ? 'border-brand-blue ring-2 ring-brand-blue/30 bg-brand-light-blue/30'
                            : 'border-gray-200 hover:border-brand-blue/50 bg-white'
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: avatar.palette.background }}
                        >
                          <span aria-hidden className="text-lg">
                            {avatar.icon}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{avatar.label}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">
                              {avatar.tone ?? 'steady'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">{avatar.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRandomizeTutorAvatar}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-brand-blue/60 focus-ring"
                >
                  <Sparkles className="h-4 w-4 text-brand-violet" />
                  Surprise me
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveTutorPersona()}
                  disabled={tutorSaving || (!!tutorNameError && tutorNameInput.trim().length > 0)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                    tutorSaving || (!!tutorNameError && tutorNameInput.trim().length > 0)
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
                {avatarOptions.map((option) => {
                  const unlocked = isAvatarUnlocked(option);
                  const isEquipped = equippedAvatarId === option.id;
                  const requirementParts: string[] = [];
                  if (option.minXp) requirementParts.push(`${option.minXp} XP`);
                  if (option.requiredStreak) requirementParts.push(`${option.requiredStreak}-day streak`);
                  const requirementText = requirementParts.length ? `Requires ${requirementParts.join(' • ')}` : 'Starter look';
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
                    Complete today’s mission to unlock a celebration.
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

      <Suspense fallback={<div className="px-4 py-8 text-sm text-gray-500">Loading assistant…</div>}>
        <LearningAssistant />
      </Suspense>
    </div>
  );
};

export default StudentDashboard;
