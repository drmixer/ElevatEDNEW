import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    ArrowRight,
    ArrowUp,
    ArrowDown,
    Bell,
    BookOpen,
    CheckCircle,
    ChevronRight,
    Flame,
    ListChecks,
    RotateCcw,
    Settings,
    Target,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
    elaSubjectStateQueryKey,
    elaWeeklyRecordQueryKey,
    mathSubjectStateQueryKey,
    mathWeeklyRecordQueryKey,
} from '../../hooks/useStudentData';
import { fetchParentDashboardData } from '../../services/dashboardService';
import { updateLearningPreferences } from '../../services/profileService';
import {
    fetchElaSubjectState,
    fetchElaWeeklyRecord,
    fetchMathParentPreference,
    fetchMathSubjectState,
    fetchMathWeeklyRecord,
    updateMathParentPreference,
} from '../../services/homeschoolPlanService';
import { fetchParentOverview, type ParentOverview } from '../../services/statsService';
import { formatSubjectLabel } from '../../lib/subjects';
import type { Parent, ParentChildSnapshot, LearningPreferences, Subject } from '../../types';
import type { MathAdaptiveStrand } from '../../../shared/mathAdaptivePolicy';
import type {
    ElaSubjectStateSummary,
    ElaWeeklyRecordModuleSummary,
    ElaWeeklyRecordSummary,
} from '../../../shared/elaSubjectStateSummary';
import type { MathSubjectStateSummary, MathWeeklyRecordSummary } from '../../../shared/mathSubjectStateSummary';
import SubjectStatusCards from './SubjectStatusCards';
import WeeklyCoachingSuggestions from './WeeklyCoachingSuggestions';
import ParentTutorControls from './ParentTutorControls';
import SafetyTransparencySection from './SafetyTransparencySection';
import ParentOnboardingTour from './ParentOnboardingTour';
import AddLearnerModal, { type AddLearnerFormState } from './ParentDashboard/modals/AddLearnerModal';
import { shouldShowParentOnboarding, markParentOnboardingDone } from '../../lib/parentOnboardingHelpers';
import { defaultLearningPreferences } from '../../types';
import { createLearnerForParent } from '../../services/parentService';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
} from 'recharts';

// ============================================================================
// ParentDashboardSimplified
// A clean, focused dashboard that answers: "How is my child doing?" and "What can I do to help?"
// Target: ~600 lines max (vs 7,315 in the original)
// ============================================================================

// ============================================================================
// Sub-components
// ============================================================================

const MATH_STRAND_OPTIONS: Array<{ value: MathAdaptiveStrand; label: string }> = [
    { value: 'place_value_operations', label: 'Place value and operations' },
    { value: 'fractions_decimals', label: 'Fractions and decimals' },
    { value: 'ratios_rates_percent', label: 'Ratios, rates, and percent' },
    { value: 'expressions_equations_functions', label: 'Expressions and equations' },
    { value: 'geometry_measurement', label: 'Geometry and measurement' },
    { value: 'data_probability_statistics', label: 'Data and statistics' },
    { value: 'problem_solving_modeling', label: 'Problem solving' },
];

const MATH_STRAND_LABELS = MATH_STRAND_OPTIONS.reduce<Record<string, string>>((labels, option) => {
    labels[option.value] = option.label;
    return labels;
}, {});

const MATH_OUTCOME_LABELS: Record<string, string> = {
    mastered: 'Mastered',
    practice: 'Practice zone',
    weak: 'Needs repair',
};

const formatMathPercent = (value?: number): string =>
    typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Not set';

const labelMathSlug = (slug?: string): string => {
    if (!slug) return 'Not set';
    return slug
        .split('-')
        .filter((part) => !/^\d+$/.test(part) && part !== 'mathematics')
        .slice(-4)
        .join(' ');
};

interface HeaderProps {
    parentName: string;
    hasNotifications?: boolean;
}

const Header: React.FC<HeaderProps> = ({ parentName, hasNotifications }) => {
    const today = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
    const firstName = parentName?.split(' ')[0] || 'there';
    return (
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                    Hi {firstName}! 👋
                </h1>
                <p className="text-slate-500 mt-1">{today}</p>
            </div>
            <div className="flex items-center gap-3">
                <Link
                    to="/settings"
                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                    title="Settings"
                >
                    <Settings className="w-6 h-6 text-slate-500" />
                </Link>
                <button
                    className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
                    title="Notifications"
                >
                    <Bell className="w-6 h-6 text-slate-500" />
                    {hasNotifications && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                    )}
                </button>
            </div>
        </div>
    );
};

interface ChildCardProps {
    child: ParentChildSnapshot;
    subjectPlacements?: ParentOverview['children'][number]['subject_placements'];
    onViewDetails?: () => void;
}

