import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import type { AssignmentStatus, Parent, ParentChildSnapshot } from '../../types';
import { fetchParentDashboardData } from '../../services/dashboardService';
import trackEvent from '../../lib/analytics';
import { assignModuleToStudents, fetchChildAssignments } from '../../services/assignmentService';
import { fetchCatalogModules } from '../../services/catalogService';

const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

const ParentDashboard: React.FC = () => {
  const { user } = useAuth();
  const parent = (user as Parent) ?? null;
  const queryClient = useQueryClient();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [moduleSearch, setModuleSearch] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [assignErrorMessage, setAssignErrorMessage] = useState<string | null>(null);

  const {
    data: dashboard,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['parent-dashboard', parent?.id],
    queryFn: () => fetchParentDashboardData({ ...(parent as Parent) }),
    enabled: Boolean(parent),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!dashboard?.children.length) return;
    if (!selectedChildId) {
      setSelectedChildId(dashboard.children[0].id);
      trackEvent('parent_dashboard_child_auto_select', {
        parentId: parent?.id,
        childId: dashboard.children[0].id,
      });
      return;
    }
    const exists = dashboard.children.some((child) => child.id === selectedChildId);
    if (!exists) {
      setSelectedChildId(dashboard.children[0].id);
    }
  }, [dashboard, selectedChildId, parent?.id]);

  const currentChild: ParentChildSnapshot | null = useMemo(() => {
    if (!dashboard?.children.length) return null;
    return (
      dashboard.children.find((child) => child.id === selectedChildId) ?? dashboard.children[0]
    );
  }, [dashboard, selectedChildId]);

  const familyActivityData = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.activitySeries.map((point) => ({
      label: new Date(point.date).toLocaleDateString(undefined, { weekday: 'short' }),
      lessons: point.lessonsCompleted,
      minutes: point.practiceMinutes,
    }));
  }, [dashboard]);

  const childMasteryData = useMemo(() => {
    if (!currentChild) return [];
    return currentChild.masteryBySubject.map((subject) => ({
      subject:
        subject.subject === 'social_studies'
          ? 'Social Studies'
          : subject.subject.charAt(0).toUpperCase() + subject.subject.slice(1),
      mastery: Math.round(subject.mastery),
    }));
  }, [currentChild]);

  const showSkeleton = isLoading && !dashboard;

  const childProgress = currentChild?.progressSummary;
  const completedLessons = childProgress?.completed ?? currentChild?.lessonsCompletedWeek ?? 0;
  const inProgressLessons = childProgress?.inProgress ?? 0;

  const modulesQuery = useQuery({
    queryKey: ['assignable-modules', moduleSearch],
    queryFn: () =>
      fetchCatalogModules({
        page: 1,
        pageSize: 6,
        sort: 'featured',
        search: moduleSearch || undefined,
      }),
    staleTime: 1000 * 60 * 10,
  });

  const moduleOptions = modulesQuery.data?.data ?? [];

  useEffect(() => {
    if (!moduleOptions.length) {
      return;
    }
    if (!moduleOptions.some((module) => module.id === selectedModuleId)) {
      setSelectedModuleId(moduleOptions[0].id);
    }
  }, [moduleOptions, selectedModuleId]);

  const {
    data: childAssignments,
    isFetching: assignmentsLoading,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ['child-assignments', selectedChildId],
    queryFn: () => fetchChildAssignments(selectedChildId ?? ''),
    enabled: Boolean(selectedChildId),
    staleTime: 1000 * 60,
  });

  const assignmentsList = childAssignments ?? [];

  const assignModuleMutation = useMutation({
    mutationFn: assignModuleToStudents,
    onSuccess: (result) => {
      setAssignMessage(
        `Assigned ${result.assignedStudents} learner${result.assignedStudents === 1 ? '' : 's'} (${result.lessonsAttached} lessons attached).`,
      );
      setAssignErrorMessage(null);
      setDueDate('');
      refetchAssignments();
      queryClient.invalidateQueries({ queryKey: ['parent-dashboard', parent?.id] });
    },
    onError: (error) => {
      console.error('[Assignments] failed to assign module', error);
      setAssignErrorMessage(error instanceof Error ? error.message : 'Unable to assign module.');
      setAssignMessage(null);
    },
  });

  const handleAssignModule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parent || !selectedChildId || !selectedModuleId || assignModuleMutation.isLoading) {
      if (!selectedChildId) {
        setAssignErrorMessage('Select a learner before assigning a module.');
      }
      return;
    }

    setAssignMessage(null);
    setAssignErrorMessage(null);

    const dueAtIso = dueDate ? new Date(`${dueDate}T23:59:00`).toISOString() : undefined;

    await assignModuleMutation.mutateAsync({
      moduleId: selectedModuleId,
      studentIds: [selectedChildId],
      creatorId: parent.id,
      creatorRole: 'parent',
      dueAt: dueAtIso,
    });

    trackEvent('parent_assign_module', {
      parentId: parent.id,
      studentId: selectedChildId,
      moduleId: selectedModuleId,
    });
    await refetch({ throwOnError: false });
  };

  const statusBadgeStyles: Record<AssignmentStatus, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    in_progress: 'bg-amber-100 text-amber-700',
    not_started: 'bg-slate-200 text-slate-600',
  };

  if (!parent) {
    return null;
  }

  const handleDownloadReport = () => {
    if (!dashboard?.downloadableReport) return;
    trackEvent('parent_dashboard_report_download', {
      parentId: parent.id,
      weekStart: dashboard.weeklyReport?.weekStart,
    });
    const blob = new Blob([dashboard.downloadableReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `elevated-weekly-report-${dashboard.weeklyReport?.weekStart ?? 'summary'}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-brand-violet to-brand-blue rounded-2xl p-6 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold mb-2">Family Command Center</h1>
                <p className="opacity-90">
                  Track progress, celebrate wins, and keep everyone aligned in one dashboard.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleDownloadReport}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors"
                  disabled={!dashboard?.downloadableReport}
                >
                  <Download className="h-4 w-4" />
                  <span>Download Weekly Report</span>
                </button>
                <button
                  onClick={() => {
                    trackEvent('parent_dashboard_refresh', { parentId: parent.id });
                    refetch({ throwOnError: false });
                  }}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors"
                  disabled={isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  <span>{isFetching ? 'Refreshing' : 'Refresh'}</span>
                </button>
                <button className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-colors">
                  <Bell className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="mb-8 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Heads up!</p>
              <p className="text-sm">
                We could not refresh the family insights. Displaying cached metrics instead.
              </p>
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex flex-wrap gap-4">
            {(dashboard?.children ?? []).map((child) => (
              <button
                key={child.id}
                onClick={() => {
                  setSelectedChildId(child.id);
                  trackEvent('parent_dashboard_child_select', { parentId: parent.id, childId: child.id });
                }}
                className={`flex items-center space-x-3 px-6 py-4 rounded-2xl transition-all ${
                  currentChild?.id === child.id
                    ? 'bg-white shadow-lg border-2 border-brand-teal'
                    : 'bg-white shadow-sm hover:shadow-md'
                }`}
              >
                <div className="w-10 h-10 bg-brand-violet rounded-full flex items-center justify-center text-white font-semibold">
                  {child.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">{child.name}</div>
                  <div className="text-sm text-gray-600">
                    Grade {child.grade} • Level {child.level}
                  </div>
                </div>
              </button>
            ))}
            {showSkeleton && (
              <>
                <SkeletonCard className="h-16 w-48" />
                <SkeletonCard className="h-16 w-48" />
              </>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          {showSkeleton ? (
            <>
              <SkeletonCard className="h-24" />
              <SkeletonCard className="h-24" />
              <SkeletonCard className="h-24" />
              <SkeletonCard className="h-24" />
            </>
          ) : (
            <>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-brand-blue">{currentChild?.level ?? '—'}</div>
                    <div className="text-sm text-gray-600">Current Level</div>
                  </div>
                  <div className="w-12 h-12 bg-brand-light-blue rounded-full flex items-center justify-center">
                    <Star className="h-6 w-6 text-brand-blue" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-brand-teal">{currentChild?.xp ?? '—'}</div>
                    <div className="text-sm text-gray-600">Total XP</div>
                  </div>
                  <div className="w-12 h-12 bg-brand-light-teal rounded-full flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-brand-teal" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-brand-violet">
                      {currentChild?.streakDays ?? '—'}
                    </div>
                    <div className="text-sm text-gray-600">Day Streak</div>
                  </div>
                  <div className="w-12 h-12 bg-brand-light-violet rounded-full flex items-center justify-center">
                    <div className="text-2xl">🔥</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{completedLessons}</div>
                    <div className="text-sm text-gray-600">Completed Lessons</div>
                    <p className="text-xs text-gray-500 mt-1">In progress: {inProgressLessons}</p>
                  </div>
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-gray-600" />
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Weekly Learning Activity</h3>
                <div className="text-sm text-gray-500 flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>Last 7 days</span>
                </div>
              </div>
              <div className="h-64">
                {showSkeleton ? (
                  <SkeletonCard className="h-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={familyActivityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF2FF" />
                      <XAxis dataKey="label" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', borderColor: '#E5E7EB' }}
                        labelStyle={{ color: '#1F2937', fontWeight: 600 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="minutes"
                        stroke="#33D9C1"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="lessons"
                        stroke="#6366F1"
                        strokeWidth={3}
                        strokeDasharray="4 4"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  Recent Activity • {currentChild?.name ?? '—'}
                </h3>
                <div className="flex items-center text-sm text-gray-500 space-x-2">
                  <Sparkles className="h-4 w-4" />
                  <span>AI-curated highlights</span>
                </div>
              </div>
              <div className="space-y-4">
                {showSkeleton ? (
                  <>
                    <SkeletonCard className="h-20" />
                    <SkeletonCard className="h-20" />
                  </>
                ) : (
                  (currentChild?.recentActivity ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border border-gray-200 rounded-xl"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-brand-light-teal rounded-full flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-brand-teal" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{item.description}</div>
                          <div className="text-sm text-gray-600">
                            {new Date(item.occurredAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-brand-teal font-medium">+{item.xp} XP</div>
                    </div>
                  ))
                )}
                {(currentChild?.recentActivity?.length ?? 0) === 0 && !showSkeleton && (
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                    <p className="text-sm text-gray-600">
                      We’ll surface highlights once new learning moments are completed.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <ClipboardList className="h-5 w-5 text-brand-blue" />
                  <h3 className="text-xl font-bold text-gray-900">Module Assignments</h3>
                </div>
                <button
                  type="button"
                  onClick={() => modulesQuery.refetch()}
                  className="p-2 rounded-full border border-slate-200 text-slate-500 hover:text-brand-blue hover:border-brand-blue/40 transition-colors"
                  disabled={modulesQuery.isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${modulesQuery.isFetching ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <form onSubmit={handleAssignModule} className="space-y-4">
                <div>
                  <label htmlFor="assignment-child" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Learner
                  </label>
                  <select
                    id="assignment-child"
                    value={selectedChildId ?? ''}
                    onChange={(event) => setSelectedChildId(event.target.value || null)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    disabled={showSkeleton || !dashboard?.children.length}
                  >
                    {(dashboard?.children ?? []).map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="assignment-module" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Module
                    </label>
                    <select
                      id="assignment-module"
                      value={selectedModuleId ?? ''}
                      onChange={(event) => setSelectedModuleId(Number(event.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      disabled={!moduleOptions.length || modulesQuery.isLoading}
                    >
                      {moduleOptions.map((module) => (
                        <option key={module.id} value={module.id}>
                          {module.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="assignment-due" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Due date (optional)
                    </label>
                    <input
                      id="assignment-due"
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="assignment-search" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Search library
                  </label>
                  <input
                    id="assignment-search"
                    type="search"
                    value={moduleSearch}
                    onChange={(event) => setModuleSearch(event.target.value)}
                    placeholder="Fractions, writing prompts, STEM"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedChildId || !selectedModuleId || assignModuleMutation.isLoading}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue/90 disabled:opacity-50"
                >
                  {assignModuleMutation.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Assigning…
                    </>
                  ) : (
                    'Assign module'
                  )}
                </button>
              </form>

              {assignMessage && (
                <p className="mt-3 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  {assignMessage}
                </p>
              )}
              {assignErrorMessage && (
                <p className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {assignErrorMessage}
                </p>
              )}

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Assignments for {currentChild?.name ?? '—'}
                  </h4>
                  <span className="text-xs text-gray-500">
                    {assignmentsList.length} total
                  </span>
                </div>
                {assignmentsLoading ? (
                  <SkeletonCard className="h-16" />
                ) : assignmentsList.length ? (
                  <ul className="space-y-3">
                    {assignmentsList.map((assignment) => (
                      <li
                        key={assignment.id}
                        className="rounded-xl border border-slate-200 px-4 py-3 flex items-start justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{assignment.title}</p>
                          <p className="text-xs text-gray-500">
                            {assignment.moduleTitle ?? 'Module'}
                            {assignment.dueAt ? ` • Due ${new Date(assignment.dueAt).toLocaleDateString()}` : ''}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${statusBadgeStyles[assignment.status]}`}
                        >
                          {assignment.status.replace('_', ' ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600">
                    No assignments yet. Pick a module and send it their way.
                  </p>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-brand-light-violet to-white rounded-2xl p-6 shadow-sm border border-brand-light-violet/40"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Sparkles className="h-5 w-5 text-brand-violet" />
                  <h3 className="text-xl font-bold text-gray-900">Weekly AI Summary</h3>
                </div>
                {dashboard?.weeklyReport?.aiGenerated && (
                  <span className="text-xs uppercase tracking-wide bg-white/30 px-2 py-1 rounded-full">
                    AI generated
                  </span>
                )}
              </div>
              {showSkeleton ? (
                <div className="space-y-3">
                  <SkeletonCard className="h-6" />
                  <SkeletonCard className="h-6" />
                  <SkeletonCard className="h-6" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-700 mb-4">
                    {dashboard?.weeklyReport?.summary ??
                      'Adaptive summary not available yet—complete a few lessons to train the AI.'}
                  </p>
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-brand-violet mb-2">Highlights</h4>
                    <ul className="space-y-2">
                      {(dashboard?.weeklyReport?.highlights ?? []).map((highlight, index) => (
                        <li key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                          <span className="mt-0.5 text-brand-violet">•</span>
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-brand-blue mb-2">Recommended Next Steps</h4>
                    <ul className="space-y-2">
                      {(dashboard?.weeklyReport?.recommendations ?? []).map((recommendation, index) => (
                        <li key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                          <span className="mt-0.5 text-brand-blue">→</span>
                          <span>{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Mastery by Subject • {currentChild?.name ?? '—'}
              </h3>
              <div className="h-60">
                {showSkeleton ? (
                  <SkeletonCard className="h-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={childMasteryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF2FF" />
                      <XAxis dataKey="subject" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', borderColor: '#E5E7EB' }}
                        labelStyle={{ color: '#1F2937', fontWeight: 600 }}
                      />
                      <Bar dataKey="mastery" fill="#971CB5" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {!showSkeleton && currentChild && (
                <div className="mt-4 text-xs text-gray-500">
                  Average goal progress {currentChild.goalProgress ? `${Math.round(currentChild.goalProgress)}%` : '—'} ·
                  Cohort delta {currentChild.cohortComparison ? `${currentChild.cohortComparison > 0 ? '+' : ''}${currentChild.cohortComparison}` : '—'}%
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Focus Areas</h3>
              <div className="space-y-3">
                {showSkeleton ? (
                  <>
                    <SkeletonCard className="h-14" />
                    <SkeletonCard className="h-14" />
                  </>
                ) : (
                  (currentChild?.focusAreas ?? []).map((area, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{area}</p>
                        <p className="text-xs text-gray-500">
                          AI recommends a practice set or concept review this week.
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {(currentChild?.focusAreas?.length ?? 0) === 0 && !showSkeleton && (
                  <p className="text-sm text-gray-600">
                    No focus flags this week—keep reinforcing the strengths!
                  </p>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Alert Center</h3>
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <div className="space-y-4">
                {showSkeleton ? (
                  <>
                    <SkeletonCard className="h-16" />
                    <SkeletonCard className="h-16" />
                  </>
                ) : (
                  (dashboard?.alerts ?? []).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border ${
                        alert.type === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : alert.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-blue-50 border-blue-200 text-blue-700'
                      }`}
                    >
                      <p className="text-sm font-semibold">{alert.message}</p>
                      <p className="text-xs mt-1 opacity-80">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
                {(dashboard?.alerts?.length ?? 0) === 0 && !showSkeleton && (
                  <p className="text-sm text-gray-600">
                    No alerts right now. We’ll notify you when the AI spots something important.
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;
