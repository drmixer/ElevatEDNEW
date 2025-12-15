/**
 * ParentDashboard style constants and mappings
 * Extracted from the main component for maintainability
 */

import type { SkillGapInsight, AssignmentStatus, PrivacyRequestStatus, ConcernReport } from '../../../../types';

// ─────────────────────────────────────────────────────────────
// Tone Styles
// ─────────────────────────────────────────────────────────────

export const weeklyPlanToneStyles: Record<'info' | 'success' | 'warn', { bg: string; border: string; icon: string }> = {
    info: {
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        icon: 'text-slate-600',
    },
    success: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        icon: 'text-emerald-700',
    },
    warn: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'text-amber-700',
    },
};

// ─────────────────────────────────────────────────────────────
// Status Badge Styles
// ─────────────────────────────────────────────────────────────

export const statusBadgeStyles: Record<AssignmentStatus, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    in_progress: 'bg-amber-100 text-amber-700',
    not_started: 'bg-slate-200 text-slate-600',
};

export const privacyStatusStyles: Record<PrivacyRequestStatus, string> = {
    pending: 'bg-amber-100 text-amber-700',
    in_review: 'bg-blue-100 text-blue-700',
    fulfilled: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
};

export const concernStatusStyles: Record<ConcernReport['status'], string> = {
    open: 'bg-amber-100 text-amber-700',
    in_review: 'bg-blue-100 text-blue-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-slate-100 text-slate-700',
};

export const skillGapStatusStyles: Record<SkillGapInsight['status'], string> = {
    needs_attention: 'bg-rose-50 text-rose-700 border-rose-100',
    watch: 'bg-amber-50 text-amber-700 border-amber-100',
    improving: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

export const familyStatusStyles: Record<
    'attention' | 'watch' | 'on_track',
    { badge: string; border: string; label: string }
> = {
    attention: {
        badge: 'bg-rose-100 text-rose-700',
        border: 'border-rose-200',
        label: 'Needs attention this week',
    },
    watch: {
        badge: 'bg-amber-100 text-amber-700',
        border: 'border-amber-200',
        label: 'Monitor progress',
    },
    on_track: {
        badge: 'bg-emerald-100 text-emerald-700',
        border: 'border-emerald-200',
        label: 'On track',
    },
};

// ─────────────────────────────────────────────────────────────
// Diagnostic Chip Styles
// ─────────────────────────────────────────────────────────────

export const getDiagnosticChipStyles = (status: string): string => {
    switch (status) {
        case 'completed':
            return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'in_progress':
            return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'scheduled':
            return 'bg-blue-100 text-blue-700 border-blue-200';
        default:
            return 'bg-slate-100 text-slate-700 border-slate-200';
    }
};

export const getDiagnosticLabel = (status: string): string => {
    switch (status) {
        case 'completed':
            return 'Done';
        case 'in_progress':
            return 'In progress';
        case 'scheduled':
            return 'Scheduled';
        default:
            return 'Not started';
    }
};
