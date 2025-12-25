/**
 * StudyModeSelector - "Today I want to..." Mode Picker
 *
 * A simple chip row that lets students choose their study intention:
 * - Catch up on things I missed
 * - Keep up with my plan
 * - Get ahead for a challenge
 *
 * This biases recommendations and adjusts tutor tone.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowRight, ArrowUp, HelpCircle, RefreshCw, Sparkles } from 'lucide-react';
import trackEvent from '../../lib/analytics';

// ============================================================================
// Types
// ============================================================================

export type StudyMode = 'catch_up' | 'keep_up' | 'get_ahead';

interface StudyModeSelectorProps {
    /** Current study mode */
    value?: StudyMode;
    /** Callback when mode changes */
    onChange?: (mode: StudyMode) => void;
    /** Whether parent has locked this setting */
    parentLocked?: boolean;
    /** Forced mode from parent (if locked) */
    forcedMode?: StudyMode | null;
    /** Whether to show a confirmation toast */
    showConfirmation?: boolean;
    /** Whether this is a first-time prompt */
    isFirstTime?: boolean;
    /** Compact mode for inline display */
    compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STUDY_MODES: Record<
    StudyMode,
    {
        label: string;
        shortLabel: string;
        emoji: string;
        description: string;
        icon: React.ComponentType<{ className?: string }>;
        color: string;
        bgColor: string;
        recommendation: string;
    }
> = {
    catch_up: {
        label: 'Catch up on things I missed',
        shortLabel: 'Catch up',
        emoji: '📚',
        description: 'More review tasks today',
        icon: ArrowDown,
        color: 'text-blue-700',
        bgColor: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
        recommendation: 'Focus on review and practice',
    },
    keep_up: {
        label: 'Keep up with my plan',
        shortLabel: 'Keep up',
        emoji: '⚡',
        description: 'Stay on track with your goals',
        icon: ArrowRight,
        color: 'text-indigo-700',
        bgColor: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
        recommendation: 'Balanced learning today',
    },
    get_ahead: {
        label: 'Get ahead for a challenge',
        shortLabel: 'Get ahead',
        emoji: '🚀',
        description: 'Try some stretch goals',
        icon: ArrowUp,
        color: 'text-purple-700',
        bgColor: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
        recommendation: 'Challenge yourself today',
    },
};

// Local storage keys
const STORAGE_KEY = 'elevated_study_mode';
const STORAGE_TIMESTAMP_KEY = 'elevated_study_mode_set_at';
const EXPIRY_DAYS = 7;

// ============================================================================
// Helpers
// ============================================================================

function getStoredMode(): StudyMode | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const timestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);

        if (!stored || !timestamp) return null;

        // Check expiry
        const setAt = new Date(timestamp);
        const now = new Date();
        const daysSince = (now.getTime() - setAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSince > EXPIRY_DAYS) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
            return null;
        }

        return stored as StudyMode;
    } catch {
        return null;
    }
}

function storeMode(mode: StudyMode): void {
    try {
        localStorage.setItem(STORAGE_KEY, mode);
        localStorage.setItem(STORAGE_TIMESTAMP_KEY, new Date().toISOString());
    } catch {
        // Ignore storage errors
    }
}

// ============================================================================
// Main Component
// ============================================================================

