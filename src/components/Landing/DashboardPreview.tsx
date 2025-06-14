import React, { useState } from 'react';
import { Play, Star, Trophy, Brain, BookOpen, TrendingUp, Users, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DashboardPreview: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'student' | 'parent'>('student');

  const studentData = {
    name: 'Emma Johnson',
    level: 8,
    xp: 2450,
    streak: 12,
    badges: 15,
    subjects: [
      { name: 'Math', progress: 85, color: 'from-blue-500 to-blue-600' },
      { name: 'English', progress: 92, color: 'from-green-500 to-green-600' },
      { name: 'Science', progress: 78, color: 'from-purple-500 to-purple-600' },
      { name: 'History', progress: 65, color: 'from-orange-500 to-orange-600' }
    ],
    recentLessons: [
      { subject: 'Math', topic: 'Quadratic Equations', xp: 75, completed: true },
      { subject: 'English', topic: 'Essay Writing', xp: 50, completed: false },
      { subject: 'Science', topic: 'Photosynthesis', xp: 60, completed: false }
    ]
  };

  const parentData = {
    children: [
      { name: 'Emma', grade: 8, progress: 85, streak: 12 },
      { name: 'Alex', grade: 5, progress: 72, streak: 8 }
    ],
    weeklyStats: [
      { day: 'Mon', lessons: 4 },
      { day: 'Tue', lessons: 3 },
      { day: 'Wed', lessons: 5 },
      { day: 'Thu', lessons: 2 },
      { day: 'Fri', lessons: 4 },
      { day: 'Sat', lessons: 1 },
      { day: 'Sun', lessons: 3 }
    ]
  };

  return (
    <section id="dashboard-preview" className="py-24 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-teal-500 via-blue-600 to-violet-600 bg-clip-text text-transparent mb-6">
            See ElevatED in Action
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Experience our intuitive dashboards designed for both students and parents
          </p>
          
          {/* Tab Selector */}
          <div className="flex justify-center mb-12">
            <div className="bg-white rounded-2xl p-2 shadow-lg">
              <button
                onClick={() => setActiveTab('student')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  activeTab === 'student'
                    ? 'bg-gradient-to-r from-teal-500 to-blue-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Student Dashboard
              </button>
              <button
                onClick={() => setActiveTab('parent')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  activeTab === 'parent'
                    ? 'bg-gradient-to-r from-violet-500 to-pink-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Parent Dashboard
              </button>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === 'student' ? (
            <motion.div
              key="student"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Mock Student Dashboard */}
              <div className="bg-gradient-to-r from-teal-500 to-blue-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Welcome back, {studentData.name}! 🌟</h3>
                    <p className="opacity-90">Ready to continue your learning journey?</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">{studentData.xp}</div>
                    <div className="text-sm opacity-90">Total XP</div>
                  </div>
                </div>
              </div>

              <div className="p-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{studentData.level}</div>
                        <div className="text-sm text-gray-600">Current Level</div>
                      </div>
                      <Star className="h-8 w-8 text-blue-500" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-violet-600">{studentData.streak}</div>
                        <div className="text-sm text-gray-600">Day Streak</div>
                      </div>
                      <div className="text-2xl">🔥</div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-teal-600">{studentData.badges}</div>
                        <div className="text-sm text-gray-600">Badges Earned</div>
                      </div>
                      <Trophy className="h-8 w-8 text-teal-500" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-gray-700">18h</div>
                        <div className="text-sm text-gray-600">This Week</div>
                      </div>
                      <BarChart3 className="h-8 w-8 text-gray-500" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Subject Progress */}
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 mb-6">Subject Progress</h4>
                    <div className="space-y-4">
                      {studentData.subjects.map((subject, index) => (
                        <div key={index} className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-semibold text-gray-900">{subject.name}</h5>
                            <span className="text-sm font-medium text-gray-600">{subject.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className={`bg-gradient-to-r ${subject.color} h-3 rounded-full transition-all duration-500`}
                              style={{ width: `${subject.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Today's Lessons */}
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 mb-6">Today's Lessons</h4>
                    <div className="space-y-4">
                      {studentData.recentLessons.map((lesson, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center space-x-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              lesson.completed ? 'bg-green-100' : 'bg-blue-100'
                            }`}>
                              {lesson.completed ? 
                                <Trophy className="h-5 w-5 text-green-600" /> :
                                <Play className="h-5 w-5 text-blue-600" />
                              }
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900">{lesson.topic}</h5>
                              <p className="text-sm text-gray-600">{lesson.subject}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-teal-600">+{lesson.xp} XP</div>
                            {!lesson.completed && (
                              <button className="mt-1 bg-teal-500 text-white px-3 py-1 rounded-lg text-xs font-medium">
                                Start
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="parent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Mock Parent Dashboard */}
              <div className="bg-gradient-to-r from-violet-500 to-pink-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Parent Dashboard</h3>
                    <p className="opacity-90">Track your children's learning progress</p>
                  </div>
                  <Users className="h-12 w-12 opacity-80" />
                </div>
              </div>

              <div className="p-8">
                {/* Children Overview */}
                <div className="mb-8">
                  <h4 className="text-xl font-bold text-gray-900 mb-6">Your Children</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {parentData.children.map((child, index) => (
                      <div key={index} className="bg-gradient-to-br from-violet-50 to-pink-50 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-violet-500 rounded-full flex items-center justify-center text-white font-bold">
                              {child.name.charAt(0)}
                            </div>
                            <div>
                              <h5 className="font-bold text-gray-900">{child.name}</h5>
                              <p className="text-sm text-gray-600">Grade {child.grade}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-violet-600">{child.progress}%</div>
                            <div className="text-xs text-gray-600">Overall Progress</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center space-x-1">
                            <div className="text-lg">🔥</div>
                            <span className="font-medium">{child.streak} day streak</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="text-green-600 font-medium">Improving</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Weekly Activity Chart */}
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 mb-6">Weekly Learning Activity</h4>
                    <div className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-end justify-between h-32 space-x-2">
                        {parentData.weeklyStats.map((day, index) => (
                          <div key={index} className="flex flex-col items-center flex-1">
                            <div
                              className="bg-gradient-to-t from-violet-500 to-pink-500 rounded-t-lg w-full transition-all duration-500"
                              style={{ height: `${(day.lessons / 5) * 100}%`, minHeight: '8px' }}
                            />
                            <div className="text-xs text-gray-600 mt-2">{day.day}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recent Achievements */}
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 mb-6">Recent Achievements</h4>
                    <div className="space-y-4">
                      {[
                        { child: 'Emma', achievement: 'Completed Algebra Unit', time: '2 hours ago', icon: '🎯' },
                        { child: 'Alex', achievement: 'Earned Reading Badge', time: '1 day ago', icon: '📚' },
                        { child: 'Emma', achievement: '10-day Learning Streak', time: '2 days ago', icon: '🔥' }
                      ].map((item, index) => (
                        <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                          <div className="text-2xl">{item.icon}</div>
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-900">{item.child} - {item.achievement}</h5>
                            <p className="text-sm text-gray-600">{item.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default DashboardPreview;