/**
 * Shared UI components for ParentDashboard
 */

import React from 'react';
import { Lock } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// SkeletonCard - Loading placeholder
// ─────────────────────────────────────────────────────────────

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

// ─────────────────────────────────────────────────────────────
// PlanTag - Feature tier indicator
// ─────────────────────────────────────────────────────────────

export const PlanTag: React.FC<{ label: string; locked?: boolean }> = ({ label, locked = false }) => (
    <span
        className={`inline-flex items-center text-[11px] px-2 py-1 rounded-full border ${locked
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
    >
        {locked ? `Locked · ${label}` : `${label} included`}
    </span>
);

// ─────────────────────────────────────────────────────────────
// LockedFeature - Feature upgrade prompt
// ─────────────────────────────────────────────────────────────

export const LockedFeature: React.FC<{
    title: string;
    description: string;
    onUpgrade?: () => void;
    ctaLabel?: string;
}> = ({ title, description, onUpgrade, ctaLabel = 'Unlock with Plus' }) => (
    <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                <Lock className="h-5 w-5" />
            </div>
            <div>
                <p className="text-sm font-semibold text-amber-800">{title}</p>
                <p className="text-xs text-amber-700">{description}</p>
            </div>
        </div>
        {onUpgrade && (
            <button
                type="button"
                onClick={onUpgrade}
                className="inline-flex items-center px-3 py-2 rounded-lg bg-brand-blue text-white text-sm font-semibold hover:bg-brand-blue/90"
            >
                {ctaLabel}
            </button>
        )}
    </div>
);
