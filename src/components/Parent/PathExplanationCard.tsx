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

interface PathExplanationCardProps {
    childName: string;
    diagnosticStatus?: 'not_started' | 'scheduled' | 'in_progress' | 'completed' | null;
    diagnosticCompletedAt?: string | null;
    focusAreas?: string[];
    strengths?: string[];
    adaptivePlanNotes?: string[];
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
    currentFocusSubject,
    isExpanded = false,
    onToggle,
}) => {
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
