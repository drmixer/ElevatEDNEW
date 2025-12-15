import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lightbulb,
    RefreshCw,
    Layers,
    Brain,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Coffee,
    Zap,
} from 'lucide-react';

export interface AdaptiveHelpPanelProps {
    /** Number of consecutive incorrect answers */
    consecutiveMisses: number;
    /** Time spent on current question in seconds */
    timeOnQuestion: number;
    /** Whether the panel should auto-expand due to detected struggle */
    autoExpanded?: boolean;
    /** Handler for "Show me a hint" */
    onShowHint: () => void;
    /** Handler for "Explain differently" */
    onExplainDifferently: () => void;
    /** Handler for "Make it simpler" */
    onMakeSimpler: () => void;
    /** Handler for "Take a break" suggestion */
    onTakeBreak?: () => void;
    /** Handler for "Skip ahead" if mastered */
    onSkipAhead?: () => void;
    /** Current hint level (0 = none, 1 = hint, 2 = break down, 3 = full solution) */
    hintLevel?: number;
    /** Whether we're currently loading a hint/explanation */
    isLoading?: boolean;
    /** Subject for themed help suggestions */
    subject?: string | null;
    /** Current question index */
    questionNumber?: number;
    /** Total questions */
    totalQuestions?: number;
}

const STRUGGLE_TIME_THRESHOLD = 60; // seconds before showing "need help?" prompt

const AdaptiveHelpPanel: React.FC<AdaptiveHelpPanelProps> = ({
    consecutiveMisses,
    timeOnQuestion,
    autoExpanded = false,
    onShowHint,
    onExplainDifferently,
    onMakeSimpler,
    onTakeBreak,
    onSkipAhead,
    hintLevel = 0,
    isLoading = false,
    subject,
    questionNumber,
    totalQuestions,
}) => {
    const [isExpanded, setIsExpanded] = useState(autoExpanded);
    const [dismissedStruggle, setDismissedStruggle] = useState(false);

    // Detect if student seems to be struggling
    const isStruggling = consecutiveMisses >= 2 || (timeOnQuestion >= STRUGGLE_TIME_THRESHOLD && !dismissedStruggle);
    const showAutoHelp = isStruggling && !dismissedStruggle;

    // Expand panel if autoExpanded changes or struggle detected
    React.useEffect(() => {
        if (autoExpanded || showAutoHelp) {
            setIsExpanded(true);
        }
    }, [autoExpanded, showAutoHelp]);

    const getStruggleMessage = () => {
        if (consecutiveMisses >= 2) {
            return "That's okay! Learning takes practice. Let me help you understand this better.";
        }
        if (timeOnQuestion >= STRUGGLE_TIME_THRESHOLD) {
            return "Taking your time? That's good! But if you're stuck, I'm here to help.";
        }
        return null;
    };

    const getHintButtonLabel = () => {
        switch (hintLevel) {
            case 0:
                return 'Show me a hint';
            case 1:
                return 'Another hint please';
            case 2:
                return 'Walk me through it';
            default:
                return 'Show me a hint';
        }
    };

    const subjectEmoji = (() => {
        const s = (subject ?? 'math').toLowerCase();
        if (s.includes('math')) return '🔢';
        if (s.includes('english') || s.includes('reading') || s.includes('ela')) return '📚';
        if (s.includes('science')) return '🔬';
        if (s.includes('social') || s.includes('history')) return '🌍';
        return '✨';
    })();

    return (
        <div className="mt-4">
            {/* Struggle Detection Banner */}
            <AnimatePresence>
                {showAutoHelp && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4"
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 rounded-full bg-amber-100 p-2">
                                <Brain className="h-5 w-5 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-amber-800">
                                    {getStruggleMessage()}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                        onClick={() => {
                                            onExplainDifferently();
                                            setDismissedStruggle(true);
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-amber-600 transition-colors"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Let me explain differently
                                    </button>
                                    <button
                                        onClick={() => setDismissedStruggle(true)}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-200 hover:bg-amber-50 transition-colors"
                                    >
                                        I'm okay, just thinking
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Help Options Panel */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Header - Always visible */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 rounded-lg bg-gradient-to-br from-brand-blue/20 to-brand-teal/20 p-1.5">
                            <Sparkles className="h-4 w-4 text-brand-blue" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                            Need help? {subjectEmoji}
                        </span>
                        {hintLevel > 0 && (
                            <span className="text-xs text-slate-500">
                                ({hintLevel} hint{hintLevel > 1 ? 's' : ''} used)
                            </span>
                        )}
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                </button>

                {/* Expandable Content */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="px-3 pb-3 pt-1 border-t border-slate-100">
                                {/* Progress indicator */}
                                {questionNumber && totalQuestions && (
                                    <p className="text-xs text-slate-500 mb-3">
                                        Question {questionNumber} of {totalQuestions}
                                    </p>
                                )}

                                {/* Help buttons grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {/* Show me a hint */}
                                    <button
                                        onClick={onShowHint}
                                        disabled={isLoading}
                                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 p-3 text-left hover:from-sky-100 hover:to-blue-100 transition-all disabled:opacity-50"
                                    >
                                        <div className="flex-shrink-0 rounded-full bg-sky-100 p-1.5">
                                            <Lightbulb className="h-4 w-4 text-sky-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-sky-800">
                                                {getHintButtonLabel()}
                                            </p>
                                            <p className="text-xs text-sky-600">
                                                Get a small nudge
                                            </p>
                                        </div>
                                    </button>

                                    {/* Explain differently */}
                                    <button
                                        onClick={onExplainDifferently}
                                        disabled={isLoading}
                                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 p-3 text-left hover:from-violet-100 hover:to-purple-100 transition-all disabled:opacity-50"
                                    >
                                        <div className="flex-shrink-0 rounded-full bg-violet-100 p-1.5">
                                            <RefreshCw className="h-4 w-4 text-violet-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-violet-800">
                                                Explain differently
                                            </p>
                                            <p className="text-xs text-violet-600">
                                                Try another way
                                            </p>
                                        </div>
                                    </button>

                                    {/* Make it simpler */}
                                    <button
                                        onClick={onMakeSimpler}
                                        disabled={isLoading}
                                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-3 text-left hover:from-emerald-100 hover:to-teal-100 transition-all disabled:opacity-50"
                                    >
                                        <div className="flex-shrink-0 rounded-full bg-emerald-100 p-1.5">
                                            <Layers className="h-4 w-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-emerald-800">
                                                Make it simpler
                                            </p>
                                            <p className="text-xs text-emerald-600">
                                                Break it down
                                            </p>
                                        </div>
                                    </button>
                                </div>

                                {/* Additional options for struggle detection */}
                                {(onTakeBreak || onSkipAhead) && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                                        {onTakeBreak && consecutiveMisses >= 3 && (
                                            <button
                                                onClick={onTakeBreak}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                                            >
                                                <Coffee className="h-3.5 w-3.5" />
                                                Take a quick break
                                            </button>
                                        )}
                                        {onSkipAhead && consecutiveMisses === 0 && hintLevel === 0 && (
                                            <button
                                                onClick={onSkipAhead}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-blue/10 to-brand-teal/10 px-3 py-2 text-xs font-medium text-brand-blue hover:from-brand-blue/20 hover:to-brand-teal/20 transition-colors"
                                            >
                                                <Zap className="h-3.5 w-3.5" />
                                                I've got this - skip ahead
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Loading indicator */}
                                {isLoading && (
                                    <div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-500">
                                        <div className="h-4 w-4 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
                                        Getting help ready...
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default AdaptiveHelpPanel;