const ChildCard: React.FC<ChildCardProps> = ({ child, subjectPlacements = [], onViewDetails }) => {
    // Calculate average mastery across all subjects
    const avgMastery = useMemo(() => {
        if (!child.masteryBySubject?.length) return null;
        const sum = child.masteryBySubject.reduce((acc, s) => acc + s.mastery, 0);
        return Math.round(sum / child.masteryBySubject.length);
    }, [child.masteryBySubject]);

    // Determine primary focus subject
    const focusSubject = useMemo(() => {
        const fromGaps = child.skillGaps?.find((g) => g.status === 'needs_attention');
        if (fromGaps) return fromGaps.subject;
        if (child.focusAreas?.length) {
            // Try to infer subject from focus area name (simplified)
            return null;
        }
        return null;
    }, [child.skillGaps, child.focusAreas]);

    const isStreakActive = (child.streakDays ?? 0) > 0;
    const masteryTrend = child.avgAccuracyDelta;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {child.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">{child.name}</h3>
                        <p className="text-sm text-slate-500">Grade {child.grade}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onViewDetails?.();
                    }}
                    className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
                >
                    View Details
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Mastery Progress Bar */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-600">Overall Mastery</span>
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-900">{avgMastery ?? '--'}%</span>
                        {masteryTrend != null && masteryTrend !== 0 && (
                            <span
                                className={`flex items-center text-xs font-medium ${masteryTrend > 0 ? 'text-emerald-600' : 'text-red-500'
                                    }`}
                            >
                                {masteryTrend > 0 ? (
                                    <ArrowUp className="w-3 h-3" />
                                ) : (
                                    <ArrowDown className="w-3 h-3" />
                                )}
                                {Math.abs(masteryTrend)}%
                            </span>
                        )}
                    </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(avgMastery ?? 0, 100)}%` }}
                    />
                </div>
            </div>

            {/* Quick Stats / Badges */}
            <div className="flex flex-wrap gap-2">
                {isStreakActive && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm font-medium border border-orange-100">
                        <Flame className="w-4 h-4" />
                        {child.streakDays} day streak
                    </span>
                )}
                {focusSubject && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100">
                        <BookOpen className="w-4 h-4" />
                        Focus: {formatSubjectLabel(focusSubject)}
                    </span>
                )}
                {child.lessonsCompletedWeek > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-sm font-medium border border-slate-100">
                        <CheckCircle className="w-4 h-4" />
                        {child.lessonsCompletedWeek} lessons this week
                    </span>
                )}
            </div>

            {subjectPlacements.length > 0 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        Current learning pace
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {subjectPlacements
                            .filter((placement) => placement.working_level != null)
                            .slice(0, 2)
                            .map((placement) => (
                                <span
                                    key={`${child.id}-${placement.subject}`}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                                >
                                    <span className="font-semibold">{formatSubjectLabel(placement.subject)}</span>
                                    <span>pace {placement.working_level}</span>
                                    <span className="text-slate-500">school grade signal {placement.expected_level}</span>
                                </span>
                            ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
};

const MathStrandPreferenceControl: React.FC<{ childId: string; childName: string }> = ({ childId, childName }) => {
    const queryClient = useQueryClient();
    const preferenceQuery = useQuery({
        queryKey: ['math-parent-preference', childId],
        queryFn: () => fetchMathParentPreference(childId),
        enabled: Boolean(childId),
        staleTime: 60 * 1000,
    });
    const preferenceMutation = useMutation({
        mutationFn: (preferredStrand: MathAdaptiveStrand | null) =>
            updateMathParentPreference(childId, preferredStrand),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['math-parent-preference', childId] });
            await queryClient.invalidateQueries({ queryKey: mathSubjectStateQueryKey(childId) });
            await queryClient.invalidateQueries({ queryKey: mathWeeklyRecordQueryKey(childId) });
            await queryClient.invalidateQueries({ queryKey: ['parent-dashboard'] });
        },
    });
    const selected = preferenceMutation.variables ?? preferenceQuery.data?.preferredStrand ?? '';

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Math weekly focus</h3>
                    <p className="mt-1 text-sm text-slate-500">
                        {childName}&apos;s weak math areas still take priority.
                    </p>
                </div>
                <select
                    value={selected}
                    disabled={preferenceQuery.isLoading || preferenceMutation.isPending}
                    onChange={(event) => {
                        const value = event.target.value as MathAdaptiveStrand | '';
                        preferenceMutation.mutate(value || null);
                    }}
                    className="min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 sm:min-w-64"
                >
                    <option value="">Auto-balance strands</option>
                    {MATH_STRAND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
            {preferenceMutation.error && (
                <p className="mt-3 text-sm text-red-600">
                    {preferenceMutation.error instanceof Error
                        ? preferenceMutation.error.message
                        : 'Unable to update math focus.'}
                </p>
            )}
        </section>
    );
};

const ParentMathAdaptationPanel: React.FC<{ childId: string; childName: string }> = ({ childId, childName }) => {
    const stateQuery = useQuery({
        queryKey: mathSubjectStateQueryKey(childId),
        queryFn: () => fetchMathSubjectState(childId),
        enabled: Boolean(childId),
        staleTime: 60 * 1000,
    });
    const state: MathSubjectStateSummary | null = stateQuery.data ?? null;
    const lastResult = state?.lastAdaptiveVariantResult ?? null;
    const preferredStrand = state?.parentPreference?.preferredStrand ?? null;
    const latestRotation = state?.rotationHistory?.slice(-1)[0] ?? null;

    if (stateQuery.isLoading) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 w-40 rounded bg-slate-200" />
                    <div className="h-7 w-64 rounded bg-slate-200" />
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="h-20 rounded-xl bg-slate-100" />
                        <div className="h-20 rounded-xl bg-slate-100" />
                        <div className="h-20 rounded-xl bg-slate-100" />
                    </div>
                </div>
            </section>
        );
    }

    if (stateQuery.error) {
        return (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold">Math adaptation review unavailable</h3>
                        <p className="mt-1 text-sm text-amber-800">
                            The weekly focus setting can still be used.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    if (!state) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    <ListChecks className="h-4 w-4" />
                    Math adaptation review
                </div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">No adaptive math history yet</h3>
                <p className="mt-1 text-sm text-slate-500">
                    {childName} will show current math placement, weak areas, and rotation evidence here after an adaptive check.
                </p>
            </section>
        );
    }

    const currentModule = state.currentModuleTitle ?? labelMathSlug(state.currentModuleSlug);
    const currentStrand = MATH_STRAND_LABELS[state.currentStrand] ?? state.currentStrand.replaceAll('_', ' ');
    const preferredStrandLabel = preferredStrand
        ? MATH_STRAND_LABELS[preferredStrand] ?? preferredStrand.replaceAll('_', ' ')
        : 'Auto-balanced';
    const lastOutcome = lastResult?.outcome ? MATH_OUTCOME_LABELS[lastResult.outcome] ?? lastResult.outcome : null;

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        <ListChecks className="h-4 w-4" />
                        Math adaptation review
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">{currentModule}</h3>
                    <p className="mt-1 text-sm text-slate-500">{currentStrand}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    Confidence {formatMathPercent(state.confidence)}
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <Target className="h-4 w-4 text-teal-600" />
                        Weekly focus
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{preferredStrandLabel}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mastered modules</div>
                    <p className="mt-2 text-2xl font-bold text-emerald-600">{state.masteredModuleSlugs.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weak modules</div>
                    <p className="mt-2 text-2xl font-bold text-amber-600">{state.weakModuleSlugs.length}</p>
                </div>
            </div>

            {lastResult && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                        {lastOutcome && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                {lastOutcome}
                            </span>
                        )}
                        <span className="text-sm font-semibold text-slate-900">{lastResult.score}%</span>
                        <span className="text-sm text-slate-500">
                            {lastResult.moduleTitle ?? labelMathSlug(lastResult.moduleSlug)}
                        </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{lastResult.parentSummary}</p>
                </div>
            )}

            {latestRotation && (
                <div className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                    <RotateCcw className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest rotation</div>
                        <p className="mt-1 text-sm text-slate-700">
                            {MATH_STRAND_LABELS[latestRotation.targetStrand] ?? latestRotation.targetStrand.replaceAll('_', ' ')}
                            {' -> '}
                            {latestRotation.assignedModuleTitle ?? labelMathSlug(latestRotation.assignedModuleSlug)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            {latestRotation.rotationReason.replaceAll('_', ' ')}
                            {typeof latestRotation.score === 'number' ? `, ${latestRotation.score}%` : ''}
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
};

const ParentMathWeeklyRecordPanel: React.FC<{ childId: string; childName: string }> = ({ childId, childName }) => {
    const recordQuery = useQuery({
        queryKey: mathWeeklyRecordQueryKey(childId),
        queryFn: () => fetchMathWeeklyRecord(childId),
        enabled: Boolean(childId),
        staleTime: 60 * 1000,
    });
    const record: MathWeeklyRecordSummary | null = recordQuery.data ?? null;
    const visibleModules = record?.completedModules.slice(0, 4) ?? [];

    if (recordQuery.isLoading) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 w-36 rounded bg-slate-200" />
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="h-20 rounded-xl bg-slate-100" />
                        <div className="h-20 rounded-xl bg-slate-100" />
                        <div className="h-20 rounded-xl bg-slate-100" />
                    </div>
                    <div className="h-24 rounded-xl bg-slate-100" />
                </div>
            </section>
        );
    }

    if (recordQuery.error) {
        return (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold">Weekly math record unavailable</h3>
                        <p className="mt-1 text-sm text-amber-800">
                            The adaptation review can still be used.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    if (!record) return null;

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        <BookOpen className="h-4 w-4" />
                        Weekly math record
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        {childName}&apos;s math week
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                        {record.weekStart} to {record.weekEnd}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    {record.estimatedMinutes} estimated min
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed</div>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{record.completedModuleCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mastery evidence</div>
                    <p className="mt-2 text-2xl font-bold text-emerald-600">{record.masteredModuleSlugs.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Repair evidence</div>
                    <p className="mt-2 text-2xl font-bold text-amber-600">{record.weakModuleSlugs.length}</p>
                </div>
            </div>

            {record.latestChangeSummary && (
                <div className="mt-5 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                        Latest change
                    </div>
                    <p className="mt-1 text-sm leading-6 text-teal-900">{record.latestChangeSummary}</p>
                </div>
            )}

            {visibleModules.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="text-sm font-semibold text-slate-900">Completed math work</div>
                    <div className="mt-3 space-y-2">
                        {visibleModules.map((item) => (
                            <div
                                key={`${item.source}-${item.moduleSlug}-${item.completedAt ?? ''}`}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"
                            >
                                <span className="min-w-0 max-w-full truncate font-medium text-slate-700">
                                    {item.moduleTitle ?? labelMathSlug(item.moduleSlug)}
                                </span>
                                <span className="flex items-center gap-2 text-slate-500">
                                    {typeof item.scorePct === 'number' ? `${item.scorePct}%` : item.source.replaceAll('_', ' ')}
                                    {item.outcome && (
                                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                                            {MATH_OUTCOME_LABELS[item.outcome]}
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Parent notes</div>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
                    {record.parentNotes.map((note) => (
                        <li key={note}>{note}</li>
                    ))}
                </ul>
            </div>
        </section>
    );
};

const ELA_STRAND_LABELS: Record<string, string> = {
    reading_literature: 'Reading literature',
    reading_informational: 'Reading informational text',
    vocabulary: 'Vocabulary',
    writing_grammar: 'Writing and grammar',
    speaking_listening: 'Speaking and listening',
};

const ELA_RUBRIC_LABELS: Record<string, string> = {
    answered: 'answered',
    evidence: 'evidence',
    explained: 'explained',
    revised: 'revised',
};

const ELA_OUTCOME_LABELS: Record<string, string> = {
    mastered: 'Mastery evidence',
    practice: 'Practice zone',
    weak: 'Repair evidence',
};

const formatElaConfidence = (value?: number): string =>
    typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Not set';

const labelElaSlug = (slug?: string): string => {
    if (!slug) return 'Not set';
    return slug
        .split('-')
        .filter((part) => !/^\d+$/.test(part) && part !== 'english' && part !== 'language' && part !== 'arts')
        .slice(-4)
        .join(' ');
};

const elaWorkSampleKey = (item: ElaWeeklyRecordModuleSummary): string =>
    `${item.moduleSlug}-${item.completedAt ?? 'undated'}-${item.promptId ?? 'prompt'}`;

const elaStateImpactText = (
    item: ElaWeeklyRecordModuleSummary,
    record: ElaWeeklyRecordSummary,
): string => {
    if (item.parentSummary) {
        return item.parentSummary;
    }
    const title = item.moduleTitle ?? item.moduleSlug;
    if (item.outcome === 'mastered') {
        return `${title} counted as mastery evidence because the score was ${item.scorePct}% or higher than the ELA mastery threshold.`;
    }
    if (item.outcome === 'weak') {
        return `${title} was marked for repair because the score was ${item.scorePct}% below the ELA repair threshold.`;
    }
    if (item.outcome === 'practice') {
        return `${title} stayed in practice because the score was ${item.scorePct}%, between repair and mastery.`;
    }
    return record.latestChangeSummary ?? `${title} was recorded as ELA evidence for this week.`;
};

const ParentElaAdaptationPanel: React.FC<{ childId: string; childName: string }> = ({ childId, childName }) => {
    const stateQuery = useQuery({
        queryKey: elaSubjectStateQueryKey(childId),
        queryFn: () => fetchElaSubjectState(childId),
        enabled: Boolean(childId),
        staleTime: 60 * 1000,
    });
    const state: ElaSubjectStateSummary | null = stateQuery.data ?? null;
    const latestEvidence = state?.recentEvidence[0] ?? null;
    const recommended = state?.recommendedModuleSlugs.slice(0, 3) ?? [];

    if (stateQuery.isLoading) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 w-36 rounded bg-slate-200" />
                    <div className="h-7 w-64 rounded bg-slate-200" />
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="h-20 rounded-xl bg-slate-100" />
                        <div className="h-20 rounded-xl bg-slate-100" />
                        <div className="h-20 rounded-xl bg-slate-100" />
                    </div>
                </div>
            </section>
        );
    }

    if (stateQuery.error) {
        return (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold">ELA adaptation review unavailable</h3>
                        <p className="mt-1 text-sm text-amber-800">
                            Weekly work samples can still be reviewed when available.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    if (!state) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    <ListChecks className="h-4 w-4" />
                    ELA adaptation review
                </div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">No ELA adaptation history yet</h3>
                <p className="mt-1 text-sm text-slate-500">
                    {childName} will show current reading and writing placement after an ELA block is completed.
                </p>
            </section>
        );
    }

    const currentModule = state.currentModuleTitle ?? labelElaSlug(state.currentModuleSlug);
    const currentStrand = ELA_STRAND_LABELS[state.currentStrand] ?? state.currentStrand.replaceAll('_', ' ');

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        <ListChecks className="h-4 w-4" />
                        ELA adaptation review
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">{currentModule}</h3>
                    <p className="mt-1 text-sm text-slate-500">{currentStrand}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    Confidence {formatElaConfidence(state.confidence)}
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mastered modules</div>
                    <p className="mt-2 text-2xl font-bold text-emerald-600">{state.masteredModuleSlugs.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weak modules</div>
                    <p className="mt-2 text-2xl font-bold text-amber-600">{state.weakModuleSlugs.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next options</div>
                    <p className="mt-2 text-2xl font-bold text-indigo-600">{recommended.length}</p>
                </div>
            </div>

            {state.parentSummary && (
                <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Why this is next</div>
                    <p className="mt-1 text-sm leading-6 text-indigo-900">{state.parentSummary}</p>
                </div>
            )}

            {recommended.length > 0 && (
                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Recommended ELA modules</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {recommended.map((slug) => (
                            <span
                                key={slug}
                                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                            >
                                {labelElaSlug(slug)}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {latestEvidence && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="text-sm font-semibold text-slate-900">Latest ELA evidence</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <span className="font-medium text-slate-800">
                            {latestEvidence.moduleTitle ?? labelElaSlug(latestEvidence.moduleSlug)}
                        </span>
                        <span>{latestEvidence.scorePct}%</span>
                        {latestEvidence.outcome && (
                            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                {ELA_OUTCOME_LABELS[latestEvidence.outcome] ?? latestEvidence.outcome}
                            </span>
                        )}
                    </div>
                    {latestEvidence.parentSummary && (
                        <p className="mt-2 text-sm leading-6 text-slate-600">{latestEvidence.parentSummary}</p>
                    )}
                </div>
            )}
        </section>
    );
};

const ParentElaWeeklyRecordPanel: React.FC<{ childId: string; childName: string }> = ({ childId, childName }) => {
    const [selectedWorkSampleKey, setSelectedWorkSampleKey] = useState<string | null>(null);
    const recordQuery = useQuery({
        queryKey: elaWeeklyRecordQueryKey(childId),
        queryFn: () => fetchElaWeeklyRecord(childId),
        enabled: Boolean(childId),
        staleTime: 60 * 1000,
    });
    const record: ElaWeeklyRecordSummary | null = recordQuery.data ?? null;
    const visibleModules = record?.completedModules.slice(0, 3) ?? [];
    const selectedWorkSample = record?.completedModules.find((item) => elaWorkSampleKey(item) === selectedWorkSampleKey) ?? null;
    const latestWorkSampleKey = record?.completedModules[0] ? elaWorkSampleKey(record.completedModules[0]) : null;

    if (recordQuery.isLoading) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 w-32 rounded bg-slate-200" />
                    <div className="h-20 rounded-xl bg-slate-100" />
                </div>
            </section>
        );
    }

    if (recordQuery.error || !record) {
        return null;
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        <BookOpen className="h-4 w-4" />
                        Weekly ELA record
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        {childName}&apos;s reading and writing week
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                        {ELA_STRAND_LABELS[record.currentStrand] ?? record.currentStrand.replaceAll('_', ' ')}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    {record.estimatedMinutes} estimated min
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed</div>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{record.completedModuleCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mastery evidence</div>
                    <p className="mt-2 text-2xl font-bold text-emerald-600">{record.masteredModuleSlugs.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Repair evidence</div>
                    <p className="mt-2 text-2xl font-bold text-amber-600">{record.weakModuleSlugs.length}</p>
                </div>
            </div>

            {record.latestChangeSummary && (
                <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Latest change</div>
                    <p className="mt-1 text-sm leading-6 text-indigo-900">{record.latestChangeSummary}</p>
                </div>
            )}

            {visibleModules.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="text-sm font-semibold text-slate-900">Completed ELA work</div>
                    <div className="mt-3 space-y-2">
                        {visibleModules.map((item) => (
                            <div
                                key={`${item.moduleSlug}-${item.completedAt ?? ''}`}
                                className="rounded-xl bg-slate-50 px-3 py-2 text-sm"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <span className="min-w-0 max-w-full truncate font-medium text-slate-700">
                                        {item.moduleTitle ?? item.moduleSlug}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">
                                            {typeof item.scorePct === 'number' ? `${item.scorePct}%` : 'recorded'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedWorkSampleKey(elaWorkSampleKey(item))}
                                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-700"
                                        >
                                            View sample
                                        </button>
                                    </div>
                                </div>
                                {item.promptText && (
                                    <p className="mt-2 text-xs leading-5 text-slate-500">
                                        <span className="font-semibold uppercase tracking-wide">Prompt: </span>
                                        {item.promptText}
                                    </p>
                                )}
                                {item.contentTitle && (
                                    <p className="mt-2 text-xs leading-5 text-slate-500">
                                        <span className="font-semibold uppercase tracking-wide">Content: </span>
                                        {item.contentTitle}
                                        {item.contentSourceType === 'authored_lesson' ? ' · authored lesson' : ''}
                                    </p>
                                )}
                                {item.contentExcerpt && (
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                        {item.contentExcerpt}
                                    </p>
                                )}
                                {item.responseExcerpt && (
                                    <p className="mt-2 line-clamp-2 text-slate-600">{item.responseExcerpt}</p>
                                )}
                                {item.rubricChecks && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {Object.entries(item.rubricChecks)
                                            .filter(([, checked]) => checked)
                                            .map(([key]) => (
                                                <span
                                                    key={key}
                                                    className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600"
                                                >
                                                    {ELA_RUBRIC_LABELS[key] ?? key.replaceAll('_', ' ')}
                                                </span>
                                            ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectedWorkSample && (
                <div className="mt-5 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                                ELA work sample
                            </div>
                            <h4 className="mt-1 text-base font-semibold text-slate-900">
                                {selectedWorkSample.moduleTitle ?? selectedWorkSample.moduleSlug}
                            </h4>
                            <p className="mt-1 text-sm text-slate-500">
                                {selectedWorkSample.completedAt
                                    ? new Date(selectedWorkSample.completedAt).toLocaleString()
                                    : 'Completion date not recorded'}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {selectedWorkSample.outcome && (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                    {ELA_OUTCOME_LABELS[selectedWorkSample.outcome] ?? selectedWorkSample.outcome}
                                </span>
                            )}
                            {selectedWorkSample.nextModuleTitle && (
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                    Next: {selectedWorkSample.nextModuleTitle}
                                </span>
                            )}
                            {typeof selectedWorkSample.scorePct === 'number' && (
                                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                    {selectedWorkSample.scorePct}%
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Source content
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                {selectedWorkSample.contentTitle ?? 'Content title not recorded'}
                            </p>
                            {selectedWorkSample.contentSourceType && (
                                <p className="mt-1 text-xs text-slate-500">
                                    {selectedWorkSample.contentSourceType === 'authored_lesson'
                                        ? 'Authored lesson'
                                        : selectedWorkSample.contentSourceType.replaceAll('_', ' ')}
                                    {selectedWorkSample.contentKind ? `, ${selectedWorkSample.contentKind.replaceAll('_', ' ')}` : ''}
                                </p>
                            )}
                            {(selectedWorkSample.contentText ?? selectedWorkSample.contentExcerpt) && (
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                    {selectedWorkSample.contentText ?? selectedWorkSample.contentExcerpt}
                                </p>
                            )}
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Prompt
                            </div>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                                {selectedWorkSample.promptText ?? 'Prompt text not recorded'}
                            </p>
                            {selectedWorkSample.promptChecklist && selectedWorkSample.promptChecklist.length > 0 && (
                                <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-500">
                                    {selectedWorkSample.promptChecklist.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Student response
                            </div>
                            {typeof selectedWorkSample.responseWordCount === 'number' && (
                                <span className="text-xs font-medium text-slate-500">
                                    {selectedWorkSample.responseWordCount} words
                                </span>
                            )}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {selectedWorkSample.responseText ?? selectedWorkSample.responseExcerpt ?? 'Response text not recorded'}
                        </p>
                        {selectedWorkSample.rubricChecks && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {Object.entries(selectedWorkSample.rubricChecks).map(([key, checked]) => (
                                    <span
                                        key={key}
                                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${checked
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-slate-100 text-slate-500'
                                            }`}
                                    >
                                        {checked ? 'Met ' : 'Missing '}
                                        {ELA_RUBRIC_LABELS[key] ?? key.replaceAll('_', ' ')}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                            Why the ELA state changed
                        </div>
                        <p className="mt-1 text-sm leading-6 text-indigo-900">
                            {elaStateImpactText(selectedWorkSample, record)}
                            {latestWorkSampleKey === selectedWorkSampleKey && record.latestChangeSummary
                                ? ` Latest summary: ${record.latestChangeSummary}`
                                : ''}
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
};

