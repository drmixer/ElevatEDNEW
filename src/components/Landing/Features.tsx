import React from 'react';
import { Brain, Target, Users, Trophy, BarChart3, MessageCircle, BookOpen, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const Features: React.FC = () => {
  const features = [
    {
      icon: Brain,
      title: 'Adaptive Learning Paths',
      description: 'Our AI identifies knowledge gaps and creates personalized learning sequences that adapt to each student\'s pace and style.',
    },
    {
      icon: Target,
      title: 'Precision Diagnostics',
      description: 'Detailed assessments that map exactly where students need support, pinpointing specific concepts for targeted improvement.',
    },
    {
      icon: Users,
      title: 'Parent Progress Hub',
      description: 'Clear visualizations of learning progress with actionable insights to support your child\'s educational journey at home.',
    },
    {
      icon: Trophy,
      title: 'Motivational System',
      description: 'Thoughtfully designed reward mechanics that encourage consistent learning without creating unhealthy competition.',
    },
    {
      icon: BarChart3,
      title: 'Learning Analytics',
      description: 'Track mastery over time with detailed reports showing improvement patterns and areas needing continued attention.',
    },
    {
      icon: MessageCircle,
      title: '24/7 Learning Coach',
      description: 'Intelligent tutoring that explains concepts in multiple ways, answers questions, and provides encouragement when stuck.',
    },
    {
      icon: BookOpen,
      title: 'Standards-Aligned Content',
      description: 'Comprehensive K-12 curriculum built on state and national standards, regularly updated by education specialists.',
    },
    {
      icon: Zap,
      title: 'Real-Time Guidance',
      description: 'Immediate feedback on exercises with explanations that help students understand not just the answer, but the reasoning.',
    }
  ];

  return (
    <section id="features" className="py-24 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-teal-500 via-blue-600 to-violet-600 bg-clip-text text-transparent mb-6">
            Powerful Features for Modern Learning
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to create personalized, engaging, and effective learning experiences
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
            >
              <div className="w-14 h-14 bg-gradient-to-r from-teal-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-30">
                <feature.icon className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
