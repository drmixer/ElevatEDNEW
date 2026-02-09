/**
 * PracticePhase Component
 * 
 * Practice questions phase with one-at-a-time display and immediate feedback.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    XCircle,
    ArrowRight,
    Lightbulb,
    Bot,
    ListOrdered,
} from 'lucide-react';
import { LessonCard, LessonCardBody, LessonCardFooter } from '../LessonCard';
import { useLessonStepper } from '../LessonStepper';
import type { LessonPracticeQuestion, LessonPracticeOption } from '../../../types';
import trackEvent from '../../../lib/analytics';
import { getPracticeQuestionVisual } from '../../../lib/lessonVisuals';
import type { Grade2MathPilotTopic } from '../../../lib/pilotConditions';
import { getGrade2MathChallengeQuestion, getGrade2MathQuickReview } from '../../../lib/pilotGrade2Math';
import { evaluateMasteryTrend } from '../../../lib/masteryTrend';
import { buildSupportReasonCard } from '../../../lib/transparencyReason';
import {
    getDeterministicNonMathChallengeQuestion,
    getDeterministicNonMathHint,
    getDeterministicNonMathQuickReview,
    getDeterministicNonMathSteps,
    getNonMathRemediationTopic,
    type NonMathRemediationSubject,
} from '../../../lib/nonMathRemediation';
import {
    getDeterministicK5MathChallengeQuestion,
    getDeterministicK5MathHint,
    getDeterministicK5MathQuickReview,
    getDeterministicK5MathSteps,
    getK5MathAdaptationTopic,
} from '../../../lib/k5MathAdaptation';

interface PracticePhaseProps {
    questions: LessonPracticeQuestion[];
    lessonId?: number;
    pilotTelemetryEnabled?: boolean;
    pilotTopic?: Grade2MathPilotTopic | null;
    nonMathRemediationSubject?: NonMathRemediationSubject | null;
    lessonTitle?: string | null;
    lessonContent?: string | null;
    subject?: string | null;
    gradeBand?: string | null;
    onAnswerSubmit?: (questionId: number, optionId: number, isCorrect: boolean) => void;
    onAskTutor?: (context: string) => void;
}

interface QuestionState {
    selectedOptionId: number | null;
    isAnswered: boolean;
    isCorrect: boolean;
}

type QuickReviewState = {
    isVisible: boolean;
    selectedIndex: number | null;
    isCorrect: boolean | null;
};

type ChallengeState =
    | { status: 'idle' }
    | { status: 'offered' }
    | { status: 'active' }
    | { status: 'completed'; isCorrect: boolean };

type ShapeType = 'square' | 'rectangle' | 'triangle';

const mulberry32 = (seed: number) => {
    let t = seed >>> 0;
    return () => {
        t += 0x6D2B79F5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
};

const arrangeOptionsWithCorrectAt = (options: LessonPracticeOption[], seed: number): LessonPracticeOption[] => {
    const correct = options.find((o) => o.isCorrect);
    const wrongs = options.filter((o) => !o.isCorrect);
    if (!correct || wrongs.length < 2) return options;

    const rand = mulberry32(seed);
    const shuffledWrongs = wrongs.slice();
    for (let i = shuffledWrongs.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [shuffledWrongs[i], shuffledWrongs[j]] = [shuffledWrongs[j], shuffledWrongs[i]];
    }

    const targetIndex = Math.abs(seed) % options.length;
    const arranged: LessonPracticeOption[] = new Array(options.length);
    arranged[targetIndex] = correct;
    let w = 0;
    for (let i = 0; i < arranged.length; i += 1) {
        if (i === targetIndex) continue;
        arranged[i] = shuffledWrongs[w] ?? shuffledWrongs[0] ?? correct;
        w += 1;
    }
    return arranged;
};

const detectShapeFromText = (text: string | null | undefined): ShapeType | null => {
    const t = (text ?? '').toString().toLowerCase();
    if (/\bsquare\b/.test(t)) return 'square';
    if (/\brectangle\b/.test(t)) return 'rectangle';
    if (/\btriangle\b/.test(t)) return 'triangle';
    return null;
};

const shapePillStyles: Record<ShapeType, { label: string; className: string }> = {
    square: { label: 'Square', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
    rectangle: { label: 'Rectangle', className: 'border-indigo-200 bg-indigo-50 text-indigo-800' },
    triangle: { label: 'Triangle', className: 'border-amber-200 bg-amber-50 text-amber-900' },
};

export const PracticePhase: React.FC<PracticePhaseProps> = ({
    questions,
    lessonId,
    pilotTelemetryEnabled,
    pilotTopic,
    nonMathRemediationSubject,
    lessonTitle,
    lessonContent,
    subject,
    gradeBand,
    onAnswerSubmit,
    onAskTutor,
}) => {
    const { nextPhase, updatePracticeScore, previousPhase } = useLessonStepper();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [questionStates, setQuestionStates] = useState<Map<number, QuestionState>>(new Map());
    const [hintShown, setHintShown] = useState<Set<number>>(() => new Set());
    const [hintUsedByQuestion, setHintUsedByQuestion] = useState<Set<number>>(() => new Set());
    const [stepsShown, setStepsShown] = useState<Set<number>>(() => new Set());

    const currentQuestion = questions[currentIndex];
    const resolvedPilotTopic = pilotTopic ?? 'perimeter';
    const nonMathTopic = useMemo(
        () =>
            getNonMathRemediationTopic({
                subject: nonMathRemediationSubject ?? null,
                lessonTitle,
                lessonContent,
                questionPrompt: currentQuestion?.prompt ?? null,
            }),
        [currentQuestion?.prompt, lessonContent, lessonTitle, nonMathRemediationSubject],
    );
    const k5MathTopic = useMemo(
        () =>
            getK5MathAdaptationTopic({
                subject: subject ?? null,
                gradeBand: gradeBand ?? null,
                lessonTitle,
                lessonContent,
                questionPrompt: currentQuestion?.prompt ?? null,
            }),
        [currentQuestion?.prompt, gradeBand, lessonContent, lessonTitle, subject],
    );
    const remediationTelemetrySource = pilotTelemetryEnabled
        ? 'grade2_math_pilot'
        : k5MathTopic
            ? 'k5_math_template'
            : 'non_math_template';
    const remediationTemplatesEnabled = Boolean(pilotTelemetryEnabled || nonMathRemediationSubject || k5MathTopic);
    const currentState = currentQuestion ? questionStates.get(currentQuestion.id) : null;
    const isAnswered = currentState?.isAnswered ?? false;
    const isCorrect = currentState?.isCorrect ?? false;
    const selectedOptionId = currentState?.selectedOptionId ?? null;

    const isLastQuestion = currentIndex >= questions.length - 1;
    const answeredCount = questionStates.size;
    const correctCount = Array.from(questionStates.values()).filter((s) => s.isCorrect).length;
    const incorrectCount = Math.max(0, answeredCount - correctCount);
    const detectedShape = detectShapeFromText(currentQuestion?.prompt ?? currentQuestion?.visual?.alt);

    const currentVisual = useMemo(() => {
        if (!currentQuestion) return null;
        if (currentQuestion.visual) return currentQuestion.visual;
        return getPracticeQuestionVisual({
            lessonTitle: lessonTitle ?? null,
            subject: subject ?? null,
            gradeBand: gradeBand ?? null,
            prompt: currentQuestion.prompt ?? '',
        });
    }, [currentQuestion, gradeBand, lessonTitle, subject]);

    const [quickReview, setQuickReview] = useState<QuickReviewState>({
        isVisible: false,
        selectedIndex: null,
        isCorrect: null,
    });

    const masteryAttempts = useMemo(() => {
        const attempts: Array<{ isCorrect: boolean; usedHint: boolean }> = [];
        questions.forEach((question) => {
            const state = questionStates.get(question.id);
            if (!state?.isAnswered) return;
            attempts.push({
                isCorrect: state.isCorrect,
                usedHint: hintUsedByQuestion.has(question.id),
            });
        });
        return attempts;
    }, [hintUsedByQuestion, questionStates, questions]);

    const masteryTrend = useMemo(
        () =>
            evaluateMasteryTrend({
                attempts: masteryAttempts,
                questionCount: questions.length,
                quickReviewShown: quickReview.isVisible,
                quickReviewCorrect: quickReview.isCorrect,
            }),
        [masteryAttempts, quickReview.isCorrect, quickReview.isVisible, questions.length],
    );

    const quickReviewContent = useMemo(() => {
        if (pilotTelemetryEnabled) {
            return getGrade2MathQuickReview({
                topic: resolvedPilotTopic,
                questionPrompt: currentQuestion?.prompt ?? '',
            });
        }
        if (k5MathTopic) {
            return getDeterministicK5MathQuickReview({
                lessonId,
                subject: subject ?? null,
                gradeBand: gradeBand ?? null,
                lessonTitle,
                lessonContent,
                questionPrompt: currentQuestion?.prompt ?? null,
                topic: k5MathTopic,
            });
        }
        return getDeterministicNonMathQuickReview({
            subject: nonMathRemediationSubject ?? null,
            lessonTitle,
            lessonContent,
            questionPrompt: currentQuestion?.prompt ?? null,
        });
    }, [
        currentQuestion?.prompt,
        gradeBand,
        k5MathTopic,
        lessonContent,
        lessonId,
        lessonTitle,
        nonMathRemediationSubject,
        pilotTelemetryEnabled,
        resolvedPilotTopic,
        subject,
    ]);
    const remediationTopic = pilotTelemetryEnabled ? resolvedPilotTopic : k5MathTopic ?? quickReviewContent?.topic ?? nonMathTopic;

    const deterministicHint = useMemo(() => {
        if (!currentQuestion) return null;
        if (currentQuestion.hint) return currentQuestion.hint;
        if (k5MathTopic) {
            return getDeterministicK5MathHint({
                subject: subject ?? null,
                gradeBand: gradeBand ?? null,
                lessonTitle,
                lessonContent,
                questionPrompt: currentQuestion.prompt,
                topic: k5MathTopic,
            });
        }
        return getDeterministicNonMathHint({
            subject: nonMathRemediationSubject ?? null,
            lessonTitle,
            lessonContent,
            questionPrompt: currentQuestion.prompt,
        });
    }, [currentQuestion, gradeBand, k5MathTopic, lessonContent, lessonTitle, nonMathRemediationSubject, subject]);

    const deterministicSteps = useMemo(() => {
        if (!currentQuestion) return null;
        if (currentQuestion.steps?.length) return currentQuestion.steps;
        if (k5MathTopic) {
            return getDeterministicK5MathSteps({
                subject: subject ?? null,
                gradeBand: gradeBand ?? null,
                lessonTitle,
                lessonContent,
                questionPrompt: currentQuestion.prompt,
                topic: k5MathTopic,
            });
        }
        return getDeterministicNonMathSteps({
            subject: nonMathRemediationSubject ?? null,
            lessonTitle,
            lessonContent,
            questionPrompt: currentQuestion.prompt,
        });
    }, [currentQuestion, gradeBand, k5MathTopic, lessonContent, lessonTitle, nonMathRemediationSubject, subject]);

    const [challengeState, setChallengeState] = useState<ChallengeState>({ status: 'idle' });
    const showChallengeFlow = remediationTemplatesEnabled && challengeState.status !== 'idle';
    const trendDecisionKeyRef = useRef<string>('');
    const supportReasonCardKeyRef = useRef<string>('');

    const activeSupportReasonCard = useMemo(() => {
        if (!remediationTemplatesEnabled) return null;

        if (challengeState.status !== 'idle') {
            return buildSupportReasonCard({
                mode: 'challenge',
                topic: remediationTopic,
                recommendation: masteryTrend.recommendation,
                accuracyPct: Math.round(masteryTrend.accuracy * 100),
                hintRatePct: Math.round(masteryTrend.hintRate * 100),
            });
        }

        if (quickReview.isVisible) {
            return buildSupportReasonCard({
                mode: 'quick_review',
                topic: remediationTopic,
                recommendation: masteryTrend.recommendation,
                trigger: masteryTrend.shouldTriggerQuickReview ? 'mastery_trend' : 'practice_miss_2plus',
                accuracyPct: Math.round(masteryTrend.accuracy * 100),
                hintRatePct: Math.round(masteryTrend.hintRate * 100),
            });
        }

        if (currentQuestion && deterministicHint && hintShown.has(currentQuestion.id)) {
            return buildSupportReasonCard({
                mode: 'hint',
                topic: remediationTopic,
                recommendation: masteryTrend.recommendation,
            });
        }

        if (masteryTrend.answered >= 2) {
            return buildSupportReasonCard({
                mode: 'trend',
                topic: remediationTopic,
                recommendation: masteryTrend.recommendation,
                accuracyPct: Math.round(masteryTrend.accuracy * 100),
            });
        }

        return null;
    }, [
        challengeState.status,
        currentQuestion,
        deterministicHint,
        hintShown,
        masteryTrend.accuracy,
        masteryTrend.answered,
        masteryTrend.hintRate,
        masteryTrend.recommendation,
        masteryTrend.shouldTriggerQuickReview,
        quickReview.isVisible,
        remediationTemplatesEnabled,
        remediationTopic,
    ]);

    React.useEffect(() => {
        if (!activeSupportReasonCard) return;
        const key = `${activeSupportReasonCard.title}:${activeSupportReasonCard.detail}:${activeSupportReasonCard.tone}`;
        if (supportReasonCardKeyRef.current === key) return;
        supportReasonCardKeyRef.current = key;
        trackEvent('success_transparency_support_reason_shown', {
            lessonId,
            phase: 'practice',
            source: remediationTelemetrySource,
            subject: nonMathRemediationSubject ?? 'math',
            topic: remediationTopic,
            tone: activeSupportReasonCard.tone,
            title: activeSupportReasonCard.title,
        });
    }, [activeSupportReasonCard, lessonId, nonMathRemediationSubject, remediationTelemetrySource, remediationTopic]);

    const handleSelectOption = useCallback((option: LessonPracticeOption) => {
        if (isAnswered || !currentQuestion) return;

        const newState: QuestionState = {
            selectedOptionId: option.id,
            isAnswered: true,
            isCorrect: option.isCorrect,
        };

        setQuestionStates((prev) => {
            const next = new Map(prev);
            next.set(currentQuestion.id, newState);
            return next;
        });

        // Update score
        const newCorrectCount = correctCount + (option.isCorrect ? 1 : 0);
        updatePracticeScore(newCorrectCount, questions.length);

        // Notify parent
        onAnswerSubmit?.(currentQuestion.id, option.id, option.isCorrect);
    }, [isAnswered, currentQuestion, correctCount, questions.length, updatePracticeScore, onAnswerSubmit]);

    React.useEffect(() => {
        if (!remediationTemplatesEnabled) return;
        if (masteryTrend.answered === 0) return;

        const decisionKey = [
            masteryTrend.answered,
            masteryTrend.recommendation,
            masteryTrend.direction,
            masteryTrend.score,
            quickReview.isVisible ? 1 : 0,
            quickReview.isCorrect == null ? 'na' : quickReview.isCorrect ? '1' : '0',
        ].join(':');
        if (trendDecisionKeyRef.current === decisionKey) return;
        trendDecisionKeyRef.current = decisionKey;

        trackEvent('success_mastery_trend_scheduling_decision', {
            lessonId,
            phase: 'practice',
            source: remediationTelemetrySource,
            subject: nonMathRemediationSubject ?? 'math',
            topic: remediationTopic,
            recommendation: masteryTrend.recommendation,
            trendDirection: masteryTrend.direction,
            score: masteryTrend.score,
            answered: masteryTrend.answered,
            correct: masteryTrend.correct,
            incorrect: masteryTrend.incorrect,
            accuracyPct: Math.round(masteryTrend.accuracy * 100),
            recentAccuracyPct: Math.round(masteryTrend.recentAccuracy * 100),
            hintRatePct: Math.round(masteryTrend.hintRate * 100),
        });
    }, [
        lessonId,
        masteryTrend,
        nonMathRemediationSubject,
        quickReview.isCorrect,
        quickReview.isVisible,
        remediationTelemetrySource,
        remediationTemplatesEnabled,
        remediationTopic,
    ]);

    const quickReviewTrigger = useCallback(() => {
        if (!remediationTemplatesEnabled) return;
        if (!quickReviewContent) return;
        if (quickReview.isVisible) return;
        const triggeredByMissCount = incorrectCount >= 2;
        const triggeredByTrend = !triggeredByMissCount && masteryTrend.shouldTriggerQuickReview;
        if (!triggeredByMissCount && !triggeredByTrend) return;
        const trigger = triggeredByMissCount ? 'practice_miss_2plus' : 'mastery_trend';
        setQuickReview({ isVisible: true, selectedIndex: null, isCorrect: null });
        trackEvent('success_remediation_activated', {
            lessonId,
            phase: 'practice',
            remediationType: 'quick_review',
            source: remediationTelemetrySource,
            subject: nonMathRemediationSubject ?? 'math',
            topic: remediationTopic,
            trigger,
            incorrectCount,
        });
        if (pilotTelemetryEnabled) {
            trackEvent('success_pilot_quick_review_shown', {
                lessonId,
                phase: 'practice',
                trigger,
                incorrectCount,
            });
        }
    }, [
        incorrectCount,
        lessonId,
        masteryTrend.shouldTriggerQuickReview,
        nonMathRemediationSubject,
        pilotTelemetryEnabled,
        quickReview.isVisible,
        quickReviewContent,
        remediationTopic,
        remediationTelemetrySource,
        remediationTemplatesEnabled,
    ]);

    // Trigger after state updates from answering.
    React.useEffect(() => {
        quickReviewTrigger();
    }, [quickReviewTrigger]);

    const handleQuickReviewAnswer = (selectedIndex: number) => {
        if (!quickReviewContent) return;
        const isCorrect = selectedIndex === quickReviewContent.correctIndex;
        setQuickReview((prev) => ({ ...prev, selectedIndex, isCorrect }));
        trackEvent('success_remediation_outcome', {
            lessonId,
            phase: 'practice',
            remediationType: 'quick_review',
            source: remediationTelemetrySource,
            subject: nonMathRemediationSubject ?? 'math',
            topic: remediationTopic,
            isCorrect,
        });
        if (pilotTelemetryEnabled) {
            trackEvent('success_pilot_quick_review_answered', {
                lessonId,
                phase: 'practice',
                isCorrect,
            });
        }
    };

    const handleNext = () => {
        if (isLastQuestion) {
            const offerChallenge = remediationTemplatesEnabled && challengeQuestion && masteryTrend.shouldOfferChallenge;
            if (offerChallenge && challengeState.status === 'idle') {
                setChallengeState({ status: 'offered' });
                trackEvent('success_remediation_activated', {
                    lessonId,
                    phase: 'practice',
                    remediationType: 'challenge_offer',
                    source: remediationTelemetrySource,
                    subject: nonMathRemediationSubject ?? 'math',
                    topic: remediationTopic,
                    trigger: 'mastery_trend',
                    correctCount,
                    total: questions.length,
                });
                if (pilotTelemetryEnabled) {
                    trackEvent('success_pilot_challenge_offered', {
                        lessonId,
                        phase: 'practice',
                        correctCount,
                        total: questions.length,
                    });
                }
                return;
            }
            nextPhase();
            return;
        }

        setCurrentIndex((prev) => prev + 1);
    };

    const challengeQuestion = useMemo((): LessonPracticeQuestion | null => {
        const baseQuestion = pilotTelemetryEnabled
            ? getGrade2MathChallengeQuestion({ topic: resolvedPilotTopic })
            : k5MathTopic
                ? getDeterministicK5MathChallengeQuestion({
                    lessonId,
                    subject: subject ?? null,
                    gradeBand: gradeBand ?? null,
                    lessonTitle,
                    lessonContent,
                    questionPrompt: currentQuestion?.prompt ?? null,
                    topic: k5MathTopic,
                })
                : getDeterministicNonMathChallengeQuestion({
                    lessonId,
                    subject: nonMathRemediationSubject ?? null,
                    lessonTitle,
                    lessonContent,
                    questionPrompt: currentQuestion?.prompt ?? null,
                });
        if (!baseQuestion) return null;
        const options = arrangeOptionsWithCorrectAt(baseQuestion.options, (lessonId ?? 0) * 100 + 17);
        return { ...baseQuestion, options };
    }, [
        currentQuestion?.prompt,
        gradeBand,
        k5MathTopic,
        lessonContent,
        lessonId,
        lessonTitle,
        nonMathRemediationSubject,
        pilotTelemetryEnabled,
        resolvedPilotTopic,
        subject,
    ]);

    const [challengeSelectedOptionId, setChallengeSelectedOptionId] = useState<number | null>(null);

    const handleStartChallenge = () => {
        if (!remediationTemplatesEnabled) return;
        if (!challengeQuestion) return;
        setChallengeState({ status: 'active' });
        setChallengeSelectedOptionId(null);
        trackEvent('success_remediation_activated', {
            lessonId,
            phase: 'practice',
            remediationType: 'challenge_started',
            source: remediationTelemetrySource,
            subject: nonMathRemediationSubject ?? 'math',
            topic: remediationTopic,
        });
        if (pilotTelemetryEnabled) {
            trackEvent('success_pilot_challenge_started', { lessonId, phase: 'practice' });
        }
    };

    const handleAnswerChallenge = (option: LessonPracticeOption) => {
        if (!challengeQuestion) return;
        if (challengeState.status !== 'active') return;
        if (challengeSelectedOptionId != null) return;
        setChallengeSelectedOptionId(option.id);
        setChallengeState({ status: 'completed', isCorrect: option.isCorrect });
        trackEvent('success_remediation_outcome', {
            lessonId,
            phase: 'practice',
            remediationType: 'challenge',
            source: remediationTelemetrySource,
            subject: nonMathRemediationSubject ?? 'math',
            topic: remediationTopic,
            isCorrect: option.isCorrect,
        });
        if (pilotTelemetryEnabled) {
            trackEvent('success_pilot_challenge_answered', {
                lessonId,
                phase: 'practice',
                isCorrect: option.isCorrect,
            });
        }
    };

    const handleAskForHint = () => {
        if (!currentQuestion) return;

        if (pilotTelemetryEnabled) {
            trackEvent('success_pilot_practice_hint_clicked', {
                lessonId,
                questionId: currentQuestion.id,
                hasDeterministicHint: Boolean(deterministicHint),
            });
        }

        if (deterministicHint) {
            const willShow = !hintShown.has(currentQuestion.id);
            if (willShow) {
                setHintUsedByQuestion((prev) => {
                    const next = new Set(prev);
                    next.add(currentQuestion.id);
                    return next;
                });
            }
            setHintShown((prev) => {
                const next = new Set(prev);
                if (next.has(currentQuestion.id)) {
                    next.delete(currentQuestion.id);
                } else {
                    next.add(currentQuestion.id);
                }
                return next;
            });
            if (willShow) {
                trackEvent('success_remediation_activated', {
                    lessonId,
                    phase: 'practice',
                    remediationType: 'hint',
                    source: currentQuestion.hint ? 'question_hint' : remediationTelemetrySource,
                    subject: nonMathRemediationSubject ?? 'math',
                    topic: remediationTopic,
                    questionId: currentQuestion.id,
                });
            }
            return;
        }

        if (onAskTutor) {
            onAskTutor(
                `I need a hint for this question: "${currentQuestion.prompt}". Don't give away the answer, just help me think about it.`,
            );
        }
    };

    const handleShowSteps = () => {
        if (!currentQuestion) return;
        if (!deterministicSteps || deterministicSteps.length === 0) return;
        if (!isAnswered) return;

        if (pilotTelemetryEnabled) {
            trackEvent('success_pilot_practice_show_steps_clicked', {
                lessonId,
                questionId: currentQuestion.id,
            });
        }

        setStepsShown((prev) => {
            const next = new Set(prev);
            if (next.has(currentQuestion.id)) {
                next.delete(currentQuestion.id);
            } else {
                next.add(currentQuestion.id);
            }
            return next;
        });
    };

    if (questions.length === 0) {
        return (
            <div className="max-w-2xl mx-auto">
                <LessonCard>
                    <LessonCardBody className="text-center py-12">
                        <div className="text-slate-400 mb-4">
                            <Lightbulb className="h-12 w-12 mx-auto" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900 mb-2">
                            No Practice Questions Yet
                        </h2>
                        <p className="text-slate-600 mb-6">
                            Practice questions for this lesson are coming soon!
                        </p>
                        <button
                            type="button"
                            onClick={nextPhase}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 transition-colors"
                        >
                            Continue to Review
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </LessonCardBody>
                </LessonCard>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            <LessonCard>
                {/* Question header */}
                <div className="border-b border-slate-100 px-6 py-4 md:px-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                Practice Question
                            </h2>
                            <p className="text-sm text-slate-500">
                                Question {currentIndex + 1} of {questions.length}
                            </p>
                        </div>
                        <div className="text-sm font-medium text-slate-600">
                            {correctCount}/{answeredCount} correct
                        </div>
                    </div>

                    {/* Progress dots */}
                    <div className="mt-3 flex items-center gap-1.5">
                        {questions.map((q, index) => {
                            const state = questionStates.get(q.id);
                            return (
                                <div
                                    key={q.id}
                                    className={`h-2 w-2 rounded-full transition-colors ${index === currentIndex
                                        ? 'bg-blue-500 ring-2 ring-blue-200'
                                        : state?.isCorrect
                                            ? 'bg-emerald-500'
                                            : state?.isAnswered
                                                ? 'bg-rose-400'
                                                : 'bg-slate-200'
                                        }`}
                                />
                            );
                        })}
                    </div>
                </div>

                <LessonCardBody>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={
                                challengeState.status === 'active' || challengeState.status === 'completed'
                                    ? 'challenge'
                                    : currentQuestion?.id
                            }
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeSupportReasonCard && (
                                <div
                                    className={[
                                        'mb-4 rounded-xl border px-4 py-3 text-sm',
                                        activeSupportReasonCard.tone === 'challenge'
                                            ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
                                            : activeSupportReasonCard.tone === 'support'
                                                ? 'border-amber-200 bg-amber-50 text-amber-900'
                                                : 'border-sky-200 bg-sky-50 text-sky-900',
                                    ].join(' ')}
                                >
                                    <p className="text-xs font-semibold uppercase tracking-wide">{activeSupportReasonCard.title}</p>
                                    <p className="mt-1">{activeSupportReasonCard.detail}</p>
                                </div>
                            )}

                            {remediationTemplatesEnabled && challengeQuestion && challengeState.status === 'offered' && (
                                <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                                    <div className="text-sm font-semibold text-indigo-900">Nice work!</div>
                                    <div className="mt-1 text-sm text-indigo-900/90">
                                        Want an optional challenge question?
                                    </div>
                                    <div className="mt-3 flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={handleStartChallenge}
                                            className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                                        >
                                            Try challenge
                                        </button>
                                        <button
                                            type="button"
                                            onClick={nextPhase}
                                            className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                                        >
                                            Skip
                                        </button>
                                    </div>
                                </div>
                            )}

                            {remediationTemplatesEnabled && challengeQuestion && (challengeState.status === 'active' || challengeState.status === 'completed') && (
                                <>
                                    {challengeQuestion.visual && (
                                        <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                                            <img
                                                src={challengeQuestion.visual.svg}
                                                alt={challengeQuestion.visual.alt}
                                                className="block w-full"
                                                loading="lazy"
                                            />
                                        </div>
                                    )}

                                    <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-5 leading-snug line-clamp-2">
                                        {challengeQuestion.prompt}
                                    </h3>

                                    <div className="space-y-3">
                                        {challengeQuestion.options.map((option, index) => {
                                            const isSelected = challengeSelectedOptionId === option.id;
                                            const isAnsweredChallenge = challengeState.status === 'completed';
                                            const showCorrect = isAnsweredChallenge && option.isCorrect;
                                            const showIncorrect = isAnsweredChallenge && isSelected && !option.isCorrect;

                                            return (
                                                <motion.button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => handleAnswerChallenge(option)}
                                                    disabled={isAnsweredChallenge}
                                                    whileHover={!isAnsweredChallenge ? { scale: 1.01 } : {}}
                                                    whileTap={!isAnsweredChallenge ? { scale: 0.99 } : {}}
                                                    className={`
                          w-full rounded-xl border-2 p-4 md:p-5 text-left transition-all
                          flex items-start gap-3
                          ${!isAnsweredChallenge
                                                        ? 'border-slate-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                                                        : showCorrect
                                                            ? 'border-emerald-300 bg-emerald-50'
                                                            : showIncorrect
                                                                ? 'border-rose-300 bg-rose-50'
                                                                : 'border-slate-200 bg-slate-50 opacity-60'
                                                    }
                        `}
                                                >
                                                    <span
                                                        className={`
                            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                            text-sm font-semibold
                            ${showCorrect
                                                                ? 'bg-emerald-500 text-white'
                                                                : showIncorrect
                                                                    ? 'bg-rose-500 text-white'
                                                                    : 'bg-slate-100 text-slate-600'
                                                            }
                          `}
                                                    >
                                                        {showCorrect ? (
                                                            <CheckCircle2 className="h-5 w-5" />
                                                        ) : showIncorrect ? (
                                                            <XCircle className="h-5 w-5" />
                                                        ) : (
                                                            String.fromCharCode(65 + index)
                                                        )}
                                                    </span>

                                                    <div className="flex-1">
                                                        <span
                                                            className={`
                              text-base md:text-lg font-semibold line-clamp-2
                              ${showCorrect
                                                                    ? 'text-emerald-900'
                                                                    : showIncorrect
                                                                        ? 'text-rose-900'
                                                                        : 'text-slate-800'
                                                                }
                            `}
                                                        >
                                                            {option.text}
                                                        </span>
                                                        {isAnsweredChallenge && isSelected && option.feedback && (
                                                            <motion.p
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                className="mt-2 text-sm text-slate-600"
                                                            >
                                                                {option.feedback}
                                                            </motion.p>
                                                        )}
                                                    </div>
                                                </motion.button>
                                            );
                                        })}
                                    </div>

                                    {challengeState.status === 'completed' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mt-6 rounded-xl border border-slate-200 bg-white p-4"
                                        >
                                            <p
                                                className={[
                                                    'font-semibold',
                                                    challengeState.isCorrect ? 'text-emerald-700' : 'text-amber-700',
                                                ].join(' ')}
                                            >
                                                {challengeState.isCorrect ? 'Correct!' : 'Not quite'}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-600">{challengeQuestion.explanation}</p>
                                            <div className="mt-3">
                                                <button
                                                    type="button"
                                                    onClick={nextPhase}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 transition-colors"
                                                >
                                                    Continue to Review
                                                    <ArrowRight className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </>
                            )}

                            {!showChallengeFlow && remediationTemplatesEnabled && quickReviewContent && quickReview.isVisible && (
                                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                    <div className="text-sm font-semibold text-amber-900">Quick Review</div>
                                    <div className="mt-1 text-sm text-amber-900/90">
                                        {quickReviewContent.explanation}
                                    </div>

                                    {currentVisual && (
                                        <div className="mt-3 overflow-hidden rounded-lg border border-amber-200 bg-white">
                                            <img
                                                src={currentVisual.svg}
                                                alt={currentVisual.alt}
                                                className="block w-full"
                                                loading="lazy"
                                            />
                                        </div>
                                    )}

                                    <div className="mt-3 text-base font-bold text-slate-900 line-clamp-2">
                                        {quickReviewContent.prompt}
                                    </div>
                                    <div className="mt-2 grid gap-2">
                                        {quickReviewContent.options.map((option, idx) => {
                                            const selected = quickReview.selectedIndex === idx;
                                            const showCorrect = quickReview.isCorrect !== null && idx === quickReviewContent.correctIndex;
                                            const showIncorrect =
                                                quickReview.isCorrect === false && selected && idx !== quickReviewContent.correctIndex;
                                            return (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    disabled={quickReview.isCorrect === true}
                                                    onClick={() => handleQuickReviewAnswer(idx)}
                                                    className={[
                                                        'w-full rounded-xl border-2 px-4 py-3 text-left text-base font-semibold transition-colors',
                                                        quickReview.isCorrect === true
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
                                                    <span className="line-clamp-2">{option}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {quickReview.isCorrect === false && (
                                        <div className="mt-3 text-sm text-rose-900">
                                            {quickReviewContent.explanation}
                                        </div>
                                    )}
                                </div>
                            )}

                            {!showChallengeFlow && detectedShape && (
                                <div className="mb-3">
                                    <span
                                        className={[
                                            'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                                            shapePillStyles[detectedShape].className,
                                        ].join(' ')}
                                    >
                                        {shapePillStyles[detectedShape].label}
                                    </span>
                                </div>
                            )}

                            {/* Question prompt */}
                            {!showChallengeFlow && currentVisual && (
                                <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                                    <img
                                        src={currentVisual.svg}
                                        alt={currentVisual.alt}
                                        className="block w-full"
                                        loading="lazy"
                                    />
                                </div>
                            )}
                            {!showChallengeFlow && (
                                <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-5 leading-snug line-clamp-2">
                                {currentQuestion?.prompt}
                                </h3>
                            )}

                            {/* Hint button (before answering) */}
                            {!showChallengeFlow && !isAnswered && (onAskTutor || deterministicHint) && (
                                <button
                                    type="button"
                                    onClick={handleAskForHint}
                                    className="inline-flex items-center gap-1.5 mb-4 text-sm text-blue-600 hover:text-blue-700"
                                >
                                    <Bot className="h-4 w-4" />
                                    Need a hint?
                                </button>
                            )}

                            {!showChallengeFlow && !isAnswered && deterministicHint && currentQuestion && hintShown.has(currentQuestion.id) && (
                                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                                    {deterministicHint}
                                </div>
                            )}

                            {/* Answer options */}
                            {!showChallengeFlow && (
                                <div className="space-y-3">
                                {currentQuestion?.options.map((option, index) => {
                                    const isSelected = selectedOptionId === option.id;
                                    const showCorrect = isAnswered && option.isCorrect;
                                    const showIncorrect = isAnswered && isSelected && !option.isCorrect;

                                    return (
                                        <motion.button
                                            key={option.id}
                                            type="button"
                                            onClick={() => handleSelectOption(option)}
                                            disabled={isAnswered}
                                            whileHover={!isAnswered ? { scale: 1.01 } : {}}
                                            whileTap={!isAnswered ? { scale: 0.99 } : {}}
                                            className={`
                        w-full rounded-xl border-2 p-4 md:p-5 text-left transition-all
                        flex items-start gap-3
                        ${!isAnswered
                                                    ? 'border-slate-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                                                    : showCorrect
                                                        ? 'border-emerald-300 bg-emerald-50'
                                                        : showIncorrect
                                                            ? 'border-rose-300 bg-rose-50'
                                                            : 'border-slate-200 bg-slate-50 opacity-60'
                                                }
                      `}
                                        >
                                            {/* Option letter */}
                                            <span
                                                className={`
                          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                          text-sm font-semibold
                          ${showCorrect
                                                        ? 'bg-emerald-500 text-white'
                                                        : showIncorrect
                                                            ? 'bg-rose-500 text-white'
                                                            : 'bg-slate-100 text-slate-600'
                                                    }
                        `}
                                            >
                                                {showCorrect ? (
                                                    <CheckCircle2 className="h-5 w-5" />
                                                ) : showIncorrect ? (
                                                    <XCircle className="h-5 w-5" />
                                                ) : (
                                                    String.fromCharCode(65 + index)
                                                )}
                                            </span>

                                            {/* Option text */}
                                            <div className="flex-1">
                                                <span
                                                    className={`
                            text-base md:text-lg font-semibold line-clamp-2
                            ${showCorrect
                                                            ? 'text-emerald-900'
                                                            : showIncorrect
                                                                ? 'text-rose-900'
                                                                : 'text-slate-800'
                                                        }
                          `}
                                                >
                                                    {option.text}
                                                </span>

                                                {/* Feedback */}
                                                {isAnswered && isSelected && option.feedback && (
                                                    <motion.p
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        className="mt-2 text-sm text-slate-600"
                                                    >
                                                        {option.feedback}
                                                    </motion.p>
                                                )}
                                            </div>
                                        </motion.button>
                                    );
                                })}
                                </div>
                            )}

                            {/* Feedback message */}
                            {!showChallengeFlow && isAnswered && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`
                    mt-6 rounded-xl p-4
                    ${isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}
                  `}
                                >
                                    <p className={`font-semibold ${isCorrect ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        {isCorrect ? 'Correct!' : 'Not quite'}
                                    </p>
                                    {currentQuestion?.explanation && (
                                        <p className="mt-1 text-sm text-slate-600">
                                            {currentQuestion.explanation}
                                        </p>
                                    )}

                                    {currentQuestion && deterministicSteps && deterministicSteps.length > 0 && (
                                        <div className="mt-3">
                                            <button
                                                type="button"
                                                onClick={handleShowSteps}
                                                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800"
                                            >
                                                <ListOrdered className="h-4 w-4" />
                                                {stepsShown.has(currentQuestion.id) ? 'Hide steps' : 'Show steps'}
                                            </button>

                                            {stepsShown.has(currentQuestion.id) && (
                                                <ol className="mt-2 list-decimal pl-5 text-sm text-slate-700">
                                                    {deterministicSteps.map((step, idx) => (
                                                        <li key={idx}>{step}</li>
                                                    ))}
                                                </ol>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </LessonCardBody>

                <LessonCardFooter>
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={previousPhase}
                            className="text-sm text-slate-500 hover:text-slate-700"
                        >
                            Back to Content
                        </button>

                        {!showChallengeFlow && isAnswered && (
                            <motion.button
                                type="button"
                                onClick={handleNext}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 transition-colors"
                            >
                                {isLastQuestion ? 'Continue to Review' : 'Next Question'}
                                <ArrowRight className="h-4 w-4" />
                            </motion.button>
                        )}
                    </div>
                </LessonCardFooter>
            </LessonCard>
        </div>
    );
};

export default PracticePhase;
