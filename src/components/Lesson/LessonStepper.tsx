/**
 * LessonStepper Component
 * 
 * Core component that manages the lesson phase navigation.
 * Uses React Context to provide state and actions to child components.
 */

import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import type {
    LessonPhase,
    LessonStepperState,
    LessonStepperContextValue,
} from '../../types/lesson';
import { LESSON_PHASES } from '../../types/lesson';

// Initial state
const initialState: LessonStepperState = {
    currentPhase: 'welcome',
    currentSectionIndex: 0,
    completedPhases: [],
    practiceScore: { correct: 0, total: 0 },
};

// Context
const LessonStepperContext = createContext<LessonStepperContextValue | null>(null);

export interface LessonStepperProviderProps {
    children: React.ReactNode;
    totalSections?: number;
    hasPracticeQuestions?: boolean;
    onPhaseChange?: (phase: LessonPhase) => void;
    onComplete?: () => void;
}

export const LessonStepperProvider: React.FC<LessonStepperProviderProps> = ({
    children,
    totalSections = 1,
    hasPracticeQuestions = true,
    onPhaseChange,
    onComplete,
}) => {
    const [state, setState] = useState<LessonStepperState>(initialState);

    // Get available phases (skip practice if no questions)
    const availablePhases = useMemo(() => {
        if (hasPracticeQuestions) {
            return LESSON_PHASES;
        }
        return LESSON_PHASES.filter((phase) => phase !== 'practice');
    }, [hasPracticeQuestions]);

    // Calculate progress (0-100)
    const progress = useMemo(() => {
        const currentIndex = availablePhases.indexOf(state.currentPhase);
        if (currentIndex === -1) return 0;

        // Base progress on phase
        const phaseProgress = (currentIndex / (availablePhases.length - 1)) * 100;

        // If in learn phase, factor in section progress
        if (state.currentPhase === 'learn' && totalSections > 1) {
            const phaseStart = ((currentIndex) / (availablePhases.length - 1)) * 100;
            const phaseEnd = ((currentIndex + 1) / (availablePhases.length - 1)) * 100;
            const sectionProgress = state.currentSectionIndex / totalSections;
            return phaseStart + (phaseEnd - phaseStart) * sectionProgress;
        }

        return phaseProgress;
    }, [state.currentPhase, state.currentSectionIndex, totalSections, availablePhases]);

    // Can navigate checks
    const canGoNext = useMemo(() => {
        const currentIndex = availablePhases.indexOf(state.currentPhase);
        if (state.currentPhase === 'learn' && state.currentSectionIndex < totalSections - 1) {
            return true;
        }
        return currentIndex < availablePhases.length - 1;
    }, [state.currentPhase, state.currentSectionIndex, totalSections, availablePhases]);

    const canGoBack = useMemo(() => {
        const currentIndex = availablePhases.indexOf(state.currentPhase);
        if (state.currentPhase === 'learn' && state.currentSectionIndex > 0) {
            return true;
        }
        return currentIndex > 0;
    }, [state.currentPhase, state.currentSectionIndex, availablePhases]);

    // Actions
    const goToPhase = useCallback((phase: LessonPhase) => {
        if (!availablePhases.includes(phase)) return;
        setState((prev) => ({
            ...prev,
            currentPhase: phase,
            currentSectionIndex: 0,
        }));
    }, [availablePhases]);

    const nextPhase = useCallback(() => {
        setState((prev) => {
            // If in learn phase with more sections, go to next section
            if (prev.currentPhase === 'learn' && prev.currentSectionIndex < totalSections - 1) {
                return { ...prev, currentSectionIndex: prev.currentSectionIndex + 1 };
            }

            // Otherwise go to next phase
            const currentIndex = availablePhases.indexOf(prev.currentPhase);
            if (currentIndex < availablePhases.length - 1) {
                const nextPhaseValue = availablePhases[currentIndex + 1];
                return {
                    ...prev,
                    currentPhase: nextPhaseValue,
                    currentSectionIndex: 0,
                    completedPhases: prev.completedPhases.includes(prev.currentPhase)
                        ? prev.completedPhases
                        : [...prev.completedPhases, prev.currentPhase],
                };
            }
            return prev;
        });
    }, [totalSections, availablePhases]);

    const previousPhase = useCallback(() => {
        setState((prev) => {
            // If in learn phase with previous sections, go back
            if (prev.currentPhase === 'learn' && prev.currentSectionIndex > 0) {
                return { ...prev, currentSectionIndex: prev.currentSectionIndex - 1 };
            }

            // If at start of learn phase, go to previous phase at its last section
            const currentIndex = availablePhases.indexOf(prev.currentPhase);
            if (currentIndex > 0) {
                const prevPhaseValue = availablePhases[currentIndex - 1];
                const prevSectionIndex = prevPhaseValue === 'learn' ? totalSections - 1 : 0;
                return {
                    ...prev,
                    currentPhase: prevPhaseValue,
                    currentSectionIndex: prevSectionIndex,
                };
            }
            return prev;
        });
    }, [totalSections, availablePhases]);

    const nextSection = useCallback(() => {
        setState((prev) => {
            if (prev.currentSectionIndex < totalSections - 1) {
                return { ...prev, currentSectionIndex: prev.currentSectionIndex + 1 };
            }
            return prev;
        });
    }, [totalSections]);

    const previousSection = useCallback(() => {
        setState((prev) => {
            if (prev.currentSectionIndex > 0) {
                return { ...prev, currentSectionIndex: prev.currentSectionIndex - 1 };
            }
            return prev;
        });
    }, []);

    const markPhaseComplete = useCallback((phase: LessonPhase) => {
        setState((prev) => {
            if (prev.completedPhases.includes(phase)) return prev;
            return { ...prev, completedPhases: [...prev.completedPhases, phase] };
        });
    }, []);

    const updatePracticeScore = useCallback((correct: number, total: number) => {
        setState((prev) => ({
            ...prev,
            practiceScore: { correct, total },
        }));
    }, []);

    const reset = useCallback(() => {
        setState(initialState);
    }, []);

    const isPhaseComplete = useCallback(
        (phase: LessonPhase) => state.completedPhases.includes(phase),
        [state.completedPhases]
    );

    // Notify on phase change
    useEffect(() => {
        onPhaseChange?.(state.currentPhase);
        if (state.currentPhase === 'complete') {
            onComplete?.();
        }
    }, [state.currentPhase, onPhaseChange, onComplete]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Only handle if not in an input/textarea/button
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement ||
                (event.target instanceof HTMLButtonElement && event.key !== 'Escape')
            ) {
                return;
            }

            switch (event.key) {
                case 'ArrowRight':
                    if (canGoNext) {
                        event.preventDefault();
                        nextPhase();
                    }
                    break;
                case 'ArrowLeft':
                    if (canGoBack) {
                        event.preventDefault();
                        previousPhase();
                    }
                    break;
                case 'Enter':
                    // Only on Welcome and Review phases (not practice - that needs explicit answer)
                    if (canGoNext && (state.currentPhase === 'welcome' || state.currentPhase === 'review')) {
                        event.preventDefault();
                        nextPhase();
                    }
                    break;
                case 'Escape':
                    if (canGoBack) {
                        event.preventDefault();
                        previousPhase();
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canGoNext, canGoBack, nextPhase, previousPhase, state.currentPhase]);

    const contextValue = useMemo<LessonStepperContextValue>(
        () => ({
            ...state,
            totalSections,
            progress,
            canGoNext,
            canGoBack,
            hasPracticeQuestions,
            goToPhase,
            nextPhase,
            previousPhase,
            nextSection,
            previousSection,
            markPhaseComplete,
            updatePracticeScore,
            reset,
            isPhaseComplete,
        }),
        [
            state,
            totalSections,
            progress,
            canGoNext,
            canGoBack,
            hasPracticeQuestions,
            goToPhase,
            nextPhase,
            previousPhase,
            nextSection,
            previousSection,
            markPhaseComplete,
            updatePracticeScore,
            reset,
            isPhaseComplete,
        ]
    );

    return (
        <LessonStepperContext.Provider value={contextValue}>
            {children}
        </LessonStepperContext.Provider>
    );
};

// Hook to use stepper context
export const useLessonStepper = (): LessonStepperContextValue => {
    const context = useContext(LessonStepperContext);
    if (!context) {
        throw new Error('useLessonStepper must be used within a LessonStepperProvider');
    }
    return context;
};

export default LessonStepperProvider;
