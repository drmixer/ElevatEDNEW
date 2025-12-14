import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    TrendingUp,
    Award,
    FastForward,
    ChevronRight,
    Sparkles,
    Clock,
} from 'lucide-react';

export interface AdaptivePacingFeedbackProps {
    /** Current mastery percentage for this question set */
    masteryPct: number;
    /** Number of correct answers so far */
    correctCount: number;
    /** Total questions in the set */
    totalQuestions: number;
    /** Number of consecutive correct answers */
    consecutiveCorrect: number;
    /** Average time per question in seconds */
    avgTimePerQuestion: number;
    /** Whether to show the skip ahead prompt */
    showSkipPrompt?: boolean;
    /** Handler for skipping ahead */
    onSkipAhead?: () => void;
    /** Handler to dismiss the prompt */
    onDismiss?: () => void;
    /** Whether the student is in "challenge" mode */
    inChallengeMode?: boolean;
    /** Handler to request harder questions */
    onRequestChallenge?: () => void;
}

const MASTERY_THRESHOLD = 85; // % needed for excellent performance
const CONSECUTIVE_THRESHOLD = 3; // consecutive correct to trigger prompt
const FAST_RESPONSE_THRESHOLD = 15; // seconds - considered quick answer

const AdaptivePacingFeedback: React.FC<AdaptivePacingFeedbackProps> = ({
    masteryPct,
    correctCount,
    totalQuestions,
    consecutiveCorrect,
    avgTimePerQuestion,
    showSkipPrompt = false,
    onSkipAhead,
    onDismiss,
    inChallengeMode = false,
    onRequestChallenge,
}) => {
    const isExcelling = masteryPct >= MASTERY_THRESHOLD && consecutiveCorrect >= CONSECUTIVE_THRESHOLD;
    const isFastAndAccurate = avgTimePerQuestion <= FAST_RESPONSE_THRESHOLD && masteryPct >= 80;
    const showFeedback = (isExcelling || isFastAndAccurate) && !inChallengeMode;

    if (!showFeedback && !showSkipPrompt) {
        return null;
    }

    return (
        <AnimatePresence>
            {(showFeedback || showSkipPrompt) && (
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
                    className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200 shadow-sm overflow-hidden"
                >
                    {/* Header with celebration */}
                    <div className="relative px-5 py-4">
                        {/* Sparkle decorations */}
                        <div className="absolute top-2 right-4 opacity-60">
                            <Sparkles className="h-5 w-5 text-emerald-400 animate-pulse" />
                        </div>
                        <div className="absolute bottom-3 right-12 opacity-40">
                            <Sparkles className="h-3 w-3 text-teal-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
                        </div>

                        <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className="flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 p-3 shadow-lg">
                                {isExcelling ? (
                                    <Award className="h-6 w-6 text-white" />
                                ) : (
                                    <TrendingUp className="h-6 w-6 text-white" />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
                                    {isExcelling ? (
                                        <>
                                            You&apos;re crushing it! 🎉
                                        </>
                                    ) : isFastAndAccurate ? (
                                        <>
                                            Quick and accurate! <Zap className="h-4 w-4 text-amber-500" />
                                        </>
                                    ) : (
                                        <>
                                            Great progress!
                                        </>
                                    )}
                                </h3>

                                <p className="mt-1 text-sm text-emerald-700">
                                    {isExcelling && (
                                        <>
                                            {consecutiveCorrect} correct in a row with {Math.round(masteryPct)}% mastery!
                                        </>
                                    )}
                                    {isFastAndAccurate && !isExcelling && (
                                        <>
                                            Averaging {Math.round(avgTimePerQuestion)} seconds — you really know this!
                                        </>
                                    )}
                                </p>

                                {/* Stats row */}
                                <div className="mt-3 flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                                        <Award className="h-3.5 w-3.5" />
                                        <span>{correctCount}/{totalQuestions} correct</span>
                                    </div>
                                    {avgTimePerQuestion > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                                            <Clock className="h-3.5 w-3.5" />
                                            <span>~{Math.round(avgTimePerQuestion)}s avg</span>
                                        </div>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {onSkipAhead && (
                                        <button
                                            onClick={onSkipAhead}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-medium text-white shadow-md hover:from-emerald-600 hover:to-teal-600 transition-all hover:shadow-lg"
                                        >
                                            <FastForward className="h-4 w-4" />
                                            Skip to next topic
                                        </button>
                                    )}
                                    {onRequestChallenge && (
                                        <button
                                            onClick={onRequestChallenge}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm hover:bg-emerald-50 transition-colors"
                                        >
                                            <Zap className="h-4 w-4" />
                                            Try harder questions
                                        </button>
                                    )}
                                    {onDismiss && (
                                        <button
                                            onClick={onDismiss}
                                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-100 transition-colors"
                                        >
                                            Keep practicing
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-emerald-100">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(masteryPct, 100)}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full bg-gradient-to-r from-emerald-400 to-teal-400"
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AdaptivePacingFeedback;