interface WeeklySummaryChartProps {
    activityData: Array<{ date: string; lessonsCompleted: number; practiceMinutes: number }>;
}

const WeeklySummaryChart: React.FC<WeeklySummaryChartProps> = ({ activityData }) => {
    const chartData = useMemo(() => {
        if (!activityData?.length) return [];
        return activityData.slice(-7).map((point) => ({
            day: new Date(point.date).toLocaleDateString(undefined, { weekday: 'short' }),
            lessons: point.lessonsCompleted ?? 0,
        }));
    }, [activityData]);

    const totalLessons = chartData.reduce((sum, d) => sum + d.lessons, 0);
    const lastWeekTotal = useMemo(() => {
        if (!activityData || activityData.length < 14) return null;
        const prior = activityData.slice(-14, -7);
        return prior.reduce((sum, d) => sum + (d.lessonsCompleted ?? 0), 0);
    }, [activityData]);

    const weekDelta = lastWeekTotal != null ? totalLessons - lastWeekTotal : null;

    if (!chartData.length) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Weekly Summary</h3>
                <p className="text-slate-500 text-center py-8">No activity data yet this week</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Weekly Summary</h3>
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-teal-600" />
                    <span className="text-sm text-slate-500">Lessons completed</span>
                </div>
            </div>

            {/* Chart */}
            <div className="h-40 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="lessonGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="day"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                        />
                        <YAxis hide />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            }}
                            formatter={(value: number) => [`${value} lessons`, 'Completed']}
                        />
                        <Area
                            type="monotone"
                            dataKey="lessons"
                            stroke="#14b8a6"
                            strokeWidth={2}
                            fill="url(#lessonGradient)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Summary Stats */}
            <div className="flex items-center justify-around pt-4 border-t border-slate-100">
                <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">{totalLessons}</p>
                    <p className="text-sm text-slate-500">lessons this week</p>
                </div>
                {weekDelta != null && (
                    <div className="text-center">
                        <p
                            className={`text-2xl font-bold flex items-center justify-center gap-1 ${weekDelta >= 0 ? 'text-emerald-600' : 'text-red-500'
                                }`}
                        >
                            {weekDelta >= 0 ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
                            {Math.abs(weekDelta)}
                        </p>
                        <p className="text-sm text-slate-500">vs last week</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

interface AlertBannerProps {
    alertCount: number;
    viewHref?: string;
}

const AlertBanner: React.FC<AlertBannerProps> = ({ alertCount, viewHref = '/parent#learning-insights' }) => {
    if (alertCount === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3"
        >
            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
                <p className="font-medium text-amber-800">
                    {alertCount} item{alertCount > 1 ? 's' : ''} need{alertCount === 1 ? 's' : ''} your attention
                </p>
                <p className="text-sm text-amber-600">Review your child's progress and take action</p>
            </div>
            <Link
                to={viewHref}
                className="px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors text-sm"
            >
                View
            </Link>
        </motion.div>
    );
};

interface QuickActionsProps {
    onAddLearner: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onAddLearner }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-50 rounded-2xl p-6"
    >
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
                to="/parent#goal-planner"
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all text-center"
            >
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-teal-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Set Goals</span>
            </Link>
            <Link
                to="/catalog"
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all text-center"
            >
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Browse Lessons</span>
            </Link>
            <button
                type="button"
                onClick={onAddLearner}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all text-center"
            >
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Add Learner</span>
            </button>
            <Link
                to="/settings"
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all text-center"
            >
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5 text-slate-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Settings</span>
            </Link>
        </div>
    </motion.div>
);

// ============================================================================
// Main Component
// ============================================================================

const ParentDashboardSimplified: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const parent = (user as Parent) ?? null;
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();

    // Track which child is expanded for detailed view (Sprint 3)
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
    const [savingTutor, setSavingTutor] = useState<string | null>(null);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showAddLearnerModal, setShowAddLearnerModal] = useState(false);
    const [addLearnerForm, setAddLearnerForm] = useState<AddLearnerFormState>({
        name: '',
        email: '',
        grade: 1,
        age: '',
        focusSubject: 'balanced',
        sendInvite: false,
        consentAttested: false,
    });
    const [addLearnerError, setAddLearnerError] = useState<string | null>(null);
    const [addLearnerSuccess, setAddLearnerSuccess] = useState<string | null>(null);
    const [createdFamilyCode, setCreatedFamilyCode] = useState<string | null>(null);
    const [lastTemporaryPassword, setLastTemporaryPassword] = useState<string | null>(null);
    const [lastInviteSent, setLastInviteSent] = useState(false);

    // Check if parent should see onboarding tour
    useEffect(() => {
        if (parent?.id && shouldShowParentOnboarding(parent.id)) {
            // Small delay for better UX
            const timer = setTimeout(() => setShowOnboarding(true), 500);
            return () => clearTimeout(timer);
        }
    }, [parent?.id]);

    useEffect(() => {
        if (!location.hash) return;

        const targetId = decodeURIComponent(location.hash.slice(1));
        if (!targetId) return;

        const timer = window.setTimeout(() => {
            const target = document.getElementById(targetId);
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);

        return () => window.clearTimeout(timer);
    }, [location.hash]);

    // Fetch dashboard data
    const {
        data: dashboard,
        isLoading,
    } = useQuery({
        queryKey: ['parent-dashboard', parent?.id],
        queryFn: () => fetchParentDashboardData({ ...(parent as Parent) }),
        enabled: Boolean(parent),
        staleTime: 1000 * 60 * 5,
    });

    const { data: overview } = useQuery({
        queryKey: ['parent-overview', parent?.id],
        queryFn: () => fetchParentOverview(),
        enabled: Boolean(parent),
        staleTime: 1000 * 60 * 2,
    });

    // Count actionable alerts
    const alertCount = useMemo(() => {
        if (!dashboard?.alerts) return 0;
        return dashboard.alerts.filter((a) => a.type === 'warning').length;
    }, [dashboard?.alerts]);

    // Get selected child for expanded view
    const selectedChild = useMemo(() => {
        if (!selectedChildId || !dashboard?.children) return null;
        return dashboard.children.find((c) => c.id === selectedChildId) ?? null;
    }, [selectedChildId, dashboard?.children]);

    const scrollToSection = useCallback((sectionId: string) => {
        window.setTimeout(() => {
            const target = document.getElementById(sectionId);
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
    }, []);

    // Handle tutor settings save
    const handleSaveTutorSettings = useCallback(
        async (childId: string, updates: Partial<LearningPreferences>) => {
            setSavingTutor(childId);
            try {
                await updateLearningPreferences(childId, updates);
                // Invalidate dashboard to refresh child data
                await queryClient.invalidateQueries({ queryKey: ['parent-dashboard'] });
            } finally {
                setSavingTutor(null);
            }
        },
        [queryClient],
    );

    // Navigate to subject details
    const handleViewSubject = useCallback(
        (childId: string, subject: Subject) => {
            void subject;
            setSelectedChildId(childId);
            navigate('/parent#child-details');
            scrollToSection('child-details');
        },
        [navigate, scrollToSection],
    );

    // Handle onboarding completion
    const handleOnboardingComplete = useCallback(() => {
        if (parent?.id) {
            markParentOnboardingDone(parent.id);
        }
        setShowOnboarding(false);
    }, [parent?.id]);

    const closeAddLearnerModal = useCallback(() => {
        setShowAddLearnerModal(false);
        setAddLearnerError(null);
        setAddLearnerSuccess(null);
        setCreatedFamilyCode(null);
        setLastTemporaryPassword(null);
        setLastInviteSent(false);
    }, []);

    const createLearnerMutation = useMutation({
        mutationFn: async () => {
            const ageNumber = addLearnerForm.age.trim() ? Number.parseInt(addLearnerForm.age, 10) : null;
            return createLearnerForParent({
                name: addLearnerForm.name.trim(),
                email: addLearnerForm.email.trim(),
                grade: addLearnerForm.grade,
                age: ageNumber && Number.isFinite(ageNumber) ? ageNumber : null,
                sendInvite: addLearnerForm.sendInvite && (!ageNumber || ageNumber >= 13),
                consentAttested: ageNumber !== null && ageNumber < 13 ? addLearnerForm.consentAttested : true,
                focusSubject: addLearnerForm.focusSubject === 'balanced' ? null : addLearnerForm.focusSubject,
            });
        },
        onSuccess: async (result) => {
            setAddLearnerError(null);
            setAddLearnerSuccess(
                result.inviteSent
                    ? 'Learner created, linked, and invite email sent.'
                    : 'Learner created and linked. Share the code and temporary password below.',
            );
            setCreatedFamilyCode(result.familyLinkCode ?? null);
            setLastTemporaryPassword(result.temporaryPassword ?? null);
            setLastInviteSent(result.inviteSent);
            await queryClient.invalidateQueries({ queryKey: ['parent-dashboard', parent?.id] });
            await queryClient.invalidateQueries({ queryKey: ['parent-overview', parent?.id] });
            await refreshUser().catch(() => undefined);
        },
        onError: (error) => {
            setAddLearnerSuccess(null);
            setCreatedFamilyCode(null);
            setLastTemporaryPassword(null);
            setLastInviteSent(false);
            setAddLearnerError(error instanceof Error ? error.message : 'Unable to add learner right now.');
        },
    });

    const handleSubmitAddLearner = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        setAddLearnerError(null);
        setAddLearnerSuccess(null);
        setCreatedFamilyCode(null);
        setLastTemporaryPassword(null);
        setLastInviteSent(false);

        const ageNumber = addLearnerForm.age.trim() ? Number.parseInt(addLearnerForm.age, 10) : null;

        if (!addLearnerForm.name.trim() || !addLearnerForm.email.trim()) {
            setAddLearnerError('Add a name and email to create this learner.');
            return;
        }

        if (ageNumber !== null && ageNumber < 13 && !addLearnerForm.consentAttested) {
            setAddLearnerError('Confirm guardian consent for learners under 13.');
            return;
        }

        await createLearnerMutation.mutateAsync();
    }, [addLearnerForm, createLearnerMutation]);

    const overviewByChildId = useMemo(
        () => new Map((overview?.children ?? []).map((child) => [child.id, child])),
        [overview?.children],
    );

    const openChildDetails = useCallback((childId: string) => {
        setSelectedChildId(childId);
        scrollToSection('child-details');
    }, [scrollToSection]);

    // Loading state
    if (isLoading && !dashboard) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 md:p-8 lg:p-12">
                <div className="max-w-5xl mx-auto">
                    <div className="animate-pulse space-y-8">
                        <div className="h-16 w-64 bg-slate-200 rounded-xl" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="h-48 bg-slate-200 rounded-2xl" />
                            <div className="h-48 bg-slate-200 rounded-2xl" />
                        </div>
                        <div className="h-64 bg-slate-200 rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    const children = dashboard?.children ?? [];

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 md:p-8 lg:p-12">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <Header parentName={parent?.name ?? 'Parent'} hasNotifications={alertCount > 0} />

                {/* Alert Banner (if any) */}
                <AlertBanner alertCount={alertCount} />

                {/* Children Section */}
                <section className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-slate-900">Your Children</h2>
                        <div className="flex items-center gap-3">
                            {children.length > 0 && (
                                <span className="text-sm text-slate-500">
                                    {children.length} learner{children.length > 1 ? 's' : ''}
                                    {selectedChildId && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedChildId(null)}
                                            className="ml-3 text-teal-600 hover:text-teal-700 font-medium"
                                        >
                                            Show all
                                        </button>
                                    )}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowAddLearnerModal(true)}
                                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
                            >
                                Add learner
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {children.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No learners yet</h3>
                            <p className="text-slate-500 mb-6">
                                Add your first learner to start tracking their progress
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowAddLearnerModal(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors"
                            >
                                Add a Learner
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {children
                                .filter((c) => !selectedChildId || c.id === selectedChildId)
                                .map((child) => (
                                    <div
                                        key={child.id}
                                        onClick={() => setSelectedChildId(selectedChildId === child.id ? null : child.id)}
                                        className={`cursor-pointer transition-all ${selectedChildId === child.id ? 'md:col-span-2' : ''
                                            }`}
                                    >
                                        <ChildCard
                                            child={child}
                                            subjectPlacements={overviewByChildId.get(child.id)?.subject_placements ?? []}
                                            onViewDetails={() => openChildDetails(child.id)}
                                        />
                                    </div>
                                ))}
                        </div>
                    )}
                </section>

                {/* Sprint 3: Selected Child Detailed View */}
                {selectedChild && (
                    <motion.div
                        id="child-details"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8 scroll-mt-24"
                    >
                        <MathStrandPreferenceControl
                            childId={selectedChild.id}
                            childName={selectedChild.name}
                        />
                        <ParentMathAdaptationPanel
                            childId={selectedChild.id}
                            childName={selectedChild.name}
                        />
                        <ParentMathWeeklyRecordPanel
                            childId={selectedChild.id}
                            childName={selectedChild.name}
                        />
                        <ParentElaAdaptationPanel
                            childId={selectedChild.id}
                            childName={selectedChild.name}
                        />
                        <ParentElaWeeklyRecordPanel
                            childId={selectedChild.id}
                            childName={selectedChild.name}
                        />

                        {/* Subject Status Cards */}
                        {selectedChild.subjectStatuses && selectedChild.subjectStatuses.length > 0 && (
                            <SubjectStatusCards
                                childName={selectedChild.name}
                                statuses={selectedChild.subjectStatuses}
                                onViewSubject={(subject) => handleViewSubject(selectedChild.id, subject)}
                            />
                        )}

                        {/* Two Column Layout: Coaching + Tutor Controls */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Weekly Coaching Suggestions */}
                            <WeeklyCoachingSuggestions
                                childName={selectedChild.name}
                                suggestions={selectedChild.coachingSuggestions ?? []}
                                focusSubject={
                                    selectedChild.masteryBySubject?.[0]?.subject ?? null
                                }
                            />

                            {/* AI Tutor Controls */}
                            <ParentTutorControls
                                childName={selectedChild.name}
                                preferences={selectedChild.learningPreferences ?? defaultLearningPreferences}
                                onSave={(updates) => handleSaveTutorSettings(selectedChild.id, updates)}
                                saving={savingTutor === selectedChild.id}
                            />
                        </div>
                    </motion.div>
                )}

                {/* Weekly Summary Chart */}
                <section id="learning-insights" className="mb-8 scroll-mt-24">
                    <WeeklySummaryChart activityData={dashboard?.activitySeries ?? []} />
                </section>

                {/* Quick Actions */}
                <section id="goal-planner" className="scroll-mt-24">
                    <QuickActions onAddLearner={() => setShowAddLearnerModal(true)} />
                </section>

                {/* Safety & Transparency Section */}
                <section className="mt-8">
                    <SafetyTransparencySection
                        parentId={parent?.id ?? ''}
                        studentId={selectedChild?.id}
                        studentName={selectedChild?.name}
                    />
                </section>
            </div>

            {/* Parent Onboarding Tour */}
            <ParentOnboardingTour
                isOpen={showOnboarding}
                onClose={() => setShowOnboarding(false)}
                onComplete={handleOnboardingComplete}
                parentName={parent?.name}
                childrenCount={children.length}
            />
            <AddLearnerModal
                isOpen={showAddLearnerModal}
                onClose={closeAddLearnerModal}
                formState={addLearnerForm}
                onFormChange={(updates) => setAddLearnerForm((prev) => ({ ...prev, ...updates }))}
                onSubmit={handleSubmitAddLearner}
                isLoading={createLearnerMutation.isLoading}
                error={addLearnerError}
                success={addLearnerSuccess}
                familyLinkCode={createdFamilyCode}
                temporaryPassword={lastTemporaryPassword}
                inviteSent={lastInviteSent}
            />
        </div>
    );
};

export default ParentDashboardSimplified;
