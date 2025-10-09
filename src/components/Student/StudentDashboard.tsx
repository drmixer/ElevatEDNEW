import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  Clock,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { Student, StudentDashboardData } from '../../types';
import LearningAssistant from './LearningAssistant';
import AssessmentFlow from './AssessmentFlow';
import { fetchStudentDashboardData } from '../../services/dashboardService';

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const student = user as Student | null;
  const [activeView, setActiveView] = useState<'dashboard' | 'assessment' | 'lesson'>('dashboard');
  const [dashboard, setDashboard] = useState<StudentDashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!student) return;
    setLoadingDashboard(true);
    setError(null);
    try {
      const data = await fetchStudentDashboardData({ ...student });
      setDashboard(data);
    } catch (err) {
      console.error('[StudentDashboard] load failed', err);
      setError('We could not reach the learning analytics service. Showing your latest cached data instead.');
    } finally {
      setLoadingDashboard(false);
    }
  }, [student]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activityChartData = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.dailyActivity.map((entry) => ({
      label: new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short' }),
      lessons: entry.lessonsCompleted,
      minutes: entry.practiceMinutes,
      xp: entry.xpEarned,
    }));
  }, [dashboard]);

  const masteryDisplay = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.subjectMastery.map((item) => ({
      ...item,
      label:
        item.subject === 'social_studies'
          ? 'Social Studies'
          : item.subject.charAt(0).toUpperCase() + item.subject.slice(1),
    }));
  }, [dashboard]);

  if (!student) {
    return null;
  }

  if (activeView === 'assessment') {
    return <AssessmentFlow onComplete={() => setActiveView('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-brand-teal to-brand-blue rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-2">Welcome back, {student.name}! 🌟</h1>
                <p className="opacity-90">
                  Your AI tutor has fresh insights lined up—let’s keep the momentum going.
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => loadDashboard()}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors"
                  disabled={loadingDashboard}
                >
                  <RefreshCw className={`h-4 w-4 ${loadingDashboard ? 'animate-spin' : ''}`} />
                  <span>{loadingDashboard ? 'Refreshing' : 'Refresh'}</span>
                </button>
                <div className="text-right">
                  <div className="text-3xl font-bold">
                    {dashboard?.quickStats.totalXp ?? student.xp}
                  </div>
                  <div className="text-sm opacity-90">Total XP</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-brand-blue">
                  {dashboard?.quickStats.level ?? student.level}
                </div>
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
                <div className="text-2xl font-bold text-brand-violet">
                  {dashboard?.quickStats.streakDays ?? student.streakDays}
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
                <div className="text-2xl font-bold text-brand-teal">
                  {dashboard?.recentBadges.length ?? student.badges.length}
                </div>
                <div className="text-sm text-gray-600">Badges Earned</div>
              </div>
              <div className="w-12 h-12 bg-brand-light-teal rounded-full flex items-center justify-center">
                <Trophy className="h-6 w-6 text-brand-teal" />
              </div>
            </div>
          </div>

  <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-800">
                  {dashboard?.quickStats.hoursThisWeek ?? 0}h
                </div>
                <div className="text-sm text-gray-600">Hours This Week</div>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="mb-8 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Heads up!</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Assessment CTA */}
            {!(dashboard?.quickStats.assessmentCompleted ?? student.assessmentCompleted) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-r from-brand-violet to-brand-blue rounded-2xl p-6 text-white"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Complete Your Assessment</h3>
                    <p className="opacity-90 mb-4">
                      Take our adaptive diagnostic to unlock a precision learning path tailored by AI.
                    </p>
                    <button
                      onClick={() => setActiveView('assessment')}
                      className="bg-white text-brand-violet px-6 py-2 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                    >
                      Start Assessment
                    </button>
                  </div>
                  <div className="text-6xl opacity-80">
                    <Brain className="h-16 w-16" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Today's Focus */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Today's Focus</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Target className="h-4 w-4" />
                  <span>{dashboard?.todaysPlan.length ?? 0} lessons queued</span>
                </div>
              </div>

              <div className="space-y-4">
                {(dashboard?.todaysPlan ?? []).map((lesson, index) => (
                  <motion.div
                    key={lesson.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.08 }}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          lesson.status === 'completed' ? 'bg-green-100' : 'bg-gray-100'
                        }`}
                      >
                        {lesson.status === 'completed' ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : (
                          <Play className="h-6 w-6 text-gray-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{lesson.title}</h4>
                        <div className="flex items-center space-x-3 text-sm text-gray-600">
                          <span className="capitalize">{lesson.subject.replace('_', ' ')}</span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              lesson.difficulty === 'easy'
                                ? 'bg-green-100 text-green-800'
                                : lesson.difficulty === 'medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {lesson.difficulty}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-medium text-brand-teal">
                          +{lesson.xpReward} XP
                        </div>
                        {lesson.dueAt && (
                          <div className="text-xs text-gray-500">
                            Due{' '}
                            {new Date(lesson.dueAt).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                      </div>
                      {lesson.status !== 'completed' && (
                        <button className="bg-brand-teal text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-blue transition-colors">
                          Start
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
                {(dashboard?.todaysPlan?.length ?? 0) === 0 && (
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                    <p className="text-sm text-gray-600">
                      Your AI coach will assign fresh lessons after you complete the diagnostic.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Weekly Activity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Weekly Activity Pulse</h3>
                <div className="flex items-center text-sm text-gray-500 space-x-2">
                  <Sparkles className="h-4 w-4" />
                  <span>Adaptive streak insights</span>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2FF" />
                    <XAxis dataKey="label" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', borderColor: '#E5E7EB' }}
                      labelStyle={{ color: '#1F2937', fontWeight: 600 }}
                    />
                    <defs>
                      <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#33D9C1" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#33D9C1" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="minutes"
                      stroke="#33D9C1"
                      fill="url(#activityGradient)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Upcoming Assessments */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Upcoming Milestones</h3>
                <div className="flex items-center text-sm text-gray-500 space-x-2">
                  <Sparkles className="h-4 w-4" />
                  <span>Stay assessment-ready</span>
                </div>
              </div>
              <div className="space-y-4">
                {(dashboard?.upcomingAssessments ?? []).map((assessment) => (
                  <div
                    key={assessment.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-xl"
                  >
                    <div>
                      <h4 className="font-semibold text-gray-900">{assessment.title}</h4>
                      <p className="text-sm text-gray-600">
                        {assessment.scheduledAt
                          ? `Scheduled ${new Date(assessment.scheduledAt).toLocaleString([], {
                              weekday: 'short',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}`
                          : 'Flexible timing'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          assessment.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : assessment.status === 'overdue'
                            ? 'bg-rose-100 text-rose-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}
                      >
                        {assessment.status === 'completed'
                          ? 'Completed'
                          : assessment.status === 'overdue'
                          ? 'Overdue'
                          : 'Scheduled'}
                      </span>
                      {assessment.masteryTarget && (
                        <div className="text-xs text-gray-500 mt-1">
                          Target mastery: {assessment.masteryTarget}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(dashboard?.upcomingAssessments?.length ?? 0) === 0 && (
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
                    <p className="text-sm text-gray-600">
                      No assessments scheduled yet. Complete today’s focus to unlock your next diagnostic.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Subject Mastery */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Subject Mastery</h3>
              <div className="space-y-4">
                {masteryDisplay.map((subject) => (
                  <div key={subject.subject}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="h-4 w-4 text-brand-blue" />
                        <span className="font-semibold text-gray-900">{subject.label}</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {Math.round(subject.mastery)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-brand-teal to-brand-blue h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(subject.mastery, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recent Badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Achievements</h3>
              <div className="space-y-4">
                {(dashboard?.recentBadges ?? []).map((badge, index) => (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.08 }}
                    className="flex items-center space-x-3 p-3 border border-gray-200 rounded-xl"
                  >
                    <div className="text-2xl">{badge.icon}</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{badge.name}</h4>
                      <p className="text-sm text-gray-600">{badge.description}</p>
                      <p className="text-xs text-gray-400">
                        {badge.earnedAt ? new Date(badge.earnedAt).toLocaleString() : ''}
                      </p>
                    </div>
                  </motion.div>
                ))}
                {(dashboard?.recentBadges?.length ?? 0) === 0 && (
                  <p className="text-sm text-gray-600">
                    Your next badge is within reach—complete lessons to unlock it.
                  </p>
                )}
              </div>
            </motion.div>

            {/* AI Recommendations */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-gradient-to-br from-brand-light-violet to-white rounded-2xl p-6 shadow-sm border border-brand-light-violet/40"
            >
              <div className="flex items-center space-x-3 mb-4">
                <Sparkles className="h-5 w-5 text-brand-violet" />
                <h3 className="text-xl font-bold text-gray-900">AI Insights</h3>
              </div>
              <div className="space-y-3">
                {(dashboard?.aiRecommendations ?? []).map((tip, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 bg-white/80 border border-white rounded-xl p-3 shadow-sm"
                  >
                    <div className="mt-1 text-brand-violet">✶</div>
                    <p className="text-sm text-gray-700">{tip}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* XP Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">XP Timeline</h3>
              <div className="space-y-4">
                {(dashboard?.xpTimeline ?? []).map((event) => (
                  <div key={event.date} className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-full bg-brand-light-teal flex items-center justify-center text-brand-teal font-semibold">
                      +{event.xpEarned}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{event.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(event.date).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Learning Assistant */}
      <LearningAssistant />
    </div>
  );
};

export default StudentDashboard;
