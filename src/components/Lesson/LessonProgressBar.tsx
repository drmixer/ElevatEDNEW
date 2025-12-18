/**
 * LessonProgressBar Component
 * 
 * Visual step indicator showing current phase and progress through the lesson.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLessonStepper } from './LessonStepper';
import type { LessonPhase } from '../../types/lesson';
import { LESSON_PHASES, PHASE_LABELS } from '../../types/lesson';

interface PhaseStepProps {
    phase: LessonPhase;
    index: number;
    isActive: boolean;
    isComplete: boolean;
    onClick?: () => void;
}

const PhaseStep: React.FC<PhaseStepProps> = ({
    phase,
    index,
    isActive,
    isComplete,
    onClick,
}) => {
    const stepLabel = `Step ${index + 1}: ${PHASE_LABELS[phase]}${isComplete ? ' (completed)' : isActive ? ' (current)' : ''}`;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!isComplete && !isActive}
            aria-label={stepLabel}
            aria-current={isActive ? 'step' : undefined}
            className={`
        relative flex flex-col items-center gap-1.5 transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-lg p-1
        ${isActive ? 'scale-105' : ''}
        ${isComplete || isActive ? 'cursor-pointer' : 'cursor-default opacity-60'}
      `}
        >
            {/* Step circle */}
            <motion.div
                initial={false}
                animate={{
                    scale: isActive ? 1.1 : 1,
                    backgroundColor: isComplete
                        ? 'rgb(59 130 246)' // brand-blue
                        : isActive
                            ? 'rgb(59 130 246)'
                            : 'rgb(226 232 240)', // slate-200
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`
          flex h-10 w-10 items-center justify-center rounded-full
          text-sm font-semibold transition-shadow
          ${isActive ? 'ring-4 ring-blue-200 shadow-lg' : ''}
          ${isComplete ? 'text-white' : isActive ? 'text-white' : 'text-slate-500'}
        `}
            >
                {isComplete ? (
                    <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                        <Check className="h-5 w-5" aria-hidden="true" />
                    </motion.div>
                ) : (
                    <span aria-hidden="true">{index + 1}</span>
                )}
            </motion.div>

            {/* Step label */}
            <span
                className={`
          text-xs font-medium transition-colors
          ${isActive ? 'text-blue-600' : isComplete ? 'text-slate-700' : 'text-slate-400'}
        `}
            >
                {PHASE_LABELS[phase]}
            </span>
        </button>
    );
};

interface LessonProgressBarProps {
    className?: string;
    showLabels?: boolean;
    availablePhases?: LessonPhase[];
}

export const LessonProgressBar: React.FC<LessonProgressBarProps> = ({
    className = '',
    availablePhases = LESSON_PHASES,
}) => {
    const { currentPhase, isPhaseComplete, goToPhase, progress } = useLessonStepper();
    const currentStep = availablePhases.indexOf(currentPhase) + 1;
    const totalSteps = availablePhases.length;

    return (
        <div
            className={`w-full ${className}`}
            role="navigation"
            aria-label={`Lesson progress: Step ${currentStep} of ${totalSteps}, ${PHASE_LABELS[currentPhase]}`}
        >
            {/* Progress bar track */}
            <div className="relative mb-6">
                {/* Background track */}
                <div
                    className="absolute top-5 left-0 right-0 h-1 bg-slate-200 rounded-full"
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Lesson completion progress"
                />

                {/* Filled progress */}
                <motion.div
                    className="absolute top-5 left-0 h-1 bg-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                    aria-hidden="true"
                />

                {/* Steps */}
                <div className="relative flex justify-between" role="group" aria-label="Lesson phases">
                    {availablePhases.map((phase, index) => (
                        <PhaseStep
                            key={phase}
                            phase={phase}
                            index={index}
                            isActive={phase === currentPhase}
                            isComplete={isPhaseComplete(phase)}
                            onClick={() => {
                                if (isPhaseComplete(phase)) {
                                    goToPhase(phase);
                                }
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Current phase indicator for mobile */}
            <div className="text-center text-sm text-slate-500 sm:hidden" aria-live="polite">
                Step {currentStep} of {totalSteps}:{' '}
                <span className="font-semibold text-slate-700">
                    {PHASE_LABELS[currentPhase]}
                </span>
            </div>
        </div>
    );
};

/** Compact version for tight spaces */
export const LessonProgressBarCompact: React.FC<{ className?: string }> = ({
    className = '',
}) => {
    const { currentPhase, progress } = useLessonStepper();

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                    className="h-full bg-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                />
            </div>
            <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                {PHASE_LABELS[currentPhase]}
            </span>
        </div>
    );
};

export default LessonProgressBar;
