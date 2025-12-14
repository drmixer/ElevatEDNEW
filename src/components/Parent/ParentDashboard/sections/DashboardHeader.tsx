/**
 * DashboardHeader - Header section for ParentDashboard
 * Contains title, quick action buttons, and plan status badges
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Download, RefreshCw, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DashboardHeaderProps {
    // Plan & billing info
    planName: string | null;
    planLabel: string;
    seatsUsed: number;
    seatLimit: number | null;
    billingBypassed: boolean;
    trialDaysRemaining: number | null;
    isTrialing: boolean;

    // Actions
    onScrollToGoals: () => void;
    onScrollToFamily: () => void;
    onDownloadReport: () => void;
    onRefresh: () => void;

    // State
    canDownloadReport: boolean;
    isRefreshing: boolean;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    planName,
    planLabel,
    seatsUsed,
    seatLimit,
    billingBypassed,
    trialDaysRemaining,
    isTrialing,
    onScrollToGoals,
    onScrollToFamily,
    onDownloadReport,
    onRefresh,
    canDownloadReport,
    isRefreshing,
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
        >
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                {/* Title & Actions Row */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-blue">
                            Parent dashboard
                        </p>
                        <h1 className="text-2xl font-bold text-slate-900">Family Command Center</h1>
                        <p className="text-sm text-slate-600">
                            A calmer view of progress, plan choices, and the next actions for your learners.
                        </p>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={onScrollToGoals}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:border-brand-blue hover:text-brand-blue focus-ring"
                        >
                            <Target className="h-4 w-4 text-brand-blue" />
                            Goals
                        </button>
                        <button
                            type="button"
                            onClick={onScrollToFamily}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:border-brand-teal hover:text-brand-teal focus-ring"
                        >
                            <Users className="h-4 w-4 text-brand-teal" />
                            Family connections
                        </button>
                        <button
                            type="button"
                            onClick={onDownloadReport}
                            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue text-white px-3 py-2 text-sm font-semibold hover:bg-brand-blue/90 focus-ring disabled:opacity-60"
                            disabled={!canDownloadReport}
                        >
                            <Download className="h-4 w-4" />
                            Weekly report
                        </button>
                        <button
                            type="button"
                            onClick={onRefresh}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:border-brand-blue hover:text-brand-blue focus-ring disabled:opacity-60"
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? 'Refreshing' : 'Refresh data'}
                        </button>
                    </div>
                </div>

                {/* Status Badges */}
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-700">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold">
                        <Sparkles className="h-3.5 w-3.5 text-brand-violet" />
                        {planName ?? 'Free'} plan ({planLabel})
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold">
                        <Users className="h-3.5 w-3.5 text-brand-blue" />
                        {seatLimit !== null
                            ? `${seatsUsed}/${seatLimit} seats used`
                            : `${seatsUsed} learner${seatsUsed === 1 ? '' : 's'} linked`}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold">
                        <ShieldCheck className="h-3.5 w-3.5 text-brand-teal" />
                        {billingBypassed ? 'Billing off — plans apply instantly' : 'Billing on — checkout required'}
                    </span>
                    {trialDaysRemaining !== null && isTrialing && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-semibold text-amber-800">
                            <Clock className="h-3.5 w-3.5" />
                            Trial: {trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'} left
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default DashboardHeader;
