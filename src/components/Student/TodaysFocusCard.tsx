import React, { useState } from 'react';
import { ArrowRight, Clock, HelpCircle, Play, Sparkles, Target, ChevronDown, ChevronUp, Flame, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatSubjectLabel } from '../../lib/subjects';
import type { DashboardLesson } from '../../types';

interface TodaysFocusCardProps {
    /** The current recommended lesson */
    lesson: DashboardLesson | null;
    /** Current streak days */
    streakDays: number;
    /** Estimated minutes for the lesson */
    estimatedMinutes?: number;
    /** Additional "up next" lessons to show when expanded */
    upNextLessons?: DashboardLesson[];
    /** Handler when user clicks "Start" */
    onStartLesson: (lesson: DashboardLesson) => void;
    /** Handler to open the AI tutor */
    onOpenTutor?: (prompt?: string) => void;
    /** Whether data is loading */
    isLoading?: boolean;
    /** Student's first name for greeting */
    studentName?: string;
}

/**
 * TodaysFocusCard - A calm, single-focus component showing the ONE thing the student should do next.
 * 
 * Design principles (from Phase 2):
 * - Shows only 1 primary task by default
 * - Always shows "why this lesson" rationale
 * - Feels calm and supportive, not overwhelming
 * - "See more" reveals additional path items
 */
const TodaysFocusCard: React.FC<TodaysFocusCardProps> = ({
    lesson,
    streakDays,
    estimatedMinutes = 15,
    upNextLessons = [],
    onStartLesson,
    onOpenTutor,
    isLoading = false,
    studentName,
}) => {
    const [showUpNext, setShowUpNext] = useState(false);

    // Personalized greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours();
        const name = studentName ? `, ${studentName}` : '';
        if (hour < 12) return `Good morning${name}! ☀️`;
        if (hour < 17) return `Good afternoon${name}! 🌤️`;
        return `Good evening${name}! 🌙`;
    };

    // Format the rationale to be kid-friendly and encouraging
    const formatRationale = (reason: string | undefined | null): string => {
        if (!reason) return "We picked this lesson just for you based on what you're learning.";

        // Make technical reasons friendlier
        let friendly = reason;
        if (reason.toLowerCase().includes('diagnostic') || reason.toLowerCase().includes('placement')) {
            friendly = "This builds on what you showed us in your starting point assessment.";
        } else if (reason.toLowerCase().includes('accuracy') || reason.toLowerCase().includes('%')) {
            friendly = reason.replace(/(\d+)%/g, 'about $1%');
        } else if (reason.toLowerCase().includes('review') || reason.toLowerCase().includes('practice')) {
            friendly = "A little practice keeps skills strong! " + reason;
        }

        return friendly;
    };

    if (isLoading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border-2 border-brand-light-blue shadow-lg p-8"
            >
                <div className="animate-pulse space-y-4">
                    <div className="h-6 w-48 bg-gray-200 rounded-lg" />
                    <div className="h-8 w-64 bg-gray-200 rounded-lg" />
                    <div className="h-4 w-full bg-gray-100 rounded-lg" />
                    <div className="h-12 w-40 bg-gray-200 rounded-xl" />
                </div>
                <p className="mt-4 text-sm text-gray-500">Finding your next lesson...</p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border-2 border-brand-light-teal/60 shadow-lg overflow-hidden"
        >
            {/* Main Focus Area */}
            <div className="p-6 md:p-8">
                {/* Greeting & Streak */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{getGreeting()}</h2>
                        <p className="text-gray-600 mt-1">Here's your focus for today:</p>
                    </div>
                    {streakDays > 0 && (
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-full">
                            <Flame className="h-4 w-4 text-orange-500" />
                            <span className="text-sm font-semibold text-orange-700">{streakDays} day streak!</span>
                        </div>
                    )}
                </div>

                {lesson ? (
                    <>
                        {/* Today's Focus Card */}
                        <div className="bg-gradient-to-br from-brand-light-blue/40 to-brand-light-teal/30 rounded-2xl p-6 mb-6">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-teal to-brand-blue flex items-center justify-center flex-shrink-0">
                                    <Target className="h-7 w-7 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold uppercase tracking-wider text-brand-teal">
                                            🎯 Today's Focus
                                        </span>
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 line-clamp-2">
                                        {lesson.title}
                                    </h3>

                                    {/* Why this lesson - THE KEY ADDITION */}
                                    <div className="bg-white/70 rounded-xl p-3 mb-4 border border-brand-teal/20">
                                        <div className="flex items-start gap-2">
                                            <HelpCircle className="h-4 w-4 text-brand-teal mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs font-semibold text-brand-teal uppercase tracking-wide mb-1">
                                                    Why this lesson?
                                                </p>
                                                <p className="text-sm text-gray-700">
                                                    {formatRationale(lesson.suggestionReason)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick stats */}
                                    <div className="flex flex-wrap gap-2">
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/80 rounded-full text-sm font-medium text-gray-700 border border-gray-200">
                                            <Clock className="h-3.5 w-3.5 text-brand-blue" />
                                            ~{estimatedMinutes} min
                                        </span>
                                        {lesson.subject && (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/80 rounded-full text-sm font-medium text-gray-700 border border-gray-200">
                                                {formatSubjectLabel(lesson.subject)}
                                            </span>
                                        )}
                                        {lesson.xpReward && (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 rounded-full text-sm font-medium text-amber-700 border border-amber-200">
                                                <Sparkles className="h-3.5 w-3.5" />
                                                +{lesson.xpReward} XP
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Primary CTA - Large and Clear */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => onStartLesson(lesson)}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-gradient-to-r from-brand-teal to-brand-blue text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:scale-[1.02] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
                            >
                                <Play className="h-5 w-5" />
                                Start Learning
                            </button>

                            {onOpenTutor && (
                                <button
                                    onClick={() => onOpenTutor()}
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-brand-light-violet border border-brand-violet/30 text-brand-violet px-6 py-4 rounded-2xl font-semibold hover:border-brand-violet/50 transition-all duration-200"
                                >
                                    <Bot className="h-5 w-5" />
                                    Ask Tutor for Help
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    // Empty state - no lesson available
                    <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-brand-light-teal flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="h-8 w-8 text-brand-teal" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Finding your next lesson...</h3>
                        <p className="text-gray-600">
                            We're setting up your personalized path. This only takes a moment!
                        </p>
                    </div>
                )}
            </div>

            {/* Expandable "Up Next" section */}
            {upNextLessons.length > 0 && lesson && (
                <div className="border-t border-gray-100">
                    <button
                        onClick={() => setShowUpNext(!showUpNext)}
                        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                    >
                        <span className="text-sm font-semibold text-gray-700">
                            {showUpNext ? 'Hide' : 'See'} what's coming next ({Math.min(upNextLessons.length, 3)} more lessons)
                        </span>
                        {showUpNext ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                    </button>

                    <AnimatePresence>
                        {showUpNext && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="px-6 pb-6 space-y-3">
                                    {upNextLessons.slice(0, 3).map((item, index) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                                                {index + 2}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                                                {item.suggestionReason && (
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {item.suggestionReason}
                                                    </p>
                                                )}
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-gray-400" />
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
};

export default TodaysFocusCard;
