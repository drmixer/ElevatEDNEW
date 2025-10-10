import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Clock,
  Loader2,
  RefreshCw,
  Shield,
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
import type { Admin } from '../../types';
import { fetchAdminDashboardData } from '../../services/dashboardService';
import trackEvent from '../../lib/analytics';
import {
  assignModuleToStudents,
  fetchAdminAssignmentOverview,
  fetchAdminStudents,
} from '../../services/assignmentService';
import { fetchCatalogModules } from '../../services/catalogService';

const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const admin = (user as Admin) ?? null;
  const queryClient = useQueryClient();
  const [moduleSearch, setModuleSearch] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | 'all' | null>('all');
  const [dueDate, setDueDate] = useState('');
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const {
    data: dashboard,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-dashboard', admin?.id],
    queryFn: () => fetchAdminDashboardData({ ...(admin as Admin) }),
    enabled: Boolean(admin),
    staleTime: 1000 * 60 * 5,
  });

  const showSkeleton = isLoading && !dashboard;

  const modulesQuery = useQuery({
    queryKey: ['admin-modules', moduleSearch],
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
      setSelectedModuleId(null);
      return;
    }
    if (!moduleOptions.some((module) => module.id === selectedModuleId)) {
      setSelectedModuleId(moduleOptions[0].id);
    }
  }, [moduleOptions, selectedModuleId]);

  const studentsQuery = useQuery({
    queryKey: ['admin-students'],
    queryFn: fetchAdminStudents,
    staleTime: 1000 * 60 * 10,
  });

  const students = studentsQuery.data ?? [];

  const gradeOptions = useMemo(() => {
    const grades = new Set<number>();
    students.forEach((student) => {
      if (typeof student.grade === 'number') {
        grades.add(student.grade);
      }
    });
    return Array.from(grades).sort((a, b) => a - b);
  }, [students]);

  const assignmentsQuery = useQuery({
    queryKey: ['admin-assignments-overview'],
    queryFn: fetchAdminAssignmentOverview,
    staleTime: 1000 * 60,
  });

  const assignmentsOverview = assignmentsQuery.data ?? [];

  const targetedStudentsCount = useMemo(() => {
    if (selectedGrade === 'all' || selectedGrade == null) {
      return students.length;
    }
    return students.filter((student) => student.grade === selectedGrade).length;
  }, [students, selectedGrade]);

  const assignModuleMutation = useMutation({
    mutationFn: assignModuleToStudents,
    onSuccess: (result) => {
      setAssignMessage(
        `Assigned ${result.assignedStudents} learners (${result.lessonsAttached} lessons linked).`,
      );
      setAssignError(null);
      setDueDate('');
      assignmentsQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard', admin?.id] });
    },
    onError: (error) => {
      console.error('[Admin] Failed to assign module', error);
      setAssignError(error instanceof Error ? error.message : 'Unable to assign module.');
      setAssignMessage(null);
    },
  });

  const handleAdminAssign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!admin || !selectedModuleId || assignModuleMutation.isLoading) {
      if (!selectedModuleId) {
        setAssignError('Select a module to assign.');
      }
      return;
    }

    const targetStudents =
      selectedGrade === 'all' || selectedGrade == null
        ? students
        : students.filter((student) => student.grade === selectedGrade);

    if (!targetStudents.length) {
      setAssignError('No learners match the selected grade cohort.');
      return;
    }

    setAssignMessage(null);
    setAssignError(null);

    const dueAtIso = dueDate ? new Date(`${dueDate}T23:59:00`).toISOString() : undefined;

    await assignModuleMutation.mutateAsync({
      moduleId: selectedModuleId,
      studentIds: targetStudents.map((student) => student.id),
      creatorId: admin.id,
      creatorRole: 'admin',
      dueAt: dueAtIso,
    });

    trackEvent('admin_assign_module', {
      adminId: admin.id,
      moduleId: selectedModuleId,
      grade: selectedGrade,
      studentCount: targetStudents.length,
    });
    await refetch({ throwOnError: false });
  };

  const growthData = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.growthSeries.map((point) => ({
      label: new Date(point.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      newStudents: point.newStudents,
      activeStudents: point.activeStudents,
    }));
  }, [dashboard]);

  const subjectPerformanceData = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.subjectPerformance.map((subject) => ({
      subject:
        subject.subject === 'social_studies'
          ? 'Social Studies'
          : subject.subject.charAt(0).toUpperCase() + subject.subject.slice(1),
      mastery: Math.round(subject.mastery),
      trend: subject.trend,
    }));
  }, [dashboard]);

  if (!admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-brand-teal to-brand-blue rounded-2xl p-6 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold mb-2">Platform Control Tower</h1>
                <p className="opacity-90">
                  Monitor growth, learner outcomes, and operational health across ElevatED.
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    trackEvent('admin_dashboard_refresh', { adminId: admin.id });
                    refetch({ throwOnError: false });
                  }}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors"
                  disabled={isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  <span>{isFetching ? 'Refreshing' : 'Refresh'}</span>
                </button>
                <div className="text-right">
                  <div className="text-sm opacity-90">{admin.title ?? 'Platform Admin'}</div>
                  <div className="text-xs opacity-70">{admin.email}</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="mb-8 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Analytics temporarily unavailable</p>
              <p className="text-sm">We could not refresh platform analytics. Showing cached metrics instead.</p>
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8"
        >
          {showSkeleton ? (
            <>
              <SkeletonCard className="h-24" />
              <SkeletonCard className="h-24" />
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
                    <p className="text-xs uppercase tracking-wide text-gray-500">Students</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {dashboard?.metrics.totalStudents ?? 0}
                    </p>
                  </div>
                  <Users className="h-6 w-6 text-brand-blue" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Parents</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {dashboard?.metrics.totalParents ?? 0}
                    </p>
                  </div>
                  <ClipboardList className="h-6 w-6 text-brand-teal" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Active 7d</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {dashboard?.metrics.activeStudents7d ?? 0}
                    </p>
                  </div>
                  <Activity className="h-6 w-6 text-brand-violet" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Practice Minutes</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {dashboard?.metrics.practiceMinutes7d ?? 0}
                    </p>
                  </div>
                  <Clock className="h-6 w-6 text-brand-blue" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Assessments 30d</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {dashboard?.metrics.assessments30d ?? 0}
                    </p>
                  </div>
                  <Shield className="h-6 w-6 text-brand-teal" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Active Plans</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {dashboard?.metrics.activeSubscriptions ?? 0}
                    </p>
                  </div>
                  <BarChart3 className="h-6 w-6 text-brand-violet" />
                </div>
              </div>
              {dashboard?.metrics.lessonCompletionRate != null && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Completion Rate</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {Math.round((dashboard.metrics.lessonCompletionRate ?? 0) * 100)}%
                      </p>
                    </div>
                    <ClipboardList className="h-6 w-6 text-brand-blue" />
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Growth & Engagement</h3>
                <p className="text-sm text-gray-500">Trailing 8 weeks</p>
              </div>
              <div className="h-72">
                {showSkeleton ? (
                  <SkeletonCard className="h-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF2FF" />
                      <XAxis dataKey="label" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', borderColor: '#E5E7EB' }}
                        labelStyle={{ color: '#1F2937', fontWeight: 600 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="activeStudents"
                        stroke="#33D9C1"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="newStudents"
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
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Operational Alerts</h3>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div className="space-y-4">
                {showSkeleton
                  ? [0, 1, 2].map((idx) => <SkeletonCard key={idx} className="h-20" />)
                  : (dashboard?.alerts ?? []).map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 border rounded-xl ${
                          alert.severity === 'high'
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : alert.severity === 'medium'
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-blue-200 bg-blue-50 text-blue-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold">{alert.title}</p>
                          <span className="text-xs uppercase tracking-wide">
                            {alert.severity} priority
                          </span>
                        </div>
                        <p className="text-sm">{alert.description}</p>
                        <p className="text-xs opacity-80 mt-2">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
              </div>
            </motion.div>
          </div>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <ClipboardList className="h-5 w-5 text-brand-blue" />
                  <h3 className="text-xl font-bold text-gray-900">Assign Modules</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    modulesQuery.refetch();
                    studentsQuery.refetch();
                  }}
                  className="p-2 rounded-full border border-slate-200 text-slate-500 hover:text-brand-blue hover:border-brand-blue/40 transition-colors"
                  disabled={modulesQuery.isFetching || studentsQuery.isFetching}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      modulesQuery.isFetching || studentsQuery.isFetching ? 'animate-spin' : ''
                    }`}
                  />
                </button>
              </div>
              <form onSubmit={handleAdminAssign} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="admin-grade" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Grade cohort
                    </label>
                    <select
                      id="admin-grade"
                      value={selectedGrade ?? 'all'}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSelectedGrade(value === 'all' ? 'all' : Number(value));
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      disabled={studentsQuery.isLoading}
                    >
                      <option value="all">All grades ({students.length})</option>
                      {gradeOptions.map((grade) => (
                        <option key={grade} value={grade}>
                          Grade {grade}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="admin-module" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Module
                    </label>
                    <select
                      id="admin-module"
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="admin-module-search" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Search library
                    </label>
                    <input
                      id="admin-module-search"
                      type="search"
                      value={moduleSearch}
                      onChange={(event) => setModuleSearch(event.target.value)}
                      placeholder="STEM, writing prompts, algebra"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-due-date" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Due date (optional)
                    </label>
                    <input
                      id="admin-due-date"
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!selectedModuleId || targetedStudentsCount === 0 || assignModuleMutation.isLoading}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue/90 disabled:opacity-50"
                >
                  {assignModuleMutation.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Assigning…
                    </>
                  ) : (
                    'Assign to cohort'
                  )}
                </button>
              </form>
              <p className="mt-2 text-xs text-gray-500">
                Targeting {targetedStudentsCount} learner{targetedStudentsCount === 1 ? '' : 's'}
              </p>
              {assignMessage && (
                <p className="mt-3 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  {assignMessage}
                </p>
              )}
              {assignError && (
                <p className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {assignError}
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Assignment Tracker</h3>
                <button
                  type="button"
                  onClick={() => assignmentsQuery.refetch()}
                  className="p-2 rounded-full border border-slate-200 text-slate-500 hover:text-brand-blue hover:border-brand-blue/40 transition-colors"
                  disabled={assignmentsQuery.isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${assignmentsQuery.isFetching ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {assignmentsQuery.isLoading ? (
                <SkeletonCard className="h-24" />
              ) : assignmentsOverview.length ? (
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Module</th>
                        <th className="px-4 py-2 text-left font-medium">Assigned</th>
                        <th className="px-4 py-2 text-left font-medium">Completed</th>
                        <th className="px-4 py-2 text-left font-medium">In progress</th>
                        <th className="px-4 py-2 text-left font-medium">Not started</th>
                        <th className="px-4 py-2 text-left font-medium">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentsOverview.map((assignment) => (
                        <tr key={assignment.assignmentId} className="border-t border-slate-100">
                          <td className="px-4 py-2">
                            <div className="font-semibold text-gray-900">{assignment.moduleTitle ?? 'Module'}</div>
                            <div className="text-xs text-gray-500">#{assignment.assignmentId}</div>
                          </td>
                          <td className="px-4 py-2 text-gray-800">{assignment.assignedCount}</td>
                          <td className="px-4 py-2 text-emerald-600">{assignment.completedCount}</td>
                          <td className="px-4 py-2 text-amber-600">{assignment.inProgressCount}</td>
                          <td className="px-4 py-2 text-slate-600">{assignment.notStartedCount}</td>
                          <td className="px-4 py-2 text-gray-500">
                            {assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  No module assignments yet. Use the form above to push targeted learning plans.
                </p>
              )}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Subject Mastery Overview</h3>
              <div className="h-72">
                {showSkeleton ? (
                  <SkeletonCard className="h-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectPerformanceData}>
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
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Top Movers This Week</h3>
              <div className="space-y-4">
                {showSkeleton
                  ? [0, 1, 2].map((idx) => <SkeletonCard key={idx} className="h-20" />)
                  : (dashboard?.topStudents ?? []).map((studentEntry) => (
                      <div
                        key={studentEntry.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-xl"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">{studentEntry.name}</p>
                          <p className="text-sm text-gray-600">Grade {studentEntry.grade}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-brand-teal">
                            +{studentEntry.xpEarnedWeek} XP
                          </p>
                          <p className="text-xs text-gray-500">
                            {studentEntry.lessonsCompletedWeek} lessons
                          </p>
                        </div>
                      </div>
                    ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
