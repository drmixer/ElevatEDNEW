import React from 'react';
import { UserPlus, Brain, BookOpen, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      icon: UserPlus,
      title: 'Create Your Account',
      description: 'Set up your profile as a student or parent. Link family accounts to share progress and insights.',
    },
    {
      icon: Brain,
      title: 'Discover Learning Gaps',
      description: 'Complete our precision assessment to identify exactly where you need to focus your learning efforts.',
    },
    {
      icon: BookOpen,
      title: 'Learn Your Way',
      description: 'Engage with personalized lessons that adapt to your learning style and pace, ensuring steady progress.',
    },
    {
      icon: TrendingUp,
      title: 'See Real Growth',
      description: 'Track meaningful progress through detailed reports and celebrate achievements that matter.',
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-teal-500 via-blue-600 to-violet-600 bg-clip-text text-transparent mb-6">
            How ElevatED Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get started in minutes with our simple, proven approach to personalized learning
          </p>
        </div>

        <div className="relative">
          {/* Connection Lines */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-500 via-blue-600 via-violet-600 to-pink-600 transform -translate-y-1/2" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {steps.map((step, index) => (
              <div
                key={index}
                className="text-center relative"
              >
                <div className="w-20 h-20 bg-gradient-to-r from-teal-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg relative z-10">
                  <step.icon className="h-10 w-10 text-white" />
                </div>
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-white rounded-full border-4 border-gray-200 hidden lg:block z-20" />
                <h3 className="text-xl font-bold text-gray-900 mb-4">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Transform Learning?</h3>
            <p className="text-gray-600 mb-6">Join thousands of students and parents already using ElevatED</p>
            <button className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300">
              Start Your Free Trial
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
