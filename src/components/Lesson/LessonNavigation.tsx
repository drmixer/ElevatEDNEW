/**
 * LessonNavigation Component
 * 
 * Continue/Back navigation buttons for the lesson stepper.
 */

import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLessonStepper } from './LessonStepper';

interface LessonNavigationProps {
    className?: string;
    continueLabel?: string;
    backLabel?: string;
    onContinue?: () => void;
    onBack?: () => void;
    continueDisabled?: boolean;
    showContinue?: boolean;
    showBack?: boolean;
}

export const LessonNavigation: React.FC<LessonNavigationProps> = ({
    className = '',
    continueLabel,
    backLabel,
    onContinue,
    onBack,
    continueDisabled = false,
    showContinue = true,
    showBack = true,
}) => {
    const { canGoNext, canGoBack, nextPhase, previousPhase, currentPhase } = useLessonStepper();

    const handleContinue = () => {
        if (onContinue) {
            onContinue();
        } else {
            nextPhase();
        }
    };

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            previousPhase();
        }
    };

    // Default labels based on current phase
    const defaultContinueLabel = currentPhase === 'review' ? 'Complete Lesson' : 'Continue';
    const defaultBackLabel = 'Back';

    return (
        <div className={`flex items-center justify-between gap-4 ${className}`}>
            {/* Back button */}
            {showBack && canGoBack ? (
                <motion.button
                    type="button"
                    onClick={handleBack}
                    whileHover={{ x: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {backLabel || defaultBackLabel}
                </motion.button>
            ) : (
                <div /> /* Spacer */
            )}

            {/* Continue button */}
            {showContinue && canGoNext && (
                <motion.button
                    type="button"
                    onClick={handleContinue}
                    disabled={continueDisabled}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
            inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-sm transition-all
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${continueDisabled
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }
          `}
                >
                    {continueLabel || defaultContinueLabel}
                    <ArrowRight className="h-4 w-4" />
                </motion.button>
            )}
        </div>
    );
};

export default LessonNavigation;
