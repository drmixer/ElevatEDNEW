import React, { useState } from 'react';
import { Users, TrendingUp, Clock, Star, Calendar, Settings, Plus, Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { Parent, Student, PerformanceData } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const ParentDashboard: React.FC = () => {
  const { user } = useAuth();
  const parent = user as Parent;
  const [selectedChild, setSelectedChild] = useState<Student | null>(null);

  // Mock data for demonstration
  const mockChildren: Student[] = [
    {
      id: '1',
      email: 'child1@example.com',
      name: 'Emma Johnson',
      role: 'student',
      parentId: parent.id,
      grade: 8,
      xp: 1250,
      level: 5,
      badges: [
        { id: '1', name: 'Math Master', description: 'Completed 50 math lessons', icon: '🔢', earnedAt: new Date(), rarity: 'rare' }
      ],
      streakDays: 7,
      strengths: ['Algebra', 'Grammar'],
      weaknesses: ['Geometry', 'Vocabulary'],
      learningPath: [],
      assessmentCompleted: true
    },
    {
      id: '2',
      email: 'child2@example.com',
      name: 'Alex Johnson',
      role: 'student',
      parentId: parent.id,
      grade: 5,
      xp: 800,
      level: 3,
      badges: [
        { id: '2', name: 'Science Explorer', description: 'Completed first science unit', icon: '🔬', earnedAt: new Date(), rarity: 'common' }
      ],
      streakDays: 3,
      strengths: ['Reading', 'Addition'],
      weaknesses: ['Multiplication', 'Writing'],
      learningPath: [],
      assessmentCompleted: true
    }
  ];

  const weeklyProgressData = [
    { day: 'Mon', lessons: 3, timeSpent: 45 },
    { day: 'Tue', lessons: 2, timeSpent: 30 },
    { day: 'Wed', lessons: 4, timeSpent: 60 },
    { day: 'Thu', lessons: 3, timeSpent: 40 },
    { day: 'Fri', lessons: 2, timeSpent: 25 },
    { day: 'Sat', lessons: 1, timeSpent: 15 },
    { day: 'Sun', lessons: 2, timeSpent: 30 }
  ];

  const subjectPerformance = [
    { subject: 'Math', mastery: 85 },
    { subject: 'English', mastery: 92 },
    { subject: 'Science', mastery: 78 },
    { subject: 'Social Studies', mastery: 70 }
  ];

  const currentChild = selectedChild || mockChildren[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-brand-violet to-brand-blue rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-2">
                  Parent Dashboard
                </h1>
                <p className="opacity-90">
                  Track your children's learning progress and achievements
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors">
                  <Plus className="h-4 w-4" />
                  <span>Add Child</span>
                </button>
                <button className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-colors">
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Child Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex space-x-4">
            {mockChildren.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className={`flex items-center space-x-3 px-6 py-4 rounded-2xl transition-all ${
                  currentChild.id === child.id
                    ? 'bg-white shadow-lg border-2 border-brand-teal'
                    : 'bg-white shadow-sm hover:shadow-md'
                }`}
              >
                <div className="w-10 h-10 bg-brand-violet rounded-full flex items-center justify-center text-white font-semibold">
                  {child.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">{child.name}</div>
                  <div className="text-sm text-gray-600">Grade {child.grade} • Level {child.level}</div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Overview Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-brand-blue">{currentChild.level}</div>
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
                <div className="text-2xl font-bold text-brand-teal">{currentChild.xp}</div>
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
                <div className="text-2xl font-bold text-brand-violet">{currentChild.streakDays}</div>
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
                <div className="text-2xl font-bold text-gray-800">15h</div>
                <div className="text-sm text-gray-600">This Week</div>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Weekly Progress Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Weekly Learning Activity</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyProgressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="lessons" 
                      stroke="#33D9C1" 
                      strokeWidth={3}
                      dot={{ fill: '#33D9C1', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Subject Performance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Subject Mastery</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="mastery" fill="#971CB5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h3>
              <div className="space-y-4">
                {[
                  { activity: 'Completed "Quadratic Equations" lesson', subject: 'Math', time: '2 hours ago', xp: 50 },
                  { activity: 'Earned "Grammar Expert" badge', subject: 'English', time: '1 day ago', xp: 100 },
                  { activity: 'Finished Science quiz with 85% score', subject: 'Science', time: '2 days ago', xp: 25 }
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-brand-light-teal rounded-full flex items-center justify-center">
                        {item.subject === 'Math' && '🔢'}
                        {item.subject === 'English' && '📚'}
                        {item.subject === 'Science' && '🔬'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{item.activity}</div>
                        <div className="text-sm text-gray-600">{item.time}</div>
                      </div>
                    </div>
                    <div className="text-brand-teal font-medium">+{item.xp} XP</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Learning Insights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Learning Insights</h3>
              
              <div className="mb-6">
                <h4 className="font-semibold text-green-600 mb-3">💪 Strengths</h4>
                <div className="space-y-2">
                  {currentChild.strengths.map((strength, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm text-gray-700">{strength}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-orange-600 mb-3">🎯 Focus Areas</h4>
                <div className="space-y-2">
                  {currentChild.weaknesses.map((weakness, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full" />
                      <span className="text-sm text-gray-700">{weakness}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Recent Badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Achievements</h3>
              <div className="space-y-4">
                {currentChild.badges.map((badge, index) => (
                  <div key={badge.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-xl">
                    <div className="text-2xl">{badge.icon}</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{badge.name}</h4>
                      <p className="text-sm text-gray-600">{badge.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Notifications Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Notification Settings</h3>
              <div className="space-y-4">
                {[
                  { label: 'Weekly Progress Reports', enabled: true },
                  { label: 'Missed Learning Sessions', enabled: true },
                  { label: 'Low Quiz Scores', enabled: false },
                  { label: 'Achievement Unlocked', enabled: true }
                ].map((setting, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{setting.label}</span>
                    <div className={`w-12 h-6 rounded-full transition-colors ${
                      setting.enabled ? 'bg-brand-teal' : 'bg-gray-300'
                    }`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${
                        setting.enabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
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

export default ParentDashboard;