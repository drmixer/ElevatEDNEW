import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, BookOpen, ListChecks, RotateCcw, Target } from 'lucide-react';

import { mathSubjectStateQueryKey, mathWeeklyRecordQueryKey } from '../../../hooks/useStudentData';
import {
    fetchMathParentPreference,
    fetchMathSubjectState,
    fetchMathWeeklyRecord,
    updateMathParentPreference,
} from '../../../services/homeschoolPlanService';
import type { MathAdaptiveStrand } from '../../../../shared/mathAdaptivePolicy';
import type { MathSubjectStateSummary, MathWeeklyRecordSummary } from '../../../../shared/mathSubjectStateSummary';

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

export const MathStrandPreferenceControl: React.FC<{ childId: string; childName: string }> = ({ childId, childName }) => {
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

export const ParentMathAdaptationPanel: React.FC<{ childId: string; childName: string }> = ({ childId, childName }) => {
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

export const ParentMathWeeklyRecordPanel: React.FC<{ childId: string; childName: string }> = ({ childId, childName }) => {
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
