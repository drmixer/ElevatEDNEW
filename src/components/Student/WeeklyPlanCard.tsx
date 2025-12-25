/**
 * WeeklyPlanCard - "This Week's Plan" Card
 *
 * Shows a simple, scannable plan for the week:
 * - Summary: "5 lessons • 60 minutes • focus: Math"
 * - Progress with visual bars
 * - Status chip: On track / Almost there / Behind
 * - "This week feels" intensity control
 * - Quick actions: Start next lesson, Quick practice
 */
import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen,
    ChevronRight,
    Clock,
    HelpCircle,
    Lightbulb,
    Play,
    Sparkles,
    Target,
    Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatSubjectLabel } from '../../lib/subjects';
import trackEvent from '../../lib/analytics';
import type { ChildGoalTargets, DashboardLesson, LearningPreferences, Subject } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface WeeklyPlanCardProps {
    /** Current lessons completed this week */
    lessonsCompleted: number;
    /** Current practice minutes this week */
    minutesCompleted: number;
    /** Parent-set goals or defaults */
    parentGoals?: ChildGoalTargets | null;
    /** Student's learning preferences */
    preferences?: LearningPreferences | null;
    /** Focus subject from diagnostic or parent goal */
    focusSubject?: Subject | 'balanced';
    /** Next recommended lesson */
    nextLesson?: DashboardLesson | null;
    /** Whether there's practice available */
    hasPractice?: boolean;
    /** Callback when intensity changes */
    onIntensityChange?: (intensity: 'light' | 'normal' | 'challenge') => void;
    /** Callback when focus changes */
    onFocusChange?: (focus: Subject | 'balanced') => void;
    /** Whether parent has locked the settings */
    parentLocked?: boolean;
    /** Whether diagnostic is incomplete */
    diagnosticIncomplete?: boolean;
    /** Grade for age-appropriate defaults */
    grade?: number;
}

type PlanStatus = 'on_track' | 'almost_there' | 'behind';
type PlanIntensity = 'light' | 'normal' | 'challenge';

// ============================================================================
// Constants
// ============================================================================

const INTENSITY_CONFIG: Record<PlanIntensity, { label: string; emoji: string; desc: string }> = {
    light: {
        label: 'Light',
        emoji: '🌿',
        desc: 'Lighter pace, focus on review',
    },
    normal: {
        label: 'Normal',
        emoji: '⚡',
        desc: 'Balanced pace, on track',
    },
    challenge: {
        label: 'Challenge',
        emoji: '🔥',
        desc: 'Push ahead, stretch goals',
    },
};

const STATUS_CONFIG: Record<PlanStatus, { label: string; color: string; bgColor: string }> = {
    on_track: {
        label: 'On track',
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50 border-emerald-200',
    },
    almost_there: {
        label: 'Almost there',
        color: 'text-amber-700',
        bgColor: 'bg-amber-50 border-amber-200',
    },
    behind: {
        label: 'Behind',
        color: 'text-red-700',
        bgColor: 'bg-red-50 border-red-200',
    },
};

