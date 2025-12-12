import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Beaker,
  ClipboardList,
  Clock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
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
import type { AccountDeletionRequest, Admin } from '../../types';
import { fetchAdminDashboardData } from '../../services/dashboardService';
import trackEvent from '../../lib/analytics';
import {
  assignModuleToStudents,
  fetchAdminAssignmentOverview,
  fetchAdminStudents,
} from '../../services/assignmentService';
import { fetchCatalogModules } from '../../services/catalogService';
import {
  logAdminAuditEvent,
  fetchOpsMetrics,
  updatePlatformConfig,
  fetchPlatformConfig,
  fetchAccountDeletionRequests,
  resolveAccountDeletionRequest,
  processAccountDeletionQueue,
  type OpsMetricsSnapshot,
} from '../../services/adminService';
import {
  fetchTutorReports,
  updateTutorReportStatus,
  type TutorAdminReport,
  type TutorReportStatus,
} from '../../services/tutorAdminService';

const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

const XP_PROFILES: Record<
  'conservative' | 'standard' | 'boosted',
  { label: string; values: Record<'xp.multiplier' | 'xp.difficulty_bonus_multiplier' | 'xp.accuracy_bonus_multiplier' | 'xp.streak_bonus_multiplier', number> }
> = {
  conservative: {
    label: 'Conservative',
    values: {
      'xp.multiplier': 0.9,
      'xp.difficulty_bonus_multiplier': 0.9,
      'xp.accuracy_bonus_multiplier': 0.9,
      'xp.streak_bonus_multiplier': 0.85,
    },
  },
  standard: {
    label: 'Standard',
    values: {
      'xp.multiplier': 1,
      'xp.difficulty_bonus_multiplier': 1,
      'xp.accuracy_bonus_multiplier': 1,
      'xp.streak_bonus_multiplier': 1,
    },
  },
  boosted: {
    label: 'Boosted',
    values: {
      'xp.multiplier': 1.2,
      'xp.difficulty_bonus_multiplier': 1.1,
      'xp.accuracy_bonus_multiplier': 1.1,
      'xp.streak_bonus_multiplier': 1.15,
    },
  },
};
type XpProfileKey = keyof typeof XP_PROFILES;

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
  const [auditLogged, setAuditLogged] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | TutorReportStatus>('open');
  const [configKey, setConfigKey] = useState('adaptive.target_accuracy_max');
  const [configValue, setConfigValue] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const BILLING_FLAG_KEY = 'billing.require_subscription';
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);

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

  const moduleOptions = useMemo(
    () => modulesQuery.data?.data ?? [],
    [modulesQuery.data],
  );

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

  const students = useMemo(
    () => studentsQuery.data ?? [],
    [studentsQuery.data],
  );

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

  const deletionRequestsQuery = useQuery({
    queryKey: ['admin-account-deletion-requests'],
    queryFn: fetchAccountDeletionRequests,
    enabled: Boolean(admin),
    staleTime: 30 * 1000,
  });

  const billingConfigQuery = useQuery({
    queryKey: ['admin-platform-config', admin?.id],
    queryFn: () => fetchPlatformConfig([BILLING_FLAG_KEY]),
    enabled: Boolean(admin),
    staleTime: 1000 * 60 * 5,
  });

  const assignmentsOverview = assignmentsQuery.data ?? [];

  const opsMetricsQuery = useQuery({
    queryKey: ['admin-ops-metrics'],
    queryFn: fetchOpsMetrics,
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });
  const opsMetrics: OpsMetricsSnapshot | undefined = opsMetricsQuery.data;
  const adaptiveHealth = useMemo(() => {
    if (!opsMetrics) {
      return { ok: false, status: 'unknown', label: 'No data', risk: 'unknown' } as const;
    }
    const success = opsMetrics.totals.tutor_success ?? 0;
    const errors = opsMetrics.totals.tutor_error ?? 0;
    const safety = opsMetrics.totals.tutor_safety_block ?? 0;
    const pathUpdates = opsMetrics.totals.path_progress ?? 0;
    const errorRate = success ? errors / Math.max(success, 1) : 0;
    const safetyRate = success ? safety / Math.max(success, 1) : 0;
    const status =
      errorRate > 0.15 || safetyRate > 0.2
        ? 'at risk'
        : errorRate > 0.08 || safetyRate > 0.1
          ? 'watch'
          : 'healthy';
    return {
      ok: status === 'healthy',
      status,
      label: status === 'healthy' ? 'Adaptive services healthy' : status === 'watch' ? 'Watch adaptive signals' : 'At risk',
      success,
      errors,
      safety,
      pathUpdates,
      errorRate: Math.round(errorRate * 100),
      safetyRate: Math.round(safetyRate * 100),
    };
  }, [opsMetrics]);

  const tutorReportsQuery = useQuery({
    queryKey: ['admin-tutor-reports', reportStatusFilter],
    queryFn: () => fetchTutorReports(reportStatusFilter === 'all' ? undefined : reportStatusFilter),
    staleTime: 30 * 1000,
  });

  const updateTutorReportStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TutorReportStatus }) =>
      updateTutorReportStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tutor-reports'] });
    },
  });

  const targetedStudentsCount = useMemo(() => {
    if (selectedGrade === 'all' || selectedGrade == null) {
      return students.length;
    }
    return students.filter((student) => student.grade === selectedGrade).length;
  }, [students, selectedGrade]);

  const billingRequired = useMemo(() => {
    const raw = billingConfigQuery.data?.[BILLING_FLAG_KEY];
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
      const lowered = raw.toLowerCase();
      if (lowered === 'false' || lowered === '0') return false;
      if (lowered === 'true' || lowered === '1') return true;
    }
    return true; // default to requiring billing unless explicitly disabled
  }, [billingConfigQuery.data]);

  useEffect(() => {
    if (!admin || auditLogged || studentsQuery.isLoading || assignmentsQuery.isLoading) {
      return;
    }
    logAdminAuditEvent(admin.id, 'view_student_data', {
      surface: 'admin_dashboard',
      student_count: students.length,
      assignments_preview: assignmentsOverview.length,
    }).catch(() => {
      // Logging failure should not block UI.
    });
    setAuditLogged(true);
  }, [
    admin,
    auditLogged,
    students.length,
    assignmentsOverview.length,
    studentsQuery.isLoading,
    assignmentsQuery.isLoading,
  ]);

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

  const handleConfigSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConfigMessage(null);
    setConfigSaving(true);
    try {
      const parsed =
        configValue.trim().length && !Number.isNaN(Number(configValue))
          ? Number(configValue)
          : configValue.trim().length
            ? configValue
            : null;
      await updatePlatformConfig(configKey, parsed);
      setConfigMessage('Config updated. Changes take effect on next fetch.');
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : 'Unable to update config.');
    } finally {
      setConfigSaving(false);
    }
  };

  const applyXpProfile = async (profileKey: XpProfileKey) => {
    const profile = XP_PROFILES[profileKey];
    setConfigSaving(true);
    setConfigMessage(null);
    try {
      await Promise.all(
        Object.entries(profile.values).map(([key, value]) => updatePlatformConfig(key, value)),
      );
      setConfigMessage(`${profile.label} XP profile applied.`);
      trackEvent('admin_xp_profile_applied', { adminId: admin?.id, profile: profileKey });
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : 'Unable to apply XP profile right now.');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleBillingToggle = async () => {
    if (!admin) return;
    setBillingSaving(true);
    setBillingMessage(null);
    try {
      await updatePlatformConfig(BILLING_FLAG_KEY, !billingRequired);
      await logAdminAuditEvent(admin.id, 'toggle_billing_requirement', {
        require_subscription: !billingRequired,
      });
      setBillingMessage(
        !billingRequired
          ? 'Billing requirement enabled. New users will be asked to choose a plan.'
          : 'Billing requirement disabled. Users can sign up and use the product without choosing a plan.',
      );
      billingConfigQuery.refetch().catch(() => undefined);
    } catch (error) {
      setBillingMessage(error instanceof Error ? error.message : 'Unable to update billing toggle.');
    } finally {
      setBillingSaving(false);
    }
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

  const successMetrics = dashboard?.successMetrics ?? null;
  const successCards = useMemo(
    () => [
      {
        key: 'alerts',
        label: 'Alert response',
        value:
          successMetrics?.alertResolutionHoursAvg != null
            ? `${successMetrics.alertResolutionHoursAvg}h`
            : '—',
        detail:
          successMetrics?.alertResolutionHoursAvg == null
            ? 'Needs analytics ingestion'
            : `Avg over ${successMetrics.lookbackDays}d`,
        tooltip: 'Average time from first seeing an alert to marking it resolved.',
        icon: AlertTriangle,
      },
      {
        key: 'diagnostics',
        label: 'Diagnostics complete',
        value:
          successMetrics?.diagnosticCompletionRate != null
            ? `${successMetrics.diagnosticCompletionRate}%`
            : '—',
        detail:
          successMetrics
            ? `${successMetrics.diagnosticsCompleted}/${successMetrics.diagnosticsTotal} students`
            : 'Needs analytics ingestion',
        tooltip: 'Percent of learners who have completed a diagnostic at least once.',
        icon: CheckCircle2,
      },
      {
        key: 'assignments',
        label: 'Assignment follow-through',
        value:
          successMetrics?.assignmentFollowThroughRate != null
            ? `${successMetrics.assignmentFollowThroughRate}%`
            : '—',
        detail:
          successMetrics
            ? `${successMetrics.assignmentsCompleted}/${successMetrics.assignmentsTotal} assignments ${successMetrics.lookbackDays}d`
            : 'Needs analytics ingestion',
        tooltip: 'Share of assigned modules completed in the last lookback window.',
        icon: ClipboardList,
      },
      {
        key: 'accuracy',
        label: 'Weekly accuracy delta',
        value:
          successMetrics?.weeklyAccuracyDeltaAvg != null
            ? `${successMetrics.weeklyAccuracyDeltaAvg > 0 ? '+' : ''}${successMetrics.weeklyAccuracyDeltaAvg} pts`
            : '—',
        detail:
          successMetrics?.weeklyAccuracyDeltaAvg == null
            ? 'Needs analytics ingestion'
            : `Avg over ${successMetrics.lookbackDays}d`,
        tooltip: 'Average change in accuracy vs prior week across learners.',
        icon: BarChart3,
      },
      {
        key: 'plan',
        label: 'Daily plan completion',
        value:
          successMetrics?.dailyPlanCompletionRateAvg != null
            ? `${successMetrics.dailyPlanCompletionRateAvg}%`
            : '—',
        detail:
          successMetrics?.dailyPlanCompletionRateAvg == null
            ? 'Needs analytics ingestion'
            : `Avg over ${successMetrics.lookbackDays}d`,
        tooltip: 'Average percent of daily plans completed by learners.',
        icon: Clock,
      },
    ],
    [successMetrics],
  );

  const resolveDeletionMutation = useMutation({
    mutationFn: (payload: { id: number; status: 'completed' | 'canceled' }) =>
      resolveAccountDeletionRequest(payload.id, payload.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-account-deletion-requests'] });
    },
  });

  const processDeletionQueueMutation = useMutation({
    mutationFn: processAccountDeletionQueue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-account-deletion-requests'] });
    },
  });

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
              transition={{ delay: 0.25 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Success Metrics</h3>
                  <p className="text-sm text-slate-600">
                    Outcomes snapshot {successMetrics ? `• last ${successMetrics.lookbackDays} days` : ''}
                  </p>
                </div>
                <Activity className="h-5 w-5 text-brand-violet" />
              </div>
              {showSkeleton ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <SkeletonCard key={idx} className="h-24" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {successCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div
                        key={card.key}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1"
                        title={card.tooltip}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">
                            {card.label}
                          </p>
                          <Icon className="h-4 w-4 text-slate-500" />
                        </div>
                        <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                        <p className="text-[11px] text-slate-600">{card.detail}</p>
                      </div>
                    );
                  })}
                </div>
              )}
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

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Adaptive Health</h3>
                  <p className="text-sm text-slate-600">Signals from tutor and path updates</p>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full border ${
                    adaptiveHealth.status === 'healthy'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : adaptiveHealth.status === 'watch'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {adaptiveHealth.label}
                </span>
              </div>
              {opsMetrics ? (
                <div className="grid md:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">Tutor success</p>
                    <p className="text-2xl font-bold text-slate-900">{adaptiveHealth.success}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">Tutor errors</p>
                    <p className="text-2xl font-bold text-rose-600">{adaptiveHealth.errors}</p>
                    <p className="text-[11px] text-rose-600">{adaptiveHealth.errorRate}% of successes</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">Safety blocks</p>
                    <p className="text-2xl font-bold text-amber-700">{adaptiveHealth.safety}</p>
                    <p className="text-[11px] text-amber-700">{adaptiveHealth.safetyRate}% of successes</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">Path updates</p>
                    <p className="text-2xl font-bold text-slate-900">{adaptiveHealth.pathUpdates ?? 0}</p>
                    <p className="text-[11px] text-slate-500">Up Next refreshes</p>
                  </div>
                </div>
              ) : (
                <SkeletonCard className="h-20" />
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.36 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Ops Signals</h3>
                  <p className="text-sm text-slate-600">Last {Math.round((opsMetrics?.windowMs ?? 3600000) / 60000)} min</p>
                </div>
                <button
                  type="button"
                  onClick={() => opsMetricsQuery.refetch()}
                  className="p-2 rounded-full border border-slate-200 text-slate-500 hover:text-brand-blue hover:border-brand-blue/40 transition-colors"
                  disabled={opsMetricsQuery.isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${opsMetricsQuery.isFetching ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {opsMetricsQuery.isLoading ? (
                <SkeletonCard className="h-28" />
              ) : opsMetrics ? (
                <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {([
                    { label: 'Tutor successes', value: opsMetrics.totals.tutor_success, tone: 'default' },
                    { label: 'Tutor errors', value: opsMetrics.totals.tutor_error, tone: 'warn' },
                    { label: 'Safety blocks', value: opsMetrics.totals.tutor_safety_block, tone: 'amber' },
                    { label: 'Plan/limit blocks', value: opsMetrics.totals.tutor_plan_limit, tone: 'amber' },
                    { label: 'Tutor latency pings', value: opsMetrics.totals.tutor_latency, tone: 'default' },
                    { label: 'API failures', value: opsMetrics.totals.api_failure, tone: 'warn' },
                    { label: 'Slow APIs', value: opsMetrics.totals.api_slow, tone: 'default' },
                    { label: 'Path progression', value: opsMetrics.totals.path_progress, tone: 'default' },
                    { label: 'XP events', value: opsMetrics.totals.xp_rate, tone: 'default' },
                  ] as const).map((stat) => {
                    const tone =
                      stat.tone === 'warn'
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : stat.tone === 'amber'
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-slate-50 border-slate-200 text-slate-800';
                      return (
                        <div key={stat.label} className={`rounded-xl border p-3 ${tone}`}>
                          <p className="text-xs uppercase tracking-wide font-semibold">{stat.label}</p>
                          <p className="text-2xl font-bold mt-1">{stat.value}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">Top safety reasons</p>
                      {opsMetrics.topSafetyReasons.length ? (
                        <ul className="space-y-1 text-sm text-slate-800">
                          {opsMetrics.topSafetyReasons.map((item) => (
                            <li key={item.label} className="flex justify-between">
                              <span>{item.label}</span>
                              <span className="font-semibold">{item.count}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-600">No safety blocks.</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">Plan/limit triggers</p>
                      {opsMetrics.topPlanLimitReasons.length ? (
                        <ul className="space-y-1 text-sm text-slate-800">
                          {opsMetrics.topPlanLimitReasons.map((item) => (
                            <li key={item.label} className="flex justify-between">
                              <span>{item.label}</span>
                              <span className="font-semibold">{item.count}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-600">No plan/limit hits.</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">API failures</p>
                      {opsMetrics.apiFailuresByRoute.length ? (
                        <ul className="space-y-1 text-sm text-slate-800">
                          {opsMetrics.apiFailuresByRoute.map((item) => (
                            <li key={item.label} className="flex justify-between">
                              <span className="truncate max-w-[180px]" title={item.label}>
                                {item.label}
                              </span>
                              <span className="font-semibold">{item.count}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-600">No failures in window.</p>
                      )}
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">Path progression/drop-offs</p>
                      {opsMetrics.pathEventsByLabel.length ? (
                        <ul className="space-y-1 text-sm text-slate-800">
                          {opsMetrics.pathEventsByLabel.map((item) => (
                            <li key={item.label} className="flex justify-between">
                              <span>{item.label}</span>
                              <span className="font-semibold">{item.count}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-600">No path signals in window.</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">XP accrual events</p>
                      {opsMetrics.xpEventsBySource.length ? (
                        <ul className="space-y-1 text-sm text-slate-800">
                          {opsMetrics.xpEventsBySource.map((item) => (
                            <li key={item.label} className="flex justify-between">
                              <span>{item.label}</span>
                              <span className="font-semibold">{item.count}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-600">No XP events in window.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">Recent signals</p>
                    {opsMetrics.recent.length ? (
                      <ul className="divide-y divide-slate-100">
                        {opsMetrics.recent.slice(0, 6).map((event, idx) => (
                          <li key={idx} className="py-2 text-sm flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900">{event.type}</p>
                              <p className="text-xs text-slate-600">
                                {event.reason ? `Reason: ${event.reason} • ` : ''}
                                {event.route ? `Route: ${event.route}` : ''}
                                {event.status ? ` (${event.status})` : ''}
                                {event.plan ? ` • Plan: ${event.plan}` : ''}
                                {event.durationMs ? ` • ${Math.round(event.durationMs)}ms` : ''}
                              </p>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-600">No signals yet.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600">Unable to load ops signals.</p>
              )}
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
              transition={{ delay: 0.42 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Beaker className="h-5 w-5 text-brand-violet" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Config toggles (A/B)</h3>
                    <p className="text-sm text-slate-600">Adjust adaptive targets, XP multipliers, tutor timeout.</p>
                  </div>
                </div>
              </div>
              <form className="grid gap-3 md:grid-cols-[1.5fr_1fr_auto] items-center" onSubmit={handleConfigSave}>
                <input
                  type="text"
                  value={configKey}
                  onChange={(e) => setConfigKey(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus-ring"
                  placeholder="adaptive.target_accuracy_max"
                />
                <input
                  type="text"
                  value={configValue}
                  onChange={(e) => setConfigValue(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus-ring"
                  placeholder="e.g. 0.8"
                />
                <button
                  type="submit"
                  disabled={configSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-blue text-white px-3 py-2 text-sm font-semibold hover:bg-brand-blue/90 disabled:opacity-60 focus-ring"
                >
                  {configSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </button>
              </form>
              {configMessage && <p className="text-xs text-slate-600 mt-2">{configMessage}</p>}
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">XP profiles</p>
                  <span className="text-[11px] text-slate-500">Sets multipliers together</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(XP_PROFILES).map(([key, profile]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyXpProfile(key as XpProfileKey)}
                      disabled={configSaving}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-blue/50 hover:text-brand-blue focus-ring disabled:opacity-50"
                    >
                      {profile.label} ({profile.values['xp.multiplier']}x)
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-600">
                  Applies xp.multiplier, xp.difficulty_bonus_multiplier, xp.accuracy_bonus_multiplier, and
                  xp.streak_bonus_multiplier together so you can tune reward feel without code changes.
                </p>
              </div>
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Billing requirement</p>
                    <p className="text-xs text-amber-800">
                      {billingConfigQuery.isLoading
                        ? 'Loading billing status…'
                        : billingRequired
                          ? 'Billing ON: new users will be asked to pick a plan/checkout.'
                          : 'Billing OFF: users can sign up and use without choosing a plan.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBillingToggle}
                    disabled={billingSaving || billingConfigQuery.isLoading}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold focus-ring ${
                      billingRequired
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {billingSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {billingRequired ? 'Turn billing off' : 'Turn billing on'}
                  </button>
                </div>
                <p className="text-[11px] text-amber-800">
                  Toggle to bypass billing during testing/soft launch. Uses platform config key `{BILLING_FLAG_KEY}` and
                  is logged in audit trail.
                </p>
                {billingMessage && (
                  <p className="text-[11px] text-amber-900 bg-white/60 border border-amber-100 rounded-lg px-3 py-2">
                    {billingMessage}
                  </p>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-3 leading-snug">
                Keys: adaptive.target_accuracy_min/max, adaptive.max_remediation_pending, adaptive.max_practice_pending,
                adaptive.struggle_consecutive_misses, xp.multiplier, xp.difficulty_bonus_multiplier,
                xp.accuracy_bonus_multiplier, xp.streak_bonus_multiplier, tutor.timeout_ms
              </p>
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
              transition={{ delay: 0.55 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Tutor Answer Reports</h3>
                  <p className="text-sm text-slate-600">Flagged answers that need human review.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={reportStatusFilter}
                    onChange={(event) =>
                      setReportStatusFilter((event.target.value as 'all' | TutorReportStatus) ?? 'all')
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                  >
                    <option value="all">All</option>
                    <option value="open">Open</option>
                    <option value="in_review">In review</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => tutorReportsQuery.refetch()}
                    className="p-2 rounded-full border border-slate-200 text-slate-500 hover:text-brand-blue hover:border-brand-blue/40 transition-colors"
                    disabled={tutorReportsQuery.isFetching}
                  >
                    <RefreshCw className={`h-4 w-4 ${tutorReportsQuery.isFetching ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {tutorReportsQuery.isLoading ? (
                <SkeletonCard className="h-32" />
              ) : (tutorReportsQuery.data ?? []).length ? (
                <div className="space-y-3">
                  {(tutorReportsQuery.data as TutorAdminReport[]).map((report) => (
                    <div key={report.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Report #{report.id}{' '}
                            <span className="text-xs text-gray-500">
                              {report.created_at ? new Date(report.created_at).toLocaleString() : ''}
                            </span>
                          </p>
                          <p className="text-xs text-slate-600">
                            Reason: {report.reason ?? 'unknown'} • Student {report.student_id ?? 'N/A'} • Conversation{' '}
                            {report.conversation_id ?? 'N/A'}
                          </p>
                        </div>
                        <select
                          value={report.status}
                          onChange={(event) =>
                            updateTutorReportStatusMutation.mutate({
                              id: report.id,
                              status: event.target.value as TutorReportStatus,
                            })
                          }
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                          disabled={updateTutorReportStatusMutation.isLoading}
                        >
                          <option value="open">Open</option>
                          <option value="in_review">In review</option>
                          <option value="resolved">Resolved</option>
                          <option value="dismissed">Dismissed</option>
                        </select>
                      </div>
                      <div className="mt-2 rounded-lg bg-white border border-slate-200 p-3 text-sm text-slate-800 whitespace-pre-wrap">
                        {report.answer ?? 'No answer captured.'}
                      </div>
                      {report.reviewed_by && (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Reviewed by {report.reviewed_by} {report.reviewed_at ? `• ${new Date(report.reviewed_at).toLocaleString()}` : ''}
                        </p>
                      )}
                      {updateTutorReportStatusMutation.isError && (
                        <p className="mt-2 text-xs text-rose-700">
                          {(updateTutorReportStatusMutation.error as Error).message ?? 'Failed to update status.'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">No tutor reports yet. New reports will appear here.</p>
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mt-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Account deletion requests</h3>
              <p className="text-sm text-slate-600">
                Parents can request deletion for themselves and linked students. Process or cancel below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => deletionRequestsQuery.refetch()}
              className="p-2 rounded-full border border-slate-200 text-slate-500 hover:text-brand-blue hover:border-brand-blue/40 transition-colors"
              disabled={deletionRequestsQuery.isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${deletionRequestsQuery.isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => processDeletionQueueMutation.mutate()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue/90 disabled:opacity-60"
              disabled={processDeletionQueueMutation.isLoading}
            >
              {processDeletionQueueMutation.isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Process pending requests
                </>
              )}
            </button>
            {processDeletionQueueMutation.data && (
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                Processed {processDeletionQueueMutation.data.processed} pending; errors: {processDeletionQueueMutation.data.errors.length}
              </span>
            )}
            {processDeletionQueueMutation.isError && (
              <span className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                Failed to process queue.
              </span>
            )}
          </div>

          {deletionRequestsQuery.isLoading ? (
            <SkeletonCard className="h-20" />
          ) : (deletionRequestsQuery.data as AccountDeletionRequest[] | undefined)?.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Request</th>
                    <th className="px-4 py-2 text-left font-medium">Scope</th>
                    <th className="px-4 py-2 text-left font-medium">Students</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(deletionRequestsQuery.data as AccountDeletionRequest[]).map((request) => {
                    const isPending = request.status === 'pending';
                    return (
                      <tr key={request.id} className="border-t border-slate-100">
                        <td className="px-4 py-2">
                          <div className="font-semibold text-slate-900">#{request.id}</div>
                          <div className="text-xs text-slate-500">
                            {new Date(request.createdAt).toLocaleString()} • {request.requesterId}
                          </div>
                          {request.reason && <div className="text-xs text-slate-600 mt-1">{request.reason}</div>}
                        </td>
                        <td className="px-4 py-2 text-slate-800">
                          {request.scope === 'parent_and_students'
                            ? 'Parent + students'
                            : request.scope === 'parent_only'
                              ? 'Parent only'
                              : 'Students only'}
                        </td>
                        <td className="px-4 py-2 text-slate-800">{request.includeStudentIds.length || '—'}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              request.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : request.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {request.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => resolveDeletionMutation.mutate({ id: request.id, status: 'completed' })}
                              disabled={!isPending || resolveDeletionMutation.isLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-4 w-4" /> Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => resolveDeletionMutation.mutate({ id: request.id, status: 'canceled' })}
                              disabled={!isPending || resolveDeletionMutation.isLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" /> Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No deletion requests yet.</p>
          )}

          {resolveDeletionMutation.isError && (
            <p className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              Unable to update the request right now.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;
