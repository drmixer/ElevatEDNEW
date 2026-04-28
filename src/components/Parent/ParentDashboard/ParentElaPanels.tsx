import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BookOpen, ListChecks } from 'lucide-react';

import { elaSubjectStateQueryKey, elaWeeklyRecordQueryKey } from '../../../hooks/useStudentData';
import { fetchElaSubjectState, fetchElaWeeklyRecord } from '../../../services/homeschoolPlanService';
import type {
    ElaSubjectStateSummary,
    ElaWeeklyRecordModuleSummary,
    ElaWeeklyRecordSummary,
} from '../../../../shared/elaSubjectStateSummary';

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

export const ParentElaAdaptationPanel: React.FC<{ childId: string; childName: string }> = ({ childId, childName }) => {
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

export const ParentElaWeeklyRecordPanel: React.FC<{ childId: string; childName: string }> = ({ childId, childName }) => {
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
