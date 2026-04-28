import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Lightbulb,
  Target,
} from 'lucide-react';

import type { DailyHomeschoolPlan, DailyPlanBlockKind } from '../../../shared/homeschoolDailyPlan';

type MathDailyPlanCardProps = {
  plan: DailyHomeschoolPlan | null;
  isLoading?: boolean;
  error?: Error | null;
};

const BLOCK_LABELS: Record<DailyPlanBlockKind, string> = {
  warmup: 'Warmup',
  diagnostic: 'Starting check',
  lesson: 'Lesson',
  guided_practice: 'Guided practice',
  independent_practice: 'Independent practice',
  repair: 'Repair',
  challenge: 'Challenge',
  exit_ticket: 'Exit ticket',
  reflection: 'Reflection',
};

const ACTION_LABELS: Record<string, string> = {
  diagnose: 'Find starting point',
  continue: 'Continue',
  advance: 'Move ahead',
  reinforce: 'Practice',
  remediate: 'Repair',
  challenge: 'Challenge',
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

const MathDailyPlanCard: React.FC<MathDailyPlanCardProps> = ({ plan, isLoading = false, error = null }) => {
  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="h-7 w-56 rounded bg-slate-200" />
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-20 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Math plan unavailable</h3>
            <p className="mt-1 text-sm text-amber-800">The regular lesson plan is still available.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const subject = plan.subjects.find((entry) => entry.subject === 'math') ?? plan.subjects[0] ?? null;
  const visibleBlocks = plan.blocks.slice(0, 5);
  const actionLabel = subject ? ACTION_LABELS[subject.action] ?? subject.action : 'Math';
  const preferredStrandLabel = subject?.preferredStrand
    ? STRAND_LABELS[subject.preferredStrand] ?? subject.preferredStrand.replaceAll('_', ' ')
    : null;

  return (
    <section className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">
            <Target className="h-4 w-4" />
            Today&apos;s Math Plan
          </div>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">{actionLabel}</h2>
          {preferredStrandLabel && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Parent focus: {preferredStrandLabel}
              {subject?.parentPreferenceActive ? (
                <span className="rounded-full bg-white px-2 py-0.5 text-indigo-600">active</span>
              ) : null}
            </div>
          )}
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {subject?.studentSummary ?? 'Your math work is ready for today.'}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
          <Clock className="h-4 w-4 text-indigo-600" />
          {plan.requiredMinutes} required min
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {visibleBlocks.map((block) => (
          <div
            key={block.id}
            className="flex items-start gap-3 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0"
          >
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              {block.required ? <CheckCircle className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{block.title}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {BLOCK_LABELS[block.kind]}
                </span>
                {!block.required && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Optional
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">{block.purpose}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span className="text-sm font-medium text-slate-500">{block.estimatedMinutes}m</span>
              {block.contentVariantId && (
                <Link
                  to={`/student/math/variant/${encodeURIComponent(block.contentVariantId)}`}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {subject?.parentSummary && (
        <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Why: </span>
          {subject.parentSummary}
        </div>
      )}
    </section>
  );
};

export default MathDailyPlanCard;
