import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BookOpen, FlaskConical } from 'lucide-react';

import { scienceWeeklyRecordQueryKey } from '../../../hooks/useStudentData';
import { fetchScienceWeeklyRecord } from '../../../services/homeschoolPlanService';
import type {
    ScienceWeeklyRecordModuleSummary,
    ScienceWeeklyRecordSummary,
} from '../../../../shared/scienceSubjectStateSummary';

const STRAND_LABELS: Record<string, string> = {
    earth_space: 'Earth and space science',
    life_science: 'Life science',
    physical_science: 'Physical science',
    engineering_practices: 'Engineering practices',
};

const OUTCOME_LABELS: Record<string, string> = {
    mastered: 'Mastery evidence',
    practice: 'Practice evidence',
    weak: 'Repair evidence',
};

const RUBRIC_LABELS: Record<string, string> = {
    claim: 'claim',
    evidence: 'evidence',
    reasoning: 'reasoning',
    science_words: 'science words',
};

const workSampleKey = (item: ScienceWeeklyRecordModuleSummary): string =>
    `${item.moduleSlug}:${item.completedAt ?? 'unknown'}`;

const stateImpactText = (
    sample: ScienceWeeklyRecordModuleSummary,
    record: ScienceWeeklyRecordSummary,
): string => {
    if (sample.parentSummary) return sample.parentSummary;
    if (sample.outcome === 'mastered') {
        return `Science marked ${sample.moduleTitle ?? sample.moduleSlug} mastered and moved toward ${sample.nextModuleTitle ?? record.currentModuleTitle ?? 'the next science module'}.`;
    }
    if (sample.outcome === 'weak') {
        return `Science marked ${sample.moduleTitle ?? sample.moduleSlug} for repair before moving ahead.`;
    }
    return `Science kept ${sample.moduleTitle ?? sample.moduleSlug} in practice until the evidence is stronger.`;
};

export const ParentScienceWeeklyRecordPanel: React.FC<{ childId: string; childName: string }> = ({ childId, childName }) => {
    const [selectedWorkSampleKey, setSelectedWorkSampleKey] = useState<string | null>(null);
    const recordQuery = useQuery({
        queryKey: scienceWeeklyRecordQueryKey(childId),
        queryFn: () => fetchScienceWeeklyRecord(childId),
        enabled: Boolean(childId),
        staleTime: 60 * 1000,
    });
    const record: ScienceWeeklyRecordSummary | null = recordQuery.data ?? null;
    const visibleModules = record?.completedModules.slice(0, 3) ?? [];
    const selectedWorkSample = record?.completedModules.find((item) => workSampleKey(item) === selectedWorkSampleKey) ?? null;

    if (recordQuery.isLoading) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 w-36 rounded bg-slate-200" />
                    <div className="h-20 rounded-xl bg-slate-100" />
                </div>
            </section>
        );
    }

    if (recordQuery.error) {
        return (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold">Weekly science record unavailable</h3>
                        <p className="mt-1 text-sm text-emerald-800">Science work can still be completed from the student dashboard.</p>
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
                        <FlaskConical className="h-4 w-4" />
                        Weekly science record
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        {childName}&apos;s science week
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                        {STRAND_LABELS[record.currentStrand] ?? record.currentStrand.replaceAll('_', ' ')}
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
                <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Latest change</div>
                    <p className="mt-1 text-sm leading-6 text-emerald-900">{record.latestChangeSummary}</p>
                </div>
            )}

            {visibleModules.length > 0 ? (
                <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="text-sm font-semibold text-slate-900">Completed science work</div>
                    <div className="mt-3 space-y-2">
                        {visibleModules.map((item) => (
                            <div
                                key={workSampleKey(item)}
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
                                            onClick={() => setSelectedWorkSampleKey(workSampleKey(item))}
                                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700"
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
                                                    {RUBRIC_LABELS[key] ?? key.replaceAll('_', ' ')}
                                                </span>
                                            ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <BookOpen className="h-4 w-4 text-emerald-700" />
                        No science work samples yet
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                        Science CER, data, model, and reflection samples will appear here after the student submits science evidence.
                    </p>
                </div>
            )}

            {selectedWorkSample && (
                <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                Science work sample
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
                                    {OUTCOME_LABELS[selectedWorkSample.outcome] ?? selectedWorkSample.outcome}
                                </span>
                            )}
                            {typeof selectedWorkSample.scorePct === 'number' && (
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                    {selectedWorkSample.scorePct}%
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source content</div>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                {selectedWorkSample.contentTitle ?? 'Content title not recorded'}
                            </p>
                            {(selectedWorkSample.contentText ?? selectedWorkSample.contentExcerpt) && (
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                    {selectedWorkSample.contentText ?? selectedWorkSample.contentExcerpt}
                                </p>
                            )}
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prompt</div>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                                {selectedWorkSample.promptText ?? 'Prompt text not recorded'}
                            </p>
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
                    </div>

                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            Why the science state changed
                        </div>
                        <p className="mt-1 text-sm leading-6 text-emerald-900">
                            {stateImpactText(selectedWorkSample, record)}
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
};
