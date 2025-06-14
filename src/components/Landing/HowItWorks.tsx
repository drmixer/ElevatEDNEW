import React from 'react';
import { UserPlus, Brain, BookOpen, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const HowItWorks: React.FC = () => {
  const steps = [
    {
      icon: UserPlus,
      title: 'Sign Up & Choose Role',
      description: 'Create your account as a student or parent. Students can link to parent accounts for comprehensive tracking.',
      color: 'from-teal-500 to-blue-600'
    },
    {
      icon: Brain,
      title: 'Take Diagnostic Assessment',
      description: 'Complete our adaptive assessment across core subjects. Skip to start at grade level if preferred.',
      color: 'from-blue-600 to-violet-600'
    },
    {
      icon: BookOpen,
      title: 'Follow Personalized Path',
      description: 'Learn through adaptive lessons that adjust difficulty based on your performance and mastery.',
      color: 'from-violet-600 to-pink-600'
    },
    {
      icon: TrendingUp,
      title: 'Track Progress & Grow',
      description: 'Monitor advancement through detailed analytics, earn badges, and celebrate achievements.',
      color: 'from-pink-600 to-teal-500'
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-teal-500 via-blue-600 to-violet-600 bg-clip-text text-transparent mb-6">
            How ElevatED Works
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get started in minutes with our simple, proven approach to personalized learning
          </p>
        </motion.div>

        <div className="relative">
          {/* Connection Lines */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-500 via-blue-600 via-violet-600 to-pink-600 transform -translate-y-1/2" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="text-center relative"
              >
                <div className={`w-20 h-20 bg-gradient-to-r ${step.color} rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg relative z-10`}>
                  <step.icon className="h-10 w-10 text-white" />
                </div>
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-white rounded-full border-4 border-gray-200 hidden lg:block z-20" />
                <h3 className="text-xl font-bold text-gray-900 mb-4">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center mt-16"
        >
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Transform Learning?</h3>
            <p className="text-gray-600 mb-6">Join thousands of students and parents already using ElevatED</p>
            <button className="bg-gradient-to-r from-teal-500 to-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300">
              Start Your Free Trial
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;