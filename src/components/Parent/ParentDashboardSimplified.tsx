import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    ArrowRight,
    ArrowUp,
    ArrowDown,
    Bell,
    BookOpen,
    CheckCircle,
    ChevronRight,
    Flame,
    Settings,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchParentDashboardData } from '../../services/dashboardService';
import { updateLearningPreferences } from '../../services/profileService';
import { formatSubjectLabel } from '../../lib/subjects';
import type { Parent, ParentChildSnapshot, LearningPreferences, Subject } from '../../types';
import SubjectStatusCards from './SubjectStatusCards';
import WeeklyCoachingSuggestions from './WeeklyCoachingSuggestions';
import ParentTutorControls from './ParentTutorControls';
import SafetyTransparencySection from './SafetyTransparencySection';
import ParentOnboardingTour from './ParentOnboardingTour';
import { shouldShowParentOnboarding, markParentOnboardingDone } from '../../lib/parentOnboardingHelpers';
import { defaultLearningPreferences } from '../../types';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
} from 'recharts';

// ============================================================================
// ParentDashboardSimplified
// A clean, focused dashboard that answers: "How is my child doing?" and "What can I do to help?"
// Target: ~600 lines max (vs 7,315 in the original)
// ============================================================================

// ============================================================================
// Sub-components
// ============================================================================

interface HeaderProps {
    parentName: string;
    hasNotifications?: boolean;
}

const Header: React.FC<HeaderProps> = ({ parentName, hasNotifications }) => {
    const today = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
    const firstName = parentName?.split(' ')[0] || 'there';
    return (
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                    Hi {firstName}! 👋
                </h1>
                <p className="text-slate-500 mt-1">{today}</p>
            </div>
            <div className="flex items-center gap-3">
                <Link
                    to="/settings"
                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                    title="Settings"
                >
                    <Settings className="w-6 h-6 text-slate-500" />
                </Link>
                <button
                    className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
                    title="Notifications"
                >
                    <Bell className="w-6 h-6 text-slate-500" />
                    {hasNotifications && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                    )}
                </button>
            </div>
        </div>
    );
};

interface ChildCardProps {
    child: ParentChildSnapshot;
}

