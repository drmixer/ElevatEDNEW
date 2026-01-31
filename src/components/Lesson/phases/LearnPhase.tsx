/**
 * LearnPhase Component
 * 
 * Main learning content phase with section-by-section navigation.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Bot, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { LessonCard, LessonCardBody, LessonCardFooter } from '../LessonCard';
import { LessonNavigation } from '../LessonNavigation';
import { useLessonStepper } from '../LessonStepper';
import type { LessonSection } from '../../../types/lesson';
import getTutorResponse from '../../../services/getTutorResponse';
import { getSectionVisual } from '../../../lib/lessonVisuals';
import trackEvent from '../../../lib/analytics';

interface LearnPhaseProps {
    sections: LessonSection[];
    lessonId?: number;
    pilotTelemetryEnabled?: boolean;
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

type CheckpointState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; payload: CheckpointPayload; selectedIndex: number | null; isCorrect: boolean | null }
    | { status: 'error'; message: string };

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

const shuffleWithCorrectIndex = (
    options: string[],
    correctIndex: number,
): { options: string[]; correctIndex: number } => {
    const paired = options.map((text, index) => ({ text, isCorrect: index === correctIndex }));
    for (let i = paired.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [paired[i], paired[j]] = [paired[j], paired[i]];
    }
    return {
        options: paired.map((p) => p.text),
        correctIndex: Math.max(0, paired.findIndex((p) => p.isCorrect)),
    };
};

const localCheckpointFromMathPerimeter = (
    sectionContent: string,
): CheckpointPayload | null => {
    const text = (sectionContent ?? '').toString();
    if (!text.trim()) return null;

    // Example patterns like: "Perimeter = 3 + 3 + 3 + 3 = 12 feet"
    const perimeterEq = text.match(/Perimeter\s*=\s*([0-9+\s]+)=\s*([0-9]+)\s*(\w+)?/i);
    if (perimeterEq) {
        const sum = perimeterEq[1]?.replace(/\s+/g, ' ').trim() ?? '';
        const total = Number.parseInt(perimeterEq[2] ?? '', 10);
        const unit = (perimeterEq[3] ?? '').trim();
        if (Number.isFinite(total)) {
            const baseOptions = [
                `${total}${unit ? ` ${unit}` : ''}`,
                `${total + 2}${unit ? ` ${unit}` : ''}`,
                `${Math.max(1, total - 2)}${unit ? ` ${unit}` : ''}`,
                `${total + 4}${unit ? ` ${unit}` : ''}`,
            ].slice(0, 4);
            const shuffled = shuffleWithCorrectIndex(baseOptions, 0);
            return {
                visual: `Perimeter = ${sum} = ${total}${unit ? ` ${unit}` : ''}`,
                question: 'In this example, what is the perimeter?',
                options: shuffled.options,
                correctIndex: shuffled.correctIndex,
                explanation: `Perimeter is the total distance around the shape. You add all the side lengths to get ${total}${unit ? ` ${unit}` : ''}.`,
            };
        }
    }

    // Definition fallback.
    if (/perimeter/i.test(text)) {
        const baseOptions = [
            'The distance around the outside of a shape',
            'The space inside a shape',
            'The number of corners on a shape',
            'How heavy something is',
        ];
        const shuffled = shuffleWithCorrectIndex(baseOptions, 0);
        return {
            question: 'What does perimeter measure?',
            options: shuffled.options,
            correctIndex: shuffled.correctIndex,
            explanation: 'Perimeter means you go all the way around the outside edges of a shape.',
        };
    }

    return null;
};

export const LearnPhase: React.FC<LearnPhaseProps> = ({
    sections,
    lessonId,
    pilotTelemetryEnabled,
    lessonTitle,
    subject,
    gradeBand,
    onAskTutor,
    onSectionComplete,
}) => {
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

    const checkpointEnabled = useMemo(() => {
        const normalizedSubject = (subject ?? '').toString().toLowerCase();
        const gradeMatch = (gradeBand ?? '').toString().match(/\d+/);
        const grade = gradeMatch ? Number.parseInt(gradeMatch[0] ?? '', 10) : null;
        const title = (lessonTitle ?? '').toString().toLowerCase();
        // Pilot: Grade 2 Math Perimeter checkpoints.
        return normalizedSubject.includes('math') && grade === 2 && title.includes('perimeter');
    }, [gradeBand, lessonTitle, subject]);

    const sectionVisual = useMemo(() => {
        if (!currentSection || !checkpointEnabled) return null;
        return getSectionVisual({
            lessonTitle: lessonTitle ?? null,
            subject: subject ?? null,
            gradeBand: gradeBand ?? null,
            sectionTitle: currentSection.title ?? null,
            sectionContent: currentSection.content ?? '',
        });
    }, [checkpointEnabled, currentSection, gradeBand, lessonTitle, subject]);

    const [checkpointBySection, setCheckpointBySection] = useState<Map<number, CheckpointState>>(
        () => new Map(),
    );

    const checkpointState: CheckpointState = useMemo(() => {
        return checkpointBySection.get(currentSectionIndex) ?? { status: 'idle' };
    }, [checkpointBySection, currentSectionIndex]);

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

        const systemPrompt = [
            `You create one check-for-understanding question for a K-12 learner.`,
            `Target: ${gradeSnippet} ${subjectSnippet}.`,
            ``,
            `CRITICAL: The question must be directly answerable from the provided section content. Do NOT ask meta questions like “What is the main concept?”`,
            `Make it concrete: include at least one specific number, definition, example, or scenario tied to the section.`,
            `Wrong options must be plausible misunderstandings of THIS content (not generic study advice).`,
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
                const local = localCheckpointFromMathPerimeter(currentSection.content ?? '');
                if (local) {
                    setCheckpointBySection((prev) => {
                        const next = new Map(prev);
                        next.set(currentSectionIndex, {
                            status: 'ready',
                            payload: local,
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
                        });
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

            if (!question || options.length < 3 || options.length > 4 || correctIndex < 0 || correctIndex >= options.length) {
                throw new Error('Invalid checkpoint payload');
            }

            const shuffled = shuffleWithCorrectIndex(options, correctIndex);

            setCheckpointBySection((prev) => {
                const next = new Map(prev);
                next.set(currentSectionIndex, {
                    status: 'ready',
                    payload: { visual, question, options: shuffled.options, correctIndex: shuffled.correctIndex, explanation },
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
                });
            }
        } catch (error) {
            const local = localCheckpointFromMathPerimeter(currentSection.content ?? '');
            if (local) {
                setCheckpointBySection((prev) => {
                    const next = new Map(prev);
                    next.set(currentSectionIndex, {
                        status: 'ready',
                        payload: local,
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
                    });
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
    }, [currentSection, currentSectionIndex, gradeBand, lessonId, lessonTitle, pilotTelemetryEnabled, subject]);

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

            if (pilotTelemetryEnabled) {
                trackEvent('success_pilot_checkpoint_answered', {
                    lessonId,
                    sectionIndex: currentSectionIndex,
                    selectedIndex,
                    isCorrect,
                });
            }

            if (isCorrect) {
                onSectionComplete?.(currentSectionIndex);
            }
        },
        [checkpointState, currentSectionIndex, lessonId, onSectionComplete, pilotTelemetryEnabled],
    );

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
        <div className="max-w-3xl mx-auto">
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
                        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">Checkpoint</div>
                                    <div className="text-xs text-slate-600">
                                        Answer correctly to continue.
                                    </div>
                                </div>
                                {onAskTutor && (
                                    <button
                                        type="button"
                                        onClick={handleAskForHint}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                    >
                                        <Bot className="h-4 w-4" />
                                        Hint
                                    </button>
                                )}
                            </div>

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
                                <div className="text-sm font-medium text-slate-900">
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
                                                        'w-full rounded-xl border-2 p-3 text-left text-sm font-medium transition-colors',
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
                                                    {option}
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
