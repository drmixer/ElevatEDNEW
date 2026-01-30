/**
 * Content Quality Dashboard Component
 * 
 * Provides comprehensive content quality monitoring for admins:
 * - Quality score per subject/grade
 * - Practice question coverage percentage
 * - Lessons needing review count
 * - Recent quality trend graphs
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    AlertCircle,
    BookOpen,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    FileQuestion,
    LineChart,
    RefreshCw,
    Search,
    TrendingUp,
    XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart,
    Area,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    BarChart,
    Bar,
    Cell,
    PieChart,
    Pie,
} from 'recharts';
import {
    fetchContentQualityMetrics,
    type SubjectGradeQuality,
} from '../../services/contentQualityService';

const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

// Quality score color helpers
const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 75) return 'text-teal-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-rose-600';
};

const getScoreBg = (score: number): string => {
    if (score >= 90) return 'bg-emerald-50 border-emerald-200';
    if (score >= 75) return 'bg-teal-50 border-teal-200';
    if (score >= 60) return 'bg-amber-50 border-amber-200';
    return 'bg-rose-50 border-rose-200';
};

const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Work';
};

// Coverage bar component
const CoverageBar: React.FC<{ value: number; label: string; showLabel?: boolean }> = ({
    value,
    label,
    showLabel = true,
}) => (
    <div className="space-y-1">
        {showLabel && (
            <div className="flex justify-between text-xs text-slate-600">
                <span>{label}</span>
                <span className="font-semibold">{value}%</span>
            </div>
        )}
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${value >= 90
                    ? 'bg-emerald-500'
                    : value >= 75
                        ? 'bg-teal-500'
                        : value >= 60
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                    }`}
            />
        </div>
    </div>
);

// Subject card component
const SubjectQualityCard: React.FC<{
    data: SubjectGradeQuality;
    isExpanded: boolean;
    onToggle: () => void;
}> = ({ data, isExpanded, onToggle }) => {
    const qualityScore = data.qualityScore;

    return (
        <motion.div
            layout
            className={`border rounded-xl p-4 ${getScoreBg(qualityScore)} transition-all`}
        >
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between text-left"
            >
                <div className="flex items-center gap-3">
                    <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${qualityScore >= 90
                            ? 'bg-emerald-100'
                            : qualityScore >= 75
                                ? 'bg-teal-100'
                                : qualityScore >= 60
                                    ? 'bg-amber-100'
                                    : 'bg-rose-100'
                            }`}
                    >
                        <span className={`text-lg font-bold ${getScoreColor(qualityScore)}`}>
                            {qualityScore}
                        </span>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-900">
                            {data.subject} - Grade {data.grade}
                        </p>
                        <p className={`text-xs ${getScoreColor(qualityScore)}`}>
                            {getScoreLabel(qualityScore)} Quality
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm text-slate-700">{data.lessonCount} lessons</p>
                        <p className="text-xs text-slate-500">{data.questionCount} questions</p>
                    </div>
                    {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-slate-500" />
                    )}
                </div>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-4 mt-4 border-t border-slate-200/50 space-y-3">
                            <CoverageBar value={data.practiceQuestionCoverage} label="Practice Question Coverage" />
                            <CoverageBar value={data.structureCompliance} label="Structure Compliance" />
                            <CoverageBar value={data.vocabularyQuality} label="Vocabulary Quality" />
                            <CoverageBar value={data.gradeAppropriateness} label="Grade Appropriateness" />

                            {data.issuesCount > 0 && (
                                <div className="flex items-center gap-2 text-sm text-rose-700 pt-2">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{data.issuesCount} issue{data.issuesCount !== 1 ? 's' : ''} needing attention</span>
                                </div>
                            )}

                            {data.lessonsNeedingReview.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-xs font-semibold text-slate-700 mb-2">
                                        Lessons needing review ({data.lessonsNeedingReview.length}):
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {data.lessonsNeedingReview.slice(0, 5).map((lesson) => (
                                            <span
                                                key={lesson.id}
                                                className="px-2 py-1 bg-white/50 rounded-md text-xs text-slate-600"
                                                title={lesson.title}
                                            >
                                                #{lesson.id}
                                            </span>
                                        ))}
                                        {data.lessonsNeedingReview.length > 5 && (
                                            <span className="px-2 py-1 bg-white/50 rounded-md text-xs text-slate-600">
                                                +{data.lessonsNeedingReview.length - 5} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// Main component
const ContentQualityDashboard: React.FC = () => {
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [subjectFilter, setSubjectFilter] = useState<string>('all');
    const [gradeFilter, setGradeFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const {
        data: metrics,
        isLoading,
        isFetching,
        refetch,
        error,
    } = useQuery({
        queryKey: ['content-quality-metrics'],
        queryFn: fetchContentQualityMetrics,
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
    });

    // Extract filter options
    const subjects = useMemo(() => {
        if (!metrics?.bySubjectGrade) return [];
        const unique = new Set(metrics.bySubjectGrade.map((item) => item.subject));
        return Array.from(unique).sort();
    }, [metrics]);

    const grades = useMemo(() => {
        if (!metrics?.bySubjectGrade) return [];
        const unique = new Set(metrics.bySubjectGrade.map((item) => item.grade));
        return Array.from(unique).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
            const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
            return numA - numB;
        });
    }, [metrics]);

    // Filter data
    const filteredData = useMemo(() => {
        if (!metrics?.bySubjectGrade) return [];

        return metrics.bySubjectGrade.filter((item) => {
            if (subjectFilter !== 'all' && item.subject !== subjectFilter) return false;
            if (gradeFilter !== 'all' && item.grade !== gradeFilter) return false;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    item.subject.toLowerCase().includes(query) ||
                    item.grade.toLowerCase().includes(query)
                );
            }
            return true;
        });
    }, [metrics, subjectFilter, gradeFilter, searchQuery]);

    // Trend chart data
    const trendData = useMemo(() => {
        if (!metrics?.qualityTrend) return [];
        return metrics.qualityTrend.map((item) => ({
            date: new Date(item.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
            }),
            score: item.averageScore,
            issueCount: item.issueCount,
        }));
    }, [metrics]);

    // Subject distribution for pie chart
    const subjectDistribution = useMemo(() => {
        if (!metrics?.bySubjectGrade) return [];
        const subjectTotals: Record<string, number> = {};

        metrics.bySubjectGrade.forEach((item) => {
            subjectTotals[item.subject] = (subjectTotals[item.subject] || 0) + item.lessonCount;
        });

        return Object.entries(subjectTotals)
            .map(([subject, count]) => ({
                name: subject,
                value: count,
            }))
            .sort((a, b) => b.value - a.value);
    }, [metrics]);

    const COLORS = ['#10B981', '#14B8A6', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#8B5CF6', '#06B6D4'];

    if (error) {
        return (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700">
                <div className="flex items-center gap-3">
                    <XCircle className="w-6 h-6" />
                    <div>
                        <p className="font-semibold">Unable to load quality metrics</p>
                        <p className="text-sm opacity-80">
                            {error instanceof Error ? error.message : 'Please try again later.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => refetch()}
                    className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-brand-teal" />
                        Content Quality Dashboard
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">
                        Monitor content quality, practice question coverage, and lessons needing review
                    </p>
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 hover:border-brand-teal/40 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                    {isFetching ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {/* Overview Stats */}
            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <SkeletonCard key={i} className="h-28" />
                    ))}
                </div>
            ) : metrics ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`border rounded-xl p-5 ${getScoreBg(metrics.overallScore)}`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">
                                    Overall Score
                                </p>
                                <p className={`text-3xl font-bold mt-1 ${getScoreColor(metrics.overallScore)}`}>
                                    {metrics.overallScore}
                                </p>
                                <p className={`text-xs mt-1 ${getScoreColor(metrics.overallScore)}`}>
                                    {getScoreLabel(metrics.overallScore)}
                                </p>
                            </div>
                            <TrendingUp className={`w-8 h-8 ${getScoreColor(metrics.overallScore)}`} />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white border border-slate-200 rounded-xl p-5"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">
                                    Total Lessons
                                </p>
                                <p className="text-3xl font-bold mt-1 text-slate-900">{metrics.totalLessons}</p>
                                <p className="text-xs mt-1 text-slate-500">Across all subjects</p>
                            </div>
                            <BookOpen className="w-8 h-8 text-brand-teal" />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white border border-slate-200 rounded-xl p-5"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">
                                    Practice Questions
                                </p>
                                <p className="text-3xl font-bold mt-1 text-slate-900">
                                    {metrics.totalQuestions.toLocaleString()}
                                </p>
                                <p className="text-xs mt-1 text-slate-500">
                                    {metrics.practiceQuestionCoverage}% coverage
                                </p>
                            </div>
                            <FileQuestion className="w-8 h-8 text-brand-blue" />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className={`border rounded-xl p-5 ${metrics.lessonsNeedingReview === 0
                            ? 'bg-emerald-50 border-emerald-200'
                            : metrics.lessonsNeedingReview < 10
                                ? 'bg-amber-50 border-amber-200'
                                : 'bg-rose-50 border-rose-200'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">
                                    Needs Review
                                </p>
                                <p
                                    className={`text-3xl font-bold mt-1 ${metrics.lessonsNeedingReview === 0
                                        ? 'text-emerald-600'
                                        : metrics.lessonsNeedingReview < 10
                                            ? 'text-amber-600'
                                            : 'text-rose-600'
                                        }`}
                                >
                                    {metrics.lessonsNeedingReview}
                                </p>
                                <p className="text-xs mt-1 text-slate-500">Lessons with issues</p>
                            </div>
                            {metrics.lessonsNeedingReview === 0 ? (
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            ) : (
                                <AlertCircle
                                    className={`w-8 h-8 ${metrics.lessonsNeedingReview < 10 ? 'text-amber-600' : 'text-rose-600'
                                        }`}
                                />
                            )}
                        </div>
                    </motion.div>
                </div>
            ) : null}

            {/* Charts Section */}
            {!isLoading && metrics && (
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Quality Trend Chart */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white border border-slate-200 rounded-xl p-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-slate-900">Quality Score Trend</h3>
                                <p className="text-sm text-slate-500">Last 30 days</p>
                            </div>
                            <LineChart className="w-5 h-5 text-brand-teal" />
                        </div>
                        <div className="h-64">
                            {trendData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData}>
                                        <defs>
                                            <linearGradient id="qualityGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#94A3B8" />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #E2E8F0',
                                                borderRadius: '8px',
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="score"
                                            stroke="#14B8A6"
                                            strokeWidth={2}
                                            fill="url(#qualityGradient)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-500">
                                    No trend data available
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Subject Distribution */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white border border-slate-200 rounded-xl p-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-slate-900">Lessons by Subject</h3>
                                <p className="text-sm text-slate-500">Distribution</p>
                            </div>
                            <BookOpen className="w-5 h-5 text-brand-blue" />
                        </div>
                        <div className="h-64 flex items-center justify-center">
                            {subjectDistribution.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={subjectDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={2}
                                            dataKey="value"
                                            label={({ name, percent }) =>
                                                `${name}: ${(percent * 100).toFixed(0)}%`
                                            }
                                            labelLine={false}
                                        >
                                            {subjectDistribution.map((_entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={COLORS[index % COLORS.length]}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: number) => [value, 'Lessons']}
                                            contentStyle={{
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #E2E8F0',
                                                borderRadius: '8px',
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-slate-500">No data available</div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Issues by Type */}
            {!isLoading && metrics && metrics.issuesByType.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-white border border-slate-200 rounded-xl p-6"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-bold text-slate-900">Issues by Type</h3>
                            <p className="text-sm text-slate-500">Breakdown of content issues</p>
                        </div>
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.issuesByType} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                                <YAxis
                                    type="category"
                                    dataKey="type"
                                    tick={{ fontSize: 11 }}
                                    stroke="#94A3B8"
                                    width={120}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#FFFFFF',
                                        border: '1px solid #E2E8F0',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Bar dataKey="count" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            )}

            {/* Filters & Subject/Grade Grid */}
            {!isLoading && metrics && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="bg-white border border-slate-200 rounded-xl p-6"
                >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <h3 className="font-bold text-slate-900">Quality by Subject & Grade</h3>

                        <div className="flex flex-wrap gap-2">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                                />
                            </div>

                            {/* Subject Filter */}
                            <select
                                value={subjectFilter}
                                onChange={(e) => setSubjectFilter(e.target.value)}
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                            >
                                <option value="all">All Subjects</option>
                                {subjects.map((subject) => (
                                    <option key={subject} value={subject}>
                                        {subject}
                                    </option>
                                ))}
                            </select>

                            {/* Grade Filter */}
                            <select
                                value={gradeFilter}
                                onChange={(e) => setGradeFilter(e.target.value)}
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                            >
                                <option value="all">All Grades</option>
                                {grades.map((grade) => (
                                    <option key={grade} value={grade}>
                                        Grade {grade}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Grid of subject/grade cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredData.length > 0 ? (
                            filteredData.map((item) => (
                                <SubjectQualityCard
                                    key={`${item.subject}-${item.grade}`}
                                    data={item}
                                    isExpanded={expandedCard === `${item.subject}-${item.grade}`}
                                    onToggle={() =>
                                        setExpandedCard((prev) =>
                                            prev === `${item.subject}-${item.grade}`
                                                ? null
                                                : `${item.subject}-${item.grade}`
                                        )
                                    }
                                />
                            ))
                        ) : (
                            <div className="col-span-full text-center py-8 text-slate-500">
                                No content matches the current filters
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Last Updated */}
            {metrics && (
                <p className="text-xs text-slate-400 text-right">
                    Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
                </p>
            )}
        </div>
    );
};

export default ContentQualityDashboard;
