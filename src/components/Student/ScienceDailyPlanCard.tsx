import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  FlaskConical,
  Lightbulb,
} from 'lucide-react';

import type { DailyHomeschoolPlan, DailyPlanBlockKind } from '../../../shared/homeschoolDailyPlan';

type ScienceDailyPlanCardProps = {
  plan: DailyHomeschoolPlan | null;
  isLoading?: boolean;
  error?: Error | null;
};

const BLOCK_LABELS: Record<DailyPlanBlockKind, string> = {
  warmup: 'Warmup',
  diagnostic: 'Starting check',
  lesson: 'Investigation',
  guided_practice: 'CER practice',
  independent_practice: 'Science response',
  repair: 'Repair',
  challenge: 'Challenge',
  exit_ticket: 'Exit ticket',
  reflection: 'Reflection',
};

const ACTION_LABELS: Record<string, string> = {
  diagnose: 'Find science starting point',
  investigate: 'Investigate a phenomenon',
  model: 'Revise a model',
  explain: 'Explain with evidence',
  repair: 'Repair science idea',
  challenge: 'Stretch science thinking',
  reflect: 'Reflect on evidence',
};

const STRAND_LABELS: Record<string, string> = {
  earth_space: 'Earth and space science',
  life_science: 'Life science',
  physical_science: 'Physical science',
  engineering_practices: 'Engineering practices',
};

const labelSlug = (slug: string): string =>
  slug
    .split('-')
    .filter((part) => !/^\d+$/.test(part) && part !== 'science')
    .slice(-5)
    .join(' ');

const ScienceDailyPlanCard: React.FC<ScienceDailyPlanCardProps> = ({ plan, isLoading = false, error = null }) => {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="h-7 w-56 rounded bg-slate-200" />
          <div className="h-20 rounded-2xl bg-slate-100" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Science plan unavailable</h3>
            <p className="mt-1 text-sm text-emerald-800">The regular lesson plan is still available.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!plan) return null;

  const subject = plan.subjects.find((entry) => entry.subject === 'science') ?? plan.subjects[0] ?? null;
  const visibleBlocks = plan.blocks.slice(0, 4);
  const actionLabel = subject ? ACTION_LABELS[subject.action] ?? subject.action : 'Science';
  const strandLabel = subject?.targetStrand
    ? STRAND_LABELS[subject.targetStrand] ?? subject.targetStrand.replaceAll('_', ' ')
    : null;
  const moduleLabel = subject?.primaryModuleSlug ? labelSlug(subject.primaryModuleSlug) : null;

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
            <FlaskConical className="h-4 w-4" />
            Today&apos;s Science Plan
          </div>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">{actionLabel}</h2>
          {strandLabel && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {strandLabel}
            </div>
          )}
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {subject?.studentSummary ?? 'Your science investigation work is ready for today.'}
          </p>
          {moduleLabel && (
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Current module: {moduleLabel}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
          <Clock className="h-4 w-4 text-emerald-700" />
          {plan.requiredMinutes} required min
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {visibleBlocks.map((block) => (
          <div
            key={block.id}
            className="flex items-start gap-3 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0"
          >
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              {block.required ? <CheckCircle className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{block.title}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {BLOCK_LABELS[block.kind]}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{block.purpose}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2 text-sm font-medium text-slate-500">
              <span>{block.estimatedMinutes}m</span>
              <Link
                to={`/student/science/block/${encodeURIComponent(block.id)}`}
                className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Open
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
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

export default ScienceDailyPlanCard;