const FOCUS_SUBJECTS: Array<Subject | 'balanced'> = [
    'balanced',
    'math',
    'english',
    'science',
    'social_studies',
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compute plan targets based on parent goals and intensity
 */
function computeTargets(
    parentGoals: ChildGoalTargets | null | undefined,
    intensity: PlanIntensity
): { lessons: number; minutes: number } {
    // Base from parent goals or defaults
    const baseLessons = parentGoals?.weeklyLessons ?? 5;
    const baseMinutes = parentGoals?.practiceMinutes ?? 60;

    // Adjust based on intensity
    const multipliers: Record<PlanIntensity, number> = {
        light: 0.8,
        normal: 1.0,
        challenge: 1.2,
    };

    const mult = multipliers[intensity];

    return {
        lessons: Math.round(baseLessons * mult),
        minutes: Math.round(baseMinutes * mult),
    };
}

/**
 * Compute plan status based on progress vs expected
 */
function computeStatus(
    lessonsCompleted: number,
    lessonsTarget: number
): PlanStatus {
    // Get current day of week (1 = Monday, 7 = Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // Convert Sun=0 to 7

    // Expected lessons by today
    const expectedLessons = Math.ceil(lessonsTarget * (dayOfWeek / 7));

    if (lessonsCompleted >= expectedLessons) {
        return 'on_track';
    } else if (lessonsCompleted >= expectedLessons - 1) {
        return 'almost_there';
    } else {
        return 'behind';
    }
}

// ============================================================================
// Sub-components
// ============================================================================

interface ProgressBarProps {
    current: number;
    target: number;
    label: string;
    unit: string;
    icon: React.ReactNode;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
    current,
    target,
    label,
    unit,
    icon,
}) => {
    const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    const isComplete = current >= target;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                    {icon}
                    <span>{label}</span>
                </div>
                <span className={`font-medium ${isComplete ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {current}{target > 0 && ` / ${target}`} {unit}
                </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={`h-full rounded-full ${isComplete
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                            : 'bg-gradient-to-r from-indigo-400 to-purple-500'
                        }`}
                />
            </div>
        </div>
    );
};

interface IntensitySelectorProps {
    value: PlanIntensity;
    onChange: (value: PlanIntensity) => void;
    disabled?: boolean;
    lockedMessage?: string;
}

const IntensitySelector: React.FC<IntensitySelectorProps> = ({
    value,
    onChange,
    disabled,
    lockedMessage,
}) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">This week feels:</span>
                {disabled && lockedMessage && (
                    <div className="group relative">
                        <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {lockedMessage}
                        </div>
                    </div>
                )}
            </div>
            <div className="flex gap-2">
                {(Object.entries(INTENSITY_CONFIG) as [PlanIntensity, typeof INTENSITY_CONFIG[PlanIntensity]][]).map(
                    ([key, config]) => {
                        const isSelected = value === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => !disabled && onChange(key)}
                                disabled={disabled}
                                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${isSelected
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : disabled
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                aria-pressed={isSelected}
                                aria-label={`${config.label} intensity: ${config.desc}`}
                            >
                                <span className="flex items-center justify-center gap-1">
                                    <span>{config.emoji}</span>
                                    <span>{config.label}</span>
                                </span>
                            </button>
                        );
                    }
                )}
            </div>
        </div>
    );
};

interface FocusSelectorProps {
    value: Subject | 'balanced';
    onChange: (value: Subject | 'balanced') => void;
    disabled?: boolean;
    lockedMessage?: string;
}

const FocusSelector: React.FC<FocusSelectorProps> = ({
    value,
    onChange,
    disabled,
    lockedMessage,
}) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Focus:</span>
                {disabled && lockedMessage && (
                    <div className="group relative">
                        <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {lockedMessage}
                        </div>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
                {FOCUS_SUBJECTS.map((subject) => {
                    const isSelected = value === subject;
                    const label = subject === 'balanced' ? 'Balanced' : formatSubjectLabel(subject);
                    return (
                        <button
                            key={subject}
                            type="button"
                            onClick={() => !disabled && onChange(subject)}
                            disabled={disabled}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${isSelected
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : disabled
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            aria-pressed={isSelected}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

const WeeklyPlanCard: React.FC<WeeklyPlanCardProps> = ({
    lessonsCompleted,
    minutesCompleted,
    parentGoals,
    preferences,
    focusSubject = 'balanced',
    nextLesson,
    hasPractice = false,
    onIntensityChange,
    onFocusChange,
    parentLocked = false,
    diagnosticIncomplete = false,
    grade = 5,
}) => {
    const navigate = useNavigate();
    const [showWhyPanel, setShowWhyPanel] = useState(false);

    // Local state for intensity (synced with preferences)
    const [intensity, setIntensity] = useState<PlanIntensity>(
        preferences?.weeklyPlanIntensity ?? 'normal'
    );
    const [focus, setFocus] = useState<Subject | 'balanced'>(
        preferences?.weeklyPlanFocus ?? focusSubject
    );

    // Compute targets based on intensity
    const targets = useMemo(
        () => computeTargets(parentGoals, intensity),
        [parentGoals, intensity]
    );

    // Compute status
    const status = useMemo(
        () => computeStatus(lessonsCompleted, targets.lessons),
        [lessonsCompleted, targets.lessons]
    );

    const statusConfig = STATUS_CONFIG[status];

    // Format focus label
    const focusLabel = focus === 'balanced' ? 'Balanced' : formatSubjectLabel(focus);

    // Handlers
    const handleIntensityChange = useCallback(
        (newIntensity: PlanIntensity) => {
            setIntensity(newIntensity);
            onIntensityChange?.(newIntensity);
            trackEvent('weekly_plan_intensity_changed', {
                from: intensity,
                to: newIntensity,
                parent_override: parentLocked,
            });
        },
        [intensity, onIntensityChange, parentLocked]
    );

    const handleFocusChange = useCallback(
        (newFocus: Subject | 'balanced') => {
            setFocus(newFocus);
            onFocusChange?.(newFocus);
            trackEvent('weekly_plan_focus_changed', {
                from: focus,
                to: newFocus,
                parent_override: parentLocked,
            });
        },
        [focus, onFocusChange, parentLocked]
    );

    const handleStartLesson = useCallback(() => {
        if (!nextLesson) return;
        const url = nextLesson.launchUrl || `/lesson/${nextLesson.id}`;
        trackEvent('weekly_plan_started_next', {
            lesson_id: nextLesson.id,
            subject: nextLesson.subject,
            plan_status: status,
        });
        navigate(url);
    }, [nextLesson, status, navigate]);

    // Track view
    React.useEffect(() => {
        trackEvent('weekly_plan_viewed', {
            source: 'dashboard',
            grade_band: grade <= 5 ? 'K-5' : grade <= 8 ? '6-8' : '9-12',
            parent_goal: Boolean(parentGoals),
        });
    }, [grade, parentGoals]);

    // Diagnostic incomplete state
    if (diagnosticIncomplete) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <Target className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900">This week's plan</h3>
                        <p className="text-sm text-slate-500">Complete your assessment first</p>
                    </div>
                </div>
                <p className="text-slate-600 mb-4">
                    Finish your diagnostic assessment so we can create the perfect learning plan for you.
                </p>
                <button
                    type="button"
                    onClick={() => navigate('/student/onboarding')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                >
                    <Target className="w-4 h-4" />
                    Start Assessment
                </button>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                        <Target className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900">This week's plan</h3>
                        <p className="text-sm text-slate-500">
                            {targets.lessons} lessons • {targets.minutes} min • focus: {focusLabel}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setShowWhyPanel(!showWhyPanel)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    aria-label="Why this plan?"
                    title="Why this plan?"
                >
                    <HelpCircle className="w-5 h-5" />
                </button>
            </div>

            {/* Why Panel */}
            <AnimatePresence>
                {showWhyPanel && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-start gap-2">
                                <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-slate-600">
                                    <p className="font-medium text-slate-900 mb-1">Why this plan?</p>
                                    {parentGoals ? (
                                        <p>Your parent set a goal of {parentGoals.weeklyLessons || 5} lessons per week.</p>
                                    ) : (
                                        <p>Based on the recommended pace for your grade level.</p>
                                    )}
                                    {focusSubject !== 'balanced' && (
                                        <p className="mt-1">
                                            Focus on {formatSubjectLabel(focusSubject as Subject)} based on your diagnostic results.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Status Chip */}
            <div className="mb-6">
                <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusConfig.bgColor} ${statusConfig.color}`}
                    role="status"
                    aria-label={`Plan status: ${statusConfig.label}`}
                >
                    {status === 'on_track' && <Sparkles className="w-4 h-4 mr-1.5" />}
                    {status === 'almost_there' && <Zap className="w-4 h-4 mr-1.5" />}
                    {statusConfig.label}
                </span>
            </div>

            {/* Progress Bars */}
            <div className="space-y-4 mb-6">
                <ProgressBar
                    current={lessonsCompleted}
                    target={targets.lessons}
                    label="Lessons"
                    unit="lessons"
                    icon={<BookOpen className="w-4 h-4" />}
                />
                <ProgressBar
                    current={minutesCompleted}
                    target={targets.minutes}
                    label="Practice time"
                    unit="min"
                    icon={<Clock className="w-4 h-4" />}
                />
            </div>

            {/* Intensity Selector */}
            <div className="mb-6">
                <IntensitySelector
                    value={intensity}
                    onChange={handleIntensityChange}
                    disabled={parentLocked}
                    lockedMessage={parentLocked ? 'Set by your parent' : undefined}
                />
            </div>

            {/* Focus Selector */}
            <div className="mb-6">
                <FocusSelector
                    value={focus}
                    onChange={handleFocusChange}
                    disabled={parentLocked}
                    lockedMessage={parentLocked ? 'Set by your parent' : undefined}
                />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={handleStartLesson}
                    disabled={!nextLesson}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 font-medium rounded-xl transition-all ${nextLesson
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-md'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    <Play className="w-4 h-4" />
                    Start next lesson
                    <ChevronRight className="w-4 h-4" />
                </button>
                {hasPractice && (
                    <button
                        type="button"
                        onClick={() => navigate('/practice')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                    >
                        <Zap className="w-4 h-4" />
                        Quick practice
                    </button>
                )}
            </div>
        </motion.div>
    );
};

export default WeeklyPlanCard;
