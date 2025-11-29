import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  LinkIcon,
  Loader2,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatSubjectLabel, normalizeSubject } from '../lib/subjects';

import { fetchModuleAssessment, fetchModuleDetail, fetchRecommendations } from '../services/catalogService';

const formatMinutes = (value: number | null): string =>
  value && Number.isFinite(value) ? `${value} min` : 'Flexible';

const MARKDOWN_PLUGINS = [remarkGfm];

const ModulePage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const moduleId = Number.parseInt(params.id ?? '', 10);
  const [lastScore, setLastScore] = useState<number>(80);
  const [quizOpen, setQuizOpen] = useState<boolean>(false);
  const [expandedLessonId, setExpandedLessonId] = useState<number | null>(null);

  const detailQuery = useQuery({
    queryKey: ['module-detail', moduleId],
    queryFn: () => fetchModuleDetail(moduleId),
    enabled: Number.isFinite(moduleId),
  });

  const recommendationsQuery = useQuery({
    queryKey: ['module-recommendations', moduleId, lastScore],
    queryFn: () => fetchRecommendations(moduleId, lastScore),
    enabled: Number.isFinite(moduleId),
  });

  useEffect(() => {
    setQuizOpen(false);
    setExpandedLessonId(null);
  }, [moduleId]);

  const moduleDetail = detailQuery.data;
  const recommendations = recommendationsQuery.data ?? [];

  const baselineAssessment = useMemo(() => {
    const assessments = moduleDetail?.assessments ?? [];
    const preferred = assessments.find(
      (assessment) => assessment.purpose?.toLowerCase() === 'baseline',
    );
    return preferred ?? assessments[0] ?? null;
  }, [moduleDetail?.assessments]);

  const quizQuery = useQuery({
    queryKey: ['module-assessment', moduleId],
    queryFn: () => fetchModuleAssessment(moduleId),
    enabled: quizOpen && Number.isFinite(moduleId) && baselineAssessment != null,
    staleTime: 5 * 60 * 1000,
  });

  const formatRate = (value: number): string => {
    if (!Number.isFinite(value)) return '—';
    return `${Math.round(value * 100)}%`;
  };

  const formatAverage = (value: number | null): string => {
    if (value == null || !Number.isFinite(value)) {
      return '—';
    }
    return `${Math.round(value)}%`;
  };

  const quizButtonDisabled = !baselineAssessment;
  const quizButtonLabel = quizOpen ? 'Hide quiz preview' : 'Try quiz';
  const quizData = quizQuery.data ?? null;

  const toggleLessonPreview = (lessonId: number) => {
    setExpandedLessonId((previous) => (previous === lessonId ? null : lessonId));
  };

  const isLessonExpanded = (lessonId: number) => expandedLessonId === lessonId;

  const pageTitle = moduleDetail?.module.title ?? 'Module';

  const openTrackTag = useMemo(() => {
    if (!moduleDetail?.module.openTrack) return null;
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-600 text-xs font-semibold">
        <Sparkles className="h-3 w-3 mr-1" />
        Open Track
      </span>
    );
  }, [moduleDetail?.module.openTrack]);

  if (!Number.isFinite(moduleId)) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center text-gray-500">
        Invalid module identifier.
      </div>
    );
  }

  if (detailQuery.isLoading || !moduleDetail) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] text-brand-blue">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading module…
      </div>
    );
  }

  const { module: core, lessons, moduleAssets } = moduleDetail;
  const normalizedSubject = normalizeSubject(core.subject);
  const subjectLabel = normalizedSubject ? formatSubjectLabel(normalizedSubject) : core.subject;
  const firstLesson = lessons[0] ?? null;
  const totalLessonAssets = useMemo(
    () => lessons.reduce((sum, lesson) => sum + lesson.assets.length, 0),
    [lessons],
  );
  const totalAssets = totalLessonAssets + moduleAssets.length;
  const openTrackLessonCount = useMemo(
    () => lessons.filter((lesson) => lesson.openTrack).length,
    [lessons],
  );
  const standardsHighlight = useMemo(
    () => moduleDetail.standards.slice(0, 6),
    [moduleDetail.standards],
  );
  const hasAssessments = moduleDetail.assessments.length > 0;

  return (
    <div className="bg-slate-50 min-h-screen pb-16">
      <header className="bg-white border-b border-slate-200 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col gap-4">
          <div className="text-sm text-brand-blue uppercase tracking-wide font-semibold">
            {subjectLabel ?? core.subject} · Grade {core.gradeBand}
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{pageTitle}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            {core.strand && <span>Focus area: {core.strand}</span>}
            {core.topic && <span>Skill target: {core.topic}</span>}
            {openTrackTag}
          </div>
          <p className="text-slate-600 max-w-3xl">
            {core.summary ??
              'Curated lesson sequence with fully vetted open-licensed assets and ready-to-go classroom activities.'}
          </p>
          {core.licenseRequirement && (
            <div className="text-xs text-slate-500">
              License requirements: {core.licenseRequirement}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {firstLesson && (
              <Link
                to={`/lesson/${firstLesson.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-blue/90"
              >
                <PlayCircle className="h-4 w-4" /> Launch first lesson
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                if (!baselineAssessment) return;
                setQuizOpen((prev) => !prev);
              }}
              disabled={quizButtonDisabled}
              title={quizButtonDisabled ? 'Baseline quiz coming soon' : 'Preview adaptive baseline quiz'}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                quizButtonDisabled
                  ? 'border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                  : 'border border-brand-blue/30 bg-white text-brand-blue hover:bg-brand-blue/10'
              }`}
            >
              {quizButtonLabel}
            </button>
            <a
              href="#module-assets"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
            >
              Review module assets
            </a>
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
            >
              Back to catalog
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section id="lesson-lineup" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-brand-blue" />
                Lesson lineup ({lessons.length})
              </h2>
            </div>
            <div className="mt-6 space-y-4">
              {lessons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
                  Lessons for this module are being curated.
                </div>
              ) : (
                lessons.map((lesson, index) => {
                  const expanded = isLessonExpanded(lesson.id);
                  return (
                    <div key={lesson.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue/10 text-sm font-semibold text-brand-blue">
                              {index + 1}
                            </span>
                            <div>
                              <div className="text-base font-semibold text-slate-900">{lesson.title}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" /> {formatMinutes(lesson.estimatedDurationMinutes)}
                                </span>
                                <span>
                                  {lesson.assets.length} supporting asset{lesson.assets.length === 1 ? '' : 's'}
                                </span>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  lesson.openTrack ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-600'
                                }`}
                                >
                                  {lesson.openTrack ? 'Open track friendly' : 'Core lesson'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/lesson/${lesson.id}`}
                            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-blue/90"
                          >
                            Launch lesson <PlayCircle className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleLessonPreview(lesson.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
                          >
                            {expanded ? 'Hide preview' : 'Preview plan'}
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                          <ReactMarkdown
                            className="prose prose-sm max-w-none text-slate-700"
                            remarkPlugins={MARKDOWN_PLUGINS}
                          >
                            {lesson.content}
                          </ReactMarkdown>
                          {lesson.assets.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                              {lesson.assets.map((asset) => (
                                <div key={asset.id} className="text-sm">
                                  <a
                                    className="text-brand-blue font-medium hover:underline"
                                    href={asset.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {asset.title ?? asset.url}
                                  </a>
                                  <div className="text-xs text-slate-500">
                                    {asset.license} · {asset.attributionText ?? 'Attribution available'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {lesson.attributionBlock && (
                            <ReactMarkdown
                              className="text-xs text-slate-500 border-t border-slate-200 pt-3 [&_a]:text-brand-blue [&_a]:underline"
                              remarkPlugins={MARKDOWN_PLUGINS}
                            >
                              {lesson.attributionBlock}
                            </ReactMarkdown>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section id="module-assets" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-brand-blue" /> Module assets
            </h2>
            {moduleAssets.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">This module does not include standalone assets yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {moduleAssets.map((asset) => (
                  <div key={asset.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <a
                          className="text-brand-blue font-semibold hover:underline"
                          href={asset.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {asset.title ?? asset.url}
                        </a>
                        {asset.description && (
                          <p className="text-sm text-slate-600 mt-1">{asset.description}</p>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 md:text-right">
                        {asset.kind} · {asset.license}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {moduleDetail.standards.length > 0 && (
            <section id="standards-alignment" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Standards alignment</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {moduleDetail.standards.map((standard) => (
                  <div key={standard.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{standard.code}</div>
                        <div className="text-xs text-slate-500">{standard.framework}</div>
                      </div>
                      {standard.alignmentStrength && (
                        <span className="text-[11px] uppercase tracking-wide text-brand-blue font-semibold">
                          {standard.alignmentStrength}
                        </span>
                      )}
                    </div>
                    {standard.description && (
                      <p className="text-sm text-slate-600 mt-2">{standard.description}</p>
                    )}
                    {standard.notes && (
                      <p className="text-xs text-slate-500 mt-2">{standard.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {quizOpen && baselineAssessment && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Baseline quiz preview</h2>
                  <p className="text-sm text-slate-500">
                    Explore the current questions before assigning or sharing the adaptive check-in.
                  </p>
                </div>
                {quizQuery.isFetching && <Loader2 className="h-5 w-5 animate-spin text-brand-blue" />}
              </div>

              {quizQuery.isLoading ? (
                <div className="flex items-center gap-2 text-brand-blue mt-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading quiz…
                </div>
              ) : quizQuery.isError ? (
                <div className="text-sm text-rose-600 mt-4">
                  We couldn’t load the quiz preview. Please try again in a moment.
                </div>
              ) : !quizData || quizData.sections.length === 0 ? (
                <div className="text-sm text-slate-500 mt-4">
                  Quiz structure will be available soon.
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {quizData.sections.map((section) => (
                    <div key={section.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
                          {section.instructions && (
                            <p className="text-sm text-slate-500 mt-1">{section.instructions}</p>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {section.questions.length} question{section.questions.length === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div className="mt-4 space-y-4">
                        {section.questions.map((question, index) => (
                          <div key={question.id} className="bg-white border border-slate-200 rounded-lg p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">
                                  Q{index + 1}. {question.prompt}
                                </div>
                                {question.standards.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {question.standards.map((standard) => (
                                      <span
                                        key={standard}
                                        className="text-[11px] uppercase tracking-wide text-brand-blue font-semibold bg-brand-blue/10 px-2 py-1 rounded-md"
                                      >
                                        {standard}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {question.difficulty != null && (
                                <span className="text-xs text-slate-500">Difficulty {question.difficulty}</span>
                              )}
                            </div>
                            <ul className="mt-3 space-y-2">
                              {question.options.map((option) => (
                                <li
                                  key={option.id}
                                  className={`text-sm border border-slate-200 rounded-md px-3 py-2 ${
                                    option.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-700">{option.content}</span>
                                    {option.isCorrect && (
                                      <span className="text-[11px] uppercase text-emerald-600 font-semibold">
                                        Correct
                                      </span>
                                    )}
                                  </div>
                                  {option.feedback && (
                                    <div className="text-xs text-slate-500 mt-1">{option.feedback}</div>
                                  )}
                                </li>
                              ))}
                            </ul>
                            {question.explanation && (
                              <div className="text-xs text-slate-500 mt-3 border-t border-slate-200 pt-2">
                                {question.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {hasAssessments && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-brand-blue" /> Assessment toolkit
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {moduleDetail.assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-800">{assessment.title}</div>
                        {assessment.purpose && (
                          <span className="mt-1 inline-flex items-center rounded-full bg-brand-blue/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-brand-blue">
                            {assessment.purpose}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{formatMinutes(assessment.estimatedDurationMinutes)}</div>
                    </div>
                    {assessment.description && (
                      <p className="text-sm text-slate-600">{assessment.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>
                        {assessment.questionCount} question{assessment.questionCount === 1 ? '' : 's'}
                      </span>
                      <span>{assessment.attemptCount} attempt{assessment.attemptCount === 1 ? '' : 's'}</span>
                      <span>Completion {formatRate(assessment.completionRate)}</span>
                      <span>Avg score {formatAverage(assessment.averageScore)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Adaptive recommendations</h2>
                <p className="text-sm text-slate-500">
                  Provide a recent assessment score to personalize the next module suggestions.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600">Last score:</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={lastScore}
                  onChange={(event) => setLastScore(Number.parseInt(event.target.value, 10) || 0)}
                  className="w-20 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                />
              </div>
            </div>

            {recommendationsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-brand-blue mt-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating…
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-sm text-slate-500 mt-4">No recommendations available yet.</div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {recommendations.map((recommendation) => (
                  <div
                    key={recommendation.id}
                    className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col gap-2"
                  >
                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                      Grade {recommendation.gradeBand}
                    </div>
                    <div className="text-base font-semibold text-slate-900">{recommendation.title}</div>
                    <div className="text-xs text-slate-500">{recommendation.reason}</div>
                    {recommendation.fallback && (
                      <div className="text-[11px] text-amber-600 font-medium">Subject fallback</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-brand-blue" /> Quick start
            </h2>
            <div className="mt-4 space-y-3">
              {firstLesson ? (
                <Link
                  to={`/lesson/${firstLesson.id}`}
                  className="flex items-center justify-between rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue/90"
                >
                  Launch {firstLesson.title}
                  <PlayCircle className="h-4 w-4" />
                </Link>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
                  Lessons are being added soon.
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!baselineAssessment) return;
                  setQuizOpen(true);
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                disabled={quizButtonDisabled}
                className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  quizButtonDisabled
                    ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'border-brand-blue/30 text-brand-blue hover:bg-brand-blue/10'
                }`}
              >
                Preview baseline quiz
              </button>
              <a
                href="#module-assets"
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
              >
                Review module assets
                <LinkIcon className="h-4 w-4" />
              </a>
            </div>
            {baselineAssessment && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-2">
                <div className="text-sm font-semibold text-slate-700">Baseline quiz at a glance</div>
                <div className="flex flex-wrap gap-4">
                  <span>{baselineAssessment.questionCount} questions</span>
                  <span>Completion {formatRate(baselineAssessment.completionRate)}</span>
                  <span>Avg score {formatAverage(baselineAssessment.averageScore)}</span>
                </div>
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Module snapshot</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li><span className="font-semibold text-slate-700">Subject:</span> {subjectLabel}</li>
              <li><span className="font-semibold text-slate-700">Grade band:</span> {core.gradeBand}</li>
              <li><span className="font-semibold text-slate-700">Lessons:</span> {lessons.length}</li>
              <li>
                <span className="font-semibold text-slate-700">Open track lessons:</span> {openTrackLessonCount}
              </li>
              <li>
                <span className="font-semibold text-slate-700">Total assets:</span> {totalAssets}
              </li>
            </ul>
            {core.licenseRequirement && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Licensing: {core.licenseRequirement}
              </p>
            )}
            {core.notes && (
              <p className="mt-3 text-xs text-slate-500 border-t border-slate-200 pt-3">{core.notes}</p>
            )}
          </section>

          {standardsHighlight.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Standards focus</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {standardsHighlight.map((standard) => (
                  <a
                    key={standard.id}
                    href="#standards-alignment"
                    className="inline-flex items-center rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-semibold text-brand-blue hover:bg-brand-blue/20"
                  >
                    {standard.code}
                  </a>
                ))}
              </div>
              <a
                href="#standards-alignment"
                className="mt-3 inline-block text-xs font-medium text-brand-blue hover:underline"
              >
                View detailed alignment
              </a>
            </section>
          )}
        </aside>
      </main>
    </div>
  );
};

export default ModulePage;
