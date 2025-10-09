import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardList,
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
import { Admin, AdminDashboardData } from '../../types';
import { fetchAdminDashboardData } from '../../services/dashboardService';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const admin = user as Admin | null;
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminDashboardData({ ...admin });
      setDashboard(data);
    } catch (err) {
      console.error('[AdminDashboard] load failed', err);
      setError('We could not refresh platform analytics. Showing cached metrics instead.');
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-brand-teal to-brand-blue rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-2">Platform Control Tower</h1>
                <p className="opacity-90">
                  Monitor growth, learner outcomes, and operational health across ElevatED.
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => loadDashboard()}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors"
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Refreshing' : 'Refresh'}</span>
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
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* KPI Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8"
        >
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
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Growth Trends */}
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
              </div>
            </motion.div>

            {/* Alerts */}
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
                {(dashboard?.alerts ?? []).map((alert) => (
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

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Subject Performance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Subject Mastery Overview</h3>
              <div className="h-72">
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
              </div>
            </motion.div>

            {/* Top Students */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Top Movers This Week</h3>
              <div className="space-y-4">
                {(dashboard?.topStudents ?? []).map((studentEntry) => (
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
