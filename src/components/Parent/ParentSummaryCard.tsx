import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    Clock,
    Sparkles,
    ChevronRight,
    BookOpen,
    Target,
    Eye,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ParentChildSnapshot } from '../../types';
import { formatSubjectLabel } from '../../lib/subjects';

interface ParentSummaryCardProps {
    children: ParentChildSnapshot[];
    onViewDetails?: () => void;
    onSetGoals?: () => void;
}

/**
 * ParentSummaryCard - "Summary First" view for parents
 * Part of Phase 6: Parent Visibility Without Micromanagement
 * 
 * Key features:
 * - Shows child status at ONE glance (< 3 seconds to understand)
 * - Overall status indicator (doing well / needs attention / off track)
 * - Quick subject status for each child
 * - Last active time
 * - Week summary (lessons completed)
 * - Simple "View Details" / "Set Goals" CTAs
 * - Collapsed detailed analytics behind View Details
 */
const ParentSummaryCard: React.FC<ParentSummaryCardProps> = ({
    children,
    onViewDetails,
    onSetGoals,
}) => {
    // Determine overall family status
    const familyStatus = useMemo(() => {
        if (!children.length) {
            return { status: 'no_children', label: 'Add a learner to get started', emoji: '👋' };
        }

        const hasStruggling = children.some((child) => {
            const atRisk = child.subjectStatuses?.some(s => s.status === 'at_risk' || s.status === 'off_track');
            const hasSkillGaps = child.skillGaps?.some(g => g.status === 'needs_attention');
            return atRisk || hasSkillGaps;
        });
        const hasAlerts = children.some((child) => {
            return child.skillGaps?.some(g => g.status === 'needs_attention');
        });
        const avgProgress = children.reduce((sum, c) => sum + (c.goalProgress ?? 0), 0) / children.length;

        if (hasStruggling || hasAlerts) {
            return { status: 'needs_attention', label: 'Needs a little attention', emoji: '💡' };
        }
        if (avgProgress >= 80) {
            return { status: 'great', label: 'Doing great!', emoji: '🌟' };
        }
        if (avgProgress >= 50) {
            return { status: 'good', label: 'On track', emoji: '👍' };
        }
        return { status: 'building', label: 'Building momentum', emoji: '📚' };
    }, [children]);

    // Get this week's total lessons
    const weeklyLessonsTotal = useMemo(() => {
        return children.reduce((sum, child) => sum + (child.lessonsCompletedWeek ?? 0), 0);
    }, [children]);

    // Determine what each child needs
    const getChildStatus = (child: ParentChildSnapshot) => {
        const atRisk = child.subjectStatuses?.some(s => s.status === 'at_risk' || s.status === 'off_track');
        const hasSkillGaps = child.skillGaps?.some(g => g.status === 'needs_attention');

        // Find strongest and weakest subjects
        const sortedSubjects = [...(child.masteryBySubject ?? [])].sort(
            (a, b) => (b.mastery ?? 0) - (a.mastery ?? 0)
        );
        const strongest = sortedSubjects[0];
        const weakest = sortedSubjects[sortedSubjects.length - 1];

        let statusIndicator: 'on_track' | 'needs_practice' | 'struggling' = 'on_track';
        let statusMessage = 'Doing well';

        if (atRisk || hasSkillGaps) {
            statusIndicator = 'struggling';
            statusMessage = 'Could use some support';
        } else if (weakest && weakest.mastery < 60) {
            statusIndicator = 'needs_practice';
            statusMessage = `Needs practice: ${formatSubjectLabel(weakest.subject)}`;
        } else if (strongest) {
            statusMessage = `Strong in ${formatSubjectLabel(strongest.subject)}`;
        }

        // Format last active
        const formatLastActive = () => {
            const recentEvent = child.recentActivity?.[0];
            if (!recentEvent?.occurredAt) return 'Not active yet';
            const date = new Date(recentEvent.occurredAt);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / (1000 * 60));

            if (diffMins < 60) return 'Active now';
            if (diffMins < 24 * 60) {
                const hours = Math.floor(diffMins / 60);
                return `${hours}h ago`;
            }
            const days = Math.floor(diffMins / (24 * 60));
            if (days === 1) return 'Yesterday';
            if (days < 7) return `${days} days ago`;
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        };

        return {
            statusIndicator,
            statusMessage,
            lastActive: formatLastActive(),
            lessonsThisWeek: child.lessonsCompletedWeek ?? 0,
            strongest: strongest ? formatSubjectLabel(strongest.subject) : null,
            weakest: weakest && weakest.mastery < 70 ? formatSubjectLabel(weakest.subject) : null,
        };
    };

    const statusColors = {
        on_track: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        needs_practice: 'text-amber-600 bg-amber-50 border-amber-200',
        struggling: 'text-rose-600 bg-rose-50 border-rose-200',
    };

    const statusIcons = {
        on_track: <CheckCircle2 className="h-4 w-4" />,
        needs_practice: <Target className="h-4 w-4" />,
        struggling: <AlertTriangle className="h-4 w-4" />,
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-gradient-to-br from-white via-brand-light-blue/10 to-brand-light-teal/20 rounded-3xl border-2 border-brand-light-blue/40 shadow-lg p-6"
        >
            {/* Family Status Header */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-teal flex items-center justify-center shadow-md">
                        <span className="text-2xl">{familyStatus.emoji}</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {children.length === 1
                                ? `${children[0].name} is ${familyStatus.label.toLowerCase()}`
                                : `Your family is ${familyStatus.label.toLowerCase()}`}
                        </h2>
                        <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                            <span className="inline-flex items-center gap-1.5">
                                <BookOpen className="h-4 w-4 text-brand-blue" />
                                {weeklyLessonsTotal} lessons this week
                            </span>
                            {children.length > 1 && (
                                <span className="text-gray-400">•</span>
                            )}
                            {children.length > 1 && (
                                <span>{children.length} learners</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="hidden sm:flex items-center gap-2">
                    {onSetGoals && (
                        <button
                            type="button"
                            onClick={onSetGoals}
                            className="inline-flex items-center gap-2 rounded-xl border border-brand-blue/40 bg-white px-4 py-2 text-sm font-semibold text-brand-blue hover:bg-brand-blue/5 transition-colors"
                        >
                            <Target className="h-4 w-4" />
                            Set Goals
                        </button>
                    )}
                    {onViewDetails && (
                        <button
                            type="button"
                            onClick={onViewDetails}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue/90 transition-colors"
                        >
                            <Eye className="h-4 w-4" />
                            View Details
                        </button>
                    )}
                </div>
            </div>

            {/* Child Cards */}
            <div className="space-y-3">
                {children.map((child) => {
                    const status = getChildStatus(child);
                    return (
                        <motion.div
                            key={child.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center justify-between gap-4">
                                {/* Child Info */}
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-light-blue to-brand-light-teal flex items-center justify-center">
                                        <span className="text-lg font-bold text-brand-blue">
                                            {child.name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-gray-900">
                                            {child.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[status.statusIndicator]}`}
                                            >
                                                {statusIcons[status.statusIndicator]}
                                                {status.statusMessage}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-brand-blue">
                                            {status.lessonsThisWeek}
                                        </div>
                                        <div className="text-xs text-gray-500">lessons</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-amber-600">
                                            {child.streakDays ?? 0}
                                        </div>
                                        <div className="text-xs text-gray-500">day streak</div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-500">
                                        <Clock className="h-4 w-4" />
                                        <span className="text-xs">{status.lastActive}</span>
                                    </div>
                                </div>

                                {/* View Child Link */}
                                <Link
                                    to={`/parent?child=${child.id}`}
                                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 text-gray-400 hover:bg-brand-blue/10 hover:text-brand-blue transition-colors"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Link>
                            </div>

                            {/* Subject Quick View - only show if there are concerns */}
                            {(status.weakest || child.focusAreas?.length > 0) && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    <div className="flex items-center gap-2 text-xs">
                                        {status.strongest && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                                                <TrendingUp className="h-3 w-3" />
                                                Strong: {status.strongest}
                                            </span>
                                        )}
                                        {status.weakest && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700">
                                                <Target className="h-3 w-3" />
                                                Practice: {status.weakest}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* No Children State */}
            {children.length === 0 && (
                <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-brand-light-blue/50 flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="h-8 w-8 text-brand-blue" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Welcome to ElevatED!
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Add your first learner to start their personalized learning journey.
                    </p>
                    <button
                        type="button"
                        onClick={onSetGoals}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue/90"
                    >
                        <Sparkles className="h-4 w-4" />
                        Add a Learner
                    </button>
                </div>
            )}

            {/* Mobile Quick Actions */}
            <div className="flex sm:hidden items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                {onSetGoals && (
                    <button
                        type="button"
                        onClick={onSetGoals}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-brand-blue/40 bg-white px-4 py-2.5 text-sm font-semibold text-brand-blue"
                    >
                        <Target className="h-4 w-4" />
                        Set Goals
                    </button>
                )}
                {onViewDetails && (
                    <button
                        type="button"
                        onClick={onViewDetails}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                    >
                        <Eye className="h-4 w-4" />
                        View Details
                    </button>
                )}
            </div>
        </motion.div>
    );
};

export default ParentSummaryCard;
