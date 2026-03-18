/**
 * LessonPlayerPage - New Stepper-Based Experience
 *
 * Phase 6: Main Page Integration
 * Replaces the old scroll-based lesson player with a step-by-step guided experience.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    ArrowLeft,
    HelpCircle,
    Loader2,
    PlayCircle,
} from 'lucide-react';

import { fetchLessonDetail } from '../services/catalogService';
import {
    fetchLessonCheckQuestions,
    recordLessonQuestionAttempt,
} from '../services/lessonPracticeService';
import { useLessonProgress } from '../lib/useLessonProgress';
import { useAuth } from '../contexts/AuthContext';
import type { LessonPracticeQuestion, Subject } from '../types';
import trackEvent from '../lib/analytics';
import LearningAssistant from '../components/Student/LearningAssistant';
import { useStudentEvent } from '../hooks/useStudentData';
import { shufflePracticeOptions } from '../lib/answerOrder';
import { parseLessonContent, consolidateSections } from '../lib/lessonContentParser';
import ContentIssueReport from '../components/Lesson/ContentIssueReport';
import { getPracticeQuestionVisual } from '../lib/lessonVisuals';
import { getGrade2MathPilotTopic, type Grade2MathPilotTopic } from '../lib/pilotConditions';
import { generateGrade2MathPracticeQuestions } from '../lib/pilotGrade2Math';
import { getNonMathRemediationSubject, type NonMathRemediationSubject } from '../lib/nonMathRemediation';
import { buildLessonNextReasonCard } from '../lib/transparencyReason';

// Core Lesson Components (eagerly loaded)
import {
    LessonStepperProvider,
    useLessonStepper,
    LessonProgressBar,
    LessonHeader,
} from '../components/Lesson';

// Lazy-loaded phase components for better initial load performance
const WelcomePhase = lazy(() => import('../components/Lesson/phases/WelcomePhase').then(m => ({ default: m.WelcomePhase })));
const LearnPhase = lazy(() => import('../components/Lesson/phases/LearnPhase').then(m => ({ default: m.LearnPhase })));
const PracticePhase = lazy(() => import('../components/Lesson/phases/PracticePhase').then(m => ({ default: m.PracticePhase })));
const ReviewPhase = lazy(() => import('../components/Lesson/phases/ReviewPhase').then(m => ({ default: m.ReviewPhase })));
const CompletePhase = lazy(() => import('../components/Lesson/phases/CompletePhase').then(m => ({ default: m.CompletePhase })));

// Fallback for lazy-loaded phases
const PhaseFallback = () => (
    <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-brand-blue/60" />
    </div>
);

const generatePerimeterPracticeQuestions = (input: {
    lessonId: number;
    lessonTitle: string;
    subject: string;
    gradeBand: string;
}): LessonPracticeQuestion[] => {
    // Deterministic, lesson-specific practice for the Grade 2 Perimeter pilot.
    const base: Array<{
        prompt: string;
        correct: string;
        wrong: string[];
        explanation: string;
        hint?: string;
        steps?: string[];
    }> = [
        {
            prompt: 'What does perimeter mean?',
            correct: 'The distance around the outside of a shape',
            wrong: ['The space inside a shape', 'The number of corners on a shape', 'How heavy something is'],
            explanation: 'Perimeter means you go all the way around the outside edges of a shape.',
            hint: 'Think: perimeter is how far it is to go all the way around.',
        },
        {
            prompt: 'A square has side lengths of 3 feet on every side. What is the perimeter?',
            correct: '12 feet',
            wrong: ['9 feet', '6 feet', '15 feet'],
            explanation: 'Perimeter is the distance around the shape: 3 + 3 + 3 + 3 = 12 feet.',
            hint: 'Perimeter means add all the side lengths.',
            steps: ['3 + 3 = 6', '6 + 3 = 9', '9 + 3 = 12'],
        },
        {
            prompt: 'A rectangle is 4 feet long and 2 feet wide. What is the perimeter?',
            correct: '12 feet',
            wrong: ['8 feet', '6 feet', '10 feet'],
            explanation: 'Add all the sides: 4 + 2 + 4 + 2 = 12 feet.',
            hint: 'Count the sides, then add them.',
            steps: ['4 + 2 = 6', '6 + 4 = 10', '10 + 2 = 12'],
        },
        {
            prompt: 'A triangle has sides 2 feet, 3 feet, and 4 feet. What is the perimeter?',
            correct: '9 feet',
            wrong: ['8 feet', '10 feet', '12 feet'],
            explanation: 'Add the three side lengths: 2 + 3 + 4 = 9 feet.',
            hint: 'Add the three side lengths.',
            steps: ['2 + 3 = 5', '5 + 4 = 9'],
        },
    ];

    return base.map((item, index) => {
        const optionsRaw = [
            { text: item.correct, isCorrect: true, feedback: 'Yes — that matches adding all the sides.' },
            ...item.wrong.map((text) => ({ text, isCorrect: false, feedback: 'Check by adding all the side lengths.' })),
        ];

        const options = shufflePracticeOptions(optionsRaw, input.lessonId * 1_000 + index);
        const visual = getPracticeQuestionVisual({
            lessonTitle: input.lessonTitle,
            subject: input.subject,
            gradeBand: input.gradeBand,
            prompt: item.prompt,
        });

        return {
            id: 900_000 + input.lessonId * 10 + index,
            prompt: item.prompt,
            type: 'multiple_choice',
            explanation: item.explanation,
            hint: item.hint ?? null,
            steps: item.steps ?? null,
            visual,
            options: options.map((o, idx2) => ({
                id: 9_000_000 + input.lessonId * 100 + index * 10 + idx2,
                text: o.text,
                isCorrect: o.isCorrect,
                feedback: o.feedback ?? null,
            })),
            skillIds: [],
        };
    });
};

/**
 * Inner component that uses stepper context
 */
