import React from 'react';
import { Brain, Target, Users, Trophy, BarChart3, MessageCircle, BookOpen, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const Features: React.FC = () => {
  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Adaptive Learning',
      description: 'Intelligent algorithms adjust difficulty in real-time based on student performance, ensuring optimal challenge levels.',
      gradient: 'from-teal-500 to-blue-600'
    },
    {
      icon: Target,
      title: 'Diagnostic Assessments',
      description: 'Comprehensive evaluations across Math, English, Science, and Social Studies to create personalized learning paths.',
      gradient: 'from-blue-600 to-violet-600'
    },
    {
      icon: Users,
      title: 'Parent Dashboard',
      description: 'Real-time progress tracking, performance insights, and weekly AI-generated summaries for complete visibility.',
      gradient: 'from-violet-600 to-pink-600'
    },
    {
      icon: Trophy,
      title: 'Gamified Experience',
      description: 'XP points, achievement badges, streak counters, and level progression keep students motivated and engaged.',
      gradient: 'from-pink-600 to-teal-500'
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Detailed performance metrics, concept mastery tracking, and learning trend analysis for data-driven insights.',
      gradient: 'from-teal-500 to-blue-600'
    },
    {
      icon: MessageCircle,
      title: 'AI Learning Assistant',
      description: 'Context-aware tutoring bot that provides step-by-step guidance, study tips, and personalized motivation.',
      gradient: 'from-blue-600 to-violet-600'
    },
    {
      icon: BookOpen,
      title: 'Comprehensive Curriculum',
      description: 'K-12 content across core subjects with adaptive difficulty and concept-specific reinforcement.',
      gradient: 'from-violet-600 to-pink-600'
    },
    {
      icon: Zap,
      title: 'Instant Feedback',
      description: 'Immediate quiz results, detailed explanations, and smart suggestions for review or advancement.',
      gradient: 'from-pink-600 to-teal-500'
    }
  ];

  return (
    <section id="features" className="py-24 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-teal-500 via-blue-600 to-violet-600 bg-clip-text text-transparent mb-6">
            Powerful Features for Modern Learning
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to create personalized, engaging, and effective learning experiences
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
            >
              <div className={`w-14 h-14 bg-gradient-to-r ${feature.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;