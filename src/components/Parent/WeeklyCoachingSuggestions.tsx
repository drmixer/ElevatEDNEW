import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lightbulb,
    Clock,
    CheckCircle2,
    X,
    Heart,
    MessageCircle,
    BookOpen,
    Star,
    Coffee,
} from 'lucide-react';
import type { ParentCoachingSuggestion, Subject } from '../../types';
import { formatSubjectLabel } from '../../lib/subjects';

interface WeeklyCoachingSuggestionsProps {
    childName: string;
    suggestions: ParentCoachingSuggestion[];
    focusSubject?: Subject | null;
    onMarkDone?: (suggestionId: string) => void;
    onDismiss?: (suggestionId: string, reason: 'done' | 'not_relevant') => void;
}

interface QuickSuggestion {
    id: string;
    action: string;
    timeMinutes: number;
    icon: React.ReactNode;
    category: 'conversation' | 'activity' | 'celebration' | 'reading';
}

/**
 * WeeklyCoachingSuggestions - Actionable but optional parenting tips
 * Part of Phase 6: Parent Visibility Without Micromanagement
 * 
 * Key features:
 * - Weekly coaching suggestions like "Talk about fractions at dinner" (5 min)
 * - "Read together for 10 minutes" with subject context
 * - Mark as "Done" or "Not for us" (personalizes future suggestions)
 * - Short, actionable, low-pressure
 */
const WeeklyCoachingSuggestions: React.FC<WeeklyCoachingSuggestionsProps> = ({
    childName,
    suggestions,
    focusSubject,
    onMarkDone,
    onDismiss,
}) => {
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

    const firstName = childName.split(' ')[0];

    // Generate quick suggestions if none provided
    const getDefaultSuggestions = (): QuickSuggestion[] => {
        const subjectLabel = focusSubject ? formatSubjectLabel(focusSubject) : 'learning';

        return [
            {
                id: 'dinner-chat',
                action: `Ask ${firstName} to explain something they learned today`,
                timeMinutes: 5,
                icon: <MessageCircle className="h-4 w-4" />,
                category: 'conversation',
            },
            {
                id: 'reading-time',
                action: `Read together for 10 minutes`,
                timeMinutes: 10,
                icon: <BookOpen className="h-4 w-4" />,
                category: 'reading',
            },
            {
                id: 'celebrate-streak',
                action: `Celebrate ${firstName}'s learning streak this week`,
                timeMinutes: 2,
                icon: <Star className="h-4 w-4" />,
                category: 'celebration',
            },
            {
                id: 'real-world',
                action: `Point out ${subjectLabel} in everyday life together`,
                timeMinutes: 5,
                icon: <Lightbulb className="h-4 w-4" />,
                category: 'activity',
            },
        ];
    };

    const quickSuggestions = getDefaultSuggestions();

    // Map API suggestions to display format
    const displaySuggestions = suggestions.length > 0
        ? suggestions.map((s) => ({
            id: s.id,
            action: s.action,
            timeMinutes: s.timeMinutes ?? 5,
            icon: <Lightbulb className="h-4 w-4" />,
            category: 'activity' as const,
            why: s.why,
        }))
        : quickSuggestions;

    const visibleSuggestions = displaySuggestions.filter(
        (s) => !dismissedIds.has(s.id) && !completedIds.has(s.id)
    );

    const handleMarkDone = (id: string) => {
        setCompletedIds((prev) => new Set([...prev, id]));
        onMarkDone?.(id);
        onDismiss?.(id, 'done');
    };

    const handleDismiss = (id: string) => {
        setDismissedIds((prev) => new Set([...prev, id]));
        onDismiss?.(id, 'not_relevant');
    };

    const categoryColors = {
        conversation: 'text-blue-600 bg-blue-50 border-blue-200',
        activity: 'text-amber-600 bg-amber-50 border-amber-200',
        celebration: 'text-pink-600 bg-pink-50 border-pink-200',
        reading: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    };

    const categoryLabels = {
        conversation: 'Chat',
        activity: 'Activity',
        celebration: 'Celebrate',
        reading: 'Read',
    };

    if (visibleSuggestions.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-200 p-5"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <Heart className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-emerald-800">
                            You&apos;re all caught up! 🎉
                        </h3>
                        <p className="text-sm text-emerald-600">
                            Check back next week for new ways to support {firstName}.
                        </p>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
        >
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-light-blue to-brand-light-teal flex items-center justify-center">
                            <Coffee className="h-5 w-5 text-brand-blue" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">
                                This Week&apos;s Ideas
                            </h3>
                            <p className="text-xs text-gray-500">
                                Quick ways to support {firstName}&apos;s learning
                            </p>
                        </div>
                    </div>
                    <span className="text-xs font-medium text-gray-400">
                        {visibleSuggestions.length} suggestions
                    </span>
                </div>
            </div>

            {/* Suggestions List */}
            <div className="divide-y divide-gray-50">
                <AnimatePresence>
                    {visibleSuggestions.slice(0, 4).map((suggestion) => (
                        <motion.div
                            key={suggestion.id}
                            layout
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            transition={{ duration: 0.2 }}
                            className="px-5 py-4 hover:bg-gray-50/50 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`w-9 h-9 rounded-lg flex items-center justify-center border ${categoryColors[suggestion.category]}`}
                                    >
                                        {suggestion.icon}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">
                                            {suggestion.action}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${categoryColors[suggestion.category]}`}
                                            >
                                                {categoryLabels[suggestion.category]}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                                <Clock className="h-3 w-3" />
                                                {suggestion.timeMinutes} min
                                            </span>
                                        </div>
                                        {'why' in suggestion && suggestion.why && (
                                            <p className="text-xs text-gray-500 mt-1.5 italic">
                                                {suggestion.why}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleMarkDone(suggestion.id)}
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                                        title="Mark as done"
                                    >
                                        <CheckCircle2 className="h-5 w-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDismiss(suggestion.id)}
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                                        title="Not for us"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Footer Hint */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-500 text-center">
                    💡 Marking suggestions helps us personalize future ideas for your family
                </p>
            </div>
        </motion.div>
    );
};

export default WeeklyCoachingSuggestions;
