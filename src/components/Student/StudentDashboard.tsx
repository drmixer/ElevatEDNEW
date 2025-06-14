import React, { useState } from 'react';
import { BookOpen, Brain, Trophy, Target, Clock, Star, Play, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { Student, Subject } from '../../types';
import LearningAssistant from './LearningAssistant';
import AssessmentFlow from './AssessmentFlow';

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const student = user as Student;
  const [activeView, setActiveView] = useState<'dashboard' | 'assessment' | 'lesson'>('dashboard');

  const subjects: { name: Subject; icon: string; color: string; progress: number }[] = [
    { name: 'math', icon: '🔢', color: 'bg-blue-500', progress: 75 },
    { name: 'english', icon: '📚', color: 'bg-green-500', progress: 60 },
    { name: 'science', icon: '🔬', color: 'bg-purple-500', progress: 45 },
    { name: 'social_studies', icon: '🌍', color: 'bg-orange-500', progress: 30 }
  ];

  const todayLessons = [
    { id: '1', subject: 'Math', topic: 'Quadratic Equations', difficulty: 'Medium', xp: 50, completed: false },
    { id: '2', subject: 'English', topic: 'Essay Writing', difficulty: 'Hard', xp: 75, completed: true },
    { id: '3', subject: 'Science', topic: 'Photosynthesis', difficulty: 'Easy', xp: 25, completed: false },
  ];

  const recentBadges = student.badges.slice(0, 3);

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
                <h1 className="text-2xl font-bold mb-2">
                  Welcome back, {student.name}! 🌟
                </h1>
                <p className="opacity-90">
                  Ready to continue your learning journey? You're doing amazing!
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{student.xp}</div>
                <div className="text-sm opacity-90">Total XP</div>
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
                <div className="text-2xl font-bold text-brand-blue">{student.level}</div>
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
                <div className="text-2xl font-bold text-brand-violet">{student.streakDays}</div>
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
                <div className="text-2xl font-bold text-brand-teal">{student.badges.length}</div>
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
                <div className="text-2xl font-bold text-gray-800">12</div>
                <div className="text-sm text-gray-600">Hours This Week</div>
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
            {/* Quick Actions */}
            {!student.assessmentCompleted && (
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
                      Take our adaptive diagnostic to get your personalized learning path!
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

            {/* Today's Lessons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Today's Lessons</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Target className="h-4 w-4" />
                  <span>3 lessons planned</span>
                </div>
              </div>

              <div className="space-y-4">
                {todayLessons.map((lesson, index) => (
                  <motion.div
                    key={lesson.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        lesson.completed ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {lesson.completed ? 
                          <CheckCircle className="h-6 w-6 text-green-600" /> :
                          <Play className="h-6 w-6 text-gray-600" />
                        }
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{lesson.topic}</h4>
                        <div className="flex items-center space-x-3 text-sm text-gray-600">
                          <span>{lesson.subject}</span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            lesson.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                            lesson.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {lesson.difficulty}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-medium text-brand-teal">+{lesson.xp} XP</div>
                      </div>
                      {!lesson.completed && (
                        <button className="bg-brand-teal text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-blue transition-colors">
                          Start
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Subject Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Subject Progress</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {subjects.map((subject, index) => (
                  <motion.div
                    key={subject.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{subject.icon}</div>
                        <h4 className="font-semibold text-gray-900 capitalize">
                          {subject.name.replace('_', ' ')}
                        </h4>
                      </div>
                      <span className="text-sm font-medium text-gray-600">{subject.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-brand-teal to-brand-blue h-2 rounded-full transition-all duration-300"
                        style={{ width: `${subject.progress}%` }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Recent Badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Badges</h3>
              <div className="space-y-4">
                {recentBadges.map((badge, index) => (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className="flex items-center space-x-3 p-3 border border-gray-200 rounded-xl"
                  >
                    <div className="text-2xl">{badge.icon}</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{badge.name}</h4>
                      <p className="text-sm text-gray-600">{badge.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Strengths & Weaknesses */}
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
                  {student.strengths.map((strength, index) => (
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
                  {student.weaknesses.map((weakness, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full" />
                      <span className="text-sm text-gray-700">{weakness}</span>
                    </div>
                  ))}
                </div>
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