import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    ArrowRight,
    BookOpen,
    Clock,
    Flame,
    Play,
    Settings,
    Sparkles,
    Star,
    Target,
    Trophy,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchStudentDashboardData } from '../../services/dashboardService';
import { updateLearningPreferences } from '../../services/profileService';
import { useStudentPath, useStudentStats } from '../../hooks/useStudentData';
import { formatSubjectLabel, normalizeSubject } from '../../lib/subjects';
import TutorOnboarding, { shouldShowTutorOnboarding } from './TutorOnboarding';
import WeeklyPlanCard from './WeeklyPlanCard';
import StudyModeSelector, { type StudyMode } from './StudyModeSelector';
import CelebrationSystem from './CelebrationSystem';
import type { DashboardLesson, Student, Subject } from '../../types';

// ============================================================================
// StudentDashboardSimplified
// A clean, focused dashboard that answers: "What should I do next?" and "How am I doing?"
// Target: ~500 lines max (vs 5,213 in the original)
// ============================================================================

// Subject color mapping for visual consistency
const SUBJECT_COLORS: Record<Subject | string, { bg: string; text: string; border: string }> = {
    math: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    english: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    science: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    social_studies: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    study_skills: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
    arts_music: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
    financial_literacy: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    health_pe: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    computer_science: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
};

const DEFAULT_SUBJECT_COLOR = { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };

/**
 * Get the color scheme for a subject. Normalizes raw subject strings first.
 */
const getSubjectColor = (subject: Subject | string | null | undefined) => {
    if (!subject) return DEFAULT_SUBJECT_COLOR;

    // Normalize the subject to handle raw strings like "English Language Arts"
    const normalized = normalizeSubject(subject);
    if (normalized && SUBJECT_COLORS[normalized]) {
        return SUBJECT_COLORS[normalized];
    }

    // Fallback: try direct lookup (for already normalized subjects)
    if (typeof subject === 'string' && SUBJECT_COLORS[subject]) {
        return SUBJECT_COLORS[subject];
    }

    return DEFAULT_SUBJECT_COLOR;
};

// ============================================================================
// Sub-components
// ============================================================================

interface WelcomeHeaderProps {
    name: string;
    xp: number;
    avatarId?: string | null;
}

interface WelcomeHeaderPropsExtended extends WelcomeHeaderProps {
    onCustomizeTutor?: () => void;
}

const WelcomeHeader: React.FC<WelcomeHeaderPropsExtended> = ({ name, xp, onCustomizeTutor }) => {
    const firstName = name?.split(' ')[0] || 'Learner';
    const today = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                    Welcome back, {firstName}! 👋
                </h1>
                <p className="text-slate-500 mt-1">{today}</p>
            </div>
            <div className="flex items-center gap-3">
                {/* Customize Tutor button */}
                {onCustomizeTutor && (
                    <button
                        type="button"
                        onClick={onCustomizeTutor}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Customize your AI tutor"
                    >
                        <Settings className="w-4 h-4" />
                        <span className="hidden sm:inline">Tutor</span>
                    </button>
                )}
                {/* XP Badge */}
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-full border border-indigo-100">
                    <Star className="w-5 h-5 text-indigo-600" />
                    <span className="font-semibold text-indigo-700">{xp.toLocaleString()} XP</span>
                </div>
                {/* Avatar placeholder */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {firstName.charAt(0).toUpperCase()}
                </div>
            </div>
        </div>
    );
};

interface TodaysFocusCardProps {
    lesson: DashboardLesson | null;
    isLoading: boolean;
}

