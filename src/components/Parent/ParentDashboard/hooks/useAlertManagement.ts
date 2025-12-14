/**
 * useAlertManagement - Custom hook for managing child alert states
 * Extracted from ParentDashboard for maintainability
 */

import { useCallback, useState } from 'react';
import trackEvent from '../../../../lib/analytics';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface AlertFollowUpEntry {
    assignment?: boolean;
    diagnostic?: boolean;
    resolved?: boolean;
}

export interface AlertFollowUpProgress {
    completed: number;
    total: number;
    entry: AlertFollowUpEntry;
}

export interface UseAlertManagementOptions {
    parentId?: string | null;
    weekStart?: string | null;
}

export interface UseAlertManagementReturn {
    // State
    resolvedAlerts: Map<string, string>;
    alertResolvedAt: Map<string, number>;
    alertSeenAt: Map<string, number>;
    alertFollowUps: Record<string, AlertFollowUpEntry>;

    // Actions
    handleResolveChildAlert: (childId: string, alertText?: string | null) => void;
    handleUndoResolveChildAlert: (childId: string) => void;
    isAlertResolved: (childId: string, alertText?: string | null) => boolean;
    alertFollowUpProgress: (childId: string) => AlertFollowUpProgress;
    markAlertSeen: (childId: string) => void;
    updateAlertFollowUp: (childId: string, updates: Partial<AlertFollowUpEntry>) => void;
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useAlertManagement({
    parentId,
    weekStart,
}: UseAlertManagementOptions): UseAlertManagementReturn {
    // Resolved alerts: Map<childId, alertText>
    const [resolvedAlerts, setResolvedAlerts] = useState<Map<string, string>>(() => new Map());

    // When alert was resolved: Map<childId, timestamp>
    const [alertResolvedAt, setAlertResolvedAt] = useState<Map<string, number>>(() => new Map());

    // When alert was first seen: Map<childId, timestamp>
    const [alertSeenAt, setAlertSeenAt] = useState<Map<string, number>>(() => new Map());

    // Follow-up progress per child
    const [alertFollowUps, setAlertFollowUps] = useState<Record<string, AlertFollowUpEntry>>({});

    // ─────────────────────────────────────────────────────────
    // Mark an alert as seen (for tracking resolution time)
    // ─────────────────────────────────────────────────────────
    const markAlertSeen = useCallback((childId: string) => {
        setAlertSeenAt((prev) => {
            if (prev.has(childId)) return prev;
            const next = new Map(prev);
            next.set(childId, Date.now());
            return next;
        });
    }, []);

    // ─────────────────────────────────────────────────────────
    // Update follow-up progress
    // ─────────────────────────────────────────────────────────
    const updateAlertFollowUp = useCallback((childId: string, updates: Partial<AlertFollowUpEntry>) => {
        setAlertFollowUps((prev) => ({
            ...prev,
            [childId]: { ...(prev[childId] ?? {}), ...updates },
        }));
    }, []);

    // ─────────────────────────────────────────────────────────
    // Get follow-up progress for a child
    // ─────────────────────────────────────────────────────────
    const alertFollowUpProgress = useCallback(
        (childId: string): AlertFollowUpProgress => {
            const entry = alertFollowUps[childId] ?? {};
            const total = 3;
            const completed =
                (entry.assignment ? 1 : 0) + (entry.diagnostic ? 1 : 0) + (entry.resolved ? 1 : 0);
            return { completed, total, entry };
        },
        [alertFollowUps],
    );

    // ─────────────────────────────────────────────────────────
    // Resolve a child's alert
    // ─────────────────────────────────────────────────────────
    const handleResolveChildAlert = useCallback(
        (childId: string, alertText?: string | null) => {
            if (!alertText) return;

            const resolvedAtMs = Date.now();
            const seenAtMs = alertSeenAt.get(childId);
            const resolutionHours =
                seenAtMs && resolvedAtMs >= seenAtMs
                    ? Math.round(((resolvedAtMs - seenAtMs) / (1000 * 60 * 60)) * 10) / 10
                    : null;

            setResolvedAlerts((prev) => {
                const next = new Map(prev);
                next.set(childId, alertText);
                return next;
            });

            setAlertResolvedAt((prev) => {
                const next = new Map(prev);
                next.set(childId, resolvedAtMs);
                return next;
            });

            setAlertFollowUps((prev) => ({
                ...prev,
                [childId]: { ...(prev[childId] ?? {}), resolved: true },
            }));

            trackEvent('parent_child_alert_resolved', { parentId, childId, resolutionHours });
            trackEvent('success_alert_resolved', {
                parentId,
                childId,
                resolutionHours,
                weekStart: weekStart ?? null,
            });
        },
        [alertSeenAt, parentId, weekStart],
    );

    // ─────────────────────────────────────────────────────────
    // Undo resolving a child's alert
    // ─────────────────────────────────────────────────────────
    const handleUndoResolveChildAlert = useCallback(
        (childId: string) => {
            setResolvedAlerts((prev) => {
                const next = new Map(prev);
                next.delete(childId);
                return next;
            });

            setAlertResolvedAt((prev) => {
                const next = new Map(prev);
                next.delete(childId);
                return next;
            });

            setAlertFollowUps((prev) => {
                const next = { ...prev };
                const entry = { ...(next[childId] ?? {}) };
                entry.resolved = false;
                next[childId] = entry;
                return next;
            });

            trackEvent('parent_child_alert_reopened', { parentId, childId });
        },
        [parentId],
    );

    // ─────────────────────────────────────────────────────────
    // Check if an alert is resolved
    // ─────────────────────────────────────────────────────────
    const isAlertResolved = useCallback(
        (childId: string, alertText?: string | null) => {
            if (!alertText) return false;
            return resolvedAlerts.get(childId) === alertText;
        },
        [resolvedAlerts],
    );

    return {
        // State
        resolvedAlerts,
        alertResolvedAt,
        alertSeenAt,
        alertFollowUps,

        // Actions
        handleResolveChildAlert,
        handleUndoResolveChildAlert,
        isAlertResolved,
        alertFollowUpProgress,
        markAlertSeen,
        updateAlertFollowUp,
    };
}

export default useAlertManagement;