const LessonContent: React.FC<{
    lessonDetail: NonNullable<Awaited<ReturnType<typeof fetchLessonDetail>>>;
    pilotTopic: Grade2MathPilotTopic | null;
    nonMathRemediationSubject: NonMathRemediationSubject | null;
    practiceQuestions: LessonPracticeQuestion[];
    onAnswerSubmit: (questionId: number, optionId: number, isCorrect: boolean) => void;
    onAskTutor?: (context: string) => void;
    onSectionComplete?: (sectionIndex: number) => void;
    xpEarned: number;
}> = ({
    lessonDetail,
    pilotTopic,
    nonMathRemediationSubject,
    practiceQuestions,
    onAnswerSubmit,
    onAskTutor,
    onSectionComplete,
    xpEarned,
}) => {
        const { currentPhase } = useLessonStepper();

        const pilotTelemetryEnabled = useMemo(() => {
            return Boolean(pilotTopic);
        }, [pilotTopic]);

        // Parse lesson content (memoized for performance)
        const parsedContent = useMemo(() => {
            return parseLessonContent(lessonDetail.lesson.content, {
                title: lessonDetail.lesson.title,
                subject: lessonDetail.module.subject,
                gradeBand: lessonDetail.module.gradeBand,
                estimatedMinutes: lessonDetail.lesson.estimatedDurationMinutes,
            });
        }, [lessonDetail]);

        // Consolidate short sections for better UX (memoized)
        const learnSections = useMemo(() => {
            return consolidateSections(parsedContent.learnSections);
        }, [parsedContent.learnSections]);

        // Find next lesson in module (memoized)
        const nextLesson = useMemo(() => {
            const moduleLessons = lessonDetail.moduleLessons ?? [];
            const currentLessonIndex = moduleLessons.findIndex((l) => l.id === lessonDetail.lesson.id);
            return currentLessonIndex >= 0 && currentLessonIndex < moduleLessons.length - 1
                ? moduleLessons[currentLessonIndex + 1]
                : null;
        }, [lessonDetail]);

        return (
            <Suspense fallback={<PhaseFallback />}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentPhase}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="py-8"
                    >
                        {currentPhase === 'welcome' && (
                            <WelcomePhase
                                title={parsedContent.welcome.title}
                                subject={parsedContent.welcome.subject}
                                gradeBand={parsedContent.welcome.gradeBand}
                                objectives={parsedContent.welcome.objectives}
                                estimatedMinutes={parsedContent.welcome.estimatedMinutes}
                                hook={parsedContent.welcome.hook}
                            />
                        )}

                        {currentPhase === 'learn' && (
                            <LearnPhase
                                sections={learnSections}
                                lessonId={lessonDetail.lesson.id}
                                pilotTelemetryEnabled={pilotTelemetryEnabled}
                                pilotTopic={pilotTopic}
                                lessonTitle={lessonDetail.lesson.title}
                                subject={lessonDetail.module.subject}
                                gradeBand={lessonDetail.module.gradeBand}
                                onAskTutor={onAskTutor}
                                onSectionComplete={onSectionComplete}
                            />
                        )}

                        {currentPhase === 'practice' && (
                            <PracticePhase
                                questions={practiceQuestions}
                                lessonId={lessonDetail.lesson.id}
                                pilotTelemetryEnabled={pilotTelemetryEnabled}
                                pilotTopic={pilotTopic}
                                nonMathRemediationSubject={nonMathRemediationSubject}
                                lessonTitle={lessonDetail.lesson.title}
                                lessonContent={lessonDetail.lesson.content}
                                subject={lessonDetail.module.subject}
                                gradeBand={lessonDetail.module.gradeBand}
                                onAnswerSubmit={onAnswerSubmit}
                                onAskTutor={onAskTutor}
                            />
                        )}

                        {currentPhase === 'review' && (
                            <ReviewPhase
                                summary={parsedContent.summary}
                                vocabulary={parsedContent.vocabulary}
                                resources={parsedContent.resources}
                            />
                        )}

                        {currentPhase === 'complete' && (
                            <CompletePhase
                                lessonId={lessonDetail.lesson.id}
                                lessonTitle={lessonDetail.lesson.title}
                                moduleId={lessonDetail.module.id}
                                moduleTitle={lessonDetail.module.title}
                                subject={lessonDetail.module.subject}
                                nextLessonId={nextLesson?.id}
                                nextLessonTitle={nextLesson?.title}
                                xpEarned={xpEarned}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </Suspense>
        );
    };

/**
 * Main Lesson Player Page Component
 */
const LessonPlayerPage: React.FC = () => {
    const params = useParams<{ id: string }>();
    const location = useLocation();
    const { user } = useAuth();
    const lessonId = Number.parseInt(params.id ?? '', 10);

    const studentId = user?.role === 'student' ? user.id : null;

    // Student data hooks
    const { emitStudentEvent } = useStudentEvent(studentId);

    // Lesson started tracking
    const lessonStartedAt = useRef<number>(Date.now());
    const lessonCompletionLogged = useRef<boolean>(false);
    const lessonReasonTelemetryKey = useRef<string | null>(null);
    const [xpEarned, setXpEarned] = useState(0);

    // Validate lesson ID
    const isLessonIdValid = Number.isFinite(lessonId);

    // Fetch lesson detail
    const lessonQuery = useQuery({
        queryKey: ['lesson-detail', lessonId],
        queryFn: () => fetchLessonDetail(lessonId),
        enabled: isLessonIdValid,
        staleTime: 5 * 60 * 1000,
    });

    const lessonDetail = lessonQuery.data ?? null;

    const launchSuggestionReason = useMemo(() => {
        const state = location.state as Record<string, unknown> | null;
        if (!state || typeof state !== 'object') return null;
        const reason = state.suggestionReason;
        return typeof reason === 'string' && reason.trim().length ? reason.trim() : null;
    }, [location.state]);

    const grade2MathPilotTopic = useMemo(() => {
        if (!lessonDetail) return null;
        return getGrade2MathPilotTopic({
            subject: lessonDetail.module.subject,
            gradeBand: lessonDetail.module.gradeBand,
            lessonTitle: lessonDetail.lesson.title,
        });
    }, [lessonDetail]);

    const nonMathRemediationSubject = useMemo(() => {
        if (!lessonDetail) return null;
        return getNonMathRemediationSubject(lessonDetail.module.subject);
    }, [lessonDetail]);

    const lessonReasonCard = useMemo(() => {
        if (!lessonDetail) return null;
        return buildLessonNextReasonCard({
            suggestionReason: launchSuggestionReason,
            subject: lessonDetail.module.subject,
            moduleTitle: lessonDetail.module.title,
            lessonTitle: lessonDetail.lesson.title,
            gradeBand: lessonDetail.module.gradeBand,
        });
    }, [launchSuggestionReason, lessonDetail]);

    useEffect(() => {
        if (!lessonDetail || !lessonReasonCard) return;
        const key = `${lessonDetail.lesson.id}:${lessonReasonCard.title}:${lessonReasonCard.detail}`;
        if (lessonReasonTelemetryKey.current === key) return;
        lessonReasonTelemetryKey.current = key;
        trackEvent('success_transparency_lesson_reason_shown', {
            lessonId: lessonDetail.lesson.id,
            subject: lessonDetail.module.subject,
            tone: lessonReasonCard.tone,
            source: launchSuggestionReason ? 'dashboard_reason' : 'deterministic_fallback',
        });
    }, [launchSuggestionReason, lessonDetail, lessonReasonCard]);

    const isGrade2MathPilot = Boolean(grade2MathPilotTopic);

    // Fetch practice questions
    const practiceQuestionQuery = useQuery({
        queryKey: ['lesson-questions', lessonId, lessonDetail?.module.subject],
        queryFn: () =>
            fetchLessonCheckQuestions(
                lessonId,
                (lessonDetail?.module.subject as Subject | null) ?? null,
            ),
        enabled: isLessonIdValid && Boolean(studentId) && Boolean(lessonDetail),
        staleTime: 5 * 60 * 1000,
    });

    const practiceQuestions: LessonPracticeQuestion[] = useMemo(
        () => {
            const fetched = practiceQuestionQuery.data ?? [];

            // For the pilot, always use the deterministic, scaffolded practice set so quality is consistent
            // regardless of backend question-bank coverage.
            if (grade2MathPilotTopic && lessonDetail) {
                if (grade2MathPilotTopic === 'perimeter') {
                    return generatePerimeterPracticeQuestions({
                        lessonId: lessonDetail.lesson.id,
                        lessonTitle: lessonDetail.lesson.title,
                        subject: lessonDetail.module.subject,
                        gradeBand: lessonDetail.module.gradeBand,
                    });
                }

                return generateGrade2MathPracticeQuestions({
                    lessonId: lessonDetail.lesson.id,
                    lessonTitle: lessonDetail.lesson.title,
                    lessonContent: lessonDetail.lesson.content,
                    subject: lessonDetail.module.subject,
                    gradeBand: lessonDetail.module.gradeBand,
                    topic: grade2MathPilotTopic,
                });
            }

            return fetched;
        },
        [grade2MathPilotTopic, practiceQuestionQuery.data, lessonDetail],
    );

    // Parse content for section count
    const parsedContent = useMemo(() => {
        if (!lessonDetail) return null;
        return parseLessonContent(lessonDetail.lesson.content, {
            title: lessonDetail.lesson.title,
            subject: lessonDetail.module.subject,
            gradeBand: lessonDetail.module.gradeBand,
            estimatedMinutes: lessonDetail.lesson.estimatedDurationMinutes,
        });
    }, [lessonDetail]);

    const totalSections = useMemo(() => {
        if (!parsedContent) return 1;
        return consolidateSections(parsedContent.learnSections).length;
    }, [parsedContent]);

    // Scroll to top on lesson change
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        lessonStartedAt.current = Date.now();
        lessonCompletionLogged.current = false;
    }, [lessonId]);

    // Extract lesson standards for tracking
    const lessonStandards = useMemo(() => {
        if (!lessonDetail?.standards) return [];
        return lessonDetail.standards
            .map((standard) => {
                const code = (standard.code ?? '').toString().trim();
                const framework = (standard.framework ?? '').toString().trim();
                if (framework && code) return `${framework}:${code}`;
                return code || framework;
            })
            .filter((value): value is string => Boolean(value && value.length));
    }, [lessonDetail?.standards]);

    // Progress tracking
    const progressItemIds = useMemo(() => {
        const items: string[] = [];
        if (parsedContent) {
            consolidateSections(parsedContent.learnSections).forEach((_, idx) => {
                items.push(`section:${idx}`);
            });
        }
        practiceQuestions.forEach((q) => {
            items.push(`question:${q.id}`);
        });
        items.push('lesson:complete');
        return items;
    }, [parsedContent, practiceQuestions]);

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

    const handleSectionComplete = useCallback(
        (sectionIndex: number) => {
            const key = `section:${sectionIndex}`;
            if (!progressController.isComplete(key)) {
                progressController.toggleItem(key);
            }
        },
        [progressController],
    );

    /**
     * Handle phase completion
     */
    const handlePhaseChange = useCallback((phase: string) => {
        trackEvent('lesson_phase_changed', {
            lessonId,
            phase,
            studentId,
        });
    }, [lessonId, studentId]);

    /**
     * Handle lesson completion
     */
    const handleLessonComplete = useCallback(async () => {
        if (!studentId || !lessonDetail || lessonCompletionLogged.current) return;

        lessonCompletionLogged.current = true;
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - lessonStartedAt.current) / 1000));

        // Calculate XP earned (base 50 + time bonus)
        const baseXP = 50;
        const timeBonus = Math.min(25, Math.floor(elapsedSeconds / 60)); // 1 XP per minute, max 25
        const earned = baseXP + timeBonus;
        setXpEarned(earned);

        // Mark lesson as complete
        if (!progressController.isComplete('lesson:complete')) {
            progressController.toggleItem('lesson:complete');
        }

        // Emit completion event
        try {
            await emitStudentEvent({
                eventType: 'lesson_completed',
                status: 'completed',
                timeSpentSeconds: elapsedSeconds,
                difficulty: 2,
                payload: {
                    lesson_id: lessonId,
                    module_id: lessonDetail.module.id ?? null,
                    standards: lessonStandards,
                    difficulty: 2,
                    time_spent: elapsedSeconds,
                    xp_earned: earned,
                },
            });
        } catch (error) {
            console.warn('[lesson] Failed to emit lesson completion', error);
        }

        trackEvent('lesson_completed', {
            lessonId,
            studentId,
            elapsedSeconds,
            xpEarned: earned,
        });
    }, [studentId, lessonDetail, lessonId, lessonStandards, progressController, emitStudentEvent]);

    /**
     * Handle practice question answer
     */
    const handleAnswerSubmit = useCallback(async (
        questionId: number,
        optionId: number,
        isCorrect: boolean
    ) => {
        if (!studentId || !lessonDetail) return;

        const question = practiceQuestions.find((q) => q.id === questionId);
        if (!question) return;

        if (isGrade2MathPilot) {
            trackEvent('success_pilot_practice_answered', {
                lessonId,
                questionId,
                optionId,
                isCorrect,
                topic: grade2MathPilotTopic,
            });
        }

        const elapsedSeconds = 10; // Approximate time per question

        try {
            const eventOrder = progressController.allocateEventOrder();
            await recordLessonQuestionAttempt({
                studentId,
                lessonId,
                sessionId: progressController.sessionId ?? null,
                questionId,
                optionId,
                isCorrect,
                timeSpentSeconds: elapsedSeconds,
                skillIds: question.skillIds,
                masteryPct: 0, // Will be calculated after all questions
                status: 'in_progress',
                attempts: progressController.attempts ?? 1,
                eventOrder: eventOrder ?? undefined,
            });

            // Mark question as complete
            if (!progressController.isComplete(`question:${questionId}`)) {
                progressController.toggleItem(`question:${questionId}`);
            }

            // Emit practice event
            await emitStudentEvent({
                eventType: 'practice_answered',
                status: 'in_progress',
                timeSpentSeconds: elapsedSeconds,
                difficulty: 2,
                payload: {
                    question_id: questionId,
                    lesson_id: lessonId,
                    module_id: lessonDetail.module.id ?? null,
                    standards: lessonStandards,
                    correct: isCorrect,
                    difficulty: 2,
                    time_spent: elapsedSeconds,
                },
            });
        } catch (error) {
            console.warn('[lesson] Failed to record practice answer', error);
        }
    }, [studentId, lessonDetail, practiceQuestions, isGrade2MathPilot, grade2MathPilotTopic, lessonId, progressController, lessonStandards, emitStudentEvent]);

    /**
     * Handle AI tutor open with context
     */
    const handleAskTutor = useCallback((context: string) => {
        if (!context || typeof window === 'undefined') return;

        window.dispatchEvent(
            new CustomEvent('learning-assistant:open', {
                detail: {
                    prompt: context,
                    source: 'lesson',
                    lesson: lessonDetail
                        ? {
                            lessonId: lessonDetail.lesson.id,
                            lessonTitle: lessonDetail.lesson.title,
                            moduleTitle: lessonDetail.module.title,
                            subject: lessonDetail.module.subject,
                        }
                        : undefined,
                },
            }),
        );

        trackEvent('contextual_ai_help_opened', {
            studentId,
            lessonId,
            source: 'lesson_stepper',
            subject: lessonDetail?.module.subject,
        });
    }, [lessonDetail, lessonId, studentId]);

    // Error state: Invalid lesson ID
    if (!isLessonIdValid) {
        return (
            <div className="max-w-3xl mx-auto px-6 py-16 text-center text-slate-500">
                <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-4" />
                Invalid lesson identifier.
            </div>
        );
    }

    // Loading state
    if (lessonQuery.isLoading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-brand-blue">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                Loading lesson experience…
            </div>
        );
    }

    // Error state: Failed to load
    if (lessonQuery.isError || !lessonDetail) {
        return (
            <div className="max-w-3xl mx-auto px-6 py-16 text-center text-rose-500">
                <AlertTriangle className="w-10 h-10 mx-auto mb-4" />
                We couldn't load this lesson. Please return to the module and try again.
            </div>
        );
    }

    return (
        <>
            <LessonStepperProvider
                totalSections={totalSections}
                hasPracticeQuestions={practiceQuestions.length > 0}
                onPhaseChange={handlePhaseChange}
                onComplete={handleLessonComplete}
            >
                <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
                    {/* Header with breadcrumb */}
                    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4">
                            {/* Breadcrumb */}
                            <div className="flex flex-wrap items-center gap-3 text-sm text-brand-blue/80 mb-4">
                                <Link to="/catalog" className="inline-flex items-center gap-2 hover:text-brand-blue">
                                    <ArrowLeft className="h-4 w-4" /> Catalog
                                </Link>
                                <span className="text-slate-300">/</span>
                                <Link
                                    to={`/module/${lessonDetail.module.id}`}
                                    className="inline-flex items-center gap-2 hover:text-brand-blue"
                                >
                                    <PlayCircle className="h-4 w-4" /> {lessonDetail.module.title}
                                </Link>
                            </div>

                            {/* Lesson Header */}
                            <LessonHeader
                                title={lessonDetail.lesson.title}
                                subject={lessonDetail.module.subject}
                                gradeBand={lessonDetail.module.gradeBand}
                            />

                            {lessonReasonCard && (
                                <div
                                    className={[
                                        'mt-3 rounded-xl border px-4 py-3',
                                        lessonReasonCard.tone === 'challenge'
                                            ? 'border-indigo-200 bg-indigo-50'
                                            : lessonReasonCard.tone === 'support'
                                                ? 'border-amber-200 bg-amber-50'
                                                : 'border-blue-200 bg-blue-50',
                                    ].join(' ')}
                                >
                                    <div className="flex items-start gap-2">
                                        <HelpCircle
                                            className={[
                                                'mt-0.5 h-4 w-4 shrink-0',
                                                lessonReasonCard.tone === 'challenge'
                                                    ? 'text-indigo-700'
                                                    : lessonReasonCard.tone === 'support'
                                                        ? 'text-amber-700'
                                                        : 'text-blue-700',
                                            ].join(' ')}
                                        />
                                        <div>
                                            <p
                                                className={[
                                                    'text-xs font-semibold uppercase tracking-wide',
                                                    lessonReasonCard.tone === 'challenge'
                                                        ? 'text-indigo-800'
                                                        : lessonReasonCard.tone === 'support'
                                                            ? 'text-amber-800'
                                                            : 'text-blue-800',
                                                ].join(' ')}
                                            >
                                                {lessonReasonCard.title}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-700">{lessonReasonCard.detail}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Report Content Issue */}
                            <div className="flex justify-end mt-2">
                                <ContentIssueReport
                                    lessonId={lessonDetail.lesson.id}
                                    lessonTitle={lessonDetail.lesson.title}
                                    subject={lessonDetail.module.subject}
                                    userId={user?.id ?? ''}
                                    studentId={studentId}
                                    compact
                                />
                            </div>
                        </div>
                    </header>

                    {/* Main content with stepper */}
                    <main className="max-w-4xl mx-auto px-4 md:px-6">
                        {/* Progress bar */}
                        <div className="py-6">
                            <LessonProgressBar />
                        </div>

                        {/* Phase content */}
                        <LessonContent
                            lessonDetail={lessonDetail}
                            pilotTopic={grade2MathPilotTopic}
                            nonMathRemediationSubject={nonMathRemediationSubject}
                            practiceQuestions={practiceQuestions}
                            onAnswerSubmit={handleAnswerSubmit}
                            onAskTutor={studentId ? handleAskTutor : undefined}
                            onSectionComplete={handleSectionComplete}
                            xpEarned={xpEarned}
                        />
                    </main>
                </div>
            </LessonStepperProvider>

            {/* Learning Assistant (AI Tutor) - Only for students */}
            {studentId && <LearningAssistant />}
        </>
    );
};

export default LessonPlayerPage;
