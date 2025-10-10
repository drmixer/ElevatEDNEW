import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Loader2,
  PlayCircle,
  Sparkles,
  Video,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { fetchLessonDetail } from '../services/catalogService';
import { useLessonProgress } from '../lib/useLessonProgress';
import { useAuth } from '../contexts/AuthContext';

const MARKDOWN_PLUGINS = [remarkGfm];

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'section';

const extractText = (value: React.ReactNode): string => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(extractText).join('');
  }
  if (React.isValidElement(value)) {
    return extractText(value.props.children);
  }
  return '';
};

const formatDuration = (value: number | null): string => {
  if (!value || !Number.isFinite(value)) {
    return 'Flexible pacing';
  }
  return `${value} minute${value === 1 ? '' : 's'}`;
};

const isVideoAsset = (url: string, kind?: string): boolean => {
  const normalizedKind = (kind ?? '').toLowerCase();
  if (normalizedKind.includes('video')) {
    return true;
  }
  return /youtu\.be|youtube\.com|vimeo\.com/.test(url);
};

const getVideoEmbedUrl = (rawUrl: string): string | null => {
  try {
    const url = new URL(rawUrl);
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v');
      if (id) {
        return `https://www.youtube.com/embed/${id}`;
      }
    }
    if (url.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${url.pathname}`;
    }
    if (url.hostname.includes('vimeo.com')) {
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        return `https://player.vimeo.com/video/${segments[segments.length - 1]}`;
      }
    }
    return null;
  } catch (error) {
    console.warn('Unable to parse media url for embed', error);
    return null;
  }
};

const isOpenLicense = (license: string | null | undefined): boolean => {
  if (!license) {
    return false;
  }
  const normalized = license.toLowerCase();
  return (
    normalized.includes('cc') ||
    normalized.includes('creative commons') ||
    normalized.includes('public domain') ||
    normalized.includes('open')
  );
};

const LessonPlayerPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const lessonId = Number.parseInt(params.id ?? '', 10);
  const [showOpenOnly, setShowOpenOnly] = useState(false);

  const isLessonIdValid = Number.isFinite(lessonId);

  const lessonQuery = useQuery({
    queryKey: ['lesson-detail', lessonId],
    queryFn: () => fetchLessonDetail(lessonId),
    enabled: isLessonIdValid,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [lessonId]);

  const lessonDetail = lessonQuery.data ?? null;

  const sections = useMemo(() => {
    if (!lessonDetail) {
      return [] as Array<{ id: string; label: string }>;
    }
    const matches = Array.from(lessonDetail.lesson.content.matchAll(/^##+\s+(.+)$/gm));
    const seen = new Set<string>();
    const extracted = matches.map((match, index) => {
      const raw = match[1].trim();
      let slug = slugify(raw);
      if (slug === 'section') {
        slug = `section-${index}`;
      }
      if (seen.has(slug)) {
        let dedupe = 1;
        while (seen.has(`${slug}-${dedupe}`)) {
          dedupe += 1;
        }
        slug = `${slug}-${dedupe}`;
      }
      seen.add(slug);
      return { id: slug, label: raw };
    });
    if (extracted.length === 0) {
      return [{ id: 'overview', label: 'Lesson overview' }];
    }
    return extracted;
  }, [lessonDetail?.lesson.content]);

  const progressItems = useMemo(() => {
    if (!lessonDetail) {
      return [] as Array<{ id: string; label: string }>;
    }
    const items = sections.map((section) => ({ id: `section:${section.id}`, label: section.label }));
    if (lessonDetail.lesson.assets.length > 0) {
      items.push({ id: 'assets', label: 'Supporting resources explored' });
    }
    items.push({ id: 'reflection', label: 'Reflection logged' });
    return items;
  }, [lessonDetail, sections]);

  const progressItemIds = useMemo(
    () => progressItems.map((item) => item.id),
    [progressItems],
  );

  const studentId = user?.role === 'student' ? user.id : null;

  const progressController = useLessonProgress(
    isLessonIdValid ? lessonId : null,
    progressItemIds,
    lessonDetail && studentId
      ? {
          studentId,
          moduleId: lessonDetail.module.id,
          moduleTitle: lessonDetail.module.title,
          lessonTitle: lessonDetail.lesson.title,
          subject: lessonDetail.module.subject,
        }
      : { studentId: null },
  );

  const progressDisabled = progressController.isLoading || progressController.isSaving;

  const sectionLookup = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    sections.forEach((section) => {
      map.set(section.label.toLowerCase(), section);
    });
    return map;
  }, [sections]);

  const moduleLessons = lessonDetail?.moduleLessons ?? [];
  const currentLessonIndex = moduleLessons.findIndex((item) => item.id === lessonDetail?.lesson.id);
  const previousLesson = currentLessonIndex > 0 ? moduleLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < moduleLessons.length - 1
      ? moduleLessons[currentLessonIndex + 1]
      : null;

  const filteredAssets = useMemo(() => {
    if (!lessonDetail) {
      return [];
    }
    if (!showOpenOnly) {
      return lessonDetail.lesson.assets;
    }
    return lessonDetail.lesson.assets.filter((asset) => isOpenLicense(asset.license));
  }, [lessonDetail, showOpenOnly]);

  if (!isLessonIdValid) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center text-slate-500">
        <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-4" />
        Invalid lesson identifier.
      </div>
    );
  }

  if (lessonQuery.isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-brand-blue">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        Loading lesson experience…
      </div>
    );
  }

  if (lessonQuery.isError || !lessonDetail) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center text-rose-500">
        <AlertTriangle className="w-10 h-10 mx-auto mb-4" />
        We couldn’t load this lesson. Please return to the module and try again.
      </div>
    );
  }

  const headingRenderer = (tag: 'h2' | 'h3') =>
    ({ node, ...props }: { node?: unknown } & React.HTMLAttributes<HTMLHeadingElement>) => {
      const { children, className, ...rest } = props;
      const text = extractText(children).trim();
      const lookupKey = text.toLowerCase();
      const section = sectionLookup.get(lookupKey);
      const progressId = section ? `section:${section.id}` : null;
      const anchorId = section ? section.id : slugify(text);
      const baseStyles =
        tag === 'h2'
          ? 'text-2xl font-semibold text-slate-900'
          : 'text-xl font-semibold text-slate-800';
      const mergedClassName = className ? `${className} ${baseStyles}` : baseStyles;

      return (
        <div id={anchorId} className="flex items-start justify-between gap-4 pt-8 scroll-mt-24">
          {React.createElement(tag, { className: mergedClassName, ...rest }, children)}
          {progressId && (
            <button
              type="button"
              disabled={progressDisabled}
              onClick={() => progressController.toggleItem(progressId)}
              aria-pressed={progressController.isComplete(progressId)}
              className="mt-1 inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-400 hover:text-brand-blue hover:border-brand-blue/40"
              title={
                progressController.isComplete(progressId)
                  ? 'Mark section as in progress'
                  : 'Mark section as completed'
              }
            >
              {progressController.isComplete(progressId) ? (
                <CheckCircle2 className="h-5 w-5 text-brand-blue" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      );
    };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 pb-20">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
          <div className="flex flex-wrap items-center gap-4 text-sm text-brand-blue/80">
            <Link to="/catalog" className="inline-flex items-center gap-2 hover:text-brand-blue">
              <ArrowLeft className="h-4 w-4" /> Back to catalog
            </Link>
            <span className="text-slate-300">/</span>
            <Link
              to={`/module/${lessonDetail.module.id}`}
              className="inline-flex items-center gap-2 hover:text-brand-blue"
            >
              <PlayCircle className="h-4 w-4" /> {lessonDetail.module.title}
            </Link>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="text-sm uppercase tracking-wide text-brand-blue font-semibold">
                {lessonDetail.module.subject} · Grade {lessonDetail.module.gradeBand}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                {lessonDetail.lesson.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {formatDuration(lessonDetail.lesson.estimatedDurationMinutes)}
                </span>
                {lessonDetail.lesson.openTrack && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-600">
                    <Sparkles className="h-3 w-3" /> Open Track friendly
                  </span>
                )}
                {lessonDetail.module.openTrack && !lessonDetail.lesson.openTrack && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    <Sparkles className="h-3 w-3 text-slate-500" /> Module offers open track alt
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {previousLesson && (
                <Link
                  to={`/lesson/${previousLesson.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4" /> Previous
                </Link>
              )}
              {nextLesson && (
                <Link
                  to={`/lesson/${nextLesson.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue/90"
                >
                  Next lesson <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-10 grid gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Progress tracker</h2>
              <span className="text-sm font-semibold text-brand-blue">
                {progressController.progress}%
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Check off sections as you facilitate the lesson to keep your session pacing on track.
            </p>
            <div className="mt-4 h-2 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-blue transition-all"
                style={{ width: `${progressController.progress}%` }}
              />
            </div>
            {(progressController.isLoading || progressController.isSaving) && (
              <p className="mt-2 text-xs text-slate-400">
                {progressController.isLoading ? 'Loading saved progress…' : 'Syncing progress…'}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={progressDisabled}
                onClick={progressController.markComplete}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-blue/90"
              >
                Mark all complete
              </button>
              <button
                type="button"
                onClick={progressController.reset}
                disabled={progressDisabled || progressController.progress === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Reset
              </button>
            </div>
            <ul className="mt-5 space-y-2">
              {progressItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={progressDisabled}
                    onClick={() => progressController.toggleItem(item.id)}
                    aria-pressed={progressController.isComplete(item.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                      progressController.isComplete(item.id)
                        ? 'border-brand-blue/60 bg-brand-blue/10 text-brand-blue'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-brand-blue/40 hover:text-brand-blue'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {progressController.isComplete(item.id) ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                      <span>{item.label}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Lesson navigation</h2>
            <div className="space-y-2">
              {moduleLessons.map((lesson, index) => {
                const active = lesson.id === lessonDetail.lesson.id;
                return (
                  <Link
                    key={lesson.id}
                    to={`/lesson/${lesson.id}`}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'border-brand-blue/60 bg-brand-blue/10 text-brand-blue'
                        : 'border-slate-200 hover:border-brand-blue/40 hover:text-brand-blue'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                        {index + 1}
                      </span>
                      {lesson.title}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDuration(lesson.estimatedDurationMinutes)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {lessonDetail.standards.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900">Standards alignment</h2>
              <div className="mt-4 space-y-3 text-sm">
                {lessonDetail.standards.map((standard) => (
                  <div key={standard.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="font-semibold text-slate-700">{standard.code}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {standard.framework}
                    </div>
                    {standard.description && (
                      <p className="mt-2 text-slate-600">{standard.description}</p>
                    )}
                    {standard.alignmentStrength && (
                      <div className="mt-2 text-[11px] font-semibold uppercase text-brand-blue">
                        {standard.alignmentStrength}
                      </div>
                    )}
                    {standard.notes && (
                      <p className="mt-2 text-xs text-slate-500">{standard.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>

        <section className="space-y-8">
          <article className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
            <ReactMarkdown
              className="prose prose-slate max-w-none"
              remarkPlugins={MARKDOWN_PLUGINS}
              components={{
                h2: headingRenderer('h2'),
                h3: headingRenderer('h3'),
                a: ({ node, ...rest }) => (
                  <a {...rest} target="_blank" rel="noreferrer" />
                ),
              }}
            >
              {lessonDetail.lesson.content}
            </ReactMarkdown>
            {lessonDetail.lesson.attributionBlock && (
              <ReactMarkdown
                className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500 [&_a]:text-brand-blue [&_a]:underline"
                remarkPlugins={MARKDOWN_PLUGINS}
              >
                {lessonDetail.lesson.attributionBlock}
              </ReactMarkdown>
            )}
          </article>

          <article className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <Video className="h-5 w-5 text-brand-blue" /> Learning resources
                </h2>
                <p className="text-sm text-slate-500">
                  Launch media and supporting materials without leaving the experience.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showOpenOnly}
                  onChange={(event) => setShowOpenOnly(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                />
                Show open-licensed resources only
              </label>
            </div>

            {filteredAssets.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                {showOpenOnly
                  ? 'No open-licensed resources for this lesson yet.'
                  : 'Supporting assets will appear here once linked to this lesson.'}
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {filteredAssets.map((asset) => {
                  const isVideo = isVideoAsset(asset.url, asset.kind);
                  const embedUrl = isVideo ? getVideoEmbedUrl(asset.url) : null;
                  return (
                    <div
                      key={asset.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-base font-semibold text-slate-800">
                            {asset.title ?? asset.url}
                          </div>
                          {asset.description && (
                            <p className="text-sm text-slate-500 mt-1">{asset.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className="rounded-full bg-white px-2 py-1 font-medium text-slate-600">
                              {asset.kind ?? 'Resource'}
                            </span>
                            <span
                              className={`rounded-full px-2 py-1 font-medium ${
                                isOpenLicense(asset.license)
                                  ? 'bg-emerald-100 text-emerald-600'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {asset.license}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!progressDisabled && !progressController.isComplete('assets')) {
                              progressController.toggleItem('assets');
                            }
                            window.open(asset.url, '_blank', 'noopener,noreferrer');
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-brand-blue/40 px-3 py-2 text-sm font-medium text-brand-blue hover:bg-brand-blue/10"
                        >
                          Open resource <ExternalLink className="h-4 w-4" />
                        </button>
                      </div>
                      {embedUrl ? (
                        <div className="mt-4 overflow-hidden rounded-xl bg-black">
                          <iframe
                            src={embedUrl}
                            title={asset.title ?? 'Lesson video'}
                            className="h-64 w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : isVideo ? (
                        <video controls className="mt-4 w-full rounded-xl">
                          <source src={asset.url} />
                          Your browser does not support the video tag.
                        </video>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          <article className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Wrap-up & reflection</h2>
                <p className="text-sm text-slate-500">
                  Capture learner takeaways or next steps, then mark the reflection complete.
                </p>
              </div>
              <button
                type="button"
                disabled={progressDisabled}
                onClick={() => progressController.toggleItem('reflection')}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  progressController.isComplete('reflection')
                    ? 'border-brand-blue/50 bg-brand-blue/10 text-brand-blue'
                    : 'border-slate-200 text-slate-600 hover:border-brand-blue/40 hover:text-brand-blue'
                }`}
              >
                {progressController.isComplete('reflection') ? 'Reflection complete' : 'Mark reflection complete'}
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm text-slate-600">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                Celebrate success: Which moments energized the class?
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                Spot challenges: Where did learners need more scaffolding?
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                Plan forward: Note tomorrow’s warm-up or follow-up support.
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
};

export default LessonPlayerPage;
