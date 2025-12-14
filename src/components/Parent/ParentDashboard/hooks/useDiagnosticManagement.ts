/**
 * useDiagnosticManagement - Custom hook for managing diagnostic scheduling
 * Extracted from ParentDashboard for maintainability
 */

import { useCallback, useState } from 'react';
import trackEvent from '../../../../lib/analytics';
import { updateParentOnboardingState } from '../../../../services/parentService';
import type { ParentOnboardingState, ParentChildSnapshot } from '../../../../types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DiagnosticPlan {
    scheduled: boolean;
    remind: boolean;
}

export interface OnboardingPrefs {
    diagnosticScheduled: boolean;
    tutorIntroSeen: boolean;
    // Add other prefs as needed
}

export interface UseDiagnosticManagementOptions {
    parentId?: string | null;
    parentOnboardingState?: ParentOnboardingState | null;
}

export interface ScheduleDiagnosticOptions {
    childId?: string;
    childName?: string;
    source?: string;
}

export interface UseDiagnosticManagementReturn {
    // State
    diagnosticPlans: Record<string, DiagnosticPlan>;
    onboardingPrefs: OnboardingPrefs;
    onboardingMessage: string | null;
    onboardingError: string | null;

    // Actions
    handleScheduleDiagnostic: (
        when: 'now' | 'later',
        options?: ScheduleDiagnosticOptions,
        setSelectedChildId?: (id: string) => void,
    ) => void;
    toggleDiagnosticReminder: (childId: string) => void;
    deriveDiagnosticStatus: (
        child: ParentChildSnapshot | null | undefined,
    ) => 'not_started' | 'scheduled' | 'in_progress' | 'completed';
    setOnboardingPrefs: React.Dispatch<React.SetStateAction<OnboardingPrefs>>;
    setOnboardingMessage: React.Dispatch<React.SetStateAction<string | null>>;
    setOnboardingError: React.Dispatch<React.SetStateAction<string | null>>;
}

// ─────────────────────────────────────────────────────────────
// Default values
// ─────────────────────────────────────────────────────────────

const defaultOnboardingPrefs: OnboardingPrefs = {
    diagnosticScheduled: false,
    tutorIntroSeen: false,
};

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useDiagnosticManagement({
    parentId,
    parentOnboardingState,
}: UseDiagnosticManagementOptions): UseDiagnosticManagementReturn {
    // Per-child diagnostic scheduling plans
    const [diagnosticPlans, setDiagnosticPlans] = useState<Record<string, DiagnosticPlan>>({});

    // Onboarding preferences
    const [onboardingPrefs, setOnboardingPrefs] = useState<OnboardingPrefs>(() => ({
        ...defaultOnboardingPrefs,
        diagnosticScheduled: parentOnboardingState?.diagnosticScheduled ?? false,
    }));

    // Feedback messages
    const [onboardingMessage, setOnboardingMessage] = useState<string | null>(null);
    const [onboardingError, setOnboardingError] = useState<string | null>(null);

    // ─────────────────────────────────────────────────────────
    // Schedule a diagnostic
    // ─────────────────────────────────────────────────────────
    const handleScheduleDiagnostic = useCallback(
        (
            when: 'now' | 'later',
            options?: ScheduleDiagnosticOptions,
            setSelectedChildId?: (id: string) => void,
        ) => {
            if (options?.childId && setSelectedChildId) {
                setSelectedChildId(options.childId);
            }

            setOnboardingPrefs((prev) => ({ ...prev, diagnosticScheduled: true }));
            setOnboardingError(null);

            const learnerName = options?.childName ?? 'your learner';
            setOnboardingMessage(
                when === 'now'
                    ? `Great! Start the diagnostic on ${learnerName}'s device to personalize their path.`
                    : `Scheduled for later today for ${learnerName}. We will remind you in the dashboard.`,
            );

            trackEvent('parent_schedule_diagnostic', {
                parentId,
                when,
                childId: options?.childId,
                source: options?.source ?? 'dashboard',
            });

            if (parentId) {
                const nowIso = new Date().toISOString();
                const nextState: ParentOnboardingState = {
                    ...(parentOnboardingState ?? {}),
                    diagnosticScheduled: true,
                    diagnosticScheduledAt: nowIso,
                    lastViewedStep: 'diagnostic',
                };
                updateParentOnboardingState(parentId, nextState).catch((error) =>
                    console.warn('[useDiagnosticManagement] Unable to persist diagnostic scheduling', error),
                );
            }

            if (options?.childId) {
                setDiagnosticPlans((prev) => ({
                    ...prev,
                    [options.childId as string]: {
                        scheduled: true,
                        remind: prev[options.childId ?? '']?.remind ?? true,
                    },
                }));
            }
        },
        [parentId, parentOnboardingState],
    );

    // ─────────────────────────────────────────────────────────
    // Toggle diagnostic reminder for a child
    // ─────────────────────────────────────────────────────────
    const toggleDiagnosticReminder = useCallback(
        (childId: string) => {
            setDiagnosticPlans((prev) => {
                const existing = prev[childId] ?? { scheduled: false, remind: true };
                return { ...prev, [childId]: { ...existing, remind: !existing.remind } };
            });

            trackEvent('parent_diagnostic_reminder_toggle', {
                parentId,
                childId,
                enabled: !(diagnosticPlans[childId]?.remind ?? true),
            });
        },
        [parentId, diagnosticPlans],
    );

    // ─────────────────────────────────────────────────────────
    // Derive diagnostic status for a child
    // ─────────────────────────────────────────────────────────
    const deriveDiagnosticStatus = useCallback(
        (child: ParentChildSnapshot | null | undefined): 'not_started' | 'scheduled' | 'in_progress' | 'completed' => {
            if (!child) return 'not_started';
            if (child.diagnosticStatus === 'completed') return 'completed';
            if (child.diagnosticStatus === 'in_progress') return 'in_progress';
            if (child.diagnosticStatus === 'scheduled') return 'scheduled';
            if (diagnosticPlans[child.id]?.scheduled || onboardingPrefs.diagnosticScheduled) return 'scheduled';
            return 'not_started';
        },
        [diagnosticPlans, onboardingPrefs.diagnosticScheduled],
    );

    return {
        // State
        diagnosticPlans,
        onboardingPrefs,
        onboardingMessage,
        onboardingError,

        // Actions
        handleScheduleDiagnostic,
        toggleDiagnosticReminder,
        deriveDiagnosticStatus,
        setOnboardingPrefs,
        setOnboardingMessage,
        setOnboardingError,
    };
}

export default useDiagnosticManagement;
