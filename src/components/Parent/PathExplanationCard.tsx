import React from 'react';
import { motion } from 'framer-motion';
import {
    Lightbulb,
    Route,
    Target,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Brain,
    HelpCircle,
} from 'lucide-react';
import type { AdaptiveReplanSummary } from '../../types';
import { formatSubjectLabel } from '../../lib/subjects';

interface PathExplanationCardProps {
    childName: string;
    diagnosticStatus?: 'not_started' | 'scheduled' | 'in_progress' | 'completed' | null;
    diagnosticCompletedAt?: string | null;
    focusAreas?: string[];
    strengths?: string[];
    adaptivePlanNotes?: string[];
    adaptiveReplanSummary?: AdaptiveReplanSummary | null;
    currentFocusSubject?: string | null;
    isExpanded?: boolean;
    onToggle?: () => void;
}

/**
 * PathExplanationCard - Explains "Why these lessons?" to parents
 * Part of Phase 6: Parent Visibility Without Micromanagement
 * 
 * Key features:
 * - Simple 1-2 sentence "Why these lessons?" summary
 * - Link to assessment results (if they want deeper info)
 * - "How the path adapts" explainer
 * - Collapsed by default, expandable for more detail
 */
const PathExplanationCard: React.FC<PathExplanationCardProps> = ({
    childName,
    diagnosticStatus = 'not_started',
    diagnosticCompletedAt,
    focusAreas = [],
    strengths = [],
    adaptivePlanNotes = [],
    adaptiveReplanSummary = null,
    currentFocusSubject,
    isExpanded = false,
    onToggle,
}) => {
    const formatAdaptiveTimestamp = (value: string) =>
        new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(new Date(value));

    const formatAdaptiveEvent = (value: string | null | undefined) => {
        if (!value) return 'Activity';
        if (value === 'lesson_completed') return 'Lesson completion';
        if (value === 'practice_answered') return 'Practice results';
        if (value === 'quiz_submitted') return 'Checkpoint results';
        return value.replace(/_/g, ' ');
    };

    const formatRatioPercent = (value: number | null | undefined) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '0%';
        return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
    };

    // Generate the primary "why" explanation
    const getWhyExplanation = (): { title: string; detail: string } => {
        const firstName = childName.split(' ')[0];

        if (diagnosticStatus !== 'completed') {
            return {
                title: `${firstName} hasn't completed the diagnostic yet`,
                detail: "Once they finish the quick assessment, we'll create a personalized learning path just for them based on their unique strengths and areas to explore.",
            };
        }

        if (focusAreas.length > 0) {
            const primaryFocus = focusAreas[0];
            const secondaryFocus = focusAreas[1];
            return {
                title: `Focusing on ${primaryFocus}${secondaryFocus ? ` and ${secondaryFocus}` : ''}`,
                detail: `Based on ${firstName}'s diagnostic results, we're prioritizing these areas to build a strong foundation. As they improve, the path will automatically adjust.`,
            };
        }

        if (currentFocusSubject) {
            return {
                title: `Building skills in ${currentFocusSubject}`,
                detail: `${firstName}'s path is designed to strengthen their understanding step by step, with the AI adjusting difficulty as they progress.`,
            };
        }

        return {
            title: 'Learning path personalized for ' + firstName,
            detail: "We're selecting lessons based on their assessment results and ongoing performance. The path adapts as they learn.",
        };
    };

    const whyExplanation = getWhyExplanation();

    // Format diagnostic date
    const formatDiagnosticDate = () => {
        if (!diagnosticCompletedAt) return null;
        const date = new Date(diagnosticCompletedAt);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-brand-light-blue/50 shadow-sm overflow-hidden"
        >
            {/* Main Summary - Always Visible */}
            <button
                type="button"
                onClick={onToggle}
                className="w-full text-left p-5 hover:bg-brand-light-blue/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-light-blue to-brand-light-teal flex items-center justify-center flex-shrink-0">
                            <Route className="h-5 w-5 text-brand-blue" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-semibold text-gray-900">
                                    Why these lessons?
                                </h3>
                                <span className="text-xs font-bold uppercase tracking-wider text-brand-teal bg-brand-light-teal/40 px-2 py-0.5 rounded-full">
                                    Personalized
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {whyExplanation.title}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-brand-blue font-medium hidden sm:inline">
                            {isExpanded ? 'Less' : 'Learn more'}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center">
                            {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-brand-blue" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-brand-blue" />
                            )}
                        </div>
                    </div>
                </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-100"
                >
                    <div className="p-5 space-y-5">
                        {/* Detailed Explanation */}
                        <div className="bg-brand-light-blue/20 rounded-xl p-4">
                            <p className="text-sm text-gray-700">{whyExplanation.detail}</p>
                        </div>

                        {adaptiveReplanSummary && (
                            <div className="rounded-xl border border-brand-blue/20 bg-brand-light-blue/15 p-4 space-y-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-900">
                                            Latest route shift
                                        </h4>
                                        <p className="text-xs text-gray-600 mt-1">
                                            {adaptiveReplanSummary.rationale}
                                        </p>
                                    </div>
                                    <span className="inline-flex rounded-full border border-brand-blue/20 bg-white px-2 py-1 text-[11px] font-medium text-brand-blue">
                                        {formatAdaptiveTimestamp(adaptiveReplanSummary.lastReplannedAt)}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex rounded-full bg-white px-2 py-1 text-[11px] text-gray-600 border border-slate-200">
                                        Trigger: {formatAdaptiveEvent(adaptiveReplanSummary.triggerEventType)}
                                    </span>
                                    {adaptiveReplanSummary.triggerSubject && (
                                        <span className="inline-flex rounded-full bg-white px-2 py-1 text-[11px] text-gray-600 border border-slate-200">
                                            Subject: {formatSubjectLabel(adaptiveReplanSummary.triggerSubject)}
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {adaptiveReplanSummary.subjectSignals.slice(0, 2).map((signal) => (
                                        <div
                                            key={signal.subject}
                                            className="rounded-xl border border-white/70 bg-white/80 p-3"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-semibold text-gray-900">
                                                    {formatSubjectLabel(signal.subject)}
                                                </p>
                                                <span className="text-[11px] uppercase tracking-wide text-brand-blue">
                                                    {signal.masteryTrend}
                                                </span>
                                            </div>
                                            <div className="mt-2 space-y-1 text-xs text-gray-600">
                                                <p>
                                                    Support pressure: {formatRatioPercent(signal.supportPressure)}
                                                </p>
                                                <p>
                                                    Stretch readiness: {formatRatioPercent(signal.stretchReadiness)}
                                                </p>
                                                {signal.recentAccuracy != null && (
                                                    <p>Recent accuracy: {Math.round(signal.recentAccuracy)}%</p>
                                                )}
                                                {signal.masteryPct != null && (
                                                    <p>Mastery snapshot: {Math.round(signal.masteryPct)}%</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Diagnostic Status */}
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center flex-shrink-0">
                                <Brain className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900">
                                    Diagnostic Assessment
                                </h4>
                                <p className="text-xs text-gray-600 mt-0.5">
                                    {diagnosticStatus === 'completed'
                                        ? `Completed ${formatDiagnosticDate() ?? 'recently'} — path is calibrated`
                                        : diagnosticStatus === 'in_progress'
                                            ? 'In progress — path will update when done'
                                            : diagnosticStatus === 'scheduled'
                                                ? 'Scheduled — reminder set'
                                                : 'Not started — recommend completing soon'}
                                </p>
                            </div>
                        </div>

                        {/* Strengths & Focus Areas */}
                        {(strengths.length > 0 || focusAreas.length > 0) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {strengths.length > 0 && (
                                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Sparkles className="h-4 w-4 text-emerald-600" />
                                            <span className="text-xs font-semibold text-emerald-700">
                                                Strengths
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {strengths.slice(0, 3).map((strength, idx) => (
                                                <span
                                                    key={idx}
                                                    className="inline-block px-2 py-0.5 rounded-full bg-white text-xs text-emerald-700 border border-emerald-200"
                                                >
                                                    {strength}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {focusAreas.length > 0 && (
                                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Target className="h-4 w-4 text-amber-600" />
                                            <span className="text-xs font-semibold text-amber-700">
                                                Focus Areas
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {focusAreas.slice(0, 3).map((area, idx) => (
                                                <span
                                                    key={idx}
                                                    className="inline-block px-2 py-0.5 rounded-full bg-white text-xs text-amber-700 border border-amber-200"
                                                >
                                                    {area}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* How the Path Adapts */}
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <HelpCircle className="h-4 w-4 text-brand-blue" />
                                <h4 className="text-sm font-semibold text-gray-900">
                                    How the path adapts
                                </h4>
                            </div>
                            <ul className="space-y-2 text-xs text-gray-600">
                                <li className="flex items-start gap-2">
                                    <span className="text-brand-blue mt-0.5">•</span>
                                    <span>
                                        <strong>Performance tracking:</strong> If they struggle with a concept, we add more practice. If they excel, we move ahead.
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-brand-blue mt-0.5">•</span>
                                    <span>
                                        <strong>Daily adjustments:</strong> Their path updates each day based on what they completed and how they did.
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-brand-blue mt-0.5">•</span>
                                    <span>
                                        <strong>Goal alignment:</strong> We balance your weekly goals with their current skill level.
                                    </span>
                                </li>
                            </ul>
                        </div>

                        {/* Adaptive Plan Notes (if any) */}
                        {adaptivePlanNotes.length > 0 && (
                            <div className="rounded-xl border border-brand-light-blue bg-brand-light-blue/20 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Lightbulb className="h-4 w-4 text-brand-blue" />
                                    <h4 className="text-sm font-semibold text-brand-blue">
                                        This Week&apos;s Plan Notes
                                    </h4>
                                </div>
                                <ul className="space-y-1">
                                    {adaptivePlanNotes.slice(0, 3).map((note, idx) => (
                                        <li key={idx} className="text-xs text-gray-700">
                                            • {note}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
};

export default PathExplanationCard;
