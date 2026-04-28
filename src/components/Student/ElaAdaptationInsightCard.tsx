import React from 'react';
import {
  AlertTriangle,
  BookMarked,
  CheckCircle,
  FileText,
  ListChecks,
  RotateCcw,
} from 'lucide-react';

import type { ElaSubjectStateSummary } from '../../../shared/elaSubjectStateSummary';

type ElaAdaptationInsightCardProps = {
  state: ElaSubjectStateSummary | null;
  isLoading?: boolean;
  error?: Error | null;
};

const STRAND_LABELS: Record<string, string> = {
  reading_literature: 'Reading literature',
  reading_informational: 'Reading informational text',
  vocabulary: 'Vocabulary',
  writing_grammar: 'Writing and grammar',
  speaking_listening: 'Speaking and listening',
};

const REASON_LABELS: Record<string, string> = {
  no_recent_evidence: 'Needs first evidence',
  weak_reading_or_writing_evidence: 'Repair from recent evidence',
  mastery_advance: 'Ready to move forward',
  continue_current_module: 'Keep practicing current module',
  grade_level_start: 'Grade-level start',
};

const labelSlug = (slug: string): string =>
  slug
    .split('-')
    .filter((part) => !/^\d+$/.test(part) && part !== 'english' && part !== 'language' && part !== 'arts')
    .slice(-5)
    .join(' ');

const percent = (value?: number): string => (typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Not set');

const evidenceClass = (score: number): string => {
  if (score >= 85) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (score < 70) return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-sky-50 text-sky-700 border-sky-200';
};

const evidenceLabel = (score: number): string => {
  if (score >= 85) return 'Mastered';
  if (score < 70) return 'Needs repair';
  return 'Practice zone';
};

const ElaAdaptationInsightCard: React.FC<ElaAdaptationInsightCardProps> = ({
  state,
  isLoading = false,
  error = null,
}) => {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="h-7 w-64 rounded bg-slate-200" />
          <div className="h-20 rounded-2xl bg-slate-100" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">ELA adaptation details unavailable</h3>
            <p className="mt-1 text-sm text-amber-800">The daily ELA plan can still be used.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!state) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <ListChecks className="h-4 w-4" />
          ELA Adaptation
        </div>
        <h2 className="mt-2 text-xl font-bold text-slate-900">No ELA evidence yet</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Complete an ELA check or writing response and the app will show why the next ELA step changed.
        </p>
      </section>
    );
  }

  const currentModule = state.currentModuleTitle ?? (state.currentModuleSlug ? labelSlug(state.currentModuleSlug) : 'Not set');
  const recentEvidence = state.recentEvidence.slice(-3).reverse();
  const latestEvidence = recentEvidence[0] ?? null;
  const reasonLabel = state.reasonCode ? REASON_LABELS[state.reasonCode] ?? state.reasonCode.replaceAll('_', ' ') : null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <ListChecks className="h-4 w-4" />
            ELA Adaptation
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-900">{currentModule}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {STRAND_LABELS[state.currentStrand] ?? state.currentStrand}
            {typeof state.workingGrade === 'number' ? ` · Grade ${state.workingGrade}` : ''}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
          Confidence {percent(state.confidence)}
        </div>
      </div>

      {latestEvidence && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${evidenceClass(latestEvidence.scorePct)}`}>
              {evidenceLabel(latestEvidence.scorePct)}
            </span>
            <span className="text-sm font-semibold text-slate-900">{latestEvidence.scorePct}%</span>
            <span className="text-sm text-slate-500">
              {latestEvidence.moduleTitle ?? labelSlug(latestEvidence.moduleSlug)}
            </span>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          {state.weakModuleSlugs.length > 0 ? (
            <RotateCcw className="mt-0.5 h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-600" />
          )}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current signal</div>
            <div className="mt-1 text-sm font-medium text-slate-800">
              {reasonLabel ?? state.placementStatus.replaceAll('_', ' ')}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <BookMarked className="mt-0.5 h-4 w-4 text-amber-700" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended</div>
            <div className="mt-1 text-sm font-medium text-slate-800">
              {state.recommendedModuleSlugs[0] ? labelSlug(state.recommendedModuleSlugs[0]) : currentModule}
            </div>
          </div>
        </div>
      </div>

      {state.parentSummary && (
        <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Why: </span>
          {state.parentSummary}
        </div>
      )}

      {recentEvidence.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileText className="h-4 w-4 text-slate-500" />
            Latest evidence
          </div>
          <div className="mt-3 space-y-2">
            {recentEvidence.map((item) => (
              <div key={`${item.moduleSlug}-${item.completedAt ?? item.scorePct}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-slate-600">{item.moduleTitle ?? labelSlug(item.moduleSlug)}</span>
                <span className="font-semibold text-slate-800">{item.scorePct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default ElaAdaptationInsightCard;
