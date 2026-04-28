import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FlaskConical,
  Loader2,
  PenLine,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useStudentEvent } from '../hooks/useStudentData';
import {
  fetchScienceBlockContent,
  fetchScienceDailyPlan,
} from '../services/homeschoolPlanService';
import { buildScienceBlockPrompt } from '../../shared/scienceBlockPrompts';
import type { DailyHomeschoolPlan, DailyPlanBlock } from '../../shared/homeschoolDailyPlan';

type RubricKey = 'claim' | 'evidence' | 'reasoning' | 'science_words';

const BLOCK_LABELS: Record<string, string> = {
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

const RUBRIC: Array<{ key: RubricKey; label: string; points: number }> = [
  { key: 'claim', label: 'Made a clear claim', points: 25 },
  { key: 'evidence', label: 'Used observation, data, or model evidence', points: 30 },
  { key: 'reasoning', label: 'Explained how the evidence supports the claim', points: 30 },
  { key: 'science_words', label: 'Used science vocabulary carefully', points: 15 },
];

const wordCount = (value: string): number => value.trim().split(/\s+/).filter(Boolean).length;

const scoreResponse = (checks: Record<RubricKey, boolean>, response: string): number => {
  const rubricPoints = RUBRIC.reduce((sum, item) => sum + (checks[item.key] ? item.points : 0), 0);
  const words = wordCount(response);
  const lengthAdjustment = words >= 35 ? 0 : words >= 22 ? -5 : -15;
  return Math.max(0, Math.min(100, rubricPoints + lengthAdjustment));
};

const findBlock = (plan: DailyHomeschoolPlan | null, encodedBlockId: string): DailyPlanBlock | null => {
  if (!plan) return null;
  const decoded = decodeURIComponent(encodedBlockId);
  return plan.blocks.find((block) => block.id === decoded) ?? null;
};

const ScienceDailyBlockPage: React.FC = () => {
  const { blockId } = useParams<{ blockId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const startedAt = useRef(Date.now());
  const studentId = user?.role === 'student' ? user.id : null;
  const { emitStudentEvent, isPending: isCompleting, error: completionError } = useStudentEvent(studentId);
  const [response, setResponse] = useState('');
  const [checks, setChecks] = useState<Record<RubricKey, boolean>>({
    claim: false,
    evidence: false,
    reasoning: false,
    science_words: false,
  });
  const [completed, setCompleted] = useState(false);

  const planQuery = useQuery({
    queryKey: ['science-daily-block-plan', studentId],
    queryFn: () => fetchScienceDailyPlan(),
    enabled: Boolean(studentId),
    staleTime: 60 * 1000,
  });

  const block = useMemo(() => (blockId ? findBlock(planQuery.data ?? null, blockId) : null), [blockId, planQuery.data]);
  const subject = planQuery.data?.subjects.find((entry) => entry.subject === 'science') ?? null;
  const contentQuery = useQuery({
    queryKey: ['science-block-content', studentId, blockId],
    queryFn: () => fetchScienceBlockContent(blockId ?? ''),
    enabled: Boolean(studentId && blockId),
    staleTime: 5 * 60 * 1000,
  });
  const prompt = useMemo(
    () =>
      block
        ? buildScienceBlockPrompt({
            blockKind: block.kind,
            moduleSlug: block.moduleSlug,
            strand: subject?.targetStrand,
          })
        : null,
    [block, subject?.targetStrand],
  );
  const content = contentQuery.data?.content ?? null;
  const score = scoreResponse(checks, response);
  const words = wordCount(response);
  const canSubmit = Boolean(block && studentId && !completed && words >= 12 && checks.claim);

  const handleCheck = (key: RubricKey) => {
    setChecks((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleSubmit = async () => {
    if (!block || !studentId || !canSubmit) return;
    const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    await emitStudentEvent({
      eventType: 'lesson_completed',
      status: 'completed',
      score,
      accuracy: score,
      timeSpentSeconds,
      payload: {
        subject: 'science',
        module_slug: block.moduleSlug,
        score,
        estimated_minutes: Math.max(block.estimatedMinutes, Math.round(timeSpentSeconds / 60)),
        block_id: block.id,
        block_kind: block.kind,
        prompt_id: prompt?.id,
        prompt_text: prompt?.promptText,
        prompt_checklist: prompt?.checklist,
        content_id: content?.id,
        content_title: content?.title,
        content_kind: content?.contentKind,
        content_source_type: content?.sourceType,
        content_focus: content?.focus,
        content_source: content?.sourceLabel,
        content_text: content?.body.join('\n\n'),
        content_excerpt: content?.body.join('\n\n').slice(0, 600),
        response_kind: prompt?.responseKind ?? 'science_block_response',
        rubric_checks: checks,
        response_word_count: words,
        response,
        source: 'homeschool_science_daily_plan',
      },
    });
    setCompleted(true);
  };

  if (!blockId) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <AlertTriangle className="mb-3 h-5 w-5" />
          <h1 className="text-lg font-semibold">Science block unavailable</h1>
          <Link className="mt-4 inline-flex text-sm font-semibold text-emerald-900 underline" to="/student">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/student"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        {(planQuery.isLoading || contentQuery.isLoading) && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
              Loading science work...
            </div>
          </div>
        )}

        {(planQuery.error || contentQuery.error) && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h1 className="font-semibold">Science block unavailable</h1>
                <p className="mt-1 text-sm text-emerald-800">
                  This science plan item could not be loaded. Return to the dashboard and try another item.
                </p>
              </div>
            </div>
          </div>
        )}

        {!planQuery.isLoading && !planQuery.error && !block && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h1 className="font-semibold">Science block not found</h1>
                <p className="mt-1 text-sm text-emerald-800">The daily plan may have changed since this link was opened.</p>
              </div>
            </div>
          </div>
        )}

        {block && prompt && content && !contentQuery.error && (
          <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-800">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1">
                      <FlaskConical className="h-4 w-4" />
                      {BLOCK_LABELS[block.kind] ?? block.kind}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      <Clock className="h-4 w-4" />
                      {block.estimatedMinutes} min
                    </span>
                  </div>
                  <h1 className="mt-4 text-3xl font-bold tracking-normal text-slate-950">{block.title}</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{block.purpose}</p>
                  {subject?.parentSummary && (
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                      <span className="font-semibold text-slate-700">Why: </span>
                      {subject.parentSummary}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">Current score: {score}%</div>
                  <div className="mt-1">{words} words</div>
                </div>
              </div>
            </header>

            <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
              <section className="p-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Phenomenon or evidence
                      </div>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">{content.title}</h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      Science scaffold
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-700">Focus: {content.focus}</p>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                    {content.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{content.sourceLabel}</p>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prompt</div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{prompt.promptText}</p>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{prompt.parentPurpose}</p>
                </div>

                <label htmlFor="science-response" className="mt-6 block text-sm font-semibold text-slate-900">
                  Response
                </label>
                <textarea
                  id="science-response"
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  rows={12}
                  className="mt-2 w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Write the science explanation here."
                />

                {completionError && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Completion could not be saved. Keep the response here and try again.
                  </div>
                )}

                {completed && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Saved with a score of {score}%. The next science plan will use this evidence.
                  </div>
                )}
              </section>

              <aside className="border-t border-slate-100 bg-white p-6 lg:border-l lg:border-t-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <PenLine className="h-4 w-4 text-emerald-700" />
                  CER rubric
                </div>
                <div className="mt-4 space-y-3">
                  {RUBRIC.map((item) => (
                    <label
                      key={item.key}
                      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm transition hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={checks[item.key]}
                        onChange={() => handleCheck(item.key)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                      />
                      <span className="flex-1">
                        <span className="block font-medium text-slate-900">{item.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{item.points} points</span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Include</div>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                    {prompt.checklist.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-700" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || isCompleting}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isCompleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {completed ? 'Saved' : 'Submit science evidence'}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/student')}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Return to dashboard
                </button>

                {!canSubmit && !completed && (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Write at least 12 words and check the claim line before submitting.
                  </p>
                )}
              </aside>
            </div>
          </article>
        )}
      </div>
    </main>
  );
};

export default ScienceDailyBlockPage;
