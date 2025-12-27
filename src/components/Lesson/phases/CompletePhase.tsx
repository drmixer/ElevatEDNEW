/**
 * CompletePhase Component
 * 
 * Celebration phase showing completion status, score, and next steps.
 * Optionally shows reflection prompt after tricky lessons.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    PartyPopper,
    Trophy,
    ArrowRight,
    RotateCcw,
    Home,
    Sparkles,
} from 'lucide-react';
import { LessonCardPadded } from '../LessonCard';
import { useLessonStepper } from '../LessonStepper';
import { ReflectionPrompt } from '../ReflectionPrompt';

interface CompletPhaseProps {
    lessonId: number;
    lessonTitle: string;
    moduleId?: number;
    moduleTitle?: string;
    subject?: string;
    nextLessonId?: number;
    nextLessonTitle?: string;
    xpEarned?: number;
    onRetryPractice?: () => void;
}

export const CompletePhase: React.FC<CompletPhaseProps> = ({
    lessonId,
    lessonTitle,
    moduleId,
    moduleTitle,
    subject,
    nextLessonId,
    nextLessonTitle,
    xpEarned = 0,
    onRetryPractice,
}) => {
    const { practiceScore, goToPhase } = useLessonStepper();
    const [showConfetti, setShowConfetti] = useState(false);
    const [showReflection, setShowReflection] = useState(false);
    const [reflectionDismissed, setReflectionDismissed] = useState(false);

    const scorePercentage = practiceScore.total > 0
        ? Math.round((practiceScore.correct / practiceScore.total) * 100)
        : 0;

    const didWell = scorePercentage >= 70;

    // Decide if we should show reflection prompt
    // Show for: struggling students (< 70%) OR randomly 30% of the time
    const shouldShowReflection = useMemo(() => {
        if (reflectionDismissed) return false;

        // Always show for students who struggled
        if (practiceScore.total > 0 && !didWell) return true;

        // Show randomly 30% of the time for other students
        return Math.random() < 0.3;
    }, [didWell, practiceScore.total, reflectionDismissed]);

    // Trigger confetti on mount
    useEffect(() => {
        setShowConfetti(true);
        const timer = setTimeout(() => setShowConfetti(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    // Show reflection after a short delay
    useEffect(() => {
        if (shouldShowReflection) {
            const timer = setTimeout(() => setShowReflection(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [shouldShowReflection]);

    const handleRetry = () => {
        if (onRetryPractice) {
            onRetryPractice();
        } else {
            goToPhase('practice');
        }
    };

    const handleReflectionComplete = () => {
        setShowReflection(false);
        setReflectionDismissed(true);
    };

    const handleReflectionSkip = () => {
        setShowReflection(false);
        setReflectionDismissed(true);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <LessonCardPadded className="text-center relative overflow-hidden">
                {/* Confetti animation (CSS-based for simplicity) */}
                {showConfetti && (
                    <div className="absolute inset-0 pointer-events-none">
                        {[...Array(20)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{
                                    opacity: 1,
                                    x: '50%',
                                    y: -20,
                                    rotate: 0,
                                }}
                                animate={{
                                    opacity: 0,
                                    x: `${Math.random() * 100}%`,
                                    y: 400,
                                    rotate: 360 + Math.random() * 360,
                                }}
                                transition={{
                                    duration: 2 + Math.random() * 2,
                                    delay: Math.random() * 0.5,
                                    ease: 'easeOut',
                                }}
                                className={`absolute w-3 h-3 rounded-sm ${['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500'][
                                    Math.floor(Math.random() * 5)
                                ]
                                    }`}
                            />
                        ))}
                    </div>
                )}

                {/* Trophy/Celebration icon */}
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', duration: 0.8 }}
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white mb-6"
                >
                    {didWell ? (
                        <Trophy className="h-10 w-10" />
                    ) : (
                        <PartyPopper className="h-10 w-10" />
                    )}
                </motion.div>

                {/* Congratulations message */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-3xl font-bold text-slate-900 mb-2"
                >
                    {didWell ? 'Excellent Work!' : 'Lesson Complete!'}
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-lg text-slate-600 mb-6"
                >
                    You've finished <span className="font-semibold">{lessonTitle}</span>
                </motion.p>

                {/* Score display */}
                {practiceScore.total > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 }}
                        className="bg-slate-50 rounded-xl p-6 mb-6"
                    >
                        <div className="text-sm text-slate-500 mb-2">Practice Score</div>
                        <div className="text-4xl font-bold text-slate-900 mb-1">
                            {practiceScore.correct}/{practiceScore.total}
                        </div>
                        <div className={`text-lg font-semibold ${didWell ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {scorePercentage}% correct
                        </div>
                    </motion.div>
                )}

                {/* XP earned */}
                {xpEarned > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 text-white font-semibold mb-8"
                    >
                        <Sparkles className="h-4 w-4" />
                        +{xpEarned} XP earned!
                    </motion.div>
                )}

                {/* Action buttons */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="space-y-3"
                >
                    {/* Next lesson button */}
                    {nextLessonId && (
                        <Link
                            to={`/lesson/${nextLessonId}`}
                            className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold text-white hover:bg-blue-700 transition-colors"
                        >
                            Next: {nextLessonTitle || 'Continue Learning'}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    )}

                    {/* Back to module */}
                    {moduleId && (
                        <Link
                            to={`/module/${moduleId}`}
                            className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <Home className="h-4 w-4" />
                            Back to {moduleTitle || 'Module'}
                        </Link>
                    )}

                    {/* Retry practice */}
                    {practiceScore.total > 0 && !didWell && (
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Practice Again
                        </button>
                    )}
                </motion.div>
            </LessonCardPadded>

            {/* Reflection Prompt - shows after lesson completion */}
            {showReflection && (
                <ReflectionPrompt
                    lessonId={lessonId}
                    lessonTitle={lessonTitle}
                    subject={subject}
                    didWell={didWell}
                    onComplete={handleReflectionComplete}
                    onSkip={handleReflectionSkip}
                />
            )}
        </div>
    );
};

export default CompletePhase;