const ChildCard: React.FC<ChildCardProps> = ({ child }) => {
    // Calculate average mastery across all subjects
    const avgMastery = useMemo(() => {
        if (!child.masteryBySubject?.length) return null;
        const sum = child.masteryBySubject.reduce((acc, s) => acc + s.mastery, 0);
        return Math.round(sum / child.masteryBySubject.length);
    }, [child.masteryBySubject]);

    // Determine primary focus subject
    const focusSubject = useMemo(() => {
        const fromGaps = child.skillGaps?.find((g) => g.status === 'needs_attention');
        if (fromGaps) return fromGaps.subject;
        if (child.focusAreas?.length) {
            // Try to infer subject from focus area name (simplified)
            return null;
        }
        return null;
    }, [child.skillGaps, child.focusAreas]);

    const isStreakActive = (child.streakDays ?? 0) > 0;
    const masteryTrend = child.avgAccuracyDelta;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {child.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">{child.name}</h3>
                        <p className="text-sm text-slate-500">Grade {child.grade}</p>
                    </div>
                </div>
                <Link
                    to={`/parent/child/${child.id}`}
                    className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
                >
                    View Details
                    <ChevronRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Mastery Progress Bar */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-600">Overall Mastery</span>
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-900">{avgMastery ?? '--'}%</span>
                        {masteryTrend != null && masteryTrend !== 0 && (
                            <span
                                className={`flex items-center text-xs font-medium ${masteryTrend > 0 ? 'text-emerald-600' : 'text-red-500'
                                    }`}
                            >
                                {masteryTrend > 0 ? (
                                    <ArrowUp className="w-3 h-3" />
                                ) : (
                                    <ArrowDown className="w-3 h-3" />
                                )}
                                {Math.abs(masteryTrend)}%
                            </span>
                        )}
                    </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(avgMastery ?? 0, 100)}%` }}
                    />
                </div>
            </div>

            {/* Quick Stats / Badges */}
            <div className="flex flex-wrap gap-2">
                {isStreakActive && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm font-medium border border-orange-100">
                        <Flame className="w-4 h-4" />
                        {child.streakDays} day streak
                    </span>
                )}
                {focusSubject && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100">
                        <BookOpen className="w-4 h-4" />
                        Focus: {formatSubjectLabel(focusSubject)}
                    </span>
                )}
                {child.lessonsCompletedWeek > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-sm font-medium border border-slate-100">
                        <CheckCircle className="w-4 h-4" />
                        {child.lessonsCompletedWeek} lessons this week
                    </span>
                )}
            </div>
        </motion.div>
    );
};

interface WeeklySummaryChartProps {
    activityData: Array<{ date: string; lessonsCompleted: number; practiceMinutes: number }>;
}

const WeeklySummaryChart: React.FC<WeeklySummaryChartProps> = ({ activityData }) => {
    const chartData = useMemo(() => {
        if (!activityData?.length) return [];
        return activityData.slice(-7).map((point) => ({
            day: new Date(point.date).toLocaleDateString(undefined, { weekday: 'short' }),
            lessons: point.lessonsCompleted ?? 0,
        }));
    }, [activityData]);

    const totalLessons = chartData.reduce((sum, d) => sum + d.lessons, 0);
    const lastWeekTotal = useMemo(() => {
        if (!activityData || activityData.length < 14) return null;
        const prior = activityData.slice(-14, -7);
        return prior.reduce((sum, d) => sum + (d.lessonsCompleted ?? 0), 0);
    }, [activityData]);

    const weekDelta = lastWeekTotal != null ? totalLessons - lastWeekTotal : null;

    if (!chartData.length) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Weekly Summary</h3>
                <p className="text-slate-500 text-center py-8">No activity data yet this week</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Weekly Summary</h3>
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-teal-600" />
                    <span className="text-sm text-slate-500">Lessons completed</span>
                </div>
            </div>

            {/* Chart */}
            <div className="h-40 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="lessonGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="day"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                        />
                        <YAxis hide />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            }}
                            formatter={(value: number) => [`${value} lessons`, 'Completed']}
                        />
                        <Area
                            type="monotone"
                            dataKey="lessons"
                            stroke="#14b8a6"
                            strokeWidth={2}
                            fill="url(#lessonGradient)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Summary Stats */}
            <div className="flex items-center justify-around pt-4 border-t border-slate-100">
                <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">{totalLessons}</p>
                    <p className="text-sm text-slate-500">lessons this week</p>
                </div>
                {weekDelta != null && (
                    <div className="text-center">
                        <p
                            className={`text-2xl font-bold flex items-center justify-center gap-1 ${weekDelta >= 0 ? 'text-emerald-600' : 'text-red-500'
                                }`}
                        >
                            {weekDelta >= 0 ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
                            {Math.abs(weekDelta)}
                        </p>
                        <p className="text-sm text-slate-500">vs last week</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

interface AlertBannerProps {
    alertCount: number;
}

const AlertBanner: React.FC<AlertBannerProps> = ({ alertCount }) => {
    if (alertCount === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3"
        >
            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
                <p className="font-medium text-amber-800">
                    {alertCount} item{alertCount > 1 ? 's' : ''} need{alertCount === 1 ? 's' : ''} your attention
                </p>
                <p className="text-sm text-amber-600">Review your child's progress and take action</p>
            </div>
            <Link
                to="/parent/alerts"
                className="px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors text-sm"
            >
                View
            </Link>
        </motion.div>
    );
};

const QuickActions: React.FC = () => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-50 rounded-2xl p-6"
    >
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
                to="/parent/goals"
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all text-center"
            >
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-teal-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Set Goals</span>
            </Link>
            <Link
                to="/catalog"
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all text-center"
            >
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Browse Lessons</span>
            </Link>
            <Link
                to="/parent/add-learner"
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all text-center"
            >
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Add Learner</span>
            </Link>
            <Link
                to="/settings"
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all text-center"
            >
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5 text-slate-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Settings</span>
            </Link>
        </div>
    </motion.div>
);

// ============================================================================
// Main Component
// ============================================================================

const ParentDashboardSimplified: React.FC = () => {
    const { user } = useAuth();
    const parent = (user as Parent) ?? null;
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Track which child is expanded for detailed view (Sprint 3)
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
    const [savingTutor, setSavingTutor] = useState<string | null>(null);
    const [showOnboarding, setShowOnboarding] = useState(false);

    // Check if parent should see onboarding tour
    useEffect(() => {
        if (parent?.id && shouldShowParentOnboarding(parent.id)) {
            // Small delay for better UX
            const timer = setTimeout(() => setShowOnboarding(true), 500);
            return () => clearTimeout(timer);
        }
    }, [parent?.id]);

    // Fetch dashboard data
    const {
        data: dashboard,
        isLoading,
    } = useQuery({
        queryKey: ['parent-dashboard', parent?.id],
        queryFn: () => fetchParentDashboardData({ ...(parent as Parent) }),
        enabled: Boolean(parent),
        staleTime: 1000 * 60 * 5,
    });

    // Count actionable alerts
    const alertCount = useMemo(() => {
        if (!dashboard?.alerts) return 0;
        return dashboard.alerts.filter((a) => a.type === 'warning').length;
    }, [dashboard?.alerts]);

    // Get selected child for expanded view
    const selectedChild = useMemo(() => {
        if (!selectedChildId || !dashboard?.children) return null;
        return dashboard.children.find((c) => c.id === selectedChildId) ?? null;
    }, [selectedChildId, dashboard?.children]);

    // Handle tutor settings save
    const handleSaveTutorSettings = useCallback(
        async (childId: string, updates: Partial<LearningPreferences>) => {
            setSavingTutor(childId);
            try {
                await updateLearningPreferences(childId, updates);
                // Invalidate dashboard to refresh child data
                await queryClient.invalidateQueries({ queryKey: ['parent-dashboard'] });
            } finally {
                setSavingTutor(null);
            }
        },
        [queryClient],
    );

    // Navigate to subject details
    const handleViewSubject = useCallback(
        (childId: string, subject: Subject) => {
            navigate(`/parent/child/${childId}?subject=${subject}`);
        },
        [navigate],
    );

    // Handle onboarding completion
    const handleOnboardingComplete = useCallback(() => {
        if (parent?.id) {
            markParentOnboardingDone(parent.id);
        }
        setShowOnboarding(false);
    }, [parent?.id]);

    // Loading state
    if (isLoading && !dashboard) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 md:p-8 lg:p-12">
                <div className="max-w-5xl mx-auto">
                    <div className="animate-pulse space-y-8">
                        <div className="h-16 w-64 bg-slate-200 rounded-xl" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="h-48 bg-slate-200 rounded-2xl" />
                            <div className="h-48 bg-slate-200 rounded-2xl" />
                        </div>
                        <div className="h-64 bg-slate-200 rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    const children = dashboard?.children ?? [];

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 md:p-8 lg:p-12">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <Header parentName={parent?.name ?? 'Parent'} hasNotifications={alertCount > 0} />

                {/* Alert Banner (if any) */}
                <AlertBanner alertCount={alertCount} />

                {/* Children Section */}
                <section className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-slate-900">Your Children</h2>
                        {children.length > 0 && (
                            <span className="text-sm text-slate-500">
                                {children.length} learner{children.length > 1 ? 's' : ''}
                                {selectedChildId && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedChildId(null)}
                                        className="ml-3 text-teal-600 hover:text-teal-700 font-medium"
                                    >
                                        Show all
                                    </button>
                                )}
                            </span>
                        )}
                    </div>

                    {children.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No learners yet</h3>
                            <p className="text-slate-500 mb-6">
                                Add your first learner to start tracking their progress
                            </p>
                            <Link
                                to="/parent/add-learner"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors"
                            >
                                Add a Learner
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {children
                                .filter((c) => !selectedChildId || c.id === selectedChildId)
                                .map((child) => (
                                    <div
                                        key={child.id}
                                        onClick={() => setSelectedChildId(selectedChildId === child.id ? null : child.id)}
                                        className={`cursor-pointer transition-all ${selectedChildId === child.id ? 'md:col-span-2' : ''
                                            }`}
                                    >
                                        <ChildCard child={child} />
                                    </div>
                                ))}
                        </div>
                    )}
                </section>

                {/* Sprint 3: Selected Child Detailed View */}
                {selectedChild && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                    >
                        {/* Subject Status Cards */}
                        {selectedChild.subjectStatuses && selectedChild.subjectStatuses.length > 0 && (
                            <SubjectStatusCards
                                childName={selectedChild.name}
                                statuses={selectedChild.subjectStatuses}
                                onViewSubject={(subject) => handleViewSubject(selectedChild.id, subject)}
                            />
                        )}

                        {/* Two Column Layout: Coaching + Tutor Controls */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Weekly Coaching Suggestions */}
                            <WeeklyCoachingSuggestions
                                childName={selectedChild.name}
                                suggestions={selectedChild.coachingSuggestions ?? []}
                                focusSubject={
                                    selectedChild.masteryBySubject?.[0]?.subject ?? null
                                }
                            />

                            {/* AI Tutor Controls */}
                            <ParentTutorControls
                                childName={selectedChild.name}
                                preferences={selectedChild.learningPreferences ?? defaultLearningPreferences}
                                onSave={(updates) => handleSaveTutorSettings(selectedChild.id, updates)}
                                saving={savingTutor === selectedChild.id}
                            />
                        </div>
                    </motion.div>
                )}

                {/* Weekly Summary Chart */}
                {dashboard?.activitySeries && dashboard.activitySeries.length > 0 && (
                    <section className="mb-8">
                        <WeeklySummaryChart activityData={dashboard.activitySeries} />
                    </section>
                )}

                {/* Quick Actions */}
                <section>
                    <QuickActions />
                </section>

                {/* Safety & Transparency Section */}
                <section className="mt-8">
                    <SafetyTransparencySection
                        parentId={parent?.id ?? ''}
                        studentId={selectedChild?.id}
                        studentName={selectedChild?.name}
                    />
                </section>
            </div>

            {/* Parent Onboarding Tour */}
            <ParentOnboardingTour
                isOpen={showOnboarding}
                onClose={() => setShowOnboarding(false)}
                onComplete={handleOnboardingComplete}
                parentName={parent?.name}
                childrenCount={children.length}
            />
        </div>
    );
};

export default ParentDashboardSimplified;