const StudyModeSelector: React.FC<StudyModeSelectorProps> = ({
    value,
    onChange,
    parentLocked = false,
    forcedMode,
    showConfirmation = true,
    isFirstTime = false,
    compact = false,
}) => {
    // Initialize from props, storage, or default
    const [selectedMode, setSelectedMode] = useState<StudyMode>(() => {
        if (forcedMode) return forcedMode;
        if (value) return value;
        return getStoredMode() || 'keep_up';
    });

    // Confirmation toast
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Sync with external value
    useEffect(() => {
        if (value && value !== selectedMode && !forcedMode) {
            setSelectedMode(value);
        }
    }, [value, selectedMode, forcedMode]);

    // Handle mode change
    const handleModeChange = useCallback(
        (mode: StudyMode) => {
            if (parentLocked || forcedMode) return;

            setSelectedMode(mode);
            storeMode(mode);
            onChange?.(mode);

            // Track event
            trackEvent('study_mode_set', {
                mode,
                source: 'dashboard',
            });

            // Show confirmation
            if (showConfirmation) {
                const config = STUDY_MODES[mode];
                setToastMessage(`Mode set to ${config.shortLabel}`);
                setShowToast(true);
                setTimeout(() => setShowToast(false), 2500);
            }
        },
        [onChange, parentLocked, forcedMode, showConfirmation]
    );

    // Track view
    useEffect(() => {
        trackEvent('study_mode_prompt_shown', {
            surface: 'dashboard',
            reason: isFirstTime ? 'first_time' : 'manual',
        });
    }, [isFirstTime]);

    const currentConfig = STUDY_MODES[selectedMode];

    // Compact mode: just show chips
    if (compact) {
        return (
            <div className="relative">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Study mode selection">
                    {(Object.entries(STUDY_MODES) as [StudyMode, typeof STUDY_MODES[StudyMode]][]).map(
                        ([mode, config]) => {
                            const isSelected = selectedMode === mode;
                            const isLocked = parentLocked || (forcedMode && forcedMode !== mode);
                            const Icon = config.icon;

                            return (
                                <button
                                    key={mode}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    onClick={() => handleModeChange(mode)}
                                    disabled={Boolean(isLocked)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${isSelected
                                        ? `${config.bgColor} ${config.color} shadow-sm`
                                        : isLocked
                                            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{config.shortLabel}</span>
                                </button>
                            );
                        }
                    )}
                    {parentLocked && (
                        <div className="group relative inline-flex items-center">
                            <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                Set by your parent
                            </div>
                        </div>
                    )}
                </div>

                {/* Confirmation Toast */}
                <AnimatePresence>
                    {showToast && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-0 mt-2 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg shadow-lg z-20"
                            role="status"
                            aria-live="polite"
                        >
                            <span className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                {toastMessage}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Full card mode
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                    Today I want to...
                </h3>
                {parentLocked && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" />
                        Set by parent
                    </span>
                )}
            </div>

            {/* Mode Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4" role="radiogroup" aria-label="Study mode selection">
                {(Object.entries(STUDY_MODES) as [StudyMode, typeof STUDY_MODES[StudyMode]][]).map(
                    ([mode, config]) => {
                        const isSelected = selectedMode === mode;
                        const isLocked = parentLocked || (forcedMode && forcedMode !== mode);

                        return (
                            <button
                                key={mode}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                onClick={() => handleModeChange(mode)}
                                disabled={Boolean(isLocked)}
                                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${isSelected
                                    ? `border-indigo-500 bg-indigo-50 shadow-sm`
                                    : isLocked
                                        ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                            >
                                <div
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-indigo-100' : 'bg-slate-100'
                                        }`}
                                >
                                    <span className="text-xl">{config.emoji}</span>
                                </div>
                                <span
                                    className={`font-medium text-sm text-center ${isSelected ? 'text-indigo-700' : isLocked ? 'text-slate-400' : 'text-slate-700'
                                        }`}
                                >
                                    {config.shortLabel}
                                </span>
                                <span className="text-xs text-slate-500 text-center">{config.description}</span>
                                {isSelected && (
                                    <motion.div
                                        layoutId="study-mode-check"
                                        className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center"
                                    >
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </motion.div>
                                )}
                            </button>
                        );
                    }
                )}
            </div>

            {/* Current Mode Info */}
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                <currentConfig.icon className="w-4 h-4" />
                <span>{currentConfig.recommendation}</span>
            </div>

            {/* Confirmation Toast */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800 text-white rounded-xl shadow-lg z-50"
                        role="status"
                        aria-live="polite"
                    >
                        <span className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            {toastMessage}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default StudyModeSelector;

// Export helper for checking stored mode
export { getStoredMode, storeMode };
