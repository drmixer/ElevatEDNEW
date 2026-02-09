/**
 * LearnPhase Component
 * 
 * Main learning content phase with section-by-section navigation.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Bot, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { LessonCard, LessonCardBody, LessonCardFooter } from '../LessonCard';
import { LessonNavigation } from '../LessonNavigation';
import { useLessonStepper } from '../LessonStepper';
import type { LessonSection } from '../../../types/lesson';
import getTutorResponse from '../../../services/getTutorResponse';
import { extractPerimeterDimensionsFromText, getSectionVisual } from '../../../lib/lessonVisuals';
import trackEvent from '../../../lib/analytics';
import { getGrade2MathPilotTopic, type Grade2MathPilotTopic } from '../../../lib/pilotConditions';
import { getDeterministicGrade2MathCheckpoint, getGrade2MathCheckpointHint, getGrade2MathQuickReview } from '../../../lib/pilotGrade2Math';
import {
    getDeterministicK5MathCheckpoint,
    getDeterministicK5MathQuickReview,
    getK5MathAdaptationTopic,
    getK5MathCheckpointHint,
    isK5MathAdaptiveLesson,
} from '../../../lib/k5MathAdaptation';
import { fetchRemoteImage, type RemoteImageResult } from '../../../lib/remoteImageSearch';

interface LearnPhaseProps {
    sections: LessonSection[];
    lessonId?: number;
    pilotTelemetryEnabled?: boolean;
    pilotTopic?: Grade2MathPilotTopic | null;
    lessonTitle?: string;
    subject?: string;
    gradeBand?: string;
    onAskTutor?: (context: string) => void;
    onSectionComplete?: (sectionIndex: number) => void;
}

type CheckpointPayload = {
    visual?: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
};

type CheckpointIntent = 'define' | 'compute' | 'scenario';

type CheckpointState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; payload: CheckpointPayload; intent: CheckpointIntent; selectedIndex: number | null; isCorrect: boolean | null }
    | { status: 'error'; message: string };

type QuickReviewState = {
    isVisible: boolean;
    selectedIndex: number | null;
    isCorrect: boolean | null;
};

const getPilotCheckpointCacheKey = (lessonId: number | undefined, sectionIndex: number, intent: CheckpointIntent) => {
    const lid = typeof lessonId === 'number' && Number.isFinite(lessonId) ? lessonId : 'unknown';
    return `pilot_checkpoint_v2:${lid}:${sectionIndex}:${intent}`;
};

const clampText = (value: string, maxChars: number): string => {
    const trimmed = value.trim();
    if (trimmed.length <= maxChars) return trimmed;
    return `${trimmed.slice(0, maxChars).trim()}…`;
};

const extractJsonObject = (raw: string): string | null => {
    // Try to extract the first top-level JSON object from a model response.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return raw.slice(start, end + 1);
};

const mulberry32 = (seed: number) => {
    let t = seed >>> 0;
    return () => {
        t += 0x6D2B79F5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
};

const shuffleWithCorrectIndex = (
    options: string[],
    correctIndex: number,
    seed: number,
): { options: string[]; correctIndex: number } => {
    const safeOptions = options.map((o) => (o ?? '').toString().trim()).filter(Boolean);
    if (safeOptions.length < 3) {
        return { options: safeOptions, correctIndex: Math.max(0, Math.min(correctIndex, safeOptions.length - 1)) };
    }

    const correctText = safeOptions[Math.max(0, Math.min(correctIndex, safeOptions.length - 1))] ?? safeOptions[0] ?? '';
    const wrongs = safeOptions.filter((_, idx) => idx !== correctIndex);

    const rand = mulberry32(seed);
    for (let i = wrongs.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [wrongs[i], wrongs[j]] = [wrongs[j], wrongs[i]];
    }

    const targetIndex = Math.abs(seed) % safeOptions.length;
    const arranged: string[] = new Array(safeOptions.length);
    arranged[targetIndex] = correctText;
    let w = 0;
    for (let i = 0; i < arranged.length; i += 1) {
        if (i === targetIndex) continue;
        arranged[i] = wrongs[w] ?? wrongs[0] ?? '';
        w += 1;
    }

    return { options: arranged, correctIndex: targetIndex };
};

const containsBannedGenericCoaching = (text: string): boolean => {
    const t = (text ?? '').toString().toLowerCase();
    return /(study strategy|study strategies|ask for help|ask a teacher|teacher|main concept|real-life situation|memorize|practice more|use a calculator|copy someone)/i.test(t);
};

const payloadHasNumbers = (payload: CheckpointPayload): boolean => /\d/.test(`${payload.question} ${payload.options.join(' ')}`);

const isValidCheckpointPayload = (payload: CheckpointPayload, intent: CheckpointIntent): boolean => {
    if (!payload.question.trim()) return false;
    if (!Array.isArray(payload.options) || payload.options.length < 3 || payload.options.length > 4) return false;
    if (payload.correctIndex < 0 || payload.correctIndex >= payload.options.length) return false;
    if (!payload.explanation.trim()) return false;
    if (containsBannedGenericCoaching(payload.question) || containsBannedGenericCoaching(payload.explanation)) return false;
    if (payload.options.some((o) => containsBannedGenericCoaching(o))) return false;
    if (intent === 'compute' && !payloadHasNumbers(payload)) return false;
    return true;
};

type ShapeType = 'square' | 'rectangle' | 'triangle';

const shapePillStyles: Record<ShapeType, { label: string; className: string }> = {
    square: { label: 'Square', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
    rectangle: { label: 'Rectangle', className: 'border-indigo-200 bg-indigo-50 text-indigo-800' },
    triangle: { label: 'Triangle', className: 'border-amber-200 bg-amber-50 text-amber-900' },
};

export const LearnPhase: React.FC<LearnPhaseProps> = ({
    sections,
    lessonId,
    pilotTelemetryEnabled,
    pilotTopic,
    lessonTitle,
    subject,
    gradeBand,
    onAskTutor,
    onSectionComplete,
}) => {
    const topRef = useRef<HTMLDivElement | null>(null);
    const {
        currentSectionIndex,
        nextPhase,
        nextSection,
        previousSection,
        previousPhase,
        hasPracticeQuestions,
    } = useLessonStepper();

    const currentSection = sections[currentSectionIndex] || sections[0];
    const hasMultipleSections = sections.length > 1;
    const isLastSection = currentSectionIndex >= sections.length - 1;
    const isFirstSection = currentSectionIndex === 0;

    useEffect(() => {
        // When moving between sections, reset scroll so the new section starts at the top.
        // This avoids loading the next section at the previous scroll position.
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [currentSectionIndex]);

    const checkpointIntent: CheckpointIntent = useMemo(() => {
        const intents: CheckpointIntent[] = ['define', 'compute', 'scenario'];
        return intents[currentSectionIndex % intents.length] ?? 'define';
    }, [currentSectionIndex]);

    const resolvedPilotTopic = useMemo(() => {
        if (pilotTopic) return pilotTopic;
        return getGrade2MathPilotTopic({ subject, gradeBand, lessonTitle });
    }, [gradeBand, lessonTitle, pilotTopic, subject]);

    const resolvedK5MathTopic = useMemo(() => {
        return getK5MathAdaptationTopic({
            subject: subject ?? null,
            gradeBand: gradeBand ?? null,
            lessonTitle: lessonTitle ?? null,
            lessonContent: currentSection?.content ?? '',
        });
    }, [currentSection?.content, gradeBand, lessonTitle, subject]);

    const checkpointEnabled = useMemo(() => {
        return isK5MathAdaptiveLesson({
            subject: subject ?? null,
            gradeBand: gradeBand ?? null,
            lessonTitle: lessonTitle ?? null,
            lessonContent: currentSection?.content ?? '',
        });
    }, [currentSection?.content, gradeBand, lessonTitle, subject]);

    const sectionVisual = useMemo(() => {
        if (!currentSection) return null;
        return getSectionVisual({
            lessonTitle: lessonTitle ?? null,
            subject: subject ?? null,
            gradeBand: gradeBand ?? null,
            sectionTitle: currentSection.title ?? null,
            sectionContent: currentSection.content ?? '',
        });
    }, [currentSection, gradeBand, lessonTitle, subject]);

    const [contextImage, setContextImage] = useState<RemoteImageResult | null>(null);
    const [contextImageStatus, setContextImageStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

    const contextImageQuery = useMemo(() => {
        const text = `${currentSection?.title ?? ''}\n${currentSection?.content ?? ''}`;
        if (!text.trim()) return null;
        if (/\bgreat\s+wall\b/i.test(text) || /great\s+wall\s+of\s+china/i.test(text)) {
            return 'Great Wall of China';
        }
        return null;
    }, [currentSection?.content, currentSection?.title]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!contextImageQuery) {
                setContextImage(null);
                setContextImageStatus('idle');
                return;
            }

            setContextImageStatus('loading');
            try {
                const result = await fetchRemoteImage(contextImageQuery);
                if (cancelled) return;
                setContextImage(result);
                setContextImageStatus(result ? 'ready' : 'error');
            } catch {
                if (cancelled) return;
                setContextImage(null);
                setContextImageStatus('error');
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [contextImageQuery]);

    const detectedShape: ShapeType | null = useMemo(() => {
        if (!checkpointEnabled) return null;
        const dims = extractPerimeterDimensionsFromText(currentSection?.content ?? '');
        if (dims?.shape === 'square' || dims?.shape === 'rectangle' || dims?.shape === 'triangle') {
            return dims.shape;
        }
        return null;
    }, [checkpointEnabled, currentSection?.content]);

    const [checkpointBySection, setCheckpointBySection] = useState<Map<number, CheckpointState>>(
        () => new Map(),
    );

    const [checkpointWrongAttemptsBySection, setCheckpointWrongAttemptsBySection] = useState<Map<number, number>>(
        () => new Map(),
    );

    const [quickReviewBySection, setQuickReviewBySection] = useState<Map<number, QuickReviewState>>(
        () => new Map(),
    );

    const [checkpointHintShownBySection, setCheckpointHintShownBySection] = useState<Map<number, boolean>>(
        () => new Map(),
    );

    const checkpointState: CheckpointState = useMemo(() => {
        return checkpointBySection.get(currentSectionIndex) ?? { status: 'idle' };
    }, [checkpointBySection, currentSectionIndex]);

    const quickReviewState = useMemo(() => {
        return quickReviewBySection.get(currentSectionIndex) ?? { isVisible: false, selectedIndex: null, isCorrect: null };
    }, [currentSectionIndex, quickReviewBySection]);

    const quickReviewContent = useMemo(() => {
        if (!checkpointEnabled) return null;
        if (pilotTelemetryEnabled) {
            return getGrade2MathQuickReview({
                topic: resolvedPilotTopic ?? 'perimeter',
                sectionContent: currentSection?.content ?? '',
            });
        }
        return getDeterministicK5MathQuickReview({
            lessonId,
            subject: subject ?? null,
            gradeBand: gradeBand ?? null,
            lessonTitle: lessonTitle ?? null,
            lessonContent: currentSection?.content ?? '',
            topic: resolvedK5MathTopic,
        });
    }, [checkpointEnabled, currentSection?.content, gradeBand, lessonId, lessonTitle, pilotTelemetryEnabled, resolvedK5MathTopic, resolvedPilotTopic, subject]);

    const isCheckpointHintShown = useMemo(
        () => checkpointHintShownBySection.get(currentSectionIndex) ?? false,
        [checkpointHintShownBySection, currentSectionIndex],
    );

    const hasCheckpointPassed = checkpointState.status === 'ready' && checkpointState.isCorrect === true;

    // Show appropriate button label based on whether practice questions exist
    const lastSectionLabel = hasPracticeQuestions ? 'Continue to Practice' : 'Continue to Review';

    const handleContinue = () => {
        if (checkpointEnabled && checkpointState.status !== 'error' && !hasCheckpointPassed) return;
        if (isLastSection) {
            nextPhase();
        } else {
            nextSection();
        }
    };

    const handleBack = () => {
        if (isFirstSection) {
            previousPhase();
        } else {
            previousSection();
        }
    };

    const generateCheckpoint = useCallback(async () => {
        if (!currentSection) return;
        if (!checkpointEnabled) return;

        const cacheKey = pilotTelemetryEnabled
            ? getPilotCheckpointCacheKey(lessonId, currentSectionIndex, checkpointIntent)
            : `k5_checkpoint_v1:${Number.isFinite(lessonId) ? lessonId : 'unknown'}:${currentSectionIndex}:${resolvedK5MathTopic ?? 'general'}:${checkpointIntent}`;
        const seedBase = (Number.isFinite(lessonId) ? (lessonId as number) : 0) * 10_000 + currentSectionIndex * 10;
        const intentOffset = checkpointIntent === 'define' ? 1 : checkpointIntent === 'compute' ? 2 : 3;
        const shuffleSeed = seedBase + intentOffset + 11;
        if (typeof window !== 'undefined') {
            const cached = window.sessionStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached) as { payload?: CheckpointPayload; intent?: CheckpointIntent };
                    if (parsed?.payload && parsed.intent && isValidCheckpointPayload(parsed.payload, parsed.intent)) {
                        setCheckpointBySection((prev) => {
                            const next = new Map(prev);
                            next.set(currentSectionIndex, {
                                status: 'ready',
                                payload: parsed.payload,
                                intent: parsed.intent,
                                selectedIndex: null,
                                isCorrect: null,
                            });
                            return next;
                        });
                        return;
                    }
                } catch {
                    // ignore and regenerate
                }
            }
        }

        if (!pilotTelemetryEnabled) {
            const local = getDeterministicK5MathCheckpoint({
                subject: subject ?? null,
                gradeBand: gradeBand ?? null,
                lessonTitle: lessonTitle ?? null,
                lessonContent: currentSection.content ?? '',
                intent: checkpointIntent,
                seed: seedBase + intentOffset,
                topic: resolvedK5MathTopic,
            });
            if (!local) {
                setCheckpointBySection((prev) => {
                    const next = new Map(prev);
                    next.set(currentSectionIndex, {
                        status: 'error',
                        message: 'Unable to generate checkpoint right now.',
                    });
                    return next;
                });
                return;
            }

            const shuffled = shuffleWithCorrectIndex(local.options, local.correctIndex, shuffleSeed);
            const finalLocal: CheckpointPayload = {
                ...local,
                options: shuffled.options,
                correctIndex: shuffled.correctIndex,
            };
            setCheckpointBySection((prev) => {
                const next = new Map(prev);
                next.set(currentSectionIndex, {
                    status: 'ready',
                    payload: finalLocal,
                    intent: checkpointIntent,
                    selectedIndex: null,
                    isCorrect: null,
                });
                return next;
            });
            trackEvent('success_k5_math_checkpoint_generated', {
                lessonId,
                sectionIndex: currentSectionIndex,
                source: 'deterministic',
                topic: resolvedK5MathTopic ?? 'general',
                intent: checkpointIntent,
                subject: subject ?? 'math',
                gradeBand: gradeBand ?? null,
            });
            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(cacheKey, JSON.stringify({ payload: finalLocal, intent: checkpointIntent }));
            }
            return;
        }

        if (!resolvedPilotTopic) return;

        if (resolvedPilotTopic !== 'perimeter') {
            const local = getDeterministicGrade2MathCheckpoint({
                topic: resolvedPilotTopic,
                sectionContent: currentSection.content ?? '',
                intent: checkpointIntent,
                seed: seedBase + intentOffset,
            });
            if (!local) {
                setCheckpointBySection((prev) => {
                    const next = new Map(prev);
                    next.set(currentSectionIndex, {
                        status: 'error',
                        message: 'Unable to generate checkpoint right now.',
                    });
                    return next;
                });
                return;
            }

            const shuffled = shuffleWithCorrectIndex(local.options, local.correctIndex, shuffleSeed);
            const finalLocal: CheckpointPayload = {
                ...local,
                options: shuffled.options,
                correctIndex: shuffled.correctIndex,
            };
            setCheckpointBySection((prev) => {
                const next = new Map(prev);
                next.set(currentSectionIndex, {
                    status: 'ready',
                    payload: finalLocal,
                    intent: checkpointIntent,
                    selectedIndex: null,
                    isCorrect: null,
                });
                return next;
            });
            if (pilotTelemetryEnabled) {
                trackEvent('success_pilot_checkpoint_generated', {
                    lessonId,
                    sectionIndex: currentSectionIndex,
                    source: 'deterministic',
                    topic: resolvedPilotTopic,
                    intent: checkpointIntent,
                    subject: subject ?? 'math',
                    gradeBand: gradeBand ?? null,
                });
            }
            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(cacheKey, JSON.stringify({ payload: finalLocal, intent: checkpointIntent }));
            }
            return;
        }

            setCheckpointBySection((prev) => {
                const next = new Map(prev);
                next.set(currentSectionIndex, { status: 'loading' });
            return next;
        });

        const contentSnippet = clampText(currentSection.content ?? '', 750);
        const titleSnippet = clampText(currentSection.title ?? 'Lesson section', 80);
        const lessonSnippet = clampText(lessonTitle ?? 'Lesson', 80);
        const subjectSnippet = clampText(subject ?? 'math', 40);
        const gradeSnippet = clampText(gradeBand ?? 'Grade 2', 40);

        const intentRules =
            checkpointIntent === 'define'
                ? [
                    `Intent: define.`,
                    `Ask a short definition question about perimeter.`,
                    `Avoid numbers unless they are in the section.`,
                ]
                : checkpointIntent === 'compute'
                    ? [
                        `Intent: compute.`,
                        `The question MUST include numbers and ask for a perimeter calculation.`,
                        `All options must be numeric answers with units when present.`,
                    ]
                    : [
                        `Intent: scenario.`,
                        `Ask a simple real-world perimeter scenario tied to the section (fence, ribbon, string).`,
                        `Include numbers when present in the section.`,
                    ];

        const systemPrompt = [
            `You create one check-for-understanding question for a K-12 learner.`,
            `Target: ${gradeSnippet} ${subjectSnippet}.`,
            ``,
            `CRITICAL: The question must be directly answerable from the provided section content. Do NOT ask meta questions like “What is the main concept?”`,
            `Make it concrete: include at least one specific number, definition, example, or scenario tied to the section.`,
            `Wrong options must be plausible misunderstandings of THIS content (not generic study advice).`,
            `Never output study strategies, teacher advice, or generic coaching content.`,
            ...intentRules,
            ``,
            `If it helps engagement, include a simple text diagram in a "visual" field (ASCII box, labeled sides, small table). Keep it short.`,
            ``,
            `Return ONLY valid JSON (no markdown, no extra text):`,
            `{"visual":"(optional)","question":"...","options":["...","...","..."],"correctIndex":0,"explanation":"..."}`,
            `Rules: options length is 3 or 4; correctIndex is 0-based; explanation is 1-2 short sentences; avoid trick questions.`,
        ].join('\n');

        const prompt = [
            `Lesson title: ${lessonSnippet}`,
            `Section title: ${titleSnippet}`,
            `Section content (source of truth):`,
            contentSnippet,
            ``,
            `Create the JSON checkpoint now.`,
        ].join('\n');

        try {
            let lastError: unknown = null;
            let tutorMessage: string | null = null;

            for (let attempt = 1; attempt <= 3; attempt += 1) {
                try {
                    const result = await getTutorResponse(prompt, { systemPrompt, mode: 'learning' });
                    tutorMessage = result.message;
                    break;
                } catch (error) {
                    lastError = error;
                    await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
                }
            }

            if (!tutorMessage) {
                const seedBase = (Number.isFinite(lessonId) ? (lessonId as number) : 0) * 10_000 + currentSectionIndex * 10;
                const intentOffset = checkpointIntent === 'define' ? 1 : checkpointIntent === 'compute' ? 2 : 3;
                const local = getDeterministicGrade2MathCheckpoint({
                    topic: resolvedPilotTopic,
                    sectionContent: currentSection.content ?? '',
                    intent: checkpointIntent,
                    seed: seedBase + intentOffset,
                });
                if (local) {
                    setCheckpointBySection((prev) => {
                        const next = new Map(prev);
                        next.set(currentSectionIndex, {
                            status: 'ready',
                            payload: local,
                            intent: checkpointIntent,
                            selectedIndex: null,
                            isCorrect: null,
                        });
                        return next;
                    });
                    if (pilotTelemetryEnabled) {
                        trackEvent('success_pilot_checkpoint_generated', {
                            lessonId,
                            sectionIndex: currentSectionIndex,
                            source: 'fallback',
                            reason: 'assistant_unavailable',
                            intent: checkpointIntent,
                            topic: resolvedPilotTopic,
                            subject: subject ?? 'math',
                            gradeBand: gradeBand ?? null,
                        });
                    }
                    if (typeof window !== 'undefined') {
                        window.sessionStorage.setItem(cacheKey, JSON.stringify({ payload: local, intent: checkpointIntent }));
                    }
                    return;
                }
                throw lastError instanceof Error ? lastError : new Error('Assistant unavailable');
            }

            const jsonCandidate = extractJsonObject(tutorMessage) ?? tutorMessage.trim();
            const parsed = JSON.parse(jsonCandidate) as Partial<CheckpointPayload>;

            const visual = typeof parsed.visual === 'string' ? parsed.visual.trim() : undefined;
            const question = typeof parsed.question === 'string' ? parsed.question.trim() : '';
            const options = Array.isArray(parsed.options)
                ? parsed.options.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
                : [];
            const correctIndex = typeof parsed.correctIndex === 'number' ? parsed.correctIndex : -1;
            const explanation = typeof parsed.explanation === 'string' ? parsed.explanation.trim() : '';

            const candidatePayload: CheckpointPayload = { visual, question, options, correctIndex, explanation };

            if (!isValidCheckpointPayload(candidatePayload, checkpointIntent)) {
                throw new Error('Invalid checkpoint payload');
            }

            const shuffled = shuffleWithCorrectIndex(options, correctIndex, shuffleSeed);
            const finalPayload: CheckpointPayload = {
                visual,
                question,
                options: shuffled.options,
                correctIndex: shuffled.correctIndex,
                explanation,
            };

            setCheckpointBySection((prev) => {
                const next = new Map(prev);
                next.set(currentSectionIndex, {
                    status: 'ready',
                    payload: finalPayload,
                    intent: checkpointIntent,
                    selectedIndex: null,
                    isCorrect: null,
                });
                return next;
            });
            if (pilotTelemetryEnabled) {
                trackEvent('success_pilot_checkpoint_generated', {
                    lessonId,
                    sectionIndex: currentSectionIndex,
                    source: 'ai',
                    intent: checkpointIntent,
                    topic: resolvedPilotTopic,
                    subject: subject ?? 'math',
                    gradeBand: gradeBand ?? null,
                });
            }
            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(cacheKey, JSON.stringify({ payload: finalPayload, intent: checkpointIntent }));
            }
        } catch (error) {
            const local = getDeterministicGrade2MathCheckpoint({
                topic: resolvedPilotTopic,
                sectionContent: currentSection.content ?? '',
                intent: checkpointIntent,
                seed: seedBase + intentOffset + 7,
            });
            if (local) {
                const shuffled = shuffleWithCorrectIndex(local.options, local.correctIndex, shuffleSeed);
                const finalLocal: CheckpointPayload = {
                    ...local,
                    options: shuffled.options,
                    correctIndex: shuffled.correctIndex,
                };
                setCheckpointBySection((prev) => {
                    const next = new Map(prev);
                    next.set(currentSectionIndex, {
                        status: 'ready',
                        payload: finalLocal,
                        intent: checkpointIntent,
                        selectedIndex: null,
                        isCorrect: null,
                    });
                    return next;
                });
                if (pilotTelemetryEnabled) {
                    trackEvent('success_pilot_checkpoint_generated', {
                        lessonId,
                        sectionIndex: currentSectionIndex,
                        source: 'fallback',
                        reason: 'generation_error',
                        intent: checkpointIntent,
                        topic: resolvedPilotTopic,
                        subject: subject ?? 'math',
                        gradeBand: gradeBand ?? null,
                        });
                }
                if (typeof window !== 'undefined') {
                    window.sessionStorage.setItem(cacheKey, JSON.stringify({ payload: finalLocal, intent: checkpointIntent }));
                }
                return;
            }

            setCheckpointBySection((prev) => {
                const next = new Map(prev);
                next.set(currentSectionIndex, {
                    status: 'error',
                    message: error instanceof Error ? error.message : 'Unable to generate checkpoint right now.',
                });
                return next;
            });
        }
    }, [
        checkpointEnabled,
        checkpointIntent,
        currentSection,
        currentSectionIndex,
        gradeBand,
        lessonId,
        lessonTitle,
        pilotTelemetryEnabled,
        resolvedK5MathTopic,
        resolvedPilotTopic,
        subject,
    ]);

    useEffect(() => {
        if (!checkpointEnabled) return;
        const existing = checkpointBySection.get(currentSectionIndex);
        if (existing && existing.status !== 'idle') return;
        void generateCheckpoint();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSectionIndex]);

    const handleSelectOption = useCallback(
        (selectedIndex: number) => {
            if (checkpointState.status !== 'ready') return;
            if (checkpointState.isCorrect === true) return;

            const isCorrect = selectedIndex === checkpointState.payload.correctIndex;

            setCheckpointBySection((prev) => {
                const next = new Map(prev);
                next.set(currentSectionIndex, {
                    ...checkpointState,
                    selectedIndex,
                    isCorrect,
                });
                return next;
            });

            if (!isCorrect) {
                setCheckpointWrongAttemptsBySection((prev) => {
                    const next = new Map(prev);
                    const count = (next.get(currentSectionIndex) ?? 0) + 1;
                    next.set(currentSectionIndex, count);
                    return next;
                });
            }

            if (pilotTelemetryEnabled) {
                trackEvent('success_pilot_checkpoint_answered', {
                    lessonId,
                    sectionIndex: currentSectionIndex,
                    intent: checkpointState.intent,
                    selectedIndex,
                    isCorrect,
                    topic: resolvedPilotTopic,
                    subject: subject ?? 'math',
                    gradeBand: gradeBand ?? null,
                });
            } else {
                trackEvent('success_k5_math_checkpoint_answered', {
                    lessonId,
                    sectionIndex: currentSectionIndex,
                    intent: checkpointState.intent,
                    selectedIndex,
                    isCorrect,
                    topic: resolvedK5MathTopic ?? 'general',
                    subject: subject ?? 'math',
                    gradeBand: gradeBand ?? null,
                });
            }

            if (isCorrect) {
                onSectionComplete?.(currentSectionIndex);
                setQuickReviewBySection((prev) => {
                    const next = new Map(prev);
                    next.set(currentSectionIndex, { isVisible: false, selectedIndex: null, isCorrect: null });
                    return next;
                });
            }
        },
        [
            checkpointState,
            currentSectionIndex,
            gradeBand,
            lessonId,
            onSectionComplete,
            pilotTelemetryEnabled,
            resolvedK5MathTopic,
            resolvedPilotTopic,
            subject,
        ],
    );

    const checkpointWrongAttempts = useMemo(
        () => checkpointWrongAttemptsBySection.get(currentSectionIndex) ?? 0,
        [checkpointWrongAttemptsBySection, currentSectionIndex],
    );

    useEffect(() => {
        if (!checkpointEnabled) return;
        if (hasCheckpointPassed) return;
        if (checkpointWrongAttempts < 2) return;
        if (!quickReviewContent) return;

        setQuickReviewBySection((prev) => {
            const existing = prev.get(currentSectionIndex);
            if (existing?.isVisible) return prev;
            const next = new Map(prev);
            next.set(currentSectionIndex, { isVisible: true, selectedIndex: null, isCorrect: null });
            return next;
        });

        if (pilotTelemetryEnabled) {
            trackEvent('success_pilot_quick_review_shown', {
                lessonId,
                phase: 'learn',
                sectionIndex: currentSectionIndex,
                trigger: 'checkpoint_wrong_twice',
                topic: resolvedPilotTopic,
                subject: subject ?? 'math',
                gradeBand: gradeBand ?? null,
            });
        } else {
            trackEvent('success_k5_math_checkpoint_quick_review_shown', {
                lessonId,
                phase: 'learn',
                sectionIndex: currentSectionIndex,
                trigger: 'checkpoint_wrong_twice',
                topic: resolvedK5MathTopic ?? 'general',
                subject: subject ?? 'math',
                gradeBand: gradeBand ?? null,
            });
        }
    }, [
        checkpointEnabled,
        checkpointWrongAttempts,
        currentSectionIndex,
        gradeBand,
        hasCheckpointPassed,
        lessonId,
        pilotTelemetryEnabled,
        quickReviewContent,
        resolvedK5MathTopic,
        resolvedPilotTopic,
        subject,
    ]);

    const handleQuickReviewAnswer = (selectedIndex: number) => {
        if (!quickReviewContent) return;
        const isCorrect = selectedIndex === quickReviewContent.correctIndex;

        setQuickReviewBySection((prev) => {
            const next = new Map(prev);
            next.set(currentSectionIndex, {
                isVisible: true,
                selectedIndex,
                isCorrect,
            });
            return next;
        });

        if (pilotTelemetryEnabled) {
            trackEvent('success_pilot_quick_review_answered', {
                lessonId,
                phase: 'learn',
                sectionIndex: currentSectionIndex,
                isCorrect,
                topic: resolvedPilotTopic,
                subject: subject ?? 'math',
                gradeBand: gradeBand ?? null,
            });
        } else {
            trackEvent('success_k5_math_checkpoint_quick_review_answered', {
                lessonId,
                phase: 'learn',
                sectionIndex: currentSectionIndex,
                isCorrect,
                topic: resolvedK5MathTopic ?? 'general',
                subject: subject ?? 'math',
                gradeBand: gradeBand ?? null,
            });
        }
    };

    const checkpointHintText = useMemo(() => {
        if (checkpointState.status !== 'ready') return null;
        if (pilotTelemetryEnabled) {
            return getGrade2MathCheckpointHint({
                topic: resolvedPilotTopic ?? 'perimeter',
                intent: checkpointState.intent,
                sectionContent: currentSection?.content ?? '',
            });
        }
        return getK5MathCheckpointHint({
            subject: subject ?? null,
            gradeBand: gradeBand ?? null,
            lessonTitle: lessonTitle ?? null,
            lessonContent: currentSection?.content ?? '',
            intent: checkpointState.intent,
            topic: resolvedK5MathTopic,
        });
    }, [checkpointState, currentSection?.content, gradeBand, lessonTitle, pilotTelemetryEnabled, resolvedK5MathTopic, resolvedPilotTopic, subject]);

    const toggleCheckpointHint = () => {
        if (!checkpointEnabled) return;
        if (checkpointState.status !== 'ready') return;
        setCheckpointHintShownBySection((prev) => {
            const next = new Map(prev);
            next.set(currentSectionIndex, !(prev.get(currentSectionIndex) ?? false));
            return next;
        });
        if (pilotTelemetryEnabled) {
            trackEvent('success_pilot_checkpoint_hint_clicked', {
                lessonId,
                sectionIndex: currentSectionIndex,
                intent: checkpointState.intent,
                source: 'deterministic',
                topic: resolvedPilotTopic,
                subject: subject ?? 'math',
                gradeBand: gradeBand ?? null,
            });
        } else {
            trackEvent('success_k5_math_checkpoint_hint_clicked', {
                lessonId,
                sectionIndex: currentSectionIndex,
                intent: checkpointState.intent,
                source: 'deterministic',
                topic: resolvedK5MathTopic ?? 'general',
                subject: subject ?? 'math',
                gradeBand: gradeBand ?? null,
            });
        }
    };

    const handleAskTutor = () => {
        if (onAskTutor && currentSection) {
            onAskTutor(`I'm reading about "${currentSection.title}". Can you explain it in simple terms?`);
        }
    };

    const handleAskForHint = () => {
        if (!onAskTutor || !currentSection) return;
        if (checkpointState.status !== 'ready') return;

        if (pilotTelemetryEnabled) {
            trackEvent('success_pilot_checkpoint_hint_clicked', {
                lessonId,
                sectionIndex: currentSectionIndex,
                intent: checkpointState.intent,
                source: 'tutor',
                topic: resolvedPilotTopic,
                subject: subject ?? 'math',
                gradeBand: gradeBand ?? null,
            });
        } else {
            trackEvent('success_k5_math_checkpoint_hint_clicked', {
                lessonId,
                sectionIndex: currentSectionIndex,
                intent: checkpointState.intent,
                source: 'tutor',
                topic: resolvedK5MathTopic ?? 'general',
                subject: subject ?? 'math',
                gradeBand: gradeBand ?? null,
            });
        }

        const { question, options } = checkpointState.payload;
        onAskTutor(
            [
                `I'm stuck on a checkpoint question for "${currentSection.title}".`,
                `Question: ${question}`,
                `Options: ${options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join(' ')}`,
                `Please give me a hint and help me reason, but do NOT tell me the answer letter.`,
            ].join('\n'),
        );
    };

    return (
        <div ref={topRef} className="max-w-3xl mx-auto">
            <LessonCard>
                {/* Section header */}
                <div className="border-b border-slate-100 px-6 py-4 md:px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-600">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">
                                    {currentSection?.title || 'Lesson Content'}
                                </h2>
                                {hasMultipleSections && (
                                    <p className="text-sm text-slate-500">
                                        Section {currentSectionIndex + 1} of {sections.length}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Ask tutor button */}
                        {onAskTutor && (
                            <button
                                type="button"
                                onClick={handleAskTutor}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                                <Bot className="h-4 w-4" />
                                <span className="hidden sm:inline">Ask ElevatED</span>
                            </button>
                        )}
                    </div>

                    {/* Section progress for mobile */}
                    {hasMultipleSections && (
                        <div className="mt-3 flex items-center gap-2">
                            {sections.map((_, index) => (
                                <div
                                    key={index}
                                    className={`h-1.5 flex-1 rounded-full transition-colors ${index <= currentSectionIndex ? 'bg-blue-500' : 'bg-slate-200'
                                        }`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Content */}
                <LessonCardBody className="min-h-[300px]">
                    {sectionVisual && (
                        <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <img
                                src={sectionVisual.svg}
                                alt={sectionVisual.alt}
                                className="block w-full"
                                loading="lazy"
                            />
                        </div>
                    )}

                    {contextImageQuery && (
                        <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                            {contextImage && (
                                <img
                                    src={contextImage.thumbnailUrl || contextImage.url}
                                    alt={contextImage.title}
                                    className="block w-full"
                                    loading="lazy"
                                />
                            )}

                            {!contextImage && contextImageStatus === 'loading' && (
                                <div className="p-4 text-sm text-slate-500">Loading image…</div>
                            )}

                            {!contextImage && contextImageStatus === 'error' && (
                                <img
                                    src="/images/lessons/social_studies/great_wall.svg"
                                    alt="Illustration of the Great Wall of China"
                                    className="block w-full"
                                    loading="lazy"
                                />
                            )}

                            <div className="border-t border-slate-100 bg-white px-4 py-3">
                                <div className="text-xs font-semibold text-slate-700">Visualize</div>
                                <div className="mt-0.5 text-xs text-slate-600">
                                    {contextImage?.attributionHtml ? (
                                        <span dangerouslySetInnerHTML={{ __html: contextImage.attributionHtml }} />
                                    ) : (
                                        <span>Great Wall of China</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentSectionIndex}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900"
                        >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {currentSection?.content || ''}
                            </ReactMarkdown>
                        </motion.div>
                    </AnimatePresence>
                </LessonCardBody>

                {/* Navigation */}
                <LessonCardFooter>
                    {checkpointEnabled && (
                        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 md:px-6">
                            {quickReviewState.isVisible && quickReviewContent && (
                                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                    <div className="text-sm font-semibold text-amber-900">{quickReviewContent.title}</div>
                                    <div className="mt-1 text-sm text-amber-900/90">
                                        {quickReviewContent.explanation}
                                    </div>

                                    {sectionVisual && (
                                        <div className="mt-3 overflow-hidden rounded-lg border border-amber-200 bg-white">
                                            <img
                                                src={sectionVisual.svg}
                                                alt={sectionVisual.alt}
                                                className="block w-full"
                                                loading="lazy"
                                            />
                                        </div>
                                    )}

                                    <div className="mt-3 text-base font-bold leading-snug text-slate-900 whitespace-normal break-words">
                                        {quickReviewContent.prompt}
                                    </div>
                                    <div className="mt-2 grid gap-2">
                                        {quickReviewContent.options.map((option, idx) => {
                                            const selected = quickReviewState.selectedIndex === idx;
                                            const showCorrect = quickReviewState.isCorrect !== null && idx === quickReviewContent.correctIndex;
                                            const showIncorrect =
                                                quickReviewState.isCorrect === false && selected && idx !== quickReviewContent.correctIndex;
                                            return (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    disabled={quickReviewState.isCorrect === true}
                                                    onClick={() => handleQuickReviewAnswer(idx)}
                                                    className={[
                                                        'w-full rounded-xl border-2 px-4 py-3 text-left text-base font-semibold transition-colors',
                                                        quickReviewState.isCorrect === true
                                                            ? showCorrect
                                                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                                                : 'border-slate-200 bg-white text-slate-600 opacity-70'
                                                            : selected
                                                                ? 'border-blue-300 bg-blue-50 text-slate-900'
                                                                : 'border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:bg-blue-50',
                                                        showIncorrect ? 'border-rose-300 bg-rose-50 text-rose-900' : '',
                                                    ].join(' ')}
                                                >
                                                    <span className="mr-2 text-slate-500">{String.fromCharCode(65 + idx)}.</span>
                                                    <span className="block whitespace-normal break-words">{option}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {quickReviewState.isCorrect === true && (
                                        <div className="mt-3 text-sm text-emerald-900">
                                            Nice — now try the checkpoint again.
                                        </div>
                                    )}
                                    {quickReviewState.isCorrect === false && (
                                        <div className="mt-3 text-sm text-rose-900">
                                            {quickReviewContent.explanation}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="text-base font-bold text-slate-900">Checkpoint</div>
                                        {detectedShape && (
                                            <span
                                                className={[
                                                    'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                                                    shapePillStyles[detectedShape].className,
                                                ].join(' ')}
                                            >
                                                {shapePillStyles[detectedShape].label}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-600">
                                        Answer correctly to continue.
                                    </div>
                                </div>
                                {checkpointState.status === 'ready' && checkpointHintText ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={toggleCheckpointHint}
                                            className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
                                        >
                                            Hint
                                        </button>
                                        {onAskTutor && (
                                            <button
                                                type="button"
                                                onClick={handleAskForHint}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                            >
                                                <Bot className="h-4 w-4" />
                                                Ask
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    onAskTutor && (
                                    <button
                                        type="button"
                                        onClick={handleAskForHint}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                    >
                                        <Bot className="h-4 w-4" />
                                        Hint
                                    </button>
                                    )
                                )}
                            </div>

                            {checkpointState.status === 'ready' && checkpointHintText && isCheckpointHintShown && (
                                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                                    {checkpointHintText}
                                </div>
                            )}

                            {checkpointState.status === 'loading' && (
                                <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                                    Generating a quick question…
                                </div>
                            )}

                            {checkpointState.status === 'error' && (
                                <div className="mt-4">
                                    <div className="text-sm text-rose-700">
                                        Couldn’t generate a checkpoint right now.
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {checkpointState.message}
                                    </div>
                                    <div className="text-xs text-slate-600 mt-2">
                                        You can still continue for now.
                                    </div>
                                    <button
                                        type="button"
                                        onClick={generateCheckpoint}
                                        className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Try again
                                    </button>
                                </div>
                            )}

                        {checkpointState.status === 'ready' && (
                            <div className="mt-4">
                                {checkpointState.payload.visual && (
                                    <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
                                        <pre className="whitespace-pre-wrap text-xs text-slate-700">
                                            {checkpointState.payload.visual}
                                        </pre>
                                    </div>
                                )}
                                <div className="text-base md:text-lg font-bold text-slate-900 leading-snug whitespace-normal break-words">
                                    {checkpointState.payload.question}
                                </div>
                                <div className="mt-3 grid gap-2">
                                        {checkpointState.payload.options.map((option, idx) => {
                                            const selected = checkpointState.selectedIndex === idx;
                                            const showCorrect =
                                                checkpointState.isCorrect !== null &&
                                                idx === checkpointState.payload.correctIndex;
                                            const showIncorrect = checkpointState.isCorrect === false && selected && !showCorrect;

                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    disabled={checkpointState.isCorrect === true}
                                                    onClick={() => handleSelectOption(idx)}
                                                    className={[
                                                        'w-full rounded-xl border-2 p-4 text-left text-base font-semibold transition-colors',
                                                        checkpointState.isCorrect === true
                                                            ? showCorrect
                                                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                                                : 'border-slate-200 bg-white text-slate-600 opacity-70'
                                                            : selected
                                                                ? 'border-blue-300 bg-blue-50 text-slate-900'
                                                                : 'border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:bg-blue-50',
                                                        showIncorrect ? 'border-rose-300 bg-rose-50 text-rose-900' : '',
                                                    ].join(' ')}
                                                >
                                                    <span className="mr-2 text-slate-500">
                                                        {String.fromCharCode(65 + idx)}.
                                                    </span>
                                                    <span className="block whitespace-normal break-words">{option}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {checkpointState.isCorrect === true && (
                                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                                            <CheckCircle2 className="h-4 w-4 mt-0.5" />
                                            <div>
                                                <div className="font-semibold">Nice!</div>
                                                <div className="text-emerald-900/90">{checkpointState.payload.explanation}</div>
                                            </div>
                                        </div>
                                    )}

                                    {checkpointState.isCorrect === false && (
                                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                                            <XCircle className="h-4 w-4 mt-0.5" />
                                            <div>
                                                <div className="font-semibold">Not quite.</div>
                                                <div className="text-rose-900/90">{checkpointState.payload.explanation}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <LessonNavigation
                        continueLabel={isLastSection ? lastSectionLabel : 'Next Section'}
                        backLabel={isFirstSection ? 'Back to Welcome' : 'Previous Section'}
                        onContinue={handleContinue}
                        onBack={handleBack}
                        continueDisabled={
                            checkpointEnabled &&
                            checkpointState.status !== 'error' &&
                            (!hasCheckpointPassed || checkpointState.status === 'loading')
                        }
                    />
                </LessonCardFooter>
            </LessonCard>
        </div>
    );
};

export default LearnPhase;
