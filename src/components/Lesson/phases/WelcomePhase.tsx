/**
 * WelcomePhase Component
 * 
 * First phase of the lesson experience showing title, objectives, and engagement hook.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Target, Clock, Sparkles, PlayCircle } from 'lucide-react';
import { LessonCardPadded } from '../LessonCard';
import { useLessonStepper } from '../LessonStepper';
import useReducedMotion from '../../../hooks/useReducedMotion';

interface WelcomePhaseProps {
    title: string;
    subject: string;
    gradeBand: string;
    objectives: string[];
    estimatedMinutes: number | null;
    hook?: string;
}

export const WelcomePhase: React.FC<WelcomePhaseProps> = ({
    title,
    subject,
    gradeBand,
    objectives,
    estimatedMinutes,
    hook,
}) => {
    const { nextPhase } = useLessonStepper();
    const prefersReducedMotion = useReducedMotion();

    return (
        <div className="max-w-2xl mx-auto">
            <LessonCardPadded className="text-center">
                {/* Subject badge */}
                <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: prefersReducedMotion ? 0 : 0.1 }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-1.5 text-sm font-semibold text-white mb-4"
                >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    {subject} • {gradeBand}
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
                    className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
                >
                    {title}
                </motion.h1>

                {/* Time estimate */}
                {estimatedMinutes != null && estimatedMinutes > 0 && (
                    <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: prefersReducedMotion ? 0 : 0.3 }}
                        className="flex items-center justify-center gap-2 text-slate-500 mb-6"
                    >
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        <span className="text-sm">About {estimatedMinutes} minutes</span>
                    </motion.div>
                )}

                {/* Hook/engagement teaser */}
                {hook && (
                    <motion.p
                        initial={prefersReducedMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: prefersReducedMotion ? 0 : 0.4 }}
                        className="text-lg text-slate-600 mb-8 max-w-lg mx-auto"
                    >
                        {hook}
                    </motion.p>
                )}

                {/* Objectives */}
                {objectives.length > 0 && (
                    <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: prefersReducedMotion ? 0 : 0.5 }}
                        className="bg-slate-50 rounded-xl p-6 text-left mb-8"
                        role="region"
                        aria-labelledby="objectives-heading"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Target className="h-5 w-5 text-blue-600" aria-hidden="true" />
                            <h2 id="objectives-heading" className="text-lg font-semibold text-slate-900">
                                What you'll learn
                            </h2>
                        </div>
                        <ul className="space-y-3" aria-label="Learning objectives">
                            {objectives.map((objective, index) => (
                                <motion.li
                                    key={index}
                                    initial={prefersReducedMotion ? false : { opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: prefersReducedMotion ? 0 : 0.6 + index * 0.1 }}
                                    className="flex items-start gap-3"
                                >
                                    <span
                                        className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold"
                                        aria-hidden="true"
                                    >
                                        {index + 1}
                                    </span>
                                    <span className="text-slate-700">{objective}</span>
                                </motion.li>
                            ))}
                        </ul>
                    </motion.div>
                )}

                {/* Start button */}
                <motion.button
                    type="button"
                    onClick={nextPhase}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: prefersReducedMotion ? 0 : 0.8 }}
                    whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:shadow-xl transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label="Start learning this lesson"
                >
                    <PlayCircle className="h-5 w-5" aria-hidden="true" />
                    Start Learning
                </motion.button>
            </LessonCardPadded>
        </div>
    );
};

export default WelcomePhase;
