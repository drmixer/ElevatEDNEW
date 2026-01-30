/**
 * SubjectStatusCards - Sprint 3 (Phase C.2)
 * 
 * Displays per-subject status cards with:
 * - On-track / At-risk / Off-track status chip
 * - 1-2 drivers explaining the status (pacing, mastery)
 * - "See how we calculate" tooltip
 * - Recommendation action
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Info,
    ChevronDown,
    TrendingUp,
    BookOpen,
    Target,
    Plus,
} from 'lucide-react';
import type { Subject } from '../../types';
import { formatSubjectLabel } from '../../lib/subjects';
import {
    onTrackLabel,
    onTrackBadge,
    onTrackDescription,
    type OnTrackStatus,
    type SubjectStatus,
} from '../../lib/onTrack';

interface SubjectStatusCardsProps {
    childName: string;
    statuses: SubjectStatus[];
    onViewSubject?: (subject: Subject) => void;
    onAssignSubject?: (subject: Subject) => void;
}

const StatusIcon: React.FC<{ status: OnTrackStatus; className?: string }> = ({
    status,
    className = 'w-4 h-4',
}) => {
    if (status === 'on_track') {
        return <CheckCircle2 className={`${className} text-emerald-600`} />;
    }
    if (status === 'at_risk') {
        return <AlertTriangle className={`${className} text-amber-600`} />;
    }
    return <XCircle className={`${className} text-rose-600`} />;
};

const SubjectIcon: React.FC<{ subject: Subject; className?: string }> = ({
    subject,
    className = 'w-5 h-5',
}) => {
    const colors: Record<Subject, string> = {
        math: 'text-blue-600',
        english: 'text-purple-600',
        science: 'text-green-600',
        social_studies: 'text-amber-600',
        study_skills: 'text-slate-600',
        arts_music: 'text-pink-600',
        financial_literacy: 'text-emerald-600',
        health_pe: 'text-red-600',
        computer_science: 'text-cyan-600',
    };
    return <BookOpen className={`${className} ${colors[subject] ?? 'text-slate-600'}`} />;
};

const StatusCard: React.FC<{
    status: SubjectStatus;
    onViewSubject?: (subject: Subject) => void;
    onAssignSubject?: (subject: Subject) => void;
}> = ({ status, onViewSubject, onAssignSubject }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const borderColor =
        status.status === 'on_track'
            ? 'border-emerald-200 hover:border-emerald-300'
            : status.status === 'at_risk'
                ? 'border-amber-200 hover:border-amber-300'
                : 'border-rose-200 hover:border-rose-300';

    const bgGradient =
        status.status === 'on_track'
            ? 'from-emerald-50 to-white'
            : status.status === 'at_risk'
                ? 'from-amber-50 to-white'
                : 'from-rose-50 to-white';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative bg-gradient-to-br ${bgGradient} rounded-xl border ${borderColor} overflow-hidden transition-all shadow-sm hover:shadow-md`}
        >
            <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center border border-slate-100">
                            <SubjectIcon subject={status.subject} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 text-sm">
                                {formatSubjectLabel(status.subject)}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${onTrackBadge(status.status)}`}
                                >
                                    <StatusIcon status={status.status} className="w-3 h-3" />
                                    {onTrackLabel(status.status)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Info Tooltip Trigger */}
                    <div className="relative">
                        <button
                            type="button"
                            onMouseEnter={() => setShowTooltip(true)}
                            onMouseLeave={() => setShowTooltip(false)}
                            onClick={() => setShowTooltip(!showTooltip)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50 transition-colors"
                            aria-label="See how we calculate status"
                        >
                            <Info className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                            {showTooltip && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    className="absolute right-0 top-full mt-1 z-10 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl"
                                >
                                    <p className="font-semibold mb-1">How we calculate this:</p>
                                    <p className="text-slate-300">
                                        {onTrackDescription(status.status)}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Drivers (always visible, compact) */}
                <div className="space-y-1.5 mb-3">
                    {status.drivers.slice(0, 2).map((driver, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-2 text-xs text-slate-600"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>{driver}</span>
                        </div>
                    ))}
                </div>

                {/* Expandable Recommendation */}
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white/60 rounded-lg text-xs text-slate-600 hover:bg-white/80 transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <Target className="w-3.5 h-3.5" />
                        <span className="font-medium">Recommendation</span>
                    </span>
                    <motion.div
                        animate={{ rotate: expanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown className="w-4 h-4" />
                    </motion.div>
                </button>

                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-3 text-xs text-slate-700">
                                <p className="bg-white/80 rounded-lg px-3 py-2.5 border border-slate-100">
                                    {status.recommendation}
                                </p>
                                <div className="mt-2 flex gap-2">
                                    {onAssignSubject && (
                                        <button
                                            type="button"
                                            onClick={() => onAssignSubject(status.subject)}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-violet transition-colors font-medium"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Assign Lessons
                                        </button>
                                    )}
                                    {onViewSubject && (
                                        <button
                                            type="button"
                                            onClick={() => onViewSubject(status.subject)}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
                                        >
                                            <TrendingUp className="w-3.5 h-3.5" />
                                            View Progress
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

const SubjectStatusCards: React.FC<SubjectStatusCardsProps> = ({
    childName,
    statuses,
    onViewSubject,
    onAssignSubject,
}) => {
    if (!statuses?.length) {
        return null;
    }

    // Sort: off_track first, then at_risk, then on_track
    const sortedStatuses = [...statuses].sort((a, b) => {
        const order: Record<OnTrackStatus, number> = { off_track: 0, at_risk: 1, on_track: 2 };
        return order[a.status] - order[b.status];
    });

    const summary = {
        onTrack: statuses.filter((s) => s.status === 'on_track').length,
        atRisk: statuses.filter((s) => s.status === 'at_risk').length,
        offTrack: statuses.filter((s) => s.status === 'off_track').length,
    };

    const firstName = childName.split(' ')[0];

    return (
        <section className="mb-8">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                        {firstName}'s Subject Status
                    </h3>
                    <p className="text-sm text-slate-500">
                        {summary.onTrack > 0 && (
                            <span className="text-emerald-600 font-medium">
                                {summary.onTrack} on-track
                            </span>
                        )}
                        {summary.atRisk > 0 && (
                            <>
                                {summary.onTrack > 0 && ' · '}
                                <span className="text-amber-600 font-medium">
                                    {summary.atRisk} at-risk
                                </span>
                            </>
                        )}
                        {summary.offTrack > 0 && (
                            <>
                                {(summary.onTrack > 0 || summary.atRisk > 0) && ' · '}
                                <span className="text-rose-600 font-medium">
                                    {summary.offTrack} off-track
                                </span>
                            </>
                        )}
                    </p>
                </div>
            </div>

            {/* Status Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedStatuses.map((status) => (
                    <StatusCard
                        key={status.subject}
                        status={status}
                        onViewSubject={onViewSubject}
                        onAssignSubject={onAssignSubject}
                    />
                ))}
            </div>
        </section>
    );
};

export default SubjectStatusCards;