const TodaysFocusCard: React.FC<TodaysFocusCardProps> = ({ lesson, isLoading }) => {
    const navigate = useNavigate();

    if (isLoading) {
        return (
            <div className="bg-white rounded-3xl border-2 border-slate-200 p-8 animate-pulse">
                <div className="h-4 w-24 bg-slate-200 rounded mb-4" />
                <div className="h-8 w-3/4 bg-slate-200 rounded mb-4" />
                <div className="h-4 w-1/2 bg-slate-200 rounded mb-6" />
                <div className="h-12 w-40 bg-slate-200 rounded-xl" />
            </div>
        );
    }

    if (!lesson) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border-2 border-emerald-200 p-8"
            >
                <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-6 h-6 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700 uppercase tracking-wide">
                        All Caught Up!
                    </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    Great work! You've completed today's lessons.
                </h2>
                <p className="text-slate-600 mb-6">
                    Check back tomorrow for new content, or explore the catalog for more to learn.
                </p>
                <Link
                    to="/catalog"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
                >
                    Explore More
                    <ArrowRight className="w-5 h-5" />
                </Link>
            </motion.div>
        );
    }

    const subjectColor = getSubjectColor(lesson.subject);
    const launchUrl = lesson.launchUrl || `/lesson/${lesson.id}`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-white rounded-3xl border-2 border-transparent p-8 overflow-hidden"
            style={{
                backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
            }}
        >
            {/* Decorative gradient orb */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-full opacity-30 blur-3xl pointer-events-none" />

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">
                        Today's Focus
                    </span>
                </div>

                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
                    {lesson.title}
                </h2>

                <div className="flex flex-wrap items-center gap-3 mb-6">
                    {/* Subject tag */}
                    <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${subjectColor.bg} ${subjectColor.text} border ${subjectColor.border}`}
                    >
                        {formatSubjectLabel(lesson.subject)}
                    </span>

                    {/* Duration estimate */}
                    <span className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Clock className="w-4 h-4" />
                        ~15 min
                    </span>

                    {/* XP reward */}
                    <span className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Sparkles className="w-4 h-4" />
                        +{lesson.xpReward} XP
                    </span>
                </div>

                <button
                    onClick={() => navigate(launchUrl)}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-lg rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                    <Play className="w-6 h-6" />
                    Start Lesson
                </button>
            </div>
        </motion.div>
    );
};

interface ProgressRingProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
    progress,
    size = 100,
    strokeWidth = 10,
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-500 ease-out"
            />
            <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
            </defs>
        </svg>
    );
};

interface WeeklyProgressCardProps {
    lessonsCompleted: number;
    lessonsTarget: number;
}

const WeeklyProgressCard: React.FC<WeeklyProgressCardProps> = ({
    lessonsCompleted,
    lessonsTarget,
}) => {
    const progressPercent = lessonsTarget > 0
        ? Math.min(Math.round((lessonsCompleted / lessonsTarget) * 100), 100)
        : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-1">
                        This Week
                    </p>
                    <p className="text-3xl font-bold text-slate-900">
                        {lessonsCompleted} <span className="text-lg text-slate-400 font-normal">of {lessonsTarget}</span>
                    </p>
                    <p className="text-sm text-slate-500 mt-1">lessons completed</p>
                </div>
                <div className="relative">
                    <ProgressRing progress={progressPercent} size={80} strokeWidth={8} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-bold text-indigo-600">{progressPercent}%</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

interface StreakCardProps {
    streakDays: number;
}

const StreakCard: React.FC<StreakCardProps> = ({ streakDays }) => {
    const isOnFire = streakDays >= 7;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`rounded-2xl border p-6 shadow-sm hover:shadow-md transition-shadow ${isOnFire
                ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'
                : 'bg-white border-slate-200'
                }`}
        >
            <div className="flex items-center gap-4">
                <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isOnFire ? 'bg-orange-100' : 'bg-slate-100'
                        }`}
                >
                    <Flame
                        className={`w-8 h-8 ${isOnFire ? 'text-orange-500 animate-gentle-pulse' : 'text-slate-400'}`}
                    />
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-1">
                        Current Streak
                    </p>
                    <p className={`text-3xl font-bold ${isOnFire ? 'text-orange-600' : 'text-slate-900'}`}>
                        {streakDays} <span className="text-lg font-normal">days</span>
                    </p>
                    {isOnFire && (
                        <p className="text-sm text-orange-600 mt-0.5">🔥 You're on fire!</p>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

interface RecentWinProps {
    title: string;
    description: string;
    icon?: React.ReactNode;
}

const RecentWin: React.FC<RecentWinProps> = ({ title, description, icon }) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-start gap-3 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100"
    >
        <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            {icon || <Trophy className="w-5 h-5" />}
        </div>
        <div>
            <p className="font-semibold text-slate-900">{title}</p>
            <p className="text-sm text-slate-600">{description}</p>
        </div>
    </motion.div>
);

interface UpNextListProps {
    lessons: DashboardLesson[];
    maxItems?: number;
}

const UpNextList: React.FC<UpNextListProps> = ({ lessons, maxItems = 3 }) => {
    if (!lessons.length) return null;

    const visibleLessons = lessons.slice(0, maxItems);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
        >
            <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-900">Coming Up Next</h3>
            </div>
            <div className="space-y-3">
                {visibleLessons.map((lesson, index) => {
                    const subjectColor = getSubjectColor(lesson.subject);
                    return (
                        <Link
                            key={lesson.id}
                            to={lesson.launchUrl || `/lesson/${lesson.id}`}
                            className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-500">
                                {index + 2}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                                    {lesson.title}
                                </p>
                                <span
                                    className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${subjectColor.bg} ${subjectColor.text}`}
                                >
                                    {formatSubjectLabel(lesson.subject)}
                                </span>
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                        </Link>
                    );
                })}
            </div>
            {lessons.length > maxItems && (
                <Link
                    to="/catalog"
                    className="block mt-4 text-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                    View all lessons →
                </Link>
            )}
        </motion.div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

const StudentDashboardSimplified: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const student = (user as Student) ?? null;
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Tutor onboarding modal state
    const [showTutorOnboarding, setShowTutorOnboarding] = useState(false);

    // Check if tutor onboarding should show on mount
    useEffect(() => {
        if (student?.id && shouldShowTutorOnboarding(student.id)) {
            // Small delay to let dashboard render first
            const timer = setTimeout(() => setShowTutorOnboarding(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [student?.id]);

    const handleOpenTutorOnboarding = useCallback(() => {
        setShowTutorOnboarding(true);
    }, []);

    const handleCloseTutorOnboarding = useCallback(() => {
        setShowTutorOnboarding(false);
    }, []);

    const handleTutorOnboardingComplete = useCallback(async () => {
        setShowTutorOnboarding(false);
        // Refresh user data to get updated preferences
        await refreshUser?.();
        // Invalidate any persona-related queries
        queryClient.invalidateQueries({ queryKey: ['tutor-persona'] }).catch(() => undefined);
    }, [refreshUser, queryClient]);

    // Fetch dashboard data
    const {
        data: dashboard,
        isLoading: dashboardLoading,
    } = useQuery({
        queryKey: ['student-dashboard', student?.id],
        queryFn: () => fetchStudentDashboardData({ ...(student as Student) }),
        enabled: Boolean(student),
        staleTime: 1000 * 60 * 2,
    });

    // Fetch student stats
    const { data: studentStats } = useStudentStats(student?.id);

    // Student path is fetched but we use todaysPlan from dashboard for lesson recommendations
    useStudentPath(student?.id);

    // Compute derived values
    const todaysFocus = useMemo(() => {
        // Priority: active lesson > first lesson in today's plan > first up-next entry
        if (dashboard?.activeLessonId && dashboard.todaysPlan) {
            const active = dashboard.todaysPlan.find((l) => l.id === dashboard.activeLessonId);
            if (active && active.status !== 'completed') return active;
        }
        const notStarted = dashboard?.todaysPlan?.find((l) => l.status === 'not_started');
        if (notStarted) return notStarted;
        const inProgress = dashboard?.todaysPlan?.find((l) => l.status === 'in_progress');
        if (inProgress) return inProgress;
        return null;
    }, [dashboard]);

    const upcomingLessons = useMemo(() => {
        if (!dashboard?.todaysPlan) return [];
        return dashboard.todaysPlan.filter(
            (l) => l.status !== 'completed' && l.id !== todaysFocus?.id
        );
    }, [dashboard?.todaysPlan, todaysFocus]);

    const lessonsThisWeek = useMemo(() => {
        if (!dashboard?.dailyActivity) return 0;
        return dashboard.dailyActivity.reduce((acc, day) => acc + (day.lessonsCompleted ?? 0), 0);
    }, [dashboard?.dailyActivity]);

    const weeklyTarget = dashboard?.parentGoals?.weeklyLessons ?? 5;
    const streakDays = studentStats?.streakDays ?? student?.streakDays ?? 0;
    const totalXp = studentStats?.xpTotal ?? student?.xp ?? 0;

    // Compute weekly minutes from daily activity
    const minutesThisWeek = useMemo(() => {
        if (!dashboard?.dailyActivity) return 0;
        return dashboard.dailyActivity.reduce((acc, day) => acc + (day.practiceMinutes ?? 0), 0);
    }, [dashboard?.dailyActivity]);

    // Get focus subject from diagnostic or balanced
    const focusSubject = useMemo(() => {
        if (student?.learningPreferences?.weeklyPlanFocus) {
            return student.learningPreferences.weeklyPlanFocus;
        }
        // If student has weaknesses, focus on the first one
        if (student?.weaknesses?.length) {
            const firstWeakness = student.weaknesses[0];
            const normalized = normalizeSubject(firstWeakness);
            if (normalized) return normalized as Subject;
        }
        return 'balanced' as const;
    }, [student?.learningPreferences?.weeklyPlanFocus, student?.weaknesses]);

    // Handle intensity change
    const handleIntensityChange = useCallback(
        async (intensity: 'light' | 'normal' | 'challenge') => {
            if (!student?.id) return;
            try {
                await updateLearningPreferences(student.id, {
                    weeklyPlanIntensity: intensity,
                });
                await refreshUser?.();
            } catch (err) {
                console.error('Failed to update intensity:', err);
            }
        },
        [student?.id, refreshUser]
    );

    // Handle focus change
    const handleFocusChange = useCallback(
        async (focus: Subject | 'balanced') => {
            if (!student?.id) return;
            try {
                await updateLearningPreferences(student.id, {
                    weeklyPlanFocus: focus,
                });
                await refreshUser?.();
            } catch (err) {
                console.error('Failed to update focus:', err);
            }
        },
        [student?.id, refreshUser]
    );

    // Handle study mode change
    const handleStudyModeChange = useCallback(
        async (mode: StudyMode) => {
            if (!student?.id) return;
            try {
                await updateLearningPreferences(student.id, {
                    studyMode: mode,
                    studyModeSetAt: new Date().toISOString(),
                });
                await refreshUser?.();
            } catch (err) {
                console.error('Failed to update study mode:', err);
            }
        },
        [student?.id, refreshUser]
    );

    // Loading state
    if (dashboardLoading && !dashboard) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 md:p-8 lg:p-12">
                <div className="max-w-4xl mx-auto">
                    <div className="animate-pulse space-y-8">
                        <div className="h-16 w-64 bg-slate-200 rounded-xl" />
                        <div className="h-64 bg-slate-200 rounded-3xl" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="h-32 bg-slate-200 rounded-2xl" />
                            <div className="h-32 bg-slate-200 rounded-2xl" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Redirect to onboarding if assessment not completed
    if (student && !student.assessmentCompleted) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 md:p-8 lg:p-12">
                <div className="max-w-2xl mx-auto text-center py-20">
                    <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Target className="w-10 h-10 text-indigo-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-4">
                        Let's personalize your learning!
                    </h1>
                    <p className="text-lg text-slate-600 mb-8">
                        Take a quick diagnostic assessment so we can create the perfect learning path for you.
                    </p>
                    <button
                        onClick={() => navigate('/student/onboarding')}
                        className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                        Start Assessment
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Celebration System */}
            <CelebrationSystem
                celebrations={dashboard?.celebrationMoments}
                currentLevel={student?.level}
                currentStreak={streakDays}
            />

            {/* Tutor Onboarding Modal */}
            <TutorOnboarding
                isOpen={showTutorOnboarding}
                onClose={handleCloseTutorOnboarding}
                onComplete={handleTutorOnboardingComplete}
                studentId={student?.id ?? ''}
                studentName={student?.name}
                currentPersonaId={student?.tutorAvatarId}
                currentTutorName={student?.tutorName}
            />

            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 md:p-8 lg:p-12">
                <div className="max-w-4xl mx-auto">
                    {/* Welcome Header */}
                    <WelcomeHeader
                        name={student?.name ?? 'Learner'}
                        xp={totalXp}
                        avatarId={student?.studentAvatarId}
                        onCustomizeTutor={handleOpenTutorOnboarding}
                    />

                    {/* Study Mode Selector */}
                    <section className="mb-6">
                        <StudyModeSelector
                            value={student?.learningPreferences?.studyMode ?? 'keep_up'}
                            onChange={handleStudyModeChange}
                            parentLocked={student?.learningPreferences?.studyModeLocked}
                            compact
                        />
                    </section>

                    {/* Weekly Plan Card */}
                    <section className="mb-8">
                        <WeeklyPlanCard
                            lessonsCompleted={lessonsThisWeek}
                            minutesCompleted={minutesThisWeek}
                            parentGoals={dashboard?.parentGoals}
                            preferences={student?.learningPreferences}
                            focusSubject={focusSubject}
                            nextLesson={todaysFocus}
                            hasPractice={Boolean(dashboard?.todaysPlan?.length)}
                            onIntensityChange={handleIntensityChange}
                            onFocusChange={handleFocusChange}
                            grade={student?.grade}
                        />
                    </section>

                    {/* Primary: Today's Focus */}
                    <section className="mb-8">
                        <TodaysFocusCard lesson={todaysFocus} isLoading={dashboardLoading} />
                    </section>

                    {/* Stats Row */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <WeeklyProgressCard
                            lessonsCompleted={lessonsThisWeek}
                            lessonsTarget={weeklyTarget}
                        />
                        <StreakCard streakDays={streakDays} />
                    </section>

                    {/* Up Next List */}
                    {upcomingLessons.length > 0 && (
                        <section className="mb-8">
                            <UpNextList lessons={upcomingLessons} maxItems={3} />
                        </section>
                    )}

                    {/* Recent Wins (if any celebrations) */}
                    {dashboard?.celebrationMoments && dashboard.celebrationMoments.length > 0 && (
                        <section>
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Wins 🎉</h3>
                            <div className="space-y-3">
                                {dashboard.celebrationMoments.slice(0, 2).map((moment) => (
                                    <RecentWin
                                        key={moment.id}
                                        title={moment.title}
                                        description={moment.description}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </>
    );
};

export default StudentDashboardSimplified;
