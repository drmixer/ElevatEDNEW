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
import recordReliabilityCheckpoint from '../../lib/reliability';

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

    const emitImpossibleTransition = useCallback(
        (action: string, reason: string, extra?: Record<string, unknown>) => {
            const detail = {
                action,
                reason,
                currentPhase: state.currentPhase,
                currentSectionIndex: state.currentSectionIndex,
                totalSections,
                hasPracticeQuestions,
                availablePhases: availablePhases.join(','),
                ...extra,
            };

            console.warn('[lesson-stepper] impossible transition blocked', detail);
            recordReliabilityCheckpoint('lesson_navigation', 'error', detail);
        },
        [
            state.currentPhase,
            state.currentSectionIndex,
            totalSections,
            hasPracticeQuestions,
            availablePhases,
        ],
    );

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
        if (!availablePhases.includes(phase)) {
            emitImpossibleTransition('go_to_phase', 'phase_not_available', { targetPhase: phase });
            return;
        }

        const currentIndex = availablePhases.indexOf(state.currentPhase);
        const targetIndex = availablePhases.indexOf(phase);
        const isForwardJump = targetIndex > currentIndex;
        const isUnlockedForward = state.completedPhases.includes(phase);

        if (isForwardJump && !isUnlockedForward) {
            emitImpossibleTransition('go_to_phase', 'forward_jump_blocked', {
                targetPhase: phase,
                currentIndex,
                targetIndex,
            });
            return;
        }

        setState((prev) => ({
            ...prev,
            currentPhase: phase,
            currentSectionIndex: 0,
        }));
    }, [availablePhases, emitImpossibleTransition, state.completedPhases, state.currentPhase]);

    const nextPhase = useCallback(() => {
        if (state.currentPhase === 'learn' && state.currentSectionIndex < totalSections - 1) {
            setState((prev) => ({ ...prev, currentSectionIndex: prev.currentSectionIndex + 1 }));
            return;
        }

        const currentIndex = availablePhases.indexOf(state.currentPhase);
        if (currentIndex === -1) {
            emitImpossibleTransition('next_phase', 'current_phase_not_available');
            return;
        }
        if (currentIndex >= availablePhases.length - 1) {
            emitImpossibleTransition('next_phase', 'already_at_final_phase');
            return;
        }

        setState((prev) => {
            const nextPhaseValue = availablePhases[currentIndex + 1];
            return {
                ...prev,
                currentPhase: nextPhaseValue,
                currentSectionIndex: 0,
                completedPhases: prev.completedPhases.includes(prev.currentPhase)
                    ? prev.completedPhases
                    : [...prev.completedPhases, prev.currentPhase],
            };
        });
    }, [
        state.currentPhase,
        state.currentSectionIndex,
        totalSections,
        availablePhases,
        emitImpossibleTransition,
    ]);

    const previousPhase = useCallback(() => {
        if (state.currentPhase === 'learn' && state.currentSectionIndex > 0) {
            setState((prev) => ({ ...prev, currentSectionIndex: prev.currentSectionIndex - 1 }));
            return;
        }

        const currentIndex = availablePhases.indexOf(state.currentPhase);
        if (currentIndex === -1) {
            emitImpossibleTransition('previous_phase', 'current_phase_not_available');
            return;
        }
        if (currentIndex <= 0) {
            emitImpossibleTransition('previous_phase', 'already_at_first_phase');
            return;
        }

        const prevPhaseValue = availablePhases[currentIndex - 1];
        const prevSectionIndex = prevPhaseValue === 'learn' ? totalSections - 1 : 0;
        setState((prev) => ({
            ...prev,
            currentPhase: prevPhaseValue,
            currentSectionIndex: prevSectionIndex,
        }));
    }, [
        state.currentPhase,
        state.currentSectionIndex,
        totalSections,
        availablePhases,
        emitImpossibleTransition,
    ]);

    const nextSection = useCallback(() => {
        if (state.currentPhase !== 'learn') {
            emitImpossibleTransition('next_section', 'not_in_learn_phase');
            return;
        }
        if (state.currentSectionIndex >= totalSections - 1) {
            emitImpossibleTransition('next_section', 'already_at_last_section');
            return;
        }
        setState((prev) => ({ ...prev, currentSectionIndex: prev.currentSectionIndex + 1 }));
    }, [
        state.currentPhase,
        state.currentSectionIndex,
        totalSections,
        emitImpossibleTransition,
    ]);

    const previousSection = useCallback(() => {
        if (state.currentPhase !== 'learn') {
            emitImpossibleTransition('previous_section', 'not_in_learn_phase');
            return;
        }
        if (state.currentSectionIndex <= 0) {
            emitImpossibleTransition('previous_section', 'already_at_first_section');
            return;
        }
        setState((prev) => ({ ...prev, currentSectionIndex: prev.currentSectionIndex - 1 }));
    }, [state.currentPhase, state.currentSectionIndex, emitImpossibleTransition]);

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
            if (event.repeat) {
                return;
            }

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
                    // Only allow keyboard "next" on phases that do not have
                    // per-phase gating logic (e.g. checkpoints/practice answers).
                    if (canGoNext && (state.currentPhase === 'welcome' || state.currentPhase === 'review')) {
                        event.preventDefault();
                        nextPhase();
                    } else if (!canGoNext) {
                        emitImpossibleTransition('keyboard', 'keyboard_no_forward_transition', { key: event.key });
                    } else {
                        emitImpossibleTransition('keyboard', 'keyboard_forward_blocked_by_gate', { key: event.key });
                    }
                    break;
                case 'ArrowLeft':
                    if (canGoBack) {
                        event.preventDefault();
                        previousPhase();
                    } else {
                        emitImpossibleTransition('keyboard', 'keyboard_no_backward_transition', { key: event.key });
                    }
                    break;
                case 'Enter':
                    // Only on Welcome and Review phases (not practice - that needs explicit answer)
                    if (canGoNext && (state.currentPhase === 'welcome' || state.currentPhase === 'review')) {
                        event.preventDefault();
                        nextPhase();
                    } else if (!canGoNext) {
                        emitImpossibleTransition('keyboard', 'keyboard_no_forward_transition', { key: event.key });
                    } else {
                        emitImpossibleTransition('keyboard', 'keyboard_forward_blocked_by_gate', { key: event.key });
                    }
                    break;
                case 'Escape':
                    if (canGoBack) {
                        event.preventDefault();
                        previousPhase();
                    } else {
                        emitImpossibleTransition('keyboard', 'keyboard_no_backward_transition', { key: event.key });
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        canGoNext,
        canGoBack,
        nextPhase,
        previousPhase,
        state.currentPhase,
        emitImpossibleTransition,
    ]);

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
