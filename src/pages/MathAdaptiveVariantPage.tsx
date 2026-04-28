import React, { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Target,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useAuth } from '../contexts/AuthContext';
import { fetchMathAdaptiveVariant } from '../services/homeschoolPlanService';
import { useStudentEvent } from '../hooks/useStudentData';
import type { MathAdaptiveVariantKind } from '../../shared/mathAdaptiveVariants';

const MARKDOWN_PLUGINS = [remarkGfm];

const VARIANT_KIND_LABELS: Record<MathAdaptiveVariantKind, string> = {
  repair_lesson: 'Repair lesson',
  guided_repair_practice: 'Guided repair practice',
  challenge_task: 'Challenge task',
  exit_ticket: 'Exit ticket',
};

type PracticeRating = 'correct' | 'partial' | 'needs_work';

type PracticeResponse = {
  response: string;
  rating: PracticeRating | null;
  revealed: boolean;
};

const RATING_POINTS: Record<PracticeRating, number> = {
  correct: 1,
  partial: 0.5,
  needs_work: 0,
};

const ratingLabel = (rating: PracticeRating): string => {
  if (rating === 'correct') return 'Correct';
  if (rating === 'partial') return 'Partial';
  return 'Needs work';
};

const MathAdaptiveVariantPage: React.FC = () => {
  const { variantId } = useParams<{ variantId: string }>();
  const { user } = useAuth();
  const startedAt = useRef(Date.now());
  const [completed, setCompleted] = useState(false);
  const studentId = user?.role === 'student' ? user.id : null;
  const { emitStudentEvent, isPending: isCompleting, error: completionError } = useStudentEvent(studentId);
  const [practiceResponses, setPracticeResponses] = useState<Record<number, PracticeResponse>>({});

  const decodedVariantId = useMemo(() => {
    if (!variantId) return '';
    try {
      return decodeURIComponent(variantId);
    } catch {
      return variantId;
    }
  }, [variantId]);

  const variantQuery = useQuery({
    queryKey: ['math-adaptive-variant', decodedVariantId],
    queryFn: () => fetchMathAdaptiveVariant(decodedVariantId),
    enabled: decodedVariantId.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const variant = variantQuery.data ?? null;
  const practiceCount = variant?.practiceItems.length ?? 0;
  const scoredCount = variant
    ? variant.practiceItems.filter((_, index) => practiceResponses[index]?.rating != null).length
    : 0;
  const canComplete = practiceCount === 0 || scoredCount === practiceCount;
  const earnedPoints = variant
    ? variant.practiceItems.reduce((total, _, index) => {
        const rating = practiceResponses[index]?.rating;
        return total + (rating ? RATING_POINTS[rating] : 0);
      }, 0)
    : 0;
  const scorePct = practiceCount > 0 ? Math.round((earnedPoints / practiceCount) * 100) : null;

  const updatePracticeResponse = (index: number, patch: Partial<PracticeResponse>) => {
    setPracticeResponses((current) => ({
      ...current,
      [index]: {
        response: current[index]?.response ?? '',
        rating: current[index]?.rating ?? null,
        revealed: current[index]?.revealed ?? false,
        ...patch,
      },
    }));
  };

  const handleComplete = async () => {
    if (!variant || !studentId || completed || !canComplete) return;
    const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    await emitStudentEvent({
      eventType: 'lesson_completed',
      status: 'completed',
      score: scorePct,
      accuracy: scorePct,
      timeSpentSeconds,
      payload: {
        subject: 'math',
        adaptive_variant_id: variant.id,
        adaptive_variant_kind: variant.kind,
        module_slug: variant.moduleSlug,
        score: scorePct,
        mastery_check: variant.masteryCheck,
        practice_item_count: practiceCount,
        practice_items_scored: scoredCount,
        practice_results: variant.practiceItems.map((item, index) => {
          const rating = practiceResponses[index]?.rating ?? null;
          return {
            index,
            prompt: item.prompt,
            answer: item.answer,
            response: practiceResponses[index]?.response ?? '',
            rating,
            points: rating ? RATING_POINTS[rating] : 0,
          };
        }),
        source: 'homeschool_math_daily_plan',
      },
    });
    setCompleted(true);
  };

  if (!decodedVariantId) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <AlertTriangle className="mb-3 h-5 w-5" />
          <h1 className="text-lg font-semibold">Math lesson unavailable</h1>
          <p className="mt-1 text-sm">This plan item is missing its content id.</p>
          <Link className="mt-4 inline-flex text-sm font-semibold text-amber-900 underline" to="/student">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/student"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        {variantQuery.isLoading && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              Loading math work...
            </div>
          </div>
        )}

        {variantQuery.error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h1 className="font-semibold">Math lesson unavailable</h1>
                <p className="mt-1 text-sm text-amber-800">
                  This adaptive plan item could not be loaded. Return to the dashboard and try another item.
                </p>
              </div>
            </div>
          </div>
        )}

        {variant && (
          <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 bg-white p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-indigo-700">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1">
                      <Target className="h-4 w-4" />
                      {VARIANT_KIND_LABELS[variant.kind]}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      <Clock className="h-4 w-4" />
                      {variant.estimatedMinutes} min
                    </span>
                  </div>
                  <h1 className="mt-4 text-3xl font-bold tracking-normal text-slate-950">{variant.title}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{variant.purpose}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleComplete()}
                  disabled={isCompleting || completed || !canComplete}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isCompleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {completed ? 'Completed' : 'Mark complete'}
                </button>
              </div>
              {practiceCount > 0 && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">
                    Practice score: {scoredCount}/{practiceCount} checked
                    {scorePct != null ? `, ${scorePct}%` : ''}
                  </span>
                  {!canComplete && (
                    <span className="ml-1">Check each answer before completing this math block.</span>
                  )}
                </div>
              )}
              {completionError && (
                <p className="mt-3 text-sm text-amber-700">
                  Completion could not be saved. You can keep working and try again.
                </p>
              )}
            </header>

            <div className="space-y-8 p-6">
              <div className="prose prose-slate max-w-none prose-headings:tracking-normal prose-a:text-indigo-700">
                <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>{variant.markdown}</ReactMarkdown>
              </div>

              {variant.practiceItems.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-slate-950">Practice</h2>
                  <div className="mt-3 space-y-3">
                    {variant.practiceItems.map((item, index) => (
                      (() => {
                        const response = practiceResponses[index];
                        const rating = response?.rating ?? null;
                        return (
                          <div
                            key={`${item.prompt}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-sm font-semibold text-slate-900">
                                {index + 1}. {item.prompt}
                              </h3>
                              {rating && (
                                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                                  {ratingLabel(rating)}
                                </span>
                              )}
                            </div>
                            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Work it out
                            </label>
                            <textarea
                              value={response?.response ?? ''}
                              onChange={(event) => updatePracticeResponse(index, { response: event.target.value })}
                              rows={3}
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                              placeholder="Type the answer, steps, or explanation here."
                            />
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updatePracticeResponse(index, { revealed: true })}
                                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                              >
                                Check answer
                              </button>
                              <button
                                type="button"
                                onClick={() => updatePracticeResponse(index, { rating: 'correct', revealed: true })}
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Got it
                              </button>
                              <button
                                type="button"
                                onClick={() => updatePracticeResponse(index, { rating: 'partial', revealed: true })}
                                className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
                              >
                                Almost
                              </button>
                              <button
                                type="button"
                                onClick={() => updatePracticeResponse(index, { rating: 'needs_work', revealed: true })}
                                className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Need help
                              </button>
                            </div>
                            {response?.revealed && (
                              <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
                                <p>
                                  <span className="font-semibold text-slate-900">Answer: </span>
                                  {item.answer}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-900">Why: </span>
                                  {item.explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Mastery check</h2>
                <p className="mt-2 text-sm leading-6 text-slate-800">{variant.masteryCheck}</p>
              </section>
            </div>
          </article>
        )}
      </div>
    </main>
  );
};

export default MathAdaptiveVariantPage;
