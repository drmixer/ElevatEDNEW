/**
 * ParentDashboard helper utilities
 * Extracted from the main component for maintainability
 */

import type { Subject, LearningPreferences, ParentCheckIn } from '../../../../types';
import { defaultLearningPreferences } from '../../../../types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type GoalFormState = {
    weeklyLessons: string;
    practiceMinutes: string;
    masteryTargets: Record<Subject, string>;
    focusSubject: Subject | 'balanced';
    focusIntensity: 'balanced' | 'focused';
    mixInMode: 'auto' | 'core_only' | 'cross_subject';
    electiveEmphasis: 'off' | 'light' | 'on';
    allowedElectiveSubjects: Subject[];
};

export type ProgressStatusDescription = {
    label: string;
    badge: string;
    tone: string;
};

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

export const describeProgressStatus = (percent: number | null): ProgressStatusDescription => {
    if (percent == null) {
        return {
            label: 'Set a target',
            badge: 'border border-slate-200 bg-white text-slate-700',
            tone: 'text-slate-700',
        };
    }
    if (percent >= 140) {
        return {
            label: 'Pacing high',
            badge: 'border border-indigo-200 bg-indigo-50 text-indigo-700',
            tone: 'text-indigo-700',
        };
    }
    if (percent >= 90) {
        return {
            label: 'On track',
            badge: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
            tone: 'text-emerald-700',
        };
    }
    if (percent >= 60) {
        return {
            label: 'Needs focus',
            badge: 'border border-amber-200 bg-amber-50 text-amber-700',
            tone: 'text-amber-700',
        };
    }
    return {
        label: 'Off pace',
        badge: 'border border-rose-200 bg-rose-50 text-rose-700',
        tone: 'text-rose-700',
    };
};

export const deriveSessionLengthPreference = (
    minutesTarget?: number | null,
    lessonsTarget?: number | null,
    fallback: LearningPreferences['sessionLength'] = defaultLearningPreferences.sessionLength,
): LearningPreferences['sessionLength'] => {
    if (!minutesTarget || minutesTarget <= 0) return fallback;
    const lessons = lessonsTarget && lessonsTarget > 0 ? lessonsTarget : 4;
    const avgMinutes = minutesTarget / Math.max(lessons, 1);
    if (avgMinutes < 20) return 'short';
    if (avgMinutes > 45) return 'long';
    return 'standard';
};

export const formatCheckInTimeAgo = (value?: string | null): string => {
    if (!value) return 'Just now';
    const created = new Date(value);
    const diffMs = Date.now() - created.getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

export const describeActivityType = (activityType?: string): string => {
    if (!activityType) return 'Activity';
    const lookup: Record<string, string> = {
        teacher_led: 'Teacher-led',
        independent: 'Independent practice',
        reflection: 'Reflection',
        project: 'Project',
    };
    return lookup[activityType] ?? activityType.replace(/_/g, ' ');
};

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const ELECTIVE_SUBJECT_OPTIONS: { id: Subject; label: string }[] = [
    { id: 'arts_music', label: 'Arts & Music' },
    { id: 'computer_science', label: 'Computer Science' },
    { id: 'financial_literacy', label: 'Financial literacy' },
    { id: 'health_pe', label: 'Health & PE' },
];

export const checkInBadgeTone: Record<ParentCheckIn['status'], string> = {
    sent: 'bg-amber-50 text-amber-700 border-amber-200',
    delivered: 'bg-blue-50 text-blue-700 border-blue-200',
    seen: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
