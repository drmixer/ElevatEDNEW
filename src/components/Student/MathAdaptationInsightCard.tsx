import React from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ListChecks,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';

import type { MathSubjectStateSummary } from '../../../shared/mathSubjectStateSummary';

type MathAdaptationInsightCardProps = {
  state: MathSubjectStateSummary | null;
  isLoading?: boolean;
  error?: Error | null;
};

const STRAND_LABELS: Record<string, string> = {
  place_value_operations: 'Place value and operations',
  fractions_decimals: 'Fractions and decimals',
  ratios_rates_percent: 'Ratios, rates, and percent',
  expressions_equations_functions: 'Expressions, equations, and functions',
  geometry_measurement: 'Geometry and measurement',
  data_probability_statistics: 'Data, probability, and statistics',
  problem_solving_modeling: 'Problem solving and modeling',
};

const OUTCOME_LABELS: Record<string, string> = {
  mastered: 'Mastered',
  practice: 'Practice zone',
  weak: 'Needs repair',
};

const outcomeClass = (outcome?: string | null): string => {
  if (outcome === 'mastered') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (outcome === 'weak') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-sky-50 text-sky-700 border-sky-200';
};

const percent = (value?: number): string => (typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Not set');

const labelSlug = (slug: string): string =>
  slug
    .split('-')
    .filter((part) => !/^\d+$/.test(part) && part !== 'mathematics')
    .slice(-4)
    .join(' ');

const MathAdaptationInsightCard: React.FC<MathAdaptationInsightCardProps> = ({
  state,
  isLoading = false,
  error = null,
}) => {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-40 rounded bg-slate-200" />
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
            <h3 className="font-semibold">Math adaptation details unavailable</h3>
            <p className="mt-1 text-sm text-amber-800">The daily math plan can still be used.</p>
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
          Math Adaptation
        </div>
        <h2 className="mt-2 text-xl font-bold text-slate-900">No adaptive math history yet</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Complete an adaptive math check and the app will show why the next math step changed.
        </p>
      </section>
    );
  }

  const last = state.lastAdaptiveVariantResult ?? null;
  const currentModule = state.currentModuleTitle ?? (state.currentModuleSlug ? labelSlug(state.currentModuleSlug) : 'Not set');
  const recentEvidence = state.recentEvidence.slice(-3).reverse();
  const recentRotations = (state.rotationHistory ?? []).slice(-5).reverse();
  const preferredStrandLabel = state.parentPreference?.preferredStrand
    ? STRAND_LABELS[state.parentPreference.preferredStrand] ??
      state.parentPreference.preferredStrand.replaceAll('_', ' ')
    : null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <ListChecks className="h-4 w-4" />
            Math Adaptation
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-900">{currentModule}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {STRAND_LABELS[state.currentStrand] ?? state.currentStrand}
          </p>
          {preferredStrandLabel && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Parent focus: {preferredStrandLabel}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
          Confidence {percent(state.confidence)}
        </div>
      </div>

      {last && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${outcomeClass(last.outcome)}`}>
              {OUTCOME_LABELS[last.outcome]}
            </span>
            <span className="text-sm font-semibold text-slate-900">{last.score}%</span>
            <span className="text-sm text-slate-500">{last.moduleTitle ?? labelSlug(last.moduleSlug)}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{last.parentSummary}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <TrendingUp className="mt-0.5 h-4 w-4 text-indigo-600" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next module</div>
                <div className="mt-1 text-sm font-medium text-slate-800">
                  {last.nextModuleTitle ?? labelSlug(last.nextModuleSlug)}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              {last.outcome === 'weak' ? (
                <RotateCcw className="mt-0.5 h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-600" />
              )}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Policy reason</div>
                <div className="mt-1 text-sm font-medium text-slate-800">{last.reasonCode.replaceAll('_', ' ')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {recentEvidence.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="text-sm font-semibold text-slate-900">Recent checks</div>
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

      {recentRotations.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="text-sm font-semibold text-slate-900">Recent strand rotation</div>
          <div className="mt-3 space-y-3">
            {recentRotations.map((item) => (
              <div
                key={`${item.date}-${item.targetStrand}-${item.assignedModuleSlug}`}
                className="rounded-2xl bg-slate-50 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">
                    {STRAND_LABELS[item.targetStrand] ?? item.targetStrand}
                  </span>
                  <span className="text-xs font-medium text-slate-500">{item.date}</span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {item.assignedModuleTitle ?? labelSlug(item.assignedModuleSlug)}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{item.rotationReason.replaceAll('_', ' ')}</span>
                  {typeof item.score === 'number' && <span>{item.score}%</span>}
                  {item.outcome && <span>{OUTCOME_LABELS[item.outcome]}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default MathAdaptationInsightCard;
