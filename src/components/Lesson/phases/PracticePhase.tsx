/**
 * PracticePhase Component
 * 
 * Practice questions phase with one-at-a-time display and immediate feedback.
 */

import React, { useState, useCallback } from 'react';
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

interface PracticePhaseProps {
    questions: LessonPracticeQuestion[];
    lessonId?: number;
    pilotTelemetryEnabled?: boolean;
    onAnswerSubmit?: (questionId: number, optionId: number, isCorrect: boolean) => void;
    onAskTutor?: (context: string) => void;
}

interface QuestionState {
    selectedOptionId: number | null;
    isAnswered: boolean;
    isCorrect: boolean;
}

export const PracticePhase: React.FC<PracticePhaseProps> = ({
    questions,
    lessonId,
    pilotTelemetryEnabled,
    onAnswerSubmit,
    onAskTutor,
}) => {
    const { nextPhase, updatePracticeScore, previousPhase } = useLessonStepper();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [questionStates, setQuestionStates] = useState<Map<number, QuestionState>>(new Map());
    const [hintShown, setHintShown] = useState<Set<number>>(() => new Set());
    const [stepsShown, setStepsShown] = useState<Set<number>>(() => new Set());

    const currentQuestion = questions[currentIndex];
    const currentState = currentQuestion ? questionStates.get(currentQuestion.id) : null;
    const isAnswered = currentState?.isAnswered ?? false;
    const isCorrect = currentState?.isCorrect ?? false;
    const selectedOptionId = currentState?.selectedOptionId ?? null;

    const isLastQuestion = currentIndex >= questions.length - 1;
    const answeredCount = questionStates.size;
    const correctCount = Array.from(questionStates.values()).filter((s) => s.isCorrect).length;

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

    const handleNext = () => {
        if (isLastQuestion) {
            nextPhase();
        } else {
            setCurrentIndex((prev) => prev + 1);
        }
    };

    const handleAskForHint = () => {
        if (!currentQuestion) return;

        if (pilotTelemetryEnabled) {
            trackEvent('success_pilot_practice_hint_clicked', {
                lessonId,
                questionId: currentQuestion.id,
                hasDeterministicHint: Boolean(currentQuestion.hint),
            });
        }

        if (currentQuestion.hint) {
            setHintShown((prev) => {
                const next = new Set(prev);
                if (next.has(currentQuestion.id)) {
                    next.delete(currentQuestion.id);
                } else {
                    next.add(currentQuestion.id);
                }
                return next;
            });
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
        if (!currentQuestion.steps || currentQuestion.steps.length === 0) return;
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
                            <h2 className="text-lg font-semibold text-slate-900">
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
                            key={currentQuestion?.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Question prompt */}
                            {currentQuestion?.visual && (
                                <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                                    <img
                                        src={currentQuestion.visual.svg}
                                        alt={currentQuestion.visual.alt}
                                        className="block w-full"
                                        loading="lazy"
                                    />
                                </div>
                            )}
                            <h3 className="text-xl font-semibold text-slate-900 mb-6">
                                {currentQuestion?.prompt}
                            </h3>

                            {/* Hint button (before answering) */}
                            {!isAnswered && (onAskTutor || currentQuestion?.hint) && (
                                <button
                                    type="button"
                                    onClick={handleAskForHint}
                                    className="inline-flex items-center gap-1.5 mb-4 text-sm text-blue-600 hover:text-blue-700"
                                >
                                    <Bot className="h-4 w-4" />
                                    Need a hint?
                                </button>
                            )}

                            {!isAnswered && currentQuestion?.hint && hintShown.has(currentQuestion.id) && (
                                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                                    {currentQuestion.hint}
                                </div>
                            )}

                            {/* Answer options */}
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
                        w-full rounded-xl border-2 p-4 text-left transition-all
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
                            font-medium
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

                            {/* Feedback message */}
                            {isAnswered && (
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

                                    {currentQuestion?.steps && currentQuestion.steps.length > 0 && (
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
                                                    {currentQuestion.steps.map((step, idx) => (
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

                        {isAnswered && (
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
